# Instrument Quiz

A picture quiz about musical instruments for 4-year-olds. No reading needed: everything is spoken or played.

Open `index.html` in any browser (tablet or phone works great). No install, no internet required.

## Two games

- 🗣️ **Hear the name**: the app says "Where is the guitar?" and the child taps the right picture. When they find it, the instrument plays.
- 👂 **Hear the sound**: the app plays an instrument (piano, violin, guitar, trumpet, saxophone, flute, accordion, drum, maracas, bell) and the child taps the one they hear. After a wrong tap, the right sound plays again so they can compare.

10 rounds per game. A ⭐ for each first-try answer. The 🔊 / 👂 button repeats the question, and the flag switches between English and French.

## Sounds

`sounds.js` holds short tunes built from real instrument recordings by `tools/make_sounds.py`. Drum, maracas and bell are synthesized in the browser.

To rebuild the tunes (needs ffmpeg):

```sh
mkdir samples && cd samples
for i in piano violin guitar-acoustic trumpet saxophone flute harmonium; do
  npm pack tonejs-instrument-$i-mp3 && mkdir $i && tar xzf tonejs-instrument-$i-mp3-*.tgz -C $i
done
cd .. && python3 tools/make_sounds.py samples
```

## Credits

The instrument recordings come from [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) by Nicholaus Brosowsky (npm packaging by Makefully Studios). They are licensed [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Here they have been trimmed and combined into short tunes. The accordion tune uses the harmonium samples.
