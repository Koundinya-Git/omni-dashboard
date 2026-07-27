#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{params, Connection, Result as SqlResult};
use std::fs::File;
use std::io::BufReader;
use std::io::Write;
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use sysinfo::System;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, State,
};
use lopdf::Document;
use active_win_pos_rs::get_active_window;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use serde_json::json;

const CREATE_NO_WINDOW: u32 = 0x08000000;

// ==========================================
// 1. DATABASE SETUP & STATE
// ==========================================
// Shared application state that holds the SQLite connection for all database-backed commands.
pub struct DbState(pub Mutex<Connection>);

// Messages sent to the background audio thread so playback can be controlled remotely.
pub enum AudioCommand {
    Play(String),
    Stop,
}

// Shared state used by the text-to-speech subsystem to send playback commands.
pub struct AudioState(pub Mutex<Sender<AudioCommand>>);

// Initializes the SQLite database schema and seeds default settings values on startup.
fn init_db() -> SqlResult<Connection> {
    let conn = Connection::open("omni_core.db")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            quadrant INTEGER NOT NULL,
            completed INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            course_id TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            color TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            workspace_id TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL DEFAULT 'default_session',
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS focus_sessions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            timestamp INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            songs TEXT NOT NULL DEFAULT '[]',
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS offline_songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT NOT NULL,
            duration TEXT NOT NULL,
            local_path TEXT NOT NULL,
            thumbnail_url TEXT NOT NULL,
            source TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS textbooks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            course_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            total_pages INTEGER NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS textbook_pages (
            id TEXT PRIMARY KEY,
            textbook_id TEXT NOT NULL,
            page_number INTEGER NOT NULL,
            content TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS book_sets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS book_set_items (
            set_id TEXT NOT NULL,
            textbook_id TEXT NOT NULL,
            PRIMARY KEY (set_id, textbook_id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS calendar_events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            tags TEXT NOT NULL DEFAULT '[]',
            color TEXT NOT NULL DEFAULT '#3b82f6',
            is_all_day INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    // --- IMMUTABLE TELEMETRY TRACKING TABLES ---
    conn.execute(
        "CREATE TABLE IF NOT EXISTS immutable_telemetry (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            app_name TEXT NOT NULL,
            window_title TEXT NOT NULL,
            category TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS live_memory_summaries (
            id TEXT PRIMARY KEY,
            timestamp INTEGER NOT NULL,
            summary_text TEXT NOT NULL
        )",
        [],
    )?;

    let defaults = [
        ("user_name", "Commander"),
        (
            "user_bio",
            "A dedicated learner optimizing productivity and knowledge retention.",
        ),
        (
            "custom_instructions",
            "Be concise, helpful, and directly reference my notes or tasks when relevant.",
        ),
        ("web_search_api", "SearXNG"),
        ("tts_wpm", "200"),
    ];

    for (k, v) in defaults {
        let _ = conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        );
    }

    let _ = conn.execute(
        "ALTER TABLE chats ADD COLUMN session_id TEXT NOT NULL DEFAULT 'default_session'",
        [],
    );

    let _ = conn.execute(
        "ALTER TABLE focus_sessions ADD COLUMN title TEXT",
        [],
    );

    Ok(conn)
}

// Represents a single task row in the productivity matrix.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct TaskItem {
    pub id: String,
    pub title: String,
    pub quadrant: i32,
    pub completed: bool,
}

// Represents a saved note attached to a course or workspace.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct NoteItem {
    pub id: String,
    pub title: String,
    pub content: String,
    pub course_id: String,
}

// Represents a course or subject used to organize notes and textbooks.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct CourseItem {
    pub id: String,
    pub code: String,
    pub name: String,
    pub description: String,
    pub color: String,
}

// Represents a user-created workspace that groups related chat sessions.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WorkspaceItem {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}

// Represents an individual chat session in the main dashboard experience.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatSessionItem {
    pub id: String,
    pub title: String,
    pub workspace_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}

// Represents a single message inside a chat session.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatItem {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}

// Represents a completed or logged focus session tied to a task.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct FocusSessionItem {
    pub id: String,
    pub task_id: String,
    pub duration_minutes: i32,
    pub timestamp: i64,
    pub title: Option<String>,
}

// Stores the user preferences and assistant behavior settings used by the app.
#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct UserSettings {
    pub user_name: String,
    pub user_bio: String,
    pub custom_instructions: String,
    pub web_search_api: String,
    pub tts_wpm: String,
    pub default_focus_time: String,
    pub default_break_time: String,
}

// Describes a YouTube Music result that can be added to playlists or downloaded.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct YTMusicSong {
    pub videoId: String,
    pub title: String,
    pub artists: Vec<Artist>,
    pub thumbnails: Vec<Thumbnail>,
    pub duration: String,
}

// Small helper type used to represent an artist attached to a song result.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Artist {
    pub name: String,
}

// Small helper type used to hold a thumbnail URL for a song result.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Thumbnail {
    pub url: String,
}

// Represents a saved playlist containing a collection of music items.
#[derive(serde::Serialize, serde::Deserialize)]
pub struct PlaylistItem {
    pub id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub songs: Vec<YTMusicSong>,
    pub created_at: i64,
}

// Represents a song that is available locally on disk, either downloaded or imported.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct OfflineSongItem {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub duration: String,
    pub local_path: String,
    pub thumbnail_url: String,
    pub source: String, 
}

// Represents a textbook imported into the knowledge vault.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TextbookItem {
    pub id: String,
    pub title: String,
    pub author: String,
    pub course_id: String,
    pub file_path: String,
    pub total_pages: i32,
    pub created_at: i64,
}

// Describes a textbook attachment supplied with a user prompt, including page selection details.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TextbookAttachment {
    pub textbook_id: String,
    pub page_start: Option<i32>,
    pub page_end: Option<i32>,
    pub exact_snippet: Option<String>,
}

// Represents a collection of textbooks grouped into a study set.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct BookSetItem {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub textbook_ids: Vec<String>,
}

// Represents a calendar event persisted in the app database.
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct CalendarEventItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub start_time: i64,
    pub end_time: i64,
    pub event_type: String,
    pub tags: Vec<String>,
    pub color: String,
    pub is_all_day: bool,
}

// ==========================================
// 2. CONTEXT HYDRATION ENGINE
// ==========================================
// Loads the stored user settings from the database and returns them as a structured object.
fn get_user_settings_internal(conn: &Connection) -> UserSettings {
    let mut user_name = String::from("User");
    let mut user_bio = String::new();
    let mut custom_instructions = String::new();
    let mut web_search_api = String::from("SearXNG");
    let mut tts_wpm = String::from("200");
    let mut default_focus_time = String::from("25");
    let mut default_break_time = String::from("5");

    if let Ok(mut stmt) = conn.prepare("SELECT key, value FROM settings") {
        if let Ok(rows) = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }) {
            for r in rows.flatten() {
                match r.0.as_str() {
                    "user_name" => user_name = r.1,
                    "user_bio" => user_bio = r.1,
                    "custom_instructions" => custom_instructions = r.1,
                    "web_search_api" => web_search_api = r.1,
                    "tts_wpm" => tts_wpm = r.1,
                    "default_focus_time" => default_focus_time = r.1,
                    "default_break_time" => default_break_time = r.1,
                    _ => {}
                }
            }
        }
    }

    UserSettings {
        user_name,
        user_bio,
        custom_instructions,
        web_search_api,
        tts_wpm,
        default_focus_time,
        default_break_time,
    }
}

// Builds the rich database context that is injected into the LLM prompt.
fn build_db_context(conn: &Connection) -> String {
    let settings = get_user_settings_internal(conn);
    let mut context = String::from("\n\n=== OMNI-CORE SYSTEM CONTEXT & USER PROFILE ===\n");

    context.push_str(&format!("- PREFERRED USER NAME: {}\n", settings.user_name));
    if !settings.user_bio.is_empty() {
        context.push_str(&format!("- ABOUT THE USER: {}\n", settings.user_bio));
    }
    if !settings.custom_instructions.is_empty() {
        context.push_str(&format!(
            "- USER BEHAVIOR DIRECTIVES: {}\n",
            settings.custom_instructions
        ));
    }

    let current_time = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    let one_day_ms = 86_400_000;
    
    // LIVE MEMORY INJECTION (The Observer Effect)
    context.push_str("\n--- LIVE MEMORY CONTEXT (OBSERVER EFFECT) ---\n");
    let one_hour_ago = current_time - 3_600_000;
    if let Ok(mut stmt) = conn.prepare("SELECT app_name, window_title, category, COUNT(*) as time_spent FROM immutable_telemetry WHERE timestamp > ?1 GROUP BY window_title ORDER BY time_spent DESC LIMIT 5") {
        if let Ok(telemetry_iter) = stmt.query_map(params![one_hour_ago], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i32>(3)? * 10, // 10 seconds per heartbeat
            ))
        }) {
            let mut found = false;
            for t in telemetry_iter.flatten() {
                found = true;
                context.push_str(&format!("- [CATEGORY: {}] App: '{}', Title: '{}' (~{} seconds)\n", t.2, t.0, t.1, t.3));
            }
            if !found {
                context.push_str("- No system activity logged in the last hour.\n");
            } else {
                context.push_str("\nAI DIRECTIVE: Use this context to gently hold the user accountable. If they are distracted (e.g. YouTube, Social Media), push them to focus. If they have been in 'Deep Work' for a long time, suggest a break.\n");
            }
        }
    }

    context.push_str("\n--- TODAY's TIME-BLOCKING SCHEDULE & EVENTS ---\n");
    if let Ok(mut stmt) = conn.prepare("SELECT id, title, start_time, end_time, event_type FROM calendar_events WHERE start_time >= ?1 AND start_time < ?2 ORDER BY start_time ASC") {
        let mut found_events = false;
        if let Ok(event_iter) = stmt.query_map(params![current_time - one_day_ms, current_time + (one_day_ms * 2)], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, i64>(3)?,
                row.get::<_, String>(4)?
            ))
        }) {
            for e in event_iter.flatten() {
                found_events = true;
                context.push_str(&format!("- [ID: {} | TYPE: {}] {} (Epoch {} to {})\n", e.0, e.4, e.1, e.2, e.3));
            }
        }
        if !found_events {
             context.push_str("- Schedule is clear for today.\n");
        }
    }

    context.push_str("\n--- ACTIVE COURSES/SUBJECTS ---\n");
    if let Ok(mut stmt) = conn.prepare("SELECT id, code, name, description FROM courses") {
        if let Ok(course_iter) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        }) {
            for c in course_iter.flatten() {
                context.push_str(&format!("- [ID: {} | CODE: {}] {}: {}\n", c.0, c.1, c.2, c.3));
            }
        }
    }

    context.push_str("\n--- PRIORITY TASKS MATRIX ---\n");
    if let Ok(mut stmt) = conn.prepare("SELECT id, title, quadrant, completed FROM tasks") {
        if let Ok(task_iter) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i32>(2)?,
                row.get::<_, i32>(3)? != 0,
            ))
        }) {
            for t in task_iter.flatten() {
                let status = if t.3 { "Completed" } else { "Pending" };
                context.push_str(&format!("- [ID: {} | Quadrant {}] {} ({})\n", t.0, t.2, t.1, status));
            }
        }
    }

    context.push_str("\n--- KNOWLEDGE VAULT & CLASS NOTES ---\n");
    if let Ok(mut stmt) = conn.prepare(
        "SELECT n.id, n.title, n.content, c.code FROM notes n LEFT JOIN courses c ON n.course_id = c.id",
    ) {
        if let Ok(note_iter) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?
                    .unwrap_or_else(|| "Unassigned".to_string()),
            ))
        }) {
            for n in note_iter.flatten() {
                context.push_str(&format!(
                    "\n[ID: {} | NOTE TITLE: {} | TAGGED COURSE: {}]\n[CONTENT]:\n{}\n---\n",
                    n.0, n.1, n.3, n.2
                ));
            }
        }
    }

    context.push_str("\n================================================\n");
    context
}

// Pulls relevant textbook content into the prompt so questions about attached documents can be answered with context.
fn fetch_textbook_context(conn: &Connection, attachment: &TextbookAttachment, user_prompt: &str) -> String {
    let mut context = String::from("\n\n=== ATTACHED TEXTBOOK DOCUMENT CONTEXT ===\n");
    
    let mut title = String::from("Unknown Book");
    if let Ok(mut stmt) = conn.prepare("SELECT title FROM textbooks WHERE id = ?1") {
        if let Ok(mut rows) = stmt.query(params![attachment.textbook_id]) {
            if let Ok(Some(row)) = rows.next() {
                title = row.get::<_, String>(0).unwrap_or(title);
            }
        }
    }

    context.push_str(&format!("- ATTACHED DOCUMENT TITLE: {}\n", title));

    if let Some(snippet) = &attachment.exact_snippet {
        context.push_str("- USER SELECTED THE FOLLOWING EXACT TEXT SNIPPET:\n");
        context.push_str(&format!("\"{}\"\n\n", snippet));
        return context; 
    }

    let mut extracted_pages = false;
    if let (Some(start), Some(end)) = (attachment.page_start, attachment.page_end) {
        if let Ok(mut stmt) = conn.prepare("SELECT page_number, content FROM textbook_pages WHERE textbook_id = ?1 AND page_number >= ?2 AND page_number <= ?3 ORDER BY page_number ASC") {
            if let Ok(page_iter) = stmt.query_map(params![attachment.textbook_id, start, end], |row| {
                Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
            }) {
                for page in page_iter.flatten() {
                    context.push_str(&format!("\n[PAGE {} EXTRACT]:\n{}\n", page.0, page.1));
                    extracted_pages = true;
                }
            }
        }
    }

    if !extracted_pages {
        context.push_str("- FULL BOOK ATTACHED. RELEVANT EXTRACTS DYNAMICALLY RETRIEVED BASED ON USER QUERY:\n");

        let mut keywords = Vec::new();
        for word in user_prompt.split_whitespace() {
            let clean_word: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
            let clean_lower = clean_word.to_lowercase();
            if clean_lower.len() > 4 && clean_lower != "please" && clean_lower != "could" && clean_lower != "about" {
                keywords.push(clean_lower);
            }
        }

        let mut scored_pages: Vec<(i32, String, usize)> = Vec::new();
        if let Ok(mut stmt) = conn.prepare("SELECT page_number, content FROM textbook_pages WHERE textbook_id = ?1") {
            if let Ok(page_iter) = stmt.query_map(params![attachment.textbook_id], |row| {
                Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
            }) {
                for page in page_iter.flatten() {
                    let content_lower = page.1.to_lowercase();
                    let mut score = 0;
                    for kw in &keywords {
                        score += content_lower.matches(kw).count();
                    }
                    if score > 0 {
                        scored_pages.push((page.0, page.1, score));
                    }
                }
            }
        }

        scored_pages.sort_by(|a, b| b.2.cmp(&a.2));

        let mut took = 0;
        for page in scored_pages.iter().take(5) {
            context.push_str(&format!("\n[PAGE {} EXTRACT (Relevance Score: {})]:\n{}\n", page.0, page.2, page.1));
            took += 1;
        }

        if took == 0 {
             context.push_str("(No specific keywords matched. Showing first pages instead.)\n");
             if let Ok(mut stmt) = conn.prepare("SELECT page_number, content FROM textbook_pages WHERE textbook_id = ?1 ORDER BY page_number ASC LIMIT 3") {
                if let Ok(page_iter) = stmt.query_map(params![attachment.textbook_id], |row| {
                    Ok((row.get::<_, i32>(0)?, row.get::<_, String>(1)?))
                }) {
                    for page in page_iter.flatten() {
                        context.push_str(&format!("\n[PAGE {} EXTRACT]:\n{}\n", page.0, page.1));
                    }
                }
            }
        }
    }

    context.push_str("\nCRITICAL INSTRUCTION: If answering questions about this attached document, YOU MUST CITE SPECIFIC PAGE NUMBERS from the extracts provided above.\n================================================\n");
    context
}

// ==========================================
// 3. DATABASE COMMANDS
// ==========================================

// -----------------------------------------------------------------------------
// SETTINGS AND WORKSPACE MANAGEMENT COMMANDS
// -----------------------------------------------------------------------------
// This cluster of handlers is responsible for the app's lightweight configuration
// and organization layer. It allows the UI to read and write the user's profile
// preferences and to manage top-level workspaces that group related chats.
// These commands are intentionally small and direct because they sit right at the
// boundary between the frontend and the persistent SQLite store.

// Returns the current user preferences from the settings table.
// This is used by the dashboard whenever the UI needs to render the user's name,
// biography, assistant instructions, or default productivity settings.
#[tauri::command]
fn get_settings(db: State<'_, DbState>) -> Result<UserSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    Ok(get_user_settings_internal(&conn))
}

// Persists updated user preferences into the settings table.
// The frontend sends a fully populated UserSettings object and this function writes
// each field into the settings key/value table, replacing existing values when needed.
#[tauri::command]
fn save_settings(db: State<'_, DbState>, settings: UserSettings) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let pairs = [
        ("user_name", settings.user_name),
        ("user_bio", settings.user_bio),
        ("custom_instructions", settings.custom_instructions),
        ("web_search_api", settings.web_search_api),
        ("tts_wpm", settings.tts_wpm),
        ("default_focus_time", settings.default_focus_time),
        ("default_break_time", settings.default_break_time),
    ];

    for (k, v) in pairs {
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![k, v],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Fetches all workspaces from the database in creation order.
// Workspaces are the top-level containers for chat sessions and serve as a simple
// organizing structure for the dashboard experience.
#[tauri::command]
fn get_workspaces(db: State<'_, DbState>) -> Result<Vec<WorkspaceItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM workspaces ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(WorkspaceItem {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Creates a new workspace entry that can later contain chat sessions.
// The UI sends a generated identifier, a user-facing name, and a creation timestamp.
// This makes the workspace visible in the sidebar and ready to host nested conversations.
#[tauri::command]
fn create_workspace(
    db: State<'_, DbState>,
    id: String,
    name: String,
    created_at: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO workspaces (id, name, created_at) VALUES (?1, ?2, ?3)",
        params![id, name, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Renames an existing workspace using its identifier.
// This is a simple metadata update that keeps the workspace name aligned with the
// user's current mental model while preserving the rest of the record.
#[tauri::command]
fn rename_workspace(db: State<'_, DbState>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE workspaces SET name = ?1 WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a workspace and unassigns any chat sessions that belonged to it.
// Deleting a workspace should not erase the chat history entirely, so this function
// clears any lingering workspace references before removing the workspace row itself.
#[tauri::command]
fn delete_workspace(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE chat_sessions SET workspace_id = '' WHERE workspace_id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM workspaces WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// -----------------------------------------------------------------------------
// CHAT SESSION AND MESSAGE HANDLERS
// -----------------------------------------------------------------------------
// These commands form the persistence layer for the assistant conversation experience.
// They let the frontend create, rename, reorganize, and delete chat threads while
// also storing each message in a way that can be retrieved later for context building.

// Returns all chat sessions sorted by recency so the UI can render them quickly.
// The ordering is reversed by updated_at so the most recently active conversations
// appear first in the sidebar or workspace views.
#[tauri::command]
fn get_chat_sessions(db: State<'_, DbState>) -> Result<Vec<ChatSessionItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, workspace_id, created_at, updated_at FROM chat_sessions ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(ChatSessionItem {
                id: row.get(0)?,
                title: row.get(1)?,
                workspace_id: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Creates a new chat session and stores its initial metadata.
// This is typically called when the user starts a new conversation or creates a
// new workspace-backed thread for a specific task or topic.
#[tauri::command]
fn create_chat_session(
    db: State<'_, DbState>,
    id: String,
    title: String,
    workspace_id: String,
    timestamp: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO chat_sessions (id, title, workspace_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
        params![id, title, workspace_id, timestamp],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Updates the title of a chat session after a user renames it.
// This keeps the visible chat label aligned with the user's intent without changing
// the underlying conversation history or identity.
#[tauri::command]
fn rename_chat_session(db: State<'_, DbState>, id: String, title: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE chat_sessions SET title = ?1 WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Reassigns a chat session to a different workspace.
// This is useful when a conversation evolves from one context into another and the
// UI needs to regroup it under a new top-level bucket.
#[tauri::command]
fn move_session_to_workspace(
    db: State<'_, DbState>,
    id: String,
    workspace_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE chat_sessions SET workspace_id = ?1 WHERE id = ?2",
        params![workspace_id, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Deletes all messages and the session record belonging to a chat session.
// This is a destructive action for a conversation thread, so it removes the nested
// message rows first and then deletes the parent session row.
#[tauri::command]
fn delete_chat_session(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chats WHERE session_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Retrieves every chat message for a specific session in chronological order.
// The frontend depends on this to rebuild the conversation history exactly as the user
// saw it, including the natural order of turns.
#[tauri::command]
fn get_chats_by_session(
    db: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<ChatItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, session_id, role, content, timestamp FROM chats WHERE session_id = ?1 ORDER BY timestamp ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![session_id], |row| {
            Ok(ChatItem {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Saves a new chat message and refreshes the session's updated timestamp.
// This acts as the write path for the assistant UI and is used whenever the user or
// model adds a new turn to an ongoing conversation.
#[tauri::command]
fn save_chat(
    db: State<'_, DbState>,
    id: String,
    session_id: String,
    role: String,
    content: String,
    timestamp: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO chats (id, session_id, role, content, timestamp) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, session_id, role, content, timestamp],
    )
    .map_err(|e| e.to_string())?;

    let _ = conn.execute(
        "UPDATE chat_sessions SET updated_at = ?1 WHERE id = ?2",
        params![timestamp, session_id],
    );

    Ok(())
}

// Removes all messages from a session while preserving the session metadata.
// This is useful for clearing a conversation without deleting the thread itself.
#[tauri::command]
fn clear_chats_by_session(db: State<'_, DbState>, session_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM chats WHERE session_id = ?1",
        params![session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// -----------------------------------------------------------------------------
// TASKS, NOTES, AND COURSE-ORGANIZATION HANDLERS
// -----------------------------------------------------------------------------
// These functions power the productivity matrix and the knowledge vault. They let the
// frontend create, query, and delete tasks, notes, and academic subjects while keeping
// the data in a predictable SQLite shape that the assistant can reason about later.

// Returns all tasks so the task matrix can be rendered in the UI.
// The task list is read as a complete set so the dashboard can display the four-quadrant
// matrix without needing any additional aggregation logic.
#[tauri::command]
fn get_tasks(db: State<'_, DbState>) -> Result<Vec<TaskItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, quadrant, completed FROM tasks")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(TaskItem {
                id: row.get(0)?,
                title: row.get(1)?,
                quadrant: row.get(2)?,
                completed: row.get::<_, i32>(3)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for t in iter.flatten() {
        tasks.push(t);
    }
    Ok(tasks)
}

// Inserts a new task into the priority matrix.
// Each added task receives a unique identifier and a quadrant value so the UI can place
// it into the correct urgency/importance bucket immediately.
#[tauri::command]
fn add_task(
    db: State<'_, DbState>,
    id: String,
    title: String,
    quadrant: i32,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (id, title, quadrant, completed) VALUES (?1, ?2, ?3, 0)",
        params![id, title, quadrant],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a task from the database by its identifier.
// This is a direct delete operation that lets the UI clear completed or abandoned tasks.
#[tauri::command]
fn delete_task(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Returns all saved notes for the knowledge vault view.
// Notes are retrieved as a complete collection so the frontend can display them in a
// searchable, inspectable, and editable workspace.
#[tauri::command]
fn get_notes(db: State<'_, DbState>) -> Result<Vec<NoteItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, content, course_id FROM notes")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(NoteItem {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                course_id: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notes = Vec::new();
    for n in iter.flatten() {
        notes.push(n);
    }
    Ok(notes)
}

// Stores a note, inserting it or updating it if it already exists.
// This is the write pathway for the note-taking experience and uses UPSERT semantics
// so editing a note does not create duplicate records.
#[tauri::command]
fn save_note(
    db: State<'_, DbState>,
    id: String,
    title: String,
    content: String,
    course_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO notes (id, title, content, course_id) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, content=excluded.content, course_id=excluded.course_id",
        params![id, title, content, course_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Deletes a note by its unique identifier.
// This keeps the knowledge vault tidy when a note is archived or no longer relevant.
#[tauri::command]
fn delete_note(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Returns all courses or subjects so the UI can display them in the study dashboard.
// Courses act as the organizational umbrella for notes, textbooks, and related study assets.
#[tauri::command]
fn get_courses(db: State<'_, DbState>) -> Result<Vec<CourseItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, code, name, description, color FROM courses")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(CourseItem {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                color: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut courses = Vec::new();
    for c in iter.flatten() {
        courses.push(c);
    }
    Ok(courses)
}

// Creates a new course or subject entry in the study dashboard.
// This helps the user organize notes and textbooks around academic categories such as
// math, biology, or software engineering.
#[tauri::command]
fn add_course(
    db: State<'_, DbState>,
    id: String,
    code: String,
    name: String,
    description: String,
    color: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO courses (id, code, name, description, color) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, code, name, description, color],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a course record and its associated study assets from the local database.
// In practice this is a lightweight delete route that lets the UI clean up an entire subject.
#[tauri::command]
fn delete_course(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM courses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// -----------------------------------------------------------------------------
// FOCUS TRACKING AND PLAYLIST MANAGEMENT HANDLERS
// -----------------------------------------------------------------------------
// These commands bridge the productivity and leisure features of the app. They store
// focus-session history for the stats dashboard and keep playlist collections updated
// so the music experience can be controlled from the same local database.

// Records a completed focus session and optionally marks its linked task as done.
// This is the write path for the focus timer experience and helps the app convert a
// completed work block into a durable record that can be summarized later.
#[tauri::command]
fn log_focus_session(
    db: State<'_, DbState>,
    id: String,
    task_id: String,
    duration_minutes: i32,
    timestamp: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO focus_sessions (id, task_id, duration_minutes, timestamp) VALUES (?1, ?2, ?3, ?4)",
        params![id, task_id, duration_minutes, timestamp],
    )
    .map_err(|e| e.to_string())?;

    if !task_id.is_empty() {
        let _ = conn.execute(
            "UPDATE tasks SET completed = 1 WHERE id = ?1",
            params![task_id],
        );
    }

    Ok(())
}

// Returns logged focus-session history for stats and productivity dashboards.
// The UI uses this to render streaks, time spent in work blocks, and task completion
// patterns over time.
#[tauri::command]
fn get_focus_sessions(db: State<'_, DbState>) -> Result<Vec<FocusSessionItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, task_id, duration_minutes, timestamp, title FROM focus_sessions ORDER BY timestamp DESC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(FocusSessionItem {
                id: row.get(0)?,
                task_id: row.get(1)?,
                duration_minutes: row.get(2)?,
                timestamp: row.get(3)?,
                title: row.get(4).unwrap_or(None),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Updates the title associated with a focus session entry.
// This lets the user attach a more descriptive name to a completed block after the fact.
#[tauri::command]
fn rename_focus_session(db: State<'_, DbState>, id: String, title: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE focus_sessions SET title = ?1 WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a single focus-session log entry from the database.
// This is useful when a session is accidentally logged or the user wants to clean up history.
#[tauri::command]
fn delete_focus_session(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM focus_sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// --- PLAYLIST COMMANDS ---
// Retrieves playlists and their serialized music content from storage.
// Playlists are stored as JSON blobs inside SQLite so the frontend can work with them
// as structured objects without needing a separate document store.
#[tauri::command]
fn get_playlists(db: State<'_, DbState>) -> Result<Vec<PlaylistItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, tags, songs, created_at FROM playlists ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            let tags_str: String = row.get(2)?;
            let songs_str: String = row.get(3)?;
            Ok(PlaylistItem {
                id: row.get(0)?,
                name: row.get(1)?,
                tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                songs: serde_json::from_str(&songs_str).unwrap_or_default(),
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Creates a new playlist entry and stores its initial tag metadata.
// This initializes the playlist record with an empty song array and a set of user-defined tags.
#[tauri::command]
fn create_playlist(
    db: State<'_, DbState>,
    id: String,
    name: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tags_str = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    conn.execute(
        "INSERT INTO playlists (id, name, tags, songs, created_at) VALUES (?1, ?2, ?3, '[]', ?4)",
        params![id, name, tags_str, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Renames an existing playlist.
// This is a straightforward metadata update that keeps the playlist's identity while
// adjusting the human-readable label.
#[tauri::command]
fn rename_playlist(db: State<'_, DbState>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE playlists SET name = ?1 WHERE id = ?2",
        params![name, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a playlist and its stored playlist metadata.
// Deleting a playlist also removes the record that housed its tags and songs.
#[tauri::command]
fn delete_playlist(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Updates the tags attached to a playlist for organization and filtering.
// This allows the UI to classify playlists by mood, study mode, background, or favorite.
#[tauri::command]
fn update_playlist_tags(
    db: State<'_, DbState>,
    id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tags_str = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE playlists SET tags = ?1 WHERE id = ?2",
        params![tags_str, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Adds a music result to a playlist if it is not already present.
// This prevents duplicate songs from appearing in the same playlist and keeps the JSON
// payload compact and predictable.
#[tauri::command]
fn add_song_to_playlist(
    db: State<'_, DbState>,
    playlist_id: String,
    song: YTMusicSong,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let songs_str: String = conn
        .query_row(
            "SELECT songs FROM playlists WHERE id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut songs: Vec<YTMusicSong> = serde_json::from_str(&songs_str).unwrap_or_default();

    if !songs.iter().any(|s| s.videoId == song.videoId) {
        songs.push(song);
        let new_songs_str = serde_json::to_string(&songs).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE playlists SET songs = ?1 WHERE id = ?2",
            params![new_songs_str, playlist_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// Removes a specific song from a playlist by matching its YouTube video id.
// This is the delete path for playlist membership and keeps the saved JSON collection in sync.
#[tauri::command]
fn remove_song_from_playlist(
    db: State<'_, DbState>,
    playlist_id: String,
    video_id: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let songs_str: String = conn
        .query_row(
            "SELECT songs FROM playlists WHERE id = ?1",
            params![playlist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut songs: Vec<YTMusicSong> = serde_json::from_str(&songs_str).unwrap_or_default();
    songs.retain(|s| s.videoId != video_id);

    let new_songs_str = serde_json::to_string(&songs).unwrap_or_else(|_| "[]".to_string());
    conn.execute(
        "UPDATE playlists SET songs = ?1 WHERE id = ?2",
        params![new_songs_str, playlist_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// -----------------------------------------------------------------------------
// YOUTUBE MUSIC AND OFFLINE AUDIO HANDLERS
// -----------------------------------------------------------------------------
// These commands connect the app's music experience to external media discovery and
// the local cache of downloaded songs. They let the UI search YouTube Music, resolve
// stream URLs, download audio into the app data directory, and later replay those files.

// Queries yt-dlp for music search results and returns them as JSON text for the frontend.
// The function shells out to yt-dlp with a special search query format so the UI receives
// a compact list of music results that it can display in a searchable picker.
#[tauri::command]
async fn search_yt_music(query: String) -> Result<String, String> {
    let search_query = format!("ytsearch5:{}", query);

    let output = std::process::Command::new("yt-dlp")
        .args(&[
            &search_query,
            "--dump-json",
            "--no-playlist",
            "--flat-playlist",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut results: Vec<YTMusicSong> = Vec::new();

    for line in stdout.lines() {
        if line.trim().is_empty() {
            continue;
        }
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(line) {
            let video_id = v["id"].as_str().unwrap_or("").to_string();
            let title = v["title"].as_str().unwrap_or("Unknown Title").to_string();
            let uploader = v["uploader"]
                .as_str()
                .unwrap_or("Unknown Artist")
                .to_string();

            let duration_sec = v["duration"].as_f64().unwrap_or(0.0) as i64;
            let duration = format!("{}:{:02}", duration_sec / 60, duration_sec % 60);

            let mut thumbnails = Vec::new();
            if let Some(thumbs) = v["thumbnails"].as_array() {
                if let Some(thumb) = thumbs.last() {
                    if let Some(url) = thumb["url"].as_str() {
                        thumbnails.push(Thumbnail {
                            url: url.to_string(),
                        });
                    }
                }
            }
            if thumbnails.is_empty() {
                let default_thumb_host = "img.youtube.com";
                thumbnails.push(Thumbnail {
                    url: format!("https://{}/vi/{}/default.jpg", default_thumb_host, video_id),
                });
            }

            results.push(YTMusicSong {
                videoId: video_id,
                title,
                artists: vec![Artist { name: uploader }],
                thumbnails,
                duration,
            });
        }
    }
    serde_json::to_string(&results).map_err(|e| e.to_string())
}

// Resolves a direct audio stream URL for a YouTube Music video id.
// The frontend can call this to obtain a real stream source for playback or for later
// download into the offline cache.
#[tauri::command]
async fn get_yt_audio_url(video_id: String) -> Result<String, String> {
    let yt_host = "music.youtube.com";
    let audio_url = format!("https://{}/watch?v={}", yt_host, video_id);
    
    let mut cmd = std::process::Command::new("yt-dlp");
    cmd.args(&["-f", "bestaudio", "-g", &audio_url]);
    cmd.creation_flags(CREATE_NO_WINDOW);

    let output = cmd.output().map_err(|e| format!("Failed: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

// --- OFFLINE MUSIC & DOWNLOAD COMMANDS ---
// Downloads a YouTube Music song to the app data directory and stores a local record.
// This turns an online media result into a persisted, replayable asset that lives within
// the user's local app data folder.
#[tauri::command]
async fn download_yt_song(
    app: tauri::AppHandle, 
    db: State<'_, DbState>, 
    video_id: String, 
    title: String, 
    artist: String, 
    duration: String, 
    thumbnail_url: String
) -> Result<OfflineSongItem, String> {
    let app_data = app.path().app_data_dir().map_err(|e| format!("Path error: {}", e))?;
    let music_dir = app_data.join("music_cache");
    std::fs::create_dir_all(&music_dir).map_err(|e| e.to_string())?;
    
    let file_path = music_dir.join(format!("{}.mp3", video_id));
    
    let yt_host = "music.youtube.com";
    let dl_url = format!("https://{}/watch?v={}", yt_host, video_id);
    
    let output = std::process::Command::new("yt-dlp")
        .args(&[
            "-x", 
            "--audio-format", "mp3", 
            "-o", &file_path.to_string_lossy(), 
            &dl_url
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;
        
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }
    
    let new_song = OfflineSongItem {
        id: video_id.clone(),
        title,
        artist,
        duration,
        local_path: file_path.to_string_lossy().to_string(), 
        thumbnail_url,
        source: "youtube".to_string(),
    };
    
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO offline_songs (id, title, artist, duration, local_path, thumbnail_url, source) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![new_song.id, new_song.title, new_song.artist, new_song.duration, new_song.local_path, new_song.thumbnail_url, new_song.source],
    ).map_err(|e| e.to_string())?;
    
    Ok(new_song)
}

// Adds a local audio file to the app's offline music library.
// This is used when the user already has a local audio asset and wants to make it
// available inside the app's library without going through the downloader.
#[tauri::command]
fn add_local_song(
    db: State<'_, DbState>, 
    file_path: String, 
    title: String, 
    artist: String
) -> Result<OfflineSongItem, String> {
    let id = format!("local_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    
    let new_song = OfflineSongItem {
        id: id.clone(),
        title,
        artist,
        duration: "--:--".to_string(), 
        local_path: file_path.clone(),
        thumbnail_url: "".to_string(), 
        source: "local".to_string(),
    };
    
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO offline_songs (id, title, artist, duration, local_path, thumbnail_url, source) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![new_song.id, new_song.title, new_song.artist, new_song.duration, new_song.local_path, new_song.thumbnail_url, new_song.source],
    ).map_err(|e| e.to_string())?;
    
    Ok(new_song)
}

// Returns all offline songs available to the music player.
// The UI uses this to populate the local library and make downloaded or imported audio
// files available for playback.
#[tauri::command]
fn get_offline_songs(db: State<'_, DbState>) -> Result<Vec<OfflineSongItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, artist, duration, local_path, thumbnail_url, source FROM offline_songs ORDER BY title ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(OfflineSongItem {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                duration: row.get(3)?,
                local_path: row.get(4)?,
                thumbnail_url: row.get(5)?,
                source: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Deletes an offline song record and optionally removes the backing audio file.
// This gives the UI a way to prune items from the local library and optionally delete the
// underlying audio file from disk as well.
#[tauri::command]
fn delete_offline_song(db: State<'_, DbState>, id: String, remove_file: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    if remove_file {
        if let Ok(mut stmt) = conn.prepare("SELECT local_path FROM offline_songs WHERE id = ?1") {
            if let Ok(mut rows) = stmt.query(params![id]) {
                if let Ok(Some(row)) = rows.next() {
                    let path: String = row.get(0).unwrap_or_default();
                    let _ = std::fs::remove_file(path); 
                }
            }
        }
    }

    conn.execute("DELETE FROM offline_songs WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// -----------------------------------------------------------------------------
// TEXTBOOKS, BOOK SETS, AND CALENDAR HANDLERS
// -----------------------------------------------------------------------------
// These commands form the study and scheduling layer of the app. They import academic
// materials, keep them indexed for assistant context, and persist calendar events so the
// dashboard can present both workload and time-block information to the user.

// Imports a PDF textbook, extracts its text into the database, and stores metadata.
// This is one of the more complex persistence flows because it must read the PDF file,
// iterate through its pages, and convert each page into a searchable row in the database.
#[tauri::command]
async fn import_pdf_textbook(
    db: State<'_, DbState>,
    file_path: String,
    title: String,
    author: String,
    course_id: String,
) -> Result<TextbookItem, String> {
    let doc = Document::load(&file_path).map_err(|e| format!("Failed to read PDF: {}", e))?;
    let total_pages = doc.get_pages().len() as i32;
    
    let id = format!("book_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis());
    let created_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO textbooks (id, title, author, course_id, file_path, total_pages, created_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, title, author, course_id, file_path, total_pages, created_at],
    ).map_err(|e| e.to_string())?;
    
    for (page_num, _) in doc.get_pages() {
        let text = doc.extract_text(&[page_num]).unwrap_or_default();
        let clean_text = text.trim();
        
        if !clean_text.is_empty() {
             let page_row_id = format!("{}_p{}", id, page_num);
             let _ = conn.execute(
                "INSERT INTO textbook_pages (id, textbook_id, page_number, content) VALUES (?1, ?2, ?3, ?4)",
                params![page_row_id, id, page_num, clean_text],
             );
        }
    }

    Ok(TextbookItem {
        id,
        title,
        author,
        course_id,
        file_path,
        total_pages,
        created_at,
    })
}

// Returns all imported textbooks for display in the study dashboard.
// This provides the UI with the metadata it needs while the assistant separately uses the
// page-level stored content to answer questions about attached documents.
#[tauri::command]
fn get_textbooks(db: State<'_, DbState>) -> Result<Vec<TextbookItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, author, course_id, file_path, total_pages, created_at FROM textbooks ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(TextbookItem {
                id: row.get(0)?,
                title: row.get(1)?,
                author: row.get(2)?,
                course_id: row.get(3)?,
                file_path: row.get(4)?,
                total_pages: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// Renames a textbook entry.
// This updates the visible label without touching the extracted text or file metadata.
#[tauri::command]
fn rename_textbook(db: State<'_, DbState>, id: String, title: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE textbooks SET title = ?1 WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Reassigns a textbook to a different course or subject.
// This is a lightweight metadata operation that keeps the study dashboard consistent.
#[tauri::command]
fn update_textbook_course(db: State<'_, DbState>, id: String, course_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE textbooks SET course_id = ?1 WHERE id = ?2",
        params![course_id, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Deletes a textbook and all of its extracted pages and set associations.
// The cleanup is intentionally broad so that removing an imported book does not leave
// stale page rows or book-set links behind.
#[tauri::command]
fn delete_textbook(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM textbook_pages WHERE textbook_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_set_items WHERE textbook_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM textbooks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// --- BOOK SET MANAGEMENT COMMANDS ---
// Returns book sets along with the textbook ids attached to each set.
// This gives the UI an easy way to render grouped study bundles without needing to query
// multiple tables separately for each display operation.
#[tauri::command]
fn get_book_sets(db: State<'_, DbState>) -> Result<Vec<BookSetItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare("SELECT id, name, created_at FROM book_sets ORDER BY created_at ASC").map_err(|e| e.to_string())?;
    let mut sets = Vec::new();

    let iter = stmt.query_map([], |row| {
        Ok(BookSetItem {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
            textbook_ids: Vec::new(),
        })
    }).map_err(|e| e.to_string())?;

    for mut set in iter.flatten() {
        let mut inner_stmt = conn.prepare("SELECT textbook_id FROM book_set_items WHERE set_id = ?1").map_err(|e| e.to_string())?;
        let id_iter = inner_stmt.query_map(params![set.id], |r| r.get(0)).map_err(|e| e.to_string())?;
        for tb_id in id_iter.flatten() {
            set.textbook_ids.push(tb_id);
        }
        sets.push(set);
    }

    Ok(sets)
}

// Creates a named collection of textbooks for grouped study workflows.
// Book sets are a simple way to group several imported PDFs into a single study bundle.
#[tauri::command]
fn create_book_set(db: State<'_, DbState>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let created_at = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis() as i64;
    conn.execute(
        "INSERT INTO book_sets (id, name, created_at) VALUES (?1, ?2, ?3)",
        params![id, name, created_at],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// Renames a study book set.
// This updates the displayed label while keeping the underlying set membership intact.
#[tauri::command]
fn rename_book_set(db: State<'_, DbState>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE book_sets SET name = ?1 WHERE id = ?2",
        params![name, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a book set and all of its membership links.
// This cleans up both the top-level set row and the junction rows that link it to books.
#[tauri::command]
fn delete_book_set(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_set_items WHERE set_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_sets WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// Adds a textbook to a named book set.
// This is the join operation that links a textbook to a study bundle.
#[tauri::command]
fn add_book_to_set(db: State<'_, DbState>, set_id: String, textbook_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO book_set_items (set_id, textbook_id) VALUES (?1, ?2)",
        params![set_id, textbook_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// Removes a textbook from a book set.
// This is the inverse of the add operation and keeps the link table from accumulating stale entries.
#[tauri::command]
fn remove_book_from_set(db: State<'_, DbState>, set_id: String, textbook_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM book_set_items WHERE set_id = ?1 AND textbook_id = ?2",
        params![set_id, textbook_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// --- ADVANCED CALENDAR COMMANDS ---
// Inserts a calendar event into the local schedule database.
// Calendar events are written as structured records so the UI can render time blocks,
// reminders, and appointments with the correct metadata.
#[tauri::command]
fn add_calendar_event(
    db: State<'_, DbState>,
    id: String,
    title: String,
    description: String,
    start_time: i64,
    end_time: i64,
    event_type: String,
    tags: Vec<String>,
    color: String,
    is_all_day: bool,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tags_str = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    
    let all_day_int = if is_all_day { 1 } else { 0 };
    
    conn.execute(
        "INSERT INTO calendar_events (id, title, description, start_time, end_time, event_type, tags, color, is_all_day) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, title, description, start_time, end_time, event_type, tags_str, color, all_day_int],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// Updates an existing calendar event with revised metadata.
// This is the edit path for schedule changes and preserves the event's identity while
// replacing its underlying time and description fields.
#[tauri::command]
fn update_calendar_event(
    db: State<'_, DbState>,
    id: String,
    title: String,
    description: String,
    start_time: i64,
    end_time: i64,
    event_type: String,
    tags: Vec<String>,
    color: String,
    is_all_day: bool,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let tags_str = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    
    let all_day_int = if is_all_day { 1 } else { 0 };
    
    conn.execute(
        "UPDATE calendar_events 
         SET title = ?1, description = ?2, start_time = ?3, end_time = ?4, event_type = ?5, tags = ?6, color = ?7, is_all_day = ?8 
         WHERE id = ?9",
        params![title, description, start_time, end_time, event_type, tags_str, color, all_day_int, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// Deletes a calendar event by id.
// This removes one scheduled item from the store without touching unrelated events.
#[tauri::command]
fn delete_calendar_event(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}

// Retrieves all events that overlap a requested time range for the UI calendar.
// The query is intentionally range-based so the frontend can request the visible window of
// time and receive every relevant event in a single response.
#[tauri::command]
fn get_calendar_events_in_range(db: State<'_, DbState>, start: i64, end: i64) -> Result<Vec<CalendarEventItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, description, start_time, end_time, event_type, tags, color, is_all_day 
                  FROM calendar_events 
                  WHERE start_time < ?1 AND end_time > ?2 
                  ORDER BY start_time ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![end, start], |row| {
            let tags_str: String = row.get(6)?;
            Ok(CalendarEventItem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                event_type: row.get(5)?,
                tags: serde_json::from_str(&tags_str).unwrap_or_default(),
                color: row.get(7)?,
                is_all_day: row.get::<_, i32>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

// ==========================================
// 4. TELEMETRY & ACTIVE WINDOW LOGIC
// ==========================================
// Returns the currently focused window and its metadata for telemetry and focus analysis.
#[tauri::command]
fn get_active_app_telemetry() -> Result<serde_json::Value, String> {
    match get_active_window() {
        Ok(window) => Ok(json!({
            "status": "online",
            "app_name": window.app_name,
            "title": window.title,
            "process_id": window.process_id,
            "x": window.position.x,
            "y": window.position.y,
            "width": window.position.width,
            "height": window.position.height,
        })),
        Err(_) => Ok(json!({
            "status": "idle",
            "app_name": "Unknown / Desktop",
            "title": "System Idle",
            "process_id": 0,
            "x": 0,
            "y": 0,
            "width": 0,
            "height": 0,
        })),
    }
}

// -------------------------------------------------------------------------------------------------
// NEW: THE OBSERVER EFFECT AGGREGATION PIPELINE
// This command executes complex SQLite mathematical heuristics, returning daily and weekly logs
// so the frontend can natively build the Deep Work vs. Distraction graphs and the app's focus dashboard.
// The function intentionally computes a high-level summary from the immutable telemetry table instead of
// returning raw rows, because the UI needs a compact, predictable payload that is easy to render and reason about.
// -------------------------------------------------------------------------------------------------
#[tauri::command]
fn get_telemetry_stats(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    
    // 1. TODAY'S AGGREGATED STATS (Categorical split)
    // This first query summarizes the current day's activity by category such as Deep Work, Research,
    // Leisure, Distraction, and Neutral. The time values are multiplied by 10 because the telemetry loop
    // logs one heartbeat every 10 seconds, so the UI can display the totals in a more human-friendly seconds format.
    let mut today_stmt = conn.prepare("
        SELECT category, COUNT(*) * 10 as time_spent 
        FROM immutable_telemetry 
        WHERE date(timestamp / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
        GROUP BY category
    ").map_err(|e| e.to_string())?;

    let today_iter = today_stmt.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i32>(1)?))
    }).map_err(|e| e.to_string())?;

    let mut today_stats = serde_json::Map::new();
    // Initialize defaults so the frontend always has keys to render, even if a category has no recorded data.
    // This makes the charting logic simpler and prevents empty states from causing UI inconsistencies.
    today_stats.insert("Deep Work".to_string(), serde_json::json!(0));
    today_stats.insert("Research".to_string(), serde_json::json!(0));
    today_stats.insert("Leisure".to_string(), serde_json::json!(0));
    today_stats.insert("Distraction".to_string(), serde_json::json!(0));
    today_stats.insert("Neutral".to_string(), serde_json::json!(0));

    for item in today_iter.flatten() {
        today_stats.insert(item.0, serde_json::json!(item.1));
    }

    // 2. TODAY'S TOP APPS (For the granular breakdown)
    // This section builds the detail view for the dashboard by identifying which applications dominated the day's activity.
    // It groups rows by application name and category so the frontend can highlight the biggest contributors to focus or distraction.
    let mut apps_stmt = conn.prepare("
        SELECT app_name, category, COUNT(*) * 10 as time_spent
        FROM immutable_telemetry
        WHERE date(timestamp / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
        GROUP BY app_name, category
        ORDER BY time_spent DESC
        LIMIT 5
    ").map_err(|e| e.to_string())?;

    let apps_iter = apps_stmt.query_map([], |row| {
        Ok(serde_json::json!({
            "app_name": row.get::<_, String>(0)?,
            "category": row.get::<_, String>(1)?,
            "time_spent": row.get::<_, i32>(2)?
        }))
    }).map_err(|e| e.to_string())?;

    let mut top_apps = Vec::new();
    for item in apps_iter.flatten() {
        top_apps.push(item);
    }

    // 3. HISTORICAL STATS (Last 7 Days Rolling Window)
    // The historical portion creates a rolling window of the past seven days so the UI can visualize
    // how the user's work habits changed over time. The query groups activity by calendar date and category,
    // producing a compact trend dataset that can be rendered as a line or bar chart.
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    let seven_days_ago = now - (7 * 86_400_000); // 7 days in milliseconds

    let mut hist_stmt = conn.prepare("
        SELECT 
            date(timestamp / 1000, 'unixepoch', 'localtime') as log_date,
            category,
            COUNT(*) * 10 as time_spent
        FROM immutable_telemetry
        WHERE timestamp >= ?1
        GROUP BY log_date, category
        ORDER BY log_date ASC
    ").map_err(|e| e.to_string())?;

    let hist_iter = hist_stmt.query_map(params![seven_days_ago], |row| {
        Ok((
            row.get::<_, String>(0)?, 
            row.get::<_, String>(1)?, 
            row.get::<_, i32>(2)?
        ))
    }).map_err(|e| e.to_string())?;

    let mut hist_map: std::collections::BTreeMap<String, serde_json::Map<String, serde_json::Value>> = std::collections::BTreeMap::new();
    
    for item in hist_iter.flatten() {
        let date = item.0;
        let category = item.1;
        let time_spent = item.2;
        
        let entry = hist_map.entry(date.clone()).or_insert_with(|| {
            let mut m = serde_json::Map::new();
            m.insert("date".to_string(), serde_json::json!(date));
            m.insert("Deep Work".to_string(), serde_json::json!(0));
            m.insert("Research".to_string(), serde_json::json!(0));
            m.insert("Leisure".to_string(), serde_json::json!(0));
            m.insert("Distraction".to_string(), serde_json::json!(0));
            m.insert("Neutral".to_string(), serde_json::json!(0));
            m
        });
        entry.insert(category, serde_json::json!(time_spent));
    }

    let historical_array: Vec<serde_json::Value> = hist_map.into_values().map(serde_json::Value::Object).collect();

    // 4. RETURN ENCAPSULATED JSON PAYLOAD
    // The final payload is intentionally shaped as a small JSON object with three top-level sections:
    // today's totals, the historical trend array, and the top application breakdown.
    // This keeps the frontend contract simple while still exposing all of the analytics the dashboard needs.
    Ok(serde_json::json!({
        "today": today_stats,
        "historical": historical_array,
        "top_apps": top_apps
    }))
}


// ==========================================
// 5. AUDIO ENGINE (PIPER TTS)
// ==========================================
// Sends text to the local Piper TTS engine and queues the generated audio for playback.
#[tauri::command]
fn read_aloud(
    state: State<'_, AudioState>,
    text: String,
    wpm: f32,
    persona: String,
) -> Result<(), String> {
    let target_voice = match persona.as_str() {
        "Victor" => "en_US-bryce-medium",
        "Morgan" => "en_US-amy-medium",
        "Sam" => "en_US-ryan-high",
        "Maya" => "en_GB-semaine-medium",
        "Leo" => "en_US-joe-medium",
        "Felix" => "en_GB-alan-medium",
        "Ziggy" => "en_US-danny-low",
        "Nova" => "en_GB-cori-high",
        "Aria" => "en_GB-alba-medium",
        "Chloe" => "en_GB-jenny_dioco-medium",
        _ => "en_US-ryan-high",
    };

    let base_dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut model_path = base_dir
        .join("piper")
        .join("voices")
        .join(format!("{}.onnx", target_voice));

    if !model_path.exists() {
        println!(
            "[AUDIO WARNING] Voice {} not found, falling back to ryan-high",
            target_voice
        );
        model_path = base_dir
            .join("piper")
            .join("voices")
            .join("en_US-ryan-high.onnx");
    }

    let length_scale = 200.0 / wpm;
    let piper_cwd = base_dir.join("piper").join("piper");
    let exe_path = piper_cwd.join("piper.exe");
    let output_path = std::env::temp_dir().join("omni_core_tts_temp.wav");

    if !exe_path.exists() {
        return Err("piper.exe not found".into());
    }
    if !model_path.exists() {
        return Err("Voice model not found. Did you download the .onnx files?".into());
    }

    let mut child = Command::new(&exe_path)
        .current_dir(&piper_cwd)
        .arg("--model")
        .arg(&model_path)
        .arg("--length_scale")
        .arg(length_scale.to_string())
        .arg("--output_file")
        .arg(&output_path)
        .stdin(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|e| format!("Failed to start Piper: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(text.as_bytes());
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if !status.success() {
        return Err("Piper TTS engine failed to synthesize audio.".into());
    }

    if let Ok(tx) = state.inner().0.lock() {
        let _ = tx.send(AudioCommand::Play(
            output_path.to_string_lossy().to_string(),
        ));
    }

    Ok(())
}

// Stops the currently playing audio output.
#[tauri::command]
fn stop_reading(state: State<'_, AudioState>) -> Result<(), String> {
    if let Ok(tx) = state.inner().0.lock() {
        let _ = tx.send(AudioCommand::Stop);
    }
    Ok(())
}

// ==========================================
// 6. AI CONFIGURATION & 10 DIVERSE PERSONALITIES
// ==========================================
// Maps a selected model tier to the backing Ollama model name and context window size.
fn get_model_config(tier: &str) -> (&'static str, usize) {
    match tier {
        "General" => ("llama3.2:3b", 16384),
        "Coding" => ("qwen2.5-coder:3b", 16384),
        "Performance" => ("phi4-mini:latest", 16384),
        "RAG" => ("nemotron-mini:latest", 16384),
        "Vision" => ("qwen3.5:4b", 16384),
        _ => ("llama3.2:3b", 16384),
    }
}

// Returns the persona prompt that shapes the assistant's voice and behavior.
fn get_system_prompt(persona: &str) -> &'static str {
    match persona {
        "Victor" => "You are Victor (Strict Male). You are a tactical, drill-sergeant style executive mentor. You speak with high precision, direct tone, and zero fluff. You demand accountability and action. Use your access to the user's local database context to push them toward completing tasks and mastering notes. Format responses with clean Markdown and structured bullet points.",
        "Morgan" => "You are Morgan (Strict Female). You are a razor-sharp, high-standard professor and executive strategist. You demand intellectual rigor, concise logic, and immediate implementation. You don't sugarcoat feedback. Analyze the user's query against their local database context with uncompromising clarity.",
        "Sam" => "You are Sam (Normal Male). You are a friendly, chill roommate and approachable partner. You speak casually, naturally, and use humor or relatable everyday examples. Use the database context to offer solid, balanced assistance without sounding overly academic or formal.",
        "Maya" => "You are Maya (Normal Female). You are a warm, articulate, and encouraging study mentor. You communicate with clarity, empathy, and structured guidance. You help organize thoughts smoothly using the provided database context.",
        "Leo" => "You are Leo (Quirky Male). You are a deadpan, coffee-obsessed software developer type with a dry, sarcastic wit. You talk like a peer late at night in a hackathon—relatable, slightly cynical, but surprisingly sharp and helpful. Use humor and roasts affectionately while solving problems cleanly.",
        "Felix" => "You are Felix (Quirky Male). You are an over-enthusiastic, fast-talking tech tinkerer who thinks in wild analogies and pop-culture metaphors. You get absurdly hyped about solving complex problems or organizing data. Keep energy high, creative, and fun.",
        "Ziggy" => "You are Ziggy (Quirky Male). You are a smooth-talking, surrealist philosopher and late-night indie radio host. You approach topics with deep curiosity, intriguing metaphors, and existential humor. You bring a calm, intriguing, creative perspective to every problem.",
        "Nova" => "You are Nova (Quirky Female). You are a high-energy chaos gremlin and ultimate hype-woman. You speak with fast-paced banter, internet culture literacy, and dramatic flair. You are fiercely supportive and make every small accomplishment feel like winning a major trophy.",
        "Aria" => "You are Aria (Quirky Female). You are an eccentric, theatrical 'mad scientist' who treats studying, task execution, and notes like grand cosmic experiments. You use dramatic flourishes and fun scientific jargon to make productivity feel epic.",
        "Chloe" => "You are Chloe (Quirky Female). You are a dry-witted, zero-filter big sister figure. You roast affectionately, call out procrastination instantly, and offer brutally honest yet genuinely insightful advice. You cut straight through nonsense with sharp humor.",
        _ => "You are an intelligent AI assistant integrated with the user's local database. Answer queries directly using the context provided.",
    }
}

// ==========================================
// 7. TAURI COMMANDS (OLLAMA & STATS)
// ==========================================
// Tells Ollama to release the selected model from memory to free VRAM.
#[tauri::command]
async fn flush_vram(model_tier: String) -> Result<(), String> {
    let (actual_model, _) = get_model_config(&model_tier);
    println!(
        "[MEMORY MANAGER] Unloading {} to free VRAM...",
        actual_model
    );

    let _ = tauri::async_runtime::spawn_blocking(move || {
        let host = "127.0.0.1:11434";
        let api_url = format!("http://{}/api/generate", host);
        let _ = ureq::post(&api_url).send_json(serde_json::json!({
            "model": actual_model,
            "keep_alive": 0
        }));
    })
    .await;

    Ok(())
}

// Reports current system memory usage for the dashboard statistics panel.
#[tauri::command]
fn get_telemetry() -> Result<serde_json::Value, String> {
    let mut sys = System::new_all();
    sys.refresh_memory();
    
    let total_ram = sys.total_memory();
    let used_ram = sys.used_memory();
    
    let percent = if total_ram > 0 {
        (used_ram as f64 / total_ram as f64) * 100.0
    } else {
        0.0
    };
    
    let total_gb = total_ram as f64 / 1_073_741_824.0;
    let used_gb = used_ram as f64 / 1_073_741_824.0;
    
    Ok(serde_json::json!({
        "ram_total": format!("{:.2} GB", total_gb),
        "ram_used": format!("{:.2} GB", used_gb),
        "ram_percent": percent
    }))
}

// Performs a lightweight web search and returns a short snippet summary for the LLM context.
fn fetch_web_snippets(query: &str) -> String {
    let ddg_host = "lite.duckduckgo.com";
    let search_url = format!("https://{}/lite/", ddg_host);

    let req = ureq::post(&search_url)
        .set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(5))
        .send_form(&[("q", query)]);

    if let Ok(res) = req {
        if let Ok(body) = res.into_string() {
            let document = scraper::Html::parse_document(&body);
            let snippet_selector = scraper::Selector::parse("td.result-snippet").unwrap();
            let mut snippets = String::from("\n\n=== LIVE WEB SEARCH CONTEXT ===\n");
            
            for (i, element) in document.select(&snippet_selector).take(4).enumerate() {
                let text = element.text().collect::<Vec<_>>().join(" ");
                snippets.push_str(&format!("[{}] {}\n", i + 1, text.trim()));
            }
            if snippets.len() > 35 { 
                return snippets;
            }
        }
    }

    String::from("\n(Web search yielded no immediate results.)\n")
}

// Main bridge between the frontend and the local Ollama model, injecting database context and tool instructions.
// This function is the heart of the assistant experience: it gathers the user's latest prompt, appends the
// local knowledge base and optional textbook context, and sends everything to the local Ollama backend.
// It also parses any action tags returned by the model and translates them into real database mutations such as
// creating tasks, adding calendar events, or marking tasks as complete.
#[tauri::command]
async fn ask_ollama(
    db: State<'_, DbState>,
    messages: Vec<serde_json::Value>,
    persona: String,
    model_tier: String,
    search_web: bool,
    attached_textbook: Option<TextbookAttachment>, 
    current_date_str: String,
    _current_epoch_ms: i64,
    start_of_today_ms: i64,
) -> Result<String, String> {
    // Resolve the selected model tier into its concrete Ollama model identifier and a safe context window size.
    let (actual_model, safe_context) = get_model_config(&model_tier);

    // Extract the latest user message from the frontend message history so it can be used as the primary prompt.
    let user_prompt = messages.last()
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    // Build the rich context payload that will be shipped to the model.
    // The context is constructed from the local database so the assistant can reason about the user's tasks,
    // notes, course structure, calendar, and telemetry history rather than only seeing the latest chat message.
    let mut db_context = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        
        let mut ctx = build_db_context(&conn);
        
        if let Some(attachment) = &attached_textbook {
             let pdf_ctx = fetch_textbook_context(&conn, attachment, &user_prompt);
             ctx.push_str(&pdf_ctx);
        }
        ctx
    };

    // Optionally enrich the prompt with live web snippets when the user requests web-aware responses.
    // This is a lightweight search pass that adds a little external context without replacing the local database context.
    if search_web {
        if !user_prompt.is_empty() {
            println!("[WEB SEARCH] Fetching live web context for: {}", user_prompt);
            let web_context = fetch_web_snippets(&user_prompt);
            db_context.push_str(&web_context);
        }
    }

    let tool_instructions = format!("
\n=== SYSTEM CAPABILITIES (WRITE ACCESS ENABLED) ===
CURRENT DATE & TIME: {}

You have write access to the user's database. To execute an action, YOU MUST append a single tag at the very end of your response.
DO NOT output JSON. Use the strict tag formats below.

1. Task Creation:
[ACT:TASK:<QUADRANT_NUMBER>:<TITLE>]
Example (Urgent & Important = Q1): [ACT:TASK:1:Finish math homework]

2. Calendar Scheduling:
DO NOT calculate duration. Provide exact START and END times in 24-hour format. If the user asks for 'now', look at the CURRENT DATE & TIME above to get the current hour and minute.
[ACT:CALENDAR:<OFFSET_DAYS>:<START_HOUR>:<START_MIN>:<END_HOUR>:<END_MIN>:<TITLE>]
- OFFSET_DAYS: 0 for today, 1 for tomorrow.
- START_HOUR / END_HOUR: 0-23 format (e.g., 5 PM is 17).
- START_MIN / END_MIN: 0-59.
Example (Today from 5:00 PM to 7:00 PM): [ACT:CALENDAR:0:17:0:19:0:Practice physics]
Example (Tomorrow 9:30 AM to 11:00 AM): [ACT:CALENDAR:1:9:30:11:0:Study]

3. Focus Timer:
[ACT:TIMER:<FOCUS_MINUTES>:<BREAK_MINUTES>]
Example: [ACT:TIMER:45:5]

4. Delete Record:
[ACT:DELETE:<TABLE_NAME>:<ID>]

5. Mark Task Complete:
[ACT:COMPLETE:<TASK_ID>]

You may only use ONE tag per response.
", current_date_str);

    println!(
        "[OLLAMA_BRIDGE] Persona: {} | Model: {} | Messages: {} | DB Injected! | Web Search: {}",
        persona,
        actual_model,
        messages.len(),
        search_web
    );

    // Open a separate database connection for the background worker thread.
    // This avoids sharing a connection across asynchronous boundaries while still allowing the parser to mutate the database.
    let conn_for_thread = Connection::open("omni_core.db").unwrap(); 

    // Offload the actual Ollama request and parsing work to a blocking thread so it does not block the Tauri event loop.
    let thread_result = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let ollama_host = "127.0.0.1:11434";
        let chat_url = format!("http://{}/api/chat", ollama_host);
        // Combine the persona-specific system prompt, the local database context, and the action instruction block.
        // This gives the model both behavioral guidance and a rich knowledge base tailored to the user's workspace.
        let full_system_prompt = format!("{}\n{}\n{}", get_system_prompt(&persona), db_context, tool_instructions);

        // Build the final message array for Ollama. The system prompt is prepended first, followed by the conversation history.
        let mut ollama_messages = vec![serde_json::json!({
            "role": "system",
            "content": full_system_prompt
        })];

        ollama_messages.extend(messages);

        // Assemble the request body for Ollama using the selected model, message history, and context window size.
        let body = serde_json::json!({
            "model": actual_model,
            "messages": ollama_messages,
            "stream": false,
            "keep_alive": -1,
            "options": {
                "num_ctx": safe_context
            }
        });

        let response = match ureq::post(&chat_url)
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(300))
            .send_json(body)
        {
            Ok(resp) => resp,
            Err(ureq::Error::Status(code, resp)) => {
                let err_body = resp.into_string().unwrap_or_default();
                return Err(format!("Ollama HTTP {}: {}", code, err_body));
            }
            Err(e) => return Err(format!("Network request failed: {}", e)),
        };

        let json_response: serde_json::Value = response
            .into_json()
            .map_err(|e| format!("JSON parse failed: {}", e))?;

        if let Some(err) = json_response.get("error") {
            return Err(format!(
                "Ollama Error: {}",
                err.as_str().unwrap_or("Unknown error")
            ));
        }

        // Extract the text response from Ollama's structured reply.
        let response_text = json_response["message"]["content"]
            .as_str()
            .unwrap_or("No response")
            .to_string();

        // -------------------------------------------------------------
        // ADVANCED MULTI-TAG PARSER
        // -------------------------------------------------------------
        // The model may emit action tags such as [ACT:TASK:1:Finish work].
        // These are parsed here and translated into concrete local mutations so the assistant can act on the user's data.
        // The parser strips the tag out of the visible response text and appends a short system-action note summarizing what happened.
        let mut tool_results = Vec::new();
        let mut clean_text = String::new();
        let mut current_text = response_text.as_str();

        while let Some(start_idx) = current_text.find("[ACT:") {
            clean_text.push_str(&current_text[..start_idx]);
            
            if let Some(end_idx) = current_text[start_idx..].find(']') {
                let tag = &current_text[start_idx + 5..start_idx + end_idx];
                
                // Strip out quotes, backticks, and spaces
                let parts: Vec<String> = tag.split(':')
                    .map(|s| s.trim().trim_matches(|c| c == '"' || c == '\'' || c == '`').to_string())
                    .collect();

                if !parts.is_empty() {
                    let type_str = parts[0].to_lowercase();
                    let mut tool_result = String::from("Failed to parse action tag.");
                    
                    if type_str.contains("task") || type_str.contains("1") {
                        let q_str = parts.get(1).unwrap_or(&"4".to_string()).to_lowercase();
                        let quadrant = if q_str.contains("1") { 1 }
                            else if q_str.contains("2") { 2 }
                            else if q_str.contains("3") { 3 }
                            else { 4 };
                            
                        let title = if parts.len() >= 3 {
                            parts[2..].join(":")
                        } else if parts.len() == 2 {
                            parts[1].clone()
                        } else {
                            "New Task".to_string()
                        };
                        
                        // Safety sleep to ensure unique DB ID generation.
                        // This is a small guard against timestamp collisions when multiple actions are created in quick succession.
                        std::thread::sleep(std::time::Duration::from_millis(2));
                        let id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis().to_string();
                        
                        tool_result = match conn_for_thread.execute("INSERT INTO tasks (id, title, quadrant, completed) VALUES (?1, ?2, ?3, 0)", params![id, title, quadrant]) {
                            Ok(_) => format!("Successfully created task: '{}'", title),
                            Err(e) => format!("Database error: {}", e)
                        };
                    }
                    else if type_str.contains("calendar") || type_str.contains("timeblock") || type_str.contains("2") {
                        let extract_num = |s: &String| -> i64 {
                            let digits: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
                            digits.parse().unwrap_or(-1)
                        };

                        let days_str = parts.get(1).unwrap_or(&"0".to_string()).to_lowercase();
                        let days: i64 = if days_str.contains("tomorrow") { 1 } else { extract_num(&days_str).max(0) };
                        
                        let start_hour_str = parts.get(2).unwrap_or(&"12".to_string()).to_lowercase();
                        let start_min_str = parts.get(3).unwrap_or(&"0".to_string()).to_lowercase();
                        let end_hour_str = parts.get(4).unwrap_or(&"13".to_string()).to_lowercase();
                        let end_min_str = parts.get(5).unwrap_or(&"0".to_string()).to_lowercase();
                        
                        let parse_time = |h_str: &String, m_str: &String| -> (i64, i64) {
                            let is_pm = h_str.contains("pm") || m_str.contains("pm");
                            let is_am = h_str.contains("am") || m_str.contains("am");
                            let mut h = extract_num(h_str);
                            if h == -1 { h = 12; }
                            if is_pm && h < 12 { h += 12; }
                            if is_am && h == 12 { h = 0; }
                            let mut m = extract_num(m_str);
                            if m == -1 { m = 0; }
                            (h, m)
                        };

                        let (start_h, start_m) = parse_time(&start_hour_str, &start_min_str);
                        let (mut end_h, end_m) = parse_time(&end_hour_str, &end_min_str);
                        
                        // AI Safety: If the end hour is before the start hour, the model likely intended the end time to be in the afternoon.
                        // A corrective adjustment keeps calendar scheduling intuitive and avoids obviously invalid blocks.
                        if end_h < start_h {
                            end_h += 12; 
                        }
                        
                        let title = if parts.len() >= 7 {
                            parts[6..].join(":")
                        } else if parts.len() > 1 {
                            parts.last().unwrap().clone()
                        } else {
                            "Scheduled Event".to_string()
                        };
                        
                        let start = start_of_today_ms + (days * 86_400_000) + (start_h * 3_600_000) + (start_m * 60_000);
                        let mut end = start_of_today_ms + (days * 86_400_000) + (end_h * 3_600_000) + (end_m * 60_000);
                        
                        // Failsafe: Ensure the block is at least one hour long if the parsed times somehow collapse to an invalid range.
                        // This prevents zero-length or backwards events from being inserted into the calendar.
                        if end <= start {
                            end = start + 3_600_000;
                        }
                        
                        std::thread::sleep(std::time::Duration::from_millis(2));
                        let id = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_millis().to_string();

                        tool_result = match conn_for_thread.execute("INSERT INTO calendar_events (id, title, description, start_time, end_time, event_type, tags, color, is_all_day) VALUES (?1, ?2, '', ?3, ?4, 'TimeBlock', '[]', '#3b82f6', 0)", 
                            params![id, title, start, end]) {
                            Ok(_) => format!("Successfully scheduled calendar block: '{}'", title),
                            Err(e) => format!("Database error: {}", e)
                        };
                    }
                    else if type_str.contains("timer") || type_str.contains("focus") || type_str.contains("3") {
                        let focus: i32 = parts.get(1).unwrap_or(&"25".to_string()).parse().unwrap_or(25);
                        tool_result = format!("SYSTEM_START_TIMER_{} | Timer successfully started for {} minutes.", focus, focus);
                    }
                    else if type_str.contains("delete") || type_str.contains("4") {
                        let table_string = parts.get(1).cloned().unwrap_or_default();
                        let id_string = parts.get(2).cloned().unwrap_or_default();
                        let table = table_string.as_str();
                        let id = id_string.as_str();
                        let safe_tables = ["tasks", "notes", "courses", "calendar_events"];
                        if safe_tables.contains(&table) {
                            let query = format!("DELETE FROM {} WHERE id = ?1", table);
                            tool_result = match conn_for_thread.execute(&query, params![id]) {
                                Ok(rows) => if rows > 0 { format!("Successfully deleted record from {}", table) } else { "Record not found.".to_string() },
                                Err(e) => format!("Database error: {}", e)
                            };
                        }
                    }
                    else if type_str.contains("complete") || type_str.contains("5") {
                        let id_string = parts.get(1).cloned().unwrap_or_default();
                        let id = id_string.as_str();
                        tool_result = match conn_for_thread.execute("UPDATE tasks SET completed = 1 WHERE id = ?1", params![id]) {
                            Ok(_) => format!("Successfully marked task as complete."),
                            Err(e) => format!("Database error: {}", e)
                        };
                    }
                    
                    if !tool_result.contains("Failed to parse") {
                        tool_results.push(tool_result);
                    }
                }
                
                current_text = &current_text[start_idx + end_idx + 1..];
            } else {
                current_text = &current_text[start_idx + 5..];
            }
        }
        clean_text.push_str(current_text);
        
        // Remove any markdown code fences around the text so the final response is clean and presentation-friendly.
        let mut final_response = clean_text.replace("```json", "").replace("```", "").trim().to_string();
        
        // Append the system action notes after the main response text so the user sees both the conversational answer and the resulting backend action.
        
        for res in tool_results {
            final_response.push_str(&format!("\n\n*System Action:* _{}_", res));
        }

        Ok(final_response)
    })
    .await
    .map_err(|e| format!("Thread crashed: {}", e))?;

    thread_result
}

// ==========================================
// 8. MAIN DAEMON SETUP
// ==========================================
// Application entry point that initializes the database, launches the audio system, and registers Tauri commands.
fn main() {
    // Initialize the database schema and create the shared connection that the app will use.
    let db_conn = init_db().expect("Failed to initialize SQLite database");

    // Create a channel that lets the UI and backend control audio playback from any thread.
    let (audio_tx, audio_rx) = mpsc::channel::<AudioCommand>();

    // Launch the background audio worker that plays incoming sound requests through Rodio.
    thread::spawn(move || match rodio::OutputStream::try_default() {
        Ok((_stream, stream_handle)) => {
            if let Ok(mut sink) = rodio::Sink::try_new(&stream_handle) {
                for cmd in audio_rx.iter() {
                    match cmd {
                        AudioCommand::Play(path) => {
                            sink.stop();
                            if let Ok(new_sink) = rodio::Sink::try_new(&stream_handle) {
                                sink = new_sink;
                                if let Ok(file) = File::open(&path) {
                                    if let Ok(source) = rodio::Decoder::new(BufReader::new(file)) {
                                        sink.append(source);
                                        sink.play();
                                    }
                                }
                            }
                        }
                        AudioCommand::Stop => {
                            sink.stop();
                        }
                    }
                }
            }
        }
        Err(e) => println!("[AUDIO FATAL] OS denied audio output access: {}", e),
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(DbState(Mutex::new(db_conn)))
        .manage(AudioState(Mutex::new(audio_tx)))
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Shutdown Omni-Core", true, None::<&str>)?;
            let show_i =
                MenuItem::with_id(app, "show", "Open Executive Dashboard", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            window.show().unwrap();
                            window.set_focus().unwrap();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            // --- THE SILENT WATCHER BACKGROUND LOOP ---
            // Start a background task that periodically records the active window for telemetry and focus analysis.
            tauri::async_runtime::spawn(async move {
                // We create a completely separate DB connection inside the thread so it doesn't lock the main app
                if let Ok(conn) = Connection::open("omni_core.db") {
                    loop {
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
                        
                        if let Ok(window) = get_active_window() {
                            let app_name = window.app_name.to_lowercase();
                            let title = window.title.to_lowercase();
                            
                            // Basic categorization logic (can be expanded later)
                            let category = if app_name.contains("code") || app_name.contains("cursor") || title.contains("omni-core") || app_name.contains("terminal") {
                                "Deep Work"
                            } else if app_name.contains("chrome") || app_name.contains("edge") || app_name.contains("brave") || app_name.contains("opera") || app_name.contains("firefox") || app_name.contains("vivaldi") || app_name.contains("safari") || app_name.contains("chromium") {
                                if title.contains("youtube") || title.contains("twitter") || title.contains("reddit") {
                                    "Distraction"
                                } else {
                                    "Research"
                                }
                            } else if app_name.contains("discord") || app_name.contains("spotify") {
                                "Leisure"
                            } else {
                                "Neutral"
                            };

                            let id = format!("log_{}", now);
                            let _ = conn.execute(
                                "INSERT INTO immutable_telemetry (id, timestamp, app_name, window_title, category) VALUES (?1, ?2, ?3, ?4, ?5)",
                                params![id, now, window.app_name, window.title, category],
                            );
                        }
                        
                        // Polling rate for telemetry (every 10 seconds)
                        tokio::time::sleep(Duration::from_secs(10)).await;
                    }
                }
            });

            Ok(())
        })
        // Clean up background model state when the main window is closing.
        .on_window_event(|_window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                let models_to_purge = [
                    "llama3.2:3b",
                    "qwen2.5-coder:3b",
                    "phi4-mini:latest",
                    "nemotron-mini:latest",
                    "qwen3.5:4b",
                ];
                for model in models_to_purge {
                    let purge_url = format!("http://{}/api/generate", "127.0.0.1:11434");
                    let _ = ureq::post(&purge_url)
                        .send_json(serde_json::json!({ "model": model, "keep_alive": 0 }));
                }
            }
            _ => {}
        })
        // Register all backend commands that the frontend can invoke over Tauri.
        .invoke_handler(tauri::generate_handler![
            get_telemetry_stats,
            get_telemetry, 
            get_active_app_telemetry, 
            ask_ollama, 
            flush_vram, 
            get_tasks, 
            add_task, 
            delete_task, 
            get_notes, 
            save_note, 
            delete_note, 
            get_courses, 
            add_course, 
            delete_course, 
            get_workspaces, 
            create_workspace, 
            rename_workspace, 
            delete_workspace, 
            get_chat_sessions, 
            create_chat_session, 
            rename_chat_session, 
            move_session_to_workspace, 
            delete_chat_session, 
            get_chats_by_session, 
            save_chat, 
            clear_chats_by_session, 
            get_settings, 
            save_settings, 
            read_aloud, 
            stop_reading, 
            log_focus_session, 
            get_focus_sessions, 
            rename_focus_session, 
            delete_focus_session, 
            search_yt_music, 
            get_yt_audio_url, 
            get_playlists, 
            create_playlist, 
            rename_playlist, 
            delete_playlist, 
            update_playlist_tags, 
            add_song_to_playlist, 
            remove_song_from_playlist, 
            download_yt_song, 
            add_local_song, 
            get_offline_songs, 
            delete_offline_song, 
            import_pdf_textbook, 
            get_textbooks, 
            rename_textbook, 
            update_textbook_course, 
            delete_textbook, 
            get_book_sets, 
            create_book_set, 
            rename_book_set, 
            delete_book_set, 
            add_book_to_set, 
            remove_book_from_set, 
            add_calendar_event, 
            update_calendar_event, 
            delete_calendar_event, 
            get_calendar_events_in_range 
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}