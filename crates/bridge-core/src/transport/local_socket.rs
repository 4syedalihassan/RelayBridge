//! Cross-platform local socket IPC client/server implementation.
//!
//! Linux/macOS use Unix Domain Sockets (UDS), while Windows uses Named Pipes.

use crate::manager::BridgeManager;
use crate::error::{BridgeError, BridgeResult};
use crate::types::*;
use crate::transport::protocol::{write_frame, read_frame, RequestFrame, ResponseFrame};
use std::sync::Arc;
use uuid::Uuid;
use async_trait::async_trait;
use tracing::{info, error, warn};

// ── Platform Abstractions ───────────────────────────────────────────────────

#[cfg(unix)]
pub struct LocalListener {
    inner: tokio::net::UnixListener,
}

#[cfg(unix)]
impl LocalListener {
    pub async fn bind(path: &str) -> std::io::Result<Self> {
        // Ensure parent directory exists
        if let Some(parent) = std::path::Path::new(path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        // Unlink socket if it already exists
        let _ = std::fs::remove_file(path);
        let inner = tokio::net::UnixListener::bind(path)?;
        Ok(Self { inner })
    }

    pub async fn accept(&self) -> std::io::Result<tokio::net::UnixStream> {
        let (stream, _) = self.inner.accept().await?;
        Ok(stream)
    }
}

#[cfg(unix)]
pub type LocalStream = tokio::net::UnixStream;

#[cfg(unix)]
pub async fn connect(path: &str) -> std::io::Result<LocalStream> {
    tokio::net::UnixStream::connect(path).await
}

#[cfg(windows)]
pub struct LocalListener {
    path: String,
}

#[cfg(windows)]
impl LocalListener {
    pub async fn bind(path: &str) -> std::io::Result<Self> {
        Ok(Self { path: path.to_string() })
    }

    pub async fn accept(&self) -> std::io::Result<tokio::net::windows::named_pipe::NamedPipeServer> {
        use tokio::net::windows::named_pipe::ServerOptions;
        
        let server = ServerOptions::new()
            .first_pipe_instance(false)
            .create(&self.path)?;
            
        server.connect().await?;
        Ok(server)
    }
}

#[cfg(windows)]
pub type LocalStream = tokio::net::windows::named_pipe::NamedPipeClient;

#[cfg(windows)]
pub async fn connect(path: &str) -> std::io::Result<LocalStream> {
    use tokio::net::windows::named_pipe::ClientOptions;
    
    let mut retries = 10;
    loop {
        match ClientOptions::new().open(path) {
            Ok(client) => return Ok(client),
            Err(e) if retries > 0 && (e.kind() == std::io::ErrorKind::WouldBlock || e.raw_os_error() == Some(231)) => {
                // OS error 231 is ERROR_PIPE_BUSY
                retries -= 1;
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
            Err(e) => return Err(e),
        }
    }
}

// ── Server Implementation ───────────────────────────────────────────────────

pub struct LocalSocketServer {
    manager: Arc<dyn BridgeManager>,
    socket_path: String,
}

impl LocalSocketServer {
    pub fn new(manager: Arc<dyn BridgeManager>, socket_path: String) -> Self {
        Self { manager, socket_path }
    }

    pub async fn start(self) -> std::io::Result<()> {
        let path = self.socket_path.clone();
        info!(path = %path, "Starting LocalSocketServer");
        
        let listener = LocalListener::bind(&path).await?;
        
        loop {
            match listener.accept().await {
                Ok(stream) => {
                    let manager = Arc::clone(&self.manager);
                    tokio::spawn(async move {
                        if let Err(e) = handle_connection(stream, manager).await {
                            warn!("Finished client connection: {:?}", e);
                        }
                    });
                }
                Err(e) => {
                    error!("Error accepting connection: {:?}", e);
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            }
        }
    }
}

async fn handle_connection<S>(mut stream: S, manager: Arc<dyn BridgeManager>) -> std::io::Result<()>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    loop {
        let req: RequestFrame = match read_frame(&mut stream).await {
            Ok(frame) => frame,
            Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                break; // Client disconnected
            }
            Err(e) => {
                return Err(e);
            }
        };

        let result = match req.method.as_str() {
            "list_connectors" => {
                match manager.list_connectors().await {
                    Ok(res) => ResponseFrame {
                        id: req.id,
                        result: Some(serde_json::to_value(res)?),
                        error: None,
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "get_connector" => {
                let id_val = req.params.get("id").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<ConnectorId>(id_val) {
                    Ok(id) => match manager.get_connector(&id).await {
                        Ok(res) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::to_value(res)?),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            "create_connector" => {
                let req_val = req.params.get("req").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<CreateConnectorRequest>(req_val) {
                    Ok(create_req) => match manager.create_connector(create_req).await {
                        Ok(res) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::to_value(res)?),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            "update_connector" => {
                let id_val = req.params.get("id").cloned().unwrap_or_default();
                let req_val = req.params.get("req").cloned().unwrap_or_default();
                match (serde_json::from_value::<ConnectorId>(id_val), serde_json::from_value::<UpdateConnectorRequest>(req_val)) {
                    (Ok(id), Ok(update_req)) => match manager.update_connector(&id, update_req).await {
                        Ok(res) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::to_value(res)?),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    (Err(e), _) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid connector ID: {}", e)),
                    },
                    (_, Err(e)) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid update request: {}", e)),
                    }
                }
            }
            "delete_connector" => {
                let id_val = req.params.get("id").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<ConnectorId>(id_val) {
                    Ok(id) => match manager.delete_connector(&id).await {
                        Ok(()) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::Value::Null),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            "toggle_connector" => {
                let id_val = req.params.get("id").cloned().unwrap_or_default();
                let enabled_val = req.params.get("enabled").cloned().unwrap_or_default();
                match (serde_json::from_value::<ConnectorId>(id_val), serde_json::from_value::<bool>(enabled_val)) {
                    (Ok(id), Ok(enabled)) => match manager.toggle_connector(&id, enabled).await {
                        Ok(()) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::Value::Null),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    (Err(e), _) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid connector ID: {}", e)),
                    },
                    (_, Err(e)) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid enabled param: {}", e)),
                    }
                }
            }
            "get_discord_guilds" => {
                match manager.get_discord_guilds().await {
                    Ok(res) => ResponseFrame {
                        id: req.id,
                        result: Some(serde_json::to_value(res)?),
                        error: None,
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "get_discord_channels" => {
                let guild_id_val = req.params.get("guild_id").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<String>(guild_id_val) {
                    Ok(guild_id) => match manager.get_discord_channels(&guild_id).await {
                        Ok(res) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::to_value(res)?),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            "get_analytics_summary" => {
                match manager.get_analytics_summary().await {
                    Ok(res) => ResponseFrame {
                        id: req.id,
                        result: Some(serde_json::to_value(res)?),
                        error: None,
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "get_connector_analytics" => {
                let id_val = req.params.get("id").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<ConnectorId>(id_val) {
                    Ok(id) => match manager.get_connector_analytics(&id).await {
                        Ok(res) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::to_value(res)?),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            "get_health" => {
                match manager.get_health().await {
                    Ok(res) => ResponseFrame {
                        id: req.id,
                        result: Some(serde_json::to_value(res)?),
                        error: None,
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "get_config" => {
                match manager.get_config().await {
                    Ok(res) => ResponseFrame {
                        id: req.id,
                        result: Some(serde_json::to_value(res)?),
                        error: None,
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            "update_config" => {
                let config_val = req.params.get("config").cloned().unwrap_or(req.params.clone());
                match serde_json::from_value::<crate::AppConfig>(config_val) {
                    Ok(config) => match manager.update_config(config).await {
                        Ok(()) => ResponseFrame {
                            id: req.id,
                            result: Some(serde_json::Value::Null),
                            error: None,
                        },
                        Err(e) => ResponseFrame {
                            id: req.id,
                            result: None,
                            error: Some(e.to_string()),
                        },
                    },
                    Err(e) => ResponseFrame {
                        id: req.id,
                        result: None,
                        error: Some(format!("Invalid request params: {}", e)),
                    }
                }
            }
            other => ResponseFrame {
                id: req.id,
                result: None,
                error: Some(format!("Unknown method: {}", other)),
            }
        };

        write_frame(&mut stream, &result).await?;
    }
    Ok(())
}

// ── Client Implementation ───────────────────────────────────────────────────

pub struct LocalSocketManager {
    socket_path: String,
}

impl LocalSocketManager {
    pub fn new(socket_path: String) -> Self {
        Self { socket_path }
    }

    async fn call_method(&self, method: &str, params: serde_json::Value) -> BridgeResult<serde_json::Value> {
        let mut stream = connect(&self.socket_path).await.map_err(|e| {
            BridgeError::Internal(format!(
                "Failed to connect to local socket {}: {}",
                self.socket_path, e
            ))
        })?;

        let id = Uuid::new_v4().to_string();
        let req = RequestFrame {
            id: id.clone(),
            method: method.to_string(),
            params,
        };

        write_frame(&mut stream, &req).await.map_err(|e| {
            BridgeError::Internal(format!("Failed to write to local socket: {}", e))
        })?;

        let resp: ResponseFrame = read_frame(&mut stream).await.map_err(|e| {
            BridgeError::Internal(format!("Failed to read from local socket: {}", e))
        })?;

        if resp.id != id {
            return Err(BridgeError::Internal("Mismatched request/response ID".to_string()));
        }

        if let Some(err) = resp.error {
            return Err(BridgeError::Internal(err));
        }

        resp.result.ok_or_else(|| {
            BridgeError::Internal("Response missing both result and error".to_string())
        })
    }
}

#[async_trait]
impl BridgeManager for LocalSocketManager {
    async fn list_connectors(&self) -> BridgeResult<Vec<Connector>> {
        let val = self.call_method("list_connectors", serde_json::json!({})).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_connector(&self, id: &ConnectorId) -> BridgeResult<Connector> {
        let val = self.call_method("get_connector", serde_json::json!({ "id": id })).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn create_connector(&self, req: CreateConnectorRequest) -> BridgeResult<Connector> {
        let val = self.call_method("create_connector", serde_json::json!({ "req": req })).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn update_connector(
        &self,
        id: &ConnectorId,
        req: UpdateConnectorRequest,
    ) -> BridgeResult<Connector> {
        let val = self.call_method("update_connector", serde_json::json!({ "id": id, "req": req })).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn delete_connector(&self, id: &ConnectorId) -> BridgeResult<()> {
        let _ = self.call_method("delete_connector", serde_json::json!({ "id": id })).await?;
        Ok(())
    }

    async fn toggle_connector(&self, id: &ConnectorId, enabled: bool) -> BridgeResult<()> {
        let _ = self.call_method("toggle_connector", serde_json::json!({ "id": id, "enabled": enabled })).await?;
        Ok(())
    }

    async fn get_discord_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
        let val = self.call_method("get_discord_guilds", serde_json::json!({})).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_discord_channels(&self, guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
        let val = self.call_method("get_discord_channels", serde_json::json!({ "guild_id": guild_id })).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary> {
        let val = self.call_method("get_analytics_summary", serde_json::json!({})).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_connector_analytics(&self, id: &ConnectorId) -> BridgeResult<ConnectorAnalytics> {
        let val = self.call_method("get_connector_analytics", serde_json::json!({ "id": id })).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_health(&self) -> BridgeResult<HealthStatus> {
        let val = self.call_method("get_health", serde_json::json!({})).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn get_config(&self) -> BridgeResult<crate::AppConfig> {
        let val = self.call_method("get_config", serde_json::json!({})).await?;
        serde_json::from_value(val).map_err(|e| BridgeError::Internal(e.to_string()))
    }

    async fn update_config(&self, config: crate::AppConfig) -> BridgeResult<()> {
        let _ = self.call_method("update_config", serde_json::json!({ "config": config })).await?;
        Ok(())
    }
}

// ── Unit Tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    struct MockManager;

    #[async_trait]
    impl BridgeManager for MockManager {
        async fn list_connectors(&self) -> BridgeResult<Vec<Connector>> {
            Ok(vec![])
        }
        async fn get_connector(&self, _id: &ConnectorId) -> BridgeResult<Connector> {
            Err(BridgeError::NotFound("Mock".to_string()))
        }
        async fn create_connector(&self, _req: CreateConnectorRequest) -> BridgeResult<Connector> {
            Err(BridgeError::Internal("Not impl".to_string()))
        }
        async fn update_connector(&self, _id: &ConnectorId, _req: UpdateConnectorRequest) -> BridgeResult<Connector> {
            Err(BridgeError::Internal("Not impl".to_string()))
        }
        async fn delete_connector(&self, _id: &ConnectorId) -> BridgeResult<()> {
            Ok(())
        }
        async fn toggle_connector(&self, _id: &ConnectorId, _enabled: bool) -> BridgeResult<()> {
            Ok(())
        }
        async fn get_discord_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
            Ok(vec![])
        }
        async fn get_discord_channels(&self, _guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
            Ok(vec![])
        }
        async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary> {
            Ok(AnalyticsSummary {
                total_archived: 42,
                active_connections: 2,
                overall_success_rate: 98.5,
                archived_today: 5,
            })
        }
        async fn get_connector_analytics(&self, _id: &ConnectorId) -> BridgeResult<ConnectorAnalytics> {
            Err(BridgeError::Internal("Not impl".to_string()))
        }
        async fn get_health(&self) -> BridgeResult<HealthStatus> {
            Ok(HealthStatus::Online)
        }
        async fn get_config(&self) -> BridgeResult<crate::AppConfig> {
            Ok(crate::AppConfig::default())
        }
        async fn update_config(&self, _config: crate::AppConfig) -> BridgeResult<()> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_local_socket_ipc_roundtrip() {
        let socket_path = if cfg!(windows) {
            r"\\.\pipe\test-discord-gr-pipe".to_string()
        } else {
            "/tmp/test-discord-gr.sock".to_string()
        };

        let server_path = socket_path.clone();
        let server = LocalSocketServer::new(Arc::new(MockManager), server_path);
        
        tokio::spawn(async move {
            let _ = server.start().await;
        });

        // Give server a tiny bit of time to bind/create pipe
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;

        let client = LocalSocketManager::new(socket_path);

        // Test list_connectors
        let conns = client.list_connectors().await.unwrap();
        assert!(conns.is_empty());

        // Test get_health
        let health = client.get_health().await.unwrap();
        assert_eq!(health, HealthStatus::Online);

        // Test get_analytics_summary
        let summary = client.get_analytics_summary().await.unwrap();
        assert_eq!(summary.total_archived, 42);
        assert_eq!(summary.active_connections, 2);
    }
}
