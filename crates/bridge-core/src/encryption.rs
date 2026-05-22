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
use rand_core::RngCore;

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
        rand_core::OsRng.fill_bytes(&mut nonce_bytes);
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
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_KEY_NAME);

        match entry.get_password() {
            Ok(password) => {
                let bytes: Vec<u8> = password.into_bytes();
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
                rand_core::OsRng.fill_bytes(&mut key);

                // Encode key as base64 (OS keychain typically requires printable strings)
                let encoded = base64_encode(&key);
                entry.set_password(&encoded).map_err(|e| {
                    crate::error::BridgeError::Keychain(e.to_string())
                })?;

                Ok(key)
            }
        }
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_roundtrip() {
        let input = b"Hello, World!";
        let encoded = base64_encode(input);
        assert_eq!(encoded, "SGVsbG8sIFdvcmxkIQ==");
    }

    #[test]
    fn test_base64_padding() {
        assert_eq!(base64_encode(b"f"), "Zg==");
        assert_eq!(base64_encode(b"fo"), "Zm8=");
        assert_eq!(base64_encode(b"foo"), "Zm9v");
    }
}
