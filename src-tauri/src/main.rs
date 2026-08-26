// Mencegah console tambahan muncul di Windows saat aplikasi dijalankan (mode release)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error saat menjalankan aplikasi Tauri");
}
