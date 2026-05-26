//! Bridge Core — shared types, configuration, error handling, and encryption.

pub mod config;
pub mod encryption;
pub mod error;
pub mod in_process;
pub mod manager;
pub mod state;
pub mod types;

pub use config::AppConfig;
pub use encryption::EncryptionService;
pub use error::{BridgeError, BridgeResult};
pub use in_process::InProcessManager;
pub use manager::BridgeManager;
pub use state::{BridgeState, SharedBridgeState};
pub use types::*;
use zeroize::Zeroize;

/// Secret string wrapper that zeroizes on drop.
#[derive(serde::Serialize, serde::Deserialize, Clone, zeroize::Zeroize, zeroize::ZeroizeOnDrop)]
pub struct SecretString(String);

impl SecretString {
    pub fn new(value: String) -> Self {
        Self(value)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn into_inner(mut self) -> String {
        let s = self.0.clone();
        self.0.zeroize();
        s
    }
}

impl From<String> for SecretString {
    fn from(s: String) -> Self {
        Self::new(s)
    }
}

impl std::fmt::Debug for SecretString {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SecretString([redacted])")
    }
}

/// Encrypted data stored at rest: ciphertext + nonce.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Encrypted {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}
