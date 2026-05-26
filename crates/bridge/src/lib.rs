//! Bridge orchestrator — wires Discord bot, archive queue, and health checker together.

pub mod health;
pub mod queue;
pub mod router;

pub use health::HealthChecker;
pub use queue::ArchiveQueue;
pub use router::EventRouter;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use bridge_core::error::{BridgeError, BridgeResult};
use bridge_core::types::HealthStatus;
use discord_bot::{BridgeEvent, DiscordBot};
use gr_client::GrClient;
use tokio::sync::{mpsc, watch};

/// A fully running bridge for a single connector.
pub struct BridgeInstance {
    /// Connector identifier.
    pub connector_id: String,
    /// The shared archive queue.
    pub queue: Arc<ArchiveQueue>,
    /// The health checker.
    pub health: Arc<HealthChecker>,
    /// Whether the Discord bot gateway is connected.
    is_discord_connected: Arc<AtomicBool>,
    discord_handle: Option<tokio::task::JoinHandle<()>>,
    queue_handle: Option<tokio::task::JoinHandle<()>>,
    event_handle: Option<tokio::task::JoinHandle<()>>,
    health_handle: Option<tokio::task::JoinHandle<()>>,
    /// Watch receiver — always contains the latest `HealthStatus`.
    pub health_status: watch::Receiver<HealthStatus>,
}

impl BridgeInstance {
    /// Start a bridge for `connector_id`.
    ///
    /// Spawns four background tasks:
    /// 1. Discord bot gateway connection.
    /// 2. Discord event consumer → EventRouter → ArchiveQueue.
    /// 3. Queue processor — dequeues items and sends them to GR.
    /// 4. Health checker — polls every 30 s.
    pub async fn start(
        connector_id: String,
        discord_bot_token: String,
        channel_ids: Vec<String>,
        gr_client: Arc<GrClient>,
        guild_name: String,
    ) -> BridgeResult<Self> {
        tracing::info!(connector_id = %connector_id, "Starting bridge instance");

        let queue = Arc::new(ArchiveQueue::new());
        let is_discord_connected = Arc::new(AtomicBool::new(false));

        // ── MPSC channel: Discord events → EventRouter ───────────────────────
        let (event_tx, mut event_rx) = mpsc::channel::<BridgeEvent>(256);

        // ── Discord bot task ─────────────────────────────────────────────────
        let mut bot = DiscordBot::new(discord_bot_token, channel_ids);
        let connected_flag = Arc::clone(&is_discord_connected);
        let discord_handle = bot.start(event_tx).await.map_err(|e| {
            BridgeError::Discord(format!("Failed to start Discord bot: {e}"))
        })?;
        connected_flag.store(true, Ordering::Relaxed);

        // ── Event consumer task ──────────────────────────────────────────────
        let queue_for_events = Arc::clone(&queue);
        let cid_for_events = connector_id.clone();
        let guild_name_clone = guild_name.clone();
        let event_handle = tokio::spawn(async move {
            let router = EventRouter::new(
                queue_for_events,
                cid_for_events,
                guild_name_clone,
            );
            while let Some(event) = event_rx.recv().await {
                router.route(event, "unknown-channel").await;
            }
        });

        // ── Queue processor task ─────────────────────────────────────────────
        let queue_clone = Arc::clone(&queue);
        let gr_clone = Arc::clone(&gr_client);
        let cid = connector_id.clone();
        let queue_handle = tokio::spawn(async move {
            loop {
                if let Some(item) = queue_clone.dequeue_ready().await {
                    let result = gr_clone.archive(item.archive_req).await;
                    match result {
                        Ok(resp) => {
                            tracing::info!(
                                connector_id = %cid,
                                reconciliation_id = ?resp.reconciliation_id,
                                "Message archived successfully"
                            );
                        }
                        Err(e) => {
                            tracing::error!(connector_id = %cid, error = %e, "Archive failed");
                            // GrClient::archive already retries 3× internally.
                        }
                    }
                } else {
                    // Nothing ready — sleep briefly before next poll.
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            }
        });

        // ── Health checker ───────────────────────────────────────────────────
        let health = Arc::new(HealthChecker::new(
            connector_id.clone(),
            Arc::clone(&gr_client),
            Arc::clone(&is_discord_connected),
        ));
        let (status_tx, health_status) = watch::channel(HealthStatus::Offline);
        let health_handle = Arc::clone(&health).start_background_check(status_tx);

        Ok(Self {
            connector_id,
            queue,
            health,
            is_discord_connected,
            discord_handle: Some(discord_handle),
            queue_handle: Some(queue_handle),
            event_handle: Some(event_handle),
            health_handle: Some(health_handle),
            health_status,
        })
    }

    /// Gracefully stop all background tasks.
    pub async fn stop(&mut self) -> BridgeResult<()> {
        tracing::info!(connector_id = %self.connector_id, "Stopping bridge instance");
        self.is_discord_connected.store(false, Ordering::Relaxed);

        let handles: Vec<_> = [
            self.discord_handle.take(),
            self.queue_handle.take(),
            self.event_handle.take(),
            self.health_handle.take(),
        ]
        .into_iter()
        .flatten()
        .collect();

        for handle in handles {
            handle.abort();
            // JoinError is expected after abort — ignore it.
            let _ = handle.await;
        }

        Ok(())
    }

    /// Snapshot the latest `HealthStatus` from the watch channel.
    pub fn health_status(&self) -> HealthStatus {
        self.health_status.borrow().clone()
    }
}
