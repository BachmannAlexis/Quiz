// Difficulty levels for the game (easy: common words to start with; hard: rare ones). Items not listed are medium.
// Easy shows only easy items, medium adds the medium ones, hard shows everything.
const LEVELS = {
  animals: {
    easy: ["dog", "cat", "cow", "pig", "horse", "sheep", "hen", "duck", "rabbit", "mouse", "lion", "tiger",
      "elephant", "monkey", "giraffe", "zebra", "bear", "panda", "fox", "frog", "snake", "crocodile", "turtle",
      "dolphin", "whale", "fish", "crab", "penguin", "owl", "butterfly", "bee", "ladybug", "snail", "spider", "chick"],
    hard: ["sloth", "orangutan", "bison", "moose", "boar", "raccoon", "beaver", "otter", "skunk", "badger", "squid",
      "pufferfish", "coral", "grasshopper", "beetle", "ox", "water-buffalo", "ram", "poodle", "cheetah", "leopard",
      "mole", "toad", "seagull", "robin", "blackbird", "woodpecker", "cuckoo", "hummingbird", "scorpion", "mosquito"],
  },
  instruments: {
    easy: ["violin", "guitar", "piano", "drum", "trumpet", "flute", "recorder", "harp", "xylophone", "bell",
      "triangle", "maracas", "tambourine", "accordion", "harmonica", "saxophone"],
    hard: ["double-bass", "bass-guitar", "sitar", "shamisen", "koto", "oboe", "bassoon", "pan-flute", "ocarina",
      "timpani", "taiko", "tabla", "glockenspiel", "kalimba", "steel-drum", "cowbell", "claves", "guiro", "woodblock"],
  },
  dinosaurs: {
    easy: ["t-rex", "triceratops", "stegosaurus", "diplodocus", "brachiosaurus", "pterodactyl", "mammoth", "dinosaur-egg"],
    hard: ["parasaurolophus", "pachycephalosaurus", "iguanodon", "dimetrodon", "ichthyosaurus", "archaeopteryx"],
  },
  flowers: {
    easy: ["rose", "poppy", "tulip", "sunflower", "daisy", "dandelion", "cherry-blossom", "lavender", "water-lily",
      "daffodil", "buttercup"],
    hard: ["hibiscus", "hyacinth", "cornflower", "forget-me-not", "snowdrop", "magnolia", "chrysanthemum", "crocus",
      "jasmine", "edelweiss", "dahlia", "wisteria"],
  },
  trees: {
    easy: ["fir", "christmas-tree", "palm-tree", "oak", "apple-tree", "cherry-tree", "orange-tree", "banana-tree", "cactus"],
    hard: ["cypress", "sequoia", "beech", "linden", "poplar", "plane-tree", "cedar", "eucalyptus", "ginkgo"],
  },
  mushrooms: {
    easy: ["fly-agaric", "button-mushroom", "field-mushroom", "porcini", "chanterelle", "oyster-mushroom", "puffball", "shiitake"],
    hard: ["death-cap", "saffron-milk-cap", "bay-bolete", "orange-bolete", "satans-bolete", "trumpet-chanterelle",
      "panther-cap", "wood-blewit", "cauliflower-fungus"],
  },
  food: {
    easy: ["apple", "pear", "orange", "lemon", "banana", "watermelon", "grapes", "strawberry", "cherries", "tomato",
      "carrot", "potato", "corn", "peas", "pumpkin"],
    hard: ["lime", "plum", "chestnut", "olive", "eggplant", "radish", "beetroot", "sweet-potato", "garlic", "leek",
      "artichoke", "asparagus"],
  },
  herbs: {
    easy: ["basil", "parsley", "coriander", "mint", "thyme", "rosemary", "chives", "bay-leaf"],
    hard: ["chervil", "marjoram", "lemon-balm", "sorrel", "savory", "wild-garlic", "curry-leaves"],
  },
  spices: {
    easy: ["salt", "pepper", "cinnamon", "vanilla", "chili", "ginger", "sesame", "licorice"],
    hard: ["star-anise", "turmeric", "cardamom", "juniper", "poppy-seeds", "sumac", "caraway"],
  },
  kitchen: {
    easy: ["fridge", "oven", "toaster", "kettle", "frying-pan", "spoon", "knife", "bowl", "plate", "glass", "mug"],
    hard: ["cooktop", "hood", "kitchen-scale", "juicer", "coffee-machine", "ladle", "grater", "colander", "spatula", "peeler"],
  },
  letters: {
    easy: ["letter-a", "letter-b", "letter-c", "letter-d", "letter-e", "letter-i", "letter-l", "letter-m", "letter-o",
      "letter-p", "letter-s", "letter-t"],
    hard: ["letter-k", "letter-q", "letter-w", "letter-x", "letter-y", "letter-z"],
  },
  numbers: {
    easy: ["number-1", "number-2", "number-3", "number-4", "number-5", "number-6", "number-7", "number-8", "number-9", "number-10"],
    hard: ["number-30", "number-40", "number-50", "number-60", "number-70", "number-80", "number-90", "number-100"],
  },
  body: {
    easy: ["head", "hair", "eye", "ear", "nose", "mouth", "teeth", "arm", "hand", "finger", "belly", "leg", "foot"],
    hard: ["eyelashes", "wrist", "ankle", "heel", "brain", "lungs", "stomach", "liver", "kidneys", "intestines", "muscle"],
  },
  sports: {
    easy: ["soccer", "basketball", "tennis", "skiing", "skating", "sledding", "swimming", "cycling", "running",
      "horse-riding", "judo", "skateboarding"],
    hard: ["baseball", "badminton", "hockey", "fencing", "american-football", "cricket-sport", "field-hockey", "billiards",
      "curling", "water-polo", "rowing", "weightlifting"],
  },
  transport: {
    easy: ["car", "police-car", "fire-engine", "bus", "tractor", "motorcycle", "bicycle", "train", "airplane",
      "helicopter", "rocket", "ship", "sailboat"],
    hard: ["trolleybus", "minibus", "suv", "pickup-truck", "lorry", "tuk-tuk", "railway-car", "mountain-railway",
      "monorail", "gondola", "ferry"],
  },
  weather: {
    easy: ["sun", "cloud", "rain", "umbrella", "lightning", "snowman", "moon", "star"],
    hard: ["tornado", "fog", "thermometer", "sun-shower", "hail", "frost"],
  },
  colors: {
    easy: ["color-red", "color-orange", "color-yellow", "color-green", "color-blue", "color-purple", "color-pink", "color-brown",
      "color-white", "color-black"],
    hard: ["color-burgundy", "color-coral", "color-beige", "color-khaki", "color-turquoise", "color-navy", "color-mauve"],
  },
  shapes: {
    easy: ["shape-circle", "shape-square", "shape-rectangle", "shape-triangle", "shape-diamond", "shape-star",
      "shape-heart", "shape-crescent"],
    hard: ["shape-hexagon", "shape-pentagon", "shape-octagon", "shape-semicircle", "shape-cylinder", "shape-pyramid"],
  },
  clothes: {
    easy: ["t-shirt", "dress", "shorts", "coat", "scarf", "socks", "cap", "crown", "glasses", "shoes", "boots",
      "sweater", "pyjamas"],
    hard: ["blouse", "kimono", "top-hat", "hiking-boots", "lab-coat", "sari", "graduation-cap", "flat-shoes", "goggles",
      "safety-vest", "purse"],
  },
  jobs: {
    easy: ["firefighter", "police-officer", "doctor", "cook", "farmer", "teacher", "astronaut", "builder", "baker"],
    hard: ["mechanic", "scientist", "judge", "detective", "office-worker", "programmer", "factory-worker", "guard"],
  },
  dishes: {
    easy: ["pizza", "hamburger", "hot-dog", "sandwich", "fries", "spaghetti", "soup", "salad", "rice", "sushi",
      "fried-egg", "chicken", "cheese", "bread", "croissant", "pancakes", "waffle", "birthday-cake", "cake", "cupcake",
      "pie", "doughnut", "cookie", "chocolate", "ice-cream", "candy", "lollipop", "honey", "popcorn", "quiche",
      "croque-monsieur", "chocolate-mousse", "madeleines", "pain-au-chocolat", "couscous", "lasagna",
      "hachis-parmentier", "mac-and-cheese"],
    hard: ["cassoulet", "bouillabaisse", "choucroute", "aligot", "escargots", "blanquette", "kouign-amann", "caneles",
      "paris-brest", "far-breton", "baba-au-rhum", "pho", "bibimbap", "biryani", "feijoada", "poutine", "strudel",
      "pierogi", "goulash", "mafe", "yassa", "jollof-rice", "injera", "ceviche", "currywurst", "kanelbulle",
      "pastel-de-nata", "irish-stew", "borscht", "pelmeni", "khachapuri", "stroopwafel", "brigadeiro", "arepas",
      "tamales", "kimchi", "nasi-goreng", "satay", "tom-yum", "dal", "shakshuka", "dolma", "thieboudienne", "attieke",
      "bobotie", "fufu", "lamington", "plov"],
  },
  countries: {
    easy: ["france", "belgium", "luxembourg", "germany", "switzerland", "italy", "spain", "monaco", "andorra",
      "united-kingdom", "ireland", "netherlands", "portugal", "greece", "austria", "poland", "denmark", "sweden",
      "norway", "russia", "turkiye", "united-states", "canada", "mexico", "cuba", "brazil", "argentina", "peru", "chile",
      "china", "japan", "india", "south-korea", "thailand", "vietnam", "australia", "new-zealand", "egypt", "morocco",
      "algeria", "tunisia", "senegal", "ivory-coast", "mali", "cameroon", "kenya", "madagascar", "south-africa"],
    hard: ["belarus", "bosnia", "estonia", "latvia", "liechtenstein", "lithuania", "moldova", "montenegro",
      "north-macedonia", "san-marino", "slovakia", "slovenia", "antigua", "barbados", "belize", "dominica", "el-salvador",
      "grenada", "guyana", "honduras", "nicaragua", "saint-kitts", "saint-lucia", "saint-vincent", "suriname", "trinidad",
      "azerbaijan", "bahrain", "bhutan", "brunei", "east-timor", "kyrgyzstan", "tajikistan", "turkmenistan", "uzbekistan",
      "kiribati", "marshall-islands", "micronesia", "nauru", "palau", "samoa", "solomon-islands", "tonga", "tuvalu",
      "vanuatu", "burundi", "central-african-republic", "comoros", "djibouti", "equatorial-guinea", "eritrea",
      "eswatini", "gambia", "guinea-bissau", "lesotho", "malawi", "sao-tome"],
  },
  scenery: {
    easy: ["mountain", "beach", "island", "desert", "river", "forest", "city", "rainbow", "snow"],
    hard: ["meadow", "iceberg", "coral-reef", "canyon", "countryside", "savanna"],
  },
};
