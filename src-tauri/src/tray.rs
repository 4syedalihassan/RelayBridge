//! System tray setup and event handling.

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

/// Install the system tray icon and context menu.
pub fn setup_tray<R: tauri::Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Show Dashboard").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .items(&[&show, &quit])
        .build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Discord → Global Relay Bridge")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|_tray, event| {
            // Double-click to show window
            if let TrayIconEvent::DoubleClick { .. } = event {
                // handled via menu "show" — or directly open the window here
            }
        })
        .build(app)?;

    Ok(())
}
