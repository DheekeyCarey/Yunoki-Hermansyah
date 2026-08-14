// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use base64::{engine::general_purpose::STANDARD, Engine as _};

// ============================================================================
// Kenapa command ini ada:
// Tombol "Export Excel" & "Cetak PDF" di src/index.html awalnya memakai
// mekanisme download standar browser (XLSX.writeFile / anchor "download",
// dan window.open(blobUrl) untuk PDF). Mekanisme itu TIDAK berfungsi di
// dalam WebView Tauri (WebView2 di Windows, WKWebView di macOS, dst) --
// klik tombolnya tidak menghasilkan file maupun error yang terlihat.
// Solusinya: file (bytes Excel/PDF) dikirim dari JS ke Rust lewat invoke(),
// lalu di sini kita tampilkan dialog "Simpan Sebagai" native dan tulis
// filenya langsung ke disk. Lihat simpanFileBiner() di src/index.html.
// ============================================================================

/// Menampilkan dialog "Simpan Sebagai" native, lalu menulis `data_base64`
/// (di-decode dulu jadi bytes) ke path yang dipilih pengguna.
/// Mengembalikan path file yang tersimpan, atau `null` kalau pengguna
/// membatalkan dialog.
#[tauri::command]
async fn save_binary_file(filename: String, data_base64: String) -> Result<Option<String>, String> {
    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|e| format!("Data file tidak valid: {e}"))?;

    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin")
        .to_string();

    let handle = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .add_filter(extension.to_uppercase().as_str(), &[extension.as_str()])
        .save_file()
        .await;

    match handle {
        Some(file) => {
            file.write(&bytes)
                .await
                .map_err(|e| format!("Gagal menyimpan file: {e}"))?;
            Ok(Some(file.path().to_string_lossy().to_string()))
        }
        None => Ok(None), // pengguna membatalkan dialog
    }
}

/// Membuka sebuah file dengan aplikasi default sistem (mis. PDF viewer),
/// dipanggil setelah "Cetak PDF" berhasil menyimpan file, supaya pengguna
/// bisa langsung lanjut ke dialog cetak dari PDF viewer bawaan.
#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    open::that(path).map_err(|e| format!("Gagal membuka file: {e}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_binary_file, open_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
