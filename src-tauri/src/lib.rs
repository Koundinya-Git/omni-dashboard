pub mod capture;
pub mod commands;
pub mod database;
pub mod orchestrator;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // --- NEW: Register our search command ---
        .invoke_handler(tauri::generate_handler![
            commands::search::get_recent_memories
        ])
        .setup(|_app| {
            database::init_database();
            orchestrator::start_orchestrator();
            capture::init_capture_system();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
