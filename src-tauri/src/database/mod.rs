pub mod db;
pub mod purge;

pub fn init_database() {
    println!("🗄️ Initializing SQLite memory storage...");

    // 1. Build the database file and tables
    if let Err(e) = db::init_schema() {
        eprintln!("Failed to initialize database schema: {}", e);
    }

    // 2. Spawn the automated memory manager
    std::thread::spawn(|| {
        purge::start_purge_loop();
    });
}
