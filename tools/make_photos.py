#!/usr/bin/env python3
"""Build the photo packs: app/photos/<topic>.json and covers.json, and PHOTO-CREDITS.md.

Usage: python3 tools/make_photos.py <build dir>
Reads the candidates downloaded by tools/fetch_photos.py and the chosen ones in
tools/photo_picks.json: {topic: {item id: n}} or {item id: [n, fx, fy]} where fx, fy (0-1) is
the point the square crop is centred on (default the middle). Needs Pillow.
"""
import base64, io, json, os, re, subprocess, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE, QUALITY = 288, 68
LICENSES = {"cc0": ("CC0", "https://creativecommons.org/publicdomain/zero/1.0/"),
            "pdm": ("Public domain", "https://creativecommons.org/publicdomain/mark/1.0/"),
            "cc-by": ("CC BY", "https://creativecommons.org/licenses/by/4.0/"),
            "by": ("CC BY", "https://creativecommons.org/licenses/by/4.0/"),
            "cc-by-sa": ("CC BY-SA", "https://creativecommons.org/licenses/by-sa/4.0/"),
            "by-sa": ("CC BY-SA", "https://creativecommons.org/licenses/by-sa/4.0/")}
LOOK_SAMPLES = ["lion", "sunflower", "strawberry"]  # shown on the drawings-or-photos screen

def square(path, fx=.5, fy=.5):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    w, h = im.size
    side = min(w, h)
    x = min(max(int(fx * w - side / 2), 0), w - side)
    y = min(max(int(fy * h - side / 2), 0), h - side)
    im = im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
    out = io.BytesIO()
    im.save(out, "WEBP", quality=QUALITY, method=6)
    return "data:image/webp;base64," + base64.b64encode(out.getvalue()).decode()

def topics():
    js = """const vm=require('vm');const fs=require('fs');vm.runInThisContext(fs.readFileSync(process.argv[1],'utf8')+';globalThis.T_=TOPICS');
console.log(JSON.stringify(T_.map(t=>({id:t.id,pic:t.pic,en:t.en,groups:(t.groups||[]).map(g=>g.pic),items:t.items.map(i=>({id:i.id,en:i.en}))}))))"""
    return json.loads(subprocess.run(["node", "-e", js, os.path.join(ROOT, "app", "topics.js")],
                                     capture_output=True, text=True, check=True).stdout)

def main(build):
    picks = json.load(open(os.path.join(ROOT, "tools", "photo_picks.json")))
    out_dir = os.path.join(ROOT, "app", "photos")
    os.makedirs(out_dir, exist_ok=True)
    every, credits = {}, []
    for t in topics():
        chosen = picks.get(t["id"])
        if not chosen: continue
        base = os.path.join(build, "photos", t["id"])
        cands = json.load(open(os.path.join(base, "candidates.json")))
        pack = {}
        for item in t["items"]:
            p = chosen.get(item["id"])
            if p is None: continue
            n, fx, fy = (p, .5, .5) if isinstance(p, int) else (p + [.5, .5])[:3]
            c = cands[item["id"]][n]
            pack[item["id"]] = square(os.path.join(base, c["file"]), fx, fy)
            lic, lic_url = LICENSES.get(c["license"].lower(), (c["license"], ""))
            author = re.sub(r"\s+", " ", re.sub(r"\(c\)\s*", "", c.get("author") or "unknown")).strip()
            author = re.sub(r",?\s*(some rights reserved|no rights reserved|all rights reserved).*$", "", author, flags=re.I)
            credits.append((t["en"], item["en"], c["page"], author.replace("|", "/"), lic, lic_url))
        every.update(pack)
        json.dump(pack, open(os.path.join(out_dir, t["id"] + ".json"), "w"), separators=(",", ":"))
        print(f"{t['id']:12s} {len(pack):3d}/{len(t['items'])} photos, {os.path.getsize(os.path.join(out_dir, t['id'] + '.json')) // 1024} KB")
    # the home screen: each topic's picture, its group pictures, and the chooser's samples
    cover_ids = set(LOOK_SAMPLES)
    for t in topics():
        cover_ids.add(t["pic"]); cover_ids.update(t["groups"])
    covers = {i: every[i] for i in sorted(cover_ids) if i in every}
    json.dump(covers, open(os.path.join(out_dir, "covers.json"), "w"), separators=(",", ":"))
    print("covers", len(covers), os.path.getsize(os.path.join(out_dir, "covers.json")) // 1024, "KB")
    lines = ["# Photo credits", "",
             "The photos of the photo mode (`app/photos/`) are cropped and resized from these freely licensed",
             "photos, from [iNaturalist](https://www.inaturalist.org) and [Openverse](https://openverse.org)",
             "(mostly Flickr). Thank you to the photographers.", "",
             "| Topic | Item | Photo | Author | Licence |", "|---|---|---|---|---|"]
    for topic, item, page, author, lic, url in credits:
        lines.append(f"| {topic} | {item} | [link]({page}) | {author} | " + (f"[{lic}]({url})" if url else lic) + " |")
    open(os.path.join(ROOT, "PHOTO-CREDITS.md"), "w").write("\n".join(lines) + "\n")
    import make_packs; make_packs.main()  # the new versions for app/packs.js

if __name__ == "__main__":
    main(sys.argv[1])
