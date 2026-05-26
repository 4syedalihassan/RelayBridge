//! InProcessManager — implements BridgeManager via direct function calls.
//!
//! Used in desktop (Tauri) mode where the bridge runs in the same process.
//! No serialization overhead — all operations are direct Rust method calls.

use crate::{
    error::{BridgeError, BridgeResult},
    manager::BridgeManager,
    state::SharedBridgeState,
    types::*,
    AppConfig,
};
use async_trait::async_trait;
use uuid::Uuid;

/// Implements `BridgeManager` with direct in-process calls (desktop mode).
pub struct InProcessManager {
    state: SharedBridgeState,
}

impl InProcessManager {
    pub fn new(state: SharedBridgeState) -> Self {
        Self { state }
    }
}

#[async_trait]
impl BridgeManager for InProcessManager {
    async fn list_connectors(&self) -> BridgeResult<Vec<Connector>> {
        let state = self.state.read().await;
        // Database access will be wired here once the database crate is integrated.
        // For now returns empty — concrete impl added when src-tauri wires everything.
        let _ = &state.config;
        Ok(vec![])
    }

    async fn get_connector(&self, id: &ConnectorId) -> BridgeResult<Connector> {
        Err(BridgeError::NotFound(format!("Connector {id}")))
    }

    async fn create_connector(&self, req: CreateConnectorRequest) -> BridgeResult<Connector> {
        let now = chrono::Utc::now();
        // Placeholder connector — real impl encrypts creds and inserts into DB.
        Ok(Connector {
            id: Uuid::new_v4(),
            name: req.name,
            description: req.description,
            discord_config: req.discord_config,
            gr_config: req.gr_config,
            enabled: false,
            health_status: HealthStatus::Offline,
            last_error: None,
            total_archived: 0,
            failed_count: 0,
            success_rate: 0.0,
            last_archived_at: None,
            created_at: now,
            updated_at: now,
        })
    }

    async fn update_connector(
        &self,
        id: &ConnectorId,
        _req: UpdateConnectorRequest,
    ) -> BridgeResult<Connector> {
        Err(BridgeError::NotFound(format!("Connector {id}")))
    }

    async fn delete_connector(&self, id: &ConnectorId) -> BridgeResult<()> {
        let mut state = self.state.write().await;
        // Stop the bridge if running.
        state.running_bridges.remove(&id.to_string());
        Ok(())
    }

    async fn toggle_connector(&self, id: &ConnectorId, enabled: bool) -> BridgeResult<()> {
        let state = self.state.read().await;
        let id_str = id.to_string();
        if enabled {
            if state.running_bridges.contains_key(&id_str) {
                return Ok(()); // Already running.
            }
            tracing::info!(connector_id = %id_str, "Starting connector (toggle)");
            // Full implementation: look up connector in DB, decrypt creds,
            // create BridgeInstance::start(). Done in src-tauri integration.
        } else {
            tracing::info!(connector_id = %id_str, "Stopping connector (toggle)");
            // Full implementation: look up running bridge, call stop().
        }
        Ok(())
    }

    async fn get_discord_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
        // Real impl uses a temp DiscordBot::get_guilds() with the connector's token.
        Ok(vec![])
    }

    async fn get_discord_channels(&self, _guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
        Ok(vec![])
    }

    async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary> {
        Ok(AnalyticsSummary {
            total_archived: 0,
            active_connections: 0,
            overall_success_rate: 0.0,
            archived_today: 0,
        })
    }

    async fn get_connector_analytics(&self, id: &ConnectorId) -> BridgeResult<ConnectorAnalytics> {
        Ok(ConnectorAnalytics {
            connector_id: *id,
            total_archived: 0,
            failed_count: 0,
            success_rate: 0.0,
            daily_volume: vec![],
        })
    }

    async fn get_health(&self) -> BridgeResult<HealthStatus> {
        let state = self.state.read().await;
        if state.running_bridges.is_empty() {
            Ok(HealthStatus::Offline)
        } else {
            Ok(HealthStatus::Online)
        }
    }

    async fn get_config(&self) -> BridgeResult<AppConfig> {
        let state = self.state.read().await;
        Ok(state.config.clone())
    }

    async fn update_config(&self, config: AppConfig) -> BridgeResult<()> {
        let mut state = self.state.write().await;
        state.config = config;
        Ok(())
    }
}
