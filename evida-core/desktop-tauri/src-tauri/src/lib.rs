mod audit;
mod commands;
mod crypto;
mod db;
mod db_key;
mod domain;
mod hash;
mod ingestion;
mod ingestion_core;

use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, WebviewWindow};

const STARTUP_MAX_WIDTH: u32 = 1840;
const STARTUP_MAX_HEIGHT: u32 = 1160;
const STARTUP_MIN_WIDTH: u32 = 1100;
const STARTUP_MIN_HEIGHT: u32 = 760;
const STARTUP_WIDTH_PERCENT: u32 = 92;
const STARTUP_HEIGHT_PERCENT: u32 = 90;
const WINDOW_MARGIN_X: u32 = 96;
const WINDOW_MARGIN_Y: u32 = 36;

fn apply_preferred_window_size(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.current_monitor()?.or(window.primary_monitor()?) else {
        return Ok(());
    };

    let work_area = monitor.work_area();
    let available_width = work_area.size.width.saturating_sub(WINDOW_MARGIN_X);
    let available_height = work_area.size.height.saturating_sub(WINDOW_MARGIN_Y);
    let min_width = STARTUP_MIN_WIDTH.min(available_width.max(1));
    let min_height = STARTUP_MIN_HEIGHT.min(available_height.max(1));
    let preferred_width = work_area.size.width.saturating_mul(STARTUP_WIDTH_PERCENT) / 100;
    let preferred_height = work_area.size.height.saturating_mul(STARTUP_HEIGHT_PERCENT) / 100;
    let width = preferred_width
        .min(STARTUP_MAX_WIDTH)
        .min(available_width)
        .max(min_width);
    let height = preferred_height
        .min(STARTUP_MAX_HEIGHT)
        .min(available_height)
        .max(min_height);
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
            commands::start_import_session,
            commands::complete_import_session,
            commands::pause_import_session,
            commands::resume_import_session,
            commands::cancel_import_session,
            commands::get_import_health,
            commands::list_import_items,
            commands::search_sources,
            commands::list_ocr_results,
            commands::run_ocr_for_import_item,
            commands::list_manual_review_items,
            commands::apply_manual_review_action,
            commands::refresh_evidence_quality,
            commands::export_evidence_quality_package,
            commands::remove_import_item_from_case,
            commands::register_document_in_session,
            commands::register_document,
            commands::choose_document_paths,
            commands::choose_document_folder_paths,
            commands::expand_import_paths,
            commands::reindex_case_documents,
            commands::get_case_coverage_audit,
            commands::get_document_engine_status,
            commands::list_documents,
            commands::list_audit_events,
            commands::verify_audit_chain,
            commands::list_source_objects,
            commands::reset_test_data,
            commands::open_local_data_folder,
            commands::open_original_folder,
            commands::export_diagnostics,
            commands::export_import_diagnostics,
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
