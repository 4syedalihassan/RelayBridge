//! Discord bot crate — manages serenity gateway connections.
//!
//! Supports multiple bot instances (one per enabled connector).

pub mod client;
pub mod handler;

pub use client::DiscordBot;
pub use handler::EventHandler;
