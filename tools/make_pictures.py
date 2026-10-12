#!/usr/bin/env python3
"""Build pictures.js: instrument pictures as SVG data URIs.

Usage: python3 tools/make_pictures.py <@iconify-json/noto icons.json>
Pictures from Noto Emoji (Apache-2.0) per NOTO below; the others are drawn for this project in pictures/. Get icons.json with: npm pack @iconify-json/noto && tar xzf iconify-json-noto-*.tgz
"""
import json, os, sys, urllib.parse

NOTO = {
    # instruments
    "violin": "violin", "harp": "harp", "flute": "flute", "horn": "postal-horn", "trumpet": "trumpet",
    "trombone": "trombone", "drum": "drum", "bell": "bell", "piano": "musical-keyboard", "saxophone": "saxophone",
    "electric-guitar": "guitar", "accordion": "accordion", "banjo": "banjo", "maracas": "maracas", "djembe": "long-drum",
    # animals
    "dog": "dog", "cat": "cat", "cow": "cow", "pig": "pig", "horse": "horse", "sheep": "ewe", "goat": "goat",
    "hen": "chicken", "rooster": "rooster", "duck": "duck", "donkey": "donkey", "rabbit": "rabbit", "turkey": "turkey",
    "lion": "lion", "tiger": "tiger", "elephant": "elephant", "monkey": "monkey", "gorilla": "gorilla", "giraffe": "giraffe",
    "zebra": "zebra", "bear": "bear", "polar-bear": "polar-bear", "panda": "panda", "koala": "koala", "fox": "fox",
    "wolf": "wolf", "deer": "deer", "camel": "camel", "hippo": "hippopotamus", "rhino": "rhinoceros", "kangaroo": "kangaroo",
    "hedgehog": "hedgehog", "sloth": "sloth", "mouse": "mouse", "frog": "frog", "snake": "snake", "turtle": "turtle",
    "crocodile": "crocodile", "bat": "bat", "dolphin": "dolphin", "whale": "spouting-whale", "shark": "shark",
    "octopus": "octopus", "crab": "crab", "fish": "tropical-fish", "seal": "seal", "jellyfish": "jellyfish",
    "owl": "owl", "eagle": "eagle", "parrot": "parrot", "flamingo": "flamingo", "peacock": "peacock", "penguin": "penguin",
    "swan": "swan", "dove": "dove", "butterfly": "butterfly", "bee": "honeybee", "ladybug": "lady-beetle", "snail": "snail",
    "ant": "ant", "spider": "spider", "caterpillar": "bug", "worm": "worm",
    "chick": "baby-chick", "goose": "goose", "llama": "llama", "hamster": "hamster", "leopard": "leopard",
    "orangutan": "orangutan", "bison": "bison", "moose": "moose", "boar": "boar", "raccoon": "raccoon", "beaver": "beaver",
    "otter": "otter", "skunk": "skunk", "badger": "badger", "lizard": "lizard", "lobster": "lobster", "shrimp": "shrimp",
    "squid": "squid", "pufferfish": "blowfish", "coral": "coral", "crow": "black-bird", "grasshopper": "cricket",
    "beetle": "beetle", "fly": "fly", "squirrel": "chipmunk", "rat": "rat", "ox": "ox", "water-buffalo": "water-buffalo",
    "ram": "ram", "poodle": "poodle", "scorpion": "scorpion", "mosquito": "mosquito",
    # fruits and vegetables
    "apple": "red-apple", "pear": "pear", "orange": "tangerine", "lemon": "lemon", "lime": "lime", "banana": "banana",
    "watermelon": "watermelon", "melon": "melon", "grapes": "grapes", "strawberry": "strawberry",
    "blueberries": "blueberries", "cherries": "cherries", "peach": "peach", "mango": "mango", "pineapple": "pineapple",
    "coconut": "coconut", "kiwi": "kiwi-fruit", "chestnut": "chestnut", "olive": "olive", "tomato": "tomato",
    "eggplant": "eggplant", "cucumber": "cucumber", "avocado": "avocado", "broccoli": "broccoli", "lettuce": "leafy-green",
    "bell-pepper": "bell-pepper", "corn": "ear-of-corn", "carrot": "carrot", "potato": "potato",
    "sweet-potato": "roasted-sweet-potato", "onion": "onion", "garlic": "garlic", "peas": "pea-pod", "beans": "beans",
    # herbs and spices
    "salt": "salt", "chili": "hot-pepper", "ginger": "ginger-root",
    # the body
    "eye": "eye", "ear": "ear", "nose": "nose", "mouth": "mouth", "tongue": "tongue", "tooth": "tooth",
    "arm": "flexed-biceps", "hand": "hand-with-fingers-splayed", "finger": "index-pointing-up", "thumb": "thumbs-up",
    "leg": "leg", "foot": "foot", "heart": "anatomical-heart", "brain": "brain", "lungs": "lungs", "bone": "bone",
    # sports
    "soccer": "soccer-ball", "basketball": "basketball", "rugby": "rugby-football", "tennis": "tennis",
    "volleyball": "volleyball", "baseball": "baseball", "ping-pong": "ping-pong", "badminton": "badminton",
    "golf": "flag-in-hole", "hockey": "ice-hockey", "skiing": "skier", "snowboarding": "snowboarder",
    "skating": "ice-skate", "sledding": "sled", "swimming": "person-swimming", "diving": "diving-mask",
    "surfing": "person-surfing", "sailing": "sailboat", "canoeing": "canoe", "cycling": "person-biking",
    "running": "person-running", "horse-riding": "horse-racing", "gymnastics": "person-cartwheeling",
    "climbing": "person-climbing", "boxing": "boxing-glove", "judo": "martial-arts-uniform", "fencing": "person-fencing",
    "archery": "bow-and-arrow", "skateboarding": "skateboard", "roller-skating": "roller-skate",
    "american-football": "american-football", "bowling": "bowling", "handball": "person-playing-handball",
    "cricket-sport": "cricket-game", "field-hockey": "field-hockey", "billiards": "pool-8-ball", "frisbee": "flying-disc",
    "curling": "curling-stone", "water-polo": "person-playing-water-polo", "rowing": "person-rowing-boat",
    "weightlifting": "person-lifting-weights", "mountain-biking": "person-mountain-biking", "yoga": "person-in-lotus-position",
    "lacrosse": "lacrosse", "softball": "softball", "wrestling": "people-wrestling", "fishing": "fishing-pole",
    "cross-country-skiing": "skis", "juggling": "person-juggling",
    # transport
    "car": "automobile", "racing-car": "racing-car", "taxi": "taxi", "police-car": "police-car", "ambulance": "ambulance",
    "fire-engine": "fire-engine", "bus": "bus", "truck": "delivery-truck", "tractor": "tractor", "motorcycle": "motorcycle",
    "scooter": "motor-scooter", "bicycle": "bicycle", "kick-scooter": "kick-scooter", "train": "locomotive",
    "high-speed-train": "high-speed-train", "tram": "tram", "metro": "metro", "cable-car": "aerial-tramway",
    "airplane": "airplane", "helicopter": "helicopter", "rocket": "rocket", "flying-saucer": "flying-saucer",
    "ship": "ship", "sailboat": "sailboat", "speedboat": "speedboat",
    "minibus": "minibus", "trolleybus": "trolleybus", "suv": "sport-utility-vehicle", "pickup-truck": "pickup-truck",
    "lorry": "articulated-lorry", "tuk-tuk": "auto-rickshaw", "railway-car": "railway-car", "mountain-railway": "mountain-railway",
    "monorail": "monorail", "gondola": "mountain-cableway", "small-airplane": "small-airplane", "parachute": "parachute",
    "ferry": "ferry",
    # weather
    "sun": "sun", "cloudy": "sun-behind-cloud", "cloud": "cloud", "rain": "cloud-with-rain", "umbrella": "umbrella-with-rain-drops",
    "storm": "cloud-with-lightning-and-rain", "lightning": "high-voltage", "wind": "wind-face", "tornado": "tornado",
    "snowing": "cloud-with-snow", "snowman": "snowman", "fog": "fog", "thermometer": "thermometer", "moon": "crescent-moon",
    "star": "star", "snowflake": "snowflake", "sun-shower": "sun-behind-rain-cloud", "raindrop": "droplet",
    # clothes
    "t-shirt": "t-shirt", "blouse": "womans-clothes", "dress": "dress", "kimono": "kimono", "jeans": "jeans", "shorts": "shorts",
    "coat": "coat", "scarf": "scarf", "gloves": "gloves", "socks": "socks", "swimsuit": "one-piece-swimsuit", "cap": "billed-cap",
    "top-hat": "top-hat", "sun-hat": "womans-hat", "crown": "crown", "glasses": "glasses", "tie": "necktie",
    "sneakers": "running-shoe", "shoes": "mans-shoe", "boots": "womans-boot", "hiking-boots": "hiking-boot",
    "sandals": "womans-sandal", "flip-flops": "thong-sandal", "ballet-shoes": "ballet-shoes", "backpack": "backpack",
    "handbag": "handbag", "lab-coat": "lab-coat", "sari": "sari", "bikini": "bikini", "underpants": "briefs",
    "graduation-cap": "graduation-cap", "helmet": "rescue-workers-helmet", "high-heels": "high-heeled-shoe",
    "flat-shoes": "flat-shoe", "sunglasses": "sunglasses", "goggles": "goggles", "ring": "ring", "safety-vest": "safety-vest",
    "purse": "purse",
    # jobs
    "firefighter": "firefighter", "police-officer": "police-officer", "doctor": "health-worker", "cook": "cook",
    "farmer": "farmer", "teacher": "teacher", "astronaut": "astronaut", "pilot": "pilot", "mechanic": "mechanic",
    "builder": "construction-worker", "painter": "artist", "singer": "singer", "scientist": "scientist", "judge": "judge",
    "detective": "detective", "nurse": "woman-health-worker", "office-worker": "office-worker", "programmer": "technologist",
    "factory-worker": "factory-worker", "guard": "guard", "dancer": "ballet-dancer",
    # dishes
    "pizza": "pizza", "hamburger": "hamburger", "hot-dog": "hot-dog", "sandwich": "sandwich", "fries": "french-fries",
    "spaghetti": "spaghetti", "noodle-soup": "steaming-bowl", "soup": "pot-of-food", "salad": "green-salad", "rice": "cooked-rice",
    "curry": "curry-rice", "paella": "shallow-pan-of-food", "sushi": "sushi", "dumplings": "dumpling", "taco": "taco",
    "burrito": "burrito", "kebab": "stuffed-flatbread", "falafel": "falafel", "fried-egg": "cooking", "chicken": "poultry-leg",
    "fondue": "fondue", "cheese": "cheese-wedge", "bread": "baguette-bread", "croissant": "croissant", "pancakes": "pancakes",
    "waffle": "waffle", "birthday-cake": "birthday-cake", "cake": "shortcake", "cupcake": "cupcake", "pie": "pie",
    "custard": "custard", "doughnut": "doughnut", "cookie": "cookie", "chocolate": "chocolate-bar", "ice-cream": "ice-cream",
    "candy": "candy", "lollipop": "lollipop", "honey": "honey-pot", "popcorn": "popcorn",
    # kitchen
    "teapot": "teapot", "spoon": "spoon", "knife": "kitchen-knife", "bowl": "bowl-with-spoon", "jar": "jar",
    "mug": "hot-beverage", "cutlery": "fork-and-knife", "chopsticks": "chopsticks",
    # flowers
    "rose": "rose", "tulip": "tulip", "sunflower": "sunflower", "cherry-blossom": "cherry-blossom", "hibiscus": "hibiscus",
    "lotus": "lotus", "hyacinth": "hyacinth",
    # trees
    "fir": "evergreen-tree", "christmas-tree": "christmas-tree", "palm-tree": "palm-tree", "cactus": "cactus",
    # mushrooms
    "fly-agaric": "mushroom", "porcini": "brown-mushroom",
    # scenery
    "mountain": "snow-capped-mountain", "beach": "beach-with-umbrella", "desert": "desert", "island": "desert-island",
    "volcano": "volcano", "river": "national-park", "wave": "water-wave", "starry-sky": "milky-way", "city": "cityscape",
    "rainbow": "rainbow", "sunset": "sunrise", "campsite": "camping",
    # dinosaurs
    "t-rex": "t-rex", "diplodocus": "sauropod", "mammoth": "mammoth",
}

def data_uri(svg):
    return "data:image/svg+xml," + urllib.parse.quote(" ".join(svg.split()), safe=" =:/;,'()<>.-")

def main(icons_json):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    d = json.load(open(icons_json))
    pics = {}
    for quiz_id, name in NOTO.items():
        icon = d["icons"][name]
        w, h = icon.get("width", d.get("width", 16)), icon.get("height", d.get("height", 16))
        pics[quiz_id] = data_uri(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{icon["body"]}</svg>')
    for f in sorted(os.listdir(os.path.join(root, "pictures"))):
        if f.endswith(".svg"):
            pics[f[:-4]] = data_uri(open(os.path.join(root, "pictures", f)).read())
    with open(os.path.join(root, "app", "pictures.js"), "w") as f:
        f.write("// Generated by tools/make_pictures.py — Noto Emoji (Apache-2.0) + pictures/*.svg\n")
        f.write("window.INSTRUMENT_PICTURES = " + json.dumps(dict(sorted(pics.items())), indent=1) + ";\n")

if __name__ == "__main__":
    main(sys.argv[1])
