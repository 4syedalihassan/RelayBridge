//! Application-level configuration.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Path to the SQLite database file.
    pub db_path: String,

    /// Log level (trace, debug, info, warn, error).
    pub log_level: String,

    /// Path for the local socket (UDS on Linux, Named Pipe on Windows).
    pub socket_path: String,

    /// Whether to auto-start the bridge on boot.
    pub auto_start: bool,

    /// Whether to auto-check for updates.
    pub auto_update: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            db_path: get_default_db_path(),
            log_level: "info".to_string(),
            socket_path: get_default_socket_path(),
            auto_start: true,
            auto_update: true,
        }
    }
}

fn get_default_db_path() -> String {
    #[cfg(target_os = "windows")]
    {
        if let Some(programdata) = std::env::var_os("ProgramData") {
            return format!(
                "{}\\DiscordGR\\discord-gr.db",
                programdata.to_string_lossy()
            );
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return format!("{}/.config/discord-gr/discord-gr.db", home);
        }
    }
    "discord-gr.db".to_string()
}

fn get_default_socket_path() -> String {
    #[cfg(target_os = "windows")]
    {
        r"\\.\pipe\discord-gr".to_string()
    }
    #[cfg(target_os = "linux")]
    {
        "/tmp/discord-gr.sock".to_string()
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        "/tmp/discord-gr.sock".to_string()
    }
}
