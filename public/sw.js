// Caches the app shell so legal.xyz opens offline and installs as an app. Workspace data
// never passes through here: it lives encrypted in the browser's own storage.
const CACHE = "legalxyz-v19";
const SHELL = [
  "./", "index.html", "styles.css", "analytics.js", "vault.js", "pdf.js", "workspace.js", "counsel.js", "app.js", "landing.js", "ui.js", "docs.js", "home.js",
  "manifest.webmanifest", "assets/bg.png", "assets/logo.png", "assets/icon.png", "assets/wordmark.png",
  "assets/icon-192.png", "assets/icon-512.png", "assets/mark.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// Network first, so updates arrive immediately; fall back to the cache when offline.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Never cache the API or the admin page: application data must not sit in the cache.
  if (url.pathname.startsWith("/api/") || /\/admin(\.html|\.js)?$/.test(url.pathname)) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("index.html")))
  );
});
