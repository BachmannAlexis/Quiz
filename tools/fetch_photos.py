#!/usr/bin/env python3
"""Download candidate photos for the photo mode, with their licences.

Usage: python3 tools/fetch_photos.py <build dir> [topic ...] [--retry]
--retry searches again with the words in RETRY and adds those candidates after the first ones.
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
    "spices": ("openverse", ""), "sports": ("openverse", ""),
    "transport": ("openverse", ""), "weather": ("openverse", ""), "clothes": ("openverse", ""),
    "dishes": ("openverse", ""), "countries": ("openverse", ""),
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
    "kangaroo": "Macropus", "hedgehog": "Erinaceus europaeus", "sloth": "Bradypus", "bat": "Pipistrellus", "frog": "Pelophylax ridibundus",
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
    # sports (Openverse): the sport in action, or its gear
    "soccer": "soccer match ball", "basketball": "basketball game hoop", "rugby": "rugby match", "tennis": "tennis player court",
    "volleyball": "volleyball game", "baseball": "baseball batter", "ping-pong": "table tennis", "badminton": "badminton shuttlecock",
    "golf": "golf ball green flag", "hockey": "ice hockey game", "skiing": "skier slope", "snowboarding": "snowboarder",
    "skating": "ice skating rink", "sledding": "children sledding snow", "swimming": "swimming pool swimmer",
    "diving": "scuba diver coral", "surfing": "surfer wave", "sailing": "sailboat regatta", "canoeing": "canoe river",
    "cycling": "cyclist bicycle road", "running": "runner race", "horse-riding": "horse riding rider",
    "gymnastics": "gymnast", "climbing": "rock climbing", "boxing": "boxing gloves", "judo": "judo match",
    "fencing": "fencing sport", "archery": "archery bow target", "skateboarding": "skateboarder", "roller-skating": "roller skates",
    # transport, weather, clothes (Openverse)
    "car": "red car", "racing-car": "formula racing car", "taxi": "yellow taxi cab", "police-car": "police car",
    "ambulance": "ambulance vehicle", "fire-engine": "fire engine truck", "bus": "city bus", "truck": "lorry truck",
    "tractor": "farm tractor", "motorcycle": "motorcycle", "scooter": "vespa scooter", "bicycle": "bicycle",
    "kick-scooter": "kick scooter", "train": "steam locomotive", "high-speed-train": "TGV high speed train", "tram": "tram streetcar",
    "metro": "metro train station", "cable-car": "cable car gondola mountain", "airplane": "airliner airplane sky",
    "helicopter": "helicopter flying", "rocket": "rocket launch", "flying-saucer": "flying saucer", "ship": "cruise ship",
    "sailboat": "sailboat", "speedboat": "speedboat",
    "sun": "sun sky", "cloudy": "clouds sun sky", "cloud": "white cloud blue sky", "rain": "rain drops", "umbrella": "umbrella rain",
    "storm": "thunderstorm clouds", "lightning": "lightning bolt", "wind": "wind trees blowing", "tornado": "tornado",
    "snowing": "snowfall", "snowman": "snowman", "fog": "fog landscape", "thermometer": "thermometer", "moon": "crescent moon",
    "star": "stars night sky",
    "t-shirt": "t-shirt", "blouse": "blouse", "dress": "dress", "kimono": "kimono", "jeans": "jeans", "shorts": "shorts",
    "coat": "winter coat", "scarf": "knitted scarf", "gloves": "wool gloves", "socks": "colorful socks", "swimsuit": "swimsuit",
    "cap": "baseball cap", "top-hat": "top hat", "sun-hat": "straw hat", "crown": "crown", "glasses": "eyeglasses",
    "tie": "necktie", "sneakers": "sneakers", "shoes": "leather shoes", "boots": "rain boots", "hiking-boots": "hiking boots",
    "sandals": "sandals", "flip-flops": "flip flops", "ballet-shoes": "ballet shoes", "backpack": "backpack", "handbag": "handbag",
    # dishes and countries (a famous landmark of each)
    "pizza": "pizza margherita", "hamburger": "hamburger", "hot-dog": "hot dog", "sandwich": "sandwich", "fries": "french fries",
    "spaghetti": "spaghetti tomato sauce", "noodle-soup": "ramen bowl", "soup": "vegetable soup bowl", "salad": "mixed salad bowl",
    "rice": "bowl of rice", "curry": "curry rice", "paella": "paella", "sushi": "sushi", "dumplings": "dumplings", "taco": "tacos",
    "burrito": "burrito", "kebab": "kebab wrap", "falafel": "falafel", "fried-egg": "fried egg", "chicken": "roast chicken",
    "fondue": "cheese fondue", "cheese": "cheese platter", "bread": "baguette bread", "croissant": "croissant", "pancakes": "crepes",
    "waffle": "waffle", "birthday-cake": "birthday cake candles", "cake": "slice of cake", "cupcake": "cupcake", "pie": "fruit tart",
    "custard": "flan caramel", "doughnut": "doughnut", "cookie": "cookies", "chocolate": "chocolate bar", "ice-cream": "ice cream cone",
    "candy": "candy sweets", "lollipop": "lollipop", "honey": "honey jar", "popcorn": "popcorn",
    "france": "eiffel tower", "belgium": "atomium brussels", "switzerland": "matterhorn", "italy": "colosseum rome",
    "spain": "sagrada familia", "portugal": "belem tower lisbon", "germany": "brandenburg gate", "united-kingdom": "big ben london",
    "ireland": "cliffs of moher", "netherlands": "windmills kinderdijk", "greece": "parthenon athens", "canada": "moraine lake canada",
    "united-states": "statue of liberty", "mexico": "chichen itza", "brazil": "christ the redeemer rio", "argentina": "iguazu falls",
    "china": "great wall of china", "japan": "mount fuji", "south-korea": "gyeongbokgung palace", "india": "taj mahal",
    "australia": "sydney opera house", "egypt": "pyramids giza", "morocco": "marrakech koutoubia", "senegal": "dakar senegal",
    "kenya": "kenya masai mara",
    "blanquette": "blanquette de veau", "pot-au-feu": "pot-au-feu", "tartiflette": "tartiflette", "coq-au-vin": "coq au vin",
    "hachis-parmentier": "hachis parmentier", "salade-nicoise": "salade nicoise", "aligot": "aligot", "escargots": "escargots",
    "tarte-flambee": "flammekueche", "steak-frites": "steak frites", "kouign-amann": "kouign amann", "caneles": "canneles",
    "paris-brest": "paris-brest", "mille-feuille": "mille-feuille", "far-breton": "far breton", "ile-flottante": "ile flottante",
    "baba-au-rhum": "baba au rhum", "schnitzel": "wiener schnitzel", "pretzel": "pretzel", "currywurst": "currywurst",
    "black-forest-cake": "black forest cake", "kanelbulle": "kanelbulle", "swedish-meatballs": "swedish meatballs",
    "pastel-de-nata": "pastel de nata", "irish-stew": "irish stew", "english-breakfast": "full english breakfast",
    "borscht": "borscht", "pelmeni": "pelmeni", "blini": "blini caviar", "khachapuri": "khachapuri", "stroopwafel": "stroopwafel",
    "gnocchi": "gnocchi", "minestrone": "minestrone", "mac-and-cheese": "mac and cheese", "brigadeiro": "brigadeiro",
    "arepas": "arepas", "tamales": "tamales", "nachos": "nachos", "tempura": "tempura", "onigiri": "onigiri", "kimchi": "kimchi",
    "nasi-goreng": "nasi goreng", "satay": "satay", "tom-yum": "tom yum", "dal": "dal lentils", "naan": "naan bread",
    "shakshuka": "shakshuka", "tabbouleh": "tabbouleh", "dolma": "dolma", "thieboudienne": "thieboudienne", "attieke": "attieke",
    "bobotie": "bobotie", "fufu": "fufu", "pavlova": "pavlova", "lamington": "lamington", "plov": "plov",
    "quiche": "quiche lorraine", "ratatouille": "ratatouille", "croque-monsieur": "croque monsieur", "gratin": "gratin dauphinois",
    "cassoulet": "cassoulet", "bouillabaisse": "bouillabaisse", "boeuf-bourguignon": "boeuf bourguignon", "raclette": "raclette cheese",
    "onion-soup": "french onion soup", "moules-frites": "moules frites", "choucroute": "choucroute garnie", "tarte-tatin": "tarte tatin",
    "macarons": "macarons", "eclair": "chocolate eclair", "madeleines": "madeleines", "creme-brulee": "creme brulee",
    "chocolate-mousse": "chocolate mousse", "galette-des-rois": "galette des rois", "pain-au-chocolat": "pain au chocolat",
    "profiteroles": "profiteroles", "clafoutis": "cherry clafoutis", "couscous": "couscous vegetables", "tajine": "tagine",
    "lasagna": "lasagna", "risotto": "risotto", "tiramisu": "tiramisu", "pho": "pho soup", "spring-rolls": "spring rolls",
    "pad-thai": "pad thai", "bibimbap": "bibimbap", "samosa": "samosa", "biryani": "biryani", "guacamole": "guacamole",
    "chili-con-carne": "chili con carne", "empanadas": "empanadas", "feijoada": "feijoada", "poutine": "poutine",
    "fish-and-chips": "fish and chips", "moussaka": "moussaka", "greek-salad": "greek salad", "hummus": "hummus",
    "baklava": "baklava", "churros": "churros", "gazpacho": "gazpacho", "strudel": "apple strudel", "pierogi": "pierogi",
    "goulash": "goulash", "mafe": "mafe peanut stew", "yassa": "chicken yassa", "jollof-rice": "jollof rice", "injera": "injera",
    "peking-duck": "peking duck", "mochi": "mochi", "ceviche": "ceviche",
    "austria": "schonbrunn palace", "poland": "krakow main square", "sweden": "stockholm gamla stan", "norway": "geirangerfjord",
    "denmark": "nyhavn copenhagen", "finland": "helsinki cathedral", "iceland": "skogafoss", "croatia": "dubrovnik old town",
    "turkiye": "cappadocia balloons", "hungary": "budapest parliament", "peru": "machu picchu", "chile": "torres del paine",
    "colombia": "cartagena colombia", "cuba": "havana old cars", "lebanon": "baalbek", "thailand": "wat arun bangkok",
    "vietnam": "ha long bay", "indonesia": "borobudur", "nepal": "mount everest", "new-zealand": "milford sound",
    "algeria": "sahara dunes algeria", "tunisia": "sidi bou said", "south-africa": "table mountain cape town",
    "nigeria": "zuma rock", "ivory-coast": "basilica yamoussoukro", "cameroon": "mount cameroon",
    "madagascar": "avenue of the baobabs", "ethiopia": "lalibela church",
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

# second searches, for items whose first candidates were all unusable: (source, query)
RETRY = {
    "animals": {
        "cow": [("openverse", "holstein cow meadow"), ("openverse", "dairy cow grazing")],
        "camel": [("openverse", "dromedary camel desert"), ("inat", "Camelus dromedarius")],
        "goat": [("openverse", "goat farm animal"), ("openverse", "white goat")],
        "goose": [("openverse", "domestic goose"), ("openverse", "greylag goose")],
        "bison": [("inat", "Bison bison"), ("openverse", "american bison")],
        "mole": [("openverse", "european mole animal"), ("openverse", "mole talpa")],
    },
    "dinosaurs": {
        "velociraptor": [("openverse", "velociraptor model museum"), ("openverse", "velociraptor sculpture")],
        "spinosaurus": [("openverse", "spinosaurus model"), ("openverse", "spinosaurus skeleton museum"), ("openverse", "spinosaurus")],
        "pterodactyl": [("openverse", "pteranodon model museum"), ("openverse", "pterosaur skeleton")],
        "plesiosaurus": [("openverse", "plesiosaur model"), ("openverse", "plesiosaurus skeleton")],
        "mammoth": [("openverse", "woolly mammoth model"), ("openverse", "mammoth skeleton museum")],
    },
    "food": {
        "banana": [("openverse", "bunch of yellow bananas"), ("openverse", "bananas fruit")],
        "pear": [("openverse", "pear fruit"), ("openverse", "green pears")],
        "pineapple": [("openverse", "pineapple fruit"), ("openverse", "whole pineapple")],
        "eggplant": [("openverse", "eggplants"), ("inat", "Solanum melongena")],
        "melon": [("openverse", "honeydew melon"), ("openverse", "melon fruit cut")],
        "sweet-potato": [("openverse", "sweet potato tubers"), ("openverse", "raw sweet potatoes")],
    },
    "instruments": {k: [("openverse", a), ("openverse", b)] for k, (a, b) in {
        "bass-drum": ("bass drum marching band", "concert bass drum"),
        "castanets": ("castanets percussion instrument", "spanish castanets"),
        "cymbals": ("cymbals instrument", "hand cymbals"),
        "horn": ("french horn instrument", "horn player orchestra"),
        "oboe": ("oboe instrument", "oboist"),
        "tambourine": ("tambourine instrument", "tambourine jingles"),
        "triangle": ("triangle musical instrument", "orchestral triangle"),
        "tuba": ("tuba instrument", "tuba player"),
        "whistle": ("tin whistle instrument", "penny whistle"),
        "xylophone": ("xylophone instrument", "xylophone mallets"),
    }.items()},
    "kitchen": {"dishwasher": [("openverse", "dishwasher appliance"), ("openverse", "dishwasher open rack plates")]},
}
# last tries for the instruments still without a usable photo
for _k, _q in {"horn": "french horn", "oboe": "oboe reed instrument", "triangle": "triangle percussion",
               "tuba": "tuba brass", "whistle": "referee whistle"}.items():
    RETRY["instruments"][_k].append(("openverse", _q))
RETRY.update({
    "spices": {
        "cloves": [("openverse", "cloves spice whole"), ("openverse", "clove buds dried")],
        "dill": [("inat", "Anethum graveolens"), ("openverse", "dill herb fresh")],
        "oregano": [("inat", "Origanum vulgare"), ("openverse", "oregano leaves")],
        "saffron": [("inat", "Crocus sativus"), ("openverse", "saffron threads")],
    },
})

# fourth round, from the review page flags
for _t, _i, _qs in [
    ("animals", "bison", ["bison grazing", "american bison prairie"]),
    ("animals", "goose", ["white goose farm", "goose walking grass"]),
    ("dinosaurs", "plesiosaurus", ["plesiosaurus model long neck", "elasmosaurus model"]),
    ("instruments", "bass-guitar", ["bass guitar", "electric bass guitar four strings"]),
    ("instruments", "guitar", ["acoustic guitar", "classical guitar"]),
    ("instruments", "shamisen", ["shamisen", "shamisen japanese instrument"]),
    ("instruments", "horn", ["horn instrument brass coiled", "french horn musician"]),
    ("instruments", "triangle", ["triangle instrument beater", "percussion triangle"]),
    ("instruments", "whistle", ["metal whistle", "sports whistle"]),
]:
    RETRY.setdefault(_t, {}).setdefault(_i, [])
    if isinstance(RETRY[_t][_i], tuple): RETRY[_t][_i] = [RETRY[_t][_i]]
    RETRY[_t][_i] += [("openverse", q) for q in _qs]

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

def inat(item, q=None):
    q = q or QUERY.get(item["id"], item["en"])
    d = json.loads(get("https://api.inaturalist.org/v1/taxa?" + urllib.parse.urlencode({"q": q, "per_page": 5, "is_active": "true"})))
    if not d["results"]: return []
    exact = [t for t in d["results"] if t["name"].lower() == q.lower()]
    taxon = (exact or d["results"])[0]
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

def openverse(item, words, q=None):
    q = q or QUERY.get(item["id"]) or (item["en"] + (" " + words if words else ""))
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
            searches = [(kind, None)]
            if "--retry" in sys.argv:
                r = RETRY.get(t["id"], {}).get(item["id"])
                searches = [] if r is None else ([r] if isinstance(r, tuple) else r)
            elif cands.get(item["id"]):
                continue
            for src, q in searches:
                have = cands.get(item["id"], [])
                if q and any(c.get("query") == q for c in have): continue  # this search was done already
                try:
                    found = inat(item, q) if src == "inat" else openverse(item, "" if q else words, q)
                except Exception as e:
                    print("  search failed:", item["id"], e, flush=True); continue
                old = have if q else []
                seen = {c["url"] for c in old}
                kept = []
                for c in found:
                    if len(kept) >= PER_ITEM: break
                    if c["url"] in seen: continue
                    path = os.path.join(base, item["id"], f"{len(old) + len(kept)}.jpg")
                    os.makedirs(os.path.dirname(path), exist_ok=True)
                    try:
                        data = get(c["url"], tries=2)
                    except Exception as e:
                        continue
                    open(path, "wb").write(data)
                    kept.append({**c, "file": os.path.relpath(path, base), **({"retry": True, "query": q} if q else {})})
                cands[item["id"]] = old + kept
                json.dump(cands, open(cand_path, "w"), indent=1, ensure_ascii=False)
                print(f"{t['id']:10s} {item['id']:22s} {len(kept)}  {q or ''}", flush=True)
                time.sleep(1 if src == "inat" else 3.2)

if __name__ == "__main__":
    main(sys.argv[1], [a for a in sys.argv[2:] if not a.startswith("--")])
