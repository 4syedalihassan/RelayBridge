//! OAuth2 token management for the Global Relay API.

use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;
use serde::Deserialize;
use bridge_core::error::{BridgeError, BridgeResult};

/// Cached OAuth2 access token with expiry.
pub struct TokenCache {
    pub access_token: String,
    pub expires_at: chrono::DateTime<Utc>,
}

/// Raw OAuth2 token response from the server.
#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: i64,
}

/// Manages OAuth2 client-credentials token acquisition and caching.
pub struct AuthClient {
    client_id: String,
    client_secret: String,
    oauth_url: String,
    http: reqwest::Client,
    cache: Arc<RwLock<Option<TokenCache>>>,
}

impl AuthClient {
    /// Create a new `AuthClient`.
    pub fn new(client_id: String, client_secret: String, oauth_url: String) -> Self {
        Self {
            client_id,
            client_secret,
            oauth_url,
            http: reqwest::Client::new(),
            cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Return a valid access token, refreshing from the server when expired or absent.
    pub async fn get_token(&self) -> BridgeResult<String> {
        // Fast path: check if cached token is still valid (with 30s margin).
        {
            let read = self.cache.read().await;
            if let Some(ref cached) = *read {
                if cached.expires_at > Utc::now() + chrono::Duration::seconds(30) {
                    tracing::debug!("Using cached GR access token");
                    return Ok(cached.access_token.clone());
                }
            }
        }

        // Slow path: fetch a new token and cache it.
        tracing::info!("Fetching new GR access token from {}", self.oauth_url);
        let token_cache = self.fetch_token().await?;
        let token = token_cache.access_token.clone();
        let mut write = self.cache.write().await;
        *write = Some(token_cache);
        Ok(token)
    }

    /// POST to the OAuth2 endpoint with `client_credentials` grant type.
    async fn fetch_token(&self) -> BridgeResult<TokenCache> {
        let params = [
            ("grant_type", "client_credentials"),
            ("client_id", self.client_id.as_str()),
            ("client_secret", self.client_secret.as_str()),
        ];

        let response = self
            .http
            .post(&self.oauth_url)
            .form(&params)
            .send()
            .await
            .map_err(|e| BridgeError::Transport(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(BridgeError::GlobalRelay(format!(
                "OAuth2 token request failed (HTTP {}): {}",
                status, body
            )));
        }

        let token_resp: TokenResponse = response
            .json()
            .await
            .map_err(|e| BridgeError::Transport(e.to_string()))?;

        let expires_at = Utc::now() + chrono::Duration::seconds(token_resp.expires_in);

        Ok(TokenCache {
            access_token: token_resp.access_token,
            expires_at,
        })
    }
}
