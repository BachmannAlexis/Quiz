# Pikolo — notes for Claude

Pikolo is a picture quiz for children of 3 to 5 years, in English, French, German and Italian: a voice says a name (or a
sound plays) and the child taps the right picture among three. Live at https://bachmannalexis.github.io/Quiz/
(GitHub Pages, published from `main` by `.github/workflows/pages.yml`). See README.md for the user-facing
description, the asset sources and the full rebuild commands.

## Ground rules

- **Static app, no build step to run it.** `index.html` loads plain scripts from `app/`; it must keep working
  offline and when opened as a local file. No frameworks, no bundler, no network calls at run time except
  loading the app's own files.
- **For small children who cannot read.** Everything is spoken; pictures must be recognisable at about
  110 px and look-alikes must never be offered together (see `family` below). Keep sentences short.
- **All four languages, always.** Every visible or spoken text exists in English, French, German and Italian
  (`app/words.js`; `en`/`fr` on every item in `app/topics.js`, German and Italian names in `app/lang/de.js` and
  `it.js`). Names carry their article ("la quiche", "die Pommes", "l'Italia"); German and Italian plurals are marked
  `["…", "pl"]`. `says`, `like` and `unit` are arrays in the order en, fr, de, it.
- **Privacy.** No ads, no accounts, no analytics. Anything kept is in `localStorage` on the device
  (best scores, scores, language, drawings/photos choice).
- **Secrets** (API keys) go in the environment settings, never in the repo or the chat.
- After changing the list of app files, bump `VERSION` in `sw.js` (the service worker is network-first).

## Layout

| Path | What it is |
|---|---|
| `app/topics.js` | All topics and items (source of truth for content) |
| `app/words.js` | All texts in the four languages, sentence builders (`where`, `name`, `yes`, `says`, `from`), `addLanguage()` |
| `app/lang/de.js`, `it.js` | German and Italian names, sounds, topic and group names |
| `app/levels.js` | Difficulty: per topic the easy and hard item ids (the rest is medium) |
| `app/app.js` | Screens, games, voice playback, photos, scores |
| `app/style.css` | Design; each topic recolours its screens with `color`/`tint` |
| `app/pictures.js` | **Generated** by `tools/make_pictures.py`: Noto emoji + `pictures/*.svg` as data URIs |
| `app/sounds.js` | **Generated** by `tools/make_sounds.py` (instruments, recordings, landscape sounds) |
| `app/voice/<lang>/<topic>.json` | **Generated** by `tools/make_voice.py`: every sentence as an MP3 data URI |
| `app/photos/<topic>.json`, `covers.json` | **Generated** by `tools/make_photos.py` from `tools/photo_picks.json` |
| `pictures/*.svg` | Hand-drawn or generated pictures (128×128 viewBox, flat Noto-like style, no text) |
| `tools/` | Generators and fetchers, see below |

Never edit generated files by hand; change the source and rerun the tool.

## Items in `app/topics.js`

Each item: `{ id, en, fr, family, styles, ... }`.

- `id` is unique **across all topics** (pictures, photos and sounds are keyed by it; e.g. the country is
  `turkiye` because `turkey` is the bird). Check for duplicates after adding items.
- `family`: items with the same family never appear together as choices (look-alikes: lion/tiger,
  b/d/p, flags that look alike).
- `styles`: the groups the item belongs to (a topic's `groups` filter on them).
- Optional: `many` (plural, "Where are…"), `says` + `like` (sound words, letters), `hears` (sound family for
  the listening game), `poison` (mushroom warning), `from` (dish → country id: "La quiche vient de France !").
- Topic flags: `bare` (English name without "the"), `modes` (`name`, `listen`, `explore`, `play`), `groups`.

When adding items: add the picture (`pictures/<id>.svg` or a Noto mapping in `tools/make_pictures.py`), rebuild
`pictures.js`, record the voice, optionally add a photo query in `tools/fetch_photos.py` and a pick in
`tools/photo_picks.json`, update the counts in README.md. Flags come from `tools/make_flags.py` (Circle Flags);
letters, numbers, colours and shapes from `tools/make_letters.py`.

## Tools (run from the repo root, assets in a build dir outside git)

- `tools/make_pictures.py <noto icons.json>` → `app/pictures.js`
- `tools/make_flags.py <circle-flags icons.json>` → `pictures/<country>.svg`
- `tools/make_letters.py` (needs fontTools) → letters, numbers, colours, shapes
- `tools/make_voice.py <build> [--check | --check-all] [en|fr]` → voice packs; clips are cached, `--check`
  transcribes new clips with Whisper and lists doubtful ones in `<build>/voice-check*.txt`.
  `tools/phrases.mjs` lists every sentence the app can say; it must mirror `extra()` in `app/app.js`.
- `tools/fetch_photos.py <build> [topics] [--retry]` → candidate photos (iNaturalist, Openverse; CC0/BY/BY-SA
  only); `tools/make_photos.py <build>` → photo packs and PHOTO-CREDITS.md.
- `tools/fetch_animals.py`, `tools/make_sounds.py`, `tools/render_gm.mjs` → sounds (SOUND-CREDITS.md).

## Checking changes

There is no test suite in the repo. Check in a real browser with Playwright (Chromium is preinstalled; import
from `/opt/node22/lib/node_modules/playwright/index.mjs`), serving the repo over a small local HTTP server.
Set `localStorage['pikolo-look']` before loading, or the drawings/photos chooser opens first. Useful checks:
open every topic and play every mode (no page errors), every item has a picture in `app/pictures.js`, and
every sentence from `tools/phrases.mjs` has a recording in `app/voice/`. Look at new pictures on a contact
sheet next to existing ones before committing them.

## Long tasks in cloud sessions

Background jobs (voice recording, photo downloads) and drawing agents can be cut off by usage limits or a
restart. Commit and push often. When starting such work, schedule one check-in (`send_later`, about 5 hours
ahead) that resumes it, and cancel it as soon as the work is done, so a check-in only happens when the work
was actually interrupted. Don't set up recurring check-ins.
