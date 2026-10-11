// Offline support: keeps the app's files in the browser so Pikolo opens without a connection.
// Bump VERSION whenever a file changes, so returning visitors get the new files.
const VERSION = "pikolo-1";
const FILES = [
  "./", "index.html", "manifest.webmanifest",
  "app/font.css", "app/style.css", "app/app.js", "app/topics.js", "app/pictures.js", "app/sounds.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// cached copy first, network for anything else
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
