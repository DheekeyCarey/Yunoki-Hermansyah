# SIAKAD sebagai PWA di iOS (Add to Home Screen)

Blogger **tidak bisa** meng-host file statis sembarangan di root domain
(misalnya `/manifest.json` atau `/sw.js`), jadi pendekatan yang dipakai di
sini adalah: upload semua icon ke Blogger sendiri (dapat URL permanen),
lalu tempel meta tag + link ke `<head>` tema Blogger. Ini cukup untuk
"Add to Home Screen" berfungsi mulus di iOS — iOS Safari sebenarnya lebih
mengandalkan `apple-touch-icon` & meta tag daripada `manifest.json`.

## Isi folder ini

- `icons/apple-touch-icon.png` (180×180) — icon utama iOS, background
  putih (iOS tidak mendukung transparansi, jadi otomatis di-flatten)
- `icons/apple-touch-icon-167.png`, `-152.png`, `-120.png` — untuk
  iPad Pro, iPad lama, iPhone lama
- `icons/favicon.ico`, `favicon-32.png` — icon tab browser
- `icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` — untuk
  manifest (dipakai Android/Chrome, bonus kalau nanti mau PWA Android juga)
- `manifest.webmanifest` — deskripsi PWA (nama app, warna, icon)
- `snippet-head-blogger.html` — kode yang ditempel ke tema Blogger

## Langkah setup

### 1. Upload semua icon ke Blogger, dapatkan URL-nya
Blogger otomatis meng-host gambar begitu diupload ke sebuah post/halaman.
Caranya:
1. Buat 1 **Draft baru** di Blogger (tidak perlu dipublish, boleh dihapus
   nanti setelah selesai — atau biarkan draft selamanya, tidak akan tampil
   ke publik).
2. Upload **semua file di folder `icons/`** satu-satu ke draft itu (tombol
   sisip gambar).
3. Untuk tiap gambar: klik kanan → **"Copy image address"** (atau klik
   gambarnya di editor, lalu buka di tab baru dan salin URL-nya). URL-nya
   akan berbentuk seperti:
   `https://blogger.googleusercontent.com/img/a/AVvXsEi.....s1600/apple-touch-icon.png`
4. Catat URL untuk tiap file — akan dipakai di langkah berikutnya.

> Tips: hapus bagian `s1600` (atau angka serupa) di URL kalau mau ukuran
> asli tanpa resize otomatis Blogger, meskipun untuk icon sekecil ini
> biasanya tidak masalah.

### 2. Isi `manifest.webmanifest`
Buka file `manifest.webmanifest`, ganti 3 URL icon di dalamnya dengan URL
hasil upload `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` dari
langkah 1. Lalu upload file `manifest.webmanifest` ini juga ke draft yang
sama, dan salin URL-nya (akan berakhiran `.webmanifest` atau kadang
Blogger memaksanya jadi ekstensi lain — kalau begitu, lihat opsi alternatif
di bagian "Kalau manifest tidak mau ke-upload" di bawah).

### 3. Tempel `snippet-head-blogger.html` ke tema
1. Blogger Dashboard → **Tema** → menu titik tiga → **Edit HTML**.
2. Cari tag `</head>` (pakai Ctrl+F di editor).
3. Tempel isi `snippet-head-blogger.html` **tepat sebelum** `</head>`.
4. Ganti semua `GANTI_DENGAN_URL_...` dengan URL asli dari langkah 1 & 2.
5. Simpan tema.

### 4. Kalau manifest tidak mau ke-upload sebagai file
Blogger kadang menolak upload file non-gambar. Alternatifnya, tempel isi
`manifest.webmanifest` langsung sebagai **data URI** di tag `<link>`, tanpa
perlu hosting terpisah. Ganti baris manifest di snippet dengan:
```html
<link rel="manifest" href="data:application/manifest+json,%7B%22name%22%3A%22SIAKAD%22%2C%22short_name%22%3A%22SIAKAD%22%2C%22start_url%22%3A%22https%3A%2F%2Fujicobagratis02.blogspot.com%2F%22%2C%22display%22%3A%22standalone%22%2C%22background_color%22%3A%22%231e63e0%22%2C%22theme_color%22%3A%22%231e63e0%22%7D"/>
```
(Ini cukup untuk Android; untuk iOS langkah 1–3 di atas sudah cukup tanpa
manifest sama sekali, karena iOS mengandalkan `apple-touch-icon`.)

### 5. Coba di iPhone
1. Buka `https://ujicobagratis02.blogspot.com` di **Safari** (harus Safari,
   Chrome/Firefox di iOS tidak bisa Add to Home Screen).
2. Tap tombol **Share** (kotak dengan panah ke atas) di toolbar bawah.
3. Scroll, tap **"Add to Home Screen"**.
4. Cek preview icon & nama — harusnya sudah muncul icon "Administrasi
   Guru" dan nama "SIAKAD". Tap **Add**.
5. Buka dari Home Screen — akan terbuka **tanpa address bar Safari**
   (mode `standalone`), terasa seperti aplikasi asli.

## Kenapa hasilnya bukan file .ipa / aplikasi App Store?

PWA ("Add to Home Screen") bukan aplikasi native dan **tidak lewat App
Store** — cukup dibuka dari Safari lalu ditambahkan, gratis dan instan,
tapi user harus melakukan langkah "Add to Home Screen" itu sendiri (tidak
bisa didistribusikan sebagai file yang diinstal langsung, karena iOS
membatasi instalasi aplikasi resmi hanya lewat App Store atau
TestFlight/Enterprise certificate berbayar). Kalau ke depannya kamu butuh
distribusi lewat App Store beneran, itu jalur terpisah (perlu akun Apple
Developer $99/tahun + Xcode build) — beri tahu saya kalau mau dibantu ke
arah situ.
