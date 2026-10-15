#!/usr/bin/env python3
"""Build the sound packs app/sounds/<topic>.js: for every instrument a short tune, plus single notes for the play
mode, and the animal, kitchen, transport, weather and landscape recordings.

Usage: python3 tools/make_sounds.py <build dir>

The build dir holds the sample libraries (see README for how to fetch them):
  tonejs/<package>/package/<Note>.mp3   tonejs-instrument-*-mp3 packages
  vsco/<folder>/<file>.mp3              tiny-orchestra samples (VSCO 2 Community Edition)
  musyngkite/<folder>/<Note>.mp3        web-music-score-samples (MusyngKite sound bank)
  salamander/<Note>v10.mp3              @audio-samples/piano-mp3-velocity10 (Salamander Grand Piano)
  sonicpi/<name>.flac                   supersonic-scsynth-samples
  commons/credits.json, commons/raw/*   animal recordings, BigSoundBank and Wikimedia Commons (tools/fetch_animals.py)
  rendered/<id>.wav, <id>.note.wav      GeneralUser GS renders from tools/render_gm.mjs
                                        (instruments, and landscape sounds without notes),
                                        and synthesized instruments from tools/make_synth.py
Requires ffmpeg and numpy. Writes app/sounds/<topic>.js, and SOUND-CREDITS.md for the animal recordings.
"""
import base64, json, os, re, subprocess, sys, tempfile
import numpy as np

def S(notes, step, length, start=0.0, last=None):
    """Notes played one after another; the last one rings for `last` seconds."""
    notes = notes.split()
    out = [(n, start + i * step, length) for i, n in enumerate(notes)]
    if last: out[-1] = (out[-1][0], out[-1][1], last)
    return out

def chord(notes, at, length, spread=0.03):
    return [(n, at + i * spread, length) for i, n in enumerate(notes.split())]

def at(notes_times, length):
    return [(n, t, length) for n, t in notes_times]

# Pitched instruments: id -> (library, folder, tune, root note for the play mode).
# Notes a library lacks are pitch-shifted from the nearest recorded one.
PITCHED = {
    # Salamander Grand Piano
    "piano":           ("salamander", "", S("C4 E4 G4", .4, .5) + chord("C3 C4 E4 G4 C5", 1.2, 1.8, .02), "C4"),
    # tonejs-instruments
    "violin":          ("tonejs", "violin", S("G4 C5 E5 G5", .55, .6, last=1.4), "C5"),
    # Bach, Cello Suite No. 1, opening
    "cello":           ("tonejs", "cello", S("G2 D3 B3 A3 B3 D3 B3 D3 G2 E3 C4 B3 C4 E3 C4 E3", .18, .3, last=.6), "C3"),
    "guitar":          ("tonejs", "guitar-acoustic", chord("C3 E3 G3 C4 E4", 0, 1.4, .06) + chord("C3 E3 G3 C4 E4", 1.3, 1.8, .06), "C4"),
    "bass-guitar":     ("tonejs", "bass-electric", S("E1 E1 G1 A1 E1 E1 D2 E2", .22, .2, last=.8), "C2"),
    "saxophone":       ("tonejs", "saxophone", S("C4 D#4 F4 F#4 G4", .3, .3, last=1.4), "C4"),
    "xylophone":       ("tonejs", "xylophone", S("C5 G5 C6 G5 C6", .3, .5, last=1.2), "C5"),
    # VSCO 2 Community Edition
    "double-bass":     ("vsco", "basses", S("C2 E2 G2 A2 A#2 A2 G2 E2 C2", .3, .32, last=.8), "C2"),
    "harp":            ("vsco", "harp", S("C3 E3 G3 B3 D4 F4 A4 C5 E5 G5", .1, 2.0), "C4"),
    "flute":           ("vsco", "flute", S("A5 C6 A5 C6 E5", .3, .3, last=1.4), "C5"),
    "oboe":            ("vsco", "oboe", S("G4 B4 D5 C5 B4 A4 G4", .32, .34, last=1.0), "D5"),
    "clarinet":        ("vsco", "clarinet", S("F4 G4 G#4 A4 C5 D5 F5", .2, .22, last=1.2), "D4"),
    "bassoon":         ("vsco", "bassoon", S("C3 G2 C3 E3 G3 E3 C3", .25, .2, last=.9), "C3"),
    "horn":            ("vsco", "horn", S("F3 C4 F3 C4", .5, .5, last=1.5), "C4"),
    "trumpet":         ("vsco", "trumpet", S("G4 G4 G4 D5", .25, .22, last=1.6), "C4"),
    "trombone":        ("vsco", "trombone", S("C3 F3 C4", .6, .6, last=1.5), "F3"),
    # oom-pah
    "tuba":            ("vsco", "tuba", S("A#1 F2 A#1 F2 A#1 F2 A#1", .3, .25, last=1.0), "A#2"),
    "glockenspiel":    ("vsco", "glockenspiel", S("G5 C6 E6 G6 C7 G6 E6 C6", .16, .4, last=1.2), "C6"),
    # MusyngKite
    "bell":            ("musyngkite", "014-tubular-bells", at([("C5", 0), ("G4", .7)], 1.5) + at([("C5", 1.4)], 2.0), "C5"),
    "music-box":       ("musyngkite", "010-music-box", S("C5 C5 G5 G5 A5 A5 G5", .32, .6, last=1.2), "C5"),  # Twinkle Twinkle
    # Bach, Toccata and Fugue in D minor, opening, in octaves
    "pipe-organ":      ("musyngkite", "019-church-organ", S("A4 G4 A4", .12, .12, last=.9) + S("A3 G3 A3", .12, .12, last=.9)
                        + S("G4 F4 E4 D4 C#4 D4", .12, .12, 1.2, last=1.3) + S("G3 F3 E3 D3 C#3 D3", .12, .12, 1.2, last=1.3), "C4"),
    "accordion":       ("musyngkite", "021-accordion", chord("C4 E4 G4", 0, .7, 0) + chord("F4 A4 C5", .8, .7, 0) + chord("C4 E4 G4", 1.6, 1.1, 0), "C4"),
    "harmonica":       ("musyngkite", "022-harmonica", chord("C4 E4 G4", 0, .2, 0) + chord("D4 F4 A4", .25, .2, 0) + chord("C4 E4 G4", .5, .2, 0)
                        + chord("D4 F4 A4", .75, .2, 0) + S("G4 A#4 C5", .22, .22, 1.05, last=1.3), "C4"),
    "ukulele":         ("musyngkite", "024-acoustic-guitar-nylon",
                        [n for i, t in enumerate([0, .4, .55, .8, .95, 1.1]) for n in chord("G4 C4 E4 A4" if i % 2 == 0 else "A4 E4 C4 G4", t, .5, .015)]
                        + chord("A4 C4 F4 A4", 1.4, .5, .015) + chord("G4 C4 E4 C5", 1.8, 1.1, .015), "C4"),
    "electric-guitar": ("musyngkite", "029-overdriven-guitar",
                        [n for t in [0, .12, .24, .36] for n in chord("E2 B2 E3", t, .1, 0)] + chord("G2 D3 G3", .5, .22, 0) + chord("A2 E3 A3", .75, .22, 0)
                        + [n for t in [1.05, 1.17, 1.29, 1.41] for n in chord("E2 B2 E3", t, .1, 0)] + chord("D2 A2 D3", 1.55, .22, 0) + chord("E2 B2 E3", 1.8, 1.1, 0), "C3"),
    "recorder":        ("musyngkite", "074-recorder", S("E5 D5 C5 D5 E5 E5 E5", .3, .28, last=.8), "C5"),  # Mary Had a Little Lamb
    "pan-flute":       ("musyngkite", "075-pan-flute", S("G4 A4 C5 A4 G4 E4", .35, .4, last=1.2), "C5"),
    "ocarina":         ("musyngkite", "079-ocarina", S("C5 E5 G5 F5 E5 C5", .32, .35, last=1.0), "C5"),
    "synthesizer":     ("musyngkite", "081-lead-2-sawtooth", S("C4 E4 G4 C5 G4 E4 C4 E4 G4 C5", .13, .12, last=1.0), "C4"),
    "sitar":           ("musyngkite", "104-sitar", S("C4 C#4 E4 F4 G4 G#4 B4 C5", .14, .3, last=1.4) + [("C3", 0, 2.8)], "C4"),
    "banjo":           ("musyngkite", "105-banjo", S("G4 B4 D5 G5 D5 B4 G4 B4 D5 G5", .13, .5) + chord("G4 D5 G5", 1.4, 1.2, 0), "C4"),
    "shamisen":        ("musyngkite", "106-shamisen", S("D4 E4 A4 B4 A4 E4 D4 A3", .2, .3, last=1.0), "C4"),
    # Sakura Sakura
    "koto":            ("musyngkite", "107-koto", at([("A4", 0), ("A4", .45), ("B4", .9), ("A4", 1.6), ("A4", 2.05)], .9) + at([("B4", 2.5)], 1.2), "C4"),
    "kalimba":         ("musyngkite", "108-kalimba", S("E5 C5 G4 C5 E5 G5 E5 C5", .2, .6, last=1.2), "C5"),
    # Amazing Grace, with the drones
    "bagpipes":        ("musyngkite", "109-bagpipe", [("E4", 0, .3), ("A4", .3, .6), ("C#5", .9, .15), ("A4", 1.05, .15), ("C#5", 1.2, .6),
                        ("B4", 1.8, .3), ("A4", 2.1, 1.2), ("A3", 0, 3.1), ("A2", 0, 3.1)], "A4"),
    # the rest of the orchestra
    "viola":           ("vsco", "violas", S("C4 E4 G4 E4 C4", .45, .5, last=1.4), "C4"),
    "piccolo":         ("musyngkite", "072-piccolo", S("G5 C6 E6 G6 E6 G6 C7", .17, .18, last=1.0), "C6"),
    # Dvořák, New World Symphony, Largo
    "english-horn":    ("musyngkite", "069-english-horn", S("E4 G4 G4", .4, .42) + S("E4 D4 C4", .4, .42, 1.2) + S("D4 E4 G4 E4", .3, .32, 2.4, last=.9), "C4"),
    "bass-clarinet":   ("musyngkite", "071-clarinet", S("C3 E3 G3 A#3 A3 G3 E3 C3", .25, .26, last=1.0), "C3"),
    "contrabassoon":   ("vsco", "bassoon", S("C2 G1 C2 E2 G2 E2 C2", .3, .28, last=1.0), "C2"),
    # Tchaikovsky, Dance of the Sugar Plum Fairy
    "celesta":         ("musyngkite", "008-celesta", S("G5 E5 G5 F#5 D#5 E5", .28, .5, last=1.2), "C5"),
    # Petzold, Minuet in G
    "harpsichord":     ("musyngkite", "006-harpsichord", S("D5 G4 A4 B4 C5 D5 G4 G4", .22, .3, last=.8) + [("G3", 0, .6), ("B3", .66, .6), ("C4", 1.1, .6)], "C4"),
    "marimba":         ("vsco", "marimba", S("C5 E5 G5 C6 G5 E5 C5", .18, .5, last=1.0), "C5"),
    "vibraphone":      ("musyngkite", "011-vibraphone", chord("C4 E4 G4 B4 D5", 0, 1.3, .04) + S("E5 G5 B5 A5 G5", .25, .6, 1.2, last=1.4), "C4"),
    # Westminster chimes
    "tubular-bells":   ("musyngkite", "014-tubular-bells", S("E4 C4 D4 G3", .55, 1.0, last=2.0), "C4"),
    # tremolo, as mandolins play long notes
    "mandolin":        ("musyngkite", "025-acoustic-guitar-steel", [(n, t0 + k * .08, .12) for n, t0, c in [("E5", 0, 7), ("G5", .6, 7), ("A5", 1.2, 10)] for k in range(c)] + [("A5", 2.0, 1.0)], "C5"),
    "alphorn":         ("musyngkite", "060-french-horn", S("C3 G3 C4 E4 G4 E4", .55, .6, last=1.8), "C3"),
    "erhu":            ("musyngkite", "110-fiddle", S("E5 G5 A5 C6 A5 G5 E5", .32, .36, last=1.2), "C5"),
    "melodica":        ("musyngkite", "022-harmonica", S("C5 E5 G5 E5 F5 D5 C5", .25, .26, last=1.0), "C5"),
    # a drone and a melody, as in Indian music
    "harmonium":       ("tonejs", "harmonium", [("C3", 0, 2.8), ("G3", 0, 2.8)] + S("C4 D4 E4 G4 E4 D4 C4", .3, .32, last=.9), "C4"),
    "shakuhachi":      ("musyngkite", "077-shakuhachi", S("D5 F5 G5 A5 G5", .45, .5, last=1.6), "C5"),
}

# Percussion and other recordings played as they are: id -> (tune [(file, start, length)], play-mode sounds).
# One play-mode sound is pitched up and down by the keys; several are spread over the keys.
V, P = "vsco/", "sonicpi/"
KIT = [P + "drum_heavy_kick", P + "drum_snare_hard", P + "drum_cymbal_closed", P + "drum_tom_hi_hard",
       P + "drum_tom_mid_hard", P + "drum_tom_lo_hard", P + "drum_cymbal_open", P + "drum_splash_hard"]
TABLA = [P + n for n in ["tabla_ghe1", "tabla_na", "tabla_tun1", "tabla_dhec", "tabla_te1", "tabla_ke1", "tabla_ghe2", "tabla_tas1"]]
HITS = {
    "timpani":   ([(V + "timpaniRoll/C3", 0, 1.4), (V + "timpani/F2", 1.35, 1.0), (V + "timpani/F2", 1.85, 1.6)], [V + "timpani/F2"]),
    "bass-drum": ([(V + "bassdrum/soft1", 0, .7), (V + "bassdrum/soft1", .6, .7), (V + "bassdrum/hit1", 1.2, .3), (V + "bassdrum/hit2", 1.4, 1.6)], [V + "bassdrum/hit1"]),
    "drum":      ([(V + "snareRoll/roll1", 0, 1.2), (V + "snare/hit1", 1.25, .4), (V + "snare/hit2", 1.55, .3), (V + "snare/hit1", 1.7, .3), (V + "snare/hit2", 1.95, .5)], [V + "snare/hit1"]),
    "cymbals":   ([(V + "cymbal/crash1", 0, 1.0), (V + "cymbal/soft1", .9, .8), (V + "cymbal/crash2", 1.6, 1.6)], [V + "cymbal/crash1"]),
    "triangle":  ([(V + "triangle/hit1", 0, .6), (V + "triangle/hit2", .5, .6), (V + "triangle/hit1", 1.0, 1.8)], [V + "triangle/hit1"]),
    "claves":    ([(V + "woodblock/claves1", t, .3) for t in [0, .45, .9, 1.5, 1.8]], [V + "woodblock/claves1"]),
    "woodblock": ([(V + "woodblock/" + f, t, .3) for f, t in [("hit1", 0), ("hit2", .3), ("hit1", .6), ("hit2", .9), ("hit1", 1.2), ("hit1", 1.35), ("hit1", 1.5), ("hit2", 1.8)]], [V + "woodblock/hit1"]),
    "cowbell":   ([(P + "drum_cowbell", t, .3) for t in [0, .25, .5, .62, .75, 1.0, 1.25, 1.5]], [P + "drum_cowbell"]),
    "drum-kit":  ([(KIT[2], t, .15) for t in [0, .15, .3, .45, .6, .75, .9, 1.05]] + [(KIT[0], t, .4) for t in [0, .6, .75]] + [(KIT[1], t, .3) for t in [.3, .9]]
                  + [(KIT[k], 1.2 + i * .1, .3) for i, k in enumerate([3, 4, 5, 5])] + [(KIT[0], 1.65, .8), (KIT[6], 1.65, 1.4)], KIT),
    "cajon":     ([(P + ("drum_bass_hard" if k in (0, 3, 6) else "drum_snare_soft"), t, .4) for k, t in enumerate([0, .3, .5, .75, 1.05, 1.25, 1.5, 1.8, 1.9])],
                  [P + "drum_bass_hard", P + "drum_snare_soft"]),
    "tabla":     ([(TABLA[k], t, 1.0) for k, t in [(0, 0), (1, .25), (2, .5), (6, .75), (1, .9), (1, 1.05), (3, 1.25), (4, 1.5), (4, 1.62), (1, 1.75), (0, 2.0), (3, 2.0)]], TABLA),
}

NOTE_LEN = 1.6  # seconds of each play-mode note
RECORDED_INSTRUMENTS = {"gong", "rainstick", "didgeridoo"}  # instruments from real recordings (tools/fetch_animals.py)
NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}

def midi(note):
    m = re.fullmatch(r"([A-G])(#|s|b)?(-?\d)(v\d+)?", note)  # "C4", "Cs4", "C#4v10"
    if not m: return None
    acc = {"#": 1, "s": 1, "b": -1}.get(m.group(2), 0)
    return NAMES[m.group(1)] + acc + 12 * (int(m.group(3)) + 1)

def nearest(folder, note):
    have = {f[:-4]: midi(f[:-4]) for f in os.listdir(folder) if f.endswith(".mp3") and midi(f[:-4]) is not None}
    best = min(have, key=lambda n: abs(have[n] - midi(note)))
    return os.path.join(folder, best + ".mp3"), midi(note) - have[best]

def ffmpeg(inputs, parts, out, loud=True):
    """Mix inputs; parts[k] is the filter chain for input k (trim, pitch, delay)."""
    filters = [f"[{k}:a]{p}[n{k}]" for k, p in enumerate(parts)]
    # loudnorm in one pass can overshoot, and MP3 encoding adds a little on sharp plucks,
    # so a final limiter keeps peaks 3 dB under full scale
    norm = ",loudnorm=I=-16:TP=-2" if loud else ""
    filters.append("".join(f"[n{k}]" for k in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0{norm},"
                   "aresample=44100,alimiter=limit=0.71:level=false[out]")
    args = [a for f in inputs for a in ("-i", f)]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(filters),
                    "-map", "[out]", "-ac", "1", "-b:a", "128k", out], check=True)  # 128 kbit/s: clean music

def part(start, length, shift=0):
    pitch = f"asetrate=44100*{2 ** (shift / 12):.6f},aresample=44100," if shift else ""
    fade = min(.25, length / 2)
    return (f"aresample=44100,{pitch}atrim=0:{length},asetpts=PTS-STARTPTS,"
            f"afade=t=out:st={length - fade:.3f}:d={fade:.3f},adelay={int(start * 1000)}:all=1")

def find(build, name):
    for ext in (".mp3", ".flac", ".wav"):
        if os.path.exists(os.path.join(build, name + ext)): return os.path.join(build, name + ext)
    raise FileNotFoundError(name)

def folder_of(build, lib, folder):
    return os.path.join(build, lib, folder, "package") if lib == "tonejs" else os.path.join(build, lib, folder)

ANIMAL_LEN = 3.0  # seconds kept from each animal recording

def loudest(src, length):
    """Start time of the loudest `length` seconds of a recording (where the bark or moo is)."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", "8000", "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    win, hop = int(length * 8000), 800
    if len(x) <= win: return 0.0, len(x) / 8000
    c = np.concatenate([[0], np.cumsum(x.astype(np.float64) ** 2)])
    energy = (c[win:] - c[:-win])[::hop]  # the energy of every window, from a running sum (fast on long recordings)
    return float(np.argmax(energy) * hop / 8000), length

def animal(src, out):
    start, length = loudest(src, ANIMAL_LEN)
    fade = min(.4, length / 3)
    chain = (f"aresample=44100,atrim={start:.2f}:{start + length:.2f},asetpts=PTS-STARTPTS,highpass=f=70,"
             f"afade=t=in:d=0.04,afade=t=out:st={length - fade:.2f}:d={fade:.2f}")
    ffmpeg([src], [chain], out)

def write_credits(root, credits):
    lines = ["# Sound credits", "",
             "The animal, kitchen, transport, weather and landscape recordings, and the gong, rainstick and didgeridoo, in the sound packs",
             "(`app/sounds/`) are excerpts (about 3 seconds, levelled) of these real recordings",
             "from [BigSoundBank](https://bigsoundbank.com) and [Wikimedia Commons](https://commons.wikimedia.org).",
             "Thank you to their authors.", "",
             "| Animal | Recording | Author | Licence |", "|---|---|---|---|"]
    for key, c in sorted(credits.items()):
        lic = f"[{c['license']}]({c['license_url']})" if c.get("license_url") else c["license"]
        author = (c.get("artist") or "unknown").replace("|", "/")
        lines.append(f"| {key} | [{c['title']}]({c['page']}) | {author} | {lic} |")
    open(os.path.join(root, "SOUND-CREDITS.md"), "w").write("\n".join(lines) + "\n")

def uri(path):
    return "data:audio/mpeg;base64," + base64.b64encode(open(path, "rb").read()).decode()

def main(build):
    tunes, notes = {}, {}
    with tempfile.TemporaryDirectory() as tmp:
        def out(name):
            return os.path.join(tmp, name + ".mp3")
        def single(src, name, shift=0, length=NOTE_LEN):
            # a play-mode note: same loudness target as the tunes so keys and tunes match
            ffmpeg([src], [part(0, length, shift)], out(name))
            return uri(out(name))
        for iid, (lib, folder, tune, root) in PITCHED.items():
            d = folder_of(build, lib, folder)
            srcs = [nearest(d, n) + (start, length) for n, start, length in tune]
            ffmpeg([s[0] for s in srcs], [part(st, ln, sh) for _, sh, st, ln in srcs], out(iid))
            tunes[iid] = uri(out(iid))
            src, shift = nearest(d, root)
            notes[iid] = {"pitched": True, "samples": [single(src, iid + ".note", shift)]}
        for iid, (tune, sounds) in HITS.items():
            ffmpeg([find(build, f) for f, _, _ in tune], [part(st, ln) for _, st, ln in tune], out(iid))
            tunes[iid] = uri(out(iid))
            notes[iid] = {"pitched": False, "samples": [single(find(build, f), f"{iid}.note{k}", 0, 1.2) for k, f in enumerate(sounds)]}
        # animal recordings (BigSoundBank, Wikimedia Commons)
        commons = os.path.join(build, "commons", "credits.json")
        credits = json.load(open(commons)) if os.path.exists(commons) else {}
        for iid, c in credits.items():
            src = os.path.join(build, "commons", c["file"])
            animal(src, out(iid))
            tunes[iid] = uri(out(iid))
            if iid in RECORDED_INSTRUMENTS:  # a real gong, rainstick or didgeridoo: its play-mode sound from the recording too
                start, _ = loudest(src, NOTE_LEN)
                ffmpeg([src], [f"aresample=44100,atrim={start:.2f}:{start + NOTE_LEN:.2f},asetpts=PTS-STARTPTS,afade=t=in:d=0.02,afade=t=out:st={NOTE_LEN - .3:.2f}:d=0.3"], out(iid + ".note"))
                notes[iid] = {"pitched": False, "samples": [uri(out(iid + ".note"))]}
        rendered = os.path.join(build, "rendered")
        for f in sorted(os.listdir(rendered)):
            m = re.fullmatch(r"(.+?)(\.note)?\.wav", f)
            iid, is_note = m.group(1), m.group(2)
            if iid in PITCHED or iid in HITS or iid in credits: continue  # a better source (a real recording) covers it
            if is_note:
                notes[iid] = {"pitched": iid in ("steel-drum", "theremin"), "samples": [single(os.path.join(rendered, f), iid + ".note", 0, NOTE_LEN)]}
            else:
                ffmpeg([os.path.join(rendered, f)], [part(0, 4)], out(iid))
                tunes[iid] = uri(out(iid))
    # every play-mode note needs its tune (landscape sounds have a tune and no notes)
    missing = set(notes) - set(tunes)
    assert not missing, f"note without tune: {missing}"
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if credits: write_credits(root, credits)
    # one pack per topic with sounds (app/sounds/<topic>.js), loaded when the topic opens
    groups = json.loads(subprocess.run(["node", os.path.join(root, "tools", "topic_ids.mjs")], capture_output=True, check=True, text=True).stdout)
    for k in ("home", "_noto", "_soundcards"): groups.pop(k)
    orphans = set(tunes) - {i for ids in groups.values() for i in ids}
    assert not orphans, f"sounds of no topic: {orphans}"
    out = os.path.join(root, "app", "sounds")
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith(".js"): os.remove(os.path.join(out, f))
    for name, ids in groups.items():
        pack = {"sounds": {i: tunes[i] for i in sorted(ids) if i in tunes}, "notes": {i: notes[i] for i in sorted(ids) if i in notes}}
        if not pack["sounds"]: continue
        with open(os.path.join(out, name + ".js"), "w") as f:
            f.write("// Generated by tools/make_sounds.py — recordings and renders, see README for credits.\n")
            f.write("// sounds: a short tune or recording per item; notes: the play-mode sounds.\n")
            f.write("addSounds(" + json.dumps(pack, indent=0) + ");\n")
    import make_packs; make_packs.main()  # the new versions for app/packs.js
    print(len(tunes), "sounds,", len(notes), "with play-mode notes")

if __name__ == "__main__":
    main(sys.argv[1])
