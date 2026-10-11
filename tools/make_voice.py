#!/usr/bin/env python3
"""Record Pikolo's voice: every sentence the app says, in English and French.

Usage: python3 tools/make_voice.py <build dir> [--check] [en|fr]
  node tools/phrases.mjs must be runnable (it lists the sentences).
  <build dir>/voices holds the Piper voices (see README):
    en_US-ljspeech-high.onnx(.json)  US English, LJ Speech dataset, public domain
    fr_FR-siwis-medium.onnx(.json)   French, SIWIS dataset, CC BY 4.0
  A language code records only that language (run one per language in parallel).
  --check transcribes every clip with Whisper (faster-whisper) and lists the ones that
  do not match their sentence, in <build dir>/voice-check[-<lang>].txt.
Needs piper-tts and ffmpeg (and faster-whisper for --check). Writes app/voice/<lang>/<pack>.json:
{sentence: MP3 data URI}. Clips are cached in <build dir>/voice-cache, so reruns only record
new or changed sentences.
"""
import base64, difflib, hashlib, json, os, re, subprocess, sys, unicodedata, wave

VOICES = {"en": "en_US-ljspeech-high", "fr": "fr_FR-siwis-medium"}
LENGTH_SCALE = 1.15  # a little slower than normal, for small children
ENCODING = 2         # bump when encode() changes: clips are encoded again from the cached recordings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def spoken_form(text, lang):
    """What the synthesizer reads, when the written sentence would be mispronounced."""
    if lang == "en":
        text = text.replace("T. rex", "T-Rex")
    return text

def record(voice, text, wav_path):
    from piper import SynthesisConfig
    with wave.open(wav_path, "wb") as w:
        voice.synthesize_wav(text, w, syn_config=SynthesisConfig(length_scale=LENGTH_SCALE))

def encode(wav_path, mp3_path):
    # trim silence at both ends, keep a short tail, level like the other sounds, small mono MP3
    # (keeps 50 ms before the first sound, so soft first consonants like the k of "qui" stay whole)
    chain = ("silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse,"
             "silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05,areverse,"
             "apad=pad_dur=0.12,loudnorm=I=-16:TP=-2,aresample=22050,alimiter=limit=0.71:level=false")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav_path, "-af", chain, "-ac", "1",
                    "-b:a", "40k", mp3_path], check=True)

def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", s).split()

def main(build, check, only):
    from piper import PiperVoice
    phrases = json.loads(subprocess.run(["node", os.path.join(ROOT, "tools", "phrases.mjs")],
                                        capture_output=True, check=True, text=True).stdout)
    cache = os.path.join(build, "voice-cache")
    os.makedirs(cache, exist_ok=True)
    report = []
    asr = None
    if check:
        import numpy as np
        from faster_whisper import WhisperModel
        asr = WhisperModel("small", device="cpu", compute_type="int8")
    for lang, packs in phrases.items():
        if only and lang not in only:
            continue
        voice = PiperVoice.load(os.path.join(build, "voices", VOICES[lang] + ".onnx"))
        out_dir = os.path.join(ROOT, "app", "voice", lang)
        os.makedirs(out_dir, exist_ok=True)
        for pack, sentences in packs.items():
            data = {}
            for text in sentences:
                spoken = spoken_form(text, lang)
                h = hashlib.sha1(f"{VOICES[lang]}|{LENGTH_SCALE}|{spoken}".encode()).hexdigest()[:16]
                wav, mp3 = os.path.join(cache, h + ".wav"), os.path.join(cache, f"{h}.{ENCODING}.mp3")
                if not os.path.exists(wav):
                    record(voice, spoken, wav + ".tmp")
                    os.replace(wav + ".tmp", wav)
                if not os.path.exists(mp3):
                    encode(wav, mp3 + ".tmp.mp3")
                    os.replace(mp3 + ".tmp.mp3", mp3)
                data[text] = "data:audio/mpeg;base64," + base64.b64encode(open(mp3, "rb").read()).decode()
                if asr:
                    # half a second of silence around the clip: Whisper invents words on very short audio
                    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-af", "adelay=500,apad=pad_dur=0.5",
                                          "-ac", "1", "-ar", "16000", "-f", "f32le", "-"],
                                         capture_output=True, check=True).stdout
                    segs, _ = asr.transcribe(np.frombuffer(raw, np.float32), language=lang, beam_size=5,
                                             condition_on_previous_text=False)
                    heard = " ".join(s.text.strip() for s in segs)
                    score = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
                    report.append((score, lang, pack, text, heard))
            with open(os.path.join(out_dir, pack + ".json"), "w") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
            print(lang, pack, len(data), "sentences", flush=True)
    if asr:
        report.sort()
        with open(os.path.join(build, "voice-check%s.txt" % "".join("-" + l for l in only)), "w") as f:
            for score, lang, pack, text, heard in report:
                f.write(f"{score:.2f}\t{lang}\t{pack}\t{text}\t{heard}\n")
        print("checked", len(report), "clips; below 0.5:", sum(1 for r in report if r[0] < 0.5))

if __name__ == "__main__":
    main(sys.argv[1], "--check" in sys.argv, [a for a in sys.argv[2:] if a in VOICES])
