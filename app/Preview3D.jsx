'use client';
import { useEffect, useRef, useState } from 'react';
import { BOX_FACES, TEMPLATES, faceUV } from '../lib/template';
import { BARE, BODY, HEAD } from '../lib/body';

const SKIN = 0xf3c53a; // classic Roblox yellow
// ponytail: three dropped legacy light units, so these are the old values x PI.
// Tune here if the body reads too flat or too hot.
const LIGHT = { ambient: 2.4, key: 2.2, fill: 0.9 };

export default function Preview3D({ kind, source, version, onClose }) {
  const host = useRef(null);
  const api = useRef(null);
  const [spin, setSpin] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let dead = false;
    let cleanup = () => {};

    (async () => {
      let THREE, OrbitControls;
      try {
        THREE = await import('three');
        ({ OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js'));
      } catch {
        setErr('Could not load the 3D renderer.');
        return;
      }
      if (dead || !host.current) return;

      const W = 640;
      const H = 560;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H, false);
      host.current.append(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);
      camera.position.set(0, 0.4, 10);

      scene.add(new THREE.AmbientLight(0xffffff, LIGHT.ambient));
      const key = new THREE.DirectionalLight(0xffffff, LIGHT.key);
      key.position.set(3, 5, 6);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, LIGHT.fill);
      fill.position.set(-4, -1, -5);
      scene.add(fill);

      const tex = new THREE.CanvasTexture(source);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();

      const skinMat = new THREE.MeshLambertMaterial({ color: SKIN });
      const clothMat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.02 });
      const rig = new THREE.Group();
      const junk = [];

      function skinBox({ size: [w, h, d], at: [x, y, z] }) {
        const g = new THREE.BoxGeometry(w, h, d);
        junk.push(g);
        const m = new THREE.Mesh(g, skinMat);
        m.position.set(x, y, z);
        rig.add(m);
      }

      // a textured shell just outside the skin box, so transparent pixels
      // show skin instead of the inside of the part
      function clothBox({ part, slice, size: [w, h, d], at: [x, y, z] }) {
        const g = new THREE.BoxGeometry(w + 0.02, h + 0.01, d + 0.02);
        const uv = g.attributes.uv;
        BOX_FACES.forEach((side, i) => {
          const f = faceUV(kind, part, side, slice);
          if (!f) return;
          const { u0, u1, v0, v1 } = f;
          const o = i * 4;
          uv.setXY(o, u0, v0);
          uv.setXY(o + 1, u1, v0);
          uv.setXY(o + 2, u0, v1);
          uv.setXY(o + 3, u1, v1);
        });
        uv.needsUpdate = true;
        junk.push(g);
        const m = new THREE.Mesh(g, clothMat);
        m.position.set(x, y, z);
        rig.add(m);
      }

      skinBox(HEAD);
      for (const p of BARE[kind]) skinBox(p);
      for (const p of BODY[kind]) {
        skinBox(p);
        clothBox(p);
      }
      scene.add(rig);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, -0.5, 0);
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 4;
      controls.maxDistance = 20;
      controls.update();
      controls.saveState(); // so Reset view returns to this framing

      let frame;
      const tick = () => {
        frame = requestAnimationFrame(tick);
        if (api.current.spin) rig.rotation.y += 0.006;
        controls.update();
        renderer.render(scene, camera);
      };
      api.current = { spin, tex, reset: () => { rig.rotation.y = 0; controls.reset(); } };
      tick();

      cleanup = () => {
        cancelAnimationFrame(frame);
        controls.dispose();
        for (const g of junk) g.dispose();
        skinMat.dispose();
        clothMat.dispose();
        tex.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };
    })();

    return () => { dead = true; cleanup(); };
  }, [kind, source]);

  // repaint the texture whenever a layer changes
  useEffect(() => {
    if (api.current?.tex) api.current.tex.needsUpdate = true;
  }, [version]);

  useEffect(() => {
    if (api.current) api.current.spin = spin;
  }, [spin]);

  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <header>
          <b>{TEMPLATES[kind].label} preview</b>
          <div className="spacer" />
          <button data-on={spin} onClick={() => setSpin(!spin)}>Spin</button>
          <button onClick={() => api.current?.reset()}>Reset view</button>
          <button onClick={onClose}>Close <kbd>ESC</kbd></button>
        </header>
        <div className="shot" ref={host}>{err && <p className="hint">{err}</p>}</div>
        <p className="hint">Default R15 avatar wearing your texture. Drag to orbit, wheel to zoom. Yellow is bare skin showing through transparent pixels.</p>
      </div>
    </div>
  );
}
