//! Core domain types shared across all crates.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Unique connector identifier.
pub type ConnectorId = Uuid;

/// Health status of a connector's bridge.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HealthStatus {
    #[serde(rename = "online")]
    Online,
    #[serde(rename = "offline")]
    Offline,
    #[serde(rename = "error")]
    Error,
}

/// A managed Discord → GR bridge connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connector {
    pub id: ConnectorId,
    pub name: String,
    pub description: Option<String>,
    pub discord_config: DiscordConfig,
    pub gr_config: GrConfig,
    pub enabled: bool,
    pub health_status: HealthStatus,
    pub last_error: Option<String>,
    pub total_archived: u64,
    pub failed_count: u64,
    pub success_rate: f64,
    pub last_archived_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Discord bot credentials (plaintext in memory, encrypted at rest).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordConfig {
    pub bot_token: String,
    pub client_id: String,
    pub client_secret: String,
    pub guild_id: Option<String>,
    pub guild_name: Option<String>,
    pub selected_channel_ids: Vec<String>,
}

/// Global Relay API credentials (plaintext in memory, encrypted at rest).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrConfig {
    pub client_id: String,
    pub client_secret: String,
    pub oauth_url: String,
    pub api_base_url: String,
}

/// Request payload to create a new connector (plaintext credentials).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateConnectorRequest {
    pub name: String,
    pub description: Option<String>,
    pub discord_config: DiscordConfig,
    pub gr_config: GrConfig,
}

/// Request payload to update an existing connector.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateConnectorRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub discord_config: Option<DiscordConfig>,
    pub gr_config: Option<GrConfig>,
    pub enabled: Option<bool>,
}

/// A single archive log entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveLog {
    pub id: i64,
    pub connector_id: ConnectorId,
    pub discord_message_id: Option<String>,
    pub discord_channel_id: Option<String>,
    pub gr_archive_id: Option<String>,
    pub status: ArchiveStatus,
    pub error_message: Option<String>,
    pub archived_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ArchiveStatus {
    #[serde(rename = "success")]
    Success,
    #[serde(rename = "failed")]
    Failed,
}

/// Cumulative analytics summary.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalyticsSummary {
    pub total_archived: u64,
    pub active_connections: u64,
    pub overall_success_rate: f64,
    pub archived_today: u64,
}

/// Per-connector analytics breakdown.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorAnalytics {
    pub connector_id: ConnectorId,
    pub total_archived: u64,
    pub failed_count: u64,
    pub success_rate: f64,
    pub daily_volume: Vec<DailyVolume>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyVolume {
    pub date: chrono::NaiveDate,
    pub count: u64,
}

/// Discord guild info (for connector setup wizard).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuildInfo {
    pub id: String,
    pub name: String,
}

/// Discord channel info (for connector setup wizard).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelInfo {
    pub id: String,
    pub name: String,
    pub kind: ChannelKind,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ChannelKind {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "voice")]
    Voice,
    #[serde(rename = "announcement")]
    Announcement,
    #[serde(rename = "other")]
    Other,
}
