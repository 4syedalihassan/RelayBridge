//! BridgeManager trait — the single interface for all bridge management operations.
//!
//! Each transport mode implements this trait:
//! - `InProcessManager` (desktop mode, direct function calls)
//! - `LocalSocketManager` (service mode, UDS/Named Pipe)
//! - `RemoteManager` (future, TLS + HTTP)

use crate::error::BridgeResult;
use crate::types::*;
use crate::AppConfig;
use async_trait::async_trait;

/// Single interface for all bridge management operations.
/// The frontend never knows which transport implementation it's using.
#[async_trait]
pub trait BridgeManager: Send + Sync {
    /// List all connectors.
    async fn list_connectors(&self) -> BridgeResult<Vec<Connector>>;

    /// Get a single connector by ID.
    async fn get_connector(&self, id: &ConnectorId) -> BridgeResult<Connector>;

    /// Create a new connector with plaintext credentials (encrypted internally).
    async fn create_connector(&self, req: CreateConnectorRequest) -> BridgeResult<Connector>;

    /// Update an existing connector.
    async fn update_connector(
        &self,
        id: &ConnectorId,
        req: UpdateConnectorRequest,
    ) -> BridgeResult<Connector>;

    /// Delete a connector and disconnect its Discord bot.
    async fn delete_connector(&self, id: &ConnectorId) -> BridgeResult<()>;

    /// Enable or disable a connector (starts/stops the Discord bot).
    async fn toggle_connector(&self, id: &ConnectorId, enabled: bool) -> BridgeResult<()>;

    /// Get accessible Discord guilds for a connector.
    async fn get_discord_guilds(&self) -> BridgeResult<Vec<GuildInfo>>;

    /// Get text channels for a Discord guild.
    async fn get_discord_channels(&self, guild_id: &str) -> BridgeResult<Vec<ChannelInfo>>;

    /// Get cumulative analytics summary.
    async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary>;

    /// Get per-connector analytics.
    async fn get_connector_analytics(&self, id: &ConnectorId) -> BridgeResult<ConnectorAnalytics>;

    /// Get overall bridge health status.
    async fn get_health(&self) -> BridgeResult<HealthStatus>;

    /// Get app configuration.
    async fn get_config(&self) -> BridgeResult<AppConfig>;

    /// Update app configuration.
    async fn update_config(&self, config: AppConfig) -> BridgeResult<()>;
}
