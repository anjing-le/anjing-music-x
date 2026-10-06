// A public demo gate, not an identity or authorization boundary.
const DEMO_PASSWORD: &str = "anjing";

#[tauri::command]
fn sign_in(password: String) -> bool {
    password == DEMO_PASSWORD
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![sign_in])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use objc2::MainThreadMarker;
                use objc2_app_kit::{NSWindow, NSWindowButton};
                use tauri::Manager;

                let _main_thread = MainThreadMarker::new()
                    .ok_or("macOS window controls must be configured on the main thread")?;
                let window = app
                    .get_webview_window("main")
                    .ok_or("the main window is unavailable")?;
                let native_pointer = window.ns_window()?;
                // Tauri owns this live NSWindow for the whole setup call; AppKit
                // access stays on the main thread. Keep its titled frame intact.
                let native_window = unsafe { native_pointer.cast::<NSWindow>().as_ref() }
                    .ok_or("the native main window is unavailable")?;
                for kind in [
                    NSWindowButton::CloseButton,
                    NSWindowButton::MiniaturizeButton,
                    NSWindowButton::ZoomButton,
                ] {
                    if let Some(button) = native_window.standardWindowButton(kind) {
                        button.setHidden(true);
                    }
                }
            }
            #[cfg(not(target_os = "macos"))]
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run Anjing Music X");
}

#[cfg(test)]
mod tests {
    use super::sign_in;

    #[test]
    fn demo_gate_only_accepts_the_exact_password() {
        assert!(sign_in("anjing".into()));
        for password in ["", "ANJING", " anjing", "anjing ", "incorrect"] {
            assert!(!sign_in(password.into()));
        }
    }
}
