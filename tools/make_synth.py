#!/usr/bin/env python3
"""Synthesize the instruments no sample library covers: gong, theremin, didgeridoo, slide whistle, rainstick and
wind chimes. Writes <build dir>/rendered/<id>.wav (the tune) and <id>.note.wav (the play-mode sound), which
tools/make_sounds.py then turns into app/sounds.js.

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

def glide(points, sec):
    """A pitch curve through (time, frequency) points, smooth in log frequency."""
    t = t_of(sec)
    times, freqs = zip(*points)
    return np.exp(np.interp(t, times, np.log(freqs)))

def tone(freq, harmonics=(1.0,)):
    """A tone following a frequency curve, with the given harmonic amplitudes."""
    phase = 2 * np.pi * np.cumsum(freq) / RATE
    return sum(a * np.sin((k + 1) * phase) for k, a in enumerate(harmonics))

def gong(sec=4.0, f0=68.0):
    # inharmonic partials; the higher ones swell after the strike (the gong's "bloom")
    t = t_of(sec)
    ratios = [1, 1.52, 2.03, 2.71, 3.17, 3.9, 4.6, 5.3, 6.1, 7.4, 8.8]
    x = np.zeros_like(t)
    for k, r in enumerate(ratios):
        swell = 1 - np.exp(-t / (0.05 + 0.08 * k))
        x += (1 / (1 + 0.35 * k)) * swell * np.exp(-t / (4.5 - 0.3 * k)) * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6))
    hit = rng.normal(0, 1, len(t)) * np.exp(-t / 0.03) * 0.4
    return fade(x + hit, 0.6)

def theremin(points, sec):
    f = glide(points, sec)
    t = t_of(sec)
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t))  # vibrato
    x = tone(f, (1.0, 0.12, 0.05))
    swell = np.minimum(1, t / 0.15)
    return fade(x * swell, 0.3)

def didgeridoo(sec=3.0, f0=73.4):
    # a buzzing drone whose formant moves like the player's mouth (wow-wow), with a rhythmic accent
    t = t_of(sec)
    f = f0 * (1 + 0.004 * np.sin(2 * np.pi * 0.7 * t))
    phase = 2 * np.pi * np.cumsum(f) / RATE
    centre = 450 + 350 * np.sin(2 * np.pi * 1.6 * t) ** 2
    x = np.zeros_like(t)
    for k in range(1, 40):
        amp = np.exp(-((k * f0 - centre) / 260) ** 2) + 0.25 / k
        x += amp * np.sin(k * phase)
    accent = 1 + 0.6 * np.exp(-((t % 0.75) / 0.08))
    return fade(x * accent * np.minimum(1, t / 0.08), 0.4)

def slide_whistle(points, sec):
    f = glide(points, sec)
    x = tone(f, (1.0, 0.05)) + 0.04 * rng.normal(0, 1, len(f))  # a little breath
    return fade(x * np.minimum(1, t_of(sec) / 0.03), 0.15)

def rainstick(sec=3.2):
    # many tiny pebble clicks, thick at first and thinning out, bright and short
    t = t_of(sec)
    x = np.zeros_like(t)
    density = 900 * np.exp(-t / 1.1) + 40
    for i in np.nonzero(rng.random(len(t)) < density / RATE)[0]:
        n = int(RATE * 0.004)
        click = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (RATE * 0.0008))
        end = min(len(x), i + n)
        x[i:end] += click[:end - i] * rng.uniform(0.2, 1.0)
    # brighten: a simple high-pass (difference) keeps the clicks crisp
    x = np.diff(x, prepend=0)
    return fade(x + 0.02 * rng.normal(0, 1, len(t)) * np.exp(-t / 1.5), 0.5)

def chimes(strikes, sec):
    # metal tubes: a few inharmonic partials each, ringing long
    t = t_of(sec)
    x = np.zeros_like(t)
    for at, f in strikes:
        tt = np.clip(t - at, 0, None)
        on = t >= at
        for r, a, d in [(1, 1.0, 2.2), (2.76, 0.5, 1.2), (5.4, 0.25, 0.6)]:
            x += on * a * np.exp(-tt / d) * np.sin(2 * np.pi * f * r * tt)
    return fade(x, 0.5)

def main(build):
    out = os.path.join(build, "rendered")
    os.makedirs(out, exist_ok=True)
    C = lambda name: 440 * 2 ** ((["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].index(name[:-1]) + 12 * (int(name[-1]) + 1) - 69) / 12)
    sounds = {
        "gong": (gong(4.0), gong(2.5)),
        # an eerie melody gliding from note to note, and a held C5 the play-mode keys pitch up and down
        "theremin": (theremin([(0, C("C5")), (.5, C("C5")), (.8, C("G5")), (1.3, C("G5")), (1.6, C("F5")), (1.9, C("E5")),
                               (2.2, C("D5")), (2.6, C("C5")), (3.2, C("C5"))], 3.2),
                     theremin([(0, C("C5")), (1.6, C("C5"))], 1.6)),
        "didgeridoo": (didgeridoo(3.0), didgeridoo(1.6)),
        "slide-whistle": (slide_whistle([(0, 500), (.5, 1500), (.8, 1500), (1.2, 700), (1.7, 1900), (2.2, 1900)], 2.3),
                          slide_whistle([(0, 600), (.6, 1600), (1.0, 1600)], 1.1)),
        "rainstick": (rainstick(3.2), rainstick(1.6)),
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
