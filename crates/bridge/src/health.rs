//! Health checker — monitors Discord + GR connectivity and broadcasts `HealthStatus`.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use bridge_core::types::HealthStatus;
use gr_client::GrClient;
use tokio::sync::watch;

/// Checks and broadcasts the health of a single connector.
pub struct HealthChecker {
    connector_id: String,
    gr_client: Arc<GrClient>,
    is_discord_connected: Arc<AtomicBool>,
}

impl HealthChecker {
    /// Create a new `HealthChecker`.
    pub fn new(
        connector_id: String,
        gr_client: Arc<GrClient>,
        is_discord_connected: Arc<AtomicBool>,
    ) -> Self {
        Self {
            connector_id,
            gr_client,
            is_discord_connected,
        }
    }

    /// Perform a single health check and return the current `HealthStatus`.
    ///
    /// The connector is `Online` only when both Discord gateway is connected
    /// **and** the GR API token can be obtained successfully.
    pub async fn check(&self) -> HealthStatus {
        let discord_ok = self.is_discord_connected.load(Ordering::Relaxed);
        let gr_ok = self.gr_client.health_check().await.is_ok();

        match (discord_ok, gr_ok) {
            (true, true) => {
                tracing::debug!(connector_id = %self.connector_id, "Health check: Online");
                HealthStatus::Online
            }
            (false, _) => {
                tracing::warn!(connector_id = %self.connector_id, "Health check: Discord offline");
                HealthStatus::Offline
            }
            (_, false) => {
                tracing::warn!(connector_id = %self.connector_id, "Health check: GR API error");
                HealthStatus::Error
            }
        }
    }

    /// Spawn a background task that checks health every 30 seconds and sends
    /// the result over `status_tx`.
    pub fn start_background_check(
        self: Arc<Self>,
        status_tx: watch::Sender<HealthStatus>,
    ) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                let status = self.check().await;
                if status_tx.send(status).is_err() {
                    // All receivers dropped — time to stop.
                    tracing::debug!(
                        connector_id = %self.connector_id,
                        "Health check receiver dropped; stopping background task"
                    );
                    break;
                }
            }
        })
    }
}
