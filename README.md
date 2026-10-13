<p align="center"><img src="icons/og-image.png" alt="Pikolo, a picture quiz for little ones" width="720"></p>

# Pikolo

**A picture quiz for little ones.** Children from about 3 years old learn the names of animals, musical instruments, dinosaurs, flowers, trees, mushrooms, fruits and vegetables, herbs and spices, kitchen things, letters and landscapes, with pictures or real photos, and sounds. No reading needed: everything is spoken, in English, French, German or Italian.

- 1,363 pictures in 26 topics, each with three levels (easy, medium, hard), drawn or as real photos (chosen at the start), real instrument, animal and kitchen recordings
- A recorded voice in English, French, German and Italian, the same on every device
- Free, no ads, no account, nothing collected
- Works on phones, tablets and computers; opens fast (each topic loads its own pictures, sounds and voice), and once added to the home screen it downloads everything for its language and works without internet

**Play:** https://bachmannalexis.github.io/Quiz/ (see [Publishing](#publishing)), or download this repository and open `index.html`.

## How to play

Pick a topic, then a game:

- 🗣️ **Find the picture**: the voice asks "Where is the cello?" and the child taps the right picture among three. Its name then appears on the card.
- 🎤 **Say it!** (every topic): one big picture, the voice asks "What is it? Say it!" and the child says its name out loud. The microphone only notices that the child spoke and then stopped (it measures loudness on the device; nothing is recorded or sent, and the word itself is not checked), then the voice cheers "Yes! The cow!". After 7 seconds of silence the voice says the name and asks "Your turn!". Without a microphone, a parent taps the picture once the child has said it. Parents can also turn on **word checking** (parents' page, per language): [Vosk](https://alphacephei.com/vosk/) then recognises the name on the device, choosing only among the names of the topic (a 41–50 MB model, downloaded once and kept by the browser). The right name earns the star; anything else gets the name again and one more try, then "Bravo! The cow!", never a "no", because small children are often misheard.
- 👂 **Listening games** (music, animals, dinosaurs, kitchen, letters, landscapes): an instrument plays, an animal calls, the voice asks "Who says roar?", a toaster pops or a kettle boils, or a place is heard (waves, wind, rain, birds, a city…), and the child finds the picture.
- 👆 **Discover**: tap any picture to hear its name, then its sound: the instrument's tune, the place's sounds, the animal's real call, or what the animal or dinosaur says. Flowers, trees and mushrooms make no sound, so they say their name (and the poisonous mushrooms add a warning). The pictures at the top of each topic page can be tapped too. In music, the instrument can be played on 8 rainbow keys: one octave, do ré mi fa sol la si do (C to C), with the note names on the keys.

**Drawings or photos:** at the first start Pikolo asks whether to show drawings or real photos; the 🖼️ button on the home screen changes it. Letters always use drawings.

A game has 10 rounds, shown as a progress bar; each first-try answer earns a star, and the best score is kept on the topic card. Pictures that look or sound alike (lion and tiger, trumpet and trombone, button mushroom and death cap) never appear together, and nothing repeats within a game. The 📊 button shows the **scores**: every finished game per topic, game and group, marked *too easy* (nearly all first-try and quick in the last three games), *just right* or *tricky*, and the pictures most often missed. The **?** button opens a page for parents with how to play, sharing and privacy.

| Topic | Items | Groups |
|---|---|---|
| 🐄 Animals | 106, 26 of them with a real recording (cow, horse, rooster, owl, robin, bee…) and 24 with what they say ("the cow says moo") | farm, wild, sea, birds, bugs |
| 🎻 Music | 78 instruments, the whole symphony orchestra and many more, each with a short tune in its style | orchestra, jazz, rock & pop, world |
| 🦖 Dinosaurs | 20 (with the mammoth, the sabre-toothed cat, the plesiosaurus and a dinosaur egg), each with a sound ("the T. rex says roar") | |
| 🌻 Flowers | 36 | |
| 🌳 Trees | 28 | |
| 🍄 Mushrooms | 24, including the chanterelle and four boletes | |
| 🍓 Fruits & vegetables | 72 (fig, pomegranate, lychee, rhubarb, fennel, chickpeas…) | fruits, vegetables |
| 🌿 Herbs | 28 (basil, chervil, borage, lemon balm, wild garlic…) | |
| 🫚 Spices | 33 (cinnamon, saffron, cardamom, sumac, piment d'Espelette…) | |
| 🍞 Kitchen | 35, 10 of them with a real recording (toaster, kettle, microwave, mixer, frying pan…) | appliances, utensils |
| 🔤 ABC | 26 letters, taught by their sounds first (phonics): the first game plays a sound ("sss", "mmm", "buh") and the child finds the letter, then "S says sss, like snake!"; a second game uses the letter names. Letters that look alike (b, d, p) never appear together | vowels, long sounds (m, s, l…), short sounds (b, t, p…) |
| 📖 Syllables | 55 (ma, li, ro, pu…), consonant in blue and vowel in red: the voice says a syllable and the child finds it; in Discover the voice sounds it out and blends it ("mmm… a… ma!") | long sounds, short sounds |
| 🔢 Numbers | 1 to 100, with as many dots and sticks of ten to count | 1 to 10, 11 to 20, 21 to 50, 51 to 100, tens |
| 🕒 The clock | 64 times on a clock face (short red hour hand, long blue minute hand), in the order it is taught: o'clock, half past, quarter past and to, then five-minute steps. The voice asks "Show me half past three!" ("Montre-moi trois heures et demie !", "Zeig mir halb vier!", "Mostrami le tre e mezza!"). **Turn the hands**: a big clock to play with; drag the long minute hand (the hour hand follows, as on a real clock) or the hour hand, and the voice says the time, in 5-minute steps | o'clock, half past, quarters, minutes |
| 😀 Emotions | 18 feelings as faces: happy, sad, angry, scared, surprised, tired, sleepy, disgusted, shy, excited, worried, calm, silly, in love, sick, hurt, confused, embarrassed. The voice asks "Who is happy?" ("Qui est content ?", "Wer ist fröhlich?", "Chi è felice?") and then says when we feel it: "I feel scared when there is thunder." | |
| 🖐️ My body | 42: 30 outside (eyebrow, cheek, elbow, ankle, nails…) and 12 inside (heart, brain, lungs, stomach, liver, kidneys, intestines, skeleton…) | outside, inside |
| ⚽ Sports | 57, with ball games, winter, water and more | ball games, winter, water, more |
| 🚗 Transport | 38, 17 with real sounds (sirens, horns, train, plane, helicopter…) and a listening game | road, rails, air, water |
| ⛅ Weather | 20, with rain, storm, thunder and wind sounds and a listening game | |
| 🎨 Colours | 23 paint splashes (with turquoise, navy, gold, silver, burgundy…) | |
| 🔷 Shapes | 20, with 3D shapes (cube, sphere, cylinder, cone, pyramid) | |
| 👕 Clothes | 43 | |
| 👷 Jobs | 29 | |
| 🍕 Dishes | 149 dishes, 41 from France (quiche, cassoulet, tartiflette, macarons, paris-brest…) and 86 from around the world (couscous, phở, mafé, feijoada, plov…); the voice says where each one comes from ("Couscous comes from Morocco!") | savory, sweet, from France, world |
| 🌍 Countries | 195, every country of the UN plus the Vatican and Palestine: the flag (look-alike flags never together), and for 50 of them a landmark in photo mode (Eiffel Tower, Machu Picchu…) | Europe, Americas, Asia, Oceania, Africa |
| 🏔️ Landscapes | 24, 16 of them with real sounds (waves, stream, wind, birds, rain, thunder, bubbles, a city) | |

**Mushrooms, a note for parents:** the fly agaric, the death cap, the panther cap and Satan's bolete are marked ⚠️ and the voice says they are poisonous and must never be eaten. The game teaches names, not which mushrooms are safe to pick; never let children eat wild mushrooms.

### Instrument styles

| Style | Instruments |
|---|---|
| 🎻 Orchestra | violin, viola, cello, double bass, harp, piccolo, flute, oboe, cor anglais, clarinet, bass clarinet, bassoon, contrabassoon, French horn, trumpet, trombone, tuba, timpani, drum, bass drum, cymbals, gong, triangle, wood block, xylophone, marimba, glockenspiel, tubular bells, bell, celesta, harpsichord, piano, pipe organ |
| 🎷 Jazz | saxophone, clarinet, bass clarinet, trumpet, trombone, tuba, double bass, piano, vibraphone, drum kit, banjo, harmonica, melodica |
| 🎸 Rock & pop | electric guitar, bass guitar, guitar, drum kit, synthesizer, theremin, piano, harmonica, tambourine, cowbell, cajón |
| 🌍 World | accordion, harmonium, melodica, bagpipes, alphorn, didgeridoo, sitar, koto, shamisen, erhu, mandolin, ukulele, banjo, guitar, kalimba, steel drum, marimba, gong, music box, pan flute, shakuhachi, ocarina, recorder, whistle, slide whistle, djembe, bongos, taiko, tabla, cajón, maracas, tambourine, rainstick, castanets, claves, guiro, wood block, cowbell, jingle bells, wind chimes |

Each instrument plays a short tune in its style, for example the opening of Bach's Cello Suite on the cello, a walking bass on the double bass, Bach's Toccata on the pipe organ, *Sakura* on the koto, *Amazing Grace* on the bagpipes, *Twinkle Twinkle* on the music box, the Sugar Plum Fairy on the celesta, the Largo of the *New World Symphony* on the cor anglais and the Westminster chimes on the tubular bells.


## Publishing

The workflow in `.github/workflows/pages.yml` publishes the app to GitHub Pages each time `main` changes. It needs a one-time setting: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app is then at https://bachmannalexis.github.io/Quiz/, and links shared in messaging apps show a preview card (`icons/og-image.png`). On the website the app can be added to the home screen (`manifest.webmanifest`). The service worker (`sw.js`) serves everything from the device first: the app itself is refreshed in the background, and packs (pictures, sounds, voice, photos) carry their version from `app/packs.js` and are kept until they change. Once installed, or when a parent asks in the parents' page, the app downloads every pack of its language (about 55 MB) and works without internet. Bump `VERSION` in `sw.js` when the list of app files changes.

## Project layout

| Path | What it is |
|---|---|
| `index.html` | The page: home, topic, game, end and play screens, parents' sheet |
| `app/app.js` | The app logic |
| `app/words.js` | Everything the app says and shows, in English, French, German and Italian |
| `app/lang/` | German and Italian names of every item |
| `app/levels.js` | Easy and hard items per topic (three difficulty levels) |
| `app/voice/` | The recorded voice: every sentence in English and French (`<lang>/<topic>.json`, loaded when a topic opens) |
| `app/style.css`, `app/font.css` | Design (one bright theme; each topic recolors its screens) and the embedded Fredoka font |
| `app/topics.js` | Topics and items: names in English and French, families, groups, animal sounds |
| `app/pictures/`, `app/sounds/` | Generated drawings and sounds, one pack per topic (`<topic>.js`, loaded when the topic opens; `pictures/home.js` for the home screen) |
| `app/packs.js` | Generated list of every pack with its version and size (for the service worker and the offline download) |
| `app/vosk/` | Optional word checking: `vosk.js` ([vosk-browser](https://github.com/ccoreilly/vosk-browser)) and one small speech model per language (`<lang>.tar.gz`), loaded only when a parent turns it on |
| `app/photos/` | The photo mode: real photos per topic (`<topic>.json`) and for the home screen (`covers.json`), loaded when needed |
| `pictures/` | The pictures drawn for the app (SVG) |
| `icons/` | App icon, home-screen icons and the link preview image |
| `tools/` | Scripts that build the picture, sound, voice and photo packs |

## Sounds and pictures

Everything is bundled with the app, so it works offline:

- `app/sounds/<topic>.js`: for each instrument a short tune and the notes for the play mode, and the real recordings, built by `tools/make_sounds.py`.
- `app/pictures/<topic>.js`: all the pictures, built by `tools/make_pictures.py`.
- `app/packs.js`: the version and size of every pack, rebuilt by `tools/make_packs.py` (the tools above run it).

Where each instrument's sound comes from, best first:

| Library | Instruments |
|---|---|
| [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE), real orchestra recordings (via npm `tiny-orchestra`) | double bass, viola, harp, flute, oboe, clarinet, bassoon, contrabassoon, French horn, trumpet, trombone, tuba, timpani, glockenspiel, marimba, bass drum, drum, cymbals, triangle, claves, wood block |
| [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3), a real Yamaha C5 grand (via npm `@audio-samples/piano-mp3-velocity10`) | piano |
| [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments), real recordings | violin, cello, guitar, bass guitar, saxophone, xylophone, harmonium |
| [Sonic Pi](https://sonic-pi.net/) samples, real recordings | drum kit, cowbell, tabla, cajón |
| MusyngKite sound bank (via npm `web-music-score-samples`) | pipe organ, accordion, harmonica, bagpipes, sitar, koto, shamisen, kalimba, banjo, ukulele, electric guitar, synthesizer, recorder, pan flute, ocarina, music box, bell, piccolo, cor anglais, bass clarinet, celesta, harpsichord, vibraphone, tubular bells, mandolin, alphorn, erhu, melodica, shakuhachi |
| Synthesized by `tools/make_synth.py` | gong, theremin, didgeridoo, slide whistle, rainstick, wind chimes |
| GeneralUser GS sound bank, rendered by `tools/render_gm.mjs` | steel drum, taiko, djembe, bongos, maracas, tambourine, castanets, guiro, whistle, jingle bells, and the landscape sounds (its sound-effects kit) |

To rebuild (needs Node, Python and ffmpeg):

```sh
mkdir -p build/tonejs && cd build
for i in violin cello guitar-acoustic bass-electric saxophone xylophone harmonium; do
  (cd tonejs && npm pack tonejs-instrument-$i-mp3 && mkdir $i && tar xzf tonejs-instrument-$i-mp3-*.tgz -C $i)
done
npm pack @audio-samples/piano-mp3-velocity10 && mkdir sal && tar xzf audio-samples-piano-mp3-velocity10-*.tgz -C sal && ln -s sal/package/audio salamander
npm pack tiny-orchestra && mkdir to && tar xzf tiny-orchestra-*.tgz -C to && ln -s to/package/samples vsco
npm pack web-music-score-samples && mkdir wms && tar xzf web-music-score-samples-*.tgz -C wms && ln -s wms/package/samples musyngkite
npm pack supersonic-scsynth-samples && mkdir sp && tar xzf supersonic-scsynth-samples-*.tgz -C sp && ln -s sp/package/samples sonicpi
npm pack generaluser && mkdir gu && tar xzf generaluser-*.tgz -C gu
npm init -y && npm i spessasynth_core && cp ../tools/render_gm.mjs . && node render_gm.mjs gu/package/GeneralUser.sf2 rendered
npm pack @iconify-json/noto && mkdir noto && tar xzf iconify-json-noto-*.tgz -C noto
cd .. && python3 tools/fetch_animals.py build && python3 tools/make_synth.py build && python3 tools/make_sounds.py build && python3 tools/make_pictures.py build/noto/package/icons.json
```

## Voice

Every sentence is recorded in advance, so the voice sounds the same on every phone, tablet and computer, works offline, and does not depend on the voices installed on the device. The recordings are made with the [Piper](https://github.com/OHF-Voice/piper1-gpl) speech synthesizer, a little slower than normal for small children. If a sentence has no recording (for example after the text was changed and not recorded again), the app falls back to the device's own voice.

To record the voice again after changing `app/words.js` or `app/topics.js` (needs Node, Python and ffmpeg):

```sh
python3 -m venv build/tts && build/tts/bin/pip install piper-tts faster-whisper
mkdir -p build/voices && cd build/voices
for v in en/en_US/ljspeech/high/en_US-ljspeech-high fr/fr_FR/siwis/medium/fr_FR-siwis-medium \
         de/de_DE/thorsten/high/de_DE-thorsten-high it/it_IT/riccardo/x_low/it_IT-riccardo-x_low; do
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx
  curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/$v.onnx.json
done
cd ../.. && build/tts/bin/python tools/make_voice.py build --check
```

`tools/phrases.mjs` lists the sentences, recordings are cached in `build/voice-cache`, and `--check` transcribes each new clip with Whisper (`--check-all`: every clip) and lists the doubtful ones in `build/voice-check.txt`. Words the synthesizer mispronounces can be respelled in `spoken_form()` in `tools/make_voice.py`.

Word checking: the vosk-browser library and the small Vosk models, repacked as `.tar.gz` (all Apache 2.0):

```sh
npm pack vosk-browser@0.0.8 && tar xzf vosk-browser-0.0.8.tgz && cp package/dist/vosk.js app/vosk/
for m in en-us-0.15 fr-0.22 de-0.15 it-0.22; do
  curl -LO https://alphacephei.com/vosk/models/vosk-model-small-$m.zip && unzip -q vosk-model-small-$m.zip
  rm vosk-model-small-$m/README && tar czf app/vosk/${m%%-*}.tar.gz vosk-model-small-$m
done
```

## Credits

- Orchestra recordings: Versilian Studios Chamber Orchestra 2 Community Edition by Versilian Studios / Samuel Gossner, CC0, edited by tiny-orchestra (CC0).
- Piano: [Salamander Grand Piano V3](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) (MP3 packaging by Jan Forst, `@audio-samples`).
- Recordings of violin, cello, guitar, bass guitar, saxophone and xylophone: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (npm packaging by Makefully Studios), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- Drum kit, cowbell and tabla: samples from [Sonic Pi](https://sonic-pi.net/) (npm `supersonic-scsynth-samples`), CC0.
- MusyngKite sound bank samples from [midi-js-soundfonts](https://github.com/gleitz/midi-js-soundfonts) by Benjamin Gleitzman, packaged by web-music-score-samples. MusyngKite is licensed [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), so the sound packs (`app/sounds/`) are shared under the same license.
- Steel drum, taiko, djembe, bongos, maracas, tambourine, castanets, guiro, whistle and jingle bells: rendered from the [GeneralUser GS](https://www.schristiancollins.com/generaluser.php) sound bank by S. Christian Collins (free to use, see its license) with [spessasynth_core](https://github.com/spessasus/spessasynth_core).
- All recordings were trimmed, pitch-shifted and combined into short tunes.
- Photos (photo mode): freely licensed photos (CC0, CC BY, CC BY-SA) from [iNaturalist](https://www.inaturalist.org) and [Openverse](https://openverse.org), cropped and resized; each photo and its author is listed in `PHOTO-CREDITS.md` (built by `tools/fetch_photos.py` and `tools/make_photos.py`, choices in `tools/photo_picks.json`).
- Flags: [Circle Flags](https://github.com/HatScripts/circle-flags) by HatScripts, MIT (`tools/make_flags.py`).
- Letters, numbers, colours and shapes: drawn by `tools/make_letters.py` (letters and digits from the Fredoka font).
- Animal, kitchen, transport and weather recordings: real recordings by Joseph Sardin from [BigSoundBank](https://bigsoundbank.com), [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (listed in `SOUND-CREDITS.md`, downloaded by `tools/fetch_animals.py`).
- Voice: recorded with [Piper](https://github.com/OHF-Voice/piper1-gpl). English voice trained on the [LJ Speech](https://keithito.com/LJ-Speech-Dataset/) dataset (public domain); French voice trained on the [SIWIS](https://datashare.ed.ac.uk/handle/10283/2353) dataset, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); German voice trained on [Thorsten-Voice](https://github.com/thorstenMueller/Thorsten-Voice) (CC0); Italian voice (Riccardo) trained on the [M-AILABS](https://cs.paperswithcode.com/dataset/m-ailabs-speech-dataset) Italian recordings from LibriVox (public domain).
- Speech recognition (optional word checking): [Vosk](https://alphacephei.com/vosk/) by Alpha Cephei, small models for English, French, German and Italian, and [vosk-browser](https://github.com/ccoreilly/vosk-browser) by Ciaran O'Reilly, all [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0).
- Font: [Fredoka](https://github.com/hafontia/Fredoka) by Milena Brandão, SIL Open Font License 1.1 (embedded in `app/font.css`).
- Drawings: 180 come from [Noto Emoji](https://github.com/googlefonts/noto-emoji) by Google, licensed Apache-2.0 (most animals, fruits and vegetables, and the ones listed in `tools/make_pictures.py`). The other 240 are drawn for this project (`pictures/`).
