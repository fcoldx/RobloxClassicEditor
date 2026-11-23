// Classic clothing textures are always 585x559 PNG.
export const SIZE = { w: 585, h: 559 };

// Extracted from Roblox's own templates in Classic-Clothing-Templates/ by
// scripts/extract-faces.py (colour-keyed flood fill of the labelled boxes).
// Shirt and pants share the exact same geometry - only the part names differ.
// [face, x, y, w, h]
const FACES = [
  ['Up', 231, 8, 128, 64],
  ['Right', 165, 74, 64, 128],
  ['Front', 231, 74, 128, 128],
  ['Left', 361, 74, 64, 128],
  ['Back', 427, 74, 128, 128],
  ['Down', 231, 204, 128, 64],

  ['Up', 217, 289, 64, 64],
  ['Left', 19, 355, 64, 128],
  ['Back', 85, 355, 64, 128],
  ['Right', 151, 355, 64, 128],
  ['Front', 217, 355, 64, 128],
  ['Down', 217, 485, 64, 64],

  ['Up', 308, 289, 64, 64],
  ['Front', 308, 355, 64, 128],
  ['Left', 374, 355, 64, 128],
  ['Back', 440, 355, 64, 128],
  ['Right', 506, 355, 64, 128],
  ['Down', 308, 485, 64, 64],
];

const build = (parts) =>
  FACES.map(([face, x, y, w, h], i) => ({ name: parts[Math.floor(i / 6)] + ' ' + face, x, y, w, h }));

export const TEMPLATES = {
  shirt: {
    label: 'Shirt',
    regions: build(['Torso', 'R Arm', 'L Arm']),
  },
  pants: {
    label: 'Pants',
    regions: build(['Torso', 'R Leg', 'L Leg']),
  },
};

// Which face is under a canvas pixel.
export function faceAt(kind, x, y) {
  return TEMPLATES[kind].regions.find((r) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
}

// BoxGeometry face order: +X, -X, +Y, -Y, +Z, -Z. A body part faces +Z (towards
// the camera), so the character's own left is +X.
export const BOX_FACES = ['Left', 'Right', 'Up', 'Down', 'Front', 'Back'];

// Texture coordinates for one face of one part. v is flipped because a
// CanvasTexture has its origin at the bottom left.
//
// R15 splits each classic rect down its height across the sub-parts (an arm
// becomes UpperArm/LowerArm/Hand), so `slice` is the [top, bottom] fraction of
// the rect this part takes. The Up/Down caps are not sliced - they are the
// whole square either way, and only the end parts ever show one.
export function faceUV(kind, part, side, slice) {
  const r = TEMPLATES[kind].regions.find((f) => f.name === part + ' ' + side);
  if (!r) return null;
  const cap = side === 'Up' || side === 'Down';
  const y0 = cap || !slice ? r.y : r.y + r.h * slice[0];
  const y1 = cap || !slice ? r.y + r.h : r.y + r.h * slice[1];
  return {
    u0: r.x / SIZE.w,
    u1: (r.x + r.w) / SIZE.w,
    v0: 1 - y0 / SIZE.h,
    v1: 1 - y1 / SIZE.h,
  };
}
