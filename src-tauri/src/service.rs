//! Service mode implementation — runs headlessly in the background.
//!
//! On Linux/macOS: runs as a standard daemon responding to SIGTERM.
//! On Windows: integrates with the Service Control Manager (SCM).

use bridge_core::{AppConfig, BridgeState, EncryptionService, InProcessManager, SharedBridgeState, BridgeManager};
use std::sync::Arc;
use tracing::{info, error};

// ── Headless Service Loop ────────────────────────────────────────────────────

async fn run_headless_service_loop<F>(shutdown_fut: F) -> Result<(), Box<dyn std::error::Error>>
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    // ── Build AppConfig and encryption ───────────────────────────────────────
    let config = AppConfig::default();
    let encryption = EncryptionService::new()?;

    // ── Initialize Database ──────────────────────────────────────────────────
    if let Some(parent) = std::path::Path::new(&config.db_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let db_conn_str = format!("sqlite://{}", config.db_path);
    let db = database::Database::connect(&db_conn_str).await?;
    db.run_migrations().await?;

    let (toggle_tx, mut toggle_rx) = tokio::sync::mpsc::unbounded_channel::<(uuid::Uuid, bool)>();
    let db = Arc::new(db);

    // ── Build shared bridge state ────────────────────────────────────────────
    let bridge_state: SharedBridgeState = Arc::new(tokio::sync::RwLock::new(BridgeState::new(
        config.clone(),
        Arc::new(encryption),
        Some(Arc::clone(&db) as Arc<dyn bridge_core::db::BridgeDb>),
        Some(Arc::new(crate::TauriDiscordService) as Arc<dyn bridge_core::DiscordService>),
    )));

    {
        let mut state = bridge_state.write().await;
        state.bridge_toggle_tx = Some(toggle_tx);
    }

    let manager = Arc::new(InProcessManager::new(Arc::clone(&bridge_state)));

    // ── Spawn background task to process bridge toggles ──────────────────────
    let bridge_state_clone = Arc::clone(&bridge_state);
    let db_clone = Arc::clone(&db);
    let toggle_task = tokio::spawn(async move {
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

                info!(connector_id = %id, "Service starting bridge instance");

                let enc_opt = match db_ref.get_connector(&id).await {
                    Ok(opt) => opt,
                    Err(e) => {
                        error!(error = %e, "Failed to load connector from database");
                        continue;
                    }
                };
                let enc = match enc_opt {
                    Some(enc) => enc,
                    None => continue,
                };

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

                drop(state_read);

                match bridge_inst {
                    Ok(mut inst) => {
                        let mut state_write = bridge_state_clone.write().await;
                        let (stop_tx, stop_rx) = tokio::sync::oneshot::channel::<()>();
                        let health_rx = inst.health_status.clone();
                        let id_str = id.to_string();

                        let bridge_state_task = Arc::clone(&bridge_state_clone);
                        tokio::spawn(async move {
                            let _ = stop_rx.await;
                            info!(connector_id = %id_str, "Stopping bridge instance background task");
                            let _ = inst.stop().await;

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
                        info!(connector_id = %id, "Bridge instance registered successfully");
                    }
                    Err(e) => {
                        error!(connector_id = %id, error = %e, "Failed to start bridge instance");
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

    // ── Restore active connectors on startup ──────────────────────────────────
    if let Ok(conns) = manager.list_connectors().await {
        for conn in conns {
            if conn.enabled {
                info!(connector_id = %conn.id, "Restoring active connector on startup");
                let _ = manager.toggle_connector(&conn.id, true).await;
            }
        }
    }

    // ── Start LocalSocketServer ───────────────────────────────────────────────
    let server = bridge_core::transport::LocalSocketServer::new(
        Arc::clone(&manager) as Arc<dyn BridgeManager>,
        config.socket_path.clone(),
    );

    let server_task = tokio::spawn(async move {
        if let Err(e) = server.start().await {
            error!("LocalSocketServer error: {:?}", e);
        }
    });

    // ── Wait for shutdown signal ──────────────────────────────────────────────
    shutdown_fut.await;

    info!("Service shutting down gracefully...");

    // ── Graceful Shutdown ─────────────────────────────────────────────────────
    let running_ids: Vec<String> = {
        let state = bridge_state.read().await;
        state.running_bridges.keys().cloned().collect()
    };

    for id_str in running_ids {
        if let Ok(uuid) = uuid::Uuid::parse_str(&id_str) {
            let _ = manager.toggle_connector(&uuid, false).await;
        }
    }

    // Abort active tasks
    server_task.abort();
    toggle_task.abort();

    // Clean up local socket (on Unix)
    #[cfg(unix)]
    {
        let _ = std::fs::remove_file(&config.socket_path);
    }

    info!("Service stopped successfully.");
    Ok(())
}

// ── Foreground Console Service Mode ─────────────────────────────────────────

fn run_foreground_service() {
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");

    rt.block_on(async {
        let shutdown_fut = async {
            #[cfg(unix)]
            {
                let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("Failed to register SIGTERM handler");
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {}
                    _ = sigterm.recv() => {}
                }
            }
            #[cfg(windows)]
            {
                let _ = tokio::signal::ctrl_c().await;
            }
        };

        info!("Starting service in console foreground...");
        if let Err(e) = run_headless_service_loop(shutdown_fut).await {
            error!("Headless service error: {:?}", e);
        }
    });
}

// ── Windows Service Controller Integration ──────────────────────────────────

#[cfg(windows)]
windows_service::define_windows_service!(ffi_service_main, my_service_main);

#[cfg(windows)]
fn my_service_main(_arguments: Vec<std::ffi::OsString>) {
    use std::time::Duration;
    use windows_service::{
        service::{
            ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
            ServiceType,
        },
        service_control_handler::{self, ServiceControlHandlerResult},
    };

    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
    let shutdown_tx = std::sync::Mutex::new(Some(shutdown_tx));

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                if let Ok(mut guard) = shutdown_tx.lock() {
                    if let Some(tx) = guard.take() {
                        let _ = tx.send(());
                    }
                }
                ServiceControlHandlerResult::NoError
            }
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    // Register service control handler
    let status_handle = match service_control_handler::register("discord-gr", event_handler) {
        Ok(h) => h,
        Err(e) => {
            error!("Failed to register control handler: {:?}", e);
            return;
        }
    };

    // Set service as running
    if let Err(e) = status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::from_secs(0),
        process_id: None,
    }) {
        error!("Failed to set service status: {:?}", e);
        return;
    }

    // Run the main service async block
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");

    rt.block_on(async {
        let shutdown_fut = async {
            let _ = shutdown_rx.await;
        };
        if let Err(e) = run_headless_service_loop(shutdown_fut).await {
            error!("Headless service loop error: {:?}", e);
        }
    });

    // Set service as stopped
    let _ = status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::from_secs(0),
        process_id: None,
    });
}

#[cfg(windows)]
fn run_as_windows_service() -> Result<(), windows_service::Error> {
    use windows_service::service_dispatcher;
    service_dispatcher::start("discord-gr", ffi_service_main)
}

// ── Service CLI Entrypoint ───────────────────────────────────────────────────

pub fn run_service() {
    #[cfg(windows)]
    {
        if let Err(e) = run_as_windows_service() {
            // SCM connection error 1063 indicates not started by SCM, so run in foreground
            if e.to_string().contains("1063") || e.to_string().contains("dispatcher") {
                run_foreground_service();
            } else {
                error!("Windows Service dispatcher failed: {:?}", e);
            }
        }
    }

    #[cfg(unix)]
    {
        run_foreground_service();
    }
}

// ── Service Install / Uninstall Helper Commands ─────────────────────────────

pub fn install_service() {
    let current_exe = std::env::current_exe().expect("Failed to get current executable path");
    let exe_str = current_exe.to_string_lossy().to_string();

    #[cfg(windows)]
    {
        info!("Installing Windows Service 'discord-gr'...");
        // Invoke sc.exe to create service
        let status = std::process::Command::new("sc.exe")
            .args(&[
                "create",
                "discord-gr",
                &format!("binPath= \"{}\" --service", exe_str),
                "start=",
                "auto",
                "DisplayName=",
                "Discord to Global Relay Bridge Service",
            ])
            .status();

        match status {
            Ok(s) if s.success() => {
                info!("Windows Service 'discord-gr' installed successfully.");
            }
            Ok(s) => {
                error!("Failed to install service, sc.exe exit code: {:?}", s.code());
            }
            Err(e) => {
                error!("Failed to execute sc.exe: {:?}", e);
            }
        }
    }

    #[cfg(unix)]
    {
        info!("Installing systemd user service 'discord-gr'...");
        if let Ok(home) = std::env::var("HOME") {
            let unit_dir = format!("{}/.config/systemd/user", home);
            let _ = std::fs::create_dir_all(&unit_dir);
            let unit_path = format!("{}/discord-gr.service", unit_dir);

            let service_content = format!(
                r#"[Unit]
Description=Discord to Global Relay Bridge Service
After=network.target

[Service]
ExecStart="{}" --service
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
"#,
                exe_str
            );

            if let Err(e) = std::fs::write(&unit_path, service_content) {
                error!("Failed to write service unit file: {:?}", e);
                return;
            }

            // Reload systemd user daemon
            let _ = std::process::Command::new("systemctl")
                .args(&["--user", "daemon-reload"])
                .status();

            // Enable service
            let status = std::process::Command::new("systemctl")
                .args(&["--user", "enable", "--now", "discord-gr"])
                .status();

            match status {
                Ok(s) if s.success() => {
                    info!("systemd user service 'discord-gr' installed and started successfully.");
                }
                _ => {
                    warn!("Failed to enable/start systemd service. Ensure systemctl is available.");
                }
            }
        }
    }
}

pub fn uninstall_service() {
    #[cfg(windows)]
    {
        info!("Uninstalling Windows Service 'discord-gr'...");
        // Stop service first
        let _ = std::process::Command::new("sc.exe")
            .args(&["stop", "discord-gr"])
            .status();

        let status = std::process::Command::new("sc.exe")
            .args(&["delete", "discord-gr"])
            .status();

        match status {
            Ok(s) if s.success() => {
                info!("Windows Service 'discord-gr' uninstalled successfully.");
            }
            Ok(s) => {
                error!("Failed to delete service, sc.exe exit code: {:?}", s.code());
            }
            Err(e) => {
                error!("Failed to execute sc.exe: {:?}", e);
            }
        }
    }

    #[cfg(unix)]
    {
        info!("Uninstalling systemd user service 'discord-gr'...");
        // Stop and disable service
        let _ = std::process::Command::new("systemctl")
            .args(&["--user", "disable", "--now", "discord-gr"])
            .status();

        if let Ok(home) = std::env::var("HOME") {
            let unit_path = format!("{}/.config/systemd/user/discord-gr.service", home);
            let _ = std::fs::remove_file(unit_path);
        }

        // Reload systemd user daemon
        let _ = std::process::Command::new("systemctl")
            .args(&["--user", "daemon-reload"])
            .status();

        info!("systemd user service 'discord-gr' uninstalled successfully.");
    }
}
