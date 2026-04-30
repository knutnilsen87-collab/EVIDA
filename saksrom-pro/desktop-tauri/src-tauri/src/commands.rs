use crate::domain::{
    AuditEvent, CaseSummary, DocumentIngestionReport, DocumentSummary, SourceObjectSummary,
};
use std::path::Path;

#[tauri::command]
pub fn get_app_status() -> Result<String, String> {
    let db_path = crate::db::default_db_path().map_err(|error| error.to_string())?;
    Ok(format!("Lokal saksdatabase klar: {}", db_path.display()))
}

#[tauri::command]
pub fn create_case(name: String, jurisdiction: String) -> Result<CaseSummary, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::create_case(&conn, &name, &jurisdiction).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_cases() -> Result<Vec<CaseSummary>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_cases(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn register_document(case_id: String, path: String) -> Result<DocumentIngestionReport, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    let file_path = Path::new(&path);
    let original_name = file_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unknown-file")
        .to_string();

    let sha256 = crate::hash::sha256_file(file_path).map_err(|error| error.to_string())?;
    let extraction = crate::ingestion::extract_document(file_path).map_err(|error| error.to_string())?;

    crate::db::insert_document(
        &conn,
        &case_id,
        &original_name,
        &path,
        &sha256,
        &extraction,
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_documents(case_id: String) -> Result<Vec<DocumentSummary>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_documents(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_audit_events(case_id: Option<String>) -> Result<Vec<AuditEvent>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_audit_events(&conn, case_id.as_deref()).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_source_objects(case_id: String) -> Result<Vec<SourceObjectSummary>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_source_objects(&conn, &case_id).map_err(|error| error.to_string())
}
