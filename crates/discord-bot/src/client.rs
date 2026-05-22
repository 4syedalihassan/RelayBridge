//! DiscordBot struct — wraps a serenity client for a single connector.

use bridge_core::types::{ChannelInfo, GuildInfo};
use bridge_core::BridgeResult;

/// A managed Discord bot instance for one connector.
pub struct DiscordBot {
    token: String,
    channel_ids: Vec<String>,
}

impl DiscordBot {
    pub fn new(token: String, channel_ids: Vec<String>) -> Self {
        Self { token, channel_ids }
    }

    /// Start the gateway connection. Returns a JoinHandle for the bot task.
    pub async fn start(&self) -> BridgeResult<tokio::task::JoinHandle<()>> {
        // TODO: Implement serenity client connection
        let token = self.token.clone();
        let handle = tokio::spawn(async move {
            // Placeholder: serenity client setup will go here
            tracing::info!("Discord bot started (placeholder)");
        });
        Ok(handle)
    }

    /// Gracefully disconnect.
    pub async fn shutdown(&self) -> BridgeResult<()> {
        // TODO: Implement graceful shutdown
        tracing::info!("Discord bot shutdown (placeholder)");
        Ok(())
    }

    /// List accessible guilds for token verification.
    pub async fn get_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
        // TODO: implement via serenity HTTP
        Ok(vec![])
    }

    /// List text channels in a guild.
    pub async fn get_channels(&self, _guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
        // TODO: implement via serenity HTTP
        Ok(vec![])
    }

    /// Returns whether the bot is connected to the gateway.
    pub fn is_connected(&self) -> bool {
        false
    }
}
