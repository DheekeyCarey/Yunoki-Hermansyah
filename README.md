# SIAKAD — Desktop (Tauri) + PWA iOS

Project ini punya **dua target** untuk blog Blogger yang sama, **https://ujicobagratis02.blogspot.com**:

| Target | Folder | Platform |
|---|---|---|
| Aplikasi desktop native | `src-tauri/` (root project) | Windows / macOS / Linux |
| PWA "Add to Home Screen" | `pwa-ios/` | iOS (Safari), bonus Android |

Bagian di bawah ini (sampai "Mengganti URL blog") tentang **build desktop
Tauri**. Untuk **PWA iOS**, langsung ke folder `pwa-ios/README.md` — itu
setup terpisah (tempel snippet HTML ke tema Blogger), tidak butuh Rust/Node
sama sekali.

---

## Bagian 1 — Desktop (Tauri)

Window aplikasi desktop langsung memuat URL blog tersebut — lihat
`src-tauri/tauri.conf.json` → `app.windows[0].url`.

## Yang perlu diinstal dulu (di komputer kamu, bukan di sini)

1. **Rust** — https://www.rust-lang.org/tools/install
2. **Node.js** (LTS) — https://nodejs.org
3. **Tauri CLI**, jalankan di folder project:
   ```bash
   npm install
   ```
4. Dependensi sistem sesuai OS (wajib untuk build native):
   - **Windows**: install "Desktop development with C++" dari Visual Studio
     Build Tools, plus WebView2 Runtime (biasanya sudah bawaan Windows 10/11).
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   - **Linux**: `webkit2gtk`, `libayatana-appindicator3-dev`, dsb — lihat
     daftar lengkap di https://tauri.app/start/prerequisites/

## Menjalankan mode development

```bash
npm run tauri dev
```
Ini membuka window desktop yang langsung menampilkan blog kamu, dengan
hot-reload konfigurasi (bukan hot-reload konten blog, karena kontennya
memang di-load dari internet).

## Build jadi installer (.exe / .dmg / .deb / .AppImage)

```bash
npm run tauri build
```
Hasil installer ada di `src-tauri/target/release/bundle/`. Build hanya
menghasilkan installer untuk OS tempat kamu menjalankan perintah ini (mis.
build di Windows → hasil .exe/.msi, build di macOS → .dmg, dst). Untuk
target lain, perlu build di OS tersebut atau pakai CI (GitHub Actions).

## Build otomatis lewat GitHub Actions (tanpa install apa-apa di komputer)

Ada workflow siap pakai di `.github/workflows/build.yml` yang otomatis
build **installer untuk Windows, macOS, dan Linux sekaligus** — jadi kamu
tidak perlu install Rust/Node/Xcode/dsb di komputer sendiri sama sekali.

Cara pakai:
1. Push folder project ini ke sebuah **repository GitHub** (bisa privat
   atau publik).
2. Buka repo itu di GitHub → tab **Actions**.
3. Di sidebar kiri, klik workflow **"Build SIAKAD Desktop"**.
4. Klik tombol **"Run workflow"** (dropdown hijau) → **"Run workflow"**
   lagi untuk konfirmasi.
5. Tunggu ± 10–15 menit sampai 3 job (windows / macos / linux) selesai
   (tanda centang hijau).
6. Buka run yang barusan selesai → scroll ke bawah ke bagian
   **"Artifacts"** → unduh `siakad-desktop-windows`, `siakad-desktop-macos`,
   dan `siakad-desktop-linux` sesuai kebutuhan. Masing-masing berisi
   installer (.exe/.msi, .dmg, .deb/.AppImage) untuk OS tersebut.

> Catatan: artifact GitHub Actions otomatis kedaluwarsa (default 90 hari).
> Kalau butuh menyimpan permanen, unduh dan simpan sendiri, atau nanti
> saya bisa ubah workflow ini supaya sekalian bikin **GitHub Release**
> permanen setiap kali di-trigger.

## Icon aplikasi

`tauri.conf.json` mereferensikan file di `src-tauri/icons/` (belum ada di
project ini). Generate otomatis dari satu file PNG 1024x1024 pakai:
```bash
npm run tauri icon path/ke/logo-sekolah.png
```
Ini akan otomatis membuat semua ukuran icon yang dibutuhkan tiap OS.

## Kalau nanti butuh login Google di dalam window

Blog publik seperti ini tidak butuh login, jadi aman apa adanya. Tapi kalau
suatu saat kamu tambah fitur yang perlu login Google (misalnya admin area),
kemungkinan besar Google akan menolak login dari webview embedded
("This browser or app may not be secure"). Kabari saya kalau itu terjadi,
ada beberapa cara (open browser eksternal untuk login, dsb.) yang bisa
disesuaikan.

## Mengganti URL blog

Kalau URL blog berubah atau kamu mau tambah query string, edit
`src-tauri/tauri.conf.json`:
```json
"windows": [{ "url": "https://url-blog-baru.blogspot.com" }]
```

---

## Bagian 2 — PWA iOS ("Add to Home Screen")

Lihat **`pwa-ios/README.md`** untuk panduan lengkap: upload icon ke
Blogger, tempel `pwa-ios/snippet-head-blogger.html` ke tema Blogger (Edit
HTML), lalu tes "Add to Home Screen" di iPhone. Icon yang dipakai sama
persis dengan icon desktop ("Administrasi Guru"), sudah digenerate ulang
di ukuran khusus iOS (`pwa-ios/icons/`).

Dua target ini independen — build desktop tidak butuh setup PWA, dan
sebaliknya. Keduanya cuma berbagi satu sumber: blog Blogger yang sama.
