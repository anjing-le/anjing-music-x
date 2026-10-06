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
