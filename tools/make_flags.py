#!/usr/bin/env python3
"""Draw the country flags: pictures/<country>.svg from the Circle Flags icon set (MIT, HatScripts).

Usage: python3 tools/make_flags.py <@iconify-json/circle-flags icons.json>
Get icons.json with: npm pack @iconify-json/circle-flags && tar xzf iconify-json-circle-flags-*.tgz
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAGS = {"albania": "al", "andorra": "ad", "austria": "at", "belarus": "by", "belgium": "be", "bosnia": "ba",
         "bulgaria": "bg", "croatia": "hr", "cyprus": "cy", "czechia": "cz", "denmark": "dk", "estonia": "ee",
         "finland": "fi", "france": "fr", "germany": "de", "greece": "gr", "hungary": "hu", "iceland": "is",
         "ireland": "ie", "italy": "it", "latvia": "lv", "liechtenstein": "li", "lithuania": "lt", "luxembourg": "lu",
         "malta": "mt", "moldova": "md", "monaco": "mc", "montenegro": "me", "netherlands": "nl", "north-macedonia":
         "mk", "norway": "no", "poland": "pl", "portugal": "pt", "romania": "ro", "russia": "ru", "san-marino": "sm",
         "serbia": "rs", "slovakia": "sk", "slovenia": "si", "spain": "es", "sweden": "se", "switzerland": "ch",
         "turkiye": "tr", "ukraine": "ua", "united-kingdom": "gb", "vatican": "va", "antigua": "ag", "argentina":
         "ar", "bahamas": "bs", "barbados": "bb", "belize": "bz", "bolivia": "bo", "brazil": "br", "canada": "ca",
         "chile": "cl", "colombia": "co", "costa-rica": "cr", "cuba": "cu", "dominica": "dm", "dominican-republic":
         "do", "ecuador": "ec", "el-salvador": "sv", "grenada": "gd", "guatemala": "gt", "guyana": "gy", "haiti":
         "ht", "honduras": "hn", "jamaica": "jm", "mexico": "mx", "nicaragua": "ni", "panama": "pa", "paraguay": "py",
         "peru": "pe", "saint-kitts": "kn", "saint-lucia": "lc", "saint-vincent": "vc", "suriname": "sr", "trinidad":
         "tt", "united-states": "us", "uruguay": "uy", "venezuela": "ve", "afghanistan": "af", "armenia": "am",
         "azerbaijan": "az", "bahrain": "bh", "bangladesh": "bd", "bhutan": "bt", "brunei": "bn", "cambodia": "kh",
         "china": "cn", "georgia": "ge", "india": "in", "indonesia": "id", "iran": "ir", "iraq": "iq", "israel": "il",
         "japan": "jp", "jordan": "jo", "kazakhstan": "kz", "kuwait": "kw", "kyrgyzstan": "kg", "laos": "la",
         "lebanon": "lb", "malaysia": "my", "maldives": "mv", "mongolia": "mn", "myanmar": "mm", "nepal": "np",
         "north-korea": "kp", "oman": "om", "pakistan": "pk", "palestine": "ps", "philippines": "ph", "qatar": "qa",
         "saudi-arabia": "sa", "singapore": "sg", "south-korea": "kr", "sri-lanka": "lk", "syria": "sy", "tajikistan":
         "tj", "thailand": "th", "east-timor": "tl", "turkmenistan": "tm", "uae": "ae", "uzbekistan": "uz", "vietnam":
         "vn", "yemen": "ye", "australia": "au", "fiji": "fj", "kiribati": "ki", "marshall-islands": "mh",
         "micronesia": "fm", "nauru": "nr", "new-zealand": "nz", "palau": "pw", "papua-new-guinea": "pg", "samoa":
         "ws", "solomon-islands": "sb", "tonga": "to", "tuvalu": "tv", "vanuatu": "vu", "algeria": "dz", "angola":
         "ao", "benin": "bj", "botswana": "bw", "burkina-faso": "bf", "burundi": "bi", "cape-verde": "cv", "cameroon":
         "cm", "central-african-republic": "cf", "chad": "td", "comoros": "km", "congo": "cg", "dr-congo": "cd",
         "ivory-coast": "ci", "djibouti": "dj", "egypt": "eg", "equatorial-guinea": "gq", "eritrea": "er", "eswatini":
         "sz", "ethiopia": "et", "gabon": "ga", "gambia": "gm", "ghana": "gh", "guinea": "gn", "guinea-bissau": "gw",
         "kenya": "ke", "lesotho": "ls", "liberia": "lr", "libya": "ly", "madagascar": "mg", "malawi": "mw", "mali":
         "ml", "mauritania": "mr", "mauritius": "mu", "morocco": "ma", "mozambique": "mz", "namibia": "na", "niger":
         "ne", "nigeria": "ng", "rwanda": "rw", "sao-tome": "st", "senegal": "sn", "seychelles": "sc", "sierra-leone":
         "sl", "somalia": "so", "south-africa": "za", "south-sudan": "ss", "sudan": "sd", "tanzania": "tz", "togo":
         "tg", "tunisia": "tn", "uganda": "ug", "zambia": "zm", "zimbabwe": "zw"}

def main(icons_json):
    d = json.load(open(icons_json))
    for country, code in FLAGS.items():
        icon = d["icons"][code]
        w, h = icon.get("width", d.get("width", 512)), icon.get("height", d.get("height", 512))
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}">{icon["body"]}</svg>\n'
        open(os.path.join(ROOT, "pictures", country + ".svg"), "w").write(svg)
    print(len(FLAGS), "flags")

if __name__ == "__main__":
    main(sys.argv[1])
