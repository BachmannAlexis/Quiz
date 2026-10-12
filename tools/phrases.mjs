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
const { TOPICS, TEXT, cap, COUNTRIES } = vm.runInContext("({ TOPICS, TEXT, cap, COUNTRIES })", ctx);

const out = {};
for (const lang of LANGS.filter(l => TOPICS[0].items[0][l])) {
  const T = TEXT[lang], k = LANGS.indexOf(lang);
  // the same helpers as in app.js
  const soundOf = item => item.says && item.says[k];
  const likeOf = item => item.like && item.like[k];
  const manyOf = item => lang === "en" || lang === "fr" ? item.many : !!(item.plural && item.plural[lang]);
  const extra = item => soundOf(item) ? T.says(item[lang], soundOf(item), likeOf(item)) : item.poison ? T.poison
    : item.from ? (c => T.from(item[lang], c[lang], manyOf(item), manyOf(c)))(COUNTRIES.find(c => c.id === item.from)) : "";
  const common = new Set([T.listen, T.whereAreWe, T.whoIsIt, T.whatIsIt, T.whatWeather, T.no, T.bravoSaid, T.voiceSample, ...T.levels]);
  for (const t of TOPICS) {
    common.add(t[lang]);
    for (const g of t.groups || []) common.add(g[lang]);
  }
  out[lang] = { common: [...common] };
  for (const t of TOPICS) {
    const s = new Set();
    for (const item of t.items) {
      s.add(T.where(item[lang], manyOf(item), t.bare));
      s.add(T.yes(item[lang], t.bare));
      s.add(T.name(item[lang], t.bare));
      if (extra(item)) s.add(extra(item));
      if (soundOf(item)) s.add(t.id === "letters" ? T.whichLetter(soundOf(item)) : T.who(soundOf(item)));
    }
    out[lang][t.id] = [...s];
  }
}
process.stdout.write(JSON.stringify(out, null, 1));
