// Render short tunes for instruments that tonejs-instruments lacks, using the
// GeneralUser GS General MIDI sound bank (npm: generaluser) and spessasynth_core.
// Usage: node tools/render_gm.mjs <GeneralUser.sf2> <out dir>
// (spessasynth_core must be resolvable, e.g. run from a folder where it is installed.)
import fs from "node:fs";
import path from "node:path";
import { SpessaSynthProcessor, SoundBankLoader, audioToWav } from "spessasynth_core";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const m = n => typeof n === "number" ? n : NAMES.indexOf(n.slice(0, -1)) + 12 * (+n.slice(-1) + 1);
// notes one after another: seq("C4 E4 G4", step, length, start, velocity, lastLength)
const seq = (notes, step, len, start = 0, vel = 105, last = len) =>
  notes.split(" ").map((n, i, all) => [start + i * step, m(n), vel, i === all.length - 1 ? last : len]);
// notes at given times
const at = (note, times, vel = 110, len = .3) => times.map((t, i) => [t, m(note), typeof vel === "function" ? vel(i) : vel, len]);
const chord = (notes, t, len, vel = 100, spread = .03) => notes.split(" ").map((n, i) => [t + i * spread, m(n), vel, len]);

// id -> { program, kit (drum kit number; plays on the drum channel), events, len, extra: [{program, events}] }
const STANDARD = 0;
// Only instruments that no recorded library covers (see tools/make_sounds.py).
const TUNES = {
  "steel-drum": { program: 114, len: 2.8, events: [[0, m("C5"), 110, .3], [.2, m("E5"), 110, .3], [.4, m("G5"), 115, .5], [.8, m("E5"), 110, .3], [1.0, m("G5"), 110, .3], [1.2, m("A5"), 115, .5], [1.6, m("G5"), 110, .3], [1.8, m("E5"), 110, .3], [2.0, m("C5"), 115, .8]] },
  djembe: { kit: STANDARD, len: 2.4, events: [[0, 64, 120, .3], [.25, 63, 105, .2], [.375, 63, 100, .2], [.5, 62, 115, .2], [.75, 64, 120, .3], [1.0, 63, 105, .2], [1.125, 62, 110, .2], [1.25, 62, 115, .2], [1.5, 64, 127, .3], [1.75, 63, 110, .2], [2.0, 64, 127, .3]] },
  bongos: { kit: STANDARD, len: 2.2, events: [[0, 60, 115, .2], [.15, 60, 95, .2], [.3, 61, 115, .2], [.5, 60, 115, .2], [.65, 60, 95, .2], [.8, 61, 115, .2], [1.0, 60, 110, .2], [1.15, 61, 110, .2], [1.3, 61, 115, .2], [1.5, 60, 120, .2], [1.65, 60, 100, .2], [1.8, 61, 127, .3]] },
  taiko: { program: 116, len: 3.0, events: [[0, 43, 127, .8], [.5, 43, 110, .6], [.75, 43, 110, .6], [1.25, 48, 120, .5], [1.4, 48, 105, .5], [1.55, 48, 110, .5], [1.75, 43, 127, 1.2]] },
  maracas: { kit: STANDARD, len: 2.2, events: at(70, [0, .25, .5, .62, .75, 1.0, 1.25, 1.37, 1.5], i => i % 2 ? 90 : 120, .1) },
  tambourine: { kit: STANDARD, len: 2.2, events: at(54, [0, .25, .5, .75, 1.0, 1.12, 1.25, 1.5], i => i % 2 ? 95 : 125, .2) },
  castanets: { kit: STANDARD, len: 2.2, events: at(85, [0, .08, .16, .24, .5, .75, .83, .91, .99, 1.25, 1.5], i => 100 + (i % 3) * 10, .1) },
  guiro: { kit: STANDARD, len: 2.2, events: [[0, 74, 115, .4], [.45, 73, 110, .1], [.6, 73, 110, .1], [.75, 74, 120, .4], [1.2, 73, 110, .1], [1.35, 73, 110, .1], [1.5, 74, 125, .5]] },
  whistle: { kit: STANDARD, len: 2.4, events: [[0, 71, 115, .2], [.35, 71, 115, .2], [.7, 72, 127, 1.0]] },
  "jingle-bells": { kit: STANDARD, len: 2.2, events: at(83, [0, .25, .5, .62, .75, 1.0, 1.25, 1.37, 1.5], i => i % 2 ? 95 : 125, .2) },
};

// One note or hit per instrument for the play mode: [midi note, velocity, length]
const NOTES = {
  "steel-drum": [72, 110, 1.6], taiko: [43, 127, 1.6], djembe: [64, 120, 1.2], bongos: [60, 115, 1.2], maracas: [70, 120, 1.2],
  tambourine: [54, 120, 1.2], castanets: [85, 115, 1.2], guiro: [74, 120, 1.2], whistle: [71, 120, 1.2], "jingle-bells": [83, 120, 1.2],
};

const [sf2, outDir] = process.argv.slice(2);
const bank = SoundBankLoader.fromArrayBuffer(fs.readFileSync(sf2).buffer);
fs.mkdirSync(outDir, { recursive: true });
const RATE = 44100, BLOCK = 128, DRUMS = 9;

async function render(tune, file) {
  const synth = new SpessaSynthProcessor(RATE, { enableEventSystem: false });
  synth.soundBankManager.addSoundBank(bank, "gu");
  await synth.processorInitialized;
  const ch = tune.kit !== undefined ? DRUMS : 0;
  synth.programChange(ch, tune.kit ?? tune.program);
  synth.controllerChange(ch, 91, 30); // a little reverb
  const queue = [];
  for (const [t, n, v, l] of tune.events) {
    queue.push([t, () => synth.noteOn(ch, n, v)]);
    queue.push([t + l, () => synth.noteOff(ch, n)]);
  }
  queue.sort((a, b) => a[0] - b[0]);
  const total = Math.ceil(tune.len * RATE / BLOCK) * BLOCK;
  const L = new Float32Array(total), R = new Float32Array(total);
  for (let i = 0; i < total; i += BLOCK) {
    while (queue.length && queue[0][0] * RATE <= i) queue.shift()[1]();
    synth.process(L, R, i, BLOCK);
  }
  // fade the last 0.3 s so nothing is cut off abruptly
  const fade = .3 * RATE;
  for (let i = 0; i < fade; i++) { L[total - fade + i] *= 1 - i / fade; R[total - fade + i] *= 1 - i / fade; }
  fs.writeFileSync(path.join(outDir, file), Buffer.from(audioToWav([L, R], RATE)));
}

for (const [id, tune] of Object.entries(TUNES)) {
  await render(tune, id + ".wav");
  const [note, vel, len] = NOTES[id];
  await render({ ...tune, len: len + .4, events: [[0, note, vel, len]] }, id + ".note.wav");
}
console.log(Object.keys(TUNES).length, "tunes rendered");
