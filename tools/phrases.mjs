// Lists every sentence Pikolo can say, per language and voice pack, for tools/make_voice.py.
// It loads app/words.js and app/topics.js and builds the sentences the same way app.js does.
// Usage: node tools/phrases.mjs > phrases.json
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {};
vm.createContext(ctx);
for (const f of ["app/topics.js", "app/words.js"]) vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const { TOPICS, TEXT, cap, COUNTRIES } = vm.runInContext("({ TOPICS, TEXT, cap, COUNTRIES })", ctx);

const out = {};
for (const lang of ["en", "fr"]) {
  const T = TEXT[lang];
  const soundOf = item => item.says && item.says[lang === "en" ? 0 : 1];
  // same as extra() in app.js
  const likeOf = item => item.like && item.like[lang === "en" ? 0 : 1];
  const extra = item => item.says ? T.says(item[lang], soundOf(item), likeOf(item)) : item.poison ? T.poison
    : item.from ? T.from(item[lang], COUNTRIES.find(c => c.id === item.from)[lang], item.many) : "";
  const common = new Set([T.listen, T.whereAreWe, T.whoIsIt, T.whatIsIt, T.whatWeather, T.no, T.bravoSaid, T.voiceSample]);
  for (const t of TOPICS) {
    common.add(t[lang]);
    for (const g of t.groups || []) common.add(g[lang]);
  }
  out[lang] = { common: [...common] };
  for (const t of TOPICS) {
    const s = new Set();
    for (const item of t.items) {
      s.add(T.where(item[lang], item.many, t.bare));
      s.add(T.yes(item[lang], t.bare));
      s.add(T.name(item[lang], t.bare));
      if (extra(item)) s.add(extra(item));
      if (item.says) s.add(t.id === "letters" ? T.whichLetter(soundOf(item)) : T.who(soundOf(item)));
    }
    out[lang][t.id] = [...s];
  }
}
process.stdout.write(JSON.stringify(out, null, 1));
