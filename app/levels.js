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
      "artichoke", "asparagus", "persimmon", "quince", "lychee", "passion-fruit", "dragon-fruit", "papaya", "parsnip", "turnip", "endive", "rhubarb", "fennel"],
  },
  herbs: {
    easy: ["basil", "parsley", "coriander", "mint", "thyme", "rosemary", "chives", "bay-leaf"],
    hard: ["chervil", "marjoram", "lemon-balm", "sorrel", "savory", "wild-garlic", "curry-leaves", "lovage", "borage", "lemon-verbena", "hyssop", "shiso", "purslane"],
  },
  spices: {
    easy: ["salt", "pepper", "cinnamon", "vanilla", "chili", "ginger", "sesame", "licorice"],
    hard: ["star-anise", "turmeric", "cardamom", "juniper", "poppy-seeds", "sumac", "caraway", "allspice", "fenugreek", "sichuan-pepper", "mace", "ras-el-hanout", "espelette"],
  },
  kitchen: {
    easy: ["fridge", "oven", "toaster", "kettle", "frying-pan", "spoon", "knife", "bowl", "plate", "glass", "mug"],
    hard: ["cooktop", "hood", "kitchen-scale", "juicer", "coffee-machine", "ladle", "grater", "colander", "spatula", "peeler"],
  },
  letters: {
    // phonics order: the vowels and the sounds that can be stretched first
    easy: ["letter-a", "letter-i", "letter-o", "letter-u", "letter-e", "letter-m", "letter-s", "letter-l", "letter-r", "letter-f", "letter-n"],
    hard: ["letter-k", "letter-q", "letter-w", "letter-x", "letter-y", "letter-z", "letter-j", "letter-h"],
  },
  syllables: {
    easy: ["syl-ma", "syl-mi", "syl-mo", "syl-la", "syl-li", "syl-lo", "syl-ra", "syl-ri", "syl-ro", "syl-sa", "syl-si", "syl-so"],
    hard: ["syl-pe", "syl-pu", "syl-te", "syl-tu", "syl-be", "syl-bu", "syl-de", "syl-du"],
  },
  clock: {
    // o'clock first, then half past and the quarters, then five-minute steps
    easy: ["clock-1-00", "clock-2-00", "clock-3-00", "clock-4-00", "clock-5-00", "clock-6-00", "clock-7-00", "clock-8-00", "clock-9-00", "clock-10-00", "clock-11-00", "clock-12-00"],
    hard: ["clock-2-05", "clock-8-05", "clock-3-10", "clock-1-10", "clock-4-20", "clock-6-20", "clock-5-25", "clock-11-25", "clock-6-35", "clock-4-35", "clock-7-40", "clock-9-40", "clock-8-50", "clock-2-50", "clock-9-55", "clock-7-55"],
  },
  numbers: {
    easy: ["number-1", "number-2", "number-3", "number-4", "number-5", "number-6", "number-7", "number-8", "number-9", "number-10"],
    // easy 1 to 10; medium 11 to 20 and the tens; hard the other numbers up to 100
    hard: ["number-21", "number-22", "number-23", "number-24", "number-25", "number-26", "number-27", "number-28", "number-29", "number-31",
      "number-32", "number-33", "number-34", "number-35", "number-36", "number-37", "number-38", "number-39", "number-41", "number-42",
      "number-43", "number-44", "number-45", "number-46", "number-47", "number-48", "number-49", "number-51", "number-52", "number-53",
      "number-54", "number-55", "number-56", "number-57", "number-58", "number-59", "number-61", "number-62", "number-63", "number-64",
      "number-65", "number-66", "number-67", "number-68", "number-69", "number-71", "number-72", "number-73", "number-74", "number-75",
      "number-76", "number-77", "number-78", "number-79", "number-81", "number-82", "number-83", "number-84", "number-85", "number-86",
      "number-87", "number-88", "number-89", "number-91", "number-92", "number-93", "number-94", "number-95", "number-96", "number-97",
      "number-98", "number-99"],
  },
  body: {
    easy: ["head", "hair", "eye", "ear", "nose", "mouth", "teeth", "arm", "hand", "finger", "belly", "leg", "foot"],
    hard: ["eyelashes", "wrist", "ankle", "heel", "brain", "lungs", "stomach", "liver", "kidneys", "intestines", "muscle"],
  },
  sports: {
    easy: ["soccer", "basketball", "tennis", "skiing", "skating", "sledding", "swimming", "cycling", "running",
      "horse-riding", "judo", "skateboarding"],
    hard: ["baseball", "badminton", "hockey", "fencing", "american-football", "cricket-sport", "field-hockey", "billiards",
      "curling", "water-polo", "rowing", "weightlifting", "lacrosse", "softball", "curling", "karting", "ski-jumping"],
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
