//! InProcessManager — implements BridgeManager via direct function calls.
//!
//! Used in desktop (Tauri) mode where the bridge runs in the same process.
//! No serialization overhead — all operations are direct Rust method calls.

use crate::{
    encryption::EncryptionService,
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

fn encrypt_connector(
    conn: &Connector,
    encryption: &EncryptionService,
) -> BridgeResult<EncryptedConnector> {
    Ok(EncryptedConnector {
        id: conn.id,
        name: conn.name.clone(),
        description: conn.description.clone(),
        discord_bot_token: encryption.encrypt(conn.discord_config.bot_token.as_bytes())?,
        discord_client_id: conn.discord_config.client_id.clone(),
        discord_client_secret: encryption.encrypt(conn.discord_config.client_secret.as_bytes())?,
        discord_guild_id: conn.discord_config.guild_id.clone(),
        discord_guild_name: conn.discord_config.guild_name.clone(),
        selected_channel_ids: conn.discord_config.selected_channel_ids.clone(),
        gr_client_id: encryption.encrypt(conn.gr_config.client_id.as_bytes())?,
        gr_client_secret: encryption.encrypt(conn.gr_config.client_secret.as_bytes())?,
        gr_oauth_url: conn.gr_config.oauth_url.clone(),
        gr_api_base_url: conn.gr_config.api_base_url.clone(),
        enabled: conn.enabled,
        health_status: conn.health_status.clone(),
        last_error: conn.last_error.clone(),
        total_archived: conn.total_archived,
        failed_count: conn.failed_count,
        success_rate: conn.success_rate,
        last_archived_at: conn.last_archived_at,
        created_at: conn.created_at,
        updated_at: conn.updated_at,
    })
}

fn decrypt_connector(
    enc: &EncryptedConnector,
    encryption: &EncryptionService,
) -> BridgeResult<Connector> {
    let discord_bot_token = String::from_utf8(encryption.decrypt(&enc.discord_bot_token)?)
        .map_err(|e| BridgeError::Encryption(e.to_string()))?;
    let discord_client_secret = String::from_utf8(encryption.decrypt(&enc.discord_client_secret)?)
        .map_err(|e| BridgeError::Encryption(e.to_string()))?;
    let gr_client_id = String::from_utf8(encryption.decrypt(&enc.gr_client_id)?)
        .map_err(|e| BridgeError::Encryption(e.to_string()))?;
    let gr_client_secret = String::from_utf8(encryption.decrypt(&enc.gr_client_secret)?)
        .map_err(|e| BridgeError::Encryption(e.to_string()))?;

    Ok(Connector {
        id: enc.id,
        name: enc.name.clone(),
        description: enc.description.clone(),
        discord_config: DiscordConfig {
            bot_token: discord_bot_token,
            client_id: enc.discord_client_id.clone(),
            client_secret: discord_client_secret,
            guild_id: enc.discord_guild_id.clone(),
            guild_name: enc.discord_guild_name.clone(),
            selected_channel_ids: enc.selected_channel_ids.clone(),
        },
        gr_config: GrConfig {
            client_id: gr_client_id,
            client_secret: gr_client_secret,
            oauth_url: enc.gr_oauth_url.clone(),
            api_base_url: enc.gr_api_base_url.clone(),
        },
        enabled: enc.enabled,
        health_status: enc.health_status.clone(),
        last_error: enc.last_error.clone(),
        total_archived: enc.total_archived,
        failed_count: enc.failed_count,
        success_rate: enc.success_rate,
        last_archived_at: enc.last_archived_at,
        created_at: enc.created_at,
        updated_at: enc.updated_at,
    })
}

#[async_trait]
impl BridgeManager for InProcessManager {
    async fn list_connectors(&self) -> BridgeResult<Vec<Connector>> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        let encs = db.list_connectors().await?;
        let mut conns = Vec::new();
        for enc in encs {
            conns.push(decrypt_connector(&enc, &state.encryption)?);
        }
        Ok(conns)
    }

    async fn get_connector(&self, id: &ConnectorId) -> BridgeResult<Connector> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        let enc_opt = db.get_connector(id).await?;
        match enc_opt {
            Some(enc) => decrypt_connector(&enc, &state.encryption),
            None => Err(BridgeError::NotFound(format!("Connector {id}"))),
        }
    }

    async fn create_connector(&self, req: CreateConnectorRequest) -> BridgeResult<Connector> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        let now = chrono::Utc::now();
        let conn = Connector {
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
        };
        let enc = encrypt_connector(&conn, &state.encryption)?;
        db.create_connector(&enc).await?;
        Ok(conn)
    }

    async fn update_connector(
        &self,
        id: &ConnectorId,
        req: UpdateConnectorRequest,
    ) -> BridgeResult<Connector> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        let enc_opt = db.get_connector(id).await?;
        let enc = enc_opt.ok_or_else(|| BridgeError::NotFound(format!("Connector {id}")))?;
        let mut conn = decrypt_connector(&enc, &state.encryption)?;

        if let Some(name) = req.name {
            conn.name = name;
        }
        if let Some(desc) = req.description {
            conn.description = Some(desc);
        }
        if let Some(discord) = req.discord_config {
            conn.discord_config = discord;
        }
        if let Some(gr) = req.gr_config {
            conn.gr_config = gr;
        }
        if let Some(enabled) = req.enabled {
            conn.enabled = enabled;
        }
        conn.updated_at = chrono::Utc::now();

        let updated_enc = encrypt_connector(&conn, &state.encryption)?;
        db.update_connector(&updated_enc).await?;
        Ok(conn)
    }

    async fn delete_connector(&self, id: &ConnectorId) -> BridgeResult<()> {
        let db = {
            let state = self.state.read().await;
            state.db.clone().ok_or_else(|| {
                BridgeError::Internal("Database not initialized".to_string())
            })?
        };

        {
            let mut state = self.state.write().await;
            if let Some(handle) = state.running_bridges.remove(&id.to_string()) {
                let _ = handle.stop_tx.send(());
            }
        }

        db.delete_connector(id).await?;
        Ok(())
    }

    async fn toggle_connector(&self, id: &ConnectorId, enabled: bool) -> BridgeResult<()> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;

        let enc_opt = db.get_connector(id).await?;
        let mut enc = enc_opt.ok_or_else(|| BridgeError::NotFound(format!("Connector {id}")))?;

        enc.enabled = enabled;
        db.update_connector(&enc).await?;

        if let Some(tx) = &state.bridge_toggle_tx {
            let _ = tx.send((*id, enabled));
        }

        Ok(())
    }

    async fn get_discord_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
        let conns = self.list_connectors().await?;
        if let Some(conn) = conns.first() {
            let state = self.state.read().await;
            let svc = state.discord.as_ref().ok_or_else(|| {
                BridgeError::Internal("Discord service not initialized".to_string())
            })?;
            svc.get_guilds(&conn.discord_config.bot_token).await
        } else {
            Ok(vec![])
        }
    }

    async fn get_discord_channels(&self, guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
        let conns = self.list_connectors().await?;
        if let Some(conn) = conns.first() {
            let state = self.state.read().await;
            let svc = state.discord.as_ref().ok_or_else(|| {
                BridgeError::Internal("Discord service not initialized".to_string())
            })?;
            svc.get_channels(&conn.discord_config.bot_token, guild_id).await
        } else {
            Ok(vec![])
        }
    }

    async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        db.get_analytics_summary().await
    }

    async fn get_connector_analytics(&self, id: &ConnectorId) -> BridgeResult<ConnectorAnalytics> {
        let state = self.state.read().await;
        let db = state.db.as_ref().ok_or_else(|| {
            BridgeError::Internal("Database not initialized".to_string())
        })?;
        db.get_connector_analytics(id).await
    }

    async fn get_health(&self) -> BridgeResult<HealthStatus> {
        let state = self.state.read().await;
        if state.running_bridges.is_empty() {
            Ok(HealthStatus::Offline)
        } else {
            // If any running bridge is online, we are online.
            // If all are error, we are error.
            let mut any_online = false;
            for handle in state.running_bridges.values() {
                let status = handle.health_rx.borrow().clone();
                if status == HealthStatus::Online {
                    any_online = true;
                }
            }
            if any_online {
                Ok(HealthStatus::Online)
            } else {
                Ok(HealthStatus::Offline)
            }
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
