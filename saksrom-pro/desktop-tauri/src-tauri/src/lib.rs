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
            commands::register_document,
            commands::choose_document_paths,
            commands::list_documents,
            commands::list_audit_events,
            commands::list_source_objects
        ])
        .run(tauri::generate_context!())
        .expect("error while running Saksrom Pro desktop app");
}
