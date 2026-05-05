use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use anyhow::Result;
use base64::Engine;
use sha2::{Digest, Sha256};
use uuid::Uuid;

const PREFIX: &str = "enc:v1:";

pub fn encrypt_text(value: &str) -> Result<String> {
    if value.is_empty() || value.starts_with(PREFIX) {
        return Ok(value.to_string());
    }
    let resolved = crate::db_key::resolve_db_key()?;
    let key_bytes = Sha256::digest(resolved.key.as_bytes());
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let uuid = Uuid::new_v4();
    let nonce_bytes = &uuid.as_bytes()[..12];
    let nonce = Nonce::from_slice(nonce_bytes);
    let encrypted = cipher
        .encrypt(nonce, value.as_bytes())
        .map_err(|_| anyhow::anyhow!("Could not encrypt sensitive text"))?;
    let mut payload = Vec::with_capacity(12 + encrypted.len());
    payload.extend_from_slice(nonce_bytes);
    payload.extend_from_slice(&encrypted);
    Ok(format!(
        "{}{}",
        PREFIX,
        base64::engine::general_purpose::STANDARD.encode(payload)
    ))
}

pub fn decrypt_text(value: &str) -> String {
    if !value.starts_with(PREFIX) {
        return value.to_string();
    }
    decrypt_text_result(value).unwrap_or_else(|_| "[kryptert tekst kunne ikke åpnes]".to_string())
}

fn decrypt_text_result(value: &str) -> Result<String> {
    let resolved = crate::db_key::resolve_db_key()?;
    let key_bytes = Sha256::digest(resolved.key.as_bytes());
    let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
    let cipher = Aes256Gcm::new(key);
    let payload = base64::engine::general_purpose::STANDARD.decode(&value[PREFIX.len()..])?;
    if payload.len() < 13 {
        anyhow::bail!("Encrypted payload too short");
    }
    let (nonce_bytes, encrypted) = payload.split_at(12);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce_bytes), encrypted)
        .map_err(|_| anyhow::anyhow!("Could not decrypt sensitive text"))?;
    Ok(String::from_utf8(plaintext)?)
}
