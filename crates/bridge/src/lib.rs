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
        db: Arc<database::Database>,
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
        let db_clone = Arc::clone(&db);
        let queue_handle = tokio::spawn(async move {
            loop {
                if let Some(item) = queue_clone.dequeue_ready().await {
                    let message_id = item.archive_req.message_id.clone();
                    let channel_id = item.archive_req.channel_id.clone();
                    let result = gr_clone.archive(item.archive_req).await;

                    // Fetch current connector stats from DB to increment correctly
                    let mut total_archived = 0;
                    let mut failed_count = 0;
                    if let Ok(Some(conn)) = db_clone.get_connector(&cid).await {
                        total_archived = conn.total_archived;
                        failed_count = conn.failed_count;
                    }

                    match result {
                        Ok(resp) => {
                            tracing::info!(
                                connector_id = %cid,
                                reconciliation_id = ?resp.reconciliation_id,
                                "Message archived successfully"
                            );

                            total_archived += 1;
                            let success_rate = if total_archived + failed_count > 0 {
                                total_archived as f64 / (total_archived + failed_count) as f64
                            } else {
                                1.0
                            };
                            let now_str = chrono::Utc::now().to_rfc3339();

                            // 1. Update stats in database
                            let _ = db_clone.update_connector_stats(
                                &cid,
                                total_archived,
                                failed_count,
                                success_rate,
                                Some(&now_str),
                            ).await;

                            // 2. Create successful archive log in database
                            let _ = db_clone.create_archive_log(
                                &cid,
                                Some(&message_id),
                                Some(&channel_id),
                                resp.reconciliation_id.as_deref(),
                                "success",
                                None,
                            ).await;
                        }
                        Err(e) => {
                            tracing::error!(connector_id = %cid, error = %e, "Archive failed");

                            failed_count += 1;
                            let success_rate = if total_archived + failed_count > 0 {
                                total_archived as f64 / (total_archived + failed_count) as f64
                            } else {
                                1.0
                            };

                            // 1. Update stats in database
                            let _ = db_clone.update_connector_stats(
                                &cid,
                                total_archived,
                                failed_count,
                                success_rate,
                                None,
                            ).await;

                            // 2. Create failed archive log in database
                            let _ = db_clone.create_archive_log(
                                &cid,
                                Some(&message_id),
                                Some(&channel_id),
                                None,
                                "failed",
                                Some(&e.to_string()),
                            ).await;
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

        // ── Health database synchronizer task ────────────────────────────────
        let db_health_clone = Arc::clone(&db);
        let cid_health = connector_id.clone();
        let mut health_rx_clone = health_status.clone();
        tokio::spawn(async move {
            loop {
                let status = health_rx_clone.borrow().clone();
                let status_str = match status {
                    HealthStatus::Online => "online",
                    HealthStatus::Offline => "offline",
                    HealthStatus::Error => "error",
                };
                let _ = db_health_clone.update_connector_health(&cid_health, status_str, None).await;

                if health_rx_clone.changed().await.is_err() {
                    // Transmitter dropped — stop.
                    break;
                }
            }
        });

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
