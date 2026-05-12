use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::{fs, io::Read, path::Path};

pub const MAX_IMPORT_BYTES: u64 = 250 * 1024 * 1024;

pub const PROCESSING_STATUSES: &[&str] = &[
    "queued",
    "validating",
    "hashing",
    "type_detecting",
    "safety_pending",
    "extracting_text",
    "ocr_running",
    "chunking",
    "indexed",
];

pub const TERMINAL_STATUSES: &[&str] = &[
    "ready",
    "partial",
    "ocr_required",
    "duplicate",
    "unsupported",
    "failed",
    "cancelled",
    "security_blocked",
    "manual_review_required",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTypeDetection {
    pub extension: Option<String>,
    pub detected_mime_type: String,
    pub detected_file_type: String,
    pub magic_signature: String,
    pub type_mismatch: bool,
    pub supported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SafetyAssessment {
    pub allowed: bool,
    pub issue_code: Option<String>,
    pub issue_severity: Option<String>,
    pub user_message: String,
    pub technical_message: Option<String>,
    pub recommended_action: String,
    pub retryable: bool,
}

pub fn is_processing_status(status: &str) -> bool {
    PROCESSING_STATUSES.contains(&status)
}

pub fn is_terminal_status(status: &str) -> bool {
    TERMINAL_STATUSES.contains(&status)
}

pub fn detect_file_type(path: &Path) -> Result<FileTypeDetection> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase());
    let signature = read_magic_signature(path)?;
    let lower_ext = extension.as_deref().unwrap_or("");
    let (detected_file_type, detected_mime_type) = match signature.as_slice() {
        [0x25, 0x50, 0x44, 0x46, ..] => ("pdf", "application/pdf"),
        [0x50, 0x4b, 0x03, 0x04, ..] | [0x50, 0x4b, 0x05, 0x06, ..] | [0x50, 0x4b, 0x07, 0x08, ..] => {
            if lower_ext == "docx" {
                (
                    "docx",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            } else {
                ("zip", "application/zip")
            }
        }
        [0x89, 0x50, 0x4e, 0x47, ..] => ("png", "image/png"),
        [0xff, 0xd8, 0xff, ..] => ("jpg", "image/jpeg"),
        [0x49, 0x49, 0x2a, 0x00, ..] | [0x4d, 0x4d, 0x00, 0x2a, ..] => ("tiff", "image/tiff"),
        [0x42, 0x4d, ..] => ("bmp", "image/bmp"),
        _ if matches!(lower_ext, "txt" | "md" | "markdown" | "csv" | "log") => {
            (lower_ext, mime_for_text_extension(lower_ext))
        }
        _ => ("unknown", "application/octet-stream"),
    };
    let supported = matches!(
        detected_file_type,
        "pdf" | "docx" | "txt" | "md" | "markdown" | "csv" | "log" | "png" | "jpg" | "tiff" | "bmp"
    );
    let expected = normalized_expected_type(lower_ext);
    let type_mismatch = expected
        .map(|expected| detected_file_type != "unknown" && expected != detected_file_type)
        .unwrap_or(false);

    Ok(FileTypeDetection {
        extension: extension.clone(),
        detected_mime_type: detected_mime_type.to_string(),
        detected_file_type: detected_file_type.to_string(),
        magic_signature: signature
            .iter()
            .map(|byte| format!("{byte:02X}"))
            .collect::<Vec<_>>()
            .join(" "),
        type_mismatch,
        supported,
    })
}

pub fn assess_file_safety(path: &Path, detection: &FileTypeDetection) -> SafetyAssessment {
    if !path.exists() {
        return blocked(
            "PATH_NOT_FILE",
            "error",
            "Feilet - filbanen finnes ikke.",
            "Velg filen på nytt fra mappen der den ligger.",
            false,
            Some("path_missing".to_string()),
        );
    }
    if !path.is_file() {
        return blocked(
            "PATH_NOT_FILE",
            "error",
            "Feilet - valget er ikke en fil.",
            "Importer mappen slik at Evida kan registrere hver fil inni.",
            false,
            Some("path_is_not_file".to_string()),
        );
    }
    let metadata = match fs::metadata(path) {
        Ok(value) => value,
        Err(error) => {
            return blocked(
                "FILE_PERMISSION_DENIED",
                "error",
                "Feilet - Evida fikk ikke lese filen.",
                "Lukk andre programmer eller gi tilgang og prøv igjen.",
                true,
                Some(error.to_string()),
            );
        }
    };
    if metadata.len() == 0 {
        return blocked(
            "ZERO_BYTE_FILE",
            "error",
            "Feilet - filen er tom.",
            "Last opp en ny kopi med innhold.",
            true,
            Some("metadata_len_zero".to_string()),
        );
    }
    if metadata.len() > MAX_IMPORT_BYTES {
        return blocked(
            "FILE_TOO_LARGE",
            "error",
            "Feilet - filen er for stor for denne importen.",
            "Del dokumentet opp eller last opp en mindre kopi.",
            true,
            Some(format!("file_size_bytes={}", metadata.len())),
        );
    }
    if detection.detected_file_type == "zip" {
        return blocked(
            "UNSUPPORTED_FILE_TYPE",
            "warning",
            "Unsupported - ZIP-arkiv importeres ikke automatisk ennå.",
            "Pakk ut arkivet og importer mappen, eller last opp enkeltfilene.",
            false,
            Some("archive_requires_explicit_future_safety_inspection".to_string()),
        );
    }
    if detection.type_mismatch {
        return blocked(
            "TYPE_MISMATCH",
            "warning",
            "Feilet - filtypen stemmer ikke med filinnholdet.",
            "Kontroller filen og last opp riktig originalformat.",
            true,
            Some(format!(
                "extension={:?};detected={};magic={}",
                detection.extension, detection.detected_file_type, detection.magic_signature
            )),
        );
    }
    if !detection.supported {
        return blocked(
            "UNSUPPORTED_FILE_TYPE",
            "warning",
            "Unsupported - filtypen er ikke støttet av importmotoren.",
            "Last opp filen som PDF, DOCX, TXT, CSV, loggfil eller støttet bildeformat.",
            false,
            Some(format!(
                "extension={:?};detected={};magic={}",
                detection.extension, detection.detected_file_type, detection.magic_signature
            )),
        );
    }
    SafetyAssessment {
        allowed: true,
        issue_code: None,
        issue_severity: None,
        user_message: "Safety-gate passert - filen kan behandles.".to_string(),
        technical_message: None,
        recommended_action: "Vent til Evida er ferdig med importen.".to_string(),
        retryable: false,
    }
}

fn read_magic_signature(path: &Path) -> Result<Vec<u8>> {
    let mut file = fs::File::open(path)
        .with_context(|| format!("Could not open file for type detection: {}", path.display()))?;
    let mut buffer = [0_u8; 16];
    let read = file.read(&mut buffer)?;
    Ok(buffer[..read].to_vec())
}

fn normalized_expected_type(extension: &str) -> Option<&'static str> {
    match extension {
        "pdf" => Some("pdf"),
        "docx" => Some("docx"),
        "txt" => Some("txt"),
        "md" | "markdown" => Some("md"),
        "csv" => Some("csv"),
        "log" => Some("log"),
        "png" => Some("png"),
        "jpg" | "jpeg" => Some("jpg"),
        "tif" | "tiff" => Some("tiff"),
        "bmp" => Some("bmp"),
        _ => None,
    }
}

fn mime_for_text_extension(extension: &str) -> &'static str {
    match extension {
        "md" | "markdown" => "text/markdown",
        "csv" => "text/csv",
        _ => "text/plain",
    }
}

fn blocked(
    issue_code: &str,
    severity: &str,
    user_message: &str,
    recommended_action: &str,
    retryable: bool,
    technical_message: Option<String>,
) -> SafetyAssessment {
    SafetyAssessment {
        allowed: false,
        issue_code: Some(issue_code.to_string()),
        issue_severity: Some(severity.to_string()),
        user_message: user_message.to_string(),
        technical_message,
        recommended_action: recommended_action.to_string(),
        retryable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn detects_pdf_by_magic_even_when_extension_is_wrong() {
        let path = std::env::temp_dir().join(format!("evida-magic-{}.txt", Uuid::new_v4()));
        fs::write(&path, b"%PDF-1.7\n1 0 obj").expect("write pdf-like file");

        let detection = detect_file_type(&path).expect("detect");
        let safety = assess_file_safety(&path, &detection);

        assert_eq!(detection.detected_file_type, "pdf");
        assert!(detection.type_mismatch);
        assert!(!safety.allowed);
        assert_eq!(safety.issue_code.as_deref(), Some("TYPE_MISMATCH"));

        let _ = fs::remove_file(path);
    }

    #[test]
    fn zero_byte_file_is_explicit_failure() {
        let path = std::env::temp_dir().join(format!("evida-zero-{}.pdf", Uuid::new_v4()));
        fs::write(&path, []).expect("write empty file");

        let detection = detect_file_type(&path).expect("detect");
        let safety = assess_file_safety(&path, &detection);

        assert!(!safety.allowed);
        assert_eq!(safety.issue_code.as_deref(), Some("ZERO_BYTE_FILE"));
        assert!(safety.user_message.contains("tom"));

        let _ = fs::remove_file(path);
    }
}
