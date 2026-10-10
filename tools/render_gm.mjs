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
const STANDARD = 0, ORCHESTRA = 48;
const TUNES = {
  // ---- orchestra
  oboe: { program: 68, len: 3.2, events: seq("G4 B4 D5 C5 B4 A4 G4", .32, .34, 0, 100, 1.0) },
  timpani: { program: 47, len: 3.0, events: [
    ...[0, .3, .6, .82, 1.02, 1.2, 1.36, 1.5, 1.62, 1.74].map((t, i) => [t, m(i % 2 ? "G1" : "C2"), 90 + i * 3, .3]), [1.9, m("C2"), 127, 1.1]] },
  cymbals: { kit: ORCHESTRA, len: 3.2, events: [[0, 49, 110, 1], [.9, 57, 100, 1], [1.6, 49, 127, 1.6], [1.6, 57, 127, 1.6]] },
  glockenspiel: { program: 9, len: 2.8, events: seq("G5 C6 E6 G6 C7 G6 E6 C6", .16, .4, 0, 100, 1.2) },
  bell: { program: 14, len: 3.4, events: [[0, 72, 110, 1.5], [.7, 67, 105, 1.5], [1.4, 72, 110, 2]] },
  triangle: { kit: STANDARD, len: 2.8, events: [[0, 81, 115, 1], [.5, 81, 105, 1], [1.0, 81, 120, 1.8]] },
  // Bach, Toccata and Fugue in D minor, opening (in octaves)
  "pipe-organ": { program: 19, len: 3.6, events: [
    ...seq("A4 G4 A4", .12, .12, 0, 110, .9), ...seq("A3 G3 A3", .12, .12, 0, 110, .9),
    ...seq("G4 F4 E4 D4 C#4 D4", .12, .12, 1.2, 110, 1.3), ...seq("G3 F3 E3 D3 C#3 D3", .12, .12, 1.2, 110, 1.3)] },
  drum: { kit: STANDARD, len: 2.6, events: [
    ...Array.from({ length: 16 }, (_, i) => [i * .07, 38, 50 + i * 4, .06]), [1.2, 38, 120, .2], [1.5, 38, 110, .2], [1.65, 38, 110, .2], [1.9, 38, 127, .3]] },
  "bass-drum": { kit: ORCHESTRA, len: 3.0, events: [[0, 36, 100, .8], [.6, 36, 100, .8], [1.2, 36, 110, .3], [1.4, 36, 127, 1.4]] },
  // ---- jazz
  "drum-kit": { kit: STANDARD, len: 2.8, events: [
    ...at(42, [0, .15, .3, .45, .6, .75, .9, 1.05], 85, .1), ...at(36, [0, .6, .75], 120, .2), ...at(38, [.3, .9], 115, .2),
    ...[50, 48, 45, 43].map((n, i) => [1.2 + i * .1, n, 120, .2]), [1.65, 36, 127, 1], [1.65, 49, 120, 1.2]] },
  harmonica: { program: 22, len: 3.0, events: [
    ...[0, .25, .5, .75].flatMap((t, i) => chord(i % 2 ? "D4 F4 A4" : "C4 E4 G4", t, .2, 100, 0)), ...seq("G4 A#4 C5", .22, .22, 1.05, 110, 1.3)] },
  // ---- rock & pop
  "electric-guitar": { program: 29, len: 3.0, events: [
    ...[0, .12, .24, .36].flatMap(t => chord("E2 B2 E3", t, .1, 115, 0)), ...chord("G2 D3 G3", .5, .22, 120, 0), ...chord("A2 E3 A3", .75, .22, 120, 0),
    ...[1.05, 1.17, 1.29, 1.41].flatMap(t => chord("E2 B2 E3", t, .1, 115, 0)), ...chord("D2 A2 D3", 1.55, .22, 120, 0), ...chord("E2 B2 E3", 1.8, 1.1, 127, 0)] },
  synthesizer: { program: 81, len: 2.8, events: seq("C4 E4 G4 C5 G4 E4 C4 E4 G4 C5", .13, .12, 0, 100, 1.0) },
  // ---- world & folk
  accordion: { program: 21, len: 3.0, events: [...chord("C4 E4 G4", 0, .7, 100, 0), ...chord("F4 A4 C5", .8, .7, 100, 0), ...chord("C4 E4 G4", 1.6, 1.1, 105, 0)] },
  banjo: { program: 105, len: 2.8, events: [...seq("G4 B4 D5 G5 D5 B4 G4 B4 D5 G5", .13, .5), ...chord("G4 D5 G5", 1.4, 1.2, 110, 0)] },
  // Amazing Grace, with the drones
  bagpipes: { program: 109, len: 3.4, events: [
    [0, m("E4"), 110, .3], [.3, m("A4"), 110, .6], [.9, m("C#5"), 110, .15], [1.05, m("A4"), 110, .15], [1.2, m("C#5"), 110, .6],
    [1.8, m("B4"), 110, .3], [2.1, m("A4"), 110, 1.2], [0, m("A3"), 90, 3.3], [0, m("A2"), 90, 3.3]] },
  sitar: { program: 104, len: 3.0, events: [...seq("C4 C#4 E4 F4 G4 G#4 B4 C5", .14, .3, 0, 105, 1.4), [0, m("C3"), 80, 2.8]] },
  // Sakura Sakura
  koto: { program: 107, len: 3.2, events: seq("A4 A4 B4 A4 A4 B4", .45, .9, 0, 110, 1.2).map((e, i) => [[0, .45, .9, 1.6, 2.05, 2.5][i], ...e.slice(1)]) },
  shamisen: { program: 106, len: 2.8, events: seq("D4 E4 A4 B4 A4 E4 D4 A3", .2, .3, 0, 115, 1.0) },
  kalimba: { program: 108, len: 2.8, events: seq("E5 C5 G4 C5 E5 G5 E5 C5", .2, .6, 0, 105, 1.2) },
  "steel-drum": { program: 114, len: 2.8, events: [[0, m("C5"), 110, .3], [.2, m("E5"), 110, .3], [.4, m("G5"), 115, .5], [.8, m("E5"), 110, .3], [1.0, m("G5"), 110, .3], [1.2, m("A5"), 115, .5], [1.6, m("G5"), 110, .3], [1.8, m("E5"), 110, .3], [2.0, m("C5"), 115, .8]] },
  "pan-flute": { program: 75, len: 3.2, events: seq("G4 A4 C5 A4 G4 E4", .35, .4, 0, 105, 1.2) },
  ocarina: { program: 79, len: 3.0, events: seq("C5 E5 G5 F5 E5 C5", .32, .35, 0, 105, 1.0) },
  // Mary Had a Little Lamb
  recorder: { program: 74, len: 3.0, events: seq("E5 D5 C5 D5 E5 E5 E5", .3, .28, 0, 100, .8) },
  ukulele: { program: 24, len: 3.0, events: [
    ...[0, .4, .55, .8, .95, 1.1].flatMap((t, i) => chord(i % 2 ? "A4 E4 C4 G4" : "G4 C4 E4 A4", t, .5, i % 2 ? 85 : 110, .015)),
    ...chord("A4 C4 F4 A4", 1.4, .5, 110, .015), ...chord("G4 C4 E4 C5", 1.8, 1.1, 115, .015)] },
  djembe: { kit: STANDARD, len: 2.4, events: [[0, 64, 120, .3], [.25, 63, 105, .2], [.375, 63, 100, .2], [.5, 62, 115, .2], [.75, 64, 120, .3], [1.0, 63, 105, .2], [1.125, 62, 110, .2], [1.25, 62, 115, .2], [1.5, 64, 127, .3], [1.75, 63, 110, .2], [2.0, 64, 127, .3]] },
  bongos: { kit: STANDARD, len: 2.2, events: [[0, 60, 115, .2], [.15, 60, 95, .2], [.3, 61, 115, .2], [.5, 60, 115, .2], [.65, 60, 95, .2], [.8, 61, 115, .2], [1.0, 60, 110, .2], [1.15, 61, 110, .2], [1.3, 61, 115, .2], [1.5, 60, 120, .2], [1.65, 60, 100, .2], [1.8, 61, 127, .3]] },
  taiko: { program: 116, len: 3.0, events: [[0, 43, 127, .8], [.5, 43, 110, .6], [.75, 43, 110, .6], [1.25, 48, 120, .5], [1.4, 48, 105, .5], [1.55, 48, 110, .5], [1.75, 43, 127, 1.2]] },
  maracas: { kit: STANDARD, len: 2.2, events: at(70, [0, .25, .5, .62, .75, 1.0, 1.25, 1.37, 1.5], i => i % 2 ? 90 : 120, .1) },
  tambourine: { kit: STANDARD, len: 2.2, events: at(54, [0, .25, .5, .75, 1.0, 1.12, 1.25, 1.5], i => i % 2 ? 95 : 125, .2) },
  castanets: { kit: STANDARD, len: 2.2, events: at(85, [0, .08, .16, .24, .5, .75, .83, .91, .99, 1.25, 1.5], i => 100 + (i % 3) * 10, .1) },
  cowbell: { kit: STANDARD, len: 2.2, events: at(56, [0, .25, .5, .62, .75, 1.0, 1.25, 1.5], i => i % 2 ? 95 : 120, .2) },
  claves: { kit: STANDARD, len: 2.2, events: at(75, [0, .45, .9, 1.5, 1.8], 120, .2) },
  guiro: { kit: STANDARD, len: 2.2, events: [[0, 74, 115, .4], [.45, 73, 110, .1], [.6, 73, 110, .1], [.75, 74, 120, .4], [1.2, 73, 110, .1], [1.35, 73, 110, .1], [1.5, 74, 125, .5]] },
  woodblock: { kit: STANDARD, len: 2.4, events: [[0, 76, 115, .2], [.3, 77, 115, .2], [.6, 76, 115, .2], [.9, 77, 115, .2], [1.2, 76, 115, .2], [1.35, 76, 110, .2], [1.5, 76, 115, .2], [1.8, 77, 125, .3]] },
  whistle: { kit: STANDARD, len: 2.4, events: [[0, 71, 115, .2], [.35, 71, 115, .2], [.7, 72, 127, 1.0]] },
  // Twinkle Twinkle Little Star
  "music-box": { program: 10, len: 3.2, events: seq("C5 C5 G5 G5 A5 A5 G5", .32, .6, 0, 105, 1.2) },
  "jingle-bells": { kit: STANDARD, len: 2.2, events: at(83, [0, .25, .5, .62, .75, 1.0, 1.25, 1.37, 1.5], i => i % 2 ? 95 : 125, .2) },
};

const [sf2, outDir] = process.argv.slice(2);
const bank = SoundBankLoader.fromArrayBuffer(fs.readFileSync(sf2).buffer);
fs.mkdirSync(outDir, { recursive: true });
const RATE = 44100, BLOCK = 128, DRUMS = 9;

for (const [id, tune] of Object.entries(TUNES)) {
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
  fs.writeFileSync(path.join(outDir, id + ".wav"), Buffer.from(audioToWav([L, R], RATE)));
}
console.log(Object.keys(TUNES).length, "tunes rendered");
