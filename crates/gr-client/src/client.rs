//! GrClient — sends Discord messages to the Global Relay archival API.

use std::time::Duration;
use serde::{Deserialize, Serialize};
use bridge_core::error::{BridgeError, BridgeResult};
use crate::auth::AuthClient;

/// All information needed to archive a single Discord message.
pub struct ArchiveRequest {
    pub channel_id: String,
    pub guild_id: String,
    pub channel_name: String,
    pub guild_name: String,
    pub message_id: String,
    pub author_name: String,
    pub author_email: Option<String>,
    pub content: String,
    pub timestamp_ms: i64,
}

/// Successful response from the GR archive endpoint.
pub struct ArchiveResponse {
    pub reconciliation_id: Option<String>,
    pub status: String,
}

/// Raw GR API response envelope.
#[derive(Debug, Deserialize)]
struct GrArchiveApiResponse {
    #[serde(rename = "reconciliationId")]
    reconciliation_id: Option<String>,
    status: Option<String>,
}

/// GR conversation overview payload.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationOverview {
    conversation_id: String,
    conversation_type: String,
    channel_name: String,
    guild_name: String,
}

/// A single event within a GR conversation.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConversationEvent {
    message_id: String,
    sender_name: String,
    sender_email: Option<String>,
    content: String,
    timestamp_ms: i64,
}

/// Full GR archive request body.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GrArchivePayload {
    conversation_overview: ConversationOverview,
    conversation_events: Vec<ConversationEvent>,
}

/// HTTP client for the Global Relay archival API.
pub struct GrClient {
    auth: AuthClient,
    api_base_url: String,
    http: reqwest::Client,
}

impl GrClient {
    /// Create a new `GrClient`.
    pub fn new(
        client_id: String,
        client_secret: String,
        oauth_url: String,
        api_base_url: String,
    ) -> Self {
        Self {
            auth: AuthClient::new(client_id, client_secret, oauth_url),
            api_base_url,
            http: reqwest::Client::new(),
        }
    }

    /// Archive a Discord message to Global Relay.
    ///
    /// Retries up to 3 times:
    /// - On HTTP 429: waits for the `Retry-After` header value (seconds).
    /// - On HTTP 5xx: exponential back-off (1 s, 2 s, 4 s).
    pub async fn archive(&self, req: ArchiveRequest) -> BridgeResult<ArchiveResponse> {
        let payload = GrArchivePayload {
            conversation_overview: ConversationOverview {
                conversation_id: format!("{}-{}", req.guild_id, req.channel_id),
                conversation_type: "discord".to_string(),
                channel_name: req.channel_name.clone(),
                guild_name: req.guild_name.clone(),
            },
            conversation_events: vec![ConversationEvent {
                message_id: req.message_id.clone(),
                sender_name: req.author_name.clone(),
                sender_email: req.author_email.clone(),
                content: req.content.clone(),
                timestamp_ms: req.timestamp_ms,
            }],
        };

        let url = format!("{}/conversations", self.api_base_url.trim_end_matches('/'));
        let mut backoff_secs: u64 = 1;

        for attempt in 1..=3u32 {
            let token = self.auth.get_token().await?;
            let body = serde_json::to_string(&payload)?;

            let response = self
                .http
                .post(&url)
                .bearer_auth(&token)
                .header("Content-Type", "application/json")
                .body(body)
                .send()
                .await
                .map_err(|e| BridgeError::Transport(e.to_string()))?;

            let status = response.status();

            if status.is_success() {
                let api_resp: GrArchiveApiResponse = response
                    .json()
                    .await
                    .unwrap_or(GrArchiveApiResponse {
                        reconciliation_id: None,
                        status: None,
                    });
                tracing::info!(
                    message_id = %req.message_id,
                    reconciliation_id = ?api_resp.reconciliation_id,
                    "Message archived to GR"
                );
                return Ok(ArchiveResponse {
                    reconciliation_id: api_resp.reconciliation_id,
                    status: api_resp.status.unwrap_or_else(|| "ok".to_string()),
                });
            }

            if status.as_u16() == 429 {
                // Honour Retry-After if present, otherwise default to 1s.
                let retry_after = response
                    .headers()
                    .get("retry-after")
                    .and_then(|v| v.to_str().ok())
                    .and_then(|s| s.parse::<u64>().ok())
                    .unwrap_or(1);
                tracing::warn!(attempt, retry_after, "GR rate-limited; waiting before retry");
                tokio::time::sleep(Duration::from_secs(retry_after)).await;
                continue;
            }

            if status.is_server_error() {
                let body = response.text().await.unwrap_or_default();
                tracing::warn!(attempt, %status, %body, "GR server error; retrying with back-off");
                if attempt < 3 {
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                    backoff_secs *= 2;
                }
                continue;
            }

            // Non-retryable client error.
            let body = response.text().await.unwrap_or_default();
            return Err(BridgeError::GlobalRelay(format!(
                "GR archive failed (HTTP {}): {}",
                status, body
            )));
        }

        Err(BridgeError::GlobalRelay(format!(
            "GR archive failed after 3 attempts for message {}",
            req.message_id
        )))
    }

    /// Verify connectivity to the GR API by obtaining a token.
    pub async fn health_check(&self) -> BridgeResult<()> {
        self.auth.get_token().await?;
        Ok(())
    }
}
