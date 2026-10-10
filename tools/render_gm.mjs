// Render short tunes for instruments that tonejs-instruments lacks, using the
// GeneralUser GS General MIDI sound bank (npm: generaluser) and spessasynth_core.
// Usage: node tools/render_gm.mjs <GeneralUser.sf2> <out dir>
// (spessasynth_core must be resolvable, e.g. run from a folder where it is installed.)
import fs from "node:fs";
import path from "node:path";
import { SpessaSynthProcessor, SoundBankLoader, audioToWav } from "spessasynth_core";

const DRUMS = 9; // MIDI channel 10
// id -> { program (melodic) or drums, events: [time_s, note, velocity, length_s], length_s }
const TUNES = {
  guitar: { program: 27, len: 3.2, events: [
    ...[40, 47, 52, 56, 59, 64].map((n, i) => [i * .03, n, 105, 1.3]),
    ...[40, 47, 52, 56, 59, 64].map((n, i) => [.7 + i * .03, n, 95, .5]),
    ...[45, 52, 57, 61, 64].map((n, i) => [1.3 + i * .03, n, 110, 1.8])] },
  accordion: { program: 21, len: 3.0, events: [
    ...[60, 64, 67].map(n => [0, n, 100, .7]), ...[65, 69, 72].map(n => [.8, n, 100, .7]),
    ...[60, 64, 67].map(n => [1.6, n, 105, 1.1])] },
  banjo: { program: 105, len: 2.8, events:
    [67, 71, 74, 79, 74, 71, 67, 71, 74, 79].map((n, i) => [i * .13, n, 105, .5]).concat([[1.4, 67, 110, 1.2], [1.4, 74, 105, 1.2], [1.4, 79, 105, 1.2]]) },
  bell: { program: 14, len: 3.4, events: [[0, 72, 110, 1.5], [.7, 67, 105, 1.5], [1.4, 72, 110, 2]] },
  drum: { drums: true, len: 2.6, events: [
    [0, 36, 120, .2], [0, 38, 0, .2], [.3, 38, 115, .2], [.6, 36, 120, .2], [.9, 38, 115, .2],
    ...Array.from({ length: 8 }, (_, i) => [1.2 + i * .07, 38, 70 + i * 6, .1]), [1.8, 36, 127, .4], [1.8, 49, 100, .8]] },
  maracas: { drums: true, len: 2.2, events: [0, .25, .5, .62, .75, 1.0, 1.25, 1.37, 1.5].map((t, i) => [t, 70, i % 2 ? 90 : 120, .1]) },
  tambourine: { drums: true, len: 2.2, events: [0, .25, .5, .75, 1.0, 1.12, 1.25, 1.5].map((t, i) => [t, 54, i % 2 ? 95 : 125, .2]) },
  triangle: { drums: true, len: 2.8, events: [[0, 81, 115, 1], [.5, 81, 105, 1], [1.0, 81, 120, 1.8]] },
};

const [sf2, outDir] = process.argv.slice(2);
const bank = SoundBankLoader.fromArrayBuffer(fs.readFileSync(sf2).buffer);
fs.mkdirSync(outDir, { recursive: true });
const RATE = 44100, BLOCK = 128;

for (const [id, tune] of Object.entries(TUNES)) {
  const synth = new SpessaSynthProcessor(RATE, { enableEventSystem: false });
  synth.soundBankManager.addSoundBank(bank, "gu");
  await synth.processorInitialized;
  const ch = tune.drums ? DRUMS : 0;
  if (!tune.drums) synth.programChange(0, tune.program);
  synth.controllerChange(ch, 91, 30); // a little reverb
  const queue = [];
  for (const [t, n, v, l] of tune.events) {
    if (v > 0) { queue.push([t, () => synth.noteOn(ch, n, v)]); queue.push([t + l, () => synth.noteOff(ch, n)]); }
  }
  queue.sort((a, b) => a[0] - b[0]);
  const total = Math.ceil(tune.len * RATE / BLOCK) * BLOCK;
  const L = new Float32Array(total), R = new Float32Array(total);
  for (let i = 0; i < total; i += BLOCK) {
    while (queue.length && queue[0][0] * RATE <= i) queue.shift()[1]();
    synth.process(L, R, i, BLOCK);
  }
  fs.writeFileSync(path.join(outDir, id + ".wav"), Buffer.from(audioToWav([L, R], RATE)));
  console.log(id, "ok");
}
