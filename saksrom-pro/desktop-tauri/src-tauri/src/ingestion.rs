use crate::hash::sha256_text;
use anyhow::{Context, Result};
use std::{fs, path::Path};

#[derive(Debug, Clone)]
pub struct ExtractedPage {
    pub page_number: i64,
    pub text_status: String,
    pub sha256: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TextChunk {
    pub page_start: i64,
    pub page_end: i64,
    pub text: String,
    pub sha256: String,
}

#[derive(Debug, Clone)]
pub struct DocumentExtraction {
    pub mime_type: Option<String>,
    pub page_count: i64,
    pub ocr_status: String,
    pub pages: Vec<ExtractedPage>,
    pub chunks: Vec<TextChunk>,
    pub warnings: Vec<String>,
}

pub fn extract_document(path: &Path) -> Result<DocumentExtraction> {
    if !path.exists() {
        anyhow::bail!("Document does not exist: {}", path.display());
    }
    if !path.is_file() {
        anyhow::bail!("Document path is not a file: {}", path.display());
    }

    match path.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase().as_str() {
        "pdf" => extract_pdf(path),
        "txt" | "md" | "csv" | "log" => extract_text_file(path),
        _ => Ok(DocumentExtraction {
            mime_type: Some("application/octet-stream".to_string()),
            page_count: 0,
            ocr_status: "unsupported_file_type".to_string(),
            pages: vec![],
            chunks: vec![],
            warnings: vec!["unsupported_file_type".to_string()],
        }),
    }
}

fn extract_text_file(path: &Path) -> Result<DocumentExtraction> {
    let text = fs::read_to_string(path)
        .with_context(|| format!("Could not read text document: {}", path.display()))?;
    let chunks = split_text_into_chunks(&text, 1);
    Ok(DocumentExtraction {
        mime_type: Some(mime_type_for_path(path)),
        page_count: 1,
        ocr_status: if text.trim().is_empty() { "empty" } else { "not_required" }.to_string(),
        pages: vec![ExtractedPage {
            page_number: 1,
            sha256: Some(sha256_text(&text)),
            text_status: if text.trim().is_empty() { "empty" } else { "extracted" }.to_string(),
        }],
        chunks,
        warnings: vec![],
    })
}

fn extract_pdf(path: &Path) -> Result<DocumentExtraction> {
    let bytes = fs::read(path)
        .with_context(|| format!("Could not read PDF document: {}", path.display()))?;
    let content = String::from_utf8_lossy(&bytes);
    let page_count = count_pdf_pages(&content);
    let mut pages = Vec::new();
    let mut warnings = Vec::new();

    for page_number in 1..=page_count {
        pages.push(ExtractedPage {
            page_number,
            text_status: "needs_ocr".to_string(),
            sha256: None,
        });
        warnings.push(format!("page_{}_needs_ocr", page_number));
    }

    Ok(DocumentExtraction {
        mime_type: Some("application/pdf".to_string()),
        page_count,
        ocr_status: if page_count > 0 { "needs_ocr" } else { "failed" }.to_string(),
        pages,
        chunks: vec![],
        warnings,
    })
}

fn count_pdf_pages(content: &str) -> i64 {
    let page_markers = content.matches("/Type /Page").count() as i64;
    let pages_markers = content.matches("/Type /Pages").count() as i64;
    (page_markers - pages_markers).max(0)
}

pub fn split_text_into_chunks(text: &str, page_start: i64) -> Vec<TextChunk> {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return vec![];
    }

    let max_chars = 1600;
    let mut chunks = Vec::new();
    let mut cursor = 0;

    let chars: Vec<char> = normalized.chars().collect();
    while cursor < chars.len() {
        let end = (cursor + max_chars).min(chars.len());
        let piece = chars[cursor..end].iter().collect::<String>().trim().to_string();
        if !piece.is_empty() {
            chunks.push(TextChunk {
                page_start,
                page_end: page_start,
                sha256: sha256_text(&piece),
                text: piece,
            });
        }
        cursor += max_chars;
    }

    chunks
}

fn mime_type_for_path(path: &Path) -> String {
    match path.extension().and_then(|value| value.to_str()).unwrap_or("").to_lowercase().as_str() {
        "txt" => "text/plain",
        "md" => "text/markdown",
        "csv" => "text/csv",
        "log" => "text/plain",
        _ => "application/octet-stream",
    }
    .to_string()
}
