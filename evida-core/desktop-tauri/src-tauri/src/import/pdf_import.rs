use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader},
    path::PathBuf,
    process::{Command, Stdio},
};
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Deserialize)]
pub struct ImportPdfRequest {
    pub pdf_path: String,
    pub case_id: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct ImportStarted {
    pub ok: bool,
    pub message: String,
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
pub async fn import_single_pdf(
    app: AppHandle,
    request: ImportPdfRequest,
) -> Result<ImportStarted, String> {
    let pdf_path = PathBuf::from(&request.pdf_path);

    if !pdf_path.exists() {
        return Err(format!("PDF file does not exist: {}", request.pdf_path));
    }

    let repo_root = repo_root_from_current()?;
    let ai_engine = repo_root.join("evida-core").join("ai-engine");
    let worker = ai_engine.join("pdf_import_worker.py");
    let schema = ai_engine.join("db").join("schema.sql");

    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve app data dir: {error}"))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|error| format!("Could not create app data dir: {error}"))?;

    let db_path = data_dir.join("evida_documents.sqlite");

    let mut child = Command::new(python_command())
        .arg(worker)
        .arg("--pdf")
        .arg(pdf_path)
        .arg("--db")
        .arg(db_path)
        .arg("--schema")
        .arg(schema)
        .arg("--case-id")
        .arg(request.case_id)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not start PDF import worker: {error}"))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Could not capture PDF import stdout".to_string())?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Could not capture PDF import stderr".to_string())?;

    let app_for_stdout = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);

        for line in reader.lines().map_while(Result::ok) {
            match serde_json::from_str::<serde_json::Value>(&line) {
                Ok(event) => {
                    let _ = app_for_stdout.emit("pdf-import-progress", event);
                }
                Err(_) => {
                    let _ = app_for_stdout.emit(
                        "pdf-import-progress",
                        serde_json::json!({
                            "type": "worker_log",
                            "message": line
                        }),
                    );
                }
            }
        }
    });

    let app_for_stderr = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);

        for line in reader.lines().map_while(Result::ok) {
            let _ = app_for_stderr.emit(
                "pdf-import-progress",
                serde_json::json!({
                    "type": "worker_error",
                    "message": line
                }),
            );
        }
    });

    std::thread::spawn(move || {
        let _ = child.wait();
    });

    Ok(ImportStarted {
        ok: true,
        message: "PDF import started".to_string(),
    })
}
