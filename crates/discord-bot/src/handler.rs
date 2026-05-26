//! Event handler for Discord gateway events.
//!
//! `BridgeHandler` listens to serenity events and forwards them as
//! [`BridgeEvent`]s to the bridge orchestrator via a tokio MPSC channel.

use async_trait::async_trait;
use serenity::all::{
    ChannelId, Context, EventHandler as SerenityEventHandler, GuildId, Message, MessageId,
    MessageUpdateEvent, Reaction,
};
use tokio::sync::mpsc;
use tracing::{debug, warn};

/// Events emitted by the Discord gateway to the bridge orchestrator.
#[derive(Debug, Clone)]
pub enum BridgeEvent {
    MessageCreated {
        message_id: String,
        channel_id: String,
        guild_id: String,
        author_id: String,
        author_name: String,
        content: String,
    },
    MessageUpdated {
        message_id: String,
        channel_id: String,
        guild_id: String,
        new_content: String,
    },
    MessageDeleted {
        message_id: String,
        channel_id: String,
        guild_id: String,
    },
    ReactionAdded {
        message_id: String,
        channel_id: String,
        guild_id: String,
        user_id: String,
        emoji: String,
    },
}

/// Serenity event handler that converts gateway events into [`BridgeEvent`]s.
pub struct BridgeHandler {
    /// Channel used to forward events to the orchestrator.
    pub sender: mpsc::Sender<BridgeEvent>,
    /// Whitelist of Discord channel IDs to monitor.
    pub channel_ids: Vec<String>,
}

impl BridgeHandler {
    pub fn new(sender: mpsc::Sender<BridgeEvent>, channel_ids: Vec<String>) -> Self {
        Self { sender, channel_ids }
    }

    fn is_monitored(&self, channel_id: &str) -> bool {
        self.channel_ids.is_empty() || self.channel_ids.iter().any(|id| id == channel_id)
    }

    async fn emit(&self, event: BridgeEvent) {
        if let Err(e) = self.sender.send(event).await {
            warn!("Failed to send bridge event: {}", e);
        }
    }
}

#[async_trait]
impl SerenityEventHandler for BridgeHandler {
    async fn message(&self, _ctx: Context, msg: Message) {
        let channel_id = msg.channel_id.to_string();
        if !self.is_monitored(&channel_id) {
            return;
        }

        // Ignore bot messages to prevent loops
        if msg.author.bot {
            return;
        }

        let guild_id = msg
            .guild_id
            .map(|g| g.to_string())
            .unwrap_or_default();

        debug!(
            message_id = %msg.id,
            channel_id = %channel_id,
            author = %msg.author.name,
            "Discord message received"
        );

        self.emit(BridgeEvent::MessageCreated {
            message_id: msg.id.to_string(),
            channel_id,
            guild_id,
            author_id: msg.author.id.to_string(),
            author_name: msg.author.name.clone(),
            content: msg.content.clone(),
        })
        .await;
    }

    async fn message_update(
        &self,
        _ctx: Context,
        _old: Option<Message>,
        new: Option<Message>,
        event: MessageUpdateEvent,
    ) {
        let channel_id = event.channel_id.to_string();
        if !self.is_monitored(&channel_id) {
            return;
        }

        let guild_id = event
            .guild_id
            .map(|g| g.to_string())
            .unwrap_or_default();

        let new_content = new
            .as_ref()
            .map(|m| m.content.clone())
            .or_else(|| event.content.clone())
            .unwrap_or_default();

        debug!(
            message_id = %event.id,
            channel_id = %channel_id,
            "Discord message updated"
        );

        self.emit(BridgeEvent::MessageUpdated {
            message_id: event.id.to_string(),
            channel_id,
            guild_id,
            new_content,
        })
        .await;
    }

    async fn message_delete(
        &self,
        _ctx: Context,
        channel_id: ChannelId,
        message_id: MessageId,
        guild_id: Option<GuildId>,
    ) {
        let channel_id_str = channel_id.to_string();
        if !self.is_monitored(&channel_id_str) {
            return;
        }

        let guild_id_str = guild_id.map(|g| g.to_string()).unwrap_or_default();

        debug!(
            message_id = %message_id,
            channel_id = %channel_id_str,
            "Discord message deleted"
        );

        self.emit(BridgeEvent::MessageDeleted {
            message_id: message_id.to_string(),
            channel_id: channel_id_str,
            guild_id: guild_id_str,
        })
        .await;
    }

    async fn reaction_add(&self, _ctx: Context, reaction: Reaction) {
        let channel_id = reaction.channel_id.to_string();
        if !self.is_monitored(&channel_id) {
            return;
        }

        let guild_id = reaction
            .guild_id
            .map(|g| g.to_string())
            .unwrap_or_default();

        let user_id = reaction
            .user_id
            .map(|u| u.to_string())
            .unwrap_or_default();

        let emoji = reaction.emoji.to_string();

        debug!(
            message_id = %reaction.message_id,
            channel_id = %channel_id,
            emoji = %emoji,
            "Discord reaction added"
        );

        self.emit(BridgeEvent::ReactionAdded {
            message_id: reaction.message_id.to_string(),
            channel_id,
            guild_id,
            user_id,
            emoji,
        })
        .await;
    }
}
