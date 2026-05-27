//! Encryption module for credential storage.
//!
//! Uses OS keychain for master key storage and AES-256-GCM for encrypting
//! credentials at rest in SQLite.

use crate::error::BridgeResult;
use crate::Encrypted;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

/// Master key name stored in OS keychain.
const KEYCHAIN_SERVICE: &str = "discord-gr";
const KEYCHAIN_KEY_NAME: &str = "master-key";

/// Service for encrypting and decrypting secrets using OS keychain + AES-256-GCM.
pub struct EncryptionService {
    key: [u8; 32],
}

impl EncryptionService {
    /// Create a new encryption service, loading or generating the master key.
    pub fn new() -> BridgeResult<Self> {
        let key = Self::load_or_create_key()?;
        Ok(Self { key })
    }

    /// Encrypt plaintext bytes. Returns (ciphertext, nonce).
    pub fn encrypt(&self, plaintext: &[u8]) -> BridgeResult<Encrypted> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| crate::error::BridgeError::Encryption(e.to_string()))?;

        let mut nonce_bytes = [0u8; 12];
        let mut rng = rand::rngs::OsRng;
        rng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext)
            .map_err(|e| crate::error::BridgeError::Encryption(e.to_string()))?;

        Ok(Encrypted {
            ciphertext,
            nonce: nonce_bytes.to_vec(),
        })
    }

    /// Decrypt ciphertext using the provided nonce.
    pub fn decrypt(&self, encrypted: &Encrypted) -> BridgeResult<Vec<u8>> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| crate::error::BridgeError::Encryption(e.to_string()))?;

        let nonce = Nonce::from_slice(&encrypted.nonce);
        let plaintext = cipher
            .decrypt(nonce, encrypted.ciphertext.as_ref())
            .map_err(|e| crate::error::BridgeError::Encryption(e.to_string()))?;

        Ok(plaintext)
    }

    fn load_or_create_key() -> BridgeResult<[u8; 32]> {
        #[cfg(target_os = "windows")]
        {
            if let Some(programdata) = std::env::var_os("ProgramData") {
                let dir = format!("{}\\DiscordGR", programdata.to_string_lossy());
                let _ = std::fs::create_dir_all(&dir);
                let key_path = format!("{}\\master.key", dir);

                if let Ok(content) = std::fs::read_to_string(&key_path) {
                    let trimmed = content.trim();
                    if let Some(bytes) = hex_decode(trimmed) {
                        if bytes.len() == 32 {
                            let mut key = [0u8; 32];
                            key.copy_from_slice(&bytes);
                            return Ok(key);
                        }
                    }
                }

                // Create a new master key
                let mut key = [0u8; 32];
                let mut rng = rand::rngs::OsRng;
                rng.fill_bytes(&mut key);

                let encoded = hex_encode(&key);
                if let Err(e) = std::fs::write(&key_path, &encoded) {
                    return Err(crate::error::BridgeError::Encryption(format!(
                        "Failed to write master key file: {}",
                        e
                    )));
                }

                return Ok(key);
            }
        }

        // Fallback for non-Windows platforms: use standard OS keychain
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_KEY_NAME)
            .map_err(|e| crate::error::BridgeError::Keychain(e.to_string()))?;

        match entry.get_password() {
            Ok(password) => {
                let bytes = hex_decode(&password).ok_or_else(|| {
                    crate::error::BridgeError::Keychain("Invalid hex key in keychain".to_string())
                })?;
                if bytes.len() == 32 {
                    let mut key = [0u8; 32];
                    key.copy_from_slice(&bytes);
                    return Ok(key);
                }
                Err(crate::error::BridgeError::Keychain(
                    "Invalid key length in keychain".to_string(),
                ))
            }
            Err(_) => {
                let mut key = [0u8; 32];
                let mut rng = rand::rngs::OsRng;
                rng.fill_bytes(&mut key);

                // Encode key as hex (OS keychain typically requires printable strings)
                let encoded = hex_encode(&key);
                entry.set_password(&encoded).map_err(|e| {
                    crate::error::BridgeError::Keychain(e.to_string())
                })?;

                Ok(key)
            }
        }
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut s = String::new();
    for &b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn hex_decode(s: &str) -> Option<Vec<u8>> {
    if s.len() % 2 != 0 {
        return None;
    }
    let mut bytes = Vec::new();
    for i in (0..s.len()).step_by(2) {
        if i + 2 > s.len() {
            return None;
        }
        let hex_val = &s[i..i+2];
        let byte = u8::from_str_radix(hex_val, 16).ok()?;
        bytes.push(byte);
    }
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_roundtrip() {
        let input = b"Hello, World!";
        let encoded = hex_encode(input);
        let decoded = hex_decode(&encoded).unwrap();
        assert_eq!(input.as_ref(), decoded.as_slice());
    }
}
