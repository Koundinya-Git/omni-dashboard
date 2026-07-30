#[cfg(target_os = "windows")]
mod accessibility_win;
#[cfg(target_os = "windows")]
pub use accessibility_win::*;

#[cfg(target_os = "linux")]
mod accessibility_lin;
#[cfg(target_os = "linux")]
pub use accessibility_lin::*;