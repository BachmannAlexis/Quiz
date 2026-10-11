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
const { TOPICS, TEXT, cap } = vm.runInContext("({ TOPICS, TEXT, cap })", ctx);

const out = {};
for (const lang of ["en", "fr"]) {
  const T = TEXT[lang];
  const soundOf = item => item.says && item.says[lang === "en" ? 0 : 1];
  // same as extra() in app.js
  const extra = item => item.says ? T.says(item[lang], soundOf(item)) : item.poison ? T.poison : "";
  const common = new Set([T.listen, T.whereAreWe, T.whoIsIt, T.no, T.bravoSaid, T.voiceSample]);
  for (const t of TOPICS) {
    common.add(t[lang]);
    for (const g of t.groups || []) common.add(g[lang]);
  }
  out[lang] = { common: [...common] };
  for (const t of TOPICS) {
    const s = new Set();
    for (const item of t.items) {
      s.add(T.where(item[lang], item.many));
      s.add(T.yes(item[lang]));
      s.add(cap(item[lang]));
      if (extra(item)) s.add(extra(item));
      if (item.says) s.add(T.who(soundOf(item)));
    }
    out[lang][t.id] = [...s];
  }
}
process.stdout.write(JSON.stringify(out, null, 1));
