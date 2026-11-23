# Roblox Classic Clothing Editor

Making a classic shirt in a normal image editor means guessing. You paint a
rectangle, export it, upload it, equip it, and only then find out the sleeve you
drew landed on the back of the arm.

This cuts the guessing out. You paint straight onto the 585×559 template, a 3D
avatar wears your texture while you work, and when it looks right you export the
PNG and upload it. Shirts and pants both.

Everything you draw stays a live, editable layer until the moment you export.
Nothing gets baked in behind your back.

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
```

Next.js 16 (App Router) + React 19 + three.js. No backend, no accounts, no
uploads. Your artwork never leaves the browser.

## Tools

| Key | Tool      |     | Key | Tool                            |
| --- | --------- | --- | --- | ------------------------------- |
| `V` | Move      |     | `T` | Rect erase (transparent square) |
| `B` | Brush     |     | `F` | Fill face                       |
| `E` | Eraser    |     | `X` | Text                            |
| `R` | Rect fill |     | `I` | Eyedropper                      |

`Ctrl+Z` undoes, 60 steps deep. `Ctrl+D` duplicates. `Ctrl+A` selects every layer
_except_ fills, so your background colour stays put while you drag the design
around on top of it. Arrow keys nudge a layer a pixel at a time, `Shift` makes it
ten.

The checkerboard is real transparency, not a grey swatch. The blue face boxes are
just an overlay to draw against, and they're never part of the export.

## What it does

### Layers

Every fill, stroke, box, text and image stays its own object. Grab it in the
right-hand panel or with the Move tool, then drag it, nudge it, recolour it, hide
it, reorder it, duplicate it, lock it or delete it. Locking a layer takes it out
of selection entirely, so you can't move, scale, recolour or delete it by accident
until you unlock it. Shift-click on the canvas or in the layer list adds and
removes layers from a selection, and dragging any one of them moves the lot.

### Fill face

Floods a single UV face and nothing else. Click "R Arm Up" and only that square
changes. Shift+click clears the face to transparent instead.

### 3D preview

A default R15 avatar wearing your texture, re-textured live as you paint. R15
splits each classic rectangle down its height across the sub-parts: an arm rect
is shared by UpperArm (60%), LowerArm (30%) and Hand (10%), the torso by
UpperTorso (80%) and LowerTorso (20%). That split is exactly what the dotted lines on
Roblox's own template are marking. Each clothed part is a textured shell over a
skin-coloured box underneath, so transparent pixels read as bare skin rather than
holes. Drag to orbit, wheel to zoom, Spin for a turntable. three.js loads on
demand, so the editor starts fast whether or not you open the preview.

### Text

Multi-line (just press Enter), with bold, italic, underline, strikethrough,
UPPER/lower case, alignment, line height, letter spacing, opacity, an outline
(width and colour) and a drop shadow (offset, blur, colour). None of it is
flattened, so every setting is still there on the layer tomorrow. Scale it by
dragging a corner grip, or step the size with the −/+ chips.

### Fonts

One box takes all of these:

```
googlefont://Bangers
cssfont://https://host/fonts.css
https://host/MyFont.woff2        # or .ttf / .otf
Bangers                          # a bare name is treated as a Google Font
```

A stylesheet can define several families at once. Those get discovered by diffing
`document.fonts` before and after it loads, since cross-origin rules can't be read
directly. Font files on your own machine upload separately.

### Stickers

Drop in a PNG or SVG and it becomes its own layer with transparency intact.
Recolour it flat with the colour picker, drag it, scale it from the corner grips.

### Canvas

Wheel-zoom anchored on the cursor, or the buttons in the header. "Pixel view"
switches to nearest-neighbour for when you need to see exactly which pixel is
which. The canvas rasterises at 2× and downsamples on export, so text and curves
come out smooth instead of jagged.

### Mobile

The two side panels turn into drawers (the sliders and layers buttons in the
header), and the canvas starts fitted to the screen. Tap the zoom percentage to
flip between fit and 1:1. No pinch-to-zoom yet; use the zoom buttons.

## Where the UV boxes come from

`lib/template.js` holds the 18 face rectangles. Shirts and pants share the exact
same geometry, only the part names differ. Only the boxes get drawn; the template
image itself is never shown and never exported.

The rectangles were pulled out of Roblox's official templates by
`scripts/extract-faces.py`, a colour-keyed flood fill of the labelled boxes
(red=Front, blue=Back, yellow=Left, green=Right, cyan=Up, orange=Down). The
template PNGs aren't in the repo. Grab them from Roblox's
[Classic Clothing](https://create.roblox.com/docs/art/accessories/classic-clothing)
docs and re-run it if you ever need to regenerate:

```bash
python scripts/extract-faces.py Template-Shirts-R15.png
```

## Project Structure

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
