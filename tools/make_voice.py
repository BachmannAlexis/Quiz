#!/usr/bin/env python3
"""Record Pikolo's voice: every sentence the app says, in English and French.

Usage: python3 tools/make_voice.py <build dir> [--check | --check-all] [en|fr]
  node tools/phrases.mjs must be runnable (it lists the sentences).
  <build dir>/voices holds the Piper voices (see README):
    en_US-ljspeech-high.onnx(.json)  US English, LJ Speech dataset, public domain
    fr_FR-siwis-medium.onnx(.json)   French, SIWIS dataset, CC BY 4.0
  A language code records only that language (run one per language in parallel).
  --check transcribes the clips recorded in this run (--check-all: every clip) with Whisper
  (faster-whisper) and lists the ones that do not match their sentence, in <build dir>/voice-check[-<lang>].txt.
Needs piper-tts and ffmpeg (and faster-whisper for --check). Writes app/voice/<lang>/<pack>.json:
{sentence: MP3 data URI}. Clips are cached in <build dir>/voice-cache, so reruns only record
new or changed sentences.
"""
import base64, difflib, hashlib, json, os, re, subprocess, sys, unicodedata, wave

VOICES = {"en": "en_US-ljspeech-high", "fr": "fr_FR-siwis-medium", "de": "de_DE-thorsten-high", "it": "it_IT-paola-medium"}
LENGTH_SCALE = 1.15  # a little slower than normal, for small children
ENCODING = 2         # bump when encode() changes: clips are encoded again from the cached recordings

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The sounds letters make (app/topics.js LETTER_SOUNDS), as phonemes: written "sss" or "buh"
# the synthesizer would spell them out or misread them.
LETTER_PHONEMES = {
    "en": {"ah": "æ", "buh": "bʌ", "kuh": "kʌ", "duh": "dʌ", "eh": "ɛ", "fff": "fːː", "guh": "ɡʌ", "huh": "hʌ",
           "ih": "ɪ", "juh": "dʒʌ", "lll": "lːː", "mmm": "mːː", "nnn": "nːː", "aw": "ɑː", "puh": "pʌ", "kwuh": "kwʌ",
           "ruh": "ɹʌ", "sss": "sːːː", "tuh": "tʌ", "uh": "ʌ", "vvv": "vːː", "wuh": "wʌ", "ks": "ks", "yuh": "jʌ", "zzz": "zːːː"},
    "fr": {"a": "a", "beu": "bø", "keu": "kø", "deu": "dø", "eu": "ø", "fff": "fːː", "gueu": "ɡø", "i": "i",
           "jeu": "ʒø", "lll": "lːː", "mmm": "mːː", "nnn": "nːː", "o": "o", "peu": "pø", "reu": "ʁø", "sss": "sːːː",
           "teu": "tø", "u": "y", "vvv": "vːː", "oua": "wa", "ks": "ks", "zzz": "zːːː"},
    "de": {"a": "a", "be": "bə", "ce": "tsə", "de": "də", "e": "e", "ef": "ɛf", "ge": "ɡə", "ha": "hə", "i": "i", "je": "jə",
           "ke": "kə", "el": "ɛl", "em": "ɛm", "en": "ɛn", "o": "o", "pe": "pə", "kwe": "kvə", "er": "ɛʁ", "sss": "sːːː", "te": "tə",
           "u": "u", "vau": "faʊ", "we": "və", "ks": "ks", "ü": "y", "zett": "tsɛt", "fff": "fːː", "lll": "lːː", "mmm": "mːː", "nnn": "nːː"},
    "it": {"a": "a", "bi": "bi", "ci": "tʃi", "di": "di", "e": "e", "effe": "ˈɛffe", "gi": "dʒi", "i": "i", "elle": "ˈɛlle",
           "emme": "ˈɛmme", "enne": "ˈɛnne", "o": "o", "pi": "pi", "cu": "ku", "erre": "ˈɛrre", "sss": "sːːː", "ti": "ti", "u": "u",
           "vu": "vu", "zeta": "ˈdzɛːta", "fff": "fːː", "lll": "lːː", "mmm": "mːː", "nnn": "nːː"},
}

# Syllables (app/topics.js SYLLABLES) are read as sounds: a consonant alone is stretched ("mmm") or said with a
# short schwa ("puh"), and a syllable is consonant + vowel ("ma"), so "m… a… ma!" sounds out and blends.
SYL_CONSONANTS = {"m": "m", "l": "l", "r": {"en": "ɹ", "fr": "ʁ", "de": "ʁ", "it": "r"}, "s": "s", "f": "f", "n": "n", "v": "v",
                  "p": "p", "t": "t", "b": "b", "d": "d"}
SYL_VOWELS = {"en": {"a": "æ", "e": "ɛ", "i": "ɪ", "o": "ɒ", "u": "ʌ"}, "fr": {"a": "a", "e": "ə", "i": "i", "o": "o", "u": "y"},
              "de": {"a": "a", "e": "e", "i": "i", "o": "o", "u": "u"}, "it": {"a": "a", "e": "e", "i": "i", "o": "o", "u": "u"}}

def syllable_phonemes(token, lang):
    c = lambda ch: SYL_CONSONANTS[ch][lang] if isinstance(SYL_CONSONANTS[ch], dict) else SYL_CONSONANTS[ch]
    t = token.lower()
    if len(t) == 2 and t[0] in SYL_CONSONANTS and t[1] in SYL_VOWELS[lang]:
        return c(t[0]) + SYL_VOWELS[lang][t[1]]
    if len(t) == 1 and t in SYL_VOWELS[lang]:
        return SYL_VOWELS[lang][t]
    if len(t) == 1 and t in SYL_CONSONANTS:
        return c(t) + ("ːː" if t in "mlrsfnv" else "ə")
    return None

def spoken_form(text, lang, pack=None):
    """What the synthesizer reads, when the written sentence would be mispronounced."""
    if pack == "syllables":
        return re.sub(r"(?<![\w'’])([A-Za-z]{1,2})(?![\w'’])",
                      lambda m: f"[[ {p} ]]" if (p := syllable_phonemes(m.group(1), lang)) else m.group(1), text)
    if lang == "en":
        text = text.replace("T. rex", "T-Rex")
    # "The letter S says sss", "Das S macht sss", "La S fa sss": the sound as phonemes
    if re.search(r"letter|lettre|Buchstabe|lettera", text) or re.match(r"(Das |La |L')[A-Z]\b", text):
        sounds = LETTER_PHONEMES[lang]
        text = re.sub(r"\b(says|fait|macht|fa) (\S+?)(?=[ ,?!])",
                      lambda m: f"{m.group(1)} [[ {sounds[m.group(2)]} ]] " if m.group(2) in sounds else m.group(0), text)
    return text

def record(voice, text, wav_path):
    """Synthesize text; a sound written as [[ phonemes ]] is recorded on its own, stretched (a
    letter's sound, "sss", must last), and joined to the rest with short pauses."""
    from piper import SynthesisConfig
    import io
    frames, params = [], None
    for k, piece in enumerate(re.split(r"\[\[(.*?)\]\]", text)):
        piece = piece.strip()
        if not piece or (k % 2 == 0 and not re.search(r"\w", piece)): continue  # lone punctuation
        if k % 2:  # phonemes: continuants (s, z, f, v, m, n, l) held longer than b + vowel
            scale = 3.0 if len(piece.replace("ː", "")) == 1 else 2.0
            piece = f"[[ {piece.replace('ː', '')} ]]"
        else:
            scale = LENGTH_SCALE
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            voice.synthesize_wav(piece, w, syn_config=SynthesisConfig(length_scale=scale))
        buf.seek(0)
        with wave.open(buf) as w:
            params = w.getparams()
            frames.append(w.readframes(w.getnframes()))
            frames.append(b"\0\0" * int(w.getframerate() * 0.08))
    with wave.open(wav_path, "wb") as w:
        w.setparams(params)
        w.writeframes(b"".join(frames))

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

def main(build, check, only, check_all=False):
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
                spoken = spoken_form(text, lang, pack)
                key = f"{VOICES[lang]}|{LENGTH_SCALE}|{spoken}" + ("|stretched" if "[[" in spoken else "")
                h = hashlib.sha1(key.encode()).hexdigest()[:16]
                wav, mp3 = os.path.join(cache, h + ".wav"), os.path.join(cache, f"{h}.{ENCODING}.mp3")
                fresh = not os.path.exists(wav)
                if fresh:
                    record(voice, spoken, wav + ".tmp")
                    os.replace(wav + ".tmp", wav)
                if not os.path.exists(mp3):
                    encode(wav, mp3 + ".tmp.mp3")
                    os.replace(mp3 + ".tmp.mp3", mp3)
                data[text] = "data:audio/mpeg;base64," + base64.b64encode(open(mp3, "rb").read()).decode()
                if asr and (fresh or check_all):
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
    main(sys.argv[1], "--check" in sys.argv or "--check-all" in sys.argv, [a for a in sys.argv[2:] if a in VOICES],
         "--check-all" in sys.argv)
