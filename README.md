# Roblox Classic Clothing Editor

A browser editor for classic Roblox shirts and pants. It paints straight onto the
585×559 template canvas, shows the result on a 3D R6 avatar, and exports the PNG
you upload to Roblox.

Everything you draw stays a live, editable layer until you export — nothing is
baked in.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

Next.js 16 (App Router) + React 19 + three.js. No backend, no accounts, no
uploads — it all runs in the browser.

## Tools

| Key | Tool | | Key | Tool |
|---|---|---|---|---|
| `V` | Move | | `T` | Rect erase (transparent square) |
| `B` | Brush | | `F` | Fill face |
| `E` | Eraser | | `X` | Text |
| `R` | Rect fill | | `I` | Eyedropper |

`Ctrl+Z` undoes (60 steps). `Ctrl+D` duplicates. `Ctrl+A` selects all layers
*except* fills, so a background colour stays put while you drag the design.
Arrow keys nudge (`Shift` = 10px).

The checkerboard is real transparency. The blue face boxes are an overlay and are
never exported. All icons are inline SVG — no emoji, no icon font.

## Features

### Layers
Each fill, stroke, box, text and image stays a live object. Select it in the
right-hand panel or with the Move tool, then drag, arrow-key, recolour, hide,
reorder, duplicate, lock or delete it. A locked layer can't be selected, so it
can't be moved, scaled, recoloured or deleted until you unlock it. Shift-click on
the canvas or in the layer list adds and removes layers; dragging any selected
layer moves the whole selection.

### Fill face
Floods one UV face only — click "R Arm Up" and nothing else changes.
Shift+click clears that face to transparent instead.

### 3D preview
Builds a default R15 avatar wearing your texture (three.js, loaded on demand) and
re-textures live as you edit. R15 splits each classic rect down its height across
the sub-parts — an arm rect is shared by UpperArm (60%) / LowerArm (30%) / Hand
(10%), the torso by UpperTorso (80%) / LowerTorso (20%) — which is what the dotted
lines on Roblox's own template mark. Each clothed part is a textured shell over a
skin-coloured box, so transparent pixels read as bare skin. Drag to orbit, wheel
to zoom, Spin for a turntable.

### Text
Multi-line (Enter), with bold, italic, underline, strikethrough, UPPER/lower case,
alignment, line height, letter spacing, opacity, an outline (width + colour) and a
drop shadow (offset, blur, colour). Every setting stays editable on the layer.
Scale it by dragging a corner grip, or step the size with the −/+ chips.

### Fonts
One box takes all three forms:

```
googlefont://Bangers
cssfont://https://host/fonts.css
https://host/MyFont.woff2        # or .ttf / .otf
Bangers                          # a bare name is treated as a Google Font
```

A stylesheet may define several families; they're discovered by diffing
`document.fonts` after it loads, since the rules are unreadable cross-origin.
Local font files upload separately.

### Stickers
Drop in a PNG or SVG as its own layer with transparency intact, recolour it flat
with the colour picker, then drag and scale it from the corner grips.

### Canvas
Wheel-zoom anchored on the cursor, or the header buttons. "Pixel view" switches to
nearest-neighbour when you need to see exact pixels. The canvas rasterises at 2×
and downsamples on export, so text and curves come out smooth rather than jagged.

### Mobile
The two side panels become drawers (the sliders and layers buttons in the header),
and the canvas starts fitted to the screen — tap the zoom percentage to toggle
fit / 1:1. No pinch-to-zoom yet; use the zoom buttons.

## The UV guide

`lib/template.js` holds the 18 face rectangles. Shirt and pants share the exact
same geometry; only the part names differ. Only the boxes are drawn — the template
image itself is never shown or exported.

The rects were extracted from Roblox's official templates by
`scripts/extract-faces.py`, a colour-keyed flood fill of the labelled boxes
(red=Front, blue=Back, yellow=Left, green=Right, cyan=Up, orange=Down). The
template PNGs aren't in this repo — download them from Roblox's
[Classic Clothing](https://create.roblox.com/docs/art/accessories/classic-clothing)
docs and re-run:

```bash
python scripts/extract-faces.py Template-Shirts-R15.png
```

## Layout

```
app/
  page.jsx        the editor (canvas, tools, layers, panels)
  Preview3D.jsx   three.js R15 avatar preview
  Icon.jsx        inline SVG icon set
  globals.css     all styling
lib/
  template.js     18 UV face rects, hit-testing, face→UV mapping
  body.js         R15 part dimensions and rig offsets
  font-source.js  parses the four custom-font input forms
scripts/
  extract-faces.py  regenerates template.js from Roblox's template PNGs
```

## License

MIT
