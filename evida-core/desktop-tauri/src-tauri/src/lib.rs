mod audit;
mod commands;
mod crypto;
mod db;
mod db_key;
mod domain;
mod hash;
mod ingestion;

use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

const STARTUP_WINDOW_WIDTH: u32 = 1600;
const STARTUP_WINDOW_HEIGHT: u32 = 1040;
const STARTUP_MIN_WIDTH: u32 = 1200;
const STARTUP_MIN_HEIGHT: u32 = 820;
const WINDOW_MARGIN_X: u32 = 64;
const WINDOW_MARGIN_Y: u32 = 24;

fn apply_preferred_window_size(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };

    let work_area = monitor.work_area();
    let available_width = work_area.size.width.saturating_sub(WINDOW_MARGIN_X);
    let available_height = work_area.size.height.saturating_sub(WINDOW_MARGIN_Y);
    let min_width = STARTUP_MIN_WIDTH.min(available_width.max(1));
    let min_height = STARTUP_MIN_HEIGHT.min(available_height.max(1));
    let width = STARTUP_WINDOW_WIDTH.min(available_width).max(min_width);
    let height = STARTUP_WINDOW_HEIGHT.min(available_height).max(min_height);
    let x_offset = ((work_area.size.width as i32 - width as i32) / 2).max(0);
    let y_offset = ((work_area.size.height as i32 - height as i32) / 2).max(8);

    window.set_min_size(Some(Size::Physical(PhysicalSize::new(min_width, min_height))))?;
    window.set_size(Size::Physical(PhysicalSize::new(width, height)))?;
    window.set_position(Position::Physical(PhysicalPosition::new(
        work_area.position.x + x_offset,
        work_area.position.y + y_offset,
    )))?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = apply_preferred_window_size(&window);
            }
            Ok(())
        })
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
