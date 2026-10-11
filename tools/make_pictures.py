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
    # kitchen
    "teapot": "teapot", "spoon": "spoon", "knife": "kitchen-knife", "bowl": "bowl-with-spoon", "jar": "jar",
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
