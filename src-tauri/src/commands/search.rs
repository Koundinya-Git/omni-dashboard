use crate::database::db::get_connection;
use rusqlite::Result;
use serde::Serialize;

#[derive(Serialize)]
pub struct Memory {
    id: i32,
    app_name: String,
    text_content: String,
    timestamp: String,
}

#[tauri::command]
pub fn get_recent_memories() -> Result<Vec<Memory>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // Grab the 50 most recent captures
    let mut stmt = conn
        .prepare(
            "SELECT id, app_name, text_content, timestamp FROM captures ORDER BY id DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let memory_iter = stmt
        .query_map([], |row| {
            Ok(Memory {
                id: row.get(0)?,
                app_name: row.get(1)?,
                text_content: row.get(2)?,
                timestamp: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut memories = Vec::new();
    for memory in memory_iter {
        memories.push(memory.map_err(|e| e.to_string())?);
    }

    Ok(memories)
}
