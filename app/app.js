// Pikolo: a picture quiz for little ones. Data is in topics.js, pictures in pictures.js,
// instrument sounds in sounds.js (loaded in the background by index.html).
"use strict";

const SHARE_URL = "https://bachmannalexis.github.io/Quiz/";

const MODE_ICONS = { name: "image", say: "mic", listen: "ear", play: "keys", explore: "search", read: "book" };
// an icon from the sprite in index.html (one line style for every control)
const icon = (id, cls = "") => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;

// ---------- State ----------
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

// the languages: each item has a name per language; says, like and unit are arrays in this order
const LANGS = ["en", "fr", "de", "it"];
const deviceLang = (navigator.language || "en").slice(0, 2).toLowerCase();
let lang = store.get("quiz-lang", LANGS.includes(deviceLang) ? deviceLang : "en");
if (!LANGS.includes(lang)) lang = "en";
const li = () => LANGS.indexOf(lang);
let topic = TOPICS.find(t => t.id === store.get("quiz-topic")) || TOPICS[0];
const groupOf = {}; // topic id -> chosen group
TOPICS.forEach(t => { groupOf[t.id] = store.get("quiz-group-" + t.id, "all"); });
// difficulty per topic: 1 easy (common items, 2 pictures), 2 medium (3 pictures), 3 hard (everything, 4 pictures);
// each item's level comes from app/levels.js (not listed: medium)
const levelOf = {};
TOPICS.forEach(t => {
  levelOf[t.id] = +store.get("pikolo-level-" + t.id, 2);
  const L = (typeof LEVELS !== "undefined" && LEVELS[t.id]) || {};
  const easy = new Set(L.easy || []), hard = new Set(L.hard || []);
  t.items.forEach(i => { i.level = easy.has(i.id) ? 1 : hard.has(i.id) ? 3 : i.lvl || 2; });
});
const choices = () => levelOf[topic.id] + 1;
// a topic's items in the current language: sounds and words to read differ by language (`only`)
const itemsOf = t => t.items.filter(i => !i.only || i.only === lang);
const ITEMS = new Map(TOPICS.flatMap(t => t.items.map(i => [i.id, i])));
let screen = "home";
let deck = []; // items still to ask this game, so nothing repeats
let mode = "name", round = 0, stars = 0, answer = null, locked = false, firstTry = true, lastAnswer = null;
let asked = 0, thinking = [], missed = [];  // for the scores: when the question was asked, seconds to the first tap, missed answers
let gameId = 0;     // bumps when a game starts or ends, so its pending timers do nothing
let questionId = 0; // bumps every question, so stale timers and speech callbacks do nothing

const T = () => TEXT[lang];
const isMusic = () => topic.id === "instruments";
// a recording to play (instruments, landscapes, many animals), or a sound the voice makes
// (the other animals, dinosaurs)
const hasRecording = item => isMusic() || !!item.sound;
const hasSound = item => hasRecording(item) || !!soundOf(item);
// how an item sounds, so the listening game never offers two that sound alike
const soundFamily = item => item.hears || item.family;
const nameOf = item => item[lang];
// the name without its article, shown on the cards: "la flûte à bec" -> "Flûte à bec", "der Hund" -> "Hund"
const ARTICLE = { fr: /^(le |la |les |l')/, de: /^(der |die |das )/, it: /^(il |lo |la |i |gli |le |l')/ };
const shortName = item => item.parts || item.grapheme ? item[lang] : cap(ARTICLE[lang] ? item[lang].replace(ARTICLE[lang], "") : item[lang]);
const soundOf = item => item.says && item.says[li()];
const likeOf = item => item.like && item.like[li()];
const unitOf = t => t.unit[li()];
// plural: English and French from `many` (French also from "les"), German and Italian from their translation
const manyOf = item => lang === "en" || lang === "fr" ? item.many : !!(item.plural && item.plural[lang]);

// ---------- Speech ----------
const isAndroid = /android/i.test(navigator.userAgent);
let voices = [];
function loadVoices() { if ("speechSynthesis" in window) voices = speechSynthesis.getVoices(); }
// The voice for the current language. Elsewhere only voices installed on the device are
// used: online ones (many "Google" or "Natural" voices) can stay silent in embedded previews.
// Android often ignores the language unless a voice is chosen, so there any voice of the
// language is fine (its voices are not always marked as installed). Without a match, the
// browser chooses from the language alone.
const langOf = v => v.lang.replace("_", "-").toLowerCase();
function voiceFor() {
  if (!voices.length) loadVoices();
  const mine = voices.filter(v => langOf(v).startsWith(lang) && (isAndroid || v.localService));
  const main = { en: "en-us", fr: "fr-fr", de: "de-de", it: "it-it" }[lang];
  const score = v => (v.localService ? 4 : 0) + (langOf(v) === main ? 2 : 0) + (v.default ? 1 : 0) +
    (/premium|enhanced|siri|samantha|amélie|thomas|audrey/i.test(v.name) ? 1 : 0);
  return mine.sort((a, b) => score(b) - score(a))[0] || null;
}

const keep = []; // Chrome can drop the events of utterances it no longer references
let sayId = 0;
// ---------- Recorded voice ----------
// Every sentence is recorded in advance (tools/make_voice.py) so the voice sounds the same
// on every device, even without any text-to-speech installed. Packs per language and topic
// (app/voice/<lang>/<pack>.json: sentence -> MP3) load when needed; a sentence without a
// recording falls back to the device's own voice.
const clips = Object.fromEntries(LANGS.map(l => [l, {}])); // sentence -> data URI, from the packs loaded so far
const packs = {};                   // "fr/animals" -> Promise
function loadPack(l, name) {
  const key = l + "/" + name;
  if (!packs[key]) {
    loading[key] = packs[key] = fetch(packUrl(`voice/${key}.json`))
      .then(r => (r.ok ? r.json() : {}))
      .then(map => Object.assign(clips[l], map))
      .catch(() => {}) // offline from a file, or no pack: the device voice speaks instead
      .then(() => { delete loading[key]; });
  }
  return packs[key];
}
const loading = {};                 // packs still downloading
// Resolves when the packs of the language have arrived (or after `ms`, not to keep a child waiting).
function packsReady(l, ms) {
  const waiting = Object.keys(loading).filter(k => k.startsWith(l + "/")).map(k => loading[k]);
  return waiting.length ? Promise.race([Promise.all(waiting), new Promise(ok => setTimeout(ok, ms))]) : null;
}
function loadVoice() { loadPack(lang, "common"); loadPack(lang, topic.id); }
const clipAudio = {}; // data URI -> Promise<AudioBuffer>
function decodeClip(uri) {
  if (!clipAudio[uri]) {
    const bin = atob(uri.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    clipAudio[uri] = new Promise((ok, fail) => audio().decodeAudioData(bytes.buffer, ok, fail));
    clipAudio[uri].catch(() => { delete clipAudio[uri]; });
  }
  return clipAudio[uri];
}
let voiceSrc = null;
function stopVoice() { if (voiceSrc) { try { voiceSrc.stop(); } catch (e) {} voiceSrc = null; } }

// Speak a sentence, given as one string or as parts ("Yes! The cow!", "The cow says moo!").
// onDone runs once when it ends (or fails, or seems stuck). `report`, if given, hears what
// happens (used by the voice test in the parents' sheet).
function say(parts, onDone, report) {
  parts = [].concat(parts).filter(Boolean);
  const text = parts.join(" ");
  let done = false;
  const finish = () => { if (!done) { done = true; onDone && onDone(); } };
  const note = m => report && report(m);
  const id = ++sayId;
  stopVoice();
  const busy = "speechSynthesis" in window && (speechSynthesis.speaking || speechSynthesis.pending);
  if (busy) speechSynthesis.cancel();
  // a pack still downloading (first sentences of a topic): wait for it a moment
  if (!parts.every(p => clips[lang][p])) {
    const ready = packsReady(lang, 2500);
    if (ready) {
      ready.then(() => { if (id === sayId) speakParts(parts, id, finish, note, busy); });
      if (onDone) setTimeout(finish, 6500 + text.length * 110);
      return;
    }
  }
  speakParts(parts, id, finish, note, busy);
  if (onDone) setTimeout(finish, 4000 + text.length * 110); // never leave a game waiting
}

function speakParts(parts, id, finish, note, busy) {
  // recorded clips, one after another
  const uris = parts.map(p => clips[lang][p]);
  if (uris.length && uris.every(Boolean)) {
    note("recorded voice");
    let i = 0;
    const next = () => {
      if (id !== sayId) return;
      if (i >= uris.length) { note("end"); return finish(); }
      decodeClip(uris[i++]).then(buf => {
        if (id !== sayId) return;
        const src = audio().createBufferSource();
        src.buffer = buf;
        src.connect(audio().destination);
        src.onended = () => { if (voiceSrc === src) voiceSrc = null; next(); };
        voiceSrc = src;
        src.start();
        if (i === 1) note("start");
      }, () => { if (id === sayId) speakDevice(parts.slice(i - 1).join(" "), id, finish, note, false); });
    };
    next();
    return;
  }
  speakDevice(parts.join(" "), id, finish, note, busy);
}

// The device's own text-to-speech. `busy`: a sentence was just cancelled.
function speakDevice(text, id, finish, note, busy) {
  if (!("speechSynthesis" in window)) { note("unsupported"); setTimeout(finish, 300); return; }
  if (speechSynthesis.paused) speechSynthesis.resume();
  note("device voice");
  const speak = voice => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = T().voice;
    u.rate = 0.85;
    u.pitch = 1.15;
    if (voice) u.voice = voice;
    keep.push(u); if (keep.length > 6) keep.shift();
    let started = false, replaced = false, over = false;
    const retry = () => {
      replaced = true;
      speechSynthesis.cancel();
      setTimeout(() => { if (id === sayId) speak(null); }, 150);
    };
    u.onstart = () => { started = true; note("start"); };
    u.onend = () => { over = true; note("end"); if (!replaced) finish(); };
    u.onerror = e => {
      over = true;
      note("error: " + e.error);
      if (replaced) return;
      // a chosen voice that fails: try once more with the browser's own choice
      if (voice && id === sayId && e.error !== "interrupted" && e.error !== "canceled") retry();
      else finish();
    };
    speechSynthesis.speak(u);
    // a chosen voice that never starts: same retry (engines can be slow to wake up, so be patient)
    if (voice) setTimeout(() => { if (!started && !over && id === sayId) { note("no start, retrying"); retry(); } }, 4000);
  };
  const voice = voiceFor();
  note("voice: " + (voice ? voice.name : "device default"));
  // Android Chrome drops a sentence spoken right after cancel(), so wait a moment after one
  if (busy) setTimeout(() => { if (id === sayId) speak(voice); }, 150);
  else speak(voice);
}
function hush() { sayId++; stopVoice(); if ("speechSynthesis" in window) speechSynthesis.cancel(); }

// ---------- Sounds ----------
let ctx, current, playToken = 0;
const buffers = {}; // id -> Promise<AudioBuffer>
function audio() {
  if (!ctx) {
    // iPhone and iPad: play even when the ring/silent switch is on silent
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  return ctx;
}
// Browsers only allow sound after a touch: wake the audio on the first one, with a
// silent sound for older iPhones.
function unlockAudio() {
  const c = audio();
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, 22050);
  src.connect(c.destination);
  src.start(0);
  if (c.state === "running") ["pointerdown", "touchend", "keydown"].forEach(e => removeEventListener(e, unlockAudio, true));
}
["pointerdown", "touchend", "keydown"].forEach(e => addEventListener(e, unlockAudio, true));
// ---------- Picture and sound packs ----------
// Pictures and sounds come in packs per topic: app/pictures/<topic>.js (and home.js for the home screen) and
// app/sounds/<topic>.js, each one call addPictures({...}) or addSounds({sounds, notes}). They are read with fetch,
// and from a local file, where fetch does not work, as a script. Each URL carries the pack's version (PACKS, app/packs.js)
// so the service worker can keep it until it changes.
const PICS = {}, SOUNDS = {}, NOTES = {};
function addPictures(map) { Object.assign(PICS, map); }
function addSounds(pack) { Object.assign(SOUNDS, pack.sounds); Object.assign(NOTES, pack.notes); }
const PACK_INFO = typeof PACKS !== "undefined" ? PACKS : {};
const packUrl = path => `app/${path}?v=${(PACK_INFO[path] || [0])[0]}`;
const assetPacks = {};
function loadAsset(kind, name) {
  const path = `${kind}/${name}.js`;
  if (!assetPacks[path]) {
    const add = kind === "pictures" ? addPictures : addSounds;
    assetPacks[path] = fetch(packUrl(path))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(text => add(JSON.parse(text.slice(text.indexOf("(") + 1, text.lastIndexOf(")")))))
      .catch(() => new Promise(ok => {
        const script = document.createElement("script");
        script.src = `app/${path}`;
        script.onload = script.onerror = ok;
        document.head.appendChild(script);
      }))
      .then(() => { if (kind === "pictures") refreshPictures(); });
  }
  return assetPacks[path];
}
const topicOf = {}; // item id -> its topic
TOPICS.forEach(t => t.items.forEach(i => { topicOf[i.id] = t; }));
const hasSoundPack = t => t.id === "instruments" || t.items.some(i => i.sound);
function loadSounds(t = topic) { return hasSoundPack(t) ? loadAsset("sounds", t.id) : Promise.resolve(); }
// Decode a recording the first time it is needed. Tunes are keyed by instrument id,
// play-mode sounds by "id#k".
function recording(id) {
  const [iid, k] = id.split("#");
  return loadSounds(topicOf[iid] || topic).then(() => {
    const uri = k === undefined ? SOUNDS[iid] : (NOTES[iid] || { samples: [] }).samples[k];
    if (!buffers[id] && uri) {
      const bin = atob(uri.split(",")[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      buffers[id] = new Promise((ok, fail) => audio().decodeAudioData(bytes.buffer, ok, fail));
      buffers[id].catch(() => { delete buffers[id]; });
    }
    return buffers[id] || Promise.reject();
  });
}
function tone(freq, start, len, wave = "sine", vol = 0.25) {
  const a = audio(), o = a.createOscillator(), g = a.createGain();
  o.type = wave; o.frequency.value = freq;
  const t = a.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + len + 0.05);
}
// the sound playing now (a tune or a play-mode note); a new one stops it, with a short fade so it does not click
function stopSound() {
  if (!current) return;
  const { src, gain } = current, t = audio().currentTime;
  current = null;
  try { gain.gain.setValueAtTime(gain.gain.value, t); gain.gain.linearRampToValueAtTime(0, t + 0.04); src.stop(t + 0.05); } catch (e) {}
}
function startSound(buffer, rate = 1) {
  const c = audio(), src = c.createBufferSource(), gain = c.createGain();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  src.connect(gain).connect(c.destination);
  src.start();
  current = { src, gain };
}
function playInstrument(inst) {
  stopSound();
  const token = ++playToken;
  // waits for the recording if it is still loading; a newer play request wins
  recording(inst.id).then(b => {
    if (token !== playToken) return;
    stopSound();
    startSound(b);
  }, () => {
    // no recording (sounds.js could not load): an animal still says its sound with the voice
    if (token === playToken && inst.says) say(extra(inst));
  });
}
// Play-mode keys: one octave of the major scale, do ré mi fa sol la si do, in rainbow colours.
// Play-mode keyboard: one octave like a piano, 8 white keys (do to do) and 5 black keys on top.
const PIANO = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(step => ({ step, black: [1, 3, 6, 8, 10].includes(step) }));
const KEY_STEPS = PIANO.map(k => k.step);
const KEY_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#7cb342", "#26a69a", "#1e88e5", "#5e35b1", "#e53935"];
const KEY_NAMES = { en: ["C", "D", "E", "F", "G", "A", "B", "C"], fr: ["do", "ré", "mi", "fa", "sol", "la", "si", "do"],
  de: ["C", "D", "E", "F", "G", "A", "H", "C"], it: ["do", "re", "mi", "fa", "sol", "la", "si", "do"] };
function playNote(inst, k) {
  stopSound();
  const token = ++playToken;
  const info = NOTES[inst.id];
  // several sounds (drum kit, tabla): one per key; one sound: tuned up and down
  const many = info.samples.length > 1;
  const steps = many ? 0 : info.pitched ? KEY_STEPS[k] : KEY_STEPS[k] / 2;
  recording(inst.id + "#" + (many ? k % info.samples.length : 0)).then(b => {
    if (token !== playToken) return; // a newer key was pressed meanwhile
    stopSound();
    startSound(b, Math.pow(2, steps / 12));
  }, () => {});
}
function cheer() { [523, 659, 784, 1047].forEach((n, i) => tone(n, i * 0.09, 0.25, "triangle", 0.2)); }
function boop() { tone(220, 0, 0.2, "sine", 0.2); tone(180, 0.12, 0.25, "sine", 0.2); }
function fanfare() { [523, 659, 784, 659, 784, 1047].forEach((n, i) => tone(n, i * 0.13, 0.35, "triangle", 0.2)); }

// ---------- Pools ----------
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const families = items => new Set(items.map(i => i.family)).size;
function groupPool() {
  const g = groupOf[topic.id];
  const all = itemsOf(topic), group = g === "all" || !topic.groups ? all : all.filter(i => i.styles.includes(g));
  // the items of the chosen level and below; the whole group when that leaves too few kinds to choose from
  const pool = group.filter(i => i.level <= levelOf[topic.id]);
  return families(pool) >= choices() + 1 ? pool : group;
}
// what a game asks about: in the listening game, only items with a sound; if the chosen
// group has too few, all of the topic's
function gamePool() {
  if (mode !== "listen") return groupPool();
  const pool = groupPool().filter(hasSound);
  return new Set(pool.map(soundFamily)).size >= choices() ? pool : itemsOf(topic).filter(hasSound);
}
// what the voice adds after naming an item: an animal's or dinosaur's sound, or a mushroom warning
function extra(item) {
  if (soundOf(item)) return T().says(nameOf(item), soundOf(item), likeOf(item));
  if (item.blend) return T().blend(item.blend[0], item.blend[1], nameOf(item)); // "m… a… ma!"
  if (item.poison) return T().poison;
  if (item.from) { const c = ITEMS.get(item.from); return T().from(nameOf(item), c[lang], manyOf(item), manyOf(c)); }
  if (item.feel) return item.feel[li()]; // "I feel scared when there is thunder."
  if (item.word) return T().soundAs(nameOf(item), item.word); // "« ou » comme loup !"
  if (item.parts) return soundOut(item); // "lu… ne… lune !"
  return "";
}

// a word sounded out, then said: "lu… ne… lune !", English sound by sound ("[[ k ]]… [[ æ ]]… [[ t ]]… cat!")
function soundOut(item) {
  const parts = item.parts.map(p => p.startsWith("/") ? `[[ ${p.slice(1)} ]]` : p);
  return parts.length > 1 || item.parts[0].startsWith("/") ? T().soundOut(parts.join("… "), nameOf(item)) : T().name(nameOf(item), true);
}

// ---------- Screens ----------
// ---------- Pictures: drawings, or real photos (chosen at the first start) ----------
// Photos come in packs per topic (app/photos/<topic>.json: id -> image, built by
// tools/make_photos.py), plus "covers" for the home screen. Items without a photo (letters)
// keep their drawing.
let look = store.get("pikolo-look");          // "drawings" or "photos"; null until chosen
const photos = {}, photoPacks = {}, photoLoading = new Set();
function loadPhotos(name, always) {
  if ((look !== "photos" && !always) || photoPacks[name]) return photoPacks[name];
  photoLoading.add(name);
  return photoPacks[name] = fetch(packUrl(`photos/${name}.json`))
    .then(r => (r.ok ? r.json() : {}))
    .then(map => Object.assign(photos, map))
    .catch(() => {}) // offline from a file: drawings instead
    .then(() => { photoLoading.delete(name); refreshPictures(); });
}
function srcOf(id) {
  if (look === "photos" && photos[id]) return photos[id];
  if (look === "photos" && photoLoading.size) return ""; // its photo may be on the way
  return PICS[id];
}
function setPicture(img, id) {
  img.dataset.pic = id;
  const src = srcOf(id);
  if (src) img.src = src; else img.removeAttribute("src");
  img.classList.toggle("photo", look === "photos" && !!photos[id]);
}
function refreshPictures() {
  document.querySelectorAll("img[data-pic]").forEach(img => setPicture(img, img.dataset.pic));
}
function picture(id, cls) {
  const img = document.createElement("img");
  img.alt = "";
  img.draggable = false;
  if (cls) img.className = cls;
  setPicture(img, id);
  return img;
}
function setLook(l) {
  look = l;
  store.set("pikolo-look", l);
  document.body.classList.toggle("photos", l === "photos");
  loadPhotos("covers");
  if (screen !== "look") loadPhotos(topic.id);
  refreshPictures();
  if (l === "photos" && navigator.serviceWorker && navigator.serviceWorker.controller) offlineSoon();
}
// The phone's back button (or gesture) goes back one screen: from a game, the end or Discover to the topic, from
// the topic to home, and closes an open sheet, instead of leaving the app. Each screen deeper than home adds a
// history entry; leaving a screen with the app's own buttons removes it again.
const DEPTH = { look: 0, home: 0, topic: 1, game: 2, play: 2, done: 2 };
let depth = 0, skipPops = 0;
function syncHistory(d) {
  try {
    while (depth < d) history.pushState({ pikolo: ++depth }, "");
    if (depth > d) { skipPops++; history.go(d - depth); depth = d; }
  } catch (e) {} // no history (some embedded previews): the buttons still work
}
addEventListener("popstate", e => {
  if (skipPops) { skipPops--; return; }
  const open = document.querySelector("dialog[open]");
  if (open) { open.close(); return; } // back closes the open sheet (its own history entry is gone)
  depth = (e.state && e.state.pikolo) || 0;
  if (depth < 2 && DEPTH[screen] === 2) backToTopic();
  if (depth < 1 && screen === "topic") goHome();
});

// a sheet (parents, language, scores) adds a history entry too, so back closes it
function openSheet(d) {
  d.showModal();
  try { history.pushState({ pikolo: depth, sheet: 1 }, ""); } catch (e) { return; }
  d.addEventListener("close", () => { if (history.state && history.state.sheet) { skipPops++; history.back(); } }, { once: true });
}

function show(name) {
  syncHistory(DEPTH[name] || 0);
  screen = name;
  document.querySelectorAll(".screen").forEach(s => { s.hidden = s.id !== name; });
  document.body.classList.toggle("themed", name !== "home" && name !== "look");
  window.scrollTo(0, 0);
}
function theme() {
  document.body.style.setProperty("--accent", topic.color);
  document.body.style.setProperty("--tint", topic.tint);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", screen === "home" ? "#6c47ff" : topic.color);
}
const bestKey = (t, m, l = levelOf[t.id]) => `quiz-best-${t.id}-${m}` + (l === 2 ? "" : "-l" + l); // medium keeps the old key
function bestOf(t) { return Math.max(0, ...t.modes.flatMap(m => [1, 2, 3].map(l => +store.get(bestKey(t, m, l), 0)))); }

function renderHome() {
  const grid = $("topicGrid");
  grid.innerHTML = "";
  TOPICS.forEach(t => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "topic-card";
    b.style.setProperty("--card-color", t.color);
    b.style.setProperty("--card-tint", t.tint);
    const name = document.createElement("strong");
    name.textContent = t[lang];
    const count = document.createElement("small");
    count.textContent = T().count(itemsOf(t).length, unitOf(t));
    b.append(picture(t.pic), name, count);
    const best = bestOf(t);
    if (best) {
      const badge = document.createElement("span");
      badge.className = "best";
      badge.innerHTML = `${icon("star", "gold")} ${best}`;
      b.appendChild(badge);
    }
    b.onclick = () => { audio(); openTopic(t); say(t[lang]); };
    grid.appendChild(b);
  });
}

function openTopic(t) {
  topic = t;
  store.set("quiz-topic", t.id);
  loadVoice();
  loadPhotos(t.id);
  loadAsset("pictures", t.id);
  loadSounds(t).catch(() => {});
  theme();
  renderTopic();
  show("topic");
}

const LEVEL_DOTS = ["🟢", "🟡", "🔴"]; // in the scores text
function renderTopic() {
  $("topicTitle").textContent = topic[lang];
  const hero = $("topicHero");
  hero.innerHTML = "";
  // three pictures of different kinds, the first one in the middle
  const picks = [];
  for (const i of groupPool()) if (picks.length < 3 && !picks.some(p => p.family === i.family)) picks.push(i);
  [picks[1], picks[0], picks[2]].filter(Boolean).forEach(i => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hero-pic";
    b.setAttribute("aria-label", nameOf(i));
    b.appendChild(picture(i.id));
    b.onclick = () => { playing = i; sayItem(); };
    hero.appendChild(b);
  });
  const groups = $("groups");
  groups.innerHTML = "";
  groups.hidden = !topic.groups;
  (topic.groups || []).forEach(g => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.setAttribute("aria-pressed", g.id === groupOf[topic.id]);
    const label = document.createElement("span");
    label.textContent = g[lang];
    b.append(picture(g.pic), label);
    b.onclick = () => {
      groupOf[topic.id] = g.id;
      store.set("quiz-group-" + topic.id, g.id);
      renderTopic();
      if (isMusic()) playInstrument(ITEMS.get(g.pic)); // a taste of the style
      else say(g[lang]);
    };
    groups.appendChild(b);
  });
  const levels = $("levels");
  levels.innerHTML = "";
  T().levels.forEach((name, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip level";
    b.setAttribute("aria-pressed", k + 1 === levelOf[topic.id]);
    b.innerHTML = `<span class="dot l${k + 1}"></span>`;
    b.append(name);
    b.onclick = () => {
      levelOf[topic.id] = k + 1;
      store.set("pikolo-level-" + topic.id, String(k + 1));
      renderTopic();
      say(name);
    };
    levels.appendChild(b);
  });
  const modes = $("modes");
  modes.innerHTML = "";
  topic.modes.forEach(m => {
    const [title, sub] = modeText(topic, m);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode";
    b.innerHTML = `<span class="mode-icon">${icon(m === "explore" && topic.id === "clock" ? "clock" : MODE_ICONS[m])}</span><span class="mode-text"><strong></strong><small></small></span><span class="mode-go">${icon("chevron")}</span>`;
    b.querySelector("strong").textContent = title;
    b.querySelector("small").textContent = sub;
    const best = +store.get(bestKey(topic, m), 0);
    if (best && (m === "name" || m === "listen")) b.querySelector("small").textContent += ` · ⭐ ${best}`;
    b.onclick = () => start(m);
    modes.appendChild(b);
  });
}

// a game's title and subtitle; the listening game is named after what you hear
function modeText(t, m) {
  const key = m === "listen" ? { instruments: "listenMusic", scenery: "listenScenery", dinosaurs: "listenDinosaurs", kitchen: "listenKitchen", letters: "listenLetters", transport: "listenTransport", weather: "listenWeather" }[t.id] || "listenAnimals"
    : m === "name" ? { letters: "nameLetters", syllables: "nameSyllables", sounds: "nameSounds" }[t.id] || m
    : m === "say" && (t.id === "sounds" || t.id === "reading") ? "sayRead"
    : m === "explore" && (t.id === "sounds" || t.id === "reading") ? "exploreCards"
    : m === "explore" && t.id === "clock" ? "exploreClock" : m;
  return T().modes[key];
}

function goHome() {
  stopEverything();
  renderHome();
  show("home");
  theme();
}
function backToTopic() {
  stopEverything();
  renderTopic();
  show("topic");
}
function stopEverything() {
  gameId++; questionId++; playToken++;
  stopListening();
  stopSound();
  hush();
}

// ---------- Quiz ----------
function renderProgress() {
  const bar = $("progress");
  bar.innerHTML = "";
  for (let i = 0; i < ROUNDS; i++) {
    const seg = document.createElement("i");
    if (i < results.length) seg.className = results[i] ? "star" : "ok";
    else if (i === results.length) seg.className = "now";
    bar.appendChild(seg);
  }
}
let results = []; // per round: true if found on the first try

function promptText() {
  if (mode === "say") return topic.id === "emotions" ? T().sayFeel : topic.id === "sounds" || topic.id === "reading" ? T().sayRead : T().sayWhat;
  if (mode === "read") return T().readIt;
  if (mode !== "listen" && topic.id === "emotions") return T().whoFeels(nameOf(answer));
  if (mode !== "listen") return topic.id === "clock" ? T().showTime(nameOf(answer)) : T().where(nameOf(answer), manyOf(answer), topic.bare);
  if (isMusic()) return T().listen;
  if (answer.sound) return { scenery: T().whereAreWe, kitchen: T().whatIsIt, transport: T().whatIsIt, weather: T().whatWeather }[topic.id] || T().whoIsIt;
  return topic.id === "letters" ? T().whichLetter(soundOf(answer)) : T().who(soundOf(answer));
}

// Ask (or ask again): say the name, say "Listen!" then play the instrument, or ask "Who says moo?".
function ask() {
  const q = questionId;
  const btn = $("speak");
  btn.classList.remove("pulse"); void btn.offsetWidth; btn.classList.add("pulse");
  stopListening();
  if (mode === "read") { if (!firstTry) say(soundOut(answer)); else if (round === 0) say(T().readIt); }
  else if (mode === "say") say(promptText(), () => { if (q === questionId) setTimeout(() => { if (q === questionId) hearChild(); }, 250); });
  else if (mode === "listen" && hasRecording(answer)) say(promptText(), () => { if (q === questionId) playInstrument(answer); });
  else say(promptText());
}

function card(item) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "choice" + (item.poison ? " poison" : "");
  b.dataset.id = item.id;
  b.setAttribute("aria-label", nameOf(item));
  const label = document.createElement("span");
  label.className = "label";
  b.append(picture(item.id), label);
  return b;
}

function askQuestion() {
  locked = false; firstTry = true; questionId++;
  renderProgress();
  const pool = gamePool();
  // go through the pool in random order before repeating anything
  if (!deck.length) deck = shuffle(pool.filter(i => i !== lastAnswer));
  answer = deck.pop();
  lastAnswer = answer;
  if (hasRecording(answer)) recording(answer.id).catch(() => {}); // start decoding now so the sound is ready
  if (mode === "say") return askSay();
  // wrong choices come from other families, so pictures and sounds are easy to tell
  // apart; prefer the same group, and in the animal sound game animals with a sound
  const fallback = mode === "listen" ? itemsOf(topic).filter(hasSound) : itemsOf(topic);
  const kind = mode === "listen" ? soundFamily : i => i.family;
  const others = [];
  for (const i of [...shuffle(pool), ...shuffle(fallback)]) {
    if (others.length < choices() - 1 && i.family !== answer.family && kind(i) !== kind(answer) && !others.some(o => o.family === i.family || kind(o) === kind(i))) others.push(i);
  }
  const box = $("choices");
  box.innerHTML = "";
  box.style.setProperty("--n", others.length + 1);
  shuffle([answer, ...others]).forEach(item => {
    const b = card(item);
    b.onclick = () => pick(item, b);
    box.appendChild(b);
  });
  $("promptText").textContent = promptText();
  if (mode === "read") showWord($("promptText"), answer); // the word to read, written big; nothing said
  asked = Date.now();
  ask();
}

// a word to read, written big (in the reading game's question and on the "Say it!" card)
function showWord(el, item) {
  el.textContent = "";
  const w = document.createElement("span");
  w.className = "read-word";
  w.textContent = nameOf(item);
  el.appendChild(w);
}

function showName(btn, item) {
  btn.classList.remove("word-card"); // a word read aloud: now its picture shows
  btn.querySelector(".label").textContent = shortName(item);
  btn.classList.add("named");
}

function pick(item, btn) {
  if (locked) return;
  const q = questionId;
  if (firstTry) thinking.push((Date.now() - asked) / 1000);
  showName(btn, item);
  if (item === answer) win(item, btn);
  else {
    if (firstTry) missed.push(answer.id);
    firstTry = false;
    btn.classList.add("wrong");
    btn.disabled = true;
    boop();
    if (mode === "listen" && hasRecording(answer)) {
      // play the right sound again so they can compare
      setTimeout(() => { if (q === questionId) playInstrument(answer); }, 500);
    } else {
      // say what they tapped ("The cat says meow!"), then gently ask again
      const what = mode === "listen" && item.says ? extra(item) : T().name(nameOf(item), topic.bare);
      say([what, T().no], () => { if (q === questionId) setTimeout(() => { if (q === questionId) ask(); }, 400); });
    }
  }
}

// "Yes! The cow!", or for a feeling "Yes! Happy!"
const yesOf = item => topic.id === "emotions" ? T().yesFeel(nameOf(item)) : T().yes(nameOf(item), topic.bare);

// Found (or said): cheer, "Yes! The cow! The cow says moo!", then the next question.
function win(item, btn) {
  stopListening();
  locked = true;
  questionId++; // cancel any pending replay of the question
  btn.classList.add("right");
  $("promptText").textContent = yesOf(item);
  cheer();
  results.push(firstTry);
  if (firstTry) stars++;
  renderProgress();
  confetti(10);
  round++;
  const g = gameId;
  const next = () => { if (g === gameId) (round >= ROUNDS ? finish : askQuestion)(); };
  const hear = hasRecording(item) && mode !== "listen"; // found by name: now let them hear it
  // "Yes! The cow! The cow says moo!", then the next question
  say([yesOf(item), hasRecording(item) ? "" : extra(item)], () => {
    if (g !== gameId) return;
    if (hear) playInstrument(item);
    setTimeout(next, hear ? 3000 : 900);
  });
}

// ---------- Say it: the child says the name out loud ----------
// The microphone only measures how loud it is, on the device, to notice that the child spoke and stopped:
// nothing is recorded, kept or sent, and the word itself is not checked. It is open only while listening.
// Without a microphone (or permission) a tap on the picture counts instead.
const canHear = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
let mic = null, micDenied = false, listenTimer = 0, listenId = 0;

function askSay() {
  const box = $("choices");
  box.innerHTML = "";
  box.style.setProperty("--n", 1);
  const b = card(answer);
  b.classList.add("solo");
  if (answer.parts) { b.classList.add("word-card"); const w = document.createElement("span"); w.className = "word"; showWord(w, answer); b.appendChild(w); }
  b.onclick = () => { if (!locked) { if (firstTry) thinking.push((Date.now() - asked) / 1000); showName(b, answer); win(answer, b); } };
  box.appendChild(b);
  $("promptText").textContent = promptText();
  $("micHint").hidden = canHear && !micDenied;
  $("heard").textContent = "";
  asked = Date.now();
  ask();
}

async function openMic() {
  if (mic) return mic;
  if (!canHear || micDenied) return null;
  try {
    // iPhone: recording needs the audio session that also records
    try { if (navigator.audioSession) navigator.audioSession.type = "play-and-record"; } catch (e) {}
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const c = audio();
    const analyser = c.createAnalyser();
    analyser.fftSize = 1024;
    const source = c.createMediaStreamSource(stream);
    source.connect(analyser);
    mic = { stream, analyser, source, data: new Float32Array(analyser.fftSize) };
  } catch (e) {
    micDenied = true;
    $("micHint").hidden = false;
  }
  return mic;
}

function stopListening() {
  listenId++;
  stopWords();
  clearInterval(listenTimer);
  $("speak").classList.remove("listening");
  const solo = document.querySelector(".choice.solo");
  if (solo) solo.style.setProperty("--vol", 0);
  if (mic) {
    mic.stream.getTracks().forEach(t => t.stop());
    mic = null;
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) {}
  }
}

// Listen up to 7 seconds: speech is anything twice as loud as the room (measured in the first 0.3 s, then
// followed) for over 0.15 s, so a soft voice counts; it ends after 0.7 s of quiet (or 3 s of talking).
// A click or a bump, shorter than that, does not count.
function listenFor(onSpoke, onSilent) {
  const q = questionId, id = ++listenId;
  openMic().then(m => {
    if (q !== questionId || id !== listenId || !m) return;
    const started = Date.now(), solo = document.querySelector(".choice.solo");
    let floor = 0, loud = 0, quiet = 0, spoke = false;
    const words = startWords(m);
    if (words) onSpoke = (spokeNow => () => words.finish().then(heard => { if (q === questionId) spokeNow(heard); }))(onSpoke);
    $("speak").classList.add("listening");
    listenTimer = setInterval(() => {
      if (q !== questionId || id !== listenId) return clearInterval(listenTimer);
      m.analyser.getFloatTimeDomainData(m.data);
      let sum = 0;
      for (const v of m.data) sum += v * v;
      const level = Math.sqrt(sum / m.data.length), t = Date.now() - started;
      // the room's noise: its average over the first 0.3 s, then followed slowly while nobody speaks
      if (t < 300) { floor += level / 6; return; }
      const threshold = Math.max(0.004, floor * 2);
      if (level <= threshold) floor = floor * 0.97 + level * 0.03;
      if (solo) solo.style.setProperty("--vol", Math.min(1, level / (threshold * 2.5)).toFixed(2));
      if (level > threshold) { loud += 50; quiet = 0; } else if (loud) quiet += 50;
      if (loud >= 150) spoke = true;
      if (!spoke && quiet >= 300) { loud = 0; quiet = 0; }
      if (spoke && (quiet >= 700 || loud >= 3000)) { stopListening(); onSpoke(); }
      else if (!spoke && !loud && t > 7000) { stopListening(); onSilent(); }
    }, 50);
  });
}

// After "What is it? Say it!": spoke → "Yes! The cow!" and a star. Silent → "The cow! Your turn!" and
// listen once more (no star then); still silent → "The cow!" and on to the next picture.
function hearChild() {
  const q = questionId, solo = document.querySelector(".choice.solo");
  if (!solo || locked) return;
  listenFor(heard => {
    if (q !== questionId || locked) return;
    if (firstTry) thinking.push((Date.now() - asked) / 1000);
    showName(solo, answer);
    // checking the words: not the right name (or not understood) → the name again and one more try,
    // then "Bravo! The cow!" and on; never a "no", as small children are often misheard
    if (heard !== undefined && !saidName(heard, answer)) {
      if (firstTry) {
        missed.push(answer.id);
        firstTry = false;
        $("promptText").textContent = T().yourTurn;
        return say([T().name(nameOf(answer), topic.bare), T().yourTurn], () => { if (q === questionId) setTimeout(() => { if (q === questionId) hearChild(); }, 250); });
      }
      return moveOn([T().bravo, T().name(nameOf(answer), topic.bare)]);
    }
    win(answer, solo);
  }, () => {
    if (q !== questionId || locked) return;
    showName(solo, answer);
    if (firstTry) {
      missed.push(answer.id);
      firstTry = false;
      $("promptText").textContent = T().yourTurn;
      say([T().name(nameOf(answer), topic.bare), T().yourTurn], () => { if (q === questionId) setTimeout(() => { if (q === questionId) hearChild(); }, 250); });
    } else moveOn(T().name(nameOf(answer), topic.bare));
  });
}

// a round without a star: show and say the name, then the next picture
function moveOn(sentence) {
  locked = true;
  questionId++;
  results.push(false);
  renderProgress();
  $("promptText").textContent = T().name(nameOf(answer), topic.bare);
  round++;
  const g = gameId;
  say(sentence, () => {
    if (g === gameId) setTimeout(() => { if (g === gameId) (round >= ROUNDS ? finish : askQuestion)(); }, 600);
  });
}

// ---------- Checking the words (optional, set in the parents' page) ----------
// Vosk recognises speech on the device with a small model per language (app/vosk/<lang>.tar.gz, downloaded once
// and kept by the browser). It only chooses among the names of the topic, which makes it far more reliable.
const RECOG_MB = { en: 41, fr: 42, de: 47, it: 50 };
const recog = { models: {}, loading: {} };
let words = null; // the recognizer of the current listening
const recogOn = () => store.get("pikolo-recog-" + lang) === "1";
function loadVosk() {
  if (window.Vosk) return Promise.resolve();
  return new Promise((ok, fail) => {
    const script = document.createElement("script");
    script.src = "app/vosk/vosk.js";
    script.onload = ok; script.onerror = fail;
    document.head.appendChild(script);
  });
}
function loadModel(l) {
  if (!recog.loading[l]) {
    const url = new URL(`app/vosk/${l}.tar.gz`, location.href).href;
    recog.loading[l] = loadVosk()
      .then(() => Promise.race([Vosk.createModel(url), new Promise((_, fail) => setTimeout(() => fail(new Error("timeout")), 180000))]))
      .then(model => { recog.models[l] = model; return model; })
      .catch(e => { delete recog.loading[l]; throw e; });
  }
  return recog.loading[l];
}
// "flûte à bec", "la flûte à bec": lower case, no accents or punctuation
const plainWords = text => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9ß ]+/g, " ").split(" ").filter(Boolean);
function startWords(m) {
  const model = recogOn() && topic.id !== "sounds" && recog.models[lang]; // a sound alone is too short to check
  if (!model) return null;
  const names = new Set();
  // each name as the model may spell it: "la flûte à bec", "flûte à bec", "l'alto", "l alto", "vingt-et-un", "vingt et un"
  itemsOf(topic).forEach(i => [shortName(i), nameOf(i)].forEach(n => {
    const t = n.toLowerCase().replace(/[’]/g, "'").replace(/[^\p{L}\p{N}' -]+/gu, " ").replace(/\s+/g, " ").trim();
    [t, t.replace(/-/g, " "), t.replace(/'/g, "' "), t.replace(/['-]/g, " ")].forEach(v => names.add(v.replace(/\s+/g, " ").trim()));
  }));
  const rec = new model.KaldiRecognizer(m.analyser.context.sampleRate, JSON.stringify([...names, "[unk]"]));
  const heard = [];
  rec.on("result", msg => { if (msg.result && msg.result.text) heard.push(msg.result.text); });
  const c = m.analyser.context, node = c.createScriptProcessor(4096, 1, 1), mute = c.createGain();
  mute.gain.value = 0;
  node.onaudioprocess = e => { try { rec.acceptWaveform(e.inputBuffer); } catch (err) {} };
  m.source.connect(node); node.connect(mute); mute.connect(c.destination);
  words = { rec, node, mute, heard, done: false,
    // the last words: ask for the final result and wait for it (at most a second and a half)
    finish() {
      if (this.done) return Promise.resolve(heard.join(" "));
      this.done = true;
      return new Promise(ok => {
        const end = () => { ok(heard.join(" ")); stopWords(); };
        rec.on("result", end);
        try { rec.retrieveFinalResult(); } catch (err) { end(); }
        setTimeout(end, 1500);
      });
    } };
  return words;
}
function stopWords() {
  if (!words) return;
  const w = words;
  words = null;
  try { w.node.disconnect(); w.mute.disconnect(); } catch (e) {}
  setTimeout(() => { try { w.rec.remove(); } catch (e) {} }, 2000);
}
// right when every longer word of the name was heard ("vache" in "la vache", "flute" and "bec" in "flûte à bec")
function saidName(heard, item) {
  const got = new Set(plainWords(heard));
  $("heard").textContent = heard.replace(/\[unk\]/g, "…").trim() ? `🎤 ${heard.replace(/\[unk\]/g, "…")}` : "🎤 …";
  const need = plainWords(shortName(item)).filter(w => w.length > 2);
  return (need.length ? need : plainWords(shortName(item))).every(w => got.has(w));
}

// ---------- Without internet ----------
// Once Pikolo is installed on the home screen (or when a parent asks), every pack of the language is fetched once:
// the service worker keeps it, so the whole app works offline. Only what is missing is downloaded.
const OFFLINE_CACHE = "pikolo";
const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const offline = { state: "", done: 0, total: 0, run: null };
function offlinePaths() {
  return Object.keys(PACK_INFO).filter(p => /^(pictures|sounds)\//.test(p) || p.startsWith(`voice/${lang}/`) || (look === "photos" && p.startsWith("photos/")));
}
const offlineMB = () => Math.max(1, Math.round(offlinePaths().reduce((n, p) => n + PACK_INFO[p][1], 0) / 1048576));
function makeOffline() {
  if (offline.run) return offline.run;
  if (!("caches" in window) || !navigator.serviceWorker || !navigator.serviceWorker.controller) { offline.state = "fail"; renderOffline(); return Promise.resolve(); }
  const l = lang;
  offline.run = (async () => {
    const cache = await caches.open(OFFLINE_CACHE);
    const missing = [];
    for (const p of offlinePaths()) if (!(await cache.match(packUrl(p)))) missing.push(p);
    if (recogOn() && !(await cache.match("app/vosk/vosk.js", { ignoreSearch: true }))) missing.push("vosk");
    offline.total = missing.reduce((n, p) => n + (PACK_INFO[p] ? PACK_INFO[p][1] : 5800000), 0);
    offline.done = 0;
    offline.state = missing.length ? "progress" : "ready";
    renderOffline();
    for (const p of missing) {
      const r = await fetch(p === "vosk" ? "app/vosk/vosk.js" : packUrl(p));
      if (!r.ok) throw new Error(r.status);
      await r.arrayBuffer();
      offline.done += PACK_INFO[p] ? PACK_INFO[p][1] : 5800000;
      renderOffline();
    }
    offline.state = "ready";
    store.set("pikolo-offline-" + l, "1");
  })().catch(() => { offline.state = "fail"; }).then(() => { offline.run = null; renderOffline(); });
  return offline.run;
}
function renderOffline() {
  const btn = $("offlineBtn"), status = $("offlineStatus");
  if (!btn) return;
  const ready = offline.state === "ready" || (!offline.state && store.get("pikolo-offline-" + lang) === "1");
  btn.hidden = ready || offline.state === "progress";
  btn.textContent = T().offlineGet(offlineMB());
  status.textContent = offline.state === "progress" ? T().offlineProgress(Math.floor(offline.done / Math.max(1, offline.total) * 100))
    : ready ? T().offlineReady : offline.state === "fail" ? T().offlineFail : "";
}
$("offlineBtn").onclick = () => { store.set("pikolo-offline-want", "1"); makeOffline(); };
// installed, or asked for once: keep the language's packs on the device, a little after the start
const wantOffline = () => isInstalled() || store.get("pikolo-offline-want") === "1";
function offlineSoon() { if (wantOffline()) setTimeout(() => { if (!offline.run) { offline.state = ""; makeOffline(); } }, 4000); }

function renderRecog() {
  const on = recogOn(), btn = $("recogBtn"), status = $("recogStatus");
  btn.textContent = on ? T().recogTurnOff : T().recogTurnOn(RECOG_MB[lang]);
  btn.classList.toggle("btn-primary", !on);
  status.textContent = !on ? "" : recog.models[lang] ? T().recogReady : recog.loading[lang] ? T().recogLoading : "";
}
$("recogBtn").onclick = () => {
  const on = !recogOn();
  store.set("pikolo-recog-" + lang, on ? "1" : "0");
  renderRecog();
  if (on) loadModel(lang).then(renderRecog, () => {
    store.set("pikolo-recog-" + lang, "0");
    renderRecog();
    $("recogStatus").textContent = T().recogFailed;
  });
  renderRecog();
};

// ---------- Scores: every finished game, to see what is too easy or still tricky ----------
// pikolo-scores: [{t: topic, m: mode, g: group, s: stars, sec: median seconds to the first tap, at: time}],
// the last 500 games; pikolo-missed: {topic: {item: times not found on the first try}}.
const readJSON = (k, d) => { try { return JSON.parse(store.get(k)) || d; } catch (e) { return d; } };
function saveScore() {
  const sorted = [...thinking].sort((a, b) => a - b);
  const sec = sorted.length ? Math.round(sorted[sorted.length >> 1] * 10) / 10 : 0;
  const all = readJSON("pikolo-scores", []);
  all.push({ t: topic.id, m: mode, g: groupOf[topic.id], l: levelOf[topic.id], s: stars, sec, at: Date.now() });
  store.set("pikolo-scores", JSON.stringify(all.slice(-500)));
  const miss = readJSON("pikolo-missed", {});
  miss[topic.id] = miss[topic.id] || {};
  for (const id of missed) miss[topic.id][id] = (miss[topic.id][id] || 0) + 1;
  store.set("pikolo-missed", JSON.stringify(miss));
}
// the last three games of a game and group: too easy when nearly all first-try and quick
function verdict(games) {
  const last = games.slice(-3), avg = last.reduce((a, g) => a + g.s, 0) / last.length;
  if (last.length < 3) return null;
  if (avg >= ROUNDS * 0.95 && last.every(g => !g.sec || g.sec < 6)) return "easy";
  if (avg < ROUNDS * 0.5) return "tricky";
  return "right";
}
function renderScores() {
  const list = $("scoreList");
  list.innerHTML = "";
  const all = readJSON("pikolo-scores", []);
  if (!all.length) {
    const p = document.createElement("p");
    p.textContent = T().scoresEmpty;
    list.appendChild(p);
  }
  // one row per topic, game and group, the most recently played first
  const rows = new Map();
  for (const g of all) {
    const k = [g.t, g.m, g.g, g.l || 2].join("|");
    const games = rows.get(k) || [];
    rows.delete(k); rows.set(k, [...games, g]);
  }
  for (const games of [...rows.values()].reverse()) {
    const t = TOPICS.find(x => x.id === games[0].t);
    if (!t) continue;
    const group = (t.groups || []).find(x => x.id === games[0].g);
    const v = verdict(games);
    const row = document.createElement("div");
    row.className = "score";
    const title = document.createElement("strong");
    const l = games[0].l || 2;
    title.textContent = `${t[lang]} · ${modeText(t, games[0].m)[0]}` + (group && group.id !== "all" ? ` · ${group[lang]}` : "") +
      ` · ${LEVEL_DOTS[l - 1]} ${T().levels[l - 1]}`;
    const badge = document.createElement("span");
    if (v) { badge.className = "badge " + v; badge.textContent = T()[{ easy: "tooEasy", right: "justRight", tricky: "tricky" }[v]]; }
    const info = document.createElement("small");
    const secs = games.slice(-3).map(g => g.sec).filter(Boolean);
    info.textContent = [T().games(games.length), `⭐ ${games.slice(-5).map(g => g.s).join(" · ")} (${T().lastGames})`,
      secs.length ? T().perAnswer((secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(1)) : ""].filter(Boolean).join(" — ");
    row.append(picture(t.pic), title, badge, info);
    if (v === "easy" || v === "tricky") {
      const hint = document.createElement("p");
      hint.className = "hint muted";
      hint.textContent = v === "easy" ? (l < 3 ? T().tooEasyHintLevel(T().levels[l]) : T().tooEasyHint) : (l > 1 ? T().trickyHintLevel(T().levels[l - 2]) : T().trickyHint);
      row.appendChild(hint);
    }
    list.appendChild(row);
  }
  // the items most often not found on the first try
  const miss = readJSON("pikolo-missed", {}), top = [];
  for (const [tid, items] of Object.entries(miss)) {
    const t = TOPICS.find(x => x.id === tid);
    for (const [id, n] of Object.entries(items)) {
      const item = t && t.items.find(i => i.id === id);
      if (item && n >= 2) top.push([n, item]);
    }
  }
  if (top.length) {
    const h = document.createElement("h3");
    h.textContent = T().missedTitle;
    const box = document.createElement("div");
    box.className = "missed";
    top.sort((a, b) => b[0] - a[0]).slice(0, 12).forEach(([n, item]) => {
      const chip = document.createElement("span");
      loadAsset("pictures", topicOf[item.id].id);
      chip.append(picture(item.id), `${shortName(item)} ×${n}`);
      box.appendChild(chip);
    });
    list.append(h, box);
  }
  $("clearScores").hidden = !all.length;
}

function finish() {
  stopListening();
  saveScore();
  const key = bestKey(topic, mode);
  const best = +store.get(key, 0);
  if (stars > best) store.set(key, String(stars));
  $("doneText").textContent = T().found(stars);
  const row = $("doneStars");
  row.innerHTML = "";
  results.forEach(ok => {
    const s = document.createElement("span");
    s.innerHTML = icon("star");
    if (!ok) s.className = "off";
    row.appendChild(s);
  });
  $("record").hidden = !(stars > best && best > 0);
  show("done");
  fanfare();
  confetti(50);
  say(T().bravoSaid);
}

function start(m) {
  audio();
  gameId++;
  mode = m;
  if (m === "play" || m === "explore") return openPlay();
  round = 0; stars = 0; results = []; lastAnswer = null; deck = []; thinking = []; missed = [];
  $("speak").innerHTML = icon(mode === "listen" ? "ear" : mode === "say" ? "mic" : "speaker");
  $("micHint").hidden = true;
  $("heard").textContent = "";
  if (m === "say" && recogOn()) loadModel(lang).catch(() => {});
  show("game");
  askQuestion();
}

// ---------- Play and discover ----------
let playing = null; // item on the stage

function selectItem(item, speak = true) {
  playing = item;
  setPicture($("bigPic").querySelector("img"), item.id);
  $("bigPic").classList.toggle("poison", !!item.poison);
  $("bigName").textContent = shortName(item);
  document.querySelectorAll(".thumb").forEach(t => t.setAttribute("aria-pressed", t.dataset.id === item.id));
  if (isMusic()) recording(item.id + "#0").catch(() => {});
  else if (item.sound) recording(item.id).catch(() => {});
  if (speak) sayItem();
}

// say the item's name, then play its tune or add its sound or warning
function sayItem() {
  const q = ++questionId;
  bounce();
  if (hasRecording(playing)) say(T().name(nameOf(playing), topic.bare), () => { if (q === questionId) { bounce(); playInstrument(playing); } });
  // letters and syllables: the sound first ("The letter S says sss, like snake!", "m… a… ma!")
  else if (soundOf(playing) && topic.id === "letters" || playing.blend || playing.word || playing.parts) say(extra(playing));
  else say([T().name(nameOf(playing), topic.bare), extra(playing)]);
}

function bounce() {
  const big = $("bigPic");
  big.classList.remove("bounce"); void big.offsetWidth; big.classList.add("bounce");
}

function openPlay() {
  $("playTitle").textContent = topic[lang];
  const isClock = topic.id === "clock";
  $("clockPlay").hidden = !isClock;
  document.querySelector("#play .stage").hidden = isClock;
  $("grid").hidden = isClock;
  $("keys").hidden = !isMusic();
  if (isClock) return openClock();
  $("keys").hidden = !isMusic();
  [...$("keys").querySelectorAll(".key.white span")].forEach((label, w) => { label.textContent = KEY_NAMES[lang][w]; });
  const grid = $("grid");
  grid.innerHTML = "";
  groupPool().forEach(item => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "thumb" + (item.poison ? " poison" : "");
    b.dataset.id = item.id;
    b.setAttribute("aria-label", nameOf(item));
    b.appendChild(picture(item.id));
    b.onclick = () => selectItem(item);
    grid.appendChild(b);
  });
  show("play");
  selectItem(groupPool()[0], false);
}

// ---------- The clock to play with ----------
// A big clock face: drag the long blue minute hand (the short red hour hand follows, as on a real clock) or the
// hour hand; the time snaps to 5 minutes and is said when the finger lifts. `clockTime` is minutes after 12:00.
let clockTime = 3 * 60, clockDrag = null;
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(name, attrs, parent) {
  const el = document.createElementNS(SVG_NS, name);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  parent.appendChild(el);
  return el;
}
const clockPoint = (deg, r) => [64 + r * Math.sin(deg * Math.PI / 180), 64 - r * Math.cos(deg * Math.PI / 180)];
function drawClockFace() {
  const face = $("clockFace");
  if (face.childNodes.length) return;
  svgEl("circle", { cx: 64, cy: 64, r: 60, fill: "#fff", stroke: "#1e88e5", "stroke-width": 5 }, face);
  const ticks = svgEl("g", { stroke: "#90a4ae", "stroke-linecap": "round" }, face);
  for (let t = 0; t < 60; t++) {
    const [x1, y1] = clockPoint(t * 6, 55), [x2, y2] = clockPoint(t * 6, t % 5 ? 53 : 50);
    svgEl("line", { x1, y1, x2, y2, "stroke-width": t % 5 ? 1 : 2.2 }, ticks);
  }
  for (let n = 1; n <= 12; n++) {
    const [x, y] = clockPoint(n * 30, 41);
    svgEl("text", { x, y: y + 4.2, "text-anchor": "middle", "font-size": 12, "font-weight": 600, fill: "#37474f" }, face).textContent = n;
  }
  svgEl("line", { id: "minuteHand", x1: 64, y1: 64, x2: 64, y2: 26, stroke: "#1e63c9", "stroke-width": 4.5, "stroke-linecap": "round" }, face);
  svgEl("line", { id: "hourHand", x1: 64, y1: 64, x2: 64, y2: 38, stroke: "#e53935", "stroke-width": 7, "stroke-linecap": "round" }, face);
  svgEl("circle", { cx: 64, cy: 64, r: 4.5, fill: "#37474f" }, face);
}
function showClock() {
  const t = ((clockTime % 720) + 720) % 720;
  for (const [id, deg, r] of [["minuteHand", t % 60 * 6, 36], ["hourHand", t / 2, 24]]) {
    const [x, y] = clockPoint(deg, r);
    $(id).setAttribute("x2", x.toFixed(1)); $(id).setAttribute("y2", y.toFixed(1));
  }
}
// the time's name, in the language: "half past three", "trois heures et demie", "halb vier", "le tre e mezza"
function clockName() {
  const t = ((clockTime % 720) + 720) % 720, h = Math.floor(t / 60) || 12, m = t % 60;
  return clockNames(h, m)[li()];
}
function sayClock() {
  const t = ((clockTime % 720) + 720) % 720, h = Math.floor(t / 60) || 12, m = t % 60;
  $("clockName").textContent = cap(clockName());
  $("clockDigits").textContent = `${h}:${String(m).padStart(2, "0")}`;
  const face = $("clockFace");
  face.classList.remove("bounce"); void face.getBoundingClientRect(); face.classList.add("bounce");
  say(T().name(clockName(), true));
}
function openClock() {
  drawClockFace();
  showClock();
  show("play");
  $("clockName").textContent = cap(clockName());
  const t = ((clockTime % 720) + 720) % 720;
  $("clockDigits").textContent = `${Math.floor(t / 60) || 12}:${String(t % 60).padStart(2, "0")}`;
}
function clockAngle(e) {
  const r = $("clockFace").getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width * 128 - 64, y = (e.clientY - r.top) / r.height * 128 - 64;
  return { deg: (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360, dist: Math.hypot(x, y) };
}
$("clockFace").addEventListener("pointerdown", e => {
  e.preventDefault();
  audio();
  hush();
  const { deg, dist } = clockAngle(e), t = ((clockTime % 720) + 720) % 720;
  const off = a => Math.abs(((deg - a) % 360 + 540) % 360 - 180);
  // the hand nearest the finger; near the middle, the short hour hand wins a tie
  const hand = off(t / 2) < off(t % 60 * 6) + (dist < 30 ? 25 : -10) ? "hour" : "minute";
  clockDrag = { id: e.pointerId, hand, last: clockTime };
  $("clockFace").setPointerCapture?.(e.pointerId);
  moveClock(e);
});
function moveClock(e) {
  if (!clockDrag || e.pointerId !== clockDrag.id) return;
  const { deg } = clockAngle(e);
  if (clockDrag.hand === "minute") {
    // the change of minutes the shortest way round, so going past 12 moves the hour on (or back)
    const m = Math.round(deg / 6) % 60, now = ((clockTime % 60) + 60) % 60;
    clockTime += ((m - now) % 60 + 90) % 60 - 30;
  } else {
    // the hour hand moves the hour only: the minutes stay, so the minute hand does not spin round
    const m = ((clockTime % 60) + 60) % 60, h = ((Math.round((deg - m / 2) / 30) % 12) + 12) % 12;
    clockTime = h * 60 + m;
  }
  const step = Math.round(clockTime / 5);
  if (step !== Math.round(clockDrag.last / 5)) { tone(1400, 0, 0.03, "square", 0.05); clockDrag.last = clockTime; }
  showClock();
}
$("clockFace").addEventListener("pointermove", moveClock);
["pointerup", "pointercancel"].forEach(type => $("clockFace").addEventListener(type, e => {
  if (!clockDrag || e.pointerId !== clockDrag.id) return;
  clockDrag = null;
  clockTime = Math.round(clockTime / 5) * 5;
  showClock();
  sayClock();
}));
$("clockName").onclick = sayClock;

// keys: press, or slide a finger across them
const pressed = new Map(); // pointerId -> key index
function keyAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el.classList.contains("key") ? +el.dataset.k : -1;
}
function press(pointerId, k) {
  if (pressed.get(pointerId) === k) return;
  const old = pressed.get(pointerId);
  if (old !== undefined && old >= 0) $("keys").children[old].classList.remove("on");
  pressed.set(pointerId, k);
  if (k >= 0) { $("keys").children[k].classList.add("on"); playNote(playing, k); }
}
function release(e) {
  const k = pressed.get(e.pointerId);
  if (k !== undefined && k >= 0) $("keys").children[k].classList.remove("on");
  pressed.delete(e.pointerId);
}

// ---------- Language, parents sheet, sharing ----------
function translate() {
  document.documentElement.lang = lang;
  document.querySelectorAll(".lang-btn").forEach(b => { b.innerHTML = `${icon("globe")}<span>${lang.toUpperCase()}</span>`; b.setAttribute("aria-label", T().chooseLang); });
  document.querySelectorAll("[data-t]").forEach(el => { el.textContent = T()[el.dataset.t]; });
  document.querySelectorAll("[data-t-html]").forEach(el => { el.innerHTML = T()[el.dataset.tHtml]; });
  document.querySelectorAll("[data-t-label]").forEach(el => el.setAttribute("aria-label", T()[el.dataset.tLabel]));
}

function setLang(l) {
  lang = l;
  store.set("quiz-lang", l);
  loadVoice();
  translate();
  if (screen === "home") renderHome();
  if (screen === "topic") renderTopic();
  if (screen === "game" && answer) {
    document.querySelectorAll(".choice").forEach(b => {
      const item = ITEMS.get(b.dataset.id);
      b.setAttribute("aria-label", nameOf(item));
      if (b.classList.contains("named")) b.querySelector(".label").textContent = shortName(item);
    });
    $("promptText").textContent = locked ? yesOf(answer) : promptText();
    if (!locked) ask();
  }
  if (screen === "play" && playing) {
    $("playTitle").textContent = topic[lang];
    document.querySelectorAll(".thumb").forEach(b => b.setAttribute("aria-label", nameOf(ITEMS.get(b.dataset.id))));
    selectItem(playing, false);
  }
  if (screen === "done") $("doneText").textContent = T().found(stars);
  offline.state = "";
  offlineSoon(); // the voice of the new language too
  // sounds and words to read are not the same in the new language: back to the topic
  if (topic.items.some(i => i.only) && ["game", "play", "done"].includes(screen)) backToTopic();
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
}

async function share() {
  const data = { title: "Pikolo", text: T().tagline, url: SHARE_URL };
  try {
    if (navigator.share) { await navigator.share(data); return; }
  } catch (e) {
    if (e && e.name === "AbortError") return;
  }
  try {
    await navigator.clipboard.writeText(SHARE_URL);
    toast(T().copied);
  } catch (e) {
    // no clipboard: select the link so it can be copied by hand
    const range = document.createRange();
    range.selectNodeContents($("shareUrl"));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// Confetti: small paper pieces in the topic's colour, gold and three bright colours, falling behind the cards
function confetti(n) {
  const colors = [topic.color, "#ffb400", "#22a565", "#1e88e5", "#ff5a7a"];
  for (let i = 0; i < Math.min(n, 36); i++) {
    const s = document.createElement("span");
    s.className = "confetti" + (i % 3 === 0 ? " round" : "");
    s.style.background = colors[i % colors.length];
    s.style.left = Math.random() * 96 + "vw";
    s.style.setProperty("--spin", (Math.random() < .5 ? -1 : 1) * (360 + Math.random() * 540) + "deg");
    s.style.setProperty("--drift", (Math.random() * 30 - 15) + "vw");
    s.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    s.style.animationDelay = Math.random() * 0.4 + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3600);
  }
}

// ---------- Wiring ----------
// the language picker: one button per language, each written in its own language
LANGS.forEach(l => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn lang-choice";
  b.textContent = TEXT[l].langName;
  b.onclick = () => { $("langs").close(); if (l !== lang) setLang(l); };
  $("langList").appendChild(b);
});
document.querySelectorAll(".lang-btn").forEach(b => b.onclick = () => openSheet($("langs")));
document.querySelector(".info-btn").onclick = () => { renderRecog(); renderOffline(); openSheet($("about")); };
$("shareUrl").textContent = SHARE_URL;
$("shareBtn").onclick = share;
$("voiceTest").onclick = () => {
  const status = $("voiceStatus");
  const lines = [];
  const show = () => { status.textContent = lines.join(" · "); };
  status.textContent = "…";
  say(T().voiceSample, null, m => {
    if (m === "recorded voice") return;
    if (m === "start" && !lines.length) lines.push("✓ " + T().voiceRecorded);
    else if (m === "device voice") { // no recording (offline from a file): the device's own voice
      const all = "speechSynthesis" in window ? speechSynthesis.getVoices() : [];
      const mine = all.filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(lang));
      lines.push(`${T().voicesFound}: ${mine.length} / ${all.length}`, m);
    } else if (m !== "end" || lines.length > 1) lines.push(m);
    show();
  });
  setTimeout(() => { if (!/start|✓/.test(status.textContent)) { lines.push(T().voiceSilent); show(); } }, 5000);
};
$("topicBack").onclick = goHome;
$("gameClose").onclick = backToTopic;
$("playClose").onclick = backToTopic;
$("again").onclick = () => start(mode);
$("otherGame").onclick = backToTopic;
$("speak").onclick = () => { if (!locked) mode === "read" ? say(soundOut(answer)) : ask(); };
$("bigPic").onclick = sayItem;
{
  let white = 0;
  PIANO.forEach((p, k) => {
    const key = document.createElement("div");
    key.dataset.k = k;
    if (p.black) {
      key.className = "key black";
      key.style.left = `calc(${white} * 100% / 8 - 3.6%)`; // between the white key before and the one after
    } else {
      key.className = "key white";
      key.style.setProperty("--c", KEY_COLORS[white++]);
      key.appendChild(document.createElement("span"));
    }
    $("keys").appendChild(key);
  });
}
$("keys").addEventListener("pointerdown", e => { e.preventDefault(); $("keys").releasePointerCapture?.(e.pointerId); press(e.pointerId, keyAt(e.clientX, e.clientY)); });
$("keys").addEventListener("pointermove", e => { if (pressed.has(e.pointerId)) press(e.pointerId, keyAt(e.clientX, e.clientY)); });
["pointerup", "pointercancel", "pointerleave"].forEach(t => $("keys").addEventListener(t, release));
function openLook() {
  ["drawings", "photos"].forEach(l => {
    const b = $("look-" + l);
    b.setAttribute("aria-pressed", look === l);
    const row = b.querySelector(".look-pics");
    row.innerHTML = "";
    LOOK_SAMPLES.forEach(id => {
      const img = document.createElement("img");
      img.alt = "";
      img.dataset.sample = id;
      if (l !== "drawings") img.className = "photo";
      row.appendChild(img);
    });
  });
  const fill = () => document.querySelectorAll(".look-pics img").forEach(img => {
    const id = img.dataset.sample, src = (img.closest("#look-photos") && photos[id]) || PICS[id];
    if (src) img.src = src;
  });
  loadAsset("pictures", "home").then(fill);
  (loadPhotos("covers", true) || Promise.resolve()).then(fill);
  show("look");
}
["drawings", "photos"].forEach(l => {
  $("look-" + l).onclick = () => { audio(); setLook(l); goHome(); };
});
$("lookBtn").onclick = openLook;
$("scoresBtn").onclick = () => { renderScores(); openSheet($("scores")); };
$("clearScores").onclick = () => {
  if (!confirm(T().clearConfirm)) return;
  store.set("pikolo-scores", "[]"); store.set("pikolo-missed", "{}");
  renderScores();
};
// ---------- Touch for small fingers ----------
// Children press long, slide a little or rest a palm, and the browser then drops the tap (a finger that
// slides a few pixels turns into a scroll). So a picture in a game answers as soon as a finger lands on
// it, and other buttons take a touch that ends less than 32 px from where it started. The browser's own
// click that may follow is ignored.
let firing = false, lastTap = { btn: null, at: 0 };
const touches = new Map(); // touch identifier -> { btn, x, y }
function fire(btn) {
  if (btn.disabled || !btn.isConnected) return;
  lastTap = { btn, at: Date.now() };
  firing = true;
  try { btn.click(); } finally { firing = false; }
}
const buttonOf = target => target && target.closest ? target.closest("button") : null;
addEventListener("click", e => {
  const btn = buttonOf(e.target);
  if (!firing && btn && btn === lastTap.btn && Date.now() - lastTap.at < 800) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const btn = buttonOf(e.target);
  if (btn && btn.closest("#choices")) fire(btn);
}, true);
addEventListener("touchstart", e => {
  for (const t of e.changedTouches) {
    const btn = buttonOf(t.target);
    if (btn && !btn.closest("#choices")) touches.set(t.identifier, { btn, x: t.clientX, y: t.clientY });
  }
}, { capture: true, passive: true });
addEventListener("touchend", e => {
  for (const t of e.changedTouches) {
    const d = touches.get(t.identifier);
    touches.delete(t.identifier);
    if (d && Math.hypot(t.clientX - d.x, t.clientY - d.y) < 32) fire(d.btn);
  }
}, true);
addEventListener("touchcancel", e => { for (const t of e.changedTouches) touches.delete(t.identifier); }, true);
// no "save image" menu on a long press
addEventListener("contextmenu", e => { if (!e.target.closest || !e.target.closest(".sheet")) e.preventDefault(); });

// keyboard: 1-3 pick a picture, space repeats the question, Escape goes back
document.addEventListener("keydown", e => {
  if ($("about").open || $("scores").open || $("langs").open) return;
  if (screen === "game" && /^[1-4]$/.test(e.key)) $("choices").children[e.key - 1]?.click();
  else if (screen === "game" && e.key === " ") { e.preventDefault(); if (!locked) ask(); }
  else if (e.key === "Escape") { if (screen === "topic") goHome(); else if (screen !== "home") backToTopic(); }
});
// the microphone never stays open in the background
addEventListener("visibilitychange", () => { if (document.hidden) stopListening(); });
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
// offline support when served from a website (not from a file or inside a preview frame)
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready).then(offlineSoon).catch(() => {});

translate();
loadAsset("pictures", "home");
renderHome();
theme();
loadPack(lang, "common"); // a topic's voice loads when the topic opens
// first start: drawings or photos?
if (look) setLook(look); else openLook();
