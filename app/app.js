// Pikolo: a picture quiz for little ones. Data is in topics.js, pictures in pictures.js,
// instrument sounds in sounds.js (loaded in the background by index.html).
"use strict";

const SHARE_URL = "https://bachmannalexis.github.io/Quiz/";
const CHOICES = 3;

const CONFETTI = {
  instruments: ["🎵", "🎶", "⭐", "✨"], animals: ["🐾", "⭐", "🎉", "✨"], flowers: ["🌸", "🌼", "⭐", "✨"],
  trees: ["🍃", "🍂", "⭐", "✨"], mushrooms: ["🍄", "⭐", "🎉", "✨"], scenery: ["☀️", "☁️", "⭐", "✨"],
  dinosaurs: ["🦖", "🦕", "⭐", "✨"], food: ["🍓", "🥕", "⭐", "✨"], spices: ["🌿", "⭐", "🎉", "✨"],
  kitchen: ["🍪", "⭐", "🎉", "✨"], letters: ["🔤", "⭐", "🎉", "✨"],
  numbers: ["🔢", "⭐", "🎉", "✨"], transport: ["🚗", "⭐", "🎉", "✨"], weather: ["☀️", "🌈", "⭐", "✨"],
  colors: ["🎨", "🌈", "⭐", "✨"], shapes: ["🔷", "⭐", "🎉", "✨"], clothes: ["👕", "⭐", "🎉", "✨"], jobs: ["👷", "⭐", "🎉", "✨"],
  dishes: ["🍕", "🍰", "⭐", "✨"], countries: ["🌍", "⭐", "🎉", "✨"], body: ["💪", "⭐", "🎉", "✨"], sports: ["🏆", "⚽", "⭐", "✨"],
};
const MODE_ICONS = { name: "🗣️", listen: "👂", play: "🎹", explore: "👆" };

// ---------- State ----------
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
};

let lang = store.get("quiz-lang", (navigator.language || "en").startsWith("fr") ? "fr" : "en");
let topic = TOPICS.find(t => t.id === store.get("quiz-topic")) || TOPICS[0];
const groupOf = {}; // topic id -> chosen group
TOPICS.forEach(t => { groupOf[t.id] = store.get("quiz-group-" + t.id, "all"); });
const ITEMS = new Map(TOPICS.flatMap(t => t.items.map(i => [i.id, i])));
let screen = "home";
let deck = []; // items still to ask this game, so nothing repeats
let mode = "name", round = 0, stars = 0, answer = null, locked = false, firstTry = true, lastAnswer = null;
let gameId = 0;     // bumps when a game starts or ends, so its pending timers do nothing
let questionId = 0; // bumps every question, so stale timers and speech callbacks do nothing

const T = () => TEXT[lang];
const isMusic = () => topic.id === "instruments";
// a recording to play (instruments, landscapes, many animals), or a sound the voice makes
// (the other animals, dinosaurs)
const hasRecording = item => isMusic() || !!item.sound;
const hasSound = item => hasRecording(item) || !!item.says;
// how an item sounds, so the listening game never offers two that sound alike
const soundFamily = item => item.hears || item.family;
const nameOf = item => item[lang];
const shortName = item => cap(item[lang].replace(/^(le |la |les |l')/, "")); // "la flûte à bec" -> "Flûte à bec"
const soundOf = item => item.says && item.says[lang === "en" ? 0 : 1];
const unitOf = t => t.unit[lang === "en" ? 0 : 1];

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
  const main = lang === "fr" ? "fr-fr" : "en-us";
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
const clips = { en: {}, fr: {} };   // sentence -> data URI, from the packs loaded so far
const packs = {};                   // "fr/animals" -> Promise
function loadPack(l, name) {
  const key = l + "/" + name;
  if (!packs[key]) {
    loading[key] = packs[key] = fetch(`app/voice/${key}.json`)
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
let ctx, current, playToken = 0, soundsLoading = null;
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
// sounds.js is big (2.6 MB), so the page loads it in the background (an async script tag
// in index.html; scripts added from JavaScript are blocked in some embedded previews).
// Sounds wait for it here.
function loadSounds() {
  if (!soundsLoading) soundsLoading = new Promise((ok, fail) => {
    const started = Date.now();
    (function check() {
      if (window.INSTRUMENT_SOUNDS) return ok();
      if (Date.now() - started > 60000) { soundsLoading = null; return fail(); }
      setTimeout(check, 100);
    })();
  });
  return soundsLoading;
}
// Decode a recording the first time it is needed. Tunes are keyed by instrument id,
// play-mode sounds by "id#k".
function recording(id) {
  return loadSounds().then(() => {
    const [iid, k] = id.split("#");
    const uri = k === undefined ? window.INSTRUMENT_SOUNDS[iid] : (window.INSTRUMENT_NOTES[iid] || { samples: [] }).samples[k];
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
function stopSound() { if (current) { try { current.stop(); } catch (e) {} current = null; } }
function playInstrument(inst) {
  stopSound();
  const token = ++playToken;
  // waits for the recording if it is still loading; a newer play request wins
  recording(inst.id).then(b => {
    if (token !== playToken) return;
    const src = audio().createBufferSource();
    src.buffer = b;
    src.connect(audio().destination);
    src.start();
    current = src;
  }, () => {
    // no recording (sounds.js could not load): an animal still says its sound with the voice
    if (token === playToken && inst.says) say(extra(inst));
  });
}
// Play-mode keys: a pentatonic scale, so every combination sounds nice.
const KEY_STEPS = [-5, -3, 0, 2, 4, 7, 9, 12];
const KEY_COLORS = ["#e53935", "#fb8c00", "#fdd835", "#7cb342", "#26a69a", "#1e88e5", "#5e35b1", "#d81b60"];
function playNote(inst, k) {
  stopSound(); playToken++;
  const info = window.INSTRUMENT_NOTES[inst.id];
  // several sounds (drum kit, tabla): one per key; one sound: tuned up and down
  const many = info.samples.length > 1;
  const steps = many ? 0 : info.pitched ? KEY_STEPS[k] : KEY_STEPS[k] / 2;
  recording(inst.id + "#" + (many ? k % info.samples.length : 0)).then(b => {
    const src = audio().createBufferSource();
    src.buffer = b;
    src.playbackRate.value = Math.pow(2, steps / 12);
    src.connect(audio().destination);
    src.start();
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
  return g === "all" || !topic.groups ? topic.items : topic.items.filter(i => i.styles.includes(g));
}
// what a game asks about: in the listening game, only items with a sound; if the chosen
// group has too few, all of the topic's
function gamePool() {
  if (mode !== "listen") return groupPool();
  const pool = groupPool().filter(hasSound);
  return new Set(pool.map(soundFamily)).size >= CHOICES ? pool : topic.items.filter(hasSound);
}
// what the voice adds after naming an item: an animal's or dinosaur's sound, or a mushroom warning
function extra(item) {
  if (item.says) return T().says(nameOf(item), soundOf(item), item.like && item.like[lang === "en" ? 0 : 1]);
  if (item.poison) return T().poison;
  return "";
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
  return photoPacks[name] = fetch(`app/photos/${name}.json`)
    .then(r => (r.ok ? r.json() : {}))
    .then(map => Object.assign(photos, map))
    .catch(() => {}) // offline from a file: drawings instead
    .then(() => { photoLoading.delete(name); refreshPictures(); });
}
function srcOf(id) {
  if (look === "photos" && photos[id]) return photos[id];
  if (look === "photos" && photoLoading.size) return ""; // its photo may be on the way
  return window.INSTRUMENT_PICTURES[id];
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
}
function show(name) {
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
const bestKey = (t, m) => `quiz-best-${t.id}-${m}`;
function bestOf(t) { return Math.max(0, ...t.modes.map(m => +store.get(bestKey(t, m), 0))); }

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
    count.textContent = T().count(t.items.length, unitOf(t));
    b.append(picture(t.pic), name, count);
    const best = bestOf(t);
    if (best) {
      const badge = document.createElement("span");
      badge.className = "best";
      badge.textContent = `⭐ ${best}`;
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
  if (t.items.some(hasRecording)) loadSounds().catch(() => {});
  theme();
  renderTopic();
  show("topic");
}

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
  const modes = $("modes");
  modes.innerHTML = "";
  topic.modes.forEach(m => {
    const key = m === "listen" ? { instruments: "listenMusic", scenery: "listenScenery", dinosaurs: "listenDinosaurs", kitchen: "listenKitchen", letters: "listenLetters", transport: "listenTransport", weather: "listenWeather" }[topic.id] || "listenAnimals" : m;
    const [title, sub] = T().modes[key];
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mode";
    b.innerHTML = `<span class="mode-icon">${MODE_ICONS[m]}</span><span class="mode-text"><strong></strong><small></small></span><span class="mode-go">›</span>`;
    b.querySelector("strong").textContent = title;
    b.querySelector("small").textContent = sub;
    const best = +store.get(bestKey(topic, m), 0);
    if (best && (m === "name" || m === "listen")) b.querySelector("small").textContent += ` · ⭐ ${best}`;
    b.onclick = () => start(m);
    modes.appendChild(b);
  });
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
  if (mode !== "listen") return T().where(nameOf(answer), answer.many, topic.bare);
  if (isMusic()) return T().listen;
  if (answer.sound) return { scenery: T().whereAreWe, kitchen: T().whatIsIt, transport: T().whatIsIt, weather: T().whatWeather }[topic.id] || T().whoIsIt;
  return topic.id === "letters" ? T().whichLetter(soundOf(answer)) : T().who(soundOf(answer));
}

// Ask (or ask again): say the name, say "Listen!" then play the instrument, or ask "Who says moo?".
function ask() {
  const q = questionId;
  const btn = $("speak");
  btn.classList.remove("pulse"); void btn.offsetWidth; btn.classList.add("pulse");
  if (mode === "listen" && hasRecording(answer)) say(promptText(), () => { if (q === questionId) playInstrument(answer); });
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
  // wrong choices come from other families, so pictures and sounds are easy to tell
  // apart; prefer the same group, and in the animal sound game animals with a sound
  const fallback = mode === "listen" ? topic.items.filter(hasSound) : topic.items;
  const kind = mode === "listen" ? soundFamily : i => i.family;
  const others = [];
  for (const i of [...shuffle(pool), ...shuffle(fallback)]) {
    if (others.length < CHOICES - 1 && i.family !== answer.family && kind(i) !== kind(answer) && !others.some(o => o.family === i.family || kind(o) === kind(i))) others.push(i);
  }
  const box = $("choices");
  box.innerHTML = "";
  shuffle([answer, ...others]).forEach(item => {
    const b = card(item);
    b.onclick = () => pick(item, b);
    box.appendChild(b);
  });
  $("promptText").textContent = promptText();
  ask();
}

function showName(btn, item) {
  btn.querySelector(".label").textContent = shortName(item);
  btn.classList.add("named");
}

function pick(item, btn) {
  if (locked) return;
  const q = questionId;
  showName(btn, item);
  if (item === answer) {
    locked = true;
    questionId++; // cancel any pending replay of the question
    btn.classList.add("right");
    $("promptText").textContent = T().yes(nameOf(item), topic.bare);
    cheer();
    results.push(firstTry);
    if (firstTry) stars++;
    renderProgress();
    confetti(10);
    round++;
    const g = gameId;
    const next = () => { if (g === gameId) (round >= ROUNDS ? finish : askQuestion)(); };
    const hear = hasRecording(item) && mode === "name"; // found by name: now let them hear it
    // "Yes! The cow! The cow says moo!", then the next question
    say([T().yes(nameOf(item), topic.bare), hasRecording(item) ? "" : extra(item)], () => {
      if (g !== gameId) return;
      if (hear) playInstrument(item);
      setTimeout(next, hear ? 3000 : 900);
    });
  } else {
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

function finish() {
  const key = bestKey(topic, mode);
  const best = +store.get(key, 0);
  if (stars > best) store.set(key, String(stars));
  $("doneText").textContent = T().found(stars);
  const row = $("doneStars");
  row.innerHTML = "";
  results.forEach(ok => {
    const s = document.createElement("span");
    s.textContent = "⭐";
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
  round = 0; stars = 0; results = []; lastAnswer = null; deck = [];
  $("speak").textContent = mode === "listen" ? "👂" : "🔊";
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
  else say([T().name(nameOf(playing), topic.bare), extra(playing)]);
}

function bounce() {
  const big = $("bigPic");
  big.classList.remove("bounce"); void big.offsetWidth; big.classList.add("bounce");
}

function openPlay() {
  $("playTitle").textContent = topic[lang];
  $("keys").hidden = !isMusic();
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
  document.querySelectorAll(".lang-btn").forEach(b => { b.textContent = T().flag; b.setAttribute("aria-label", lang === "en" ? "Français" : "English"); });
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
    $("promptText").textContent = locked ? T().yes(nameOf(answer), topic.bare) : promptText();
    if (!locked) ask();
  }
  if (screen === "play" && playing) {
    $("playTitle").textContent = topic[lang];
    document.querySelectorAll(".thumb").forEach(b => b.setAttribute("aria-label", nameOf(ITEMS.get(b.dataset.id))));
    selectItem(playing, false);
  }
  if (screen === "done") $("doneText").textContent = T().found(stars);
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

function confetti(n) {
  const bits = CONFETTI[topic.id] || ["⭐", "🎉", "✨"];
  for (let i = 0; i < n; i++) {
    const s = document.createElement("span");
    s.className = "confetti";
    s.textContent = bits[i % bits.length];
    s.style.left = Math.random() * 90 + "vw";
    s.style.animationDuration = 1.5 + Math.random() * 1.5 + "s";
    s.style.animationDelay = Math.random() * 0.5 + "s";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 3600);
  }
}

// ---------- Wiring ----------
document.querySelectorAll(".lang-btn").forEach(b => b.onclick = () => setLang(lang === "en" ? "fr" : "en"));
document.querySelector(".info-btn").onclick = () => $("about").showModal();
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
$("speak").onclick = () => { if (!locked) ask(); };
$("bigPic").onclick = sayItem;
KEY_COLORS.forEach((c, k) => {
  const key = document.createElement("div");
  key.className = "key";
  key.dataset.k = k;
  key.style.background = c;
  $("keys").appendChild(key);
});
$("keys").addEventListener("pointerdown", e => { e.preventDefault(); $("keys").releasePointerCapture?.(e.pointerId); press(e.pointerId, keyAt(e.clientX, e.clientY)); });
$("keys").addEventListener("pointermove", e => { if (pressed.has(e.pointerId)) press(e.pointerId, keyAt(e.clientX, e.clientY)); });
["pointerup", "pointercancel", "pointerleave"].forEach(t => $("keys").addEventListener(t, release));
const LOOK_SAMPLES = ["lion", "sunflower", "strawberry"];
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
      if (l === "drawings") img.src = window.INSTRUMENT_PICTURES[id];
      else img.className = "photo";
      row.appendChild(img);
    });
  });
  const fill = () => document.querySelectorAll("#look-photos img").forEach(img => {
    img.src = photos[img.dataset.sample] || window.INSTRUMENT_PICTURES[img.dataset.sample];
  });
  (loadPhotos("covers", true) || Promise.resolve()).then(fill);
  show("look");
}
["drawings", "photos"].forEach(l => {
  $("look-" + l).onclick = () => { audio(); setLook(l); goHome(); };
});
$("lookBtn").onclick = openLook;
// keyboard: 1-3 pick a picture, space repeats the question, Escape goes back
document.addEventListener("keydown", e => {
  if ($("about").open) return;
  if (screen === "game" && /^[1-3]$/.test(e.key)) $("choices").children[e.key - 1]?.click();
  else if (screen === "game" && e.key === " ") { e.preventDefault(); if (!locked) ask(); }
  else if (e.key === "Escape") { if (screen === "topic") goHome(); else if (screen !== "home") backToTopic(); }
});
if ("speechSynthesis" in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
// offline support when served from a website (not from a file or inside a preview frame)
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

translate();
renderHome();
theme();
loadVoice();
// first start: drawings or photos?
if (look) setLook(look); else openLook();
