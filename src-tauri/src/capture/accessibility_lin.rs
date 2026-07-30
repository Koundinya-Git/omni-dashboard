// src/capture/accessibility_lin.rs

use active_win_pos_rs::get_active_window;

pub fn capture_active_window() {
    match get_active_window() {
        Ok(window) => {
            println!("Active Window Title: {}", window.title);
            println!("App Name: {}", window.app_name);
        }
        Err(_) => {
            eprintln!("Failed to fetch active window info on Linux.");
        }
    }
}

pub async fn walk_ui_tree() -> Result<(), Box<dyn std::error::Error>> {
    use atspi::connection::AccessibilityConnection;

    let connection = AccessibilityConnection::new().await?;
    println!("Connected to AT-SPI Linux accessibility bus.");
    
    // Linux tree walking logic using AT-SPI
    Ok(())
}