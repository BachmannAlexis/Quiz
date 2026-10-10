# Instrument Quiz

A picture quiz about musical instruments for 4-year-olds. No reading needed: everything is spoken or played.

Open `index.html` in any browser (tablet or phone works great). No install, no internet required.

## Two games

- 🗣️ **Hear the name**: the app says "Where is the guitar?" and the child taps the right picture. When they find it, the instrument plays.
- 👂 **Hear the sound**: the app plays an instrument and the child taps the one they hear. After a wrong tap, the right sound plays again so they can compare. The three pictures always come from different instrument families (never trumpet next to trombone), so the sounds are easy to tell apart.

17 instruments: guitar, banjo, harp, violin, piano, accordion, trumpet, trombone, horn, saxophone, flute, drum, maracas, tambourine, triangle, bell and xylophone.

10 rounds per game. A ⭐ for each first-try answer. The 🔊 / 👂 button repeats the question, and the flag switches between English and French.

## Sounds and pictures

Everything is bundled in the page, so it works offline:

- `sounds.js`: a short tune of real recordings for each instrument, built by `tools/make_sounds.py`.
- `pictures.js`: the pictures, built by `tools/make_pictures.py`.

To rebuild them (needs Node, Python and ffmpeg):

```sh
mkdir -p build/samples && cd build
# recorded instruments
for i in piano violin trumpet saxophone flute harp xylophone trombone french-horn; do
  (cd samples && npm pack tonejs-instrument-$i-mp3 && mkdir $i && tar xzf tonejs-instrument-$i-mp3-*.tgz -C $i)
done
# General MIDI sound bank for guitar, banjo, accordion and percussion
npm pack generaluser && tar xzf generaluser-*.tgz && mv package generaluser
npm init -y && npm i spessasynth_core && cp ../tools/render_gm.mjs . && node render_gm.mjs generaluser/GeneralUser.sf2 rendered
# pictures
npm pack @iconify-json/noto && mkdir noto && tar xzf iconify-json-noto-*.tgz -C noto
cd .. && python3 tools/make_sounds.py build/samples build/rendered && python3 tools/make_pictures.py build/noto/package/icons.json
```

## Credits

- Recordings of piano, violin, trumpet, saxophone, flute, harp, xylophone, trombone and horn: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (npm packaging by Makefully Studios), licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They have been trimmed and combined into short tunes.
- Guitar, banjo, accordion, drum, maracas, tambourine, triangle and bell: rendered from the [GeneralUser GS](https://www.schristiancollins.com/generaluser.php) sound bank by S. Christian Collins (free to use, see its license) with [spessasynth_core](https://github.com/spessasus/spessasynth_core).
- Pictures: [Noto Emoji](https://github.com/googlefonts/noto-emoji) by Google, licensed Apache-2.0. Xylophone, triangle and tambourine are drawn for this project (`pictures/`).
