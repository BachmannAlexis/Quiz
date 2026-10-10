# Instrument Quiz

A picture quiz about musical instruments for 4-year-olds. No reading needed: everything is spoken or played.

Open `index.html` in any browser (tablet or phone works great). No install, no internet required.

## Two games, four styles

- 🗣️ **Hear the name**: the app says "Where is the cello?" and the child taps the right picture. When they find it, the instrument plays.
- 👂 **Hear the sound**: the app plays an instrument and the child taps the one they hear. After a wrong tap, the right sound plays again so they can compare.

Pick a style before starting (tapping a style plays a sample):

| Style | Instruments |
|---|---|
| 🎻 Orchestra | violin, cello, double bass, harp, flute, clarinet, oboe, bassoon, French horn, trumpet, trombone, tuba, timpani, drum, bass drum, cymbals, xylophone, glockenspiel, bell, triangle, piano, pipe organ |
| 🎷 Jazz | saxophone, clarinet, trumpet, trombone, tuba, double bass, piano, drum kit, banjo, harmonica |
| 🎸 Rock & pop | electric guitar, bass guitar, guitar, drum kit, synthesizer, piano, harmonica, tambourine, cowbell |
| 🌍 World | accordion, bagpipes, sitar, koto, shamisen, ukulele, banjo, guitar, kalimba, steel drum, music box, pan flute, ocarina, recorder, whistle, djembe, bongos, taiko, tabla, maracas, tambourine, castanets, claves, guiro, wood block, cowbell, jingle bells |
| All | all 55 instruments |

Each instrument plays a short tune in its style, for example the opening of Bach's Cello Suite on the cello, a walking bass on the double bass, Bach's Toccata on the pipe organ, *Sakura* on the koto, *Amazing Grace* on the bagpipes and *Twinkle Twinkle* on the music box.

The three pictures in a question always come from different instrument families (never trumpet next to trombone, or clarinet next to oboe), so a 4-year-old can tell them apart. No instrument repeats within a game.

10 rounds per game. A ⭐ for each first-try answer. The 🔊 / 👂 button repeats the question, and the flag switches between English and French.

## Sounds and pictures

Everything is bundled in the page, so it works offline:

- `sounds.js`: a short tune of real recordings for each instrument, built by `tools/make_sounds.py`.
- `pictures.js`: the pictures, built by `tools/make_pictures.py`.

To rebuild them (needs Node, Python and ffmpeg):

```sh
mkdir -p build/samples && cd build
# recorded instruments
for i in piano violin cello contrabass harp flute clarinet bassoon french-horn trumpet trombone tuba xylophone saxophone guitar-acoustic bass-electric; do
  (cd samples && npm pack tonejs-instrument-$i-mp3 && mkdir $i && tar xzf tonejs-instrument-$i-mp3-*.tgz -C $i)
done
# General MIDI sound bank for the other instruments
npm pack generaluser && tar xzf generaluser-*.tgz && mv package generaluser
npm init -y && npm i spessasynth_core && cp ../tools/render_gm.mjs . && node render_gm.mjs generaluser/GeneralUser.sf2 rendered
# tabla recordings from Sonic Pi
npm pack supersonic-scsynth-samples && mkdir sonicpi && tar xzf supersonic-scsynth-samples-*.tgz -C sonicpi
# pictures
npm pack @iconify-json/noto && mkdir noto && tar xzf iconify-json-noto-*.tgz -C noto
cd .. && python3 tools/make_sounds.py build/samples build/rendered build/sonicpi/package/samples
python3 tools/make_pictures.py build/noto/package/icons.json
```

## Credits

- Recordings of piano, violin, cello, double bass, harp, flute, clarinet, bassoon, French horn, trumpet, trombone, tuba, xylophone, saxophone, guitar and bass guitar: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (npm packaging by Makefully Studios), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They have been trimmed, pitch-shifted and combined into short tunes.
- The other instruments, except the tabla: rendered from the [GeneralUser GS](https://www.schristiancollins.com/generaluser.php) sound bank by S. Christian Collins (free to use, see its license) with [spessasynth_core](https://github.com/spessasus/spessasynth_core).
- Tabla: samples from [Sonic Pi](https://sonic-pi.net/) (npm `supersonic-scsynth-samples`), CC0.
- Pictures: 15 come from [Noto Emoji](https://github.com/googlefonts/noto-emoji) by Google, licensed Apache-2.0 (violin, harp, flute, French horn, trumpet, trombone, drum, bell, piano, saxophone, electric guitar, accordion, banjo, maracas, djembe). The other 40 are drawn for this project (`pictures/`).
