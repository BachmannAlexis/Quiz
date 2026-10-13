// Lists, per topic, the ids whose pictures and sounds belong in that topic's packs, for tools/make_pictures.py and
// tools/make_sounds.py: {"home": [topic covers and first-start samples], "<topic>": [items and group pictures]}.
// Usage: node tools/topic_ids.mjs
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "app/topics.js"), "utf8"), ctx);
const { TOPICS, LOOK_SAMPLES } = vm.runInContext("({ TOPICS, LOOK_SAMPLES })", ctx);
const out = { home: [...new Set([...TOPICS.map(t => t.pic), ...LOOK_SAMPLES])] };
for (const t of TOPICS) out[t.id] = [...new Set([...t.items.map(i => i.id), ...(t.groups || []).map(g => g.pic)])];
process.stdout.write(JSON.stringify(out));
