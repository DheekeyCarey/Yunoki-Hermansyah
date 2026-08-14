# ADM Premium Guru Mapel - Desktop & iPhone App (Tauri)

This is a **desktop** (Windows/macOS/Linux) + **iPhone/iPad (PWA)** wrapper for the
"ADM Premium - Sistem Administrasi Guru Mapel" web app, built with [Tauri](https://tauri.app).
The setup is identical to the "Guru Kelas" version built previously, only the app
identity differs (name, identifier, backend) so it **can be installed side-by-side** on the
same computer/phone without conflicting.

The frontend (`src/index.html` & `docs/index.html`) is a conversion of the original Blogger
template (`b:skin`, `b:include`, etc. tags have been removed so it can run as plain HTML), and
the **Print to PDF function has been fixed** so it no longer depends on Chrome's built-in
PDF viewer — this applies both in the Tauri desktop app and in the iPhone (PWA) version, see the
"What's been fixed" section below.

## ⚠️ IMPORTANT: the backend is NOT bundled into the desktop app

This app's backend (`backend-apps-script/Code.gs`) is a **Google Apps Script**, i.e. code
that runs on Google's servers (using Google Sheets as the database), NOT code that gets compiled
into the .exe/.dmg/.AppImage file or into the web PWA version. This app is just a "browser
window" that loads `index.html`, and that page communicates with the backend over the internet
(`fetch(GAS_URL)`).

So the correct order is:
1. **Deploy the backend first** to Google Apps Script (see the steps below) → you'll get a URL.
2. **Fill in that URL** as `GAS_URL` in **TWO places**: `src/index.html` (desktop) AND
   `docs/index.html` (iPhone PWA) — two separate files, fill in both manually.
3. Then push to GitHub and build/enable Pages.

> If you're also using the "ADM Premium Guru Kelas" project, note that this backend is
> **separate** — deploy the Apps Script individually (a different Google Sheet database, with
> different sheets too: `Data_Nilai`, `Jadwal`, etc. specific to the subject-teacher needs), don't
> mix it into the same Apps Script as the Guru Kelas version.

### How to deploy the backend (one-time, ~5 minutes)
1. Create a new Google Sheet (this will be the "database", separate from the Guru Kelas one).
2. Menu **Extensions → Apps Script**.
3. Delete the default `Code.gs` content, then paste the entire contents of the
   `backend-apps-script/Code.gs` file from this folder.
4. Click **Deploy → New deployment**.
5. Choose type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, grant the permissions Google asks for, then copy the **Web app URL** that
   appears (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).
7. The default login password is in the **Pengaturan** sheet (`Password_Login` column), default
   is `admin123` — change it after your first login.

> If you edit the backend again later, redo the deployment with **New deployment** (not editing
> the old deployment) so the URL stays the same and you don't need to change `GAS_URL` in the
> frontend.

### Fill in the URL in the frontend
Open `src/index.html` AND `docs/index.html` (fill it in in both), find the line (around line
2108):
```js
const GAS_URL = "URL_APPS_SCRIPT_ANDA_DISINI";
```
Replace it with the URL from the deploy step above, for example:
```js
const GAS_URL = "https://script.google.com/macros/s/AKfycbXXXXXXXXXXXXXXXXXXXXXXXX/exec";
```

## What's been fixed from the original web version

The **Print to PDF** button in the web version used `window.open()` to a PDF blob and then
called `autoPrint()`; this approach depends on Chrome's built-in PDF viewer. The Tauri webview
(WebView2/WebKitGTK/WKWebView) and iOS Safari standalone mode (PWA) both don't have that kind of
PDF viewer, so the print dialog never appears there. Detection for `window.__TAURI__` (desktop)
and `navigator.standalone` (iOS PWA) has been added: if either is detected, the system
immediately downloads the PDF file, and the user just opens that file with the device's default
PDF app (Adobe Reader, Preview, Files, etc.) which definitely has its own print button. In a
regular browser (web/Chrome), the old behavior (auto-print in a new tab) still works as before.

## Folder structure
```
adm-premium-mapel-desktop/
├── src/index.html               ← frontend for the desktop app (Tauri)
├── src-tauri/                   ← Rust/Tauri project
│   ├── tauri.conf.json          ← identifier: com.jackyardiyan.admpremiummapel (different from Guru Kelas)
│   ├── Cargo.toml
│   ├── src/main.rs
│   └── icons/                   ← auto-generated from the icon.png you upload
├── docs/                        ← PWA version for iPhone/iPad (see the "iPhone Version" section below)
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── backend-apps-script/Code.gs  ← backend REFERENCE, pasted manually into Apps Script (see above)
├── .github/workflows/build.yml  ← GitHub Actions, auto-builds for 3 platforms (desktop)
└── package.json
```

## How to push to GitHub & auto-build (Desktop)

```bash
cd adm-premium-mapel-desktop
git init
git add .
git commit -m "Initial setup of ADM Premium Guru Mapel desktop app"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO-NAME.git
git push -u origin main

# Trigger build: create a version tag then push the tag
git tag v1.0.0
git push origin v1.0.0
```

Once the tag is pushed, open the **Actions** tab in your GitHub repo — the "Build Aplikasi
Desktop ADM Premium Guru Mapel" workflow will automatically run a build for **Windows
(.msi/.exe)**, **macOS (.dmg)**, and **Linux (.AppImage/.deb)** all at once. The results will
automatically appear as a **Draft Release** in the **Releases** tab — just open the draft, check
it, then click **Publish**.

If you don't want to create a tag first (e.g. just want to test the build), open the **Actions →
Build Aplikasi Desktop ADM Premium Guru Mapel → Run workflow** tab to trigger it manually — the
results will appear as **Artifacts** on that run's page (not a Release).

## Building on your own computer (optional, without GitHub Actions)
You need Node.js 18+ and Rust (https://rustup.rs) installed, then:
```bash
npm install
npx tauri build
```
The installer output will be in `src-tauri/target/release/bundle/`.

## iPhone/iPad Version (PWA - "Add to Home Screen")

The `docs/` folder contains the **PWA** version of this app, specifically so it can be
"installed" on iPhone/iPad **without** needing an Apple Developer account ($99/year) and without
building an IPA — it just needs to be hosted as a regular web page, and the user adds it to their
Home Screen from Safari.

### 1. Fill in GAS_URL
`docs/index.html` is a separate file from `src/index.html` (desktop) — fill in `GAS_URL` (around
line 2108) in this file as well (same URL as in the backend deploy step above).

### 2. Enable GitHub Pages (one-time)
1. Push this repo to GitHub (same git steps as above).
2. In the GitHub repo → **Settings → Pages**.
3. **Build and deployment → Source**: choose **Deploy from a branch**.
4. Branch: **main**, folder: **/docs** → **Save**.
5. Wait 1-2 minutes; the public URL will usually be: `https://USERNAME.github.io/REPO-NAME/`

### 3. How to install on iPhone (done by each teacher, once per phone)
1. Open **Safari** (not Chrome) to the GitHub Pages URL above.
2. Tap the **Share** icon in the bottom toolbar.
3. Choose **"Add to Home Screen"**.
4. Tap **Add**. The app icon will appear on the home screen, displaying fullscreen without an
   address bar.

No App Store needed, no 7-day expiration, no cost.

> If on the same phone you also want to install the "Guru Kelas" version, that's fine — both have
> different `start_url`/`scope` and different icon names (manifest `short_name`: "ADM Premium
> Mapel" vs "ADM Premium"), so they'll still appear as 2 separate icons on the Home Screen.

## Note about "unidentified developer" / SmartScreen warnings
Because this installer is not signed with a paid certificate (code signing), Windows
SmartScreen and macOS Gatekeeper will show a warning the first time it's run. This is normal for
apps without an official certificate — click "More info → Run anyway" (Windows) or right-click →
Open (macOS).
