//! Database abstraction trait for the bridge to keep layers decoupled.

use crate::error::BridgeResult;
use crate::types::*;
use async_trait::async_trait;

#[async_trait]
pub trait BridgeDb: Send + Sync {
    /// List all connectors in database as encrypted structs.
    async fn list_connectors(&self) -> BridgeResult<Vec<EncryptedConnector>>;

    /// Get a single connector by UUID from database.
    async fn get_connector(&self, id: &ConnectorId) -> BridgeResult<Option<EncryptedConnector>>;

    /// Save a new encrypted connector into database.
    async fn create_connector(&self, conn: &EncryptedConnector) -> BridgeResult<()>;

    /// Update an existing encrypted connector in database.
    async fn update_connector(&self, conn: &EncryptedConnector) -> BridgeResult<()>;

    /// Delete a connector by UUID from database.
    async fn delete_connector(&self, id: &ConnectorId) -> BridgeResult<()>;

    /// Get cumulative analytics summary from database.
    async fn get_analytics_summary(&self) -> BridgeResult<AnalyticsSummary>;

    /// Get per-connector analytics breakdown from database.
    async fn get_connector_analytics(&self, id: &ConnectorId) -> BridgeResult<ConnectorAnalytics>;
}
