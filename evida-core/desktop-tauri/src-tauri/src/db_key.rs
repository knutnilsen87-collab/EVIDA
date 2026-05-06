#[cfg(not(test))]
use anyhow::Context;
use anyhow::Result;
#[cfg(not(test))]
use std::path::PathBuf;
#[cfg(not(test))]
use uuid::Uuid;

#[cfg(not(test))]
const SERVICE: &str = "Evida";
#[cfg(not(test))]
const USER: &str = "local-sqlcipher-key";
#[cfg(not(test))]
const ENV_KEY: &str = "EVIDA_DB_KEY";

#[derive(Debug, Clone)]
pub struct ResolvedDbKey {
    pub key: String,
    pub source: String,
}

pub fn resolve_db_key() -> Result<ResolvedDbKey> {
    #[cfg(test)]
    {
        Ok(ResolvedDbKey {
            key: "test-only-local-db-key".to_string(),
            source: "test_key".to_string(),
        })
    }

    #[cfg(not(test))]
    {
        if let Ok(value) = std::env::var(ENV_KEY) {
            if !value.trim().is_empty() {
                return Ok(ResolvedDbKey {
                    key: value,
                    source: "environment".to_string(),
                });
            }
        }

        let entry = match keyring::Entry::new(SERVICE, USER) {
            Ok(entry) => entry,
            Err(_) => return resolve_file_fallback_key(),
        };
        if let Ok(existing) = entry.get_password() {
            if !existing.trim().is_empty() {
                return Ok(ResolvedDbKey {
                    key: existing,
                    source: "windows_credential_manager".to_string(),
                });
            }
        }

        let generated = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
        if entry.set_password(&generated).is_err() {
            return resolve_file_fallback_key();
        }

        Ok(ResolvedDbKey {
            key: generated,
            source: "windows_credential_manager_new".to_string(),
        })
    }
}

#[cfg(not(test))]
fn resolve_file_fallback_key() -> Result<ResolvedDbKey> {
    let path = fallback_key_path()?;
    if path.exists() {
        let existing = std::fs::read_to_string(&path)?;
        if !existing.trim().is_empty() {
            return Ok(ResolvedDbKey {
                key: existing,
                source: "local_key_file_fallback".to_string(),
            });
        }
    }
    let generated = format!("{}-{}", Uuid::new_v4(), Uuid::new_v4());
    std::fs::write(&path, &generated).context("Could not write local fallback encryption key")?;
    Ok(ResolvedDbKey {
        key: generated,
        source: "local_key_file_fallback_new".to_string(),
    })
}

#[cfg(not(test))]
fn fallback_key_path() -> Result<PathBuf> {
    let base = dirs::data_local_dir()
        .context("Could not resolve local data directory")?
        .join("Evida");
    std::fs::create_dir_all(&base)?;
    Ok(base.join("evida.fieldkey"))
}
