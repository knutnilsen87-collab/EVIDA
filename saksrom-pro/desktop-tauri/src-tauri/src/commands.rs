use crate::domain::{
    ArgumentItem, AuditEvent, CaseAiMessage, CaseSummary, ChronologyEvent,
    ContradictionItem, DatabaseSecurityStatus, DocumentIngestionReport, DocumentSummary,
    EvidenceItem, MaintenanceReport, ReindexReport, RiskItem, SourceObjectSummary, WorkItems,
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
pub fn soft_delete_case(case_id: String) -> Result<(), String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::soft_delete_case(&conn, &case_id).map_err(|error| error.to_string())
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
pub fn choose_document_paths() -> Result<Vec<String>, String> {
    let files = rfd::FileDialog::new()
        .set_title("Velg dokumenter")
        .add_filter(
            "Dokumenter",
            &["pdf", "txt", "md", "markdown", "png", "jpg", "jpeg", "tif", "tiff"],
        )
        .pick_files();

    Ok(files
        .unwrap_or_default()
        .into_iter()
        .map(|path| path.to_string_lossy().to_string())
        .collect())
}

#[tauri::command]
pub fn reindex_case_documents(case_id: String) -> Result<ReindexReport, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::reindex_case_documents(&conn, &case_id).map_err(|error| error.to_string())
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

#[tauri::command]
pub fn reset_test_data() -> Result<MaintenanceReport, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::reset_test_data(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn open_local_data_folder() -> Result<MaintenanceReport, String> {
    let path = crate::db::default_data_dir().map_err(|error| error.to_string())?;
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(MaintenanceReport {
        message: "Lokal datamappe åpnet.".to_string(),
        path: Some(path.display().to_string()),
        cases_deleted: None,
        documents_deleted: None,
        sources_deleted: None,
    })
}

#[tauri::command]
pub fn export_diagnostics() -> Result<MaintenanceReport, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::export_diagnostics(&conn).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_database_security_status() -> Result<DatabaseSecurityStatus, String> {
    crate::db::database_security_status().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_work_items(case_id: String) -> Result<WorkItems, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_work_items(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn build_chronology(case_id: String) -> Result<Vec<ChronologyEvent>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::build_chronology(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn build_evidence_matrix(case_id: String) -> Result<Vec<EvidenceItem>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::build_evidence_matrix(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn create_argument_item(case_id: String) -> Result<Vec<ArgumentItem>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::create_argument_item(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn find_contradictions(case_id: String) -> Result<Vec<ContradictionItem>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::find_contradictions(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn assess_risk(case_id: String) -> Result<Vec<RiskItem>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::assess_risk(&conn, &case_id).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn record_case_ai_exchange(
    case_id: String,
    question: String,
    answer_json: String,
    source_ids: Vec<String>,
    model_id: Option<String>,
    prompt_version: Option<String>,
    source_index_version: Option<String>,
) -> Result<CaseAiMessage, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::record_case_ai_exchange(
        &conn,
        &case_id,
        &question,
        &answer_json,
        &source_ids,
        model_id.as_deref(),
        prompt_version.as_deref(),
        source_index_version.as_deref(),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_case_ai_messages(case_id: String) -> Result<Vec<CaseAiMessage>, String> {
    let conn = crate::db::open_connection().map_err(|error| error.to_string())?;
    crate::db::list_case_ai_messages(&conn, &case_id).map_err(|error| error.to_string())
}
