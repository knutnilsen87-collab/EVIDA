mod audit;
mod commands;
mod crypto;
mod db;
mod db_key;
mod domain;
mod hash;
mod ingestion;
mod import;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_app_status,
            commands::create_case,
            commands::list_cases,
            commands::soft_delete_case,
            commands::register_document,
            commands::choose_document_paths,
            commands::reindex_case_documents,
            commands::list_documents,
            commands::list_audit_events,
            commands::verify_audit_chain,
            commands::list_source_objects,
            commands::reset_test_data,
            commands::open_local_data_folder,
            commands::export_diagnostics,
            commands::get_database_security_status,
            commands::list_work_items,
            commands::build_chronology,
            commands::build_evidence_matrix,
            commands::create_argument_item,
            commands::find_contradictions,
            commands::assess_risk,
            commands::ask_case_ai,
            commands::record_case_ai_exchange,
            commands::list_case_ai_messages,
            import::pdf_import::import_single_pdf,
            import::pdf_search::search_imported_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running Evida desktop app");
}
