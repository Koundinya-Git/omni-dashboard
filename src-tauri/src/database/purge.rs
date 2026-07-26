use super::db::get_connection;
use std::thread;
use std::time::Duration;

pub fn start_purge_loop() {
    println!("🧹 Memory manager online. 3-day rolling purge scheduled.");

    loop {
        if let Ok(conn) = get_connection() {
            // SQLite natively understands date math. We ask it to delete anything
            // where the timestamp is strictly older than 'now' minus 3 days.
            let rows_deleted = conn
                .execute(
                    "DELETE FROM captures WHERE timestamp <= datetime('now', '-3 days')",
                    [],
                )
                .unwrap_or(0);

            if rows_deleted > 0 {
                println!(
                    "🧹 AUTOMATED PURGE: Deleted {} old memories to save space.",
                    rows_deleted
                );
            }
        }

        // Sleep for exactly 1 hour (3600 seconds) before checking again
        thread::sleep(Duration::from_secs(3600));
    }
}
