//! discord-gr Tauri application library.
//!
//! Wires together:
//! - Tauri window + system tray
//! - InProcessManager (BridgeManager implementation for desktop mode)
//! - Tauri IPC commands (frontend ↔ Rust)

pub mod commands;
pub mod tray;

use bridge_core::{
    AppConfig, BridgeState, EncryptionService, InProcessManager, SharedBridgeState,
};
use std::sync::Arc;
use tauri::{Manager, Runtime};
use tokio::sync::RwLock;
use tracing_subscriber::{fmt, EnvFilter};

/// Application state accessible from all Tauri commands.
pub struct AppState {
    /// The bridge manager (InProcess for desktop mode).
    pub manager: Arc<InProcessManager>,
    /// Raw shared bridge state (for direct DB/running-bridge access).
    pub bridge_state: SharedBridgeState,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Logging ──────────────────────────────────────────────────────────────
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .with_target(false)
        .compact()
        .init();

    tracing::info!("discord-gr starting up");

    // ── Build shared bridge state ────────────────────────────────────────────
    let config = AppConfig::default();
    let encryption = EncryptionService::new()
        .expect("Failed to initialise encryption service — check OS keychain access");
    let bridge_state: SharedBridgeState = Arc::new(RwLock::new(BridgeState::new(
        config,
        Arc::new(encryption),
    )));
    let manager = Arc::new(InProcessManager::new(Arc::clone(&bridge_state)));

    let app_state = AppState {
        manager: Arc::clone(&manager),
        bridge_state: Arc::clone(&bridge_state),
    };

    // ── Tauri application ────────────────────────────────────────────────────
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::list_connectors,
            commands::get_connector,
            commands::create_connector,
            commands::update_connector,
            commands::delete_connector,
            commands::toggle_connector,
            commands::get_discord_guilds,
            commands::get_discord_channels,
            commands::get_analytics_summary,
            commands::get_connector_analytics,
            commands::get_health,
            commands::get_config,
            commands::update_config,
        ])
        .setup(|app| {
            // Build system tray
            tray::setup_tray(app)?;

            // On startup, restore any connectors that were enabled before shutdown.
            let state = app.state::<AppState>();
            let _manager = Arc::clone(&state.manager);
            // TODO: iterate DB, start enabled connectors via manager.toggle_connector()
            // (done in Wave 5 integration)

            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimise to tray instead of closing.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap_or_default();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("Error while running Tauri application");
}
