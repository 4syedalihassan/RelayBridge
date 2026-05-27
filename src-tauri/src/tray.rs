//! System tray setup and event handling.

use bridge_core::BridgeManager;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
    App, Manager,
};

/// Install the system tray icon and context menu.
pub fn setup_tray<R: tauri::Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let open_ui = MenuItemBuilder::with_id("open_ui", "Open UI").build(app)?;
    let status = MenuItemBuilder::with_id("status", "Show Status").build(app)?;
    let exit = MenuItemBuilder::with_id("exit", "Exit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&open_ui, &status, &exit])
        .build()?;

    let icon = app.default_window_icon().cloned().expect("Failed to get default window icon");

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("RelayBridge")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open_ui" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "status" => {
                use tauri_plugin_dialog::DialogExt;
                let state = app.state::<crate::AppState>();
                let health_result = tauri::async_runtime::block_on(async {
                    state.manager.get_health().await
                });

                let message = match health_result {
                    Ok(bridge_core::types::HealthStatus::Online) => {
                        "Bridge is currently ONLINE and actively forwarding messages."
                    }
                    Ok(bridge_core::types::HealthStatus::Offline) => {
                        "Bridge is currently OFFLINE (all connectors paused)."
                    }
                    Ok(bridge_core::types::HealthStatus::Error) => {
                        "Bridge is in an ERROR state. Please open the UI to check error logs."
                    }
                    Err(e) => {
                        &format!("Failed to retrieve bridge status: {}", e)
                    }
                };

                app.dialog()
                    .message(message)
                    .title("Bridge Status")
                    .kind(tauri_plugin_dialog::MessageDialogKind::Info)
                    .buttons(tauri_plugin_dialog::MessageDialogButtons::Ok)
                    .show(|_| {});
            }
            "exit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
