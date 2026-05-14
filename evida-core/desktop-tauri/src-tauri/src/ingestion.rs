use crate::hash::sha256_text;
use anyhow::{Context, Result};
use std::{fs, path::Path, process::Command};

const MAX_IMPORT_BYTES: u64 = 250 * 1024 * 1024;

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
    let metadata = fs::metadata(path)
        .with_context(|| format!("Could not inspect document: {}", path.display()))?;
    if metadata.len() > MAX_IMPORT_BYTES {
        anyhow::bail!(
            "Document is too large for this evaluation build: {} MB",
            metadata.len() / 1024 / 1024
        );
    }

    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "pdf" => extract_pdf(path),
        "docx" => extract_docx(path),
        "txt" | "md" | "csv" | "log" => extract_text_file(path),
        "png" | "jpg" | "jpeg" | "tif" | "tiff" | "bmp" => extract_image(path),
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

fn extract_docx(path: &Path) -> Result<DocumentExtraction> {
    let temp_root = std::env::temp_dir().join(format!("evida-docx-{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_root).with_context(|| {
        format!(
            "Could not create temporary DOCX folder: {}",
            temp_root.display()
        )
    })?;
    let zip_path = temp_root.join("document.zip");
    fs::copy(path, &zip_path)
        .with_context(|| format!("Could not prepare DOCX for extraction: {}", path.display()))?;

    let command = format!(
        "Expand-Archive -LiteralPath '{}' -DestinationPath '{}' -Force",
        zip_path.display().to_string().replace('\'', "''"),
        temp_root.display().to_string().replace('\'', "''")
    );
    let output = Command::new("powershell")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(command)
        .output();

    let document_xml = temp_root.join("word").join("document.xml");
    let result = match output {
        Ok(result) if result.status.success() && document_xml.exists() => {
            let xml = fs::read_to_string(&document_xml).with_context(|| {
                format!("Could not read DOCX text XML: {}", document_xml.display())
            })?;
            let paragraphs = xml_to_plain_text_paragraphs(&xml);
            let text = paragraphs.join(" ");
            let (pages, chunks) = docx_pages_and_chunks(&paragraphs, &text);
            Ok(DocumentExtraction {
                mime_type: Some(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        .to_string(),
                ),
                page_count: pages.len() as i64,
                ocr_status: if chunks.is_empty() {
                    "empty"
                } else {
                    "not_required"
                }
                .to_string(),
                pages,
                chunks,
                warnings: vec![],
            })
        }
        Ok(result) => Ok(DocumentExtraction {
            mime_type: Some(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    .to_string(),
            ),
            page_count: 1,
            ocr_status: "failed".to_string(),
            pages: vec![ExtractedPage {
                page_number: 1,
                text_status: "failed".to_string(),
                sha256: None,
            }],
            chunks: vec![],
            warnings: vec![format!(
                "docx_extract_failed:{}",
                String::from_utf8_lossy(&result.stderr).trim()
            )],
        }),
        Err(error) => Ok(DocumentExtraction {
            mime_type: Some(
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    .to_string(),
            ),
            page_count: 1,
            ocr_status: "failed".to_string(),
            pages: vec![ExtractedPage {
                page_number: 1,
                text_status: "failed".to_string(),
                sha256: None,
            }],
            chunks: vec![],
            warnings: vec![format!("docx_extract_not_available:{}", error)],
        }),
    };

    let _ = fs::remove_dir_all(&temp_root);
    result
}

fn xml_to_plain_text_paragraphs(xml: &str) -> Vec<String> {
    xml.split("</w:p>")
        .map(strip_xml_to_plain_text)
        .filter(|text| !text.trim().is_empty())
        .collect()
}

fn strip_xml_to_plain_text(xml: &str) -> String {
    let with_breaks = xml
        .replace("</w:p>", "\n")
        .replace("<w:tab/>", " ")
        .replace("<w:br/>", "\n");
    let mut output = String::with_capacity(with_breaks.len());
    let mut in_tag = false;
    for ch in with_breaks.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                output.push(' ');
            }
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }
    output
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn docx_pages_and_chunks(
    paragraphs: &[String],
    text: &str,
) -> (Vec<ExtractedPage>, Vec<TextChunk>) {
    if paragraphs.is_empty() {
        return (
            vec![ExtractedPage {
                page_number: 1,
                sha256: None,
                text_status: "empty".to_string(),
            }],
            vec![],
        );
    }
    let marker_count = count_docx_numbered_sections(text);
    let page_count = if marker_count >= 3 {
        (marker_count / 3).max(1)
    } else {
        (paragraphs.len() / 7).max(1)
    } as i64;
    let mut pages = Vec::new();
    let mut chunks = Vec::new();
    let mut start = 0_usize;
    for page_number in 1..=page_count {
        let remaining_pages = (page_count - page_number) as usize;
        let end = if remaining_pages == 0 {
            paragraphs.len()
        } else {
            (start + 3).min(paragraphs.len().saturating_sub(remaining_pages))
        };
        let text = paragraphs[start..end].join(" ");
        pages.push(ExtractedPage {
            page_number,
            sha256: Some(sha256_text(&text)),
            text_status: "extracted".to_string(),
        });
        chunks.extend(split_text_into_chunks(&text, page_number));
        start = end;
    }
    (pages, chunks)
}

fn count_docx_numbered_sections(text: &str) -> usize {
    text.split("Punkt ")
        .skip(1)
        .filter(|part| part.chars().next().is_some_and(|ch| ch.is_ascii_digit()))
        .count()
}

fn extract_image(path: &Path) -> Result<DocumentExtraction> {
    let output = Command::new("tesseract")
        .arg(path)
        .arg("stdout")
        .arg("-l")
        .arg("nor+eng")
        .output();

    match output {
        Ok(result) if result.status.success() => {
            let text = String::from_utf8_lossy(&result.stdout).to_string();
            let chunks = split_text_into_chunks(&text, 1);
            Ok(DocumentExtraction {
                mime_type: Some(mime_type_for_path(path)),
                page_count: 1,
                ocr_status: if chunks.is_empty() { "empty" } else { "ok" }.to_string(),
                pages: vec![ExtractedPage {
                    page_number: 1,
                    sha256: if text.trim().is_empty() {
                        None
                    } else {
                        Some(sha256_text(&text))
                    },
                    text_status: if text.trim().is_empty() {
                        "empty"
                    } else {
                        "ocr_extracted"
                    }
                    .to_string(),
                }],
                chunks,
                warnings: vec![],
            })
        }
        Ok(result) => Ok(DocumentExtraction {
            mime_type: Some(mime_type_for_path(path)),
            page_count: 1,
            ocr_status: "failed".to_string(),
            pages: vec![ExtractedPage {
                page_number: 1,
                text_status: "needs_ocr".to_string(),
                sha256: None,
            }],
            chunks: vec![],
            warnings: vec![format!(
                "tesseract_failed:{}",
                String::from_utf8_lossy(&result.stderr).trim()
            )],
        }),
        Err(error) => Ok(DocumentExtraction {
            mime_type: Some(mime_type_for_path(path)),
            page_count: 1,
            ocr_status: "needs_ocr".to_string(),
            pages: vec![ExtractedPage {
                page_number: 1,
                text_status: "needs_ocr".to_string(),
                sha256: None,
            }],
            chunks: vec![],
            warnings: vec![format!("tesseract_not_available:{}", error)],
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
        ocr_status: if text.trim().is_empty() {
            "empty"
        } else {
            "not_required"
        }
        .to_string(),
        pages: vec![ExtractedPage {
            page_number: 1,
            sha256: Some(sha256_text(&text)),
            text_status: if text.trim().is_empty() {
                "empty"
            } else {
                "extracted"
            }
            .to_string(),
        }],
        chunks,
        warnings: vec![],
    })
}

fn extract_pdf(path: &Path) -> Result<DocumentExtraction> {
    let bytes = fs::read(path)
        .with_context(|| format!("Could not read PDF document: {}", path.display()))?;
    let content = String::from_utf8_lossy(&bytes);
    let mut page_count = count_pdf_pages(&content);
    let mut pages = Vec::new();
    let mut warnings = Vec::new();
    let extracted_pages = pdf_extract::extract_text_by_pages(path)
        .map(|pages| {
            pages
                .into_iter()
                .map(|page| page.split_whitespace().collect::<Vec<_>>().join(" "))
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|_| {
            let extracted_text = pdf_extract::extract_text(path).unwrap_or_default();
            split_pdf_text_pages(&extracted_text)
        });

    if !extracted_pages.is_empty() {
        if page_count == 0 {
            page_count = extracted_pages.len() as i64;
        }

        let mut chunks = Vec::new();
        let mut pages_without_text = 0;
        for page_number in 1..=page_count {
            let text = extracted_pages
                .get((page_number - 1) as usize)
                .map(|page| page.trim())
                .unwrap_or("");
            if text.is_empty() || page_needs_text_recognition(text) {
                pages_without_text += 1;
                pages.push(ExtractedPage {
                    page_number,
                    text_status: "needs_ocr".to_string(),
                    sha256: None,
                });
                continue;
            }

            pages.push(ExtractedPage {
                page_number,
                text_status: "extracted".to_string(),
                sha256: Some(sha256_text(text)),
            });
            chunks.extend(split_text_into_chunks(text, page_number));
        }

        if pages_without_text > 0 {
            warnings.push(format!(
                "{}_pages_need_ocr_or_have_no_text_layer",
                pages_without_text
            ));
        }

        return Ok(DocumentExtraction {
            mime_type: Some("application/pdf".to_string()),
            page_count,
            ocr_status: if warnings.is_empty() {
                "text_extracted"
            } else {
                "partial_needs_ocr"
            }
            .to_string(),
            pages,
            chunks,
            warnings,
        });
    }

    for page_number in 1..=page_count {
        pages.push(ExtractedPage {
            page_number,
            text_status: "needs_ocr".to_string(),
            sha256: None,
        });
    }
    if page_count > 0 {
        warnings.push("pdf_has_no_extractable_text_layer_needs_ocr".to_string());
    }

    Ok(DocumentExtraction {
        mime_type: Some("application/pdf".to_string()),
        page_count,
        ocr_status: if page_count > 0 {
            "needs_ocr"
        } else {
            "failed"
        }
        .to_string(),
        pages,
        chunks: vec![],
        warnings,
    })
}

fn split_pdf_text_pages(text: &str) -> Vec<String> {
    text.split('\u{000c}')
        .map(|page| page.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|page| !page.trim().is_empty())
        .collect()
}

fn count_pdf_pages(content: &str) -> i64 {
    let page_markers = content.matches("/Type /Page").count() as i64;
    let pages_markers = content.matches("/Type /Pages").count() as i64;
    (page_markers - pages_markers).max(0)
}

fn page_needs_text_recognition(text: &str) -> bool {
    let normalized = text.to_lowercase();
    if normalized.contains("ocr-body") {
        return true;
    }

    let word_count = normalized.split_whitespace().count();
    word_count <= 24
        && normalized.contains("bates:")
        && normalized.contains("side ")
        && normalized.contains(" av ")
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
        let piece = chars[cursor..end]
            .iter()
            .collect::<String>()
            .trim()
            .to_string();
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
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "txt" => "text/plain",
        "md" => "text/markdown",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "csv" => "text/csv",
        "log" => "text/plain",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "tif" | "tiff" => "image/tiff",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    }
    .to_string()
}
