
#[cfg(target_os = "windows")]
#[path = "accessibility_win.rs"]
mod accessibility_win;
#[cfg(target_os = "windows")]
pub use accessibility_win::*;

#[cfg(target_os = "linux")]
#[path = "accessibility_lin.rs"]
mod accessibility_lin;
#[cfg(target_os = "linux")]
pub use accessibility_lin::*;