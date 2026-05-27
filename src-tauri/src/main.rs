// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();

    if args.iter().any(|arg| arg == "--service") {
        discord_gr_lib::service::run_service();
    } else if args.iter().any(|arg| arg == "--install") {
        tracing_subscriber::fmt()
            .with_target(false)
            .compact()
            .init();
        discord_gr_lib::service::install_service();
    } else if args.iter().any(|arg| arg == "--uninstall") {
        tracing_subscriber::fmt()
            .with_target(false)
            .compact()
            .init();
        discord_gr_lib::service::uninstall_service();
    } else {
        discord_gr_lib::run();
    }
}
