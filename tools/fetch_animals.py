#!/usr/bin/env python3
"""Download the animal recordings used by Pikolo from Wikimedia Commons, with their licences.

Usage: python3 tools/fetch_animals.py <build dir>
Writes <build>/commons/raw/<animal>.<ext> and <build>/commons/credits.json, which
tools/make_sounds.py turns into short excerpts in app/sounds.js and SOUND-CREDITS.md.
The Commons API rate-limits hard, so requests are batched and paced.
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

# animal id -> Commons file. Chosen by hand: real animals (not people pronouncing words),
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

def main(build):
    base = os.path.join(build, "commons")
    os.makedirs(os.path.join(base, "raw"), exist_ok=True)
    meta = metadata(list(CHOSEN.values()))
    credits = {}
    for key, title in CHOSEN.items():
        m = meta.get(title)
        if not m:
            print("not found on Commons:", key, title); continue
        ext = os.path.splitext(urllib.parse.unquote(m["url"]))[1].lower()
        rel = f"raw/{key}{ext}"
        path = os.path.join(base, rel)
        if not os.path.exists(path):
            open(path, "wb").write(fetch(m["url"]))
            time.sleep(1)
        credits[key] = {"file": rel, "title": title, **m}
        print(f"{key:12s} {m['license'][:14]:14s} {os.path.getsize(path):>9}  {m['artist'][:50]}")
    json.dump(credits, open(os.path.join(base, "credits.json"), "w"), indent=1, ensure_ascii=False)

if __name__ == "__main__":
    main(sys.argv[1])
