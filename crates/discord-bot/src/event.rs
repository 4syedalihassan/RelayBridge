//! Typed events emitted by the Discord gateway handler.

/// A Discord message event forwarded to the bridge.
#[derive(Debug, Clone)]
pub struct BridgeEvent {
    /// The Discord snowflake ID of the channel where the message was posted.
    pub channel_id: String,
    /// The Discord snowflake ID of the guild (server).
    pub guild_id: String,
    /// The Discord snowflake ID of the message.
    pub message_id: String,
    /// The display name (username) of the message author.
    pub author_name: String,
    /// Optional email for the author (not usually available from Discord).
    pub author_email: Option<String>,
    /// Plain-text message content.
    pub content: String,
    /// Message creation timestamp in milliseconds since Unix epoch.
    pub timestamp_ms: i64,
}
