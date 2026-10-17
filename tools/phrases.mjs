// Lists every sentence Pikolo can say, per language and voice pack, for tools/make_voice.py.
// It loads app/topics.js, app/words.js and the languages in app/lang/, and builds the sentences the same way app.js does.
// Usage: node tools/phrases.mjs > phrases.json
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {};
vm.createContext(ctx);
const LANGS = ["en", "fr", "de", "it"];
for (const f of ["app/topics.js", "app/words.js", "app/lang/de.js", "app/lang/it.js"])
  if (fs.existsSync(path.join(root, f))) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const { TOPICS, TEXT, cap, COUNTRIES, clockNames, mathQuestions } = vm.runInContext("({ TOPICS, TEXT, cap, COUNTRIES, clockNames, mathQuestions })", ctx);

const out = {};
for (const lang of LANGS.filter(l => TOPICS[0].items[0][l])) {
  const T = TEXT[lang], k = LANGS.indexOf(lang);
  // the same helpers as in app.js
  const soundOf = item => item.says && item.says[k];
  const likeOf = item => item.like && item.like[k];
  const manyOf = item => lang === "en" || lang === "fr" ? item.many : !!(item.plural && item.plural[lang]);
  const extra = item => soundOf(item) ? T.says(item[lang], soundOf(item), likeOf(item))
    : item.quiet && item.quiet[k] ? T.quiet(item[lang], item.quiet[k]) : item.poison ? T.poison
    : item.blend ? T.blend(item.blend[0], item.blend[1], item[lang])
    : item.from ? (c => T.from(item[lang], c[lang], manyOf(item), manyOf(c)))(COUNTRIES.find(c => c.id === item.from))
    : item.feel ? item.feel[k] : item.fact ? item.fact[k] : item.word ? T.soundAs(item[lang], item.word) : item.parts ? soundOut(item) : "";
  // "lu… ne… lune !"; English sound by sound
  const soundOut = item => {
    const parts = item.parts.map(p => p.startsWith("/") ? `[[ ${p.slice(1)} ]]` : p);
    return parts.length > 1 || item.parts[0].startsWith("/") ? T.soundOut(parts.join("… "), item[lang]) : T.name(item[lang], true);
  };
  const common = new Set([T.listen, T.whereAreWe, T.whoIsIt, T.whatIsIt, T.whatWeather, T.no, T.bravoSaid, T.voiceSample, T.sayWhat, T.sayFeel, T.sayRead, T.readIt, T.yourTurn, T.bravo, T.puzzleGo, ...T.levels]);
  for (const t of TOPICS) {
    common.add(t[lang]);
    for (const g of t.groups || []) common.add(g[lang]);
  }
  out[lang] = { common: [...common] };
  for (const t of TOPICS) {
    const s = new Set();
    // maths: the pieces of every question and answer of every mode and level, and the numbers a child can tap (pickNumber)
    if (t.math) {
      for (const m of t.modes) for (const level of [1, 2, 3]) for (const [a, b] of mathQuestions(m, level)) {
        for (const part of b < 0 ? T.minusQ(a, -b) : T.plusQ(a, b)) s.add(part); // said in pieces
        for (const part of b < 0 ? T.minusYes(a, -b, a + b) : T.plusYes(a, b, a + b)) s.add(part);
      }
      for (let n = -10; n <= 23; n++) s.add(T.name(String(n), true));
      out[lang][t.id] = [...s];
      continue;
    }
    // Castles: the game's sentences, no names to find
    if (t.game) {
      for (const k of ["castleGo", "castleCaught", "castleWin", "castleLose", "castleDogs", "castleCats", "castleDogsWin", "castleCatsWin"]) s.add(T[k]);
      out[lang][t.id] = [...s];
      continue;
    }
    for (const item of t.items) {
      if (item.only && item.only !== lang) continue; // sounds and words of another language
      if (t.id !== "reading") s.add(t.id === "clock" ? T.showTime(item[lang]) : t.id === "emotions" ? T.whoFeels(item[lang]) : T.where(item[lang], manyOf(item), t.bare));
      s.add(t.id === "emotions" ? T.yesFeel(item[lang]) : T.yes(item[lang], t.bare));
      s.add(T.name(item[lang], t.bare));
      if (extra(item)) s.add(extra(item));
      if (soundOf(item)) s.add(t.id === "letters" ? T.whichLetter(soundOf(item)) : T.who(soundOf(item)));
    }
    // the clock to play with says every time, in steps of 5 minutes
    if (t.id === "clock") for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) s.add(T.name(clockNames(h, m)[k], true));
    out[lang][t.id] = [...s];
  }
}
// how make_voice.py says each sound card ("« ou »" -> the sound u, not the word "ou")
out._phonemes = {};
for (const t of TOPICS) for (const i of t.items) if (i.grapheme) (out._phonemes[i.only] = out._phonemes[i.only] || {})[i[i.only]] = i.ipa;
process.stdout.write(JSON.stringify(out, null, 1));
