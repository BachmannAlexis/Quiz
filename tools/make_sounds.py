#!/usr/bin/env python3
"""Build sounds.js: a short tune for every instrument, as embedded MP3 data URIs.

Usage: python3 tools/make_sounds.py <tonejs samples dir> <rendered wav dir> <sonic pi samples dir>
- tonejs packages are expected at <samples>/<package>/package/<Note>.mp3 (npm pack + tar xzf).
- the wav dir holds the tunes rendered by tools/render_gm.mjs (<id>.wav).
- the sonic pi dir holds supersonic-scsynth-samples' samples/ folder (tabla).
See README for the full rebuild recipe. Requires ffmpeg. Writes sounds.js next to index.html.
"""
import base64, json, os, re, subprocess, sys, tempfile

def S(notes, step, length, start=0.0, last=None):
    """Notes played one after another; the last one rings for `last` seconds."""
    out = [(n, start + i * step, length) for i, n in enumerate(notes)]
    if last: out[-1] = (out[-1][0], out[-1][1], last)
    return out

def chord(notes, at, length, spread=0.03):
    return [(n, at + i * spread, length) for i, n in enumerate(notes)]

# quiz id -> (tonejs package, [(note, start_s, length_s), ...]). Notes missing from a
# package are pitch-shifted from the nearest recorded one.
TUNES = {
    "piano":       ("piano",           S(["C4", "E4", "G4", "C5"], .4, .5, last=1.6)),
    "violin":      ("violin",          S(["G4", "C5", "E5", "G5"], .55, .6, last=1.4)),
    # Bach, Cello Suite No. 1, opening
    "cello":       ("cello",           S(["G2", "D3", "B3", "A3", "B3", "D3", "B3", "D3", "G2", "E3", "C4", "B3", "C4", "E3", "C4", "E3"], .18, .3, last=.6)),
    # walking jazz bass
    "double-bass": ("contrabass",      S(["C2", "E2", "G2", "A2", "As2", "A2", "G2", "E2", "C2"], .3, .32, last=.8)),
    "harp":        ("harp",            S(["C3", "E3", "G3", "B3", "D4", "F4", "A4", "C5", "E5", "G5"], .1, 2.0)),
    "flute":       ("flute",           S(["A5", "C6", "A5", "C6", "E5"], .3, .3, last=1.4)),
    "clarinet":    ("clarinet",        S(["F4", "G4", "Gs4", "A4", "C5", "D5", "F5"], .2, .22, last=1.2)),
    "bassoon":     ("bassoon",         S(["C3", "G2", "C3", "E3", "G3", "E3", "C3"], .25, .2, last=.9)),
    "horn":        ("french-horn",     S(["F3", "C4", "F3", "C4"], .5, .5, last=1.5)),
    "trumpet":     ("trumpet",         S(["G4", "G4", "G4", "D5"], .25, .22, last=1.6)),
    "trombone":    ("trombone",        S(["C3", "F3", "C4"], .6, .6, last=1.5)),
    # oom-pah
    "tuba":        ("tuba",            S(["As1", "F2", "As1", "F2", "As1", "F2", "As1"], .3, .25, last=1.0)),
    "xylophone":   ("xylophone",       S(["C5", "G5", "C6", "G5", "C6"], .3, .5, last=1.2)),
    "saxophone":   ("saxophone",       S(["C4", "Ds4", "F4", "Fs4", "G4"], .3, .3, last=1.4)),
    "guitar":      ("guitar-acoustic", chord(["C3", "E3", "G3", "C4", "E4"], 0, 1.4, .06) + chord(["C3", "E3", "G3", "C4", "E4"], 1.3, 1.8, .06)),
    "bass-guitar": ("bass-electric",   S(["E1", "E1", "G1", "A1", "E1", "E1", "D2", "E2"], .22, .2, last=.8)),
}

# tabla from Sonic Pi's samples: (sample, start_s)
TABLA = [("tabla_ghe1", 0), ("tabla_na", .25), ("tabla_tun1", .5), ("tabla_ghe2", .75), ("tabla_na", .9),
         ("tabla_na", 1.05), ("tabla_dhec", 1.25), ("tabla_te1", 1.5), ("tabla_te2", 1.62), ("tabla_na", 1.75),
         ("tabla_ghe1", 2.0), ("tabla_dhec", 2.0)]

NAMES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"]

def midi(note):
    m = re.fullmatch(r"([A-G]s?)(\d)", note)
    return NAMES.index(m.group(1)) + 12 * (int(m.group(2)) + 1)

def nearest(src_dir, note):
    have = {f[:-4]: midi(f[:-4]) for f in os.listdir(src_dir) if re.fullmatch(r"[A-G]s?\d\.mp3", f)}
    best = min(have, key=lambda n: abs(have[n] - midi(note)))
    return best, midi(note) - have[best]

def mix(inputs, parts, out):
    """inputs: files; parts: per-input filter chain ending before the delay; then mix + normalize."""
    filters = [f"[{k}:a]{p}[n{k}]" for k, p in enumerate(parts)]
    filters.append("".join(f"[n{k}]" for k in range(len(parts)))
                   + f"amix=inputs={len(parts)}:normalize=0,loudnorm=I=-16:TP=-1.5,aresample=44100[out]")
    args = []
    for f in inputs: args += ["-i", f]
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", ";".join(filters),
                    "-map", "[out]", "-ac", "1", "-b:a", "64k", out], check=True)

def build(src_dir, notes, out):
    src_dir = os.path.join(src_dir, "package")
    inputs, parts = [], []
    for note, start, length in notes:
        sample, shift = nearest(src_dir, note)
        inputs.append(os.path.join(src_dir, sample + ".mp3"))
        pitch = f"asetrate=44100*{2 ** (shift / 12):.6f},aresample=44100," if shift else ""
        fade = min(.25, length / 2)
        parts.append(f"aresample=44100,{pitch}atrim=0:{length},asetpts=PTS-STARTPTS,"
                     f"afade=t=out:st={length - fade}:d={fade},adelay={int(start * 1000)}:all=1")
    mix(inputs, parts, out)

def build_tabla(sp_dir, out):
    mix([os.path.join(sp_dir, s + ".flac") for s, _ in TABLA],
        [f"aresample=44100,atrim=0:1.2,asetpts=PTS-STARTPTS,adelay={int(t * 1000)}:all=1" for _, t in TABLA], out)

def encode(wav, out):
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5,aresample=44100",
                    "-ac", "1", "-b:a", "64k", out], check=True)

def main(samples, rendered, sonicpi):
    files = {}
    with tempfile.TemporaryDirectory() as tmp:
        for quiz_id, (pkg, notes) in TUNES.items():
            files[quiz_id] = os.path.join(tmp, quiz_id + ".mp3")
            build(os.path.join(samples, pkg), notes, files[quiz_id])
        for wav in sorted(os.listdir(rendered)):
            if wav.endswith(".wav"):
                files[wav[:-4]] = os.path.join(tmp, wav[:-4] + ".mp3")
                encode(os.path.join(rendered, wav), files[wav[:-4]])
        files["tabla"] = os.path.join(tmp, "tabla.mp3")
        build_tabla(sonicpi, files["tabla"])
        data = {k: "data:audio/mpeg;base64," + base64.b64encode(open(f, "rb").read()).decode()
                for k, f in sorted(files.items())}
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root, "sounds.js"), "w") as f:
        f.write("// Generated by tools/make_sounds.py — real instrument recordings, see README for credits.\n")
        f.write("window.INSTRUMENT_SOUNDS = " + json.dumps(data, indent=1) + ";\n")

if __name__ == "__main__":
    main(*sys.argv[1:4])
