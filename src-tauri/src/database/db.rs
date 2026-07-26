use rusqlite::{Connection, Result};
use std::env;

pub fn get_connection() -> Result<Connection> {
    // 🛡️ Point the database to the OS Temp directory
    // to hide it from the Vite file watcher!
    let mut db_path = env::temp_dir();
    db_path.push("omni_memory.db");
    Connection::open(db_path)
}

pub fn init_schema() -> Result<()> {
    let conn = get_connection()?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS captures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_name TEXT NOT NULL,
            text_content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    Ok(())
}

pub fn insert_capture(app_name: &str, text_content: &str) -> Result<()> {
    let conn = get_connection()?;
    conn.execute(
        "INSERT INTO captures (app_name, text_content) VALUES (?1, ?2)",
        (app_name, text_content),
    )?;
    Ok(())
}
