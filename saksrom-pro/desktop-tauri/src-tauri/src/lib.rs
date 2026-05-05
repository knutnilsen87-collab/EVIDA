mod audit;
mod commands;
mod db;
mod domain;
mod hash;
mod ingestion;

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
            commands::list_source_objects,
            commands::reset_test_data,
            commands::open_local_data_folder,
            commands::export_diagnostics
        ])
        .run(tauri::generate_context!())
        .expect("error while running Saksrom Pro desktop app");
}
