// Offline support and fast starts: everything the app loads is kept on the device and served from there first.
// - The app itself (page, scripts, styles) is refreshed in the background, so a new version shows on the next start.
// - Packs (pictures, sounds, voice, photos) carry their version in the URL (?v=, from app/packs.js) and are kept as
//   they are until a new version replaces them.
// - The speech models (app/vosk/*.tar.gz) are kept by Vosk itself, so not a second time here.
// Bump VERSION when this file or the list of app files changes.
const VERSION = "pikolo-31";
const CACHE = "pikolo"; // one cache across versions: what was downloaded stays for offline use
const SHELL = [
  "./", "index.html", "manifest.webmanifest",
  "app/font.css", "app/style.css", "app/packs.js", "app/topics.js", "app/levels.js", "app/words.js",
  "app/lang/de.js", "app/lang/it.js", "app/app.js",
  "icons/icon.svg", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.endsWith(".tar.gz")) return;
  const isPack = url.searchParams.has("v");
  e.respondWith(caches.open(CACHE).then(async cache => {
    const saved = await cache.match(e.request, { ignoreSearch: !isPack });
    if (saved && isPack) return saved;
    const fresh = fetch(e.request).then(async res => {
      if (res.ok) {
        if (isPack) { // drop the older versions of this pack
          const old = await cache.keys();
          await Promise.all(old.filter(r => new URL(r.url).pathname === url.pathname).map(r => cache.delete(r)));
        }
        await cache.put(e.request, res.clone());
      }
      return res;
    });
    if (saved) { e.waitUntil(fresh.catch(() => {})); return saved; }
    // not saved yet: from the network, or offline an older version of the pack
    return fresh.catch(() => cache.match(e.request, { ignoreSearch: true }).then(r => r || Response.error()));
  }));
});
