#!/usr/bin/env python3
"""Download the real recordings used by Pikolo (animals, kitchen, transport, weather, landscapes, some instruments),
with their licences.

Usage: python3 tools/fetch_animals.py <build dir> [--no-commons]
Writes <build>/commons/raw/<animal>.<ext> and <build>/commons/credits.json, which
tools/make_sounds.py turns into short excerpts in the sound packs (app/sounds/) and SOUND-CREDITS.md.
Sources: BigSoundBank (CC0 recordings by Joseph Sardin) first, Wikimedia Commons for the
animals it does not have. The Commons API rate-limits hard, so requests are batched and
paced; --no-commons skips it (already downloaded files are kept).
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

# animal id -> BigSoundBank page (bigsoundbank.com/<page>.html). All CC0, recorded by Joseph Sardin.
BIGSOUNDBANK = {
    "dog": "barking-dog-s0916",
    "cat": "meow-cat-1-s1889",
    "cow": "cow-moos-s0546",
    "pig": "grumpy-pig-1-s1658",
    "horse": "horse-neighing-3-s0863",
    "donkey": "donkey-braying-1-s1549",
    "sheep": "sheep-1-s2343",
    "goat": "bleating-goat-1-s0279",
    "hen": "annoyed-hen-s0453",
    "rooster": "song-of-a-rooster-s0474",
    "duck": "ducks-s0276",
    "chick": "chick-that-chirp-s0672",
    "mouse": "mouse-screams-s0459",
    "frog": "frogs-1-s0997",
    "owl": "tawny-owl-1-s1763",
    "parrot": "cockatiel-parakeet-1-s2769",
    "crow": "crows-2-s0956",
    "bee": "bumblebee-1-s1000",
    "fly": "many-flies-s0822",
    "grasshopper": "field-cricket-s1020",
    "hedgehog": "cry-of-a-young-hedgehog-s0941",
    "bat": "cries-of-bats-s0458",
    "toad": "song-of-the-common-midwife-toad-1-s1053",
    "seagull": "gulls-on-the-harbor-s2573",
    "robin": "robin-1-s1667",
    "blackbird": "common-blackbird-2-s3474",
    # kitchen
    "fridge": "fridge-door-s1158",
    "oven": "electric-oven-s0102",
    "microwave": "microwave-bell-s1631",
    "toaster": "toaster-s0055",
    "kettle": "electric-kettle-2-s1154",
    "mixer": "electric-hand-mixer-1-s1752",
    "coffee-machine": "nespresso-coffee-maker-1-s3047",
    "dishwasher": "dishwasher-s1002",
    "hood": "kitchen-extractor-hood-s0309",
    "frying-pan": "frying-pan-2-s0144",
    # transport
    "car": "car-horn-4-s0260", "train": "steam-locomotive-1-s3016", "high-speed-train": "high-speed-train-passage-1-s0120",
    "airplane": "airplane-pass-1-s3004", "helicopter": "helicopter-1-s0263", "motorcycle": "motorcycle-s0281",
    "ship": "horn-of-a-ship-1-s0261", "police-car": "siren-french-gendarmerie-s0886", "ambulance": "ambulance-siren-1-s1463",
    "fire-engine": "2-tons-siren-passage-s2030", "tractor": "tractor-1-s0132", "bicycle": "bell-bike-1-s0028",
    "bus": "bus-horn-s3594", "truck": "truck-horn-s2721", "scooter": "scooter-passage-s0533", "tram": "tram-passing-1-s3539",
    "metro": "metro-stopping-and-starting-1-s3039",
    # weather
    "rain": "rain-on-puddle-s1290", "umbrella": "rain-under-an-umbrella-s2679", "storm": "rain-and-storm-s0124",
    "lightning": "thunder-s2718", "wind": "strong-wind-1-s0146",
}
# landscapes and instruments: real recordings instead of rendered or synthesized sounds
BIGSOUNDBANK.update({
    "beach": "sea-waves-and-seagulls-s0267", "island": "small-waves-and-beach-1-s1446", "wave": "sea-waves-s0266",
    "river": "small-stream-s0823", "waterfall": "small-waterfall-2-s0219", "forest": "forest-s0100",
    "city": "city-center-1-s2762", "starry-sky": "song-of-nocturnal-insect-2-s0425", "jungle": "screaming-piha-s1762",
    "lake": "pond-in-a-field-s0691", "countryside": "countryside-s0097", "snow": "steps-in-the-snow-3-s3363",
    "mountain": "whistling-of-the-wind-1-s0147",
    "gong": "gong-sweet-s1482", "rainstick": "rain-stick-s0464", "didgeridoo": "didgeridoo-s0296",
})

BSB = "https://bigsoundbank.com"

# animal id -> Commons file. Used for the animals missing from BIGSOUNDBANK.
# Chosen by hand: real animals (not people pronouncing words),
# freely licensed, short where possible.
CHOSEN = {
    "dog": "Barking of a dog.ogg",
    "cat": "Maullido de gata hembra joven.ogg",
    "cow": "Mudchute cow 1.ogg",
    "pig": "Mudchute pig 1.ogg",
    "horse": "Mares-Prefer-the-Voices-of-Highly-Fertile-Stallions-pone.0118468.s001.oga",
    "donkey": "157763 felix-blume a-donkey-is-braying-in-his-enclosure-in-south-of-france.wav",
    "sheep": "Mudchute sheep 1.ogg",
    "goat": "Herd of goats bleating.ogg",
    "rooster": "Medium rooster crowing.ogg",
    "turkey": "Gobbler.ogg",
    "duck": "Anas platyrhynchos - Mallard - XC62258.ogg",
    "goose": "Greylag Goose (Anser anser) - Bærum, Norway 2021-04-03.mp3",
    "tiger": "439280 schots angry-tiger.wav",
    "elephant": "Elephant voice - trumpeting.ogg",
    "monkey": "Sound-of-stump-tailed-macaque-(macaca-arctoides).ogg",
    "wolf": "Wolf howls.ogg",
    "bear": "Bear growl.ogg",
    "frog": "Frogs croak calling chorus at night.ogg",
    "owl": "Tawny Owl (Strix aluco).ogg",
    "parrot": "Kampfgeschrei Graupapagei.ogg",
    "crow": "Corvus corone - Carrion Crow XC511982.mp3",
    "dove": "Dove cooing.ogg",
    "peacock": "Pavo cristatus (call).ogg",
    "penguin": "20091121 Little Penguin calls at St Kilda Breakwater.ogg",
    "flamingo": "Phoenicopterus roseus - Greater Flamingo XC432217.mp3",
    "bee": "Bee buzzing sound (animal noises).opus",
    "grasshopper": "Tettigonia viridissima - sound.ogg",
    "whale": "Humpbackwhale2.ogg",
    "dolphin": "161691 felixblume dolphin-screaming-underwater-in-caribbean-sea-mexico.wav",
    "boar": "Boar.Grwls(1).ogg",
    "otter": "Smooth-coated otter sound.wav",
    "moose": "Moose mate.ogg",
    "hedgehog": "Braunigel Drohgeräusche.ogg",
    "deer": "Male roe deer growl.ogg",
}
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "PikoloQuizBuilder/1.0 (https://github.com/BachmannAlexis/Quiz)"}

def fetch(url):
    """The body of url; waits and retries when rate limited."""
    for attempt in range(10):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429: raise
            wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
            print(f"  rate limited, waiting {wait}s", file=sys.stderr)
            time.sleep(wait)
    raise SystemExit("still rate limited, try again later")

def metadata(titles):
    """Licence, author and URLs for up to 50 files in one request."""
    q = urllib.parse.urlencode({"action": "query", "titles": "|".join("File:" + t for t in titles),
                                "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    d = json.loads(fetch(API + "?" + q))
    norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
    out = {}
    for p in d["query"]["pages"].values():
        if "imageinfo" not in p: continue
        ii, m = p["imageinfo"][0], p["imageinfo"][0].get("extmetadata", {})
        g = lambda k: re.sub(r"\s+", " ", re.sub("<[^>]+>", "", m.get(k, {}).get("value", ""))).strip()
        title = norm.get(p["title"], p["title"])[5:]
        out[title] = {"url": ii["url"], "page": ii["descriptionurl"], "license": g("LicenseShortName"),
                      "license_url": g("LicenseUrl"), "artist": g("Artist") or g("Credit")}
    return out

def save(path, url):
    if not (os.path.exists(path) and os.path.getsize(path)):
        data = fetch(url)
        open(path, "wb").write(data)  # only once complete
        time.sleep(1)

def bigsoundbank(base, credits):
    for key, page in BIGSOUNDBANK.items():
        num = page[-4:]
        rel = f"raw/{key}.ogg"
        save(os.path.join(base, rel), f"{BSB}/UPLOAD/ogg/{num}.ogg")
        credits[key] = {"file": rel, "title": page[:-6].replace("-", " ").capitalize(), "page": f"{BSB}/{page}.html",
                        "license": "CC0", "license_url": "https://creativecommons.org/publicdomain/zero/1.0/",
                        "artist": "Joseph Sardin (BigSoundBank)"}
        print(f"{key:12s} BigSoundBank {num} {os.path.getsize(os.path.join(base, rel)):>9}", flush=True)

def commons(base, credits):
    todo = {k: t for k, t in CHOSEN.items() if k not in credits}
    meta = metadata(list(todo.values()))
    for key, title in todo.items():
        m = meta.get(title)
        if not m:
            print("not found on Commons:", key, title); continue
        url = m["url"].split("?")[0]
        ext = os.path.splitext(urllib.parse.unquote(url))[1].lower()
        rel = f"raw/{key}{ext}"
        save(os.path.join(base, rel), url)
        credits[key] = {"file": rel, "title": title, **m, "url": url}
        print(f"{key:12s} {m['license'][:14]:14s} {os.path.getsize(os.path.join(base, rel)):>9}  {m['artist'][:50]}", flush=True)

def main(build, use_commons):
    base = os.path.join(build, "commons")
    os.makedirs(os.path.join(base, "raw"), exist_ok=True)
    path = os.path.join(base, "credits.json")
    credits = {}
    bigsoundbank(base, credits)
    if use_commons:
        commons(base, credits)
    elif os.path.exists(path):  # keep the Commons files downloaded before
        credits = {**{k: c for k, c in json.load(open(path)).items()
                      if "commons" in c.get("page", "") and os.path.exists(os.path.join(base, c["file"]))}, **credits}
    json.dump(credits, open(path, "w"), indent=1, ensure_ascii=False)
    print(len(credits), "animals")

if __name__ == "__main__":
    main(sys.argv[1], "--no-commons" not in sys.argv)
