pub mod accessibility;
pub mod audio;
pub mod screen;

pub fn init_capture_system() {
    println!("🚀 Capture engine online. Spawning OS thread for Windows hooks...");

    // Spawn a dedicated, isolated OS thread for Windows COM safety
    std::thread::spawn(|| {
        accessibility::start_loop();
    });
}
