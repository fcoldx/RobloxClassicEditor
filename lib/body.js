// Default R15 rig in studs. Torso centred on the origin, body facing +Z.
// Named fields on purpose: positional tuples here are a bug waiting to happen.
//
// R15 keeps R6's overall proportions but splits each limb in three, so a
// classic texture's arm rect is shared down UpperArm (60%) / LowerArm (30%) /
// Hand (10%) - the dotted lines on Roblox's template mark those cuts. `slice`
// is that [top, bottom] fraction of the part's rect.
export const HEAD = { size: [1.25, 1.25, 1.25], at: [0, 1.625, 0] };

// [name, height, centre-offset from the top of the chain, slice]
const LIMB = [
  ['Upper', 1.2, -0.6, [0, 0.6]],
  ['Lower', 0.6, -1.5, [0.6, 0.9]],
  ['End', 0.2, -1.9, [0.9, 1]],
];

const limb = (part, x, top) =>
  LIMB.map(([, h, dy, slice]) => ({ part, size: [1, h, 1], at: [x, top + dy, 0], slice }));

const torso = [
  { part: 'Torso', size: [2, 1.6, 1], at: [0, 0.2, 0], slice: [0, 0.8] },   // UpperTorso
  { part: 'Torso', size: [2, 0.4, 1], at: [0, -0.8, 0], slice: [0.8, 1] },  // LowerTorso
];
const arms = (p) => [...limb(p[0], -1.5, 1), ...limb(p[1], 1.5, 1)];
const legs = (p) => [...limb(p[0], -0.5, -1), ...limb(p[1], 0.5, -1)];

const bare = (parts) => parts.map(({ size, at }) => ({ size, at }));

// the parts this garment covers (textured), and the ones left bare (skin only)
export const BODY = {
  shirt: [...torso, ...arms(['R Arm', 'L Arm'])],
  pants: [...torso, ...legs(['R Leg', 'L Leg'])],
};
export const BARE = {
  shirt: bare(legs(['R Leg', 'L Leg'])),
  pants: bare(arms(['R Arm', 'L Arm'])),
};
