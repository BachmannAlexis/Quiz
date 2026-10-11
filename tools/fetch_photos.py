#!/usr/bin/env python3
"""Download candidate photos for the photo mode, with their licences.

Usage: python3 tools/fetch_photos.py <build dir> [topic ...]
For each item it saves a few freely licensed candidates in <build>/photos/<topic>/<id>/<n>.jpg
and their credits in <build>/photos/<topic>/candidates.json. Someone then picks the best one
per item (tools/photo_picks.json) and tools/make_photos.py builds app/photos/<topic>.json.

Sources: iNaturalist (curated photos of each species, for animals, plants and mushrooms) and
Openverse (for objects, food, landscapes). Only CC0, public domain, CC BY and CC BY-SA.
Openverse allows 200 anonymous searches a day, so items already searched are skipped.
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "PikoloQuizBuilder/1.0 (https://github.com/BachmannAlexis/Quiz)"}
OK_LICENSES = {"cc0", "cc-by", "cc-by-sa", "pdm", "by", "by-sa"}
PER_ITEM = 6

# where to look, per topic: "inat" (species photos) or "openverse" with words added to the search
SOURCES = {
    "animals": ("inat", ""), "flowers": ("inat", ""), "trees": ("inat", ""), "mushrooms": ("inat", ""),
    "instruments": ("openverse", "musical instrument"), "kitchen": ("openverse", "kitchen"),
    "food": ("openverse", ""), "scenery": ("openverse", "landscape"), "dinosaurs": ("openverse", "dinosaur model"),
    "spices": ("openverse", ""),
}
# better searches for some items (iNaturalist: scientific names; Openverse: clearer words)
QUERY = {
    # animals
    "dog": "Canis familiaris", "cat": "Felis catus", "cow": "Bos taurus", "ox": "Bos taurus", "pig": "Sus scrofa domesticus",
    "horse": "Equus caballus", "donkey": "Equus asinus", "sheep": "Ovis aries", "ram": "Ovis aries", "goat": "Capra hircus",
    "hen": "Gallus gallus domesticus", "rooster": "Gallus gallus domesticus", "chick": "Gallus gallus domesticus",
    "duck": "Anas platyrhynchos", "goose": "Anser anser", "turkey": "Meleagris gallopavo", "rabbit": "Oryctolagus cuniculus",
    "mouse": "Mus musculus", "rat": "Rattus norvegicus", "hamster": "Mesocricetus auratus", "llama": "Lama glama",
    "lion": "Panthera leo", "tiger": "Panthera tigris", "elephant": "Loxodonta africana", "monkey": "Macaca",
    "gorilla": "Gorilla", "giraffe": "Giraffa", "zebra": "Equus quagga", "bear": "Ursus arctos", "polar-bear": "Ursus maritimus",
    "panda": "Ailuropoda melanoleuca", "koala": "Phascolarctos cinereus", "fox": "Vulpes vulpes", "wolf": "Canis lupus",
    "deer": "Cervus elaphus", "camel": "Camelus dromedarius", "hippo": "Hippopotamus amphibius", "rhino": "Ceratotherium simum",
    "kangaroo": "Macropus", "hedgehog": "Erinaceus europaeus", "sloth": "Bradypus", "bat": "Pipistrellus", "frog": "Rana",
    "toad": "Bufo bufo", "snake": "Serpentes", "crocodile": "Crocodylus", "turtle": "Testudines", "dolphin": "Tursiops truncatus",
    "whale": "Megaptera novaeangliae", "shark": "Carcharodon carcharias", "octopus": "Octopus vulgaris", "jellyfish": "Aurelia aurita",
    "crab": "Carcinus maenas", "fish": "Amphiprion ocellaris", "seal": "Phoca vitulina", "penguin": "Spheniscus demersus",
    "owl": "Strix aluco", "eagle": "Aquila chrysaetos", "parrot": "Ara macao", "flamingo": "Phoenicopterus roseus",
    "peacock": "Pavo cristatus", "swan": "Cygnus olor", "dove": "Streptopelia decaocto", "butterfly": "Papilio machaon",
    "bee": "Apis mellifera", "ladybug": "Coccinella septempunctata", "ant": "Formica rufa", "spider": "Araneus diadematus",
    "snail": "Cornu aspersum", "caterpillar": "Papilio machaon", "worm": "Lumbricus terrestris", "leopard": "Panthera pardus",
    "orangutan": "Pongo", "bison": "Bison bison", "moose": "Alces alces", "boar": "Sus scrofa", "raccoon": "Procyon lotor",
    "beaver": "Castor fiber", "otter": "Lutra lutra", "skunk": "Mephitis mephitis", "badger": "Meles meles",
    "lizard": "Lacerta agilis", "lobster": "Homarus gammarus", "shrimp": "Palaemon", "squid": "Loligo vulgaris",
    "pufferfish": "Tetraodontidae", "coral": "Acropora", "crow": "Corvus corone", "grasshopper": "Tettigonia viridissima",
    "beetle": "Lucanus cervus", "fly": "Musca domestica", "squirrel": "Sciurus vulgaris", "water-buffalo": "Bubalus bubalis",
    "poodle": "Canis familiaris", "cheetah": "Acinonyx jubatus", "mole": "Talpa europaea", "seagull": "Larus argentatus",
    "robin": "Erithacus rubecula", "blackbird": "Turdus merula", "woodpecker": "Picus viridis", "cuckoo": "Cuculus canorus",
    "ostrich": "Struthio camelus", "toucan": "Ramphastos toco", "hummingbird": "Trochilidae", "scorpion": "Scorpiones",
    "mosquito": "Culicidae",
    # flowers
    "rose": "Rosa", "poppy": "Papaver rhoeas", "tulip": "Tulipa", "sunflower": "Helianthus annuus", "daisy": "Bellis perennis",
    "dandelion": "Taraxacum officinale", "cherry-blossom": "Prunus serrulata", "hibiscus": "Hibiscus rosa-sinensis",
    "lotus": "Nelumbo nucifera", "lily": "Lilium candidum", "lavender": "Lavandula angustifolia", "hyacinth": "Hyacinthus orientalis",
    "bluebell": "Hyacinthoides non-scripta", "pansy": "Viola wittrockiana", "carnation": "Dianthus caryophyllus",
    "water-lily": "Nymphaea", "orchid": "Phalaenopsis", "iris": "Iris germanica", "daffodil": "Narcissus pseudonarcissus",
    "cornflower": "Centaurea cyanus", "forget-me-not": "Myosotis", "snowdrop": "Galanthus nivalis", "peony": "Paeonia lactiflora",
    "lilac": "Syringa vulgaris", "hydrangea": "Hydrangea macrophylla", "magnolia": "Magnolia soulangeana",
    "chrysanthemum": "Chrysanthemum morifolium", "geranium": "Pelargonium", "crocus": "Crocus vernus", "buttercup": "Ranunculus acris",
    "violet": "Viola odorata", "jasmine": "Jasminum officinale", "lily-of-the-valley": "Convallaria majalis",
    "edelweiss": "Leontopodium nivale", "dahlia": "Dahlia", "wisteria": "Wisteria sinensis",
    # trees
    "fir": "Abies alba", "christmas-tree": "Picea abies", "palm-tree": "Cocos nucifera", "oak": "Quercus robur",
    "apple-tree": "Malus domestica", "birch": "Betula pendula", "willow": "Salix babylonica", "maple": "Acer saccharum",
    "cherry-tree": "Prunus avium", "baobab": "Adansonia digitata", "olive-tree": "Olea europaea", "bamboo": "Phyllostachys",
    "pine": "Pinus sylvestris", "cypress": "Cupressus sempervirens", "sequoia": "Sequoiadendron giganteum",
    "chestnut-tree": "Aesculus hippocastanum", "orange-tree": "Citrus sinensis", "banana-tree": "Musa", "cactus": "Carnegiea gigantea",
    # mushrooms
    "fly-agaric": "Amanita muscaria", "death-cap": "Amanita phalloides", "button-mushroom": "Agaricus bisporus",
    "porcini": "Boletus edulis", "parasol-mushroom": "Macrolepiota procera", "chanterelle": "Cantharellus cibarius",
    "morel": "Morchella", "oyster-mushroom": "Pleurotus ostreatus", "puffball": "Lycoperdon perlatum",
    "shaggy-ink-cap": "Coprinus comatus", "black-trumpet": "Craterellus cornucopioides", "hedgehog-mushroom": "Hydnum repandum",
    "saffron-milk-cap": "Lactarius deliciosus", "bracket-fungus": "Fomes fomentarius", "bay-bolete": "Imleria badia",
    "orange-bolete": "Leccinum versipelle", "satans-bolete": "Rubroboletus satanas", "trumpet-chanterelle": "Craterellus tubaeformis",
    "field-mushroom": "Agaricus campestris", "panther-cap": "Amanita pantherina", "shiitake": "Lentinula edodes",
    "wood-blewit": "Lepista nuda", "chicken-of-the-woods": "Laetiporus sulphureus", "cauliflower-fungus": "Sparassis crispa",
    # Openverse words
    "drum-kit": "drum kit", "bell-pepper": "bell pepper vegetable", "corn": "corn on the cob", "peas": "green peas pod",
    "beans": "green beans", "lettuce": "lettuce head", "orange": "orange fruit", "lime": "lime fruit", "kiwi": "kiwi fruit",
    "olive": "olives", "apple": "red apple", "pepper": "black peppercorns", "salt": "salt shaker", "chili": "red chili pepper",
    "ginger": "ginger root", "cumin": "cumin seeds", "cloves": "cloves spice", "star-anise": "star anise", "saffron": "saffron threads",
    "paprika": "paprika powder", "turmeric": "turmeric root powder", "nutmeg": "nutmeg", "vanilla": "vanilla pods",
    "cinnamon": "cinnamon sticks", "basil": "basil herb", "parsley": "parsley", "coriander": "cilantro", "mint": "mint leaves",
    "sage": "sage herb", "thyme": "thyme herb", "oregano": "oregano herb", "rosemary": "rosemary herb", "tarragon": "tarragon herb",
    "dill": "dill herb", "chives": "chives", "bay-leaf": "bay leaves", "cooktop": "stove top", "hood": "range hood",
    "kitchen-scale": "kitchen scale", "waffle-iron": "waffle iron", "coffee-machine": "espresso machine", "knife": "kitchen knife",
    "starry-sky": "milky way night sky", "t-rex": "tyrannosaurus", "dinosaur-egg": "dinosaur egg fossil",
    "pipe-organ": "pipe organ", "music-box": "music box", "steel-drum": "steel pan drum", "jingle-bells": "sleigh bells",
}

def get(url, tries=6):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 500, 502, 503): raise
            wait = int(e.headers.get("Retry-After") or 0) or 15 * (attempt + 1)
            print(f"  {e.code}, waiting {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError("gave up: " + url)

def inat(item):
    q = QUERY.get(item["id"], item["en"])
    d = json.loads(get("https://api.inaturalist.org/v1/taxa?" + urllib.parse.urlencode({"q": q, "per_page": 5, "is_active": "true"})))
    if not d["results"]: return []
    taxon = d["results"][0]
    time.sleep(1)
    full = json.loads(get(f"https://api.inaturalist.org/v1/taxa/{taxon['id']}"))["results"][0]
    out = []
    for tp in full.get("taxon_photos", []):
        p = tp["photo"]
        if (p.get("license_code") or "") not in OK_LICENSES: continue
        url = (p.get("medium_url") or p["url"]).replace("/square.", "/medium.")
        out.append({"url": url, "license": p["license_code"], "author": p.get("attribution", ""),
                    "page": f"https://www.inaturalist.org/photos/{p['id']}", "title": full.get("name", "")})
    if len(out) < PER_ITEM:  # then the most liked observations with a free licence
        time.sleep(1)
        obs = json.loads(get("https://api.inaturalist.org/v1/observations?" + urllib.parse.urlencode({
            "taxon_id": taxon["id"], "photo_license": "cc0,cc-by,cc-by-sa", "quality_grade": "research",
            "order_by": "votes", "per_page": 20, "photos": "true"})))
        seen = {o["url"] for o in out}
        for o in obs["results"]:
            for p in o.get("photos", [])[:1]:
                if (p.get("license_code") or "") not in OK_LICENSES: continue
                url = p["url"].replace("/square.", "/medium.")
                if url in seen: continue
                out.append({"url": url, "license": p["license_code"], "author": p.get("attribution", ""),
                            "page": f"https://www.inaturalist.org/photos/{p['id']}", "title": full.get("name", "")})
    return out

def openverse(item, words):
    q = QUERY.get(item["id"]) or (item["en"] + (" " + words if words else ""))
    d = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(
        {"q": q, "license": "cc0,pdm,by,by-sa", "page_size": 12, "mature": "false"})))
    out = []
    for r in d["results"]:
        url = r["url"] if "wikimedia.org" not in r["url"] else r["thumbnail"]  # Commons limits downloads
        out.append({"url": url, "license": r["license"], "author": r.get("creator") or "", "page": r["foreign_landing_url"],
                    "title": r.get("title") or "", "source": r.get("source")})
    return out

def main(build, topics):
    import subprocess
    tops = json.loads(subprocess.run(["node", "-e", """
const vm=require('vm');const fs=require('fs');vm.runInThisContext(fs.readFileSync(process.argv[1],'utf8')+';globalThis.T_=TOPICS');
console.log(JSON.stringify(T_.map(t=>({id:t.id,items:t.items.map(i=>({id:i.id,en:i.en}))}))))""",
                                       os.path.join(ROOT, "app", "topics.js")], capture_output=True, text=True, check=True).stdout)
    for t in tops:
        if t["id"] not in SOURCES or (topics and t["id"] not in topics): continue
        kind, words = SOURCES[t["id"]]
        base = os.path.join(build, "photos", t["id"])
        os.makedirs(base, exist_ok=True)
        cand_path = os.path.join(base, "candidates.json")
        cands = json.load(open(cand_path)) if os.path.exists(cand_path) else {}
        for item in t["items"]:
            if cands.get(item["id"]): continue
            try:
                found = inat(item) if kind == "inat" else openverse(item, words)
            except Exception as e:
                print("  search failed:", item["id"], e, flush=True); continue
            kept = []
            for c in found:
                if len(kept) >= PER_ITEM: break
                path = os.path.join(base, item["id"], f"{len(kept)}.jpg")
                os.makedirs(os.path.dirname(path), exist_ok=True)
                try:
                    data = get(c["url"], tries=2)
                except Exception as e:
                    continue
                open(path, "wb").write(data)
                kept.append({**c, "file": os.path.relpath(path, base)})
            cands[item["id"]] = kept
            json.dump(cands, open(cand_path, "w"), indent=1, ensure_ascii=False)
            print(f"{t['id']:10s} {item['id']:22s} {len(kept)}", flush=True)
            time.sleep(1 if kind == "inat" else 3.2)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
