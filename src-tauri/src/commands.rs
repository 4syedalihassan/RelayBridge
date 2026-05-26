//! Tauri IPC commands — all frontend ↔ Rust communication goes through here.
//!
//! Each command mirrors a `BridgeManager` method.  The state parameter gives
//! access to the `InProcessManager`.

use crate::AppState;
use bridge_core::{
    manager::BridgeManager,
    types::*,
    AppConfig,
};
use tauri::State;
use uuid::Uuid;

// ── Type aliases for serializable error responses ────────────────────────────

pub type CmdResult<T> = Result<T, String>;

fn map_err(e: bridge_core::BridgeError) -> String {
    e.to_string()
}

// ── Connector commands ───────────────────────────────────────────────────────

/// List all connectors.
#[tauri::command]
pub async fn list_connectors(state: State<'_, AppState>) -> CmdResult<Vec<Connector>> {
    state.manager.list_connectors().await.map_err(map_err)
}

/// Get a single connector by its UUID.
#[tauri::command]
pub async fn get_connector(state: State<'_, AppState>, id: String) -> CmdResult<Connector> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.manager.get_connector(&uuid).await.map_err(map_err)
}

/// Create a new connector (credentials are plain-text from the frontend; encrypted internally).
#[tauri::command]
pub async fn create_connector(
    state: State<'_, AppState>,
    req: CreateConnectorRequest,
) -> CmdResult<Connector> {
    state.manager.create_connector(req).await.map_err(map_err)
}

/// Partially update a connector.
#[tauri::command]
pub async fn update_connector(
    state: State<'_, AppState>,
    id: String,
    req: UpdateConnectorRequest,
) -> CmdResult<Connector> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.manager.update_connector(&uuid, req).await.map_err(map_err)
}

/// Delete a connector (stops its bridge if running).
#[tauri::command]
pub async fn delete_connector(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.manager.delete_connector(&uuid).await.map_err(map_err)
}

/// Enable or disable a connector (starts or stops the Discord bot).
#[tauri::command]
pub async fn toggle_connector(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> CmdResult<()> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.manager.toggle_connector(&uuid, enabled).await.map_err(map_err)
}

// ── Discord helpers ──────────────────────────────────────────────────────────

/// List Discord guilds accessible by the bot token in the current wizard session.
#[tauri::command]
pub async fn get_discord_guilds(state: State<'_, AppState>) -> CmdResult<Vec<GuildInfo>> {
    state.manager.get_discord_guilds().await.map_err(map_err)
}

/// List text channels in a Discord guild.
#[tauri::command]
pub async fn get_discord_channels(
    state: State<'_, AppState>,
    guild_id: String,
) -> CmdResult<Vec<ChannelInfo>> {
    state.manager.get_discord_channels(&guild_id).await.map_err(map_err)
}

// ── Analytics ────────────────────────────────────────────────────────────────

/// Cumulative analytics summary for the dashboard overview.
#[tauri::command]
pub async fn get_analytics_summary(state: State<'_, AppState>) -> CmdResult<AnalyticsSummary> {
    state.manager.get_analytics_summary().await.map_err(map_err)
}

/// Per-connector analytics (daily message volume, success rate, etc.).
#[tauri::command]
pub async fn get_connector_analytics(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<ConnectorAnalytics> {
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    state.manager.get_connector_analytics(&uuid).await.map_err(map_err)
}

// ── Health + Config ──────────────────────────────────────────────────────────

/// Overall bridge health status.
#[tauri::command]
pub async fn get_health(state: State<'_, AppState>) -> CmdResult<HealthStatus> {
    state.manager.get_health().await.map_err(map_err)
}

/// Get app configuration.
#[tauri::command]
pub async fn get_config(state: State<'_, AppState>) -> CmdResult<AppConfig> {
    state.manager.get_config().await.map_err(map_err)
}

/// Update app configuration.
#[tauri::command]
pub async fn update_config(state: State<'_, AppState>, config: AppConfig) -> CmdResult<()> {
    state.manager.update_config(config).await.map_err(map_err)
}
