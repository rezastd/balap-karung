import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===== Balap Karung 3D — Indonesian 17-Agustus Sack Race =====
const TRACK_LEN = 50, LANES = 4, LANE_W = 2.2;
const OBSTACLES = [15, 30, 42];
const AI_CONF = [
  { name: 'Jarwo (AI)', color: 0x1d4ed8, interval: 0.52, power: 0.86, jump: 0.75 },
  { name: 'Siti (AI)',  color: 0x16a34a, interval: 0.46, power: 0.95, jump: 0.85 },
  { name: 'Budi (AI)',  color: 0xf59e0b, interval: 0.40, power: 1.04, jump: 0.65 },
];

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ---------- realism helpers: anisotropy + procedural normal maps + bloom sprite ----------
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
function normalFromTexture(tex, strength = 2.0) {
  const src = tex.image, w = src.width, h = src.height;
  const data = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const octx = out.getContext('2d'), img = octx.createImageData(w, h);
  const lum = (x, y) => {
    const i = ((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4;
    return (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
    const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
    const nx = -dx, ny = dy, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  octx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(out);
  t.wrapS = tex.wrapS; t.wrapT = tex.wrapT;
  t.repeat.copy(tex.repeat); t.offset.copy(tex.offset);
  t.anisotropy = MAX_ANISO;
  return t;
}
function prepareTexture(tex) { tex.anisotropy = MAX_ANISO; return tex; }
function glowTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,250,235,1)');
  gr.addColorStop(0.22, 'rgba(255,238,196,0.62)');
  gr.addColorStop(1, 'rgba(255,220,160,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function dotTexture(size = 64) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}


const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc8d2cd, 34, 118);
// Gradient sky dome (procedural canvas) with dusty horizon band + cirrus
const skyCanvas = document.createElement('canvas'); skyCanvas.width = 64; skyCanvas.height = 512;
{
  const g = skyCanvas.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0.00, '#1e5fa6');
  gr.addColorStop(0.30, '#5a98d3');
  gr.addColorStop(0.48, '#a0c5e2');
  gr.addColorStop(0.58, '#dcd6c1');
  gr.addColorStop(0.66, '#c8b697');
  gr.addColorStop(1.00, '#8d7a5e');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(255,255,255,${0.014 + Math.random() * 0.045})`;
    g.fillRect(Math.random() * 64, 50 + Math.random() * 210, 14 + Math.random() * 46, 0.8 + Math.random() * 1.6);
  }
}
const skyTexture = new THREE.CanvasTexture(skyCanvas); skyTexture.colorSpace = THREE.SRGBColorSpace;
const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 20),
  new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide, fog: false, depthWrite: false }));
sky.name = 'SkyDome'; scene.add(sky);
const _tmpV = new THREE.Vector3(), _tmpV2 = new THREE.Vector3(), _camTarget = new THREE.Vector3();
let camShake = 0; // impact shake amplitude, decays in updateCamera

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 4.2, -7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // follow-cam default; press C for free orbit
let followCam = true;

// ---------- Lights: sun + IBL sky + soft shadows ----------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x7a5f3a, 0.32));
scene.add(new THREE.AmbientLight(0xffe8c8, 0.07)); // soft bounce
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
sun.position.set(-18, 30, -12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -18; sun.shadow.camera.right = 18;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 110;
sun.shadow.bias = -0.00012; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3.5;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffe0b8, 0.2);
fill.position.set(15, 10, 20);
scene.add(fill);

// prefiltered sky environment: real sky light + reflections on burlap, tarmac and puddles
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture, side: THREE.BackSide })));
  const sunBall = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff2cf).multiplyScalar(9) }));
  sunBall.position.set(-18, 30, -12).normalize().multiplyScalar(30); es.add(sunBall);
  es.add(new THREE.Mesh(new THREE.SphereGeometry(39, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7a6a3c, side: THREE.BackSide })));
  const rt = pmrem.fromScene(es, 0.03);
  scene.environment = rt.texture;
  pmrem.dispose();
  es.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
}
// sun bloom sprite, occluded by geometry
const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture(160), transparent: true, blending: THREE.AdditiveBlending,
  depthWrite: false, fog: false, opacity: 0.9,
}));
sunGlow.position.set(-18, 30, -12).normalize().multiplyScalar(150);
sunGlow.scale.set(56, 56, 1);
scene.add(sunGlow);

// ---------- Canvas texture helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const dirtTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#9a6b43'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${90 + Math.random() * 90 | 0},${55 + Math.random() * 55 | 0},${25 + Math.random() * 35 | 0},0.35)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(60,35,15,0.25)';
  for (let i = 0; i < 40; i++) { g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * .3, y + 8, w * .6, y - 8, w, y); g.stroke(); }
  // patches + worn roughness variation (multi-layer)
  for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60 | 0},${80 + Math.random() * 40 | 0},40,0.22)`; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 12 + Math.random() * 40, Math.random() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 1200; i++) { g.fillStyle = 'rgba(40,25,10,0.5)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
});
dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
dirtTex.repeat.set(4, 12);
prepareTexture(dirtTex);
const dirtNormal = normalFromTexture(dirtTex, 1.5);
dirtNormal.repeat.copy(dirtTex.repeat);

const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${30 + Math.random() * 60 | 0},${120 + Math.random() * 80 | 0},40,0.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
  }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(10, 20);
prepareTexture(grassTex);
const grassNormal = normalFromTexture(grassTex, 1.2);
grassNormal.repeat.copy(grassTex.repeat);

function flagTexture() {
  return canvasTex(128, 84, (g, w, h) => {
    g.fillStyle = '#e11d2e'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#ffffff'; g.fillRect(0, h / 2, w, h / 2);
    g.strokeStyle = '#999'; g.strokeRect(1, 1, w - 2, h - 2);
  });
}
const flagTex = flagTexture();

function bannerTexture(text, sub) {
  return canvasTex(1024, 160, (g, w, h) => {
    g.fillStyle = '#c1121f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff';
    for (let i = 0; i < w; i += 64) { g.fillRect(i, 0, 32, 14); g.fillRect(i + 32, h - 14, 32, 14); }
    g.fillStyle = '#fff'; g.font = '900 84px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, sub ? h / 2 - 22 : h / 2);
    if (sub) { g.font = '700 40px Arial'; g.fillText(sub, w / 2, h - 38); }
  });
}

// ---------- Ground & track ----------
const grass = new THREE.Mesh(new THREE.PlaneGeometry(160, 200),
  new THREE.MeshStandardMaterial({
    map: grassTex, roughness: 1, envMapIntensity: 0.55,
    normalMap: grassNormal, normalScale: new THREE.Vector2(0.55, 0.55),
  }));
grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, 25); grass.receiveShadow = true;
scene.add(grass);

// macro blotch layer under the track: dry patches + wear so the lawn is not a flat green
{
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 28 + Math.random() * 110;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const dry = Math.random() < 0.5;
    gr.addColorStop(0, dry ? 'rgba(154,140,74,0.34)' : 'rgba(34,74,26,0.34)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const layer = new THREE.Mesh(new THREE.PlaneGeometry(160, 200),
    new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1, depthWrite: false, envMapIntensity: 0.4 }));
  layer.rotation.x = -Math.PI / 2; layer.position.set(0, -0.012, 25);
  layer.receiveShadow = true; scene.add(layer);
}

const trackW = LANES * LANE_W + 1.4;
const dirt = new THREE.Mesh(new THREE.PlaneGeometry(trackW + 10, TRACK_LEN + 26),
  new THREE.MeshStandardMaterial({
    map: dirtTex, roughness: 1, envMapIntensity: 0.6,
    normalMap: dirtNormal, normalScale: new THREE.Vector2(0.8, 0.8),
  }));
dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, 0, TRACK_LEN / 2); dirt.receiveShadow = true;
scene.add(dirt);

const laneNormal = normalFromTexture(dirtTex, 1.1);
laneNormal.repeat.set(2, 16);
for (let i = 0; i < LANES; i++) {
  const x = (i - (LANES - 1) / 2) * LANE_W;
  const laneNrm = laneNormal;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W - 0.25, TRACK_LEN),
    new THREE.MeshStandardMaterial({
      color: i % 2 ? 0xa4713f : 0x9c683c, roughness: 1, envMapIntensity: 0.6,
      normalMap: laneNrm, normalScale: new THREE.Vector2(0.7, 0.7),
    }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(x, 0.01, TRACK_LEN / 2); lane.receiveShadow = true;
  scene.add(lane);
  if (i < LANES) {
    const lx = x - LANE_W / 2;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, TRACK_LEN),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
    line.rotation.x = -Math.PI / 2; line.position.set(lx, 0.02, TRACK_LEN / 2);
    scene.add(line);
  }
}
const lineEnd = new THREE.Mesh(new THREE.PlaneGeometry(0.12, TRACK_LEN),
  new THREE.MeshStandardMaterial({ color: 0xffffff }));
lineEnd.rotation.x = -Math.PI / 2;
lineEnd.position.set(((LANES - 1) / 2) * LANE_W + LANE_W / 2, 0.02, TRACK_LEN / 2);
scene.add(lineEnd);

// --- Realism env: drifting clouds, distant silhouettes, houses, coconut trees, props ---
const clouds = [];
{
  const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const cg = new THREE.SphereGeometry(1, 10, 8);
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) { const s = new THREE.Mesh(cg, cm); s.position.set(j * 1.1 - 1.6, Math.random() * 0.4, Math.random()); s.scale.setScalar(1.2 + Math.random()); cl.add(s); }
    cl.position.set((Math.random() - .5) * 140, 28 + Math.random() * 14, Math.random() * 130 - 20);
    cl.userData.v = 0.3 + Math.random() * 0.5; scene.add(cl); clouds.push(cl);
  }
  // distant silhouette layer (dark tree/house shapes)
  const sm = new THREE.MeshBasicMaterial({ color: 0x4a6b8a, fog: true });
  for (let i = 0; i < 22; i++) {
    const isHouse = i % 3 === 0;
    const m = isHouse
      ? new THREE.Mesh(new THREE.BoxGeometry(4, 3, 3), sm)
      : new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 7), sm);
    m.position.set((i % 2 ? 1 : -1) * (42 + Math.random() * 30), isHouse ? 1.5 : 2.5, Math.random() * 120 - 10);
    scene.add(m);
  }
  // village houses (walls + roof prism) + coconut trees (trunk + frond planes)
  const wallM = new THREE.MeshStandardMaterial({ color: 0xf2e3c6, roughness: 0.9 });
  const roofM = new THREE.MeshStandardMaterial({ color: 0xa63d2a, roughness: 0.85 });
  const trunkM = new THREE.MeshStandardMaterial({ color: 0x7a5c36, roughness: 0.95 });
  const frondM = new THREE.MeshStandardMaterial({ color: 0x2e7d32, side: THREE.DoubleSide, roughness: 0.85 });
  const frondGeo = new THREE.PlaneGeometry(2.5, 0.66, 10, 2);
  {
    const p = frondGeo.attributes.position;
    for (let vi = 0; vi < p.count; vi++) {
      const x = p.getX(vi), y = p.getY(vi);
      const t01 = (x + 1.25) / 2.5;
      p.setY(vi, y * (1 - 0.84 * t01));        // taper toward the tip
      p.setZ(vi, -Math.pow(t01, 1.7) * 1.25);  // natural droop
    }
    frondGeo.translate(1.25, 0, 0);
    frondGeo.computeVertexNormals();
  }
  for (let i = 0; i < 8; i++) {
    const hx = (i % 2 ? 1 : -1) * (16 + (i % 3) * 5), hz = -2 + i * 8;
    const h = new THREE.Group();
    const w = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.8, 3.6), wallM); w.position.y = 1.4; w.castShadow = true; h.add(w);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.4, 2, 4), roofM); r.position.y = 3.7; r.rotation.y = Math.PI / 4; r.scale.z = 0.75; r.castShadow = true; h.add(r);
    h.position.set(hx, 0, hz); scene.add(h);
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.26, 5.6, 10), trunkM);
    trunk.position.y = 2.8; trunk.rotation.z = 0.07; trunk.castShadow = true; t.add(trunk);
    // drooping, tapered fronds in a crown (instead of flat pinwheel planes)
    const crown = new THREE.Group(); crown.position.y = 5.55; t.add(crown);
    for (let f = 0; f < 9; f++) {
      const fr = new THREE.Mesh(frondGeo, frondM);
      fr.rotation.y = (f / 9) * Math.PI * 2 + 0.2;
      fr.rotation.z = 0.16 + (f % 3) * 0.05;
      fr.scale.setScalar(0.82 + (f % 4) * 0.09);
      fr.castShadow = true;
      crown.add(fr);
    }
    for (let k = 0; k < 3; k++) {
      const nut = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b4a24, roughness: 0.9 }));
      const a = k * 2.1;
      nut.position.set(Math.cos(a) * 0.24, 5.45, Math.sin(a) * 0.24);
      nut.castShadow = true; t.add(nut);
    }
    t.position.set(hx + 5 * (i % 2 ? -1 : 1), 0, hz + 3); scene.add(t);
  }
  // scattered props: grass tufts, stones, puddles (shared geo/mat)
  const tuftG = new THREE.ConeGeometry(0.16, 0.5, 5), tuftM = new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 1 });
  const stoneG = new THREE.DodecahedronGeometry(0.16), stoneM = new THREE.MeshStandardMaterial({ color: 0x8d8378, roughness: 1 });
  const pudM = new THREE.MeshStandardMaterial({ color: 0x5b7a8c, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 90; i++) {
    const isTuft = i % 3 !== 2;
    const m = new THREE.Mesh(isTuft ? tuftG : stoneG, isTuft ? tuftM : stoneM);
    m.position.set((Math.random() - .5) * 46, 0.12, Math.random() * 66 - 6);
    if (Math.abs(m.position.x) < trackW / 2 + 0.6) m.position.x += Math.sign(m.position.x || 1) * (trackW / 2 + 1.5);
    m.castShadow = true; scene.add(m);
  }
  for (let i = 0; i < 7; i++) {
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.7 + Math.random(), 14), pudM);
    p.rotation.x = -Math.PI / 2; p.position.set((Math.random() - .5) * 30 + (Math.random() > .5 ? 10 : -10), 0.015, Math.random() * 58);
    scene.add(p);
  }
  // lane ropes + pegs
  const pegG = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), pegM = new THREE.MeshStandardMaterial({ color: 0x6b4a2b });
  const ropeM = new THREE.LineBasicMaterial({ color: 0xd9c9a8 });
  for (let li = 0; li <= LANES; li++) {
    const x = (li - LANES / 2) * LANE_W;
    const pts = [];
    for (let z = 0; z <= TRACK_LEN; z += 5) { const peg = new THREE.Mesh(pegG, pegM); peg.position.set(x, 0.25, z); scene.add(peg); pts.push(new THREE.Vector3(x, 0.42, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ropeM));
  }
  // landing skid furrow decals (fade pool)
  window.__furrows = [];
  const fGeo = new THREE.PlaneGeometry(0.55, 1.1);
  for (let i = 0; i < 28; i++) {
    const f = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({ color: 0x5a3a1a, transparent: true, opacity: 0, depthWrite: false }));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.025; f.userData.life = 0; scene.add(f); window.__furrows.push(f);
  }
  window.__furrowHead = 0;
  window.__spawnFurrow = (x, z) => { const f = window.__furrows[window.__furrowHead]; window.__furrowHead = (window.__furrowHead + 1) % 28; f.position.x = x; f.position.z = z; f.userData.life = 1; };
}

function stripe(z, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(trackW, 1.2),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.rotation.x = -Math.PI / 2; m.position.set(0, 0.03, z); m.receiveShadow = true;
  scene.add(m);
}
const checkerTex = canvasTex(128, 32, (g, w, h) => {
  const s = 16;
  for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
    g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * s, y * s, s, s);
  }
});
stripe(0, checkerTex); stripe(TRACK_LEN, checkerTex);
// distance markers every 10 m
const markerTex = (t) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
  g.fillStyle = '#c1121f'; g.font = '900 52px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(t, 64, 66);
});
for (let d = 10; d < TRACK_LEN; d += 10) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
    new THREE.MeshStandardMaterial({ map: markerTex(d + 'm'), transparent: true, roughness: 0.8 }));
  s.rotation.x = -Math.PI / 2; s.position.set(trackW / 2 + 0.8, 0.03, d);
  scene.add(s);
  // upright number sprite (canvas) facing camera
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTex(d + 'm'), depthWrite: false }));
  spr.scale.set(1.1, 1.1, 1); spr.position.set(trackW / 2 + 1.4, 1.0, d); scene.add(spr);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6),
    new THREE.MeshStandardMaterial({ color: 0x6b4a2b })); post.position.set(trackW / 2 + 1.4, 0.5, d); scene.add(post);
}

// ---------- Decorations: gates, bunting, flags, tents, crowd ----------
// Start & finish gates
function makeGate(z, title, sub) {
  const grp = new THREE.Group();
  const pilMat = new THREE.MeshStandardMaterial({ color: 0xc1121f, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.2, 10), pilMat);
    pil.position.set(sx * (trackW / 2 + 0.6), 2.6, 0); pil.castShadow = true; grp.add(pil);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.4, metalness: 0.4 }));
    cap.position.set(sx * (trackW / 2 + 0.6), 5.4, 0); grp.add(cap);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(trackW + 2.2, 1.1, 0.5),
    new THREE.MeshStandardMaterial({ map: bannerTexture(title, sub), roughness: 0.7 }));
  beam.position.set(0, 4.5, 0); beam.castShadow = true; grp.add(beam);
  grp.position.z = z;
  scene.add(grp);
}
makeGate(0, '★ START ★', '17 AGUSTUS • MERDEKA!');
makeGate(TRACK_LEN, '★ FINISH ★', '17 AGUSTUS • MERDEKA!');

// Bunting: catenary strings with red-white triangles across the track
const buntGroup = new THREE.Group(); scene.add(buntGroup);
{
  const triShape = new THREE.Shape();
  triShape.moveTo(-0.28, 0); triShape.lineTo(0.28, 0); triShape.lineTo(0, -0.62); triShape.closePath();
  const triGeo = new THREE.ShapeGeometry(triShape);
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe11d2e, side: THREE.DoubleSide, roughness: 0.8 });
  const whtMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.9 });
  for (const z of [6, 14, 22, 30, 38, 46]) {
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.4, 8), poleMat);
      pole.position.set(sx * (trackW / 2 + 1.6), 2.2, z); pole.castShadow = true; buntGroup.add(pole);
    }
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, x = (t - 0.5) * (trackW + 3.2);
      const sag = Math.sin(t * Math.PI) * -0.9;
      pts.push(new THREE.Vector3(x, 4.3 + sag, z));
    }
    buntGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x5b3a1e })));
    for (let i = 1; i < 12; i++) {
      const p = pts[Math.round(i * 2)];
      const tri = new THREE.Mesh(triGeo, i % 2 ? whtMat : redMat);
      tri.position.copy(p); tri.userData.phase = Math.random() * 6.28;
      buntGroup.add(tri);
    }
  }
}
// Indonesian flags on poles along both sides
const flags = [];
{
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.4, metalness: 0.6 });
  for (let z = 2; z <= TRACK_LEN; z += 8) {
    for (const sx of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8), poleMat);
      pole.position.set(sx * (trackW / 2 + 2.6), 2.3, z); pole.castShadow = true; scene.add(pole);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.76, 6, 1),
        new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.7 }));
      f.position.set(sx * (trackW / 2 + 2.6) + 0.6, 4.0, z);
      scene.add(f); flags.push(f);
    }
  }
}
// Tents (17-an bazaar) on the grass
{
  const tentCols = [0xe11d2e, 0xffffff, 0x1d4ed8, 0xe11d2e];
  [-9.5, -13.5, 9.5, 13.5].forEach((x, i) => {
    const g = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: tentCols[i], roughness: 0.8 }));
    roof.position.y = 3.1; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.9, 3.4),
      new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.9 }));
    base.position.y = 0.95; base.castShadow = true; g.add(base);
    for (const [px, pz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2b }));
      leg.position.set(px, 1.1, pz); g.add(leg);
    }
    g.position.set(x, 0, 12 + (i % 2) * 18);
    scene.add(g);
  });
}
// Crowd: two side rows of simple cheering people
const crowd = [];
{
  const skin = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];
  const shirt = [0xe11d2e, 0xffffff, 0x1d4ed8, 0xffd23f, 0x16a34a];
  for (let z = -2; z <= TRACK_LEN + 4; z += 2.2) {
    for (const sx of [-1, 1]) {
      if (Math.random() < 0.12) continue;
      const p = new THREE.Group();
      const bd = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 3, 8),
        new THREE.MeshStandardMaterial({ color: shirt[(Math.random() * shirt.length) | 0], roughness: 0.9 }));
      bd.position.y = 0.85; bd.castShadow = true; p.add(bd);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8),
        new THREE.MeshStandardMaterial({ color: skin[(Math.random() * skin.length) | 0], roughness: 0.7 }));
      hd.position.y = 1.5; p.add(hd);
      const armM = new THREE.MeshStandardMaterial({ color: skin[(Math.random() * skin.length) | 0], roughness: 0.7 });
      const mkArm = (sx) => { const piv = new THREE.Group(); piv.position.set(sx * 0.28, 1.15, 0); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 2, 6), armM); a.position.y = 0.2; piv.add(a); p.add(piv); return piv; };
      p.userData.armL = mkArm(-1); p.userData.armR = mkArm(1);
      p.position.set(sx * (trackW / 2 + 3.6 + Math.random() * 1.4), 0, z + (Math.random() - 0.5));
      p.userData.phase = Math.random() * 6.28;
      scene.add(p); crowd.push(p);
    }
  }
}
// Obstacles: cardboard boxes (kardus) across every lane
const obstacleMeshes = [];
{
  const kardusTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#b07a3f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { g.fillStyle = 'rgba(80,50,20,0.2)'; g.fillRect(Math.random() * w, Math.random() * h, 3, 2); }
    g.fillStyle = '#7a4a1e'; g.fillRect(0, h / 2 - 10, w, 20); // printed tape band
    g.fillStyle = '#fff'; g.font = '900 26px Arial'; g.textAlign = 'center'; g.fillText('↑ FRAGILE • 17an ↑', w / 2, 34);
    g.strokeStyle = 'rgba(60,35,10,0.6)'; g.strokeRect(4, 4, w - 8, h - 8);
  });
  prepareTexture(kardusTex);
  const boxMat = new THREE.MeshStandardMaterial({
    map: kardusTex, roughness: 0.95,
    normalMap: normalFromTexture(kardusTex, 1.6), normalScale: new THREE.Vector2(0.8, 0.8),
  });
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0x7a4a1e, roughness: 0.9 });
  for (const z of OBSTACLES) {
    for (let i = 0; i < LANES; i++) {
      const x = (i - (LANES - 1) / 2) * LANE_W;
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.65, 0.5), boxMat);
      b.position.set(x, 0.33, z); b.castShadow = true; b.receiveShadow = true;
      const tape = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.12, 0.52), tapeMat);
      tape.position.set(x, 0.45, z);
      scene.add(b); scene.add(tape); obstacleMeshes.push(b, tape);
    }
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5),
      new THREE.MeshStandardMaterial({ map: bannerTexture('AWAS!', null), roughness: 0.8 }));
    warn.position.set(trackW / 2 + 1.2, 0.9, z - 1.5); warn.rotation.y = -0.4;
    scene.add(warn);
  }
}

// ---------- Athletes (sack-wearing low-poly humans) ----------
function sackTexture(base) {
  // Burlap weave + stitched seam (used as map + bump via same canvas)
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,20,0.45)';
    for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    g.strokeStyle = 'rgba(60,35,10,0.9)'; g.lineWidth = 3; g.setLineDash([8, 5]);
    g.beginPath(); g.moveTo(14, 0); g.lineTo(14, h); g.stroke(); g.setLineDash([]);
    g.strokeStyle = 'rgba(60,35,10,0.8)'; g.strokeRect(6, 10, w - 12, 16); // tied top rim band
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '900 64px Arial'; g.textAlign = 'center';
    g.fillText('17', w / 2, h / 2 + 10);
    for (let i = 0; i < 500; i++) { g.fillStyle = 'rgba(70,45,15,0.25)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
}
function burlapBump(base) { const t = sackTexture(base); return t; }
let athleteIdx = 0;
function makeAthlete(sackColor, skinColor, shirtColor, name) {
  const idx = athleteIdx++;
  const g = new THREE.Group();
  const burlapTex = sackTexture(sackColor);
  prepareTexture(burlapTex);
  const sackMat = new THREE.MeshStandardMaterial({
    map: burlapTex, roughness: 0.95, roughnessMap: burlapTex, envMapIntensity: 0.7,
    normalMap: normalFromTexture(burlapTex, 2.4), normalScale: new THREE.Vector2(1.0, 1.0),
  });
  const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.05, 14), sackMat);
  sack.position.y = 0.55; sack.castShadow = true; g.add(sack);
  // tied top rim (torus knot-ish rim)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.07, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 1 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.08; g.add(rim);
  // articulated torso pivot at hips
  const torsoPivot = new THREE.Group(); torsoPivot.position.y = 1.08; g.add(torsoPivot);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.45, 4, 10),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }));
  torso.position.y = 0.38; torso.castShadow = true; torsoPivot.add(torso);
  // head pivot at neck with face (eyes) + cap/hair variation
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 6, 14),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 }));
  collar.rotation.x = Math.PI / 2; collar.position.y = 0.66; torsoPivot.add(collar);
  const headPivot = new THREE.Group(); headPivot.position.y = 0.82; torsoPivot.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }));
  head.position.y = 0.24; head.castShadow = true; headPivot.add(head);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeG = new THREE.SphereGeometry(0.032, 8, 6);
  for (const ex of [-0.09, 0.09]) { const e = new THREE.Mesh(eyeG, eyeM); e.position.set(ex, 0.28, 0.23); headPivot.add(e); }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }));
  nose.position.set(0, 0.2, 0.26); headPivot.add(nose);
  if (idx % 2 === 0) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.14, 12),
      new THREE.MeshStandardMaterial({ color: idx === 0 ? 0xe11d2e : 0xffffff, roughness: 0.7 }));
    cap.position.y = 0.47; headPivot.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.2), cap.material);
    brim.position.set(0, 0.42, 0.3); headPivot.add(brim);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, 6.29, 0, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x1f150c, roughness: 0.95 }));
    hair.position.y = 0.26; headPivot.add(hair);
  }
  // articulated arm pivots at shoulders (upper arm groups; legs tucked in sack)
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.38, 0.68, 0); torsoPivot.add(pivot);
    const armMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.62 });
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.46, 4, 10), armMat);
    a.position.y = -0.27; a.castShadow = true; pivot.add(a);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), armMat);
    hand.position.y = -0.55; hand.castShadow = true; pivot.add(hand);
    arms.push(pivot);
  }
  // name sprite
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(256, 64, (gg, w, h) => {
      gg.fillStyle = 'rgba(10,8,6,0.42)'; gg.fillRect(0, 0, w, h);
      gg.fillStyle = '#fff'; gg.font = '800 30px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(name, w / 2, h / 2);
    }), depthTest: false,
  }));
  label.scale.set(1.45, 0.36, 1); label.position.y = 3.05; g.add(label);
  g.userData = { sack, torso, head, arms, torsoPivot, headPivot, rim };
  return g;
}

const racers = [];
{
  const defs = [
    { name: 'KAMU', sack: '#c8a165', skin: 0xf1c27d, shirt: 0xe11d2e, isPlayer: true },
    { name: AI_CONF[0].name, sack: '#a98a52', skin: 0xc68642, shirt: AI_CONF[0].color },
    { name: AI_CONF[1].name, sack: '#bda06a', skin: 0x8d5524, shirt: AI_CONF[1].color },
    { name: AI_CONF[2].name, sack: '#9c7c48', skin: 0xffdbac, shirt: AI_CONF[2].color },
  ];
  defs.forEach((d, i) => {
    const mesh = makeAthlete(d.sack, d.skin, d.shirt, d.name);
    const x = (i - (LANES - 1) / 2) * LANE_W;
    mesh.position.set(x, 0, -1.5);
    scene.add(mesh);
    racers.push({
      name: d.name, mesh, lane: i, isPlayer: !!d.isPlayer,
      z: -1.5, y: 0, vy: 0, vz: 0, grounded: true,
      lastSide: null, stamina: 100, stumble: 0, finished: 0, hops: 0,
      ai: d.isPlayer ? null : { ...AI_CONF[i - 1], timer: 1 + Math.random(), side: 0 },
      animT: Math.random() * 5, lean: 0,
    });
  });
}
const player = racers[0];

// ---------- Particles: dust puffs + win confetti ----------
const DUST_N = 240;
const dustPos = new Float32Array(DUST_N * 3);
for (let _i = 0; _i < DUST_N; _i++) dustPos[_i * 3 + 1] = -50; // park unused particles underground
const dustVel = new Float32Array(DUST_N * 3);
const dustLife = new Float32Array(DUST_N);
let dustHead = 0;
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const _dustTex = dotTexture();
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xcbb28a, size: 0.5, map: _dustTex, transparent: true, opacity: 0.55,
  depthWrite: false, alphaTest: 0.02,
}));
dust.frustumCulled = false;
scene.add(dust);
function puff(x, y, z, n = 8) {
  for (let i = 0; i < n; i++) {
    const k = dustHead; dustHead = (dustHead + 1) % DUST_N;
    dustPos[k * 3] = x + (Math.random() - 0.5) * 0.5;
    dustPos[k * 3 + 1] = y + Math.random() * 0.2;
    dustPos[k * 3 + 2] = z + (Math.random() - 0.5) * 0.5;
    dustVel[k * 3] = (Math.random() - 0.5) * 2;
    dustVel[k * 3 + 1] = 1 + Math.random() * 2;
    dustVel[k * 3 + 2] = (Math.random() - 0.5) * 2;
    dustLife[k] = 1;
  }
}
const CONF_N = 500;
const confPos = new Float32Array(CONF_N * 3);
const confVel = new Float32Array(CONF_N * 3);
const confGeo = new THREE.BufferGeometry();
confGeo.setAttribute('position', new THREE.BufferAttribute(confPos, 3));
const confColors = new Float32Array(CONF_N * 3);
{
  const red = new THREE.Color(0xe11d2e), wht = new THREE.Color(0xffffff);
  for (let i = 0; i < CONF_N; i++) {
    const c = i % 2 ? red : wht;
    confColors[i * 3] = c.r; confColors[i * 3 + 1] = c.g; confColors[i * 3 + 2] = c.b;
    confPos[i * 3 + 1] = -10;
  }
}
confGeo.setAttribute('color', new THREE.BufferAttribute(confColors, 3));
const confetti = new THREE.Points(confGeo, new THREE.PointsMaterial({
  size: 0.26, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
}));
confetti.frustumCulled = false;
scene.add(confetti);
let confettiOn = false;
function launchConfetti(x, z) {
  confettiOn = true;
  for (let i = 0; i < CONF_N; i++) {
    confPos[i * 3] = x + (Math.random() - 0.5) * 8;
    confPos[i * 3 + 1] = 5 + Math.random() * 6;
    confPos[i * 3 + 2] = z + (Math.random() - 0.5) * 8;
    confVel[i * 3] = (Math.random() - 0.5) * 2;
    confVel[i * 3 + 1] = -1 - Math.random() * 1.5;
    confVel[i * 3 + 2] = (Math.random() - 0.5) * 2;
  }
}

// ---------- Sound: WebAudio oscillators, no assets ----------
let AC = null, soundOn = true;
function ac() {
  try {
    if (!AC) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      AC = new Ctx();
    }
    if (AC && AC.state === 'suspended') AC.resume();
  } catch { /* audio unavailable — game must still start */ }
  return AC;
}
function tone(f0, f1, dur, type = 'sine', vol = 0.18, delay = 0) {
  if (!soundOn) return;
  try {
    const a = ac(), t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch { /* audio unavailable */ }
}
const sfx = {
  hop: (good) => good ? tone(280, 620, 0.16, 'sine', 0.22) : tone(200, 300, 0.12, 'triangle', 0.12),
  jump: () => tone(350, 800, 0.22, 'square', 0.08),
  land: () => tone(140, 70, 0.1, 'sine', 0.12),
  stumble: () => { tone(160, 60, 0.35, 'sawtooth', 0.2); tone(90, 50, 0.3, 'square', 0.12, 0.05); },
  beep: (hi) => tone(hi ? 880 : 440, hi ? 880 : 440, hi ? 0.4 : 0.18, 'square', 0.15),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.2, i * 0.16)),
  lose: () => [400, 350, 300, 220].forEach((f, i) => tone(f, f * 0.9, 0.3, 'sawtooth', 0.1, i * 0.18)),
};

// ---------- Ambience: wind, crowd murmur, cicadas (synthesised) ----------
const Amb = {
  master: null, on: true,
  start() {
    const ctx = ac(); if (!ctx || this.master) return;
    const master = ctx.createGain();
    master.gain.value = 0.0001; master.connect(ctx.destination);
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 4);
    this.master = master;
    const len = Math.floor(ctx.sampleRate * 4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.6; }
    const layer = (type, freq, q, gain) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(f).connect(g).connect(master); src.start();
      return g;
    };
    const wind = layer('lowpass', 440, 0.7, 0.05);
    layer('bandpass', 800, 1.4, 0.022);   // village crowd
    layer('bandpass', 2000, 0.8, 0.006);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.028;
    lfo.connect(lfoG).connect(wind.gain); lfo.start();
    const chirp = () => {
      if (!this.on) { setTimeout(chirp, 1600); return; }
      const t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 4200 + Math.random() * 1000;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.011, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
      o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
      setTimeout(chirp, 1500 + Math.random() * 3000);
    };
    setTimeout(chirp, 1200);
  },
  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.5 : 0.0001, this.master.context.currentTime, 0.25);
    if (v) this.start();
  },
};
addEventListener('pointerdown', () => Amb.start(), { once: true });
addEventListener('keydown', () => Amb.start(), { once: true });

// ---------- Ambient life: birds + wind-blown leaves ----------
const birds = [];
{
  const wingGeo = new THREE.PlaneGeometry(0.44, 0.17, 2, 1);
  const birdMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 2, 6), birdMat);
    body.rotation.z = Math.PI / 2; b.add(body);
    const pivL = new THREE.Group(); const wL = new THREE.Mesh(wingGeo, birdMat); wL.position.x = -0.21; pivL.add(wL); b.add(pivL);
    const pivR = new THREE.Group(); const wR = new THREE.Mesh(wingGeo, birdMat); wR.position.x = 0.21; pivR.add(wR); b.add(pivR);
    b.userData = { pivL, pivR, r: 24 + i * 5, y: 17 + (i % 3) * 4, a: Math.random() * 6.28, speed: 0.05 + Math.random() * 0.04 };
    scene.add(b); birds.push(b);
  }
}
const LEAF_N = 26;
const leafGeo = new THREE.BufferGeometry();
const leafPos = new Float32Array(LEAF_N * 3);
const leafSeed = new Float32Array(LEAF_N);
for (let i = 0; i < LEAF_N; i++) {
  leafPos[i * 3] = (Math.random() - 0.5) * 30;
  leafPos[i * 3 + 1] = 0.25 + Math.random() * 5;
  leafPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
  leafSeed[i] = Math.random() * 6.28;
}
leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
scene.add(new THREE.Points(leafGeo, new THREE.PointsMaterial({
  color: 0xc7a35c, size: 0.1, transparent: true, opacity: 0.75, depthWrite: false,
})));

// ---------- Game state ----------
let state = 'menu'; // menu | countdown | racing | finished
let raceTime = 0, results = [];
const hud = document.getElementById('hud');
const elTime = document.getElementById('hud-time');
const elDist = document.getElementById('hud-dist');
const elPos = document.getElementById('hud-pos');
const elProg = document.getElementById('progress-fill');
const elStam = document.getElementById('stamina-fill');

function doHop(r, side, big = false) {
  if (r.stumble > 0 || r.finished) return;
  const alternate = r.lastSide !== null && r.lastSide !== side;
  const good = r.lastSide === null || alternate;
  r.lastSide = side;
  const stamF = 0.45 + 0.55 * (r.stamina / 100);
  const power = (good ? 1.0 : 0.35) * stamF * (big ? 1.35 : 1.0);
  if (r.grounded) {
    r.vy = (big ? 4.6 : 3.4) * (0.7 + 0.3 * power);
    r.vz = (big ? 3.4 : 2.6) * power;
    r.grounded = false;
    r.hops++;
    r.stamina = Math.max(0, r.stamina - (big ? 7 : 3.5));
    r.lean = side === 'L' ? -0.35 : 0.35;
    const x = r.mesh.position.x;
    puff(x, 0.1, r.z, good ? 8 : 3);
    if (r.isPlayer) sfx.hop(good);
  }
}
function doJump(r) { // SPACE: higher jump to clear obstacles, small forward boost
  if (state !== 'racing' || r.stumble > 0 || r.finished) return;
  if (r.grounded) {
    r.vy = 5.2; r.vz = Math.max(r.vz, 2.2); r.grounded = false;
    r.stamina = Math.max(0, r.stamina - 6);
    if (r.isPlayer) sfx.jump();
    puff(r.mesh.position.x, 0.1, r.z, 6);
  }
}
function stumble(r) {
  r.stumble = 1.1; r.vz = 0; r.vy = 1.2; r.grounded = false;
  if (r.isPlayer) { sfx.stumble(); camShake = 0.4; flashHint('⚠️ Tersandung kardus! Lompat dengan SPACE! / Stumbled! Use SPACE!'); }
  puff(r.mesh.position.x, 0.4, r.z, 14);
}
let hintTimer = null;
function flashHint(msg) {
  const h = document.getElementById('hint');
  h.textContent = msg;
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    h.textContent = 'Gantian tekan ⬅️ ➡️ / A D untuk melompat! • Alternate LEFT-RIGHT to hop! • SPACE = lompat rintangan';
  }, 2200);
}

// ---------- Input: keyboard + touch ----------
function press(side) {
  if (state !== 'racing') return;
  doHop(player, side);
}
addEventListener('keydown', (e) => {
  if (e.repeat && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') { press('L'); e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { press('R'); e.preventDefault(); }
  else if (e.code === 'Space') {
    if (state === 'racing') { doJump(player); e.preventDefault(); }
    else if (state === 'menu') startCountdown();
  } else if (e.code === 'Enter') {
    if (state === 'menu') startCountdown();
    else if (state === 'finished') restart();
  } else if (e.code === 'KeyR') { restart(); }
  else if (e.code === 'KeyC') {
    followCam = !followCam; controls.enabled = !followCam;
    flashHint(followCam ? '📷 Kamera ikut / Follow cam' : '📷 Kamera bebas — drag untuk orbit! / Free orbit cam');
  }
});
function bindTouch(id, fn) {
  const el = document.getElementById(id);
  const h = (e) => { e.preventDefault(); fn(); };
  el.addEventListener('pointerdown', h);
  el.addEventListener('touchstart', h, { passive: false });
}
bindTouch('t-left', () => press('L'));
bindTouch('t-right', () => press('R'));
bindTouch('t-jump', () => { if (state === 'racing') doJump(player); });

// ---------- Flow: start / countdown / finish / restart ----------
const cdEl = document.getElementById('countdown');
function startCountdown() {
  if (state === 'countdown' || state === 'racing') return;
  resetRace();
  document.getElementById('overlay-start').classList.add('hidden');
  document.getElementById('overlay-result').classList.add('hidden');
  hud.classList.remove('hidden');
  document.getElementById('touch').classList.remove('hidden');
  state = 'countdown';
  let n = 3;
  cdEl.classList.remove('hidden'); cdEl.textContent = n;
  sfx.beep(false);
  const iv = setInterval(() => {
    n--;
    if (n <= 0) {
      clearInterval(iv);
      cdEl.textContent = 'MULAI! 🏁';
      sfx.beep(true);
      setTimeout(() => { cdEl.classList.add('hidden'); state = 'racing'; }, 600);
    } else { cdEl.textContent = n; sfx.beep(false); }
  }, 800);
}
function resetRace() {
  raceTime = 0; results = []; confettiOn = false;
  for (const j of confPos) { /* keep */ }
  for (let i = 0; i < CONF_N; i++) confPos[i * 3 + 1] = -10;
  confGeo.attributes.position.needsUpdate = true;
  for (const r of racers) {
    r.z = -1.5; r.y = 0; r.vy = 0; r.vz = 0; r.grounded = true;
    r.lastSide = null; r.stamina = 100; r.stumble = 0; r.finished = 0; r.hops = 0; r.lean = 0;
    if (r.ai) r.ai.timer = 1 + Math.random() * 1.5;
    r.mesh.position.z = r.z; r.mesh.position.y = 0; r.mesh.rotation.set(0, 0, 0);
  }
}
function finishRace() {
  state = 'finished';
  const order = [...racers].sort((a, b) => (a.finished || 1e9) - (b.finished || 1e9));
  const meRank = order.indexOf(player) + 1;
  const won = meRank === 1;
  document.getElementById('result-title').textContent = won ? '🏆 MENANG! MERDEKA! 🎉' : `P${meRank} — ${won ? '' : 'Kalah, coba lagi!'}`;
  document.getElementById('result-sub').textContent = won
    ? 'Kamu pemenang Balap Karung! / You won the sack race!'
    : 'Kamu kalah kali ini / You lost this time — semangat!';
  const list = document.getElementById('result-list');
  list.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  order.forEach((r, i) => {
    const li = document.createElement('li');
    if (r.isPlayer) li.className = 'me';
    const label = r.isPlayer ? `${r.name} (KAMU/YOU)` : r.name;
    li.textContent = `${medals[i]} ${label} — ${(r.finished).toFixed(1)}s`;
    list.appendChild(li);
  });
  document.getElementById('result-time').textContent =
    `Waktumu / Your time: ${player.finished ? player.finished.toFixed(1) + 's' : '—'} • Lompatan / Hops: ${player.hops}`;
  document.getElementById('overlay-result').classList.remove('hidden');
  launchConfetti(player.mesh.position.x, TRACK_LEN);
  if (won) sfx.win(); else sfx.lose();
}
function restart() {
  document.getElementById('overlay-result').classList.add('hidden');
  startCountdown();
}
document.getElementById('btn-start').addEventListener('click', () => { try { ac(); } catch {} startCountdown(); });
window.__booted = true;
document.getElementById('btn-restart').addEventListener('click', restart);
document.getElementById('btn-sound').addEventListener('click', (e) => {
  soundOn = !soundOn;
  Amb.setOn(soundOn);
  e.target.textContent = soundOn ? '🔊 Suara: ON' : '🔇 Suara: OFF';
});

// ---------- Physics + AI + HUD ----------
function updateRacer(r, dt) {
  // stamina regen
  r.stamina = Math.min(100, r.stamina + 7 * dt);
  if (r.stumble > 0) r.stumble -= dt;
  if (!r.grounded || Math.abs(r.vz) > 0.01) {
    const prevZ = r.z;
    r.vy -= 12 * dt;
    r.y += r.vy * dt;
    r.z += r.vz * dt;
    r.vz *= (1 - 1.6 * dt); // friction
    if (r.y <= 0) {
      const impact = Math.abs(r.vy); // landing impact scales dust + shake + furrow
      r.y = 0; r.vy = 0; r.vz = 0; r.grounded = true;
      if (state === 'racing' && !r.finished) {
        puff(r.mesh.position.x, 0.1, r.z, Math.min(18, 4 + impact * 2 | 0));
        if (window.__spawnFurrow) window.__spawnFurrow(r.mesh.position.x, r.z);
        if (r.isPlayer) { sfx.land(); camShake = Math.min(0.35, impact * 0.06); }
      }
    }
    // obstacle collision: crossing an obstacle line while low = stumble
    for (const oz of OBSTACLES) {
      if (prevZ < oz - 0.3 && r.z >= oz - 0.3 && r.z <= oz + 0.5 && r.y < 0.55 && r.stumble <= 0 && !r.finished) {
        stumble(r);
        r.z = oz - 0.6;
        break;
      }
    }
  }
  if (r.z >= TRACK_LEN && !r.finished) {
    r.finished = raceTime;
    results.push(r);
    puff(r.mesh.position.x, 0.5, r.z, 20);
    if (results.length >= racers.length) finishRace();
    else if (r.isPlayer) { launchConfetti(r.mesh.position.x, TRACK_LEN); sfx.win(); }
  }
  // squash-stretch + lean animation
  r.animT += dt * 6;
  const u = r.mesh.userData;
  const air = THREE.MathUtils.clamp(r.y / 1.2, 0, 1);
  const squash = r.grounded ? 1 + Math.sin(r.animT * 0.6) * 0.02 : 1 + air * 0.25;
  const inv = 1 / Math.sqrt(squash);
  u.sack.scale.set(inv, squash, inv);
  r.lean *= (1 - 3 * dt);
  r.mesh.rotation.z = r.lean + (r.grounded ? 0 : r.lean * 0.5);
  r.mesh.rotation.x = r.grounded ? 0 : -0.12 * air;
  // physics-driven: swing phase tied to forward velocity + vertical effort
  const speedPhase = r.animT * (1 + Math.abs(r.vz) * 0.6) + Math.abs(r.vy) * 0.35;
  const sw = Math.sin(speedPhase) * (r.grounded ? 0.2 : 0.85);
  const flail = (r.vy) * 0.18; // angular-velocity flail
  u.arms[0].rotation.z = 0.12 + sw + flail; u.arms[1].rotation.z = -0.12 - sw - flail;
  u.arms[0].rotation.x = -0.12 - air * 0.5 + sw * 0.25; u.arms[1].rotation.x = -0.12 - air * 0.5 - sw * 0.25;
  if (u.torsoPivot) u.torsoPivot.rotation.x = -0.08 - air * 0.22 + Math.abs(r.vz) * 0.03; // torso lean into hop
  if (u.headPivot) { u.headPivot.position.y = 0.82 + Math.sin(r.animT * 2) * 0.03 + air * 0.06; u.headPivot.rotation.x = air * 0.15; }
  if (u.rim) u.rim.scale.setScalar(1 / Math.sqrt(squash));
  r.mesh.position.set(r.mesh.position.x, r.y, r.z);
}
function updateAI(r, dt) {
  if (state !== 'racing' || r.finished) return;
  const a = r.ai;
  a.timer -= dt;
  if (a.timer <= 0) {
    // slow near obstacles unless jumping well
    const near = OBSTACLES.some((oz) => oz - r.z < 2.2 && oz - r.z > 0);
    if (near && Math.random() < a.jump && r.grounded) doJump(r);
    else {
      a.side = 1 - a.side;
      doHop(r, a.side ? 'R' : 'L');
      if (Math.random() < 0.06) doHop(r, a.side ? 'R' : 'L'); // occasional double-step mistake
    }
    a.timer = a.interval * (0.85 + Math.random() * 0.35) * (r.stamina < 20 ? 1.35 : 1);
  }
}
function playerRank() {
  const order = [...racers].sort((a, b) => b.z - a.z);
  return order.indexOf(player) + 1;
}
const rankLabel = ['P1 🥇', 'P2 🥈', 'P3 🥉', 'P4'];
function updateHUD() {
  elTime.textContent = `⏱ ${raceTime.toFixed(1)}s`;
  const d = Math.max(0, Math.min(TRACK_LEN, player.z));
  elDist.textContent = `${d.toFixed(1)} m / ${TRACK_LEN} m`;
  const rk = playerRank();
  elPos.textContent = rankLabel[rk - 1];
  elProg.style.width = `${(d / TRACK_LEN) * 100}%`;
  elStam.style.width = `${player.stamina}%`;
  elStam.classList.toggle('low', player.stamina < 30);
}

// ---------- Camera ----------
function updateCamera(dt) {
  if (!followCam) { controls.update(); return; }
  const px = player.mesh.position.x, pz = player.z;
  const tt = clock.elapsedTime;
  const swayX = Math.sin(tt * 0.71) * 0.06 + Math.sin(tt * 2.1 + 0.6) * 0.022;
  const swayY = Math.sin(tt * 0.93 + 1.2) * 0.04;
  _camTarget.set(px * 0.55 + swayX, 4.4 + swayY, pz - 7.5); // follow with lag (lerp)
  camera.position.lerp(_camTarget, 1 - Math.pow(0.001, dt));
  if (camShake > 0.003) {
    camera.position.x += (Math.random() - .5) * camShake; camera.position.y += (Math.random() - .5) * camShake * 0.7;
    camShake *= Math.pow(0.001, dt); // decay
  }
  _tmpV.set(px * 0.7, 1.4, pz + 4); camera.lookAt(_tmpV);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (state === 'racing') {
    raceTime += dt;
    for (const r of racers) if (!r.isPlayer) updateAI(r, dt);
    updateHUD();
  }
  if (state === 'racing' || state === 'finished' || state === 'menu') {
    for (const r of racers) updateRacer(r, dt);
    if (state !== 'racing') updateHUD();
  }
  // ambient: clouds drift, crowd jump+wave, flag vertex wave, furrows fade
  const gust = 0.72 + 0.34 * Math.sin(t * 0.4) + 0.16 * Math.sin(t * 1.85 + 0.7);
  for (const cl of clouds) { cl.position.x += cl.userData.v * gust * dt; if (cl.position.x > 90) cl.position.x = -90; }
  // birds wheel over the village; leaves ride the gust
  for (const b of birds) {
    const u = b.userData;
    u.a += u.speed * dt * (1 + gust * 0.5);
    b.position.set(Math.cos(u.a) * u.r, u.y + Math.sin(t * 0.7 + u.a) * 1.2, Math.sin(u.a) * u.r + 20);
    b.rotation.y = -u.a + Math.PI / 2;
    const flap = Math.sin(t * 9 + u.a * 3) * 0.62;
    u.pivL.rotation.z = flap; u.pivR.rotation.z = -flap;
  }
  for (let i = 0; i < LEAF_N; i++) {
    leafPos[i * 3] += (0.3 + gust * 0.85) * dt;
    leafPos[i * 3 + 1] += Math.sin(t * 1.6 + leafSeed[i]) * dt * 0.25;
    leafPos[i * 3 + 2] += Math.cos(t * 1.05 + leafSeed[i]) * dt * 0.2;
    if (leafPos[i * 3] > 16) { leafPos[i * 3] = -16; leafPos[i * 3 + 2] = (Math.random() - 0.5) * 14; }
  }
  leafGeo.attributes.position.needsUpdate = true;
  for (const c of crowd) {
    c.position.y = Math.abs(Math.sin(t * 3 + c.userData.phase)) * 0.18;
    if (c.userData.armL) { const w = Math.sin(t * 4 + c.userData.phase) * 0.7; c.userData.armL.rotation.z = 2.6 + w; c.userData.armR.rotation.z = -2.6 - w; }
  }
  for (const f of flags) { // waving plane: vertex sin wave
    f.rotation.y = Math.sin(t * 2.2 + f.position.z) * 0.3;
    const pos = f.geometry.attributes.position;
    for (let vi = 0; vi < pos.count; vi++) { const x = pos.getX(vi); pos.setZ(vi, Math.sin(t * 6 + x * 3 + f.position.z) * 0.09 * gust * (x + 0.6)); }
    pos.needsUpdate = true;
  }
  if (window.__furrows) for (const f of window.__furrows) if (f.userData.life > 0) { f.userData.life -= dt * 0.25; f.material.opacity = Math.max(0, f.userData.life * 0.55); }
  buntGroup.children.forEach((m, i) => {
    if (m.userData.phase !== undefined) m.rotation.y = Math.sin(t * 2 + m.userData.phase + i) * 0.3 * gust;
  });
  // dust
  for (let i = 0; i < DUST_N; i++) {
    if (dustLife[i] > 0) {
      dustLife[i] -= dt * 1.4;
      dustPos[i * 3] += dustVel[i * 3] * dt;
      dustPos[i * 3 + 1] += dustVel[i * 3 + 1] * dt;
      dustPos[i * 3 + 2] += dustVel[i * 3 + 2] * dt;
      if (dustLife[i] <= 0) dustPos[i * 3 + 1] = -50;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
  // confetti
  if (confettiOn) {
    for (let i = 0; i < CONF_N; i++) {
      confPos[i * 3] += (confVel[i * 3] + Math.sin(t * 3 + i) * 0.8) * dt;
      confPos[i * 3 + 1] += confVel[i * 3 + 1] * dt;
      confPos[i * 3 + 2] += confVel[i * 3 + 2] * dt;
      if (confPos[i * 3 + 1] < 0) confPos[i * 3 + 1] = 6 + Math.random() * 3;
    }
    confGeo.attributes.position.needsUpdate = true;
  }
  // idle menu camera drift
  if (state === 'menu') {
    _tmpV2.set(Math.sin(t * 0.2) * 8, 6, -8 + Math.cos(t * 0.15) * 2);
    camera.position.lerp(_tmpV2, 0.02);
    camera.lookAt(0, 1.5, 12);
  } else {
    updateCamera(dt);
  }
  sun.position.z = player.z - 12;
  sun.target.position.set(0, 0, player.z + 6);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
