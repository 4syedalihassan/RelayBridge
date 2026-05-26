//! DiscordBot — a managed serenity gateway client for one connector.

use std::sync::Arc;

use bridge_core::{
    types::{ChannelInfo, ChannelKind, GuildInfo},
    BridgeError, BridgeResult,
};
use serenity::{
    all::{GatewayIntents, Http},
    Client,
};
use tokio::{sync::mpsc, task::JoinHandle};
use tracing::{error, info};

use crate::handler::{BridgeEvent, BridgeHandler};

/// A managed Discord bot instance for one connector.
pub struct DiscordBot {
    token: String,
    channel_ids: Vec<String>,
    /// Held so we can call `shutdown_all()` later.
    shard_manager: Option<Arc<serenity::gateway::ShardManager>>,
}

impl DiscordBot {
    /// Create a new bot instance. Does **not** connect yet — call [`start`].
    pub fn new(token: String, channel_ids: Vec<String>) -> Self {
        Self {
            token,
            channel_ids,
            shard_manager: None,
        }
    }

    /// Start the gateway connection.
    ///
    /// Spawns the serenity client on a background task and returns its
    /// [`JoinHandle`].  The caller owns the handle; dropping it does **not**
    /// cancel the task.
    pub async fn start(
        &mut self,
        event_sender: mpsc::Sender<BridgeEvent>,
    ) -> BridgeResult<JoinHandle<()>> {
        let handler = BridgeHandler::new(event_sender, self.channel_ids.clone());

        let intents = GatewayIntents::GUILD_MESSAGES
            | GatewayIntents::MESSAGE_CONTENT
            | GatewayIntents::GUILDS
            | GatewayIntents::GUILD_MESSAGE_REACTIONS;

        let mut client = Client::builder(&self.token, intents)
            .event_handler(handler)
            .await
            .map_err(|e| BridgeError::Discord(format!("Failed to build serenity client: {e}")))?;

        // Keep the shard manager so we can shut down later.
        self.shard_manager = Some(Arc::clone(&client.shard_manager));

        let handle = tokio::spawn(async move {
            if let Err(e) = client.start().await {
                error!("Serenity client error: {}", e);
            }
            info!("Discord bot task finished");
        });

        info!("Discord bot started");
        Ok(handle)
    }

    /// Gracefully disconnect all shards.
    pub async fn shutdown(&self) -> BridgeResult<()> {
        if let Some(sm) = &self.shard_manager {
            sm.shutdown_all().await;
            info!("Discord bot shutdown complete");
        } else {
            info!("Discord bot was not running — nothing to shut down");
        }
        Ok(())
    }

    /// Returns `true` when the bot has an active shard manager (i.e. `start`
    /// was called and the task has not exited yet).
    pub fn is_connected(&self) -> bool {
        self.shard_manager.is_some()
    }

    // ── REST helpers (no gateway required) ─────────────────────────────────

    /// List all guilds the bot token can access.
    pub async fn get_guilds(&self) -> BridgeResult<Vec<GuildInfo>> {
        let http = Http::new(&self.token);
        let guilds = http
            .get_guilds(None, None)
            .await
            .map_err(|e| BridgeError::Discord(format!("get_guilds failed: {e}")))?;

        Ok(guilds
            .into_iter()
            .map(|g| GuildInfo {
                id: g.id.to_string(),
                name: g.name,
            })
            .collect())
    }

    /// List text channels in a guild.
    pub async fn get_channels(&self, guild_id: &str) -> BridgeResult<Vec<ChannelInfo>> {
        let http = Http::new(&self.token);
        let guild_id_u64: u64 = guild_id
            .parse()
            .map_err(|_| BridgeError::Validation(format!("Invalid guild_id: {guild_id}")))?;

        let channels = http
            .get_channels(guild_id_u64.into())
            .await
            .map_err(|e| BridgeError::Discord(format!("get_channels failed: {e}")))?;

        let result = channels
            .into_iter()
            .filter_map(|ch| {
                use serenity::all::ChannelType;
                let kind = match ch.kind {
                    ChannelType::Text | ChannelType::Forum => ChannelKind::Text,
                    ChannelType::Voice | ChannelType::Stage => ChannelKind::Voice,
                    ChannelType::News | ChannelType::NewsThread => ChannelKind::Announcement,
                    _ => ChannelKind::Other,
                };
                // Only expose text-like channels
                if kind == ChannelKind::Text || kind == ChannelKind::Announcement {
                    Some(ChannelInfo {
                        id: ch.id.to_string(),
                        name: ch.name,
                        kind,
                    })
                } else {
                    None
                }
            })
            .collect();

        Ok(result)
    }
}
