//! discord-gr Tauri application library.
//!
//! Wires together:
//! - Tauri window + system tray
//! - InProcessManager (BridgeManager implementation for desktop mode)
//! - Tauri IPC commands (frontend ↔ Rust)

pub mod commands;
pub mod tray;
pub mod service;

use bridge_core::{
    AppConfig, BridgeState, EncryptionService, InProcessManager, SharedBridgeState,
    BridgeManager,
};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::RwLock;
use tracing_subscriber::EnvFilter;
use async_trait::async_trait;

#[derive(Clone)]
struct DualWriter {
    file: Arc<std::fs::File>,
}

impl std::io::Write for DualWriter {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        let _ = std::io::Write::write(&mut std::io::stdout(), buf);
        std::io::Write::write(&mut &*self.file, buf)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        let _ = std::io::Write::flush(&mut std::io::stdout());
        std::io::Write::flush(&mut &*self.file)
    }
}

/// Application state accessible from all Tauri commands.
pub struct AppState {
    /// The bridge manager (InProcess for desktop mode).
    pub manager: Arc<InProcessManager>,
    /// Raw shared bridge state (for direct DB/running-bridge access).
    pub bridge_state: SharedBridgeState,
}

pub struct TauriDiscordService;

#[async_trait]
impl bridge_core::discord::DiscordService for TauriDiscordService {
    async fn get_guilds(&self, token: &str) -> bridge_core::error::BridgeResult<Vec<bridge_core::types::GuildInfo>> {
        let bot = discord_bot::DiscordBot::new(token.to_string(), vec![]);
        bot.get_guilds().await
    }

    async fn get_channels(&self, token: &str, guild_id: &str) -> bridge_core::error::BridgeResult<Vec<bridge_core::types::ChannelInfo>> {
        let bot = discord_bot::DiscordBot::new(token.to_string(), vec![]);
        bot.get_channels(guild_id).await
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Logging (Dual Writer: stdout + file) ─────────────────────────────────
    let mut log_dir_opt = None;
    #[cfg(target_os = "windows")]
    {
        if let Some(programdata) = std::env::var_os("ProgramData") {
            log_dir_opt = Some(format!("{}\\DiscordGR\\logs", programdata.to_string_lossy()));
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            log_dir_opt = Some(format!("{}/.config/discord-gr/logs", home));
        }
    }

    let mut file_opt = None;
    if let Some(log_dir) = log_dir_opt {
        let _ = std::fs::create_dir_all(&log_dir);
        let log_file_path = format!("{}/app.log", log_dir);
        if let Ok(file) = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(true)
            .open(&log_file_path)
        {
            file_opt = Some(Arc::new(file));
        }
    }

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    if let Some(file) = file_opt {
        let writer = DualWriter { file };
        tracing_subscriber::fmt()
            .with_env_filter(filter)
            .with_writer(move || writer.clone())
            .with_target(false)
            .compact()
            .init();
    } else {
        tracing_subscriber::fmt()
            .with_env_filter(filter)
            .with_target(false)
            .compact()
            .init();
    }

    tracing::info!("discord-gr starting up");

    // ── Build AppConfig and encryption ───────────────────────────────────────
    let config = AppConfig::default();
    let encryption = EncryptionService::new()
        .expect("Failed to initialise encryption service — check OS keychain access");

    // ── Initialize Database ──────────────────────────────────────────────────
    let (db, bridge_toggle_tx) = tauri::async_runtime::block_on(async {
        // Ensure parent directory of database exists
        if let Some(parent) = std::path::Path::new(&config.db_path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let db_conn_str = format!("sqlite://{}", config.db_path);
        tracing::info!(db_path = %config.db_path, "Connecting to SQLite database");
        let db = database::Database::connect(&db_conn_str)
            .await
            .expect("Failed to connect to database");
        
        db.run_migrations().await.expect("Failed to run migrations");
        tracing::info!("Database migrations executed successfully");

        let (tx, rx) = tokio::sync::mpsc::unbounded_channel::<(uuid::Uuid, bool)>();
        (Arc::new(db), (tx, rx))
    });

    let (toggle_tx, mut toggle_rx) = bridge_toggle_tx;

    // ── Build shared bridge state ────────────────────────────────────────────
    let bridge_state: SharedBridgeState = Arc::new(RwLock::new(BridgeState::new(
        config,
        Arc::new(encryption),
        Some(Arc::clone(&db) as Arc<dyn bridge_core::db::BridgeDb>),
        Some(Arc::new(TauriDiscordService) as Arc<dyn bridge_core::DiscordService>),
    )));

    // Assign bridge_toggle_tx channel
    tauri::async_runtime::block_on(async {
        let mut state = bridge_state.write().await;
        state.bridge_toggle_tx = Some(toggle_tx);
    });

    let manager = Arc::new(InProcessManager::new(Arc::clone(&bridge_state)));

    let app_state = AppState {
        manager: Arc::clone(&manager),
        bridge_state: Arc::clone(&bridge_state),
    };

    // ── Spawn background task to process bridge toggles ──────────────────────
    let bridge_state_clone = Arc::clone(&bridge_state);
    let db_clone = Arc::clone(&db);
    tauri::async_runtime::spawn(async move {
        while let Some((id, enabled)) = toggle_rx.recv().await {
            let state_read = bridge_state_clone.read().await;
            let db_ref = match &state_read.db {
                Some(db) => db,
                None => continue,
            };

            if enabled {
                if state_read.running_bridges.contains_key(&id.to_string()) {
                    continue; // Already running
                }

                tracing::info!(connector_id = %id, "Background task starting bridge instance");

                // Get connector credentials
                let enc_opt = match db_ref.get_connector(&id).await {
                    Ok(opt) => opt,
                    Err(e) => {
                        tracing::error!(error = %e, "Failed to load connector from database");
                        continue;
                    }
                };
                let enc = match enc_opt {
                    Some(enc) => enc,
                    None => continue,
                };

                // Decrypt credentials
                let discord_bot_token = match state_read.encryption.decrypt(&enc.discord_bot_token) {
                    Ok(bytes) => match String::from_utf8(bytes) {
                        Ok(s) => s,
                        Err(_) => continue,
                    },
                    Err(_) => continue,
                };

                let gr_client_id = match state_read.encryption.decrypt(&enc.gr_client_id) {
                    Ok(bytes) => match String::from_utf8(bytes) {
                        Ok(s) => s,
                        Err(_) => continue,
                    },
                    Err(_) => continue,
                };

                let gr_client_secret = match state_read.encryption.decrypt(&enc.gr_client_secret) {
                    Ok(bytes) => match String::from_utf8(bytes) {
                        Ok(s) => s,
                        Err(_) => continue,
                    },
                    Err(_) => continue,
                };

                let gr_client = Arc::new(gr_client::GrClient::new(
                    gr_client_id,
                    gr_client_secret,
                    enc.gr_oauth_url.clone(),
                    enc.gr_api_base_url.clone(),
                ));

                // Parse selected channels
                let channel_ids = enc.selected_channel_ids.clone();

                let bridge_inst = bridge::BridgeInstance::start(
                    id.to_string(),
                    discord_bot_token,
                    channel_ids,
                    gr_client,
                    enc.discord_guild_name.clone().unwrap_or_default(),
                    Arc::clone(&db_clone),
                )
                .await;

                drop(state_read); // Drop read lock before acquiring write lock

                match bridge_inst {
                    Ok(mut inst) => {
                        let mut state_write = bridge_state_clone.write().await;
                        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
                        let health_rx = inst.health_status.clone();
                        let id_str = id.to_string();

                        // Spawn individual monitor task to stop this bridge instance gracefully
                        let bridge_state_task = Arc::clone(&bridge_state_clone);
                        tauri::async_runtime::spawn(async move {
                            let _ = stop_rx.await;
                            tracing::info!(connector_id = %id_str, "Stopping bridge instance background task");
                            let _ = inst.stop().await;

                            // Reset health status in DB
                            let db_opt = {
                                let state = bridge_state_task.read().await;
                                state.db.clone()
                            };
                            if let Some(db) = db_opt {
                                if let Some(mut enc_connector) = db.get_connector(&id).await.ok().flatten() {
                                    enc_connector.health_status = bridge_core::types::HealthStatus::Offline;
                                    let _ = db.update_connector(&enc_connector).await;
                                }
                            }
                        });

                        state_write.running_bridges.insert(
                            id.to_string(),
                            bridge_core::state::RunningBridgeHandle {
                                connector_id: id.to_string(),
                                health_rx,
                                stop_tx,
                            },
                        );
                        tracing::info!(connector_id = %id, "Bridge instance registered successfully");
                    }
                    Err(e) => {
                        tracing::error!(connector_id = %id, error = %e, "Failed to start bridge instance");
                        let db_opt = {
                            let state = bridge_state_clone.read().await;
                            state.db.clone()
                        };
                        if let Some(db) = db_opt {
                            if let Some(mut enc_connector) = db.get_connector(&id).await.ok().flatten() {
                                enc_connector.health_status = bridge_core::types::HealthStatus::Error;
                                enc_connector.last_error = Some(e.to_string());
                                let _ = db.update_connector(&enc_connector).await;
                            }
                        }
                    }
                }
            } else {
                drop(state_read);
                let mut state_write = bridge_state_clone.write().await;
                if let Some(handle) = state_write.running_bridges.remove(&id.to_string()) {
                    let _ = handle.stop_tx.send(());
                }
            }
        }
    });

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
            commands::close_splashscreen,
        ])
        .setup(|app| {
            // Build system tray
            tray::setup_tray(app)?;

            // On startup, restore any connectors that were enabled before shutdown.
            let state = app.state::<AppState>();
            let manager = Arc::clone(&state.manager);

            tauri::async_runtime::spawn(async move {
                if let Ok(conns) = manager.list_connectors().await {
                    for conn in conns {
                        if conn.enabled {
                            tracing::info!(connector_id = %conn.id, "Restoring active connector on startup");
                            let _ = manager.toggle_connector(&conn.id, true).await;
                        }
                    }
                }
            });

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
