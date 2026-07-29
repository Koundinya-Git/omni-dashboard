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

                                            
                           
                                            
                                                                                             
pub struct DbState(pub Mutex<Connection>);

                                                                                      
pub enum AudioCommand {
    Play(String),
    Stop,
}

                                                                              
pub struct AudioState(pub Mutex<Sender<AudioCommand>>);

                                                                                      
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

    conn.execute(
        "CREATE TABLE IF NOT EXISTS goals (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            deadline INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            ai_assessment TEXT NOT NULL DEFAULT ''
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS flashcard_decks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            subcategory TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS flashcards (
            id TEXT PRIMARY KEY,
            deck_id TEXT NOT NULL,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            is_starred INTEGER NOT NULL DEFAULT 0,
            next_review INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(deck_id) REFERENCES flashcard_decks(id) ON DELETE CASCADE
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
                                    
#[derive(serde::Serialize, serde::Deserialize)]
pub struct TaskItem {
    pub id: String,
    pub title: String,
    pub quadrant: i32,
    pub completed: bool,
}
                                                 
#[derive(serde::Serialize, serde::Deserialize)]
pub struct NoteItem {
    pub id: String,
    pub title: String,
    pub content: String,
    pub course_id: String,
}
                                                               
#[derive(serde::Serialize, serde::Deserialize)]
pub struct CourseItem {
    pub id: String,
    pub code: String,
    pub name: String,
    pub description: String,
    pub color: String,
}
                                                                 
#[derive(serde::Serialize, serde::Deserialize)]
pub struct WorkspaceItem {
    pub id: String,
    pub name: String,
    pub created_at: i64,
}
                                                                      
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatSessionItem {
    pub id: String,
    pub title: String,
    pub workspace_id: String,
    pub created_at: i64,
    pub updated_at: i64,
}
                                                
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ChatItem {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: i64,
}
                                                            
#[derive(serde::Serialize, serde::Deserialize)]
pub struct FocusSessionItem {
    pub id: String,
    pub task_id: String,
    pub duration_minutes: i32,
    pub timestamp: i64,
    pub title: Option<String>,
}
                                                                        
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
                                                                          
#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[allow(non_snake_case)]
pub struct YTMusicSong {
    pub videoId: String,
    pub title: String,
    pub artists: Vec<Artist>,
    pub thumbnails: Vec<Thumbnail>,
    pub duration: String,
}
                                                                     
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Artist {
    pub name: String,
}
                                                            
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Thumbnail {
    pub url: String,
}
                                                                     
#[derive(serde::Serialize, serde::Deserialize)]
pub struct PlaylistItem {
    pub id: String,
    pub name: String,
    pub tags: Vec<String>,
    pub songs: Vec<YTMusicSong>,
    pub created_at: i64,
}
                                                                                     
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
                                                                                                
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct TextbookAttachment {
    pub textbook_id: String,
    pub page_start: Option<i32>,
    pub page_end: Option<i32>,
    pub exact_snippet: Option<String>,
}
                                                                
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct BookSetItem {
    pub id: String,
    pub name: String,
    pub created_at: i64,
    pub textbook_ids: Vec<String>,
}
                                                            
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
                                                                    
#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct GoalItem{
    pub id: String,
    pub title: String,
    pub description: String,
    pub deadline: i64,
    pub status: String,
    pub ai_assessment: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct FlashcardDeck {
    pub id: String,
    pub title: String,
    pub category: String,                                              
    pub subcategory: String,                           
    pub created_at: i64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Flashcard {
    pub id: String,
    pub deck_id: String,
    pub front: String,
    pub back: String,
    pub is_starred: bool,
    pub next_review: i64,
}
                                                                               
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
    
                                                 
    context.push_str("\n--- LIVE MEMORY CONTEXT (OBSERVER EFFECT) ---\n");
    let one_hour_ago = current_time - 3_600_000;
    if let Ok(mut stmt) = conn.prepare("SELECT app_name, window_title, category, COUNT(*) as time_spent FROM immutable_telemetry WHERE timestamp > ?1 GROUP BY window_title ORDER BY time_spent DESC LIMIT 5") {
        if let Ok(telemetry_iter) = stmt.query_map(params![one_hour_ago], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i32>(3)? * 10,                           
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
                                                 
#[tauri::command]
fn get_settings(db: State<'_, DbState>) -> Result<UserSettings, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    Ok(get_user_settings_internal(&conn))
}
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
                                              
#[tauri::command]
fn delete_chat_session(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chats WHERE session_id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM chat_sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
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
                                      
 #[tauri::command]
 fn get_goals(db: State<'_, DbState>) -> Result<Vec<GoalItem>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, title, description, deadline, status, ai_assessment FROM goals ORDER BY deadline ASC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(GoalItem {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                deadline: row.get(3)?,
                status: row.get(4)?,
                ai_assessment: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
 }
 #[tauri::command]
fn add_goal(
    db: State<'_, DbState>,
    id: String,
    title: String,
    description: String,
    deadline: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO goals (id, title, description, deadline, status, ai_assessment) VALUES (?1, ?2, ?3, ?4, 'Active', '')",
        params![id, title, description, deadline],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
                                                                                  
#[tauri::command]
fn update_goal_assessment(
    db: State<'_, DbState>,
    id: String,
    status: String,
    ai_assessment: String,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE goals SET status = ?1, ai_assessment = ?2 WHERE id = ?3",
        params![status, ai_assessment, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]   
fn delete_goal(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM goals WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_flashcard_decks(db: State<'_, DbState>) -> Result<Vec<FlashcardDeck>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, title, category, subcategory, created_at FROM flashcard_decks ORDER BY created_at DESC").map_err(|e| e.to_string())?;
    let iter = stmt.query_map([], |row| {
        Ok(FlashcardDeck {
            id: row.get(0)?,
            title: row.get(1)?,
            category: row.get(2)?,
            subcategory: row.get(3)?,
            created_at: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

#[tauri::command]
fn create_flashcard_deck(
    db: State<'_, DbState>,
    id: String,
    title: String,
    category: String,
    subcategory: String,
    created_at: i64,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO flashcard_decks (id, title, category, subcategory, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, title, category, subcategory, created_at],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn rename_flashcard_deck(db: State<'_, DbState>, id: String, title: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE flashcard_decks SET title = ?1 WHERE id = ?2",
        params![title, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn del_deck(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM flashcard_decks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_flashcards(db: State<'_, DbState>, deck_id: String) -> Result<Vec<Flashcard>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, deck_id, front, back, created_at FROM flashcards WHERE deck_id = ?1").map_err(|e| e.to_string())?;
    let iter = stmt.query_map(params![deck_id], |row| {
        let is_starred_int: i32 = row.get(4)?;
        Ok(Flashcard {
            id: row.get(0)?,
            deck_id: row.get(1)?,
            front: row.get(2)?,
            back: row.get(3)?,
            is_starred: is_starred_int == 1, next_review: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut list = Vec::new();
    for item in iter.flatten() {
        list.push(item);
    }
    Ok(list)
}

#[tauri::command]
fn add_flashcards(db: State<'_, DbState>, deck_id: String, cards: Vec<Flashcard>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    for card in cards {
        let starred_int = if card.is_starred { 1 } else { 0 };
        conn.execute(
            "INSERT INTO flashcards (id, deck_id, front, back, is_starred, next_review) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![card.id, deck_id, card.front, card.back, starred_int, card.next_review],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn toggle_card(db: State<'_, DbState>, id: String, is_starred: bool) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let starred_int = if is_starred { 1 } else { 0 };
    conn.execute(
        "UPDATE flashcards SET is_starred = ?1 WHERE id = ?2",
        params![starred_int, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn del_card(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM flashcards WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}                                                                       
                                                          
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
                                                                             
#[tauri::command]
fn delete_task(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
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
#[tauri::command]
fn delete_note(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
                                                                                      
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
                                                                                           
#[tauri::command]
fn delete_course(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM courses WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
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
                                                                                
#[tauri::command]
fn delete_focus_session(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM focus_sessions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
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
#[tauri::command]
fn delete_playlist(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM playlists WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
                                                                                   
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
#[tauri::command]
fn delete_textbook(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM textbook_pages WHERE textbook_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_set_items WHERE textbook_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM textbooks WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
                                                     
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
                                                                            
#[tauri::command]
fn rename_book_set(db: State<'_, DbState>, id: String, name: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE book_sets SET name = ?1 WHERE id = ?2",
        params![name, id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn delete_book_set(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_set_items WHERE set_id = ?1", params![id]).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM book_sets WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
                                                                 
#[tauri::command]
fn add_book_to_set(db: State<'_, DbState>, set_id: String, textbook_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO book_set_items (set_id, textbook_id) VALUES (?1, ?2)",
        params![set_id, textbook_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
#[tauri::command]
fn remove_book_from_set(db: State<'_, DbState>, set_id: String, textbook_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM book_set_items WHERE set_id = ?1 AND textbook_id = ?2",
        params![set_id, textbook_id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
                                               
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
#[tauri::command]
fn delete_calendar_event(db: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM calendar_events WHERE id = ?1", params![id]).map_err(|e| e.to_string())?;
    Ok(())
}
                                                     
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
                                                                                               
#[tauri::command]
fn get_telemetry_stats(db: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
                                                                                                            
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
                                                                                                
    today_stats.insert("Deep Work".to_string(), serde_json::json!(0));
    today_stats.insert("Research".to_string(), serde_json::json!(0));
    today_stats.insert("Leisure".to_string(), serde_json::json!(0));
    today_stats.insert("Distraction".to_string(), serde_json::json!(0));
    today_stats.insert("Neutral".to_string(), serde_json::json!(0));

    for item in today_iter.flatten() {
        today_stats.insert(item.0, serde_json::json!(item.1));
    }

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
                                                                           
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
    let seven_days_ago = now - (7 * 86_400_000);                         

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
                                                                                              
    Ok(serde_json::json!({
        "today": today_stats,
        "historical": historical_array,
        "top_apps": top_apps
    }))
}
                                                                                  
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
#[tauri::command]
fn stop_reading(state: State<'_, AudioState>) -> Result<(), String> {
    if let Ok(tx) = state.inner().0.lock() {
        let _ = tx.send(AudioCommand::Stop);
    }
    Ok(())
}
                                                                               
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
    let (actual_model, safe_context) = get_model_config(&model_tier);
    let user_prompt = messages.last()
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();
                                                                                                               
    let mut db_context = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        
        let mut ctx = build_db_context(&conn);
        
        if let Some(attachment) = &attached_textbook {
             let pdf_ctx = fetch_textbook_context(&conn, attachment, &user_prompt);
             ctx.push_str(&pdf_ctx);
        }
        ctx
    };
                                                                                                                 
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
                                                                                                                         
    let conn_for_thread = Connection::open("omni_core.db").unwrap(); 
                                                                                                                   
    let thread_result = tauri::async_runtime::spawn_blocking(move || -> Result<String, String> {
        let ollama_host = "127.0.0.1:11434";
        let chat_url = format!("http://{}/api/chat", ollama_host);
                                                                                                             
        let full_system_prompt = format!("{}\n{}\n{}", get_system_prompt(&persona), db_context, tool_instructions);
                                                                                                                      
        let mut ollama_messages = vec![serde_json::json!({
            "role": "system",
            "content": full_system_prompt
        })];

        ollama_messages.extend(messages);
                                                                                                       
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
                                                           
        let response_text = json_response["message"]["content"]
            .as_str()
            .unwrap_or("No response")
            .to_string();
                                                                                                                          
        let mut tool_results = Vec::new();
        let mut clean_text = String::new();
        let mut current_text = response_text.as_str();

        while let Some(start_idx) = current_text.find("[ACT:") {
            clean_text.push_str(&current_text[..start_idx]);
            
            if let Some(end_idx) = current_text[start_idx..].find(']') {
                let tag = &current_text[start_idx + 5..start_idx + end_idx];
                                                         
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
                                                                                                                   
        let mut final_response = clean_text.replace("```json", "").replace("```", "").trim().to_string();

        for res in tool_results {
            final_response.push_str(&format!("\n\n*System Action:* _{}_", res));
        }

        Ok(final_response)
    })
    .await
    .map_err(|e| format!("Thread crashed: {}", e))?;

    thread_result
}
                                                                                                         
fn main() {
                                                                                            
    let db_conn = init_db().expect("Failed to initialize SQLite database");
                                                                                           
    let (audio_tx, audio_rx) = mpsc::channel::<AudioCommand>();
                                                                                          
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
                                                                                                     
            tauri::async_runtime::spawn(async move {
                                                                                                                 
                if let Ok(conn) = Connection::open("omni_core.db") {
                    loop {
                        let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as i64;
                        
                        if let Ok(window) = get_active_window() {
                            let app_name = window.app_name.to_lowercase();
                            let title = window.title.to_lowercase();
                            
                                                                                
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
                                                                                              
                        tokio::time::sleep(Duration::from_secs(10)).await;
                    }
                }
            });

            Ok(())
        })
                                                                          
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
            get_calendar_events_in_range,
            get_goals,
            add_goal,
            update_goal_assessment,
            delete_goal,
            get_flashcard_decks,
            create_flashcard_deck,
            rename_flashcard_deck,
            del_deck,
            get_flashcards,
            add_flashcards,
            toggle_card,
            del_card,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}