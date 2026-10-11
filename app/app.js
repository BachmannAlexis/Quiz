// Pikolo: a picture quiz for little ones. Data is in topics.js, pictures in pictures.js,
// instrument sounds in sounds.js (loaded the first time music is needed).
"use strict";

const SHARE_URL = "https://bachmannalexis.github.io/Quiz/";
const SOURCE_URL = "https://github.com/BachmannAlexis/Quiz";
const ROUNDS = 10;
const CHOICES = 3;

// ---------- Words ----------
const TEXT = {
  en: {
    where: (n, many) => `Where ${many ? "are" : "is"} the ${n}?`, listen: "Listen! Who is playing?",
    who: sound => `Who says ${sound}?`, says: (n, sound) => `The ${n} says ${sound}!`,
    poison: "Careful! This mushroom is poisonous. Never eat it!",
    yes: n => `Yes! The ${n}!`, no: "Try again!", bravo: "Bravo!", bravoSaid: "Bravo! You did it!",
    flag: "🇬🇧 EN", voice: "en-US",
    tagline: "Learn words with pictures and sounds",
    count: (n, unit) => `${n} ${unit}`,
    modes: {
      name: ["Find the picture", "Hear a name, tap the right picture"],
      listenMusic: ["Who is playing?", "Hear an instrument, find it"],
      listenAnimals: ["Who says that?", "Hear a sound, find the animal"],
      play: ["Play music", "Tap an instrument, play the rainbow keys"],
      explore: ["Discover", "Tap a picture to hear its name"],
    },
    found: n => `${n} stars out of ${ROUNDS}`, record: "New record!",
    again: "Play again", otherGame: "Other games", share: "Share", copied: "Link copied",
    parents: "For parents", back: "Back", close: "Close", repeat: "Hear it again", hearAgain: "Hear it again",
    parentsTitle: "For parents",
    parentsIntro: "Pikolo is a free picture quiz for children from 3 years old. No reading needed: everything is spoken.",
    howTitle: "How to play",
    howName: "Find the picture: the voice says a name, your child taps the right picture among three.",
    howListen: "Who is playing? / Who says that?: the same with an instrument or an animal sound.",
    howPlay: "Discover: tap any picture to hear its name. In Music, play the instrument on the rainbow keys.",
    howStars: "A star for each first-try answer. Look-alikes (lion and tiger, trumpet and trombone) never appear together.",
    shareTitle: "Share Pikolo",
    shareText: "Send this link to family and friends. It opens in any browser on a phone, tablet or computer.",
    installTip: "Tip: in your browser menu, choose “Add to Home Screen” to use Pikolo like an app, even offline.",
    privacyTitle: "Privacy",
    privacyText: "No ads, no account, nothing collected. Pikolo runs entirely on your device and works offline.",
    creditsTitle: "Pictures and sounds",
    creditsText: `Pictures from <a href="https://github.com/googlefonts/noto-emoji" target="_blank" rel="noopener">Noto Emoji</a> (Apache 2.0) and drawn for Pikolo. Recordings from VSCO 2 Community Edition, Salamander Grand Piano, tonejs-instruments, Sonic Pi, and the MusyngKite and GeneralUser GS sound banks. Font: Fredoka. Full credits and source on <a href="${SOURCE_URL}" target="_blank" rel="noopener">GitHub</a>.`,
  },
  fr: {
    where: (n, many) => `Où ${many ? "sont" : "est"} ${n} ?`, listen: "Écoute ! Qui joue ?",
    who: sound => `Qui fait ${sound} ?`, says: (n, sound) => `${cap(n)} fait ${sound} !`,
    poison: "Attention ! Ce champignon est toxique. Il ne faut jamais le manger !",
    yes: n => `Oui ! C'est ${n} !`, no: "Essaie encore !", bravo: "Bravo !", bravoSaid: "Bravo ! Tu as réussi !",
    flag: "🇫🇷 FR", voice: "fr-FR",
    tagline: "Apprendre des mots en images et en sons",
    count: (n, unit) => `${n} ${unit}`,
    modes: {
      name: ["Trouve l'image", "Écoute un nom, touche la bonne image"],
      listenMusic: ["Qui joue ?", "Écoute un instrument, trouve-le"],
      listenAnimals: ["Qui fait ce bruit ?", "Écoute un cri, trouve l'animal"],
      play: ["Joue de la musique", "Choisis un instrument, joue sur l'arc-en-ciel"],
      explore: ["Découvre", "Touche une image pour entendre son nom"],
    },
    found: n => `${n} étoiles sur ${ROUNDS}`, record: "Nouveau record !",
    again: "Rejouer", otherGame: "Autres jeux", share: "Partager", copied: "Lien copié",
    parents: "Pour les parents", back: "Retour", close: "Fermer", repeat: "Réécouter", hearAgain: "Réécouter",
    parentsTitle: "Pour les parents",
    parentsIntro: "Pikolo est un quiz en images gratuit pour les enfants dès 3 ans. Pas besoin de savoir lire : tout est dit à voix haute.",
    howTitle: "Comment jouer",
    howName: "Trouve l'image : la voix dit un nom, votre enfant touche la bonne image parmi trois.",
    howListen: "Qui joue ? / Qui fait ce bruit ? : pareil avec un instrument ou un cri d'animal.",
    howPlay: "Découvre : touchez une image pour entendre son nom. En musique, jouez de l'instrument sur les touches arc-en-ciel.",
    howStars: "Une étoile pour chaque bonne réponse du premier coup. Les images qui se ressemblent (lion et tigre, trompette et trombone) ne sont jamais ensemble.",
    shareTitle: "Partager Pikolo",
    shareText: "Envoyez ce lien à la famille et aux amis. Il s'ouvre dans n'importe quel navigateur, sur téléphone, tablette ou ordinateur.",
    installTip: "Astuce : dans le menu du navigateur, choisissez « Ajouter à l'écran d'accueil » pour utiliser Pikolo comme une appli, même hors connexion.",
    privacyTitle: "Vie privée",
    privacyText: "Pas de publicité, pas de compte, aucune donnée collectée. Pikolo fonctionne entièrement sur votre appareil, même hors connexion.",
    creditsTitle: "Images et sons",
    creditsText: `Images de <a href="https://github.com/googlefonts/noto-emoji" target="_blank" rel="noopener">Noto Emoji</a> (Apache 2.0) et dessinées pour Pikolo. Enregistrements : VSCO 2 Community Edition, Salamander Grand Piano, tonejs-instruments, Sonic Pi, banques de sons MusyngKite et GeneralUser GS. Police : Fredoka. Crédits complets et code source sur <a href="${SOURCE_URL}" target="_blank" rel="noopener">GitHub</a>.`,
  },
};
const CONFETTI = {
  instruments: ["🎵", "🎶", "⭐", "✨"], animals: ["🐾", "⭐", "🎉", "✨"], flowers: ["🌸", "🌼", "⭐", "✨"],
  trees: ["🍃", "🍂", "⭐", "✨"], mushrooms: ["🍄", "⭐", "🎉", "✨"], scenery: ["☀️", "☁️", "⭐", "✨"],
  dinosaurs: ["🦖", "🦕", "⭐", "✨"],
};
const MODE_ICONS = { name: "🗣️", listen: "👂", play: "🎹", explore: "👆" };

// ---------- State ----------
const $ = id => document.getElementById(id);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
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
const nameOf = item => item[lang];
const shortName = item => cap(item[lang].replace(/^(le |la |les |l')/, "")); // "la flûte à bec" -> "Flûte à bec"
const soundOf = item => item.says && item.says[lang === "en" ? 0 : 1];
const unitOf = t => t.unit[lang === "en" ? 0 : 1];

// ---------- Speech ----------
let voices = [];
function loadVoices() { if ("speechSynthesis" in window) voices = speechSynthesis.getVoices(); }
// the most natural voice the device offers for the language
function bestVoice() {
  const mine = voices.filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(lang));
  const score = v => (/natural|neural|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google|siri|samantha|amélie|thomas|audrey/i.test(v.name) ? 2 : 0) + (v.localService ? 1 : 0);
  return mine.sort((a, b) => score(b) - score(a))[0];
}
function say(text, onDone) {
  let done = false;
  const finish = () => { if (!done) { done = true; onDone && onDone(); } };
  if (!("speechSynthesis" in window)) { setTimeout(finish, 300); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = T().voice;
  u.rate = 0.85;
  u.pitch = 1.15;
  const v = bestVoice();
  if (v) u.voice = v;
  u.onend = finish;
  u.onerror = finish;
  speechSynthesis.speak(u);
  if (onDone) setTimeout(finish, 1500 + text.length * 90); // some browsers never fire onend
}
function hush() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

// ---------- Sounds ----------
let ctx, current, playToken = 0, soundsLoading = null;
const buffers = {}; // id -> Promise<AudioBuffer>
function audio() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
// sounds.js is big (2.6 MB), so it only loads when music is opened
function loadSounds() {
  if (window.INSTRUMENT_SOUNDS) return Promise.resolve();
  if (!soundsLoading) soundsLoading = new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = "app/sounds.js";
    s.onload = ok;
    s.onerror = () => { soundsLoading = null; fail(); };
    document.head.appendChild(s);
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
  }, () => {});
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
// what a game asks about: in the animal sound game, only animals with a sound; if the
// chosen group has too few, all of them
function gamePool() {
  if (mode !== "listen" || isMusic()) return groupPool();
  const pool = groupPool().filter(i => i.says);
  return families(pool) >= CHOICES ? pool : topic.items.filter(i => i.says);
}
// what the voice adds after naming an item: an animal's sound or a mushroom warning
function extra(item) {
  if (item.says) return T().says(nameOf(item), soundOf(item));
  if (item.poison) return T().poison;
  return "";
}

// ---------- Screens ----------
function picture(id, cls) {
  const img = document.createElement("img");
  img.src = window.INSTRUMENT_PICTURES[id];
  img.alt = "";
  if (cls) img.className = cls;
  return img;
}
function show(name) {
  screen = name;
  document.querySelectorAll(".screen").forEach(s => { s.hidden = s.id !== name; });
  document.body.classList.toggle("themed", name !== "home");
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
  if (isMusic()) loadSounds().catch(() => {});
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
  [picks[1], picks[0], picks[2]].filter(Boolean).forEach(i => hero.appendChild(picture(i.id)));
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
    const key = m === "listen" ? (isMusic() ? "listenMusic" : "listenAnimals") : m;
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
  if (mode !== "listen") return T().where(nameOf(answer), answer.many);
  return isMusic() ? T().listen : T().who(soundOf(answer));
}

// Ask (or ask again): say the name, say "Listen!" then play the instrument, or ask "Who says moo?".
function ask() {
  const q = questionId;
  const btn = $("speak");
  btn.classList.remove("pulse"); void btn.offsetWidth; btn.classList.add("pulse");
  if (mode === "listen" && isMusic()) say(T().listen, () => { if (q === questionId) playInstrument(answer); });
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
  if (isMusic()) recording(answer.id).catch(() => {}); // start decoding now so the sound is ready
  // wrong choices come from other families, so pictures and sounds are easy to tell
  // apart; prefer the same group, and in the animal sound game animals with a sound
  const fallback = mode === "listen" && !isMusic() ? topic.items.filter(i => i.says) : topic.items;
  const others = [];
  for (const i of [...shuffle(pool), ...shuffle(fallback)]) {
    if (others.length < CHOICES - 1 && i.family !== answer.family && !others.some(o => o.family === i.family)) others.push(i);
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
    $("promptText").textContent = T().yes(nameOf(item));
    cheer();
    results.push(firstTry);
    if (firstTry) stars++;
    renderProgress();
    confetti(10);
    round++;
    const g = gameId;
    const next = () => { if (g === gameId) (round >= ROUNDS ? finish : askQuestion)(); };
    const hear = isMusic() && mode === "name"; // found by name: now let them hear it
    // "Yes! The cow! The cow says moo!", then the next question
    say(`${T().yes(nameOf(item))} ${isMusic() ? "" : extra(item)}`, () => {
      if (g !== gameId) return;
      if (hear) playInstrument(item);
      setTimeout(next, hear ? 3000 : 900);
    });
  } else {
    firstTry = false;
    btn.classList.add("wrong");
    btn.disabled = true;
    boop();
    if (mode === "listen" && isMusic()) {
      // play the right sound again so they can compare
      setTimeout(() => { if (q === questionId) playInstrument(answer); }, 500);
    } else {
      // say what they tapped ("The cat says meow!"), then gently ask again
      const what = mode === "listen" && item.says ? extra(item) : `${shortName(item)}.`;
      say(`${what} ${T().no}`, () => { if (q === questionId) setTimeout(() => { if (q === questionId) ask(); }, 400); });
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
  $("bigPic").querySelector("img").src = window.INSTRUMENT_PICTURES[item.id];
  $("bigPic").classList.toggle("poison", !!item.poison);
  $("bigName").textContent = shortName(item);
  document.querySelectorAll(".thumb").forEach(t => t.setAttribute("aria-pressed", t.dataset.id === item.id));
  if (isMusic()) recording(item.id + "#0").catch(() => {});
  if (speak) sayItem();
}

// say the item's name, then play its tune or add its sound or warning
function sayItem() {
  const q = ++questionId;
  bounce();
  if (isMusic()) say(nameOf(playing), () => { if (q === questionId) { bounce(); playInstrument(playing); } });
  else say(`${cap(nameOf(playing))}. ${extra(playing)}`);
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
  translate();
  if (screen === "home") renderHome();
  if (screen === "topic") renderTopic();
  if (screen === "game" && answer) {
    document.querySelectorAll(".choice").forEach(b => {
      const item = ITEMS.get(b.dataset.id);
      b.setAttribute("aria-label", nameOf(item));
      if (b.classList.contains("named")) b.querySelector(".label").textContent = shortName(item);
    });
    $("promptText").textContent = locked ? T().yes(nameOf(answer)) : promptText();
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
  const bits = CONFETTI[topic.id];
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
