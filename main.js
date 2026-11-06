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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x9fc3e5, 40, 140);

const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 4.2, -7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enabled = false; // follow-cam default; press C for free orbit
let followCam = true;

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6b5b3e, 0.85));
const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
sun.position.set(-18, 30, -12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -20;
sun.shadow.camera.far = 100;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.3);
fill.position.set(15, 10, 20);
scene.add(fill);

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
});
dirtTex.wrapS = dirtTex.wrapT = THREE.RepeatWrapping;
dirtTex.repeat.set(4, 12);

const grassTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3f8f3a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${30 + Math.random() * 60 | 0},${120 + Math.random() * 80 | 0},40,0.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 3);
  }
});
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(10, 20);

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
const grass = new THREE.Mesh(new THREE.PlaneGeometry(120, 160),
  new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.02, 25); grass.receiveShadow = true;
scene.add(grass);

const trackW = LANES * LANE_W + 1.4;
const dirt = new THREE.Mesh(new THREE.PlaneGeometry(trackW + 10, TRACK_LEN + 26),
  new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1 }));
dirt.rotation.x = -Math.PI / 2; dirt.position.set(0, 0, TRACK_LEN / 2); dirt.receiveShadow = true;
scene.add(dirt);

for (let i = 0; i < LANES; i++) {
  const x = (i - (LANES - 1) / 2) * LANE_W;
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W - 0.25, TRACK_LEN),
    new THREE.MeshStandardMaterial({ color: i % 2 ? 0xa4713f : 0x9c683c, roughness: 1 }));
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
      p.position.set(sx * (trackW / 2 + 3.6 + Math.random() * 1.4), 0, z + (Math.random() - 0.5));
      p.userData.phase = Math.random() * 6.28;
      scene.add(p); crowd.push(p);
    }
  }
}
// Obstacles: cardboard boxes (kardus) across every lane
const obstacleMeshes = [];
{
  const boxMat = new THREE.MeshStandardMaterial({ color: 0xb07a3f, roughness: 0.95 });
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
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,60,20,0.5)';
    for (let y = 8; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '900 44px Arial'; g.textAlign = 'center';
    g.fillText('17', w / 2, h / 2 + 8);
  });
}
function makeAthlete(sackColor, skinColor, shirtColor, name) {
  const g = new THREE.Group();
  const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.05, 12),
    new THREE.MeshStandardMaterial({ map: sackTexture(sackColor), roughness: 0.95 }));
  sack.position.y = 0.55; sack.castShadow = true; g.add(sack);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.45, 4, 10),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 }));
  torso.position.y = 1.45; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12),
    new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 }));
  head.position.y = 2.15; head.castShadow = true; g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.28, 0.14, 12),
    new THREE.MeshStandardMaterial({ color: 0xe11d2e, roughness: 0.7 }));
  cap.position.y = 2.38; g.add(cap);
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 3, 8),
      new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.7 }));
    a.position.set(sx * 0.45, 1.5, 0); a.castShadow = true; g.add(a); arms.push(a);
  }
  // name sprite
  const label = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTex(256, 64, (gg, w, h) => {
      gg.fillStyle = 'rgba(0,0,0,0.65)'; gg.fillRect(0, 0, w, h);
      gg.fillStyle = '#fff'; gg.font = '800 30px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
      gg.fillText(name, w / 2, h / 2);
    }), depthTest: false,
  }));
  label.scale.set(2.2, 0.55, 1); label.position.y = 2.85; g.add(label);
  g.userData = { sack, torso, head, arms };
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
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xcbb28a, size: 0.35, transparent: true, opacity: 0.8, depthWrite: false,
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
  size: 0.3, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false,
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
  if (r.isPlayer) { sfx.stumble(); flashHint('⚠️ Tersandung kardus! Lompat dengan SPACE! / Stumbled! Use SPACE!'); }
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
      r.y = 0; r.vy = 0; r.vz = 0; r.grounded = true;
      if (state === 'racing' && !r.finished) { puff(r.mesh.position.x, 0.1, r.z, 4); if (r.isPlayer) sfx.land(); }
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
  const sw = Math.sin(r.animT) * (r.grounded ? 0.15 : 0.7);
  u.arms[0].rotation.z = 0.5 + sw; u.arms[1].rotation.z = -0.5 + sw;
  u.arms[0].rotation.x = -air * 0.9; u.arms[1].rotation.x = -air * 0.9;
  u.head.position.y = 2.15 + air * 0.08;
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
  const tx = px * 0.55, tz = pz - 7.5, ty = 4.4;
  camera.position.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.001, dt));
  camera.lookAt(px * 0.7, 1.4, pz + 4);
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
  // ambient animation: crowd bounce, flags wave, bunting flutter
  for (const c of crowd) c.position.y = Math.abs(Math.sin(t * 3 + c.userData.phase)) * 0.18;
  for (const f of flags) f.rotation.y = Math.sin(t * 2.2 + f.position.z) * 0.35;
  buntGroup.children.forEach((m, i) => {
    if (m.userData.phase !== undefined) m.rotation.y = Math.sin(t * 2 + m.userData.phase + i) * 0.3;
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
    camera.position.lerp(new THREE.Vector3(Math.sin(t * 0.2) * 8, 6, -8 + Math.cos(t * 0.15) * 2), 0.02);
    camera.lookAt(0, 1.5, 12);
  } else {
    updateCamera(dt);
  }
  sun.target.position.set(0, 0, player.z + 5);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
