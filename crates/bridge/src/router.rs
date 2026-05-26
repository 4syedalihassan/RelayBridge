//! Routes Discord `BridgeEvent`s to GR `ArchiveRequest`s and enqueues them.

use std::sync::Arc;
use std::time::Instant;
use discord_bot::BridgeEvent;
use gr_client::ArchiveRequest;
use crate::queue::{ArchiveQueue, QueueItem};

/// Transforms incoming Discord events into GR archive requests and queues them.
pub struct EventRouter {
    queue: Arc<ArchiveQueue>,
    connector_id: String,
    guild_name: String,
}

impl EventRouter {
    /// Create a new `EventRouter`.
    pub fn new(queue: Arc<ArchiveQueue>, connector_id: String, guild_name: String) -> Self {
        Self {
            queue,
            connector_id,
            guild_name,
        }
    }

    /// Transform a `BridgeEvent` into an `ArchiveRequest` and push it onto the queue.
    pub async fn route(&self, event: BridgeEvent, channel_name: &str) {
        tracing::debug!(
            connector_id = %self.connector_id,
            message_id = %event.message_id,
            channel_name,
            "Routing Discord message to archive queue"
        );

        let archive_req = ArchiveRequest {
            channel_id: event.channel_id,
            guild_id: event.guild_id,
            channel_name: channel_name.to_string(),
            guild_name: self.guild_name.clone(),
            message_id: event.message_id,
            author_name: event.author_name,
            author_email: event.author_email,
            content: event.content,
            timestamp_ms: event.timestamp_ms,
        };

        let item = QueueItem {
            connector_id: self.connector_id.clone(),
            archive_req,
            attempts: 0,
            max_retries: 5,
            next_attempt_at: Instant::now(),
        };

        self.queue.enqueue(item).await;
    }
}
