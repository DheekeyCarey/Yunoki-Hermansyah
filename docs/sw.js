// Service worker minimal. Tujuannya CUMA supaya browser mau menganggap ini "PWA yang layak
// diinstall" dan supaya shell app (index.html sendiri) tetap bisa dibuka walau sinyal internet
// putus sesaat. TIDAK meng-cache data dari GAS_URL (data guru harus selalu fresh dari server)
// ataupun library CDN (Tailwind/SweetAlert2/jsPDF/dst -- biarkan browser yang urus caching-nya
// sendiri lewat HTTP cache biasa, supaya update versi library baru otomatis kepakai).
const CACHE_NAME = 'adm-premium-shell-v1';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Hanya tangani permintaan same-origin ke file app-shell. Semua request lain (fetch ke
  // GAS_URL, CDN eksternal, gambar, dsb) dibiarkan lewat langsung ke network seperti biasa.
  const isAppShellRequest =
    url.origin === self.location.origin &&
    (url.pathname.endsWith('/') || url.pathname.endsWith('index.html') || url.pathname.endsWith('manifest.json'));

  if (!isAppShellRequest) return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
