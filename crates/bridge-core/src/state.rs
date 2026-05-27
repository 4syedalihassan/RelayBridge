//! Shared bridge state — holds active bridge instances, database, and encryption.
//!
//! `BridgeState` is wrapped in `Arc<RwLock<...>>` so it can be accessed
//! from multiple tokio tasks simultaneously (Tauri commands, health checks, etc.)

use crate::{AppConfig, EncryptionService, ConnectorId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Identifier for a running bridge instance.
pub type BridgeInstanceId = Uuid;

/// Shared application state managed by the bridge.
///
/// In desktop mode, this lives inside an `Arc<RwLock<BridgeState>>` held by Tauri's app state.
/// In service mode, the same struct is used but accessed via the local socket server.
pub struct BridgeState {
    /// App configuration (DB path, log level, etc.)
    pub config: AppConfig,

    /// Encryption service for credentials.
    pub encryption: Arc<EncryptionService>,

    /// The active SQLite database.
    pub db: Option<Arc<dyn crate::db::BridgeDb>>,

    /// Discord API service for wizard.
    pub discord: Option<Arc<dyn crate::DiscordService>>,

    /// Channel to signal starting/stopping bridge instances to the main process loop.
    pub bridge_toggle_tx: Option<tokio::sync::mpsc::UnboundedSender<(ConnectorId, bool)>>,

    /// Map of connector_id → running bridge handle.
    /// An entry only exists when the bridge is actively running.
    pub running_bridges: HashMap<String, RunningBridgeHandle>,
}

/// Handle to a running bridge instance.
pub struct RunningBridgeHandle {
    pub connector_id: String,
    /// Watch channel receiver for the current health status.
    pub health_rx: tokio::sync::watch::Receiver<crate::types::HealthStatus>,
    /// Signal sender to stop the bridge gracefully.
    pub stop_tx: tokio::sync::oneshot::Sender<()>,
}

impl BridgeState {
    pub fn new(
        config: AppConfig,
        encryption: Arc<EncryptionService>,
        db: Option<Arc<dyn crate::db::BridgeDb>>,
        discord: Option<Arc<dyn crate::DiscordService>>,
    ) -> Self {
        Self {
            config,
            encryption,
            db,
            discord,
            bridge_toggle_tx: None,
            running_bridges: HashMap::new(),
        }
    }

    /// Check if a connector's bridge is currently running.
    pub fn is_running(&self, connector_id: &str) -> bool {
        self.running_bridges.contains_key(connector_id)
    }

    /// Get the current health status for a connector.
    pub fn get_health(&self, connector_id: &str) -> crate::types::HealthStatus {
        self.running_bridges
            .get(connector_id)
            .map(|h| h.health_rx.borrow().clone())
            .unwrap_or(crate::types::HealthStatus::Offline)
    }
}

/// Thread-safe shared bridge state.
pub type SharedBridgeState = Arc<RwLock<BridgeState>>;
