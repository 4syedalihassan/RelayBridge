//! Discord service abstraction trait for setup wizard.

use crate::error::BridgeResult;
use crate::types::*;
use async_trait::async_trait;

#[async_trait]
pub trait DiscordService: Send + Sync {
    /// Get accessible guilds using the provided bot token.
    async fn get_guilds(&self, token: &str) -> BridgeResult<Vec<GuildInfo>>;

    /// Get text channels in a guild using the provided bot token.
    async fn get_channels(&self, token: &str, guild_id: &str) -> BridgeResult<Vec<ChannelInfo>>;
}
