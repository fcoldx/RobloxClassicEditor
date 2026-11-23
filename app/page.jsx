'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SIZE, TEMPLATES, faceAt } from '../lib/template';
import { parseFontSource } from '../lib/font-source';
import Preview3D from './Preview3D';
import Icon from './Icon';

const TOOLS = [
  ['move', 'Move', 'v', 'cursor'],
  ['brush', 'Brush', 'b', 'brush'],
  ['erase', 'Eraser', 'e', 'eraser'],
  ['rect', 'Rect', 'r', 'square'],
  ['rectErase', 'Rect erase', 't', 'squareDash'],
  ['fill', 'Fill face', 'f', 'bucket'],
  ['text', 'Text', 'x', 'text'],
  ['pick', 'Pick color', 'i', 'dropper'],
];
const FONTS = ['Impact', 'Arial', 'Arial Black', 'Verdana', 'Georgia', 'Courier New', 'Comic Sans MS'];
const ZOOM = [0.5, 8];
// Draw at 2x and downsample on export: smooth text and curves instead of
// 585x559 jaggies. ponytail: 2 is the sweet spot, past that replay gets slow.
const SS = 2;
// Recolour a sticker: keep its alpha, flood the lot with one colour.
// One shared scratch canvas - drawLayer is synchronous, nothing else holds it.
let scratch;
function tinted(img, color) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  scratch ||= document.createElement('canvas');
  scratch.width = w; // also resets the context, composite op included
  scratch.height = h;
  const g = scratch.getContext('2d');
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  return scratch;
}
export default function Page() {
  const art = useRef(null);
  const over = useRef(null);
  const stage = useRef(null);
  const undos = useRef([]);
  const drag = useRef(null);
  const live = useRef(null);
  const anchor = useRef(null);
  const nextId = useRef(1);
  const lastNudge = useRef(0);

  const [layers, setLayers] = useState([]);
  const [selIds, setSelIds] = useState([]);
  const [kind, setKind] = useState('shirt');
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#e03131');
  const [width, setWidth] = useState(8);
  const [zoom, setZoom] = useState(1);
  const [pixel, setPixel] = useState(false);
  const [guide, setGuide] = useState(true);
  const [recent, setRecent] = useState([]);
  const [fonts, setFonts] = useState(FONTS);
  const [text, setText] = useState({
    value: 'TEXT', size: 28, font: 'Impact', bold: false, italic: false, align: 'center', lh: 1.15,
    strokeW: 0, strokeC: '#000000', shadow: false, shX: 3, shY: 3, shBlur: 4, shC: '#000000',
    underline: false, strike: false, tracking: 0, case: 'none', opacity: 1,
  });
  const [fontIn, setFontIn] = useState('');
  const [fontMsg, setFontMsg] = useState('');
  const [hover, setHover] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [panel, setPanel] = useState(null); // mobile drawer: 'tools' | 'layers'

  const setSelId = (id) => setSelIds(id == null ? [] : [id]);
  const selected = layers.filter((l) => selIds.includes(l.id));
  // single-layer editing (grips, text fields) only applies to a lone selection
  const sel = selected.length === 1 ? selected[0] : null;
  const ctx = () => art.current.getContext('2d', { willReadFrequently: true });

  useEffect(() => {
    // same options as ctx(), or the willReadFrequently hint is dropped
    for (const g of [ctx(), over.current.getContext('2d')]) {
      g.setTransform(SS, 0, 0, SS, 0, 0);
      g.imageSmoothingQuality = 'high';
    }
  }, []);

  /* ---------- layers ---------- */

  const pushUndo = () => {
    undos.current.push(layers);
    if (undos.current.length > 60) undos.current.shift();
  };
  function undo() {
    const p = undos.current.pop();
    if (p) setLayers(p);
  }
  const patch = (id, p) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)));
  const patchMany = (ids, fn) => setLayers((ls) => ls.map((l) => (ids.includes(l.id) ? { ...l, ...fn(l) } : l)));

  // Everything except fills: a background colour is what you want to stay put
  // while you drag the artwork around. Locked layers stay out of it too.
  function selectAll() {
    const ids = layers.filter((l) => !l.fill && !l.locked && l.visible).map((l) => l.id);
    setSelIds(ids);
    if (ids.length) setTool('move');
  }
  function removeSelected() {
    if (!selIds.length) return;
    pushUndo();
    setLayers((ls) => ls.filter((l) => !selIds.includes(l.id)));
    setSelIds([]);
  }
  const add = (l) => {
    pushUndo();
    const full = { id: nextId.current++, tx: 0, ty: 0, visible: true, ...l };
    setLayers((ls) => [...ls, full]);
    return full;
  };
  function reorder(id, dir) {
    pushUndo();
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const out = ls.slice();
      [out[i], out[j]] = [out[j], out[i]];
      return out;
    });
  }
  // same layer, same everything, nudged clear of the original and stacked
  // right on top of it. The bitmap of an image layer is shared, not reloaded.
  function duplicate(id) {
    const i = layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    const src = layers[i];
    pushUndo();
    // the copy starts unlocked, otherwise it lands untouchable
    const copy = { ...src, id: nextId.current++, tx: src.tx + 8, ty: src.ty + 8, locked: false };
    if (src.pts) copy.pts = src.pts.map((p) => ({ ...p }));
    setLayers((ls) => [...ls.slice(0, i + 1), copy, ...ls.slice(i + 1)]);
    setSelId(copy.id);
    setTool('move');
  }

  function remove(id) {
    pushUndo();
    setLayers((ls) => ls.filter((l) => l.id !== id));
    setSelIds((ids) => ids.filter((i) => i !== id));
  }

  const applyFont = (g, l) => {
    g.font = (l.italic ? 'italic ' : '') + (l.bold ? '700 ' : '') + l.size + 'px "' + l.font + '", sans-serif';
    g.textAlign = l.align || 'center';
    g.textBaseline = 'middle';
    // always set it: measuring leaves it on the context for the next draw
    g.letterSpacing = (l.tracking || 0) + 'px';
  };

  const textOf = (l) =>
    l.case === 'upper' ? l.value.toUpperCase() : l.case === 'lower' ? l.value.toLowerCase() : l.value;

  // where a line starts, given the alignment anchor
  const lineLeft = (l, w) =>
    (l.align || 'center') === 'left' ? l.x : (l.align || 'center') === 'right' ? l.x - w : l.x - w / 2;

  // multi-line metrics: line height, widest line, and the first line's centre
  function textBox(g, l) {
    const lines = textOf(l).split('\n');
    const lh = l.size * (l.lh || 1.15);
    applyFont(g, l);
    const widths = lines.map((t) => g.measureText(t).width);
    return { lines, widths, lh, w: Math.max(1, ...widths),
      y0: l.y - ((lines.length - 1) * lh) / 2 };
  }

  function strokePath(g, l) {
    g.lineWidth = l.width;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = l.color;
    g.beginPath();
    g.moveTo(l.pts[0].x, l.pts[0].y);
    if (l.pts.length === 1) g.lineTo(l.pts[0].x + 0.01, l.pts[0].y);
    else for (const p of l.pts.slice(1)) g.lineTo(p.x, p.y);
    g.stroke();
  }

  function drawLayer(g, l) {
    g.save();
    g.translate(l.tx, l.ty);
    if (l.opacity != null) g.globalAlpha = l.opacity;
    g.globalCompositeOperation = l.erase ? 'destination-out' : 'source-over';
    if (l.kind === 'rect') {
      g.fillStyle = l.color;
      g.fillRect(l.x, l.y, l.w, l.h);
    } else if (l.kind === 'stroke') {
      strokePath(g, l);
    } else if (l.kind === 'text') {
      const { lines, widths, lh, y0 } = textBox(g, l);
      // shadow offsets and blur are in device pixels, untouched by the
      // transform, so they need the supersample factor applied by hand
      if (l.shadow) {
        g.shadowColor = l.shC || '#000000';
        g.shadowOffsetX = (l.shX ?? 3) * SS;
        g.shadowOffsetY = (l.shY ?? 3) * SS;
        g.shadowBlur = (l.shBlur ?? 4) * SS;
      }
      if (l.strokeW) {
        g.lineWidth = l.strokeW * 2; // strokeText straddles the outline
        g.strokeStyle = l.strokeC || '#000000';
        g.lineJoin = 'round';
        g.miterLimit = 2;
        lines.forEach((t, i) => g.strokeText(t, l.x, y0 + i * lh));
        g.shadowColor = 'transparent'; // or the fill casts it a second time
      }
      g.fillStyle = l.color;
      lines.forEach((t, i) => g.fillText(t, l.x, y0 + i * lh));
      if (l.underline || l.strike) {
        const th = Math.max(1, l.size / 14);
        lines.forEach((t, i) => {
          const left = lineLeft(l, widths[i]);
          const yy = y0 + i * lh;
          if (l.underline) g.fillRect(left, yy + l.size * 0.42, widths[i], th);
          if (l.strike) g.fillRect(left, yy - th / 2, widths[i], th);
        });
      }
    } else if (l.kind === 'image') {
      // PNG alpha carries straight through, tinted or not
      g.drawImage(l.color ? tinted(l.img, l.color) : l.img, l.x, l.y, l.w, l.h);
    }
    g.restore();
  }

  // ponytail: full replay on every change. Fine to ~100 layers; if dragging
  // ever stutters, cache everything below the selection into one bitmap.
  useEffect(() => {
    const g = ctx();
    g.clearRect(0, 0, SIZE.w, SIZE.h);
    for (const l of layers) if (l.visible) drawLayer(g, l);
  }, [layers]);

  function bbox(l) {
    let b;
    if (l.kind === 'rect' || l.kind === 'image') b = [l.x, l.y, l.w, l.h];
    else if (l.kind === 'text') {
      const { lines, lh, w, y0 } = textBox(ctx(), l);
      const left = lineLeft(l, w);
      const pad = l.strokeW || 0; // the outline grows the box; the shadow does not
      b = [left - pad, y0 - l.size * 0.62 - pad,
        w + pad * 2, (lines.length - 1) * lh + l.size * 1.24 + pad * 2];
    } else {
      const xs = l.pts.map((p) => p.x);
      const ys = l.pts.map((p) => p.y);
      const pad = l.width / 2 + 1;
      b = [Math.min(...xs) - pad, Math.min(...ys) - pad,
        Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
    }
    return [b[0] + l.tx, b[1] + l.ty, b[2], b[3]];
  }

  // corner grips scale the text; the - / + chips sit just off the top-left
  // corner for a quick step. All in canvas pixels.
  const GRIP = 5;
  function handles(l) {
    const [x, y, w, h] = bbox(l);
    const cy = y < 14 ? y + h + 2 : y - 13;
    return {
      corners: [[x, y], [x + w, y], [x, y + h], [x + w, y + h]],
      minus: [x, cy, 11, 11],
      plus: [x + 13, cy, 11, 11],
      center: { x: x + w / 2, y: y + h / 2 },
    };
  }
  const inRect = (p, [x, y, w, h]) => p.x >= x && p.y >= y && p.x <= x + w && p.y <= y + h;
  const sizable = (l) => !!l && (l.kind === 'text' || l.kind === 'image');

  // text scales by font size, a sticker by its box - about its own centre
  function scaleLayer(l, k) {
    if (l.kind === 'text') return { size: Math.min(300, Math.max(6, Math.round(l.size * k))) };
    const w = Math.max(4, Math.round(l.w * k));
    const h = Math.max(4, Math.round(l.h * k));
    return { w, h, x: l.x + (l.w - w) / 2, y: l.y + (l.h - h) / 2 };
  }
  const stepSize = (l, dir) => {
    pushUndo();
    const k = l.kind === 'text'
      ? (l.size + dir * Math.max(1, Math.round(l.size * 0.1))) / l.size
      : 1 + dir * 0.1;
    patch(l.id, scaleLayer(l, k));
  };

  // A locked layer can never become the selection, which is what blocks every
  // edit path at once - they all run through `sel` or this hit test.
  const hit = (p) => [...layers].reverse().find((l) => {
    if (!l.visible || l.locked) return false;
    const [x, y, w, h] = bbox(l);
    return p.x >= x && p.y >= y && p.x <= x + w && p.y <= y + h;
  });

  const layerName = (l) =>
    l.kind === 'text' ? 'Text “' + l.value.slice(0, 14) + '”'
      : l.kind === 'image' ? 'Image'
        : l.name || (l.erase ? 'Erase' : l.kind === 'rect' ? 'Rect' : 'Brush');

  /* ---------- overlay ---------- */

  const paintOverlay = useCallback((preview) => {
    const g = over.current.getContext('2d');
    g.setTransform(SS, 0, 0, SS, 0, 0);
    g.clearRect(0, 0, SIZE.w, SIZE.h);

    if (guide) {
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(76,141,255,.85)';
      g.fillStyle = 'rgba(150,190,255,.95)';
      g.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      g.textAlign = 'left';
      g.textBaseline = 'alphabetic';
      for (const r of TEMPLATES[kind].regions) {
        g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        g.fillText(r.name, r.x + 4, r.y + 12);
      }
    }

    if (hover && tool === 'fill') {
      g.fillStyle = 'rgba(76,141,255,.22)';
      g.fillRect(hover.x, hover.y, hover.w, hover.h);
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.strokeRect(hover.x + 0.75, hover.y + 0.75, hover.w - 1.5, hover.h - 1.5);
    }

    for (const l of selected) {
      const [x, y, w, h] = bbox(l);
      g.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.65)';
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
      g.setLineDash([]);
    }
    if (selected.length > 1) {
      const bs = selected.map(bbox);
      const x = Math.min(...bs.map((b) => b[0]));
      const y = Math.min(...bs.map((b) => b[1]));
      const x2 = Math.max(...bs.map((b) => b[0] + b[2]));
      const y2 = Math.max(...bs.map((b) => b[1] + b[3]));
      g.strokeStyle = '#4c8dff';
      g.lineWidth = 1.5;
      g.strokeRect(x - 4, y - 4, x2 - x + 8, y2 - y + 8);
    }
    if (sel) {

      if (sizable(sel) && tool === 'move') {
        const hs = handles(sel);
        g.fillStyle = '#fff';
        g.strokeStyle = '#1b212a';
        for (const [hx, hy] of hs.corners) {
          g.fillRect(hx - GRIP / 2, hy - GRIP / 2, GRIP, GRIP);
          g.strokeRect(hx - GRIP / 2 + 0.5, hy - GRIP / 2 + 0.5, GRIP - 1, GRIP - 1);
        }
        g.font = '700 9px ui-sans-serif, system-ui, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const [r, glyph] of [[hs.minus, '−'], [hs.plus, '+']]) {
          g.fillStyle = '#fff';
          g.fillRect(r[0], r[1], r[2], r[3]);
          g.fillStyle = '#1b212a';
          g.fillText(glyph, r[0] + r[2] / 2, r[1] + r[3] / 2 + 0.5);
        }
      }
    }

    if (preview) {
      g.strokeStyle = '#fff';
      g.lineWidth = 1;
      g.setLineDash([4, 4]);
      g.strokeRect(preview[0] + 0.5, preview[1] + 0.5, preview[2], preview[3]);
      g.setLineDash([]);
    }
  }, [guide, kind, hover, tool, sel, selIds, layers]);

  useEffect(() => { paintOverlay(); }, [paintOverlay]);

  /* ---------- pointer ---------- */

  function pos(e) {
    const r = art.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * SIZE.w) / r.width,
      y: ((e.clientY - r.top) * SIZE.h) / r.height,
    };
  }
  const box = (a, b) => [
    Math.round(Math.min(a.x, b.x)), Math.round(Math.min(a.y, b.y)),
    Math.round(Math.abs(a.x - b.x)), Math.round(Math.abs(a.y - b.y)),
  ];
  const remember = (c) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 14));
  const grab = (e, l, p) => {
    drag.current = { tool: 'move', ids: [l.id], start: p, t0: { [l.id]: { tx: l.tx, ty: l.ty } } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  function down(e) {
    const p = pos(e);
    const g = ctx();

    if (tool === 'pick') {
      const d = g.getImageData(Math.floor(p.x * SS), Math.floor(p.y * SS), 1, 1).data;
      if (d[3]) setColor('#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
      return;
    }

    if (tool === 'move' && sizable(sel)) {
      const hs = handles(sel);
      if (inRect(p, hs.minus)) { stepSize(sel, -1); return; }
      if (inRect(p, hs.plus)) { stepSize(sel, 1); return; }
      const grip = hs.corners.some(([hx, hy]) => Math.abs(p.x - hx) <= GRIP && Math.abs(p.y - hy) <= GRIP);
      if (grip) {
        pushUndo();
        drag.current = {
          tool: 'size', id: sel.id, base: sel,
          d0: Math.max(1, Math.hypot(p.x - hs.center.x, p.y - hs.center.y)),
          center: hs.center,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }
    }

    if (tool === 'move') {
      const l = hit(p);
      if (!l) {
        if (!e.shiftKey) setSelIds([]);
        return;
      }
      const ids = e.shiftKey
        ? (selIds.includes(l.id) ? selIds.filter((i) => i !== l.id) : [...selIds, l.id])
        : (selIds.includes(l.id) ? selIds : [l.id]);
      setSelIds(ids);
      if (!ids.includes(l.id)) return; // shift-click just dropped it
      pushUndo();
      const t0 = {};
      for (const id of ids) {
        const m = layers.find((x) => x.id === id);
        if (m) t0[id] = { tx: m.tx, ty: m.ty };
      }
      drag.current = { tool: 'move', ids, start: p, t0 };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'text') {
      const l = add({ ...text, kind: 'text', x: p.x, y: p.y, value: text.value || 'TEXT', color });
      setSelId(l.id);
      remember(color);
      grab(e, l, p);
      return;
    }

    if (tool === 'fill') {
      const r = faceAt(kind, p.x, p.y);
      if (!r) return;
      const l = add({
        kind: 'rect', x: r.x, y: r.y, w: r.w, h: r.h,
        color, erase: e.shiftKey, fill: true, name: (e.shiftKey ? 'Clear ' : 'Fill ') + r.name,
      });
      setSelId(l.id);
      if (!e.shiftKey) remember(color);
      return;
    }

    if (tool === 'brush' || tool === 'erase') {
      live.current = { kind: 'stroke', pts: [p], color, width, erase: tool === 'erase' };
      g.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
      strokePath(g, live.current);
      g.globalCompositeOperation = 'source-over';
      drag.current = { tool: 'stroke' };
      if (tool === 'brush') remember(color);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    drag.current = { tool, start: p };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e) {
    const p = pos(e);
    const d = drag.current;
    if (!d) {
      if (tool === 'fill') setHover(faceAt(kind, p.x, p.y) || null);
      return;
    }
    if (d.tool === 'stroke') {
      const g = ctx();
      const l = live.current;
      const a = l.pts[l.pts.length - 1];
      l.pts.push(p);
      g.globalCompositeOperation = l.erase ? 'destination-out' : 'source-over';
      g.lineWidth = l.width;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = l.color;
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.globalCompositeOperation = 'source-over';
    } else if (d.tool === 'move') {
      const dx = p.x - d.start.x;
      const dy = p.y - d.start.y;
      patchMany(d.ids, (l) => ({ tx: d.t0[l.id].tx + dx, ty: d.t0[l.id].ty + dy }));
    } else if (d.tool === 'size') {
      patch(d.id, scaleLayer(d.base, Math.hypot(p.x - d.center.x, p.y - d.center.y) / d.d0));
    } else {
      paintOverlay(box(d.start, p));
    }
  }

  function up(e) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.tool === 'stroke') {
      setSelId(add(live.current).id);
      live.current = null;
    } else if (d.tool === 'rect' || d.tool === 'rectErase') {
      const [x, y, w, h] = box(d.start, pos(e));
      if (w && h) {
        const l = add({ kind: 'rect', x, y, w, h, color, erase: d.tool === 'rectErase' });
        setSelId(l.id);
        if (!l.erase) remember(color);
      }
      paintOverlay();
    }
  }

  /* ---------- canvas actions ---------- */

  const fillAll = () => setSelId(add({ kind: 'rect', x: 0, y: 0, w: SIZE.w, h: SIZE.h, color, fill: true, name: 'Fill all' }).id);

  function clearAll() {
    pushUndo();
    setLayers([]);
    setSelId(null);
  }

  function download() {
    const out = document.createElement('canvas');
    out.width = SIZE.w;
    out.height = SIZE.h;
    const o = out.getContext('2d');
    o.imageSmoothingEnabled = true;
    o.imageSmoothingQuality = 'high';
    o.drawImage(art.current, 0, 0, SIZE.w, SIZE.h);
    out.toBlob((b) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'roblox-' + kind + '-585x559.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }

  // a sticker: dropped in at its own size (shrunk to fit), then movable and
  // scalable like any other layer. PNG transparency is kept as-is.
  // ponytail: the blob URL is never revoked, so the image stays redrawable.
  async function addSticker(file) {
    if (!file) return;
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    const k = Math.min(1, (SIZE.w * 0.55) / img.width, (SIZE.h * 0.55) / img.height);
    const w = Math.max(4, Math.round(img.width * k));
    const h = Math.max(4, Math.round(img.height * k));
    setSelId(add({
      kind: 'image', img, w, h,
      x: Math.round((SIZE.w - w) / 2), y: Math.round((SIZE.h - h) / 2),
      name: file.name.replace(/\.[^.]+$/, '').slice(0, 16) || 'Sticker',
    }).id);
    setTool('move');
  }

  /* ---------- text + fonts ---------- */

  const tv = sel && sel.kind === 'text' ? sel : text;
  const setFontField = (p) => {
    if (sel && sel.kind === 'text') patch(sel.id, p);
    else setText((t) => ({ ...t, ...p }));
  };
  function changeColor(c) {
    setColor(c);
    const ids = selected.map((l) => l.id);
    if (ids.length) patchMany(ids, () => ({ color: c }));
  }

  function pickFonts(names) {
    setFonts((f) => [...f, ...names.filter((n) => !f.includes(n))]);
    setFontField({ font: names[0] });
    setFontMsg(names.length > 1 ? 'Loaded ' + names.length + ' families: ' + names.join(', ') : '');
  }

  const families = () => new Set([...document.fonts].map((f) => f.family.replace(/^['"]|['"]$/g, '')));

  function injectStyle(href) {
    if (document.querySelector('link[data-font="' + CSS.escape(href) + '"]')) return Promise.resolve();
    return new Promise((ok, fail) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.dataset.font = href;
      link.onload = ok;
      link.onerror = () => fail(new Error('stylesheet'));
      link.href = href;
      document.head.append(link);
    });
  }

  // A stylesheet can define several families and we cannot read its rules
  // cross-origin, so diff document.fonts to see what it actually added.
  async function loadStylesheet(href, want) {
    const before = families();
    try {
      await injectStyle(href);
    } catch {
      return [];
    }
    const added = [...families()].filter((f) => !before.has(f));
    const names = want && !added.includes(want) ? [want, ...added] : added;
    const ok = [];
    for (const n of names) {
      await document.fonts.load('32px "' + n + '"');
      if (document.fonts.check('32px "' + n + '"')) ok.push(n);
    }
    return ok;
  }

  async function loadFontFile(file) {
    if (!file) return;
    const name = file.name.replace(/\.[^.]+$/, '');
    const face = new FontFace(name, await file.arrayBuffer());
    await face.load();
    document.fonts.add(face);
    pickFonts([name]);
  }

  async function loadFont() {
    const src = parseFontSource(fontIn);
    if (!src) return;
    if (src.mode === 'invalid') {
      setFontMsg('That is not a valid URL.');
      return;
    }
    setFontMsg('Loading ' + (src.name || 'stylesheet') + '…');

    if (src.mode === 'file') {
      try {
        const face = new FontFace(src.name, 'url(' + src.url + ')');
        await face.load();
        document.fonts.add(face);
      } catch {
        setFontMsg('Could not load that file. The host may block cross-origin use (no CORS header).');
        return;
      }
      pickFonts([src.name]);
      return;
    }

    const got = await loadStylesheet(src.url, src.name);
    if (src.mode === 'google' && !got.includes(src.name)) {
      setFontMsg('No Google Font called “' + src.name + '”. Check the exact spelling.');
      return;
    }
    if (!got.length) {
      setFontMsg('That stylesheet added no usable font. Check the URL and its CORS headers.');
      return;
    }
    pickFonts(got);
  }

  /* ---------- zoom + keys ---------- */

  const clampZoom = (z) => Math.min(ZOOM[1], Math.max(ZOOM[0], z));
  const fitZoom = () => clampZoom(+((stage.current.clientWidth - 28) / SIZE.w).toFixed(2));
  // tap the percentage to fit the canvas to the panel, tap again for 1:1
  const toggleFit = () => setZoom((z) => (Math.abs(z - fitZoom()) < 0.02 ? 1 : fitZoom()));

  // start fitted when the screen is narrower than the template
  useEffect(() => {
    if (stage.current.clientWidth - 28 < SIZE.w) setZoom(fitZoom());
  }, []);

  useEffect(() => {
    const el = stage.current;
    function wheel(e) {
      if (!art.current) return;
      e.preventDefault();
      const r = art.current.getBoundingClientRect();
      anchor.current = {
        px: (e.clientX - r.left) / r.width,
        py: (e.clientY - r.top) / r.height,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    }
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const r = art.current.getBoundingClientRect();
    stage.current.scrollLeft += r.left + a.px * r.width - a.clientX;
    stage.current.scrollTop += r.top + a.py * r.height - a.clientY;
  }, [zoom]);

  useEffect(() => {
    function key(e) {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'd') { e.preventDefault(); if (sel) duplicate(sel.id); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); selectAll(); return; }
      if (e.key === 'Escape') { setSelIds([]); setShowPreview(false); setPanel(null); return; }
      if (selected.length) {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSelected(); return; }
        const step = e.shiftKey ? 10 : 1;
        const nudge = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (nudge) {
          e.preventDefault();
          // one undo entry per burst, or holding an arrow key floods the stack
          if (Date.now() - lastNudge.current > 500) pushUndo();
          lastNudge.current = Date.now();
          patchMany(selIds, (l) => ({ tx: l.tx + nudge[0], ty: l.ty + nudge[1] }));
          return;
        }
      }
      const t = TOOLS.find((x) => x[2] === k);
      if (t) setTool(t[0]);
    }
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });

  return (
    <div className="app">
      <aside className="rail" data-open={panel === 'tools'}>
        <div className="brand">
          <b>Classic Clothing</b>
          <span>585 &times; 559</span>
        </div>

        <section>
          <h3>Tools</h3>
          <div className="tools">
            {TOOLS.map(([k, label, sc, icon]) => (
              <button key={k} data-on={tool === k} onClick={() => setTool(k)} title={label}>
                <Icon name={icon} /><span className="tlabel">{label}</span><kbd>{sc.toUpperCase()}</kbd>
              </button>
            ))}
          </div>
          {tool === 'move' && <p className="hint">Click any layer to grab it, drag or arrow-key to move, <kbd>DEL</kbd> to remove.</p>}
          {tool === 'fill' && <p className="hint">Click a UV face to flood just that face. <kbd>SHIFT</kbd>+click clears it to transparent.</p>}
          {tool === 'rectErase' && <p className="hint">Drag a box to punch a transparent hole.</p>}
        </section>

        <section>
          <h3>Color</h3>
          <div className="row">
            <input type="color" value={color} onChange={(e) => changeColor(e.target.value)} />
            <input className="grow" type="text" value={color} onChange={(e) => changeColor(e.target.value)} />
          </div>
          {recent.length > 0 && (
            <div className="row swatches">
              {recent.map((c) => (
                <button key={c} className="swatch" style={{ background: c }} onClick={() => changeColor(c)} title={c} />
              ))}
            </div>
          )}
          {sel && sel.kind !== 'image' && <p className="hint">Recolors the selected layer.</p>}
        </section>

        <section>
          <h3>Brush</h3>
          <div className="row">
            <input className="grow" type="range" min="1" max="80" value={width} onChange={(e) => setWidth(+e.target.value)} />
            <span className="val">{width}px</span>
          </div>
        </section>

        <section>
          <h3>Text{sel && sel.kind === 'text' ? ' · editing layer' : ''}</h3>
          <div className="row">
            <textarea className="grow" rows={2} value={tv.value} spellCheck={false}
              onChange={(e) => setFontField({ value: e.target.value })} />
          </div>
          <div className="row">
            <select className="grow" value={tv.font} onChange={(e) => setFontField({ font: e.target.value })}>
              {fonts.map((f) => <option key={f}>{f}</option>)}
            </select>
            <input type="number" min="6" max="300" value={tv.size} style={{ width: 66 }}
              onChange={(e) => setFontField({ size: +e.target.value })} />
          </div>
          <div className="row">
            <button data-on={!!tv.bold} style={{ fontWeight: 800, width: 32 }}
              onClick={() => setFontField({ bold: !tv.bold })} title="Bold">B</button>
            <button data-on={!!tv.italic} style={{ fontStyle: 'italic', width: 32 }}
              onClick={() => setFontField({ italic: !tv.italic })} title="Italic">I</button>
            <button data-on={!!tv.underline} style={{ textDecoration: 'underline', width: 32 }}
              onClick={() => setFontField({ underline: !tv.underline })} title="Underline">U</button>
            <button data-on={!!tv.strike} style={{ textDecoration: 'line-through', width: 32 }}
              onClick={() => setFontField({ strike: !tv.strike })} title="Strikethrough">S</button>
            <div className="seg">
              {['left', 'center', 'right'].map((a) => (
                <button key={a} data-on={(tv.align || 'center') === a} title={'Align ' + a}
                  onClick={() => setFontField({ align: a })}>
                  <Icon name={'align' + a[0].toUpperCase() + a.slice(1)} size={15} />
                </button>
              ))}
            </div>
          </div>
          <div className="row">
            <div className="seg">
              {[['none', 'Aa'], ['upper', 'AA'], ['lower', 'aa']].map(([c, label]) => (
                <button key={c} data-on={(tv.case || 'none') === c} title={'Case: ' + c}
                  onClick={() => setFontField({ case: c })}>{label}</button>
              ))}
            </div>
          </div>
          <div className="row">
            <label>Line</label>
            <input className="grow" type="range" min="0.8" max="2.2" step="0.05" value={tv.lh ?? 1.15}
              onChange={(e) => setFontField({ lh: +e.target.value })} />
            <span className="val">{(tv.lh ?? 1.15).toFixed(2)}</span>
          </div>
          <div className="row">
            <label>Spacing</label>
            <input className="grow" type="range" min="-3" max="24" step="0.5" value={tv.tracking ?? 0}
              onChange={(e) => setFontField({ tracking: +e.target.value })} />
            <span className="val">{tv.tracking ?? 0}</span>
          </div>
          <div className="row">
            <label>Opacity</label>
            <input className="grow" type="range" min="0.05" max="1" step="0.05" value={tv.opacity ?? 1}
              onChange={(e) => setFontField({ opacity: +e.target.value })} />
            <span className="val">{Math.round((tv.opacity ?? 1) * 100)}%</span>
          </div>
          <div className="row">
            <label>Outline</label>
            <input className="grow" type="range" min="0" max="12" step="0.5" value={tv.strokeW ?? 0}
              onChange={(e) => setFontField({ strokeW: +e.target.value })} />
            <input type="color" value={tv.strokeC ?? '#000000'}
              onChange={(e) => setFontField({ strokeC: e.target.value })} />
          </div>
          <div className="row">
            <button data-on={!!tv.shadow} onClick={() => setFontField({ shadow: !tv.shadow })}>Shadow</button>
            {tv.shadow && (
              <input type="color" value={tv.shC ?? '#000000'}
                onChange={(e) => setFontField({ shC: e.target.value })} />
            )}
          </div>
          {tv.shadow && (
            <div className="row">
              {[['shX', 'X'], ['shY', 'Y'], ['shBlur', 'Blur']].map(([k, label]) => (
                <label key={k} className="val" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {label}
                  <input type="number" min="-60" max="60" style={{ width: 54 }}
                    value={tv[k] ?? (k === 'shBlur' ? 4 : 3)}
                    onChange={(e) => setFontField({ [k]: +e.target.value })} />
                </label>
              ))}
            </div>
          )}
          <p className="hint">Enter makes a new line. With <kbd>V</kbd> selected, drag a corner grip to scale, or tap <kbd>&minus;</kbd>/<kbd>+</kbd> at the box corner.</p>
          <div className="row">
            <input className="grow" type="text" placeholder="googlefont://Bangers" value={fontIn}
              onChange={(e) => setFontIn(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadFont()} />
            <button onClick={loadFont}>Load</button>
          </div>
          <div className="row">
            <input type="file" accept=".ttf,.otf,.woff,.woff2,font/*"
              onChange={(e) => { loadFontFile(e.target.files[0]); e.target.value = ''; }} />
          </div>
          {fontMsg && <p className="hint">{fontMsg}</p>}
          <p className="hint">Custom font: <kbd>googlefont://Name</kbd>, <kbd>cssfont://https://&hellip;css</kbd>, or a direct .ttf/.otf/.woff2 URL. A bare name is taken as a Google Font.</p>
        </section>

        <section>
          <h3>Template guide</h3>
          <div className="row">
            <button data-on={guide} onClick={() => setGuide(!guide)}>{guide ? 'Boxes on' : 'Boxes off'}</button>
          </div>
          <p className="hint">The face boxes were read straight out of Roblox&apos;s own {TEMPLATES[kind].label.toLowerCase()} template, so Fill face and the preview line up exactly.</p>
        </section>

        <section>
          <h3>Canvas</h3>
          <div className="row">
            <button onClick={undo}><Icon name="undo" />Undo</button>
            <button onClick={() => sel && duplicate(sel.id)} disabled={!sel} title="Ctrl+D"><Icon name="copy" />Duplicate</button>
          </div>
          <div className="row">
            <button onClick={selectAll} title="Ctrl+A"><Icon name="grid" />Select all</button>
          </div>
          <div className="row">
            <button onClick={fillAll}>Fill all</button>
            <button onClick={clearAll}>Clear</button>
          </div>
        </section>

        <section>
          <h3>Sticker</h3>
          <div className="row">
            <input type="file" accept="image/*"
              onChange={(e) => { addSticker(e.target.files[0]); e.target.value = ''; }} />
          </div>
          {sel && sel.kind === 'image' && (
            <div className="row">
              <label>Recolor</label>
              <input type="color" value={sel.color || '#ffffff'}
                onChange={(e) => patch(sel.id, { color: e.target.value })} />
              <button onClick={() => patch(sel.id, { color: null })} disabled={!sel.color}>Original</button>
            </div>
          )}
          <p className="hint">Drops a PNG/SVG in as its own layer, transparency intact. Drag it, scale it from the corners, reorder it in Layers.</p>
        </section>
      </aside>

      <main className="main">
        <header className="bar">
          <button className="only-mobile" title="Tools" onClick={() => setPanel(panel === 'tools' ? null : 'tools')}>
            <Icon name="sliders" />
          </button>
          <div className="seg">
            {Object.entries(TEMPLATES).map(([k, t]) => (
              <button key={k} data-on={kind === k} onClick={() => setKind(k)}>{t.label}</button>
            ))}
          </div>
          <div className="spacer" />
          <button data-on={pixel} onClick={() => setPixel(!pixel)} title="Nearest-neighbour preview"><Icon name="pixel" /><span className="wide">Pixel</span></button>
          <div className="seg">
            <button onClick={() => setZoom((z) => clampZoom(z / 1.25))} title="Zoom out"><Icon name="minus" size={14} /></button>
            <button onClick={toggleFit} className="val" style={{ minWidth: 56 }} title="Fit / 1:1">{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom((z) => clampZoom(z * 1.25))} title="Zoom in"><Icon name="plus" size={14} /></button>
          </div>
          <button onClick={() => setShowPreview(true)}><Icon name="cube" /><span className="wide">Preview</span></button>
          <button className="only-mobile" title="Layers" onClick={() => setPanel(panel === 'layers' ? null : 'layers')}>
            <Icon name="layers" />
          </button>
          <button className="primary" onClick={download}><Icon name="download" /><span className="wide">Export PNG</span></button>
        </header>

        <div className="stage" ref={stage}>
          <div className={'frame checker' + (pixel ? ' pixel' : '')}
            style={{ width: SIZE.w * zoom, height: SIZE.h * zoom }}>
            <canvas className="art" ref={art} width={SIZE.w * SS} height={SIZE.h * SS}
              style={{ cursor: tool === 'move' ? 'move' : 'crosshair' }}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
              onPointerLeave={() => setHover(null)} />
            <canvas className="overlay" ref={over} width={SIZE.w * SS} height={SIZE.h * SS} />
          </div>
        </div>
      </main>

      <aside className="rail layers" data-open={panel === 'layers'}>
        <div className="brand">
          <b>Layers</b>
          <span>{selIds.length > 1 ? selIds.length + ' selected' : layers.length}</span>
        </div>
        {layers.length === 0
          ? <p className="hint">Nothing yet. Every fill, stroke, box, text and image lands here and stays movable.</p>
          : <p className="hint">Topmost first. Click to select, shift-click to add. Select all (<kbd>CTRL</kbd>+<kbd>A</kbd>) grabs everything but the fills, so a background stays put while the artwork moves.</p>}
        <div className="llist">
          {layers.slice().reverse().map((l) => (
            <div key={l.id} className="lrow" data-sel={selIds.includes(l.id)} data-locked={!!l.locked}
              onClick={(e) => {
                if (l.locked) return;
                setSelIds((ids) => (e.shiftKey || e.ctrlKey || e.metaKey
                  ? (ids.includes(l.id) ? ids.filter((i) => i !== l.id) : [...ids, l.id])
                  : [l.id]));
                setTool('move');
              }}>
              <button className="eye" title="Show / hide"
                onClick={(e) => { e.stopPropagation(); patch(l.id, { visible: !l.visible }); }}>
                {l.visible ? '◉' : '○'}
              </button>
              <button className="eye" title={l.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => {
                  e.stopPropagation();
                  patch(l.id, { locked: !l.locked });
                  if (!l.locked) setSelIds((ids) => ids.filter((i) => i !== l.id));
                }}>
                <Icon name={l.locked ? 'lock' : 'unlock'} size={14} />
              </button>
              <span className="chip" style={{
                background: l.kind === 'image' ? 'linear-gradient(135deg,#9aa4b2,#4b5563)' : l.color,
                opacity: l.erase ? 0.3 : 1,
              }} />
              <span className="lname">{layerName(l)}</span>
              <button className="mini" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicate(l.id); }}><Icon name="copy" size={13} /></button>
              <button className="mini" title="Move up" onClick={(e) => { e.stopPropagation(); reorder(l.id, 1); }}><Icon name="up" size={13} /></button>
              <button className="mini" title="Move down" onClick={(e) => { e.stopPropagation(); reorder(l.id, -1); }}><Icon name="down" size={13} /></button>
              <button className="mini" title={l.locked ? 'Unlock it first' : 'Delete'} disabled={!!l.locked}
                onClick={(e) => { e.stopPropagation(); remove(l.id); }}><Icon name="trash" size={13} /></button>
            </div>
          ))}
        </div>
      </aside>

      {panel && <div className="scrim" onClick={() => setPanel(null)} />}

      {showPreview && (
        <Preview3D kind={kind} source={art.current} version={layers} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
