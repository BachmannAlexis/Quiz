# Drawing pictures for Pikolo

Each item is shown as a picture on a white rounded card about 110 px wide on a phone, to children of 3 to 5.
Items without a file here use a Google Noto emoji (mapping in `tools/make_pictures.py`). Flags come from
`tools/make_flags.py`; letters, numbers, colours and shapes from `tools/make_letters.py` — don't draw those by hand.

## Rules

- One file per item: `pictures/<id>.svg`, where `<id>` is the item's id in `app/topics.js`.
- `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">`, no width/height, no text, no `<image>`,
  no external references, no filters or blur, no `<style>`, no scripts. Gradients sparingly; flat colours preferred.
- Keep each file under about 6 KB and check it is well-formed XML.
- Style: match Noto emoji and the existing files (`poppy.svg`, `chanterelle.svg`, `timpani.svg`, `lavender.svg`,
  `oak.svg`): flat, bold, friendly, clear silhouettes, saturated colours, a few shading shapes. The subject fills
  the canvas (about 8 to 120), centred, no background, at most a small shadow.
- Show the most typical, iconic view, and make each item **recognisable** and **distinct** from the other items
  of its topic (shape, colour and signature details: lasagna shows its layers, ratatouille its rings of vegetables).
- Dishes: appetising, warm colours, 3/4 view on a plate, bowl or dish when served that way, like Noto's food.

## Before committing

Render a contact sheet (Playwright, `page.goto` a local HTML grid of `<img width=128>` with labels on white cards,
including a few existing pictures for comparison), look at it, and redraw what is weak. Then rebuild
`app/pictures.js` with `tools/make_pictures.py`.
