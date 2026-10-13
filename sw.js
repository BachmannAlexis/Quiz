// Offline support: keeps the app's files in the browser so Pikolo opens without a connection.
// Bump VERSION when the list of files changes.
const VERSION = "pikolo-16";
const FILES = [
  "./", "index.html", "manifest.webmanifest",
  "app/font.css", "app/style.css", "app/app.js", "app/words.js", "app/lang/de.js", "app/lang/it.js", "app/topics.js", "app/levels.js", "app/pictures.js", "app/sounds.js",
  "app/voice/en/common.json", "app/voice/fr/common.json",
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

// Latest version first, so fixes reach everyone right away; the saved copy when offline.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
