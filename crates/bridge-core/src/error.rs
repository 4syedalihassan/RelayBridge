//! Error types for all bridge operations.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum BridgeError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Encryption error: {0}")]
    Encryption(String),

    #[error("Keychain error: {0}")]
    Keychain(String),

    #[error("Discord API error: {0}")]
    Discord(String),

    #[error("Global Relay API error: {0}")]
    GlobalRelay(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Transport error: {0}")]
    Transport(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

/// Convenience result type for bridge operations.
pub type BridgeResult<T> = Result<T, BridgeError>;
