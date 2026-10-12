#!/usr/bin/env python3
"""Draw the country flags: pictures/<country>.svg from the Circle Flags icon set (MIT, HatScripts).

Usage: python3 tools/make_flags.py <@iconify-json/circle-flags icons.json>
Get icons.json with: npm pack @iconify-json/circle-flags && tar xzf iconify-json-circle-flags-*.tgz
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FLAGS = {"france": "fr", "belgium": "be", "switzerland": "ch", "canada": "ca", "italy": "it", "spain": "es",
         "portugal": "pt", "germany": "de", "united-kingdom": "gb", "netherlands": "nl", "ireland": "ie", "greece": "gr",
         "united-states": "us", "mexico": "mx", "brazil": "br", "argentina": "ar", "china": "cn", "japan": "jp",
         "south-korea": "kr", "india": "in", "egypt": "eg", "morocco": "ma", "senegal": "sn", "kenya": "ke",
         "australia": "au",
         "austria": "at", "poland": "pl", "sweden": "se", "norway": "no", "denmark": "dk", "finland": "fi", "iceland": "is", "croatia": "hr", "turkiye": "tr", "hungary": "hu", "peru": "pe", "chile": "cl", "colombia": "co", "cuba": "cu", "lebanon": "lb", "thailand": "th", "vietnam": "vn", "indonesia": "id", "nepal": "np", "new-zealand": "nz", "algeria": "dz", "tunisia": "tn", "south-africa": "za", "nigeria": "ng", "ivory-coast": "ci", "cameroon": "cm", "madagascar": "mg", "ethiopia": "et"}

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
