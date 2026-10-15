#!/usr/bin/env python3
"""Synthesize the instruments that neither the sample libraries nor the free recordings cover: theremin, slide whistle
and wind chimes (the gong, rainstick and didgeridoo are real recordings, see tools/fetch_animals.py). Each gets a
natural room reverb. Writes <build dir>/rendered/<id>.wav (the tune) and <id>.note.wav (the play-mode sound), which
tools/make_sounds.py then turns into the sound packs (app/sounds/).

Usage: python3 tools/make_synth.py <build dir>     (needs numpy)
"""
import os, sys, wave
import numpy as np

RATE = 44100
rng = np.random.default_rng(7)  # fixed seed: the same sounds every run

def t_of(sec):
    return np.arange(int(sec * RATE)) / RATE

def save(path, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def fade(x, out=0.3, inn=0.005):
    n_in, n_out = int(inn * RATE), int(out * RATE)
    x = x.copy()
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[-n_out:] *= np.linspace(1, 0, n_out)
    return x

def smooth(x, n):
    """A gentle low-pass: the mean over n samples."""
    return np.convolve(x, np.ones(n) / n, mode="same")

def reverb(x, sec=1.3, wet=0.28):
    """A small warm room: the sound convolved with decaying, slightly darkened noise (the tail is added after it)."""
    ir = smooth(rng.normal(0, 1, int(sec * RATE)), 6) * np.exp(-6.9 * t_of(sec) / sec)  # -60 dB at the end
    ir[: int(0.012 * RATE)] *= np.linspace(0, 1, int(0.012 * RATE))  # first reflections after 12 ms
    n = len(x) + len(ir) - 1
    tail = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    tail *= np.max(np.abs(x)) / (np.max(np.abs(tail)) + 1e-9)
    dry = np.concatenate([x, np.zeros(len(ir) - 1)])
    return fade((1 - wet) * dry + wet * tail, 0.25)

def glide(points, sec):
    """A pitch curve through (time, frequency) points, smooth in log frequency."""
    t = t_of(sec)
    times, freqs = zip(*points)
    return np.exp(np.interp(t, times, np.log(freqs)))

def tone(freq, harmonics=(1.0,)):
    """A tone following a frequency curve, with the given harmonic amplitudes."""
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    return sum(a * np.sin((k + 1) * phase) for k, a in enumerate(harmonics))

def theremin(points, sec):
    # an almost pure tone gliding between notes, with a vibrato that grows in, as a player's hand does
    f = glide(points, sec)
    t = t_of(sec)
    depth = 0.006 + 0.008 * np.minimum(1, t / 0.6)
    f = f * (1 + depth * np.sin(2 * np.pi * 5.6 * t))
    x = tone(f, (1.0, 0.18, 0.06, 0.02))
    return reverb(fade(x * np.minimum(1, t / 0.12), 0.35), 1.6, 0.32)

def slide_whistle(points, sec):
    # a flute-like tone with a breathy chiff at the start and breath noise that follows the pitch
    f = glide(points, sec)
    t = t_of(sec)
    x = tone(f, (1.0, 0.08, 0.03))
    breath = smooth(rng.normal(0, 1, len(t)), 4) * (0.05 + 0.25 * np.exp(-t / 0.05))
    x = x + breath * (0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(f) / RATE))
    return reverb(fade(x * np.minimum(1, t / 0.02), 0.15), 1.0, 0.22)

def chimes(strikes, sec):
    # metal tubes: the partials of a free bar (1, 2.76, 5.40, 8.93), each strike a little different, with a tap
    t = t_of(sec)
    x = np.zeros_like(t)
    for at, f in strikes:
        tt = np.clip(t - at, 0, None)
        on = t >= at
        loud, detune = rng.uniform(0.6, 1.0), rng.uniform(0.997, 1.003)
        for r, a, d in [(1, 1.0, 2.6), (2.76, 0.45, 1.4), (5.40, 0.22, 0.7), (8.93, 0.1, 0.35)]:
            x += on * loud * a * np.exp(-tt / d) * np.sin(2 * np.pi * f * detune * r * tt)
        tap = int(at * RATE)
        n = int(0.004 * RATE)
        x[tap:tap + n] += rng.normal(0, 0.3, min(n, len(x) - tap)) * loud
    return reverb(fade(x, 0.5), 1.8, 0.3)

def main(build):
    out = os.path.join(build, "rendered")
    os.makedirs(out, exist_ok=True)
    C = lambda name: 440 * 2 ** ((["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].index(name[:-1]) + 12 * (int(name[-1]) + 1) - 69) / 12)
    sounds = {
        # an eerie melody gliding from note to note, and a held C5 the play-mode keys pitch up and down
        "theremin": (theremin([(0, C("C5")), (.5, C("C5")), (.8, C("G5")), (1.3, C("G5")), (1.6, C("F5")), (1.9, C("E5")),
                               (2.2, C("D5")), (2.6, C("C5")), (3.2, C("C5"))], 3.2),
                     theremin([(0, C("C5")), (1.6, C("C5"))], 1.6)),
        "slide-whistle": (slide_whistle([(0, 500), (.5, 1500), (.8, 1500), (1.2, 700), (1.7, 1900), (2.2, 1900)], 2.3),
                          slide_whistle([(0, 600), (.6, 1600), (1.0, 1600)], 1.1)),
        "wind-chimes": (chimes([(t, C(n)) for t, n in [(0, "C6"), (.2, "E6"), (.45, "G6"), (.8, "A6"), (1.0, "D6"), (1.3, "G6"),
                                                         (1.55, "C7"), (1.9, "E6"), (2.2, "A6")]], 3.6),
                        chimes([(0, C("E6")), (.15, C("A6")), (.35, C("C7"))], 1.8)),
    }
    for iid, (tune, note) in sounds.items():
        save(os.path.join(out, iid + ".wav"), tune)
        save(os.path.join(out, iid + ".note.wav"), note)
    print(len(sounds), "synthesized instruments in", out)

if __name__ == "__main__":
    main(sys.argv[1])
