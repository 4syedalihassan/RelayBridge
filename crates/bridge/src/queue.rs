//! In-memory retry queue for GR archive requests.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use gr_client::ArchiveRequest;

/// One item waiting to be (re-)sent to the GR API.
pub struct QueueItem {
    /// The connector that owns this item.
    pub connector_id: String,
    /// The archive payload.
    pub archive_req: ArchiveRequest,
    /// How many times this item has been attempted.
    pub attempts: u32,
    /// Maximum number of attempts before the item is dropped.
    pub max_retries: u32,
    /// Earliest time this item should next be attempted.
    pub next_attempt_at: Instant,
}

/// Thread-safe, in-memory queue with retry / back-off support.
pub struct ArchiveQueue {
    items: Arc<Mutex<VecDeque<QueueItem>>>,
}

impl Default for ArchiveQueue {
    fn default() -> Self {
        Self::new()
    }
}

impl ArchiveQueue {
    /// Create an empty `ArchiveQueue`.
    pub fn new() -> Self {
        Self {
            items: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    /// Push an item to the back of the queue.
    pub async fn enqueue(&self, item: QueueItem) {
        self.items.lock().await.push_back(item);
    }

    /// Remove and return the first item whose `next_attempt_at` is in the past.
    /// Returns `None` if no item is ready yet.
    pub async fn dequeue_ready(&self) -> Option<QueueItem> {
        let mut guard = self.items.lock().await;
        let now = Instant::now();
        if let Some(front) = guard.front() {
            if front.next_attempt_at <= now {
                return guard.pop_front();
            }
        }
        None
    }

    /// Put a failed item back in the queue with exponential back-off.
    ///
    /// Items that have exhausted `max_retries` are silently dropped.
    pub async fn requeue_with_backoff(&self, mut item: QueueItem) {
        item.attempts += 1;
        if item.attempts > item.max_retries {
            tracing::warn!(
                connector_id = %item.connector_id,
                message_id = %item.archive_req.message_id,
                "Dropping message after {} failed attempts",
                item.attempts
            );
            return;
        }
        // Exponential back-off: 2^attempts seconds (capped at 5 minutes).
        let delay_secs = (1u64 << item.attempts).min(300);
        item.next_attempt_at = Instant::now() + Duration::from_secs(delay_secs);
        tracing::debug!(
            connector_id = %item.connector_id,
            attempts = item.attempts,
            delay_secs,
            "Requeueing message with back-off"
        );
        self.items.lock().await.push_back(item);
    }

    /// Current number of items in the queue.
    pub async fn len(&self) -> usize {
        self.items.lock().await.len()
    }

    /// Returns `true` if the queue is empty.
    pub async fn is_empty(&self) -> bool {
        self.items.lock().await.is_empty()
    }
}
