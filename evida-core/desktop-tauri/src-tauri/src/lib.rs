mod audit;
mod commands;
mod crypto;
mod db;
mod db_key;
mod domain;
mod hash;
mod ingestion;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_app_status,
            commands::create_case,
            commands::rename_case,
            commands::set_case_number,
            commands::mark_case_opened,
            commands::get_setting,
            commands::set_setting,
            commands::list_settings,
            commands::open_new_case_window,
            commands::open_case_window,
            commands::set_current_window_title,
            commands::list_cases,
            commands::soft_delete_case,
            commands::register_document,
            commands::choose_document_paths,
            commands::reindex_case_documents,
            commands::get_case_coverage_audit,
            commands::get_document_engine_status,
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
            commands::list_case_ai_messages
        ])
        .run(tauri::generate_context!())
        .expect("error while running Evida desktop app");
}
