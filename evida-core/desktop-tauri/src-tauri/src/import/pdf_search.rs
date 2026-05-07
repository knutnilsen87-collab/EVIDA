use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
pub struct SearchPdfRequest {
    pub case_id: String,
    pub query: String,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub document_id: String,
    pub filename: String,
    pub page_number: i64,
    pub chunk_id: String,
    pub snippet: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResponse {
    pub results: Vec<SearchResult>,
}

fn repo_root_from_current() -> Result<PathBuf, String> {
    let current = std::env::current_dir().map_err(|error| error.to_string())?;
    let mut cursor = current.as_path();

    loop {
        let candidate = cursor.join("evida-core").join("ai-engine");
        if candidate.exists() {
            return Ok(cursor.to_path_buf());
        }

        let candidate = cursor.join("ai-engine");
        if candidate.exists() {
            return Ok(cursor.parent().unwrap_or(cursor).to_path_buf());
        }

        match cursor.parent() {
            Some(parent) => cursor = parent,
            None => break,
        }
    }

    Err("Could not locate repo root or ai-engine folder".to_string())
}

fn python_command() -> String {
    std::env::var("EVIDA_PYTHON").unwrap_or_else(|_| "python".to_string())
}

#[tauri::command]
pub async fn search_imported_pdf(
    app: AppHandle,
    request: SearchPdfRequest,
) -> Result<SearchResponse, String> {
    if request.query.trim().is_empty() {
        return Ok(SearchResponse { results: vec![] });
    }

    let repo_root = repo_root_from_current()?;
    let worker = repo_root
        .join("evida-core")
        .join("ai-engine")
        .join("pdf_search.py");

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve app data dir: {error}"))?;

    let db_path = data_dir.join("evida_documents.sqlite");

    let output = Command::new(python_command())
        .arg(worker)
        .arg("--db")
        .arg(db_path)
        .arg("--case-id")
        .arg(request.case_id)
        .arg("--query")
        .arg(request.query)
        .arg("--limit")
        .arg(request.limit.unwrap_or(20).to_string())
        .output()
        .map_err(|error| format!("Could not run search worker: {error}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str::<SearchResponse>(&stdout)
        .map_err(|error| format!("Could not parse search response: {error}. Raw: {stdout}"))
}
