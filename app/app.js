// Pikolo: a picture quiz for little ones. Data is in topics.js, pictures in pictures.js,
// instrument sounds in sounds.js (loaded in the background by index.html).
"use strict";

const SHARE_URL = "https://bachmannalexis.github.io/Quiz/";

const MODE_ICONS = { name: "image", say: "mic", listen: "ear", play: "keys", explore: "search", read: "book", puzzle: "puzzle", drums: "drum", unicorn: "star", add: "plus", subtract: "minus", line: "line" };
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
  const have = k !== undefined && NOTES[iid] && NOTES[iid].samples[k]; // already here (the drums' own pack)
  return (have ? Promise.resolve() : loadSounds(topicOf[iid] || topic)).then(() => {
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
  if (item.quiet && item.quiet[li()]) return T().quiet(nameOf(item), item.quiet[li()]); // the silent H
  if (item.blend) return T().blend(item.blend[0], item.blend[1], nameOf(item)); // "m… a… ma!"
  if (item.poison) return T().poison;
  if (item.from) { const c = ITEMS.get(item.from); return T().from(nameOf(item), c[lang], manyOf(item), manyOf(c)); }
  if (item.feel) return item.feel[li()]; // "I feel scared when there is thunder."
  if (item.fact) return item.fact[li()]; // "Jupiter is the biggest planet."
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
  if (SOLIDS[id]) return solidCanvas(id); // a cube, sphere… turning in 3D
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
const DEPTH = { look: 0, home: 0, topic: 1, game: 2, play: 2, done: 2, puzzle: 2, drums: 2, unicorn: 2 };
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
  const home = $("topicGrid");
  home.innerHTML = "";
  // the topics in sections (nature, food, music…), so a parent finds them quickly
  const listed = new Set(Object.values(SECTIONS).flat()), keys = Object.keys(SECTIONS);
  for (const key of keys) {
    const ts = TOPICS.filter(t => SECTIONS[key].includes(t.id) || (key === keys[keys.length - 1] && !listed.has(t.id)));
    if (!ts.length) continue;
    const h = document.createElement("h2");
    h.className = "section-title";
    h.textContent = T().sections[key];
    const grid = document.createElement("div");
    grid.className = "topic-grid";
    home.append(h, grid);
    ts.sort((a, b) => SECTIONS[key].indexOf(a.id) - SECTIONS[key].indexOf(b.id)).forEach(t => topicCard(t, grid));
  }
}
function topicCard(t, grid) {
  {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "topic-card";
    b.style.setProperty("--card-color", t.color);
    b.style.setProperty("--card-tint", t.tint);
    const name = document.createElement("strong");
    name.textContent = t[lang];
    const count = document.createElement("small");
    count.textContent = T().count(t.math ? t.modes.length : itemsOf(t).length, unitOf(t));
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
  }
}

// A parent gate for the parents' page, the scores and the drawings/photos choice: press and hold one second.
// A quick tap only shows a hint, so a child does not end up there by chance.
function holdToOpen(btn, open) {
  let timer = 0, opened = false;
  const cancel = () => { clearTimeout(timer); btn.classList.remove("holding"); };
  btn.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    opened = false;
    btn.classList.add("holding");
    timer = setTimeout(() => { btn.classList.remove("holding"); opened = true; open(); }, 900);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(t => btn.addEventListener(t, cancel));
  btn.onclick = () => { if (!opened) toast(T().holdForParents); opened = false; };
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
  stopBeat();
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
  all.push({ t: topic.id, m: mode, g: groupOf[topic.id], l: levelOf[topic.id], s: Math.round(stars * ROUNDS / (results.length || ROUNDS)), sec, at: Date.now() });
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
  $("doneText").textContent = T().found(stars, results.length);
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
  if (m === "puzzle") return startPuzzles();
  if (m === "drums") return openDrums();
  if (m === "unicorn") return openUnicorn();
  if (topic.math) return startMath();
  round = 0; stars = 0; results = []; lastAnswer = null; deck = []; thinking = []; missed = [];
  $("speak").innerHTML = icon(mode === "listen" ? "ear" : mode === "say" ? "mic" : "speaker");
  $("mathVisual").hidden = true;
  $("micHint").hidden = true;
  $("heard").textContent = "";
  if (m === "say" && recogOn()) loadModel(lang).catch(() => {});
  show("game");
  askQuestion();
}

// ---------- The rainbow unicorn (Fairy tales): the child flies a unicorn with a finger and catches the stars of the
// colour the voice asks for; each colour adds a stripe to the rainbow, and a full rainbow is a party. Nothing is ever
// lost: a star of another colour just bounces away.
// A flying unicorn facing right, as SVG. f in [0, 1): the animation phase (wings flap, legs gallop).
function unicornSVG(f) {
  const s = Math.sin(f * 2 * Math.PI), c = Math.cos(f * 2 * Math.PI);
  const wing = -18 + 26 * (s * 0.5 + 0.5);          // wing angle, degrees
  const legA = 22 * s, legB = -22 * s;              // front and back legs swing
  const leg = (x, y, a, back) => `<g transform="rotate(${a.toFixed(1)} ${x} ${y})">
      <path d="M${x - 7} ${y} q-1 22 1 30 h12 q2 -8 1 -30z" fill="${back ? "#ece6fb" : "#ffffff"}" stroke="#cbbde8" stroke-width="2"/>
      <rect x="${x - 7.5}" y="${y + 27}" width="15" height="9" rx="4" fill="#b39ddb"/></g>`;
  const mane = ["#ff7eb6", "#ffb74d", "#fff176", "#81c784", "#64b5f6", "#ba68c8"];
  // the tail: six curls, one per colour, from the top (pink) to the bottom (purple)
  const tail = mane.map((col, k) => { const y = 78 + k * 5, w = 1 - k * 0.07, sw = 3 * c * (1 - k / 8);
    return `<path d="M60 ${y} q${-22 * w} ${-12 + sw} ${-34 * w} ${2 + k * 2} q${8 * w} 4 ${18 * w} 2 q${-12 * w} ${8 + sw} ${-14 * w} ${16} q${18 * w} -2 ${30 * w} ${-20 - k}z" fill="${col}" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>`; }).join("");
  // the mane: six locks down the neck, smaller towards the shoulder
  const hair = mane.map((col, k) => { const x = 150 - k * 5.5, y = 26 + k * 7, l = 1 - k * 0.1, sw = 3 * s * (k / 5);
    return `<path d="M${x} ${y} q${-16 * l} ${4 + sw} ${-20 * l} ${22 * l} q${8 * l} -4 ${14 * l} -2 q-4 ${8 * l} -2 ${14 * l} q${12 * l} -10 ${14 * l} ${-32 * l}z" fill="${col}" stroke="rgba(255,255,255,.6)" stroke-width="1.2"/>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -24 214 194">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#efe8ff"/></linearGradient>
    <linearGradient id="horn" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ffb300"/><stop offset="1" stop-color="#fff59d"/></linearGradient>
    <linearGradient id="wing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d1c4e9"/></linearGradient>
  </defs>
  ${leg(80, 108, legB, true)}${leg(128, 108, legA, true)}
  ${tail}
  <ellipse cx="102" cy="94" rx="50" ry="30" fill="url(#body)" stroke="#cbbde8" stroke-width="2.5"/>
  ${leg(92, 112, legA, false)}${leg(138, 110, legB, false)}
  <path d="M128 84 q4 -34 18 -50 q22 -4 30 14 q-6 22 -22 44z" fill="url(#body)" stroke="#cbbde8" stroke-width="2.5"/>
  <path d="M146 30 q18 -10 34 4 q12 10 14 26 q2 12 -10 15 q-14 3 -26 -6 q-14 -10 -12 -39z" fill="#ffffff" stroke="#cbbde8" stroke-width="2.5"/>
  <ellipse cx="188" cy="64" rx="3" ry="2" fill="#cbbde8"/>
  <path d="M158 24 l-6 -20 l14 14z" fill="#ffffff" stroke="#cbbde8" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M166 22 l14 -40 l4 44z" fill="url(#horn)" stroke="#f9a825" stroke-width="2" stroke-linejoin="round"/>
  <path d="M170 12 l10 2 M173 3 l8 2 M176 -6 l5 1" stroke="#f9a825" stroke-width="2" stroke-linecap="round"/>
  ${hair}
  <path d="M168 44 q6 6 12 0" fill="none" stroke="#4a3b6b" stroke-width="3" stroke-linecap="round"/>
  <path d="M169 44 l-3 3 M174 47 l0 4 M179 44 l3 3" stroke="#4a3b6b" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="180" cy="56" rx="7" ry="4.5" fill="#ffb3d1" opacity=".8"/>
  <path d="M184 66 q4 3 8 -1" fill="none" stroke="#b07fa8" stroke-width="2" stroke-linecap="round"/>
  <g transform="rotate(${wing.toFixed(1)} 112 78)">
    <path d="M112 78 q-6 -44 -46 -62 q8 18 4 26 q-12 -6 -22 -6 q10 12 10 20 q-12 -2 -20 2 q16 10 28 22 q18 6 46 -2z" fill="url(#wing)" stroke="#b9a7e0" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M100 70 q-14 -20 -34 -30 M98 74 q-16 -10 -36 -12 M96 78 q-14 -2 -30 2" fill="none" stroke="#c9b8ef" stroke-width="2" stroke-linecap="round"/>
  </g>
  <path d="M118 70 l3 -7 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3z" fill="#fff59d" opacity=".9"/>
</svg>`;
}
const RAINBOW = ["#ff5252", "#ffa726", "#ffee58", "#66bb6a", "#42a5f5", "#ab47bc"];
const UNI_LEVELS = { 1: { need: 2, speed: 0.17, target: 0.65 }, 2: { need: 3, speed: 0.22, target: 0.5 }, 3: { need: 4, speed: 0.28, target: 0.4 } };
// What there is to learn, as four themes: the colours of the rainbow (in their order), numbers, letters and shapes.
// Each theme asks for six things, one per stripe of the rainbow, from a pool that grows with the level. In the
// Colours, Numbers, ABC and Shapes topics the game plays that theme; in Fairy tales the child picks one.
const UNI_SHAPES = ["circle", "square", "triangle", "heart", "star", "moon", "diamond", "hexagon"];
const UNI_THEMES = {
  colours: { pool: () => [0, 1, 2, 3, 4, 5], ordered: true },
  numbers: { pool: l => Array.from({ length: [5, 9, 10][l - 1] }, (_, k) => k + 1) },
  letters: { pool: l => [...["AEIOUMSL", "AEIOUMSLBDPRTNF", "ABCDEFGHIJKLMNOPQRSTUVWXYZ"][l - 1]] },
  shapes: { pool: l => UNI_SHAPES.slice(0, [6, 7, 8][l - 1]) },
};
const UNI_TOPIC_THEME = { colors: "colours", numbers: "numbers", letters: "letters", shapes: "shapes" };
// what the voice says to ask for v, and to name a v caught by mistake
const uniAsk = v => uni.theme === "colours" ? T().uniCatch[v] : uni.theme === "numbers" ? T().uniCatchNum(v) : uni.theme === "letters" ? T().uniCatchLetter(v) : T().uniShapes[v][0];
const uniIs = v => uni.theme === "colours" ? T().uniIsColour[v] : uni.theme === "numbers" ? T().uniIsNum(v) : uni.theme === "letters" ? T().uniIsLetter(v) : T().uniShapes[v][1];
const uni = { frames: [], id: 0 };
function uniFrames() {
  if (uni.frames.length) return;
  for (let k = 0; k < 16; k++) { const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(unicornSVG(k / 16)); uni.frames.push(img); }
}
function openUnicorn() {
  uniFrames();
  const cv = $("uniCanvas");
  show("unicorn");
  const level = levelOf[topic.id] || 2;
  Object.assign(uni, { lvl: UNI_LEVELS[level], level, theme: null, targets: [], got: 0, stripes: 0, stars: [], sparks: [], clouds: [], spawn: 0.8, t: 0,
    pause: 0, done: false, said: 0, x: 0, y: 0, tx: null, ty: null, vx: 0, vy: 0, face: 1, flip: 1, ang: 0, phase: 0, speed: 0, id: ++uni.id, w: 0, h: 0 });
  $("uniEnd").hidden = true;
  loadPack(lang, "unicorn"); // the game's sentences
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    uni.w = r.width; uni.h = r.height; uni.dpr = dpr;
  };
  fit();
  uni.fit = fit;
  uni.x = uni.w * 0.3; uni.y = uni.h * 0.55;
  for (let k = 0; k < 6; k++) uni.clouds.push({ x: Math.random() * uni.w, y: uni.h * (0.12 + Math.random() * 0.6), s: 0.6 + Math.random() * 0.8, v: 8 + Math.random() * 14 });
  const theme = UNI_TOPIC_THEME[topic.id] || uni.lastTheme;
  if (theme) uniBegin(theme);
  else { $("uniPick").hidden = false; say(T().uniPick); }
  const id = uni.id;
  let last = performance.now();
  const loop = now => {
    if (id !== uni.id || screen !== "unicorn") return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    uniStep(dt); uniDraw(cv.getContext("2d"));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
function uniBegin(theme) {
  $("uniPick").hidden = true;
  const pool = UNI_THEMES[theme].pool(uni.level);
  Object.assign(uni, { theme, pool, targets: UNI_THEMES[theme].ordered ? pool : shuffle([...pool]).slice(0, 6), spawn: 0.8 });
  if (!UNI_TOPIC_THEME[topic.id]) uni.lastTheme = theme;
  say([T().uniGo, uniAsk(uni.targets[0])]);
}
document.querySelectorAll("#uniPick button").forEach(b => { b.onclick = () => { audio(); uniBegin(b.dataset.theme); }; });
// where the finger is (the unicorn flies a little above it, so the finger does not hide it)
function uniPoint(e) {
  const r = $("uniCanvas").getBoundingClientRect();
  uni.tx = e.clientX - r.left; uni.ty = e.clientY - r.top - 46;
  // a tap on the big star at the top says the colour again
  if (e.type === "pointerdown" && uni.theme && Math.hypot(e.clientX - r.left - uni.w / 2, e.clientY - r.top - 44) < 34 && !uni.done) say(uniAsk(uni.targets[uni.stripes]));
}
$("uniCanvas").addEventListener("pointerdown", e => { e.preventDefault(); audio(); uniPoint(e); });
$("uniCanvas").addEventListener("pointermove", e => { if (e.buttons || e.pointerType !== "mouse") uniPoint(e); });
addEventListener("resize", () => { if (screen === "unicorn" && uni.fit) uni.fit(); });
const uniSize = () => Math.min(uni.w * 0.34, 170);
function uniStep(dt) {
  const { w, h } = uni;
  uni.t += dt;
  // the unicorn follows the finger, smoothly; alone, it floats up and down
  // (when the rainbow is full, it dances a loop above it)
  const tx = uni.done ? w / 2 + Math.cos(uni.t * 1.8) * w * 0.3 : uni.tx ?? w * 0.3;
  const ty = uni.done ? h * 0.42 + Math.sin(uni.t * 3.6) * h * 0.1 : uni.ty ?? h * 0.55 + Math.sin(uni.t * 1.6) * 30;
  // Flight: a soft spring pulls it towards the finger (it speeds up, slows down and overshoots a little, as a
  // flying animal does), with a top speed, so a far tap makes it fly there rather than jump
  const size = uniSize();
  const gx = Math.max(size / 2, Math.min(w - size / 2, tx)) - uni.x, gy = Math.max(110, Math.min(h - 40, ty)) - uni.y;
  const K = 34, D = 2 * Math.sqrt(K) * 0.78;
  uni.vx = (uni.vx || 0) + (K * gx - D * (uni.vx || 0)) * dt;
  uni.vy = (uni.vy || 0) + (K * gy - D * (uni.vy || 0)) * dt;
  const top = Math.max(w, h) * 1.6, speed = Math.hypot(uni.vx, uni.vy);
  if (speed > top) { uni.vx *= top / speed; uni.vy *= top / speed; }
  uni.x += uni.vx * dt; uni.y += uni.vy * dt;
  // it turns round to fly left (a quick, soft turn), banks with its speed and noses up or down as it climbs or dives
  if (uni.vx < -90) uni.face = -1; else if (uni.vx > 90) uni.face = 1;
  uni.face = uni.face || 1;
  uni.flip = (uni.flip ?? 1) + (uni.face - (uni.flip ?? 1)) * (1 - Math.exp(-dt * 12));
  const lean = Math.max(-0.45, Math.min(0.45, Math.atan2(uni.vy, Math.abs(uni.vx) + 260) * 0.9)) * uni.face;
  uni.ang = (uni.ang || 0) + (lean - (uni.ang || 0)) * (1 - Math.exp(-dt * 8));
  // the wings beat faster when it speeds up or climbs, and slowly when it glides
  uni.phase = ((uni.phase || 0) + dt * (0.9 + Math.min(2.2, speed / 260) + Math.max(0, -uni.vy) / 500)) % 1;
  uni.speed = speed;
  // sparkles from its tail, in the colours of the rainbow, more of them when it flies fast
  const tailX = uni.x - uni.face * size * 0.42, tailY = uni.y + size * 0.05;
  if (Math.random() < dt * (24 + speed / 12)) uni.sparks.push({ x: tailX, y: tailY + (Math.random() - 0.5) * 18,
    vx: -uni.face * (40 + Math.random() * 60) - uni.vx * 0.15, vy: (Math.random() - 0.5) * 40 - uni.vy * 0.1,
    life: 0.9, max: 0.9, c: RAINBOW[Math.floor(Math.random() * 6)], r: 2 + Math.random() * 3 + Math.min(2, speed / 400) });
  for (const c of uni.clouds) { c.x -= c.v * dt; if (c.x < -120 * c.s) { c.x = w + 120 * c.s; c.y = h * (0.12 + Math.random() * 0.6); } }
  if (uni.pause > 0) uni.pause -= dt;
  else if (!uni.done && uni.theme) {
    uni.spawn -= dt;
    if (uni.spawn <= 0) {
      // the thing to catch, or another one of the same theme; numbers, letters and shapes come in any colour
      const want = uni.targets[uni.stripes], others = uni.pool.filter(v => v !== want);
      const v = Math.random() < uni.lvl.target ? want : others[Math.floor(Math.random() * others.length)];
      uni.stars.push({ x: w + 40, y: h * (0.28 + Math.random() * 0.62), r: Math.max(28, Math.min(42, w * 0.085)), v,
        c: uni.theme === "colours" ? v : Math.floor(Math.random() * 6),
        ph: Math.random() * 6, rot: 0, spin: 0, vx: -uni.lvl.speed * w * (0.85 + Math.random() * 0.3), bounce: false });
      uni.spawn = 0.75 + Math.random() * 0.6;
    }
  }
  // stars float in from the right; touching one catches it
  const hx = uni.x + (uni.face || 1) * uniSize() * 0.18, hy = uni.y - uniSize() * 0.05, reach = uniSize() * 0.36;
  for (const s of uni.stars) {
    s.x += s.vx * dt; s.ph += dt * 2.4; s.rot += s.spin * dt;
    s.y += Math.sin(s.ph) * 22 * dt + (s.bounce ? 160 * dt : 0);
    if (s.bounce || s.gone) continue;
    if (Math.hypot(s.x - hx, s.y - hy) < s.r + reach) {
      if (s.v === uni.targets[uni.stripes] && !uni.done) uniCatch(s);
      else {
        s.bounce = true; s.vx = 260; s.spin = 9; tone(330, 0, 0.12, "sine", 0.12); tone(247, 0.08, 0.16, "sine", 0.1);
        // say gently what it was, and what to catch (not too often)
        if (!uni.done && uni.t - uni.said > 4) { uni.said = uni.t; say([uniIs(s.v), uniAsk(uni.targets[uni.stripes])]); }
      }
    }
  }
  uni.stars = uni.stars.filter(s => !s.gone && s.x > -60 && s.x < w + 80 && s.y < h + 60);
  for (const p of uni.sparks) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; p.life -= dt; }
  uni.sparks = uni.sparks.filter(p => p.life > 0);
}
function uniBurst(x, y, colour, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
    uni.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, life: 1.1, max: 1.1, c: colour, r: 3 + Math.random() * 4, star: Math.random() < 0.5 });
  }
}
function uniCatch(s) {
  s.gone = true;
  uniBurst(s.x, s.y, RAINBOW[s.c], 26, 220);
  [1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.06, 0.18, "triangle", 0.14));
  uni.got++;
  if (uni.got < uni.lvl.need) { say(String(uni.got)); return; } // counting: "1… 2…"
  // a stripe of the rainbow
  uni.stripes++; uni.got = 0; uni.pause = 2.6;
  uni.stars.forEach(o => { o.bounce = true; o.vx = 200; o.spin = 6; });
  cheer();
  const g = gameId;
  if (uni.stripes === RAINBOW.length) {
    uni.done = true;
    setTimeout(() => { if (g === gameId) uniParty(); }, 700);
    return;
  }
  uni.said = uni.t;
  say([String(uni.got || uni.lvl.need), T().bravo, uniAsk(uni.targets[uni.stripes])]);
}
function uniParty() {
  confetti(36);
  say(T().uniDone);
  const g = gameId;
  for (let k = 0; k < 6; k++) setTimeout(() => {
    if (g !== gameId) return;
    uniBurst(uni.w * (0.2 + Math.random() * 0.6), uni.h * (0.2 + Math.random() * 0.4), RAINBOW[k], 40, 260);
    tone(784 + k * 110, 0, 0.3, "triangle", 0.12);
  }, 300 + k * 380);
  setTimeout(() => { if (g === gameId) $("uniEnd").hidden = false; }, 2600);
}
function uniStar(ctx, x, y, r, colour, rot, face) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, colour); g.addColorStop(1, colour);
  ctx.fillStyle = g; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, r * 0.09); ctx.strokeStyle = "rgba(255,255,255,.95)";
  ctx.shadowColor = colour; ctx.shadowBlur = r * 0.5;
  ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
  if (face) { // a happy face
    ctx.fillStyle = "#3b2d5c";
    ctx.beginPath(); ctx.arc(-r * 0.18, -r * 0.05, r * 0.07, 0, 7); ctx.arc(r * 0.18, -r * 0.05, r * 0.07, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(0, r * 0.06, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = r * 0.07; ctx.strokeStyle = "#3b2d5c"; ctx.lineCap = "round"; ctx.stroke();
    ctx.fillStyle = "rgba(255,120,170,.55)";
    ctx.beginPath(); ctx.arc(-r * 0.32, r * 0.12, r * 0.08, 0, 7); ctx.arc(r * 0.32, r * 0.12, r * 0.08, 0, 7); ctx.fill();
  }
  ctx.restore();
}
// a shape's outline, about 2r across
function uniShape(ctx, kind, r) {
  ctx.beginPath();
  if (kind === "circle") ctx.arc(0, 0, r * 0.9, 0, 7);
  else if (kind === "square") ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.2);
  else if (kind === "triangle") { ctx.moveTo(0, -r * 0.95); ctx.lineTo(r * 0.95, r * 0.75); ctx.lineTo(-r * 0.95, r * 0.75); ctx.closePath(); }
  else if (kind === "heart") { ctx.moveTo(0, r * 0.85); ctx.bezierCurveTo(-r * 1.3, 0, -r * 0.7, -r * 1.05, 0, -r * 0.4); ctx.bezierCurveTo(r * 0.7, -r * 1.05, r * 1.3, 0, 0, r * 0.85); }
  else if (kind === "moon") { ctx.arc(0, 0, r * 0.9, 0.35 * Math.PI, 1.65 * Math.PI); ctx.arc(r * 0.45, -r * 0.05, r * 0.7, 1.4 * Math.PI, 0.6 * Math.PI, true); ctx.closePath(); }
  else if (kind === "diamond") { ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); }
  else if (kind === "hexagon") for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); }
  else for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.5 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
}
// a happy face, for stars and shapes
function uniFace(ctx, r, dy = 0) {
  ctx.fillStyle = "#3b2d5c";
  ctx.beginPath(); ctx.arc(-r * 0.18, dy - r * 0.05, r * 0.07, 0, 7); ctx.arc(r * 0.18, dy - r * 0.05, r * 0.07, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, dy + r * 0.06, r * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = r * 0.07; ctx.strokeStyle = "#3b2d5c"; ctx.lineCap = "round"; ctx.stroke();
  ctx.fillStyle = "rgba(255,120,170,.55)";
  ctx.beginPath(); ctx.arc(-r * 0.32, dy + r * 0.12, r * 0.08, 0, 7); ctx.arc(r * 0.32, dy + r * 0.12, r * 0.08, 0, 7); ctx.fill();
}
let uniFont = "";
// one thing to catch: a colour star, a number on a star, a letter in a bubble or a smiling shape
function uniItem(ctx, x, y, r, v, c, rot) {
  const colour = c < 0 ? "#9575cd" : RAINBOW[c]; // c -1: the model at the top, in a neutral colour (any colour is right)
  if (uni.theme === "colours") return uniStar(ctx, x, y, r, colour, rot, true);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, colour); g.addColorStop(1, colour);
  if (uni.theme === "shapes") uniShape(ctx, v, r);
  else if (uni.theme === "numbers") uniShape(ctx, "star", r * 1.08);
  else { ctx.beginPath(); ctx.arc(0, 0, r * 0.95, 0, 7); }
  ctx.fillStyle = g; ctx.shadowColor = colour; ctx.shadowBlur = r * 0.45; ctx.fill(); ctx.shadowBlur = 0;
  ctx.lineJoin = "round"; ctx.lineWidth = Math.max(2, r * 0.09); ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.stroke();
  if (uni.theme === "shapes") uniFace(ctx, r, v === "triangle" ? r * 0.2 : v === "heart" ? -r * 0.05 : 0);
  else { // the number or the letter, big and white with a dark edge
    uniFont = uniFont || getComputedStyle(document.body).fontFamily;
    ctx.font = `700 ${Math.round(r * (uni.theme === "numbers" ? 0.95 : 1.15))}px ${uniFont}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const t = String(v), ty = r * (uni.theme === "numbers" ? 0.1 : 0.06);
    ctx.lineWidth = r * 0.16; ctx.strokeStyle = "#3b2d5c"; ctx.strokeText(t, 0, ty);
    ctx.fillStyle = "#ffffff"; ctx.fillText(t, 0, ty);
  }
  ctx.restore();
}
function uniCloud(ctx, x, y, s) {
  ctx.fillStyle = "rgba(255,255,255,.92)";
  ctx.beginPath();
  for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 30], [58, 0, 24], [30, 10, 26], [-22, 8, 18], [78, 10, 16]]) { ctx.moveTo(x + (dx + r) * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, 7); }
  ctx.fill();
}
function uniDraw(ctx) {
  const { w, h, dpr } = uni;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // the sky
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#9fd8ff"); sky.addColorStop(0.6, "#e6dcff"); sky.addColorStop(1, "#ffd6ea");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // the rainbow, a stripe per colour caught (the others as a faint outline)
  const cx = w / 2, cy = h * 1.02, R = Math.min(w * 0.62, h * 0.78), band = Math.max(10, R * 0.07);
  ctx.lineCap = "butt";
  RAINBOW.forEach((col, k) => {
    ctx.beginPath(); ctx.arc(cx, cy, R - k * band, Math.PI, 2 * Math.PI);
    ctx.lineWidth = band + 1;
    ctx.strokeStyle = k < uni.stripes ? col : "rgba(255,255,255,.28)";
    if (k === uni.stripes && !uni.done) ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.15 * Math.sin(uni.t * 4)})`;
    ctx.stroke();
  });
  for (const c of uni.clouds) uniCloud(ctx, c.x, c.y, c.s);
  // the hills
  ctx.fillStyle = "#b9e4a8";
  ctx.beginPath(); ctx.moveTo(0, h); ctx.quadraticCurveTo(w * 0.25, h - 70, w * 0.55, h - 26); ctx.quadraticCurveTo(w * 0.8, h - 70, w, h - 36); ctx.lineTo(w, h); ctx.fill();
  // the sparkles
  for (const p of uni.sparks) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    if (p.star) uniStar(ctx, p.x, p.y, p.r * 1.6, p.c, p.life * 4, false);
    else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  for (const s of uni.stars) uniItem(ctx, s.x, s.y, s.r, s.v, s.c, s.rot + Math.sin(s.ph) * 0.12);
  // the unicorn, tilted as it climbs or dives
  const size = uniSize(), img = uni.frames[Math.floor((uni.phase || 0) * uni.frames.length) % uni.frames.length];
  if (img && img.complete) {
    // a little stretch with speed, and a breath of up and down while it hovers
    const stretch = Math.min(0.08, (uni.speed || 0) / 6000), bob = Math.sin(uni.t * 2.2) * Math.max(0, 4 - (uni.speed || 0) / 60);
    ctx.save(); ctx.translate(uni.x, uni.y + bob); ctx.rotate(uni.ang || 0);
    if (uni.done) ctx.rotate(Math.sin(uni.t * 3) * 0.15);
    ctx.scale((uni.flip ?? 1) * (1 + stretch), 1 - stretch * 0.6);
    ctx.drawImage(img, -size / 2, -size * 0.45, size, size * 194 / 214);
    ctx.restore();
  }
  // at the top: the colour to catch, and how many are still to catch
  if (!uni.done && uni.theme) {
    const pulse = 1 + 0.08 * Math.sin(uni.t * 5), want = uni.targets[uni.stripes], stripe = uni.theme === "colours" ? want : uni.stripes;
    ctx.fillStyle = "rgba(255,255,255,.75)";
    const bw = 64 + uni.lvl.need * 26;
    ctx.beginPath(); ctx.roundRect(w / 2 - bw / 2, 14, bw, 60, 30); ctx.fill();
    uniItem(ctx, w / 2 - bw / 2 + 34, 44, 24 * pulse, want, uni.theme === "colours" ? want : -1, 0);
    for (let i = 0; i < uni.lvl.need; i++) {
      const x = w / 2 - bw / 2 + 74 + i * 26;
      if (i < uni.got) uniStar(ctx, x, 44, 11, RAINBOW[stripe], 0, false);
      else { ctx.fillStyle = "rgba(59,45,92,.18)"; ctx.beginPath(); ctx.arc(x, 44, 6, 0, 7); ctx.fill(); }
    }
  }
}
$("uniAgain").onclick = () => { gameId++; openUnicorn(); };
$("uniBack").onclick = backToTopic;

// ---------- 3D shapes: the solids drawn live in 3D, turning slowly; the big one in Discover spins with a finger ----------
const SOLIDS = { "shape-cube": ["cube", "#fb8c00"], "shape-sphere": ["sphere", "#26c6da"], "shape-cylinder": ["cylinder", "#1e88e5"],
  "shape-cone": ["cone", "#e53935"], "shape-pyramid": ["pyramid", "#fdd835"] };
// each solid as faces (lists of [x, y, z] points), about 1 unit across, centred
function solidMesh(kind) {
  const ring = (n, r, y) => Array.from({ length: n }, (_, k) => [r * Math.cos(2 * Math.PI * k / n), y, r * Math.sin(2 * Math.PI * k / n)]);
  if (kind === "cube") {
    const v = [-.72, .72], P = (x, y, z) => [v[x], v[y], v[z]];
    return [[P(0,0,0), P(1,0,0), P(1,1,0), P(0,1,0)], [P(0,0,1), P(1,0,1), P(1,1,1), P(0,1,1)], [P(0,0,0), P(0,1,0), P(0,1,1), P(0,0,1)],
      [P(1,0,0), P(1,1,0), P(1,1,1), P(1,0,1)], [P(0,0,0), P(1,0,0), P(1,0,1), P(0,0,1)], [P(0,1,0), P(1,1,0), P(1,1,1), P(0,1,1)]];
  }
  if (kind === "pyramid") {
    const b = [[-.82, -.7, -.82], [.82, -.7, -.82], [.82, -.7, .82], [-.82, -.7, .82]], top = [0, .95, 0];
    return [b, ...b.map((p, k) => [p, b[(k + 1) % 4], top])];
  }
  if (kind === "cone") {
    const b = ring(32, .88, -.72), top = [0, .98, 0];
    return [b, ...b.map((p, k) => [p, b[(k + 1) % 32], top])];
  }
  if (kind === "cylinder") {
    const lo = ring(32, .76, -.78), hi = ring(32, .76, .78);
    return [lo, hi, ...lo.map((p, k) => [p, lo[(k + 1) % 32], hi[(k + 1) % 32], hi[k]])];
  }
  const faces = [], R = .95; // sphere
  for (let i = 0; i < 14; i++) for (let j = 0; j < 28; j++) {
    const pt = (a, b) => { const t = Math.PI * a / 14, f = 2 * Math.PI * b / 28; return [R * Math.sin(t) * Math.cos(f), R * Math.cos(t), R * Math.sin(t) * Math.sin(f)]; };
    faces.push([pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)]);
  }
  return faces;
}
const solidMeshes = {};
function drawSolid(cv) {
  const [kind, color] = SOLIDS[cv.dataset.pic], faces = solidMeshes[kind] || (solidMeshes[kind] = solidMesh(kind));
  const c = cv.getContext("2d"), w = cv.width, S = w * .36, ay = cv._ay, ax = .42;
  const rot = ([x, y, z]) => { const x1 = x * Math.cos(ay) + z * Math.sin(ay), z1 = -x * Math.sin(ay) + z * Math.cos(ay);
    return [x1, y * Math.cos(ax) - z1 * Math.sin(ax), y * Math.sin(ax) + z1 * Math.cos(ax)]; };
  const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16)), L = [-.45, .65, .62];
  const drawn = faces.map(f => {
    const p = f.map(rot), [a, b, d] = p, u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const mid = p.reduce((m, q) => [m[0] + q[0] / p.length, m[1] + q[1] / p.length, m[2] + q[2] / p.length], [0, 0, 0]);
    if (n[0] * mid[0] + n[1] * mid[1] + n[2] * mid[2] < 0) n = n.map(x => -x); // outward
    const len = Math.hypot(...n) || 1;
    return { p, z: mid[2], facing: n[2] / len, light: (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / len };
  }).filter(f => f.facing > -0.02).sort((a, b) => a.z - b.z);
  c.clearRect(0, 0, w, w);
  // a soft shadow under the solid
  c.fillStyle = "rgba(42, 34, 69, .1)"; c.beginPath(); c.ellipse(w / 2, w * .9, w * .3, w * .05, 0, 0, 2 * Math.PI); c.fill();
  for (const f of drawn) {
    const k = .5 + .5 * Math.max(0, f.light), spec = Math.max(0, f.light) ** 12 * 60;
    c.fillStyle = `rgb(${rgb.map(x => Math.min(255, x * k + spec) | 0).join(",")})`;
    c.strokeStyle = kind === "cube" || kind === "pyramid" ? "rgba(42, 34, 69, .25)" : c.fillStyle;
    c.lineWidth = kind === "cube" || kind === "pyramid" ? w / 140 : 1;
    c.beginPath();
    f.p.forEach(([x, y, z], i) => { const g = 3.4 / (3.4 - z); c[i ? "lineTo" : "moveTo"](w / 2 + x * g * S, w * .47 - y * g * S); });
    c.closePath(); c.fill(); c.stroke();
  }
}
const solids = new Set();
let solidLoop = 0;
function solidCanvas(id) {
  const cv = document.createElement("canvas");
  cv.className = "solid";
  cv.dataset.pic = id;
  cv.width = cv.height = 256;
  cv._ay = Math.random() * 6; cv._spin = 0;
  drawSolid(cv);
  solids.add(cv);
  if (!solidLoop) solidLoop = requestAnimationFrame(turnSolids);
  return cv;
}
function turnSolids() {
  for (const cv of solids) {
    if (!cv.isConnected) { solids.delete(cv); continue; }
    cv._ay += .012 + cv._spin; cv._spin *= .94;
    drawSolid(cv);
  }
  solidLoop = solids.size ? requestAnimationFrame(turnSolids) : 0;
}
// a finger on a solid spins it
addEventListener("pointermove", e => { if (e.buttons && e.target.classList && e.target.classList.contains("solid")) e.target._spin = e.movementX * .004; });

// ---------- Maths: add, take away, and the number line (negative numbers too) ----------
// The question as pictures (two groups; for taking away, some crossed out) or a frog jumping on a number line,
// "2 + 3 = ?" written, the voice asking "2 plus 3?", and three numbers to choose from.
let mathQ = null; // { a, b, c }
const mathSign = n => (n < 0 ? "−" + -n : String(n)); // the minus sign as written
function startMath() {
  round = 0; stars = 0; results = []; thinking = []; missed = [];
  $("speak").innerHTML = icon("speaker");
  $("micHint").hidden = true; $("heard").textContent = "";
  show("game");
  mathQuestion();
}
function mathQuestion() {
  locked = false; firstTry = true; questionId++;
  renderProgress();
  const all = mathQuestions(mode, levelOf[topic.id]);
  let pick;
  do pick = all[Math.floor(Math.random() * all.length)]; while (mathQ && all.length > 1 && pick[0] === mathQ.a && pick[1] === mathQ.b);
  const [a, b] = pick, c = a + b;
  mathQ = { a, b, c };
  // the visual
  const v = $("mathVisual"), counter = itemsOf(topic)[Math.floor(Math.random() * itemsOf(topic).length)];
  v.hidden = false; v.innerHTML = ""; v.className = "math-visual " + mode;
  if (mode === "line") v.appendChild(numberLine(a, b));
  else {
    const group = (n, crossFrom) => {
      const g = document.createElement("div");
      g.className = "math-group";
      g.style.setProperty("--k", Math.ceil(Math.sqrt(n)));
      for (let i = 0; i < n; i++) { const img = picture(counter.id); if (i >= crossFrom) img.classList.add("crossed"); const w = document.createElement("span"); w.appendChild(img); g.appendChild(w); }
      return g;
    };
    if (b > 0) { v.appendChild(group(a, a)); const plus = document.createElement("b"); plus.textContent = "+"; v.appendChild(plus); v.appendChild(group(b, b)); }
    else v.appendChild(group(a, a + b));
  }
  // the answers
  const near = new Set([c]);
  const lo = mode === "line" ? -10 : 0;
  for (const d of shuffle([-2, -1, 1, 2, 3, -3])) if (near.size < 3 && c + d >= lo && c + d !== c) near.add(c + d);
  const box = $("choices");
  box.innerHTML = "";
  box.style.setProperty("--n", 3);
  shuffle([...near]).forEach(n => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice number-card";
    btn.dataset.n = n;
    btn.innerHTML = '<span class="num"></span><span class="label"></span>';
    btn.querySelector(".num").textContent = mathSign(n);
    btn.onclick = () => pickNumber(n, btn);
    box.appendChild(btn);
  });
  $("promptText").textContent = `${mathSign(a)} ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ?`;
  asked = Date.now();
  askMath();
}
const mathSay = q => (q.b < 0 ? T().minusQ(q.a, -q.b) : T().plusQ(q.a, q.b));
function askMath() { say(mathSay(mathQ)); }
function pickNumber(n, btn) {
  if (locked) return;
  const q = questionId;
  if (firstTry) thinking.push((Date.now() - asked) / 1000);
  if (n === mathQ.c) {
    locked = true; questionId++;
    btn.classList.add("right");
    const { a, b, c } = mathQ;
    $("promptText").textContent = `${mathSign(a)} ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${mathSign(c)}`;
    $("mathVisual").classList.add("solved");
    const frog = document.querySelector(".number-line .frog"), land = document.querySelector(".number-line .land");
    if (frog) frog.style.transform = `translate(${frog.dataset.dx}px, 0)`; // the frog jumps
    if (land) land.textContent = mathSign(c);
    cheer(); confetti(10);
    results.push(firstTry); if (firstTry) stars++;
    renderProgress(); round++;
    const g = gameId;
    say(b < 0 ? T().minusYes(a, -b, c) : T().plusYes(a, b, c), () => {
      if (g === gameId) setTimeout(() => { if (g === gameId) { $("mathVisual").classList.remove("solved"); (round >= ROUNDS ? finish : mathQuestion)(); } }, 900);
    });
  } else {
    if (firstTry) missed.push(`${mathQ.a}${mathQ.b < 0 ? "-" : "+"}${Math.abs(mathQ.b)}`);
    firstTry = false;
    btn.classList.add("wrong"); btn.disabled = true;
    boop();
    say([T().name(String(n), true), T().no], () => { if (q === questionId) setTimeout(() => { if (q === questionId) askMath(); }, 400); });
  }
}
// a number line with a frog on a, an arrow jumping b, and "?" where it lands (shown once solved)
function numberLine(a, b) {
  const lo = Math.min(0, a, a + b, levelOf[topic.id] === 1 ? 0 : -5), hi = Math.max(10, a, a + b), n = hi - lo;
  const W = 340, x = v => 14 + (v - lo) * (W - 28) / n, NS = SVG_NS;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} 120`); svg.setAttribute("class", "number-line");
  const el = (name, attrs, text) => { const e = svgEl(name, attrs, svg); if (text !== undefined) e.textContent = text; return e; };
  el("line", { x1: 6, y1: 86, x2: W - 6, y2: 86, stroke: "#5c5577", "stroke-width": 3, "stroke-linecap": "round" });
  for (let v = lo; v <= hi; v++) {
    el("line", { x1: x(v), y1: 80, x2: x(v), y2: 92, stroke: v === 0 ? "#2a2245" : "#9a93b5", "stroke-width": v === 0 ? 3 : 2 });
    if (n <= 12 || v % 2 === 0 || v === a || v === a + b) el("text", { x: x(v), y: 110, "text-anchor": "middle", "font-size": n > 15 ? 10 : 12, "font-weight": v === 0 ? 700 : 500, fill: v < 0 ? "#c62828" : "#2a2245" }, mathSign(v));
  }
  // the jump: an arc from a to a + b
  const x0 = x(a), x1 = x(a + b), top = 86 - Math.min(60, 16 + Math.abs(x1 - x0) * .4);
  el("path", { d: `M${x0} 80 Q${(x0 + x1) / 2} ${top} ${x1} 80`, fill: "none", stroke: b > 0 ? "#2e7d32" : "#c62828", "stroke-width": 3, "stroke-dasharray": "6 5", "stroke-linecap": "round" });
  el("circle", { cx: x1, cy: 80, r: 5, fill: b > 0 ? "#2e7d32" : "#c62828" });
  el("text", { class: "land", x: x1, y: 68, "text-anchor": "middle", "font-size": 18, "font-weight": 700, fill: "#2a2245" }, "?");
  const frog = el("image", { href: PICS["frog"] || "", x: x0 - 16, y: 46, width: 32, height: 32 });
  frog.setAttribute("class", "frog");
  frog.dataset.dx = x1 - x0;
  return svg;
}

// ---------- Drums: a drum kit to tap, and a drum machine (4 sounds × 8 steps, looping) ----------
// The sounds are the drum kit's play-mode samples: kick, snare, closed hi-hat, 3 toms, open cymbal, splash.
const PAD_COLORS = ["#e53935", "#1e88e5", "#fdd835", "#43a047", "#00897b", "#6d4c41", "#fb8c00", "#8e24aa",
  "#ec407a", "#78909c", "#ffb300", "#26c6da"];
// the drum machine: one bar of 16 steps (sixteenth notes), a row for every drum, high to low like drum notation:
// crash, cymbal, splash, hi-hat, triangle, cowbell, clap, snare, high tom, tom, floor tom, bass drum
const BEAT_ROWS = [10, 6, 7, 2, 11, 9, 8, 1, 3, 4, 5, 0], BEAT_STEPS = 16;
const CRASH = 10, SNARE = 1, TOMS = [3, 4, 5], KICK = 0;
// Rhythms in different styles, written as drummers count them: one string of 16 steps per drum, "X" an accent,
// "x" a normal hit, "o" a ghost note (very soft), "." a rest. Each style has its tempo, its kit (the sounds of the
// 12 pads: acoustic, or electro, hip-hop or jazz, app/sounds/drums.js), a swing (how late the off-beat eighths come,
// as a part of a step: 0.66 is a shuffle) and a fill, the bar that leads into the next phrase (every 4th bar).
// Drums: 10 crash, 6 cymbal (open hi-hat or ride), 7 splash (a scratch in the hip-hop kit), 2 hi-hat, 11 triangle,
// 9 cowbell, 8 clap, 1 snare, 3 4 5 toms, 0 bass drum.
const BEATS = [
  { id: "rock", tempo: 100,
    groove: { 2: "X.x.X.x.X.x.X.x.", 1: "....X.......X...", 0: "X.......X.X....." },
    fill:   { 2: "X.x.X.x.X.x.....", 1: "....X.......XoXX", 3: "..........XX....", 5: "..............XX", 0: "X.......X......." } },
  { id: "pop", tempo: 96,
    groove: { 2: "X.x.X.x.X.x.X.x.", 8: "....X.......X...", 1: "....X.......X...", 0: "X......XX.....x." },
    fill:   { 2: "X.x.X.x.........", 8: "....X...........", 1: "....X...X.x.X.XX", 0: "X......XX......." } },
  { id: "funk", tempo: 104,
    groove: { 2: "XoxoXoxoXoxoXoxo", 1: "....X..o.o..X..o", 0: "X.x...X...x..X.." },
    fill:   { 2: "XoxoXoxo........", 1: "....X..o.oXoXoXX", 3: "........X.......", 0: "X.x...X...x....." } },
  { id: "disco", tempo: 120, kit: "electro",
    groove: { 6: "..X...X...X...X.", 2: "X...X...X...X...", 8: "....X.......X...", 0: "X...X...X...X..." },
    fill:   { 6: "..X...X.........", 2: "X...X...........", 8: "....X...X.X.XXXX", 0: "X...X...X...X..." } },
  { id: "hiphop", tempo: 90, kit: "hiphop", swing: 0.3,
    groove: { 2: "X.x.X.x.X.x.X.x.", 1: "....X.......X...", 7: "..............X.", 0: "X..x...X..X....." },
    fill:   { 2: "X.x.X.x.X.x.X.x.", 1: "....X.......X..X", 7: "..........X.X.X.", 0: "X..x...X..X....." } },
  { id: "trap", tempo: 140, kit: "hiphop",
    groove: { 2: "x.x.x.x.xxxxx.x.", 8: "........X.......", 0: "X......X..X....." },
    fill:   { 2: "xxxxxxxxxxxxxxxx", 8: "........X.......", 7: "............X.X.", 0: "X......X........" } },
  { id: "reggae", tempo: 76, kit: "hiphop", swing: 0.2,
    groove: { 2: "x.X.x.X.x.X.x.X.", 11: "......x.......x.", 1: "........X.......", 0: "........X......." },
    fill:   { 2: "x.X.x.X.........", 1: "........X...X.X.", 3: "..........X.....", 5: "..............XX", 0: "........X......." } },
  { id: "shuffle", tempo: 96, kit: "jazz", swing: 0.66,
    groove: { 6: "X.x.X.x.X.x.X.x.", 2: "....X.......X...", 1: "..o.X.o...o.X.o.", 0: "X.......X......." },
    fill:   { 6: "X.x.X.x.........", 2: "....X...........", 1: "..o.X.o.X.x.X.XX", 0: "X.......X......." } },
  { id: "samba", tempo: 116, kit: "jazz",
    groove: { 2: "xxXxxxXxxxXxxxXx", 8: "...X..X...X..X..", 9: "X.X..X..X.X..X..", 0: "X..xX..xX..xX..x" },
    fill:   { 2: "xxXxxxXx........", 1: "........oxoxXXXX", 9: "X.X..X..........", 0: "X..xX..xX..xX..x" } },
  { id: "bossa", tempo: 130, kit: "jazz",
    groove: { 2: "x.x.x.x.x.x.x.x.", 1: "X..X..X...X..X..", 0: "X..xX..xX..xX..x" },
    fill:   { 2: "x.x.x.x.........", 1: "X..X..X...X.oxXX", 0: "X..xX..xX..xX..x" } },
  { id: "salsa", tempo: 100, kit: "jazz",
    groove: { 9: "X.x.X.x.X.x.X.x.", 8: "X..X..X...X.X...", 3: "......X.......X.", 4: ".......x.......x", 0: "...X.......X...." },
    fill:   { 9: "X.x.X.x.........", 8: "X..X..X.........", 3: "........XX......", 4: "..........XX....", 5: "............XXXX", 0: "...X........X..." } },
  { id: "afrobeat", tempo: 110,
    groove: { 2: "XxXxXxXxXxXxXxXx", 9: "X.X.XX.XX.X.XX.X", 1: "...o..X...o..X.o", 0: "X.....X.X.....X." },
    fill:   { 2: "XxXxXxXx........", 9: "X.X.XX.X........", 1: "...o..X.X.x.XoXX", 0: "X.....X.X......." } },
  { id: "march", tempo: 110,
    groove: { 10: "X.......X.......", 1: "X.xxX.x.X.xxX.X.", 0: "X.......X......." },
    fill:   { 10: "X...............", 1: "X.xxX.x.xxxxXXXX", 0: "X.......X......." } },
  { id: "techno", tempo: 128, kit: "electro",
    groove: { 6: "..X...X...X...X.", 2: "x.x.x.x.x.x.x.x.", 8: "....X.......X...", 0: "X...X...X...X..." },
    fill:   { 6: "..X...X...X.....", 2: "x.x.x.x.x.x.....", 8: "....X...X.X.XXXX", 0: "X...X...X...X..." } },
  { id: "dnb", tempo: 172, kit: "electro",
    groove: { 2: "x.x.x.x.x.x.x.x.", 1: "....X.......X...", 0: "X.........X....." },
    fill:   { 2: "x.x.x.x.........", 1: "....X..X.XX.XXXX", 0: "X.........X....." } },
];
// a pattern as drum -> Map(step -> loudness)
const VELOCITY = { X: 1, x: 0.72, o: 0.32 };
const parseBeat = rows => Object.fromEntries(Object.entries(rows).map(([k, s]) =>
  [k, new Map([...s].map((c, i) => [i, VELOCITY[c]]).filter(([, v]) => v))]));
// the fill for the child's own rhythm: the first half as it is, then the toms going down
function ownFill() {
  const fill = Object.fromEntries(Object.entries(beat.steps).map(([k, m]) => [k, new Map([...m].filter(([i]) => i < 8))]));
  TOMS.forEach((k, n) => { fill[k] = new Map([[8 + n * 2, 1], [9 + n * 2, 0.72]]); });
  fill[SNARE] = new Map([...(fill[SNARE] || []), [14, 1], [15, 1]]);
  return fill;
}
const beat = { steps: {}, fill: null, tempo: 100, swing: 0, style: null, kit: "", playing: false, step: 0, bar: 0,
  fillNow: false, crashNext: false, next: 0, timer: 0 };
const kitId = () => "drum-kit" + (beat.kit ? "-" + beat.kit : "");
// the pads come in their own small pack (app/sounds/drums.js), so they play before the music pack has loaded
let drumsReady = null;
const loadDrums = () => drumsReady || (drumsReady = loadAsset("sounds", "drums").catch(e => { drumsReady = null; throw e; }));
function hitDrum(k, when, loud = 1) {
  return loadDrums().then(() => recording(kitId() + "#" + k)).then(b => {
    const c = audio(), src = c.createBufferSource();
    src.buffer = b;
    if (loud < 1) { const g = c.createGain(); g.gain.value = loud; src.connect(g); g.connect(c.destination); }
    else src.connect(c.destination);
    src.start(when || 0);
  }, () => {});
}
function openDrums() {
  const pads = $("pads");
  pads.innerHTML = "";
  T().drumNames.forEach((name, k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pad pad-" + k;
    b.style.setProperty("--c", PAD_COLORS[k]);
    b.setAttribute("aria-label", name);
    b.innerHTML = "<span></span>";
    b.querySelector("span").textContent = name;
    b.addEventListener("pointerdown", e => { e.preventDefault(); audio(); hitDrum(k); b.classList.remove("hit"); void b.offsetWidth; b.classList.add("hit"); });
    pads.appendChild(b);
  });
  decodeKit();
  if (!Object.keys(beat.steps).length) loadBeat(BEATS[0]);
  drawBeat();
  show("drums");
}
function drawBeat() {
  const grid = $("beatGrid");
  grid.innerHTML = "";
  BEAT_ROWS.forEach(k => {
    const row = document.createElement("div");
    row.className = "beat-row";
    const dot = document.createElement("span");
    dot.className = "beat-dot";
    dot.style.background = PAD_COLORS[k];
    dot.title = T().drumNames[k];
    dot.onpointerdown = () => { audio(); hitDrum(k); }; // the dot plays its drum, to know which row is which
    row.appendChild(dot);
    for (let i = 0; i < BEAT_STEPS; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      const loud = beat.steps[k] && beat.steps[k].get(i);
      cell.className = "beat-cell" + (loud ? " on" : "") + (loud && loud < 0.5 ? " ghost" : loud && loud < 1 ? " soft" : "") + (i % 4 === 0 ? " first" : "");
      cell.style.setProperty("--c", PAD_COLORS[k]);
      cell.dataset.i = i;
      cell.setAttribute("aria-label", `${T().drumNames[k]} ${i + 1}`);
      cell.onclick = () => {
        const steps = beat.steps[k] || (beat.steps[k] = new Map());
        if (steps.has(i)) steps.delete(i); else { steps.set(i, 1); hitDrum(k); }
        beat.style = null; beat.fill = null; // the child's own rhythm now
        cell.classList.remove("soft", "ghost");
        cell.classList.toggle("on", steps.has(i));
      };
      row.appendChild(cell);
    }
    grid.appendChild(row);
  });
  $("beatTempo").textContent = beat.tempo;
  $("beatPlay").innerHTML = icon(beat.playing ? "stop" : "play");
  const styles = $("beatStyles");
  styles.innerHTML = "";
  BEATS.forEach(b => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "pill" + (beat.style === b.id ? " on" : "");
    chip.textContent = T().beatStyles[b.id];
    chip.onclick = () => { loadBeat(b); drawBeat(); if (!beat.playing) { audio(); startBeat(); } };
    styles.appendChild(chip);
  });
}
function loadBeat(b) {
  beat.steps = parseBeat(b.groove); beat.fill = parseBeat(b.fill);
  beat.tempo = b.tempo; beat.swing = b.swing || 0; beat.style = b.id; beat.kit = b.kit || "";
  beat.bar = 0; beat.crashNext = true; // a crash on the first beat
  decodeKit();
}
// decode the 12 sounds of the kit now, so the first beat is on time
const decodeKit = () => loadDrums().then(() => Promise.all(PAD_COLORS.map((_, k) => recording(kitId() + "#" + k)))).catch(() => {});
// a small scheduler: every 25 ms, the steps due in the next 0.1 s are queued on the audio clock, so the beat stays even
function startBeat() {
  const c = audio();
  beat.playing = true; beat.step = 0; beat.bar = 0; beat.next = c.currentTime + 0.05;
  let bar = beat.steps;
  beat.timer = setInterval(() => {
    while (beat.next < c.currentTime + 0.1) {
      const i = beat.step, sixteenth = 60 / beat.tempo / 4;
      if (i === 0) { // a new bar: the groove, or the fill every 4th bar (and when the Fill button asked for one)
        const fill = beat.fillNow || (beat.style && beat.bar % 4 === 3);
        bar = fill ? beat.fill || ownFill() : beat.steps;
        if (beat.crashNext) hitDrum(CRASH, beat.next);
        beat.crashNext = fill; beat.fillNow = false;
        $("beatFill").classList.toggle("on", fill);
      }
      const at = beat.next + (i % 4 === 2 ? beat.swing * sixteenth : 0); // swing: the off-beat eighth comes late
      for (const k of BEAT_ROWS) { const loud = bar[k] && bar[k].get(i); if (loud) hitDrum(+k, at, loud); }
      const delay = Math.max(0, (at - c.currentTime) * 1000);
      setTimeout(() => document.querySelectorAll(".beat-cell").forEach(cell => cell.classList.toggle("now", +cell.dataset.i === i)), delay);
      beat.next += sixteenth;
      beat.step = (beat.step + 1) % BEAT_STEPS;
      if (beat.step === 0) beat.bar++;
    }
  }, 25);
  drawBeat();
}
function stopBeat() {
  clearInterval(beat.timer);
  beat.playing = false;
  document.querySelectorAll(".beat-cell.now").forEach(c => c.classList.remove("now"));
  if ($("beatPlay")) $("beatPlay").innerHTML = icon("play");
}
$("beatPlay").onclick = () => { audio(); beat.playing ? stopBeat() : startBeat(); };
$("beatSlower").onclick = () => { beat.tempo = Math.max(60, beat.tempo - 10); $("beatTempo").textContent = beat.tempo; };
$("beatFaster").onclick = () => { beat.tempo = Math.min(180, beat.tempo + 10); $("beatTempo").textContent = beat.tempo; };
$("beatClear").onclick = () => { beat.steps = {}; beat.fill = null; beat.style = null; drawBeat(); };
$("beatFill").onclick = () => { audio(); beat.fillNow = true; if (!beat.playing) startBeat(); };
$("drumsBack").onclick = backToTopic;

// ---------- Puzzles: a picture cut into pieces (2×2 easy, 3×3 medium, 4×4 hard), five pictures a game ----------
// Drag a piece to its place (the picture shows faintly on the board), or tap a piece then its place.
// A picture finished without a wrong drop earns a star.
const PUZZLES = 5;
let puzzle = null; // { item, n, placed, held, drag }
function startPuzzles() {
  round = 0; stars = 0; results = []; lastAnswer = null; deck = []; thinking = []; missed = [];
  show("puzzle");
  nextPuzzle();
  say(T().puzzleGo);
}
function puzzleProgress() {
  const bar = $("puzzleProgress");
  bar.innerHTML = "";
  for (let i = 0; i < PUZZLES; i++) {
    const seg = document.createElement("i");
    seg.className = i < results.length ? (results[i] ? "star" : "ok") : i === results.length ? "now" : "";
    bar.appendChild(seg);
  }
}
function nextPuzzle() {
  if (!deck.length) deck = shuffle(groupPool().filter(i => i !== lastAnswer));
  const item = deck.pop(), n = levelOf[topic.id] + 1, src = srcOf(item.id) || PICS[item.id];
  lastAnswer = item;
  puzzle = { item, n, placed: 0, held: null, clean: true };
  firstTry = true; locked = false; questionId++;
  puzzleProgress();
  const board = $("puzzleBoard"), tray = $("puzzleTray");
  board.innerHTML = ""; tray.innerHTML = "";
  board.style.setProperty("--n", n);
  board.style.setProperty("--pic", `url("${src}")`);
  board.classList.toggle("photo", look === "photos" && !!photos[item.id]);
  for (let i = 0; i < n * n; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.i = i;
    slot.onclick = () => { if (puzzle.held) dropPiece(puzzle.held, slot); };
    board.appendChild(slot);
  }
  shuffle([...Array(n * n).keys()]).forEach(i => {
    const piece = document.createElement("div");
    piece.className = "piece";
    piece.dataset.i = i;
    piece.style.setProperty("--x", i % n);
    piece.style.setProperty("--y", Math.floor(i / n));
    piece.style.setProperty("--n", n);
    piece.style.backgroundImage = `url("${src}")`;
    piece.addEventListener("pointerdown", e => grabPiece(e, piece));
    tray.appendChild(piece);
  });
}
function grabPiece(e, piece) {
  if (piece.classList.contains("done")) return;
  e.preventDefault();
  audio();
  document.querySelectorAll(".piece.held").forEach(p => p.classList.remove("held"));
  piece.classList.add("held");
  puzzle.held = piece;
  const r = piece.getBoundingClientRect(), start = { x: e.clientX, y: e.clientY };
  let moved = false;
  const move = ev => {
    if (ev.pointerId !== e.pointerId) return;
    if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 8) return;
    moved = true;
    piece.classList.add("dragging");
    piece.style.transform = `translate(${ev.clientX - start.x}px, ${ev.clientY - start.y}px)`;
  };
  const up = ev => {
    if (ev.pointerId !== e.pointerId) return;
    removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
    piece.classList.remove("dragging");
    piece.style.transform = "";
    if (!moved) return; // a tap: the piece is held, a tap on its place puts it there
    piece.style.visibility = "hidden";
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    piece.style.visibility = "";
    const slot = under && under.closest && under.closest(".slot");
    if (slot) dropPiece(piece, slot);
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
}
function dropPiece(piece, slot) {
  if (slot.classList.contains("filled")) return;
  if (slot.dataset.i !== piece.dataset.i) { // not its place: back to the tray, gently
    puzzle.clean = false;
    boop();
    piece.classList.add("wrong");
    setTimeout(() => piece.classList.remove("wrong"), 450);
    return;
  }
  tone(660 + puzzle.placed * 40, 0, 0.12, "triangle", 0.15);
  slot.classList.add("filled");
  slot.style.setProperty("--x", piece.style.getPropertyValue("--x"));
  slot.style.setProperty("--y", piece.style.getPropertyValue("--y"));
  piece.classList.add("done");
  piece.classList.remove("held");
  puzzle.held = null;
  if (++puzzle.placed < puzzle.n * puzzle.n) return;
  // finished: the picture whole, its name, then the next one
  const item = puzzle.item, g = gameId;
  $("puzzleBoard").classList.add("complete");
  results.push(puzzle.clean);
  if (puzzle.clean) stars++;
  puzzleProgress();
  cheer();
  confetti(14);
  say([yesOf(item), hasRecording(item) ? "" : extra(item)], () => {
    if (g !== gameId) return;
    if (hasRecording(item)) playInstrument(item);
    setTimeout(() => {
      if (g !== gameId) return;
      $("puzzleBoard").classList.remove("complete");
      results.length >= PUZZLES ? finish() : nextPuzzle();
    }, hasRecording(item) ? 2500 : 900);
  });
}
$("puzzleBack").onclick = backToTopic;

// ---------- Play and discover ----------
let playing = null; // item on the stage

function selectItem(item, speak = true) {
  playing = item;
  setPicture($("bigPic").querySelector("img"), item.id);
  $("bigPic").querySelector("canvas.solid")?.remove();
  $("bigPic").querySelector("img").hidden = !!SOLIDS[item.id];
  if (SOLIDS[item.id]) $("bigPic").appendChild(solidCanvas(item.id));
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
  else if ((soundOf(playing) || playing.quiet) && topic.id === "letters" || playing.blend || playing.word || playing.parts) say(extra(playing));
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
holdToOpen(document.querySelector(".info-btn"), () => { renderRecog(); renderOffline(); openSheet($("about")); });
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
$("gameBack").onclick = backToTopic;
$("playBack").onclick = backToTopic;
$("doneBack").onclick = backToTopic;
// the cross on every screen of a topic goes straight home
document.querySelectorAll(".home-btn").forEach(b => { b.onclick = goHome; });
$("again").onclick = () => start(mode);
$("otherGame").onclick = backToTopic;
$("speak").onclick = () => { if (!locked) topic.math ? askMath() : mode === "read" ? say(soundOut(answer)) : ask(); };
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
holdToOpen($("lookBtn"), openLook);
holdToOpen($("scoresBtn"), () => { renderScores(); openSheet($("scores")); });
$("clearScores").onclick = () => {
  if (!confirm(T().clearConfirm)) return;
  store.set("pikolo-scores", "[]"); store.set("pikolo-missed", "{}");
  renderScores();
};
// ---------- Touch for small fingers ----------
// Children press long, slide a little or rest a palm, and the browser then drops the tap (a finger that
// slides a few pixels turns into a scroll). So a picture in a game answers as soon as a finger lands on
// it, and other buttons take a touch that ends less than 32 px from where it started. The browser's own
// click that may follow is ignored, also when the tap opened another screen and that click would land on
// a button of the new screen (a topic card would otherwise start the game under the finger).
let firing = false, lastTap = { btn: null, at: 0, touch: false };
const touches = new Map(); // touch identifier -> { btn, x, y }
function fire(btn, touch) {
  if (btn.disabled || !btn.isConnected) return;
  lastTap = { btn, at: Date.now(), touch };
  firing = true;
  try { btn.click(); } finally { firing = false; }
}
const buttonOf = target => target && target.closest ? target.closest("button") : null;
addEventListener("click", e => {
  const btn = buttonOf(e.target);
  if (!firing && btn && (btn === lastTap.btn || lastTap.touch) && Date.now() - lastTap.at < 800) { e.stopImmediatePropagation(); e.preventDefault(); }
}, true);
addEventListener("pointerdown", e => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  const btn = buttonOf(e.target);
  if (btn && btn.closest("#choices")) fire(btn, e.pointerType !== "mouse");
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
    if (d && Math.hypot(t.clientX - d.x, t.clientY - d.y) < 32) { fire(d.btn, true); if (e.cancelable) e.preventDefault(); }
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
