/* =====================================================================
   GAMING MINIGAME — 3D neon highway (Three.js)
   Contract used by app.js:
     createGame(rootEl, { onEnd(results) }) -> { destroy() }
     results = { upgrades: string[], timeSec: number, crashes: number }

   Every "performance" effect (low fps, low resolution, stutter) is
   SIMULATED, so it looks the same on any PC. The simulation always runs
   at a smooth fixed step; only what gets drawn is throttled.
   ===================================================================== */
(() => {
const { sprite } = window.Sprites;

/* Three.js modules, loaded from the CDN (see the importmap in index.html) by loadGame(). */
let THREE, RoundedBoxGeometry, EffectComposer, RenderPass, UnrealBloomPass, OutputPass;
let loading = null;
function loadGame() {
  loading ??= Promise.all([
    import('three'),
    import('three/addons/geometries/RoundedBoxGeometry.js'),
    import('three/addons/postprocessing/EffectComposer.js'),
    import('three/addons/postprocessing/RenderPass.js'),
    import('three/addons/postprocessing/UnrealBloomPass.js'),
    import('three/addons/postprocessing/OutputPass.js'),
  ]).then(([three, rb, ec, rp, ub, op]) => {
    THREE = three;
    ({ RoundedBoxGeometry } = rb); ({ EffectComposer } = ec); ({ RenderPass } = rp);
    ({ UnrealBloomPass } = ub); ({ OutputPass } = op);
    return { createGame };
  });
  return loading;
}

/* ---------- Copy shown in-game (edit freely) ---------- */
const COPY = {
  upgrades: [
    { title: 'Increased frame rate', note: 'Intel® Arc™ graphics keep gameplay smooth' },
    { title: 'AI Upscaling',         note: 'Intel® XeSS uses AI to render crisp, detailed visuals' },
    { title: 'Reduced lag',          note: 'Intel® Core™ Ultra keeps every move responsive, even in a rush' },
  ],
  modes: ['NORMAL PC', 'SMOOTH 60 FPS', 'AI UPSCALED', 'AI PC: MAX'],
  traffic: 'HEAVY TRAFFIC AHEAD!',
  trafficSub: 'Your PC is struggling...',
  crash: 'CRASH!',
  crashSub: 'Slowed down',
  finish: 'FINISH!',
};

/* ---------- Tuning ---------- */
const CFG = {
  speed: 26,                 // player speed, units/s
  trafficSpeed: 6,           // traffic moves forward too, so it approaches at speed - this
  lanes: [-3, 0, 3],
  spawnZ: -165,
  despawnZ: 16,
  lowResHeight: 170,         // internal render height in the "normal PC" stages
  basicFps: 15,
  smoothFps: 60,
  // distances (units travelled) that drive the story
  coin1After: 190,
  coin2After: 230,
  congestionAfter: 170,
  stutterAfter: 40,          // into congestion, once the jam reaches the car
  coin3After: 250,           // into congestion
  finishAfter: 210,
  crashSlow: 0.3,
  crashRecover: 1.6,
  invulnerable: 1.4,
};

const COL = {
  navy: 0x030814, navy2: 0x061235, blue: 0x1a73ff, blueHi: 0x6aaeff, deep: 0x0b2f9e,
  gold: 0xffc83d, white: 0xffffff, slate: 0x2b3756, slateDk: 0x161d33, ink: 0x0a0f1e,
};

/* Auto quality for the "good" stages, in case the real device struggles. */
const QUALITY = [
  { pr: 2,    shadow: 2048, bloomScale: 1   },
  { pr: 1.25, shadow: 1024, bloomScale: 0.6 },
  { pr: 0.8,  shadow: 0,    bloomScale: 0.5 },
];

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* =====================================================================
   Textures
   ===================================================================== */
function roadCanvas(linesOnly) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = linesOnly ? '#000' : '#0a1230';
  g.fillRect(0, 0, 128, 128);
  if (!linesOnly) { // subtle asphalt noise
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(80,120,220,${Math.random() * 0.08})`;
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  }
  g.fillStyle = linesOnly ? '#fff' : '#1a73ff';
  g.fillRect(2, 0, 4, 128);          // edges
  g.fillRect(122, 0, 4, 128);
  g.fillStyle = linesOnly ? '#fff' : '#9cc6ff';
  g.fillRect(41, 0, 3, 64);          // dashed lane lines
  g.fillRect(84, 0, 3, 64);
  return c;
}

function makeRoadTex(linesOnly, nearest) {
  const t = new THREE.CanvasTexture(roadCanvas(linesOnly));
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 40);
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  else t.anisotropy = 8;
  t.colorSpace = linesOnly ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function horizonTexture() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, 'rgba(3,8,20,0)');
  grd.addColorStop(0.7, 'rgba(26,115,255,.35)');
  grd.addColorStop(1, 'rgba(106,174,255,.6)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* Blue-tinted environment so reflections match the palette. */
function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x040a1c, side: THREE.BackSide }));
  env.add(room);
  const panel = (color, x, y, z, w, h, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; m.lookAt(0, 0, 0); env.add(m);
  };
  panel(0xffffff, 0, 9, 0, 8, 8);
  panel(0x1a73ff, -9, 2, 0, 6, 10);
  panel(0x1a73ff, 9, 2, 0, 6, 10);
  panel(0x6aaeff, 0, 3, -9, 14, 4);
  panel(0x0b2f9e, 0, 3, 9, 14, 4);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

/* =====================================================================
   HUD
   ===================================================================== */
const HUD_HTML = `
  <canvas class="game-canvas is-pixelated"></canvas>
  <div class="hud">
    <div class="hud-fps hex">
      <div class="hud-fps-row"><span class="hud-k">FPS</span><span class="hud-v" data-fps>--</span></div>
      <div class="hud-mode" data-hudmode>NORMAL PC</div>
    </div>
    <div class="hud-top">
      <div class="hud-coins">
        <span class="hud-slot" data-slot="0" data-sprite-coin></span>
        <span class="hud-slot" data-slot="1" data-sprite-coin></span>
        <span class="hud-slot" data-slot="2" data-sprite-coin></span>
      </div>
      <div class="hud-meta"><span data-time>0:00</span><span class="hud-sep">·</span><span>CRASHES <b data-crashes>0</b></span></div>
    </div>
    <div class="hud-warn" data-warn hidden>&#9888; LAG DETECTED</div>
    <div class="hud-banner" data-banner>
      <div class="banner-kicker" data-bkicker></div>
      <div class="banner-title" data-btitle></div>
      <div class="banner-note" data-bnote></div>
    </div>
    <div class="hud-flash" data-flash></div>
    <button class="hex hex-btn touch-btn touch-btn--left" data-steer="-1" aria-label="Steer left">&#9664;</button>
    <button class="hex hex-btn touch-btn touch-btn--right" data-steer="1" aria-label="Steer right">&#9654;</button>
  </div>`;

/* =====================================================================
   Game
   ===================================================================== */
function createGame(root, { onEnd }) {
  root.innerHTML = HUD_HTML;
  root.querySelectorAll('[data-sprite-coin]').forEach(el => { el.innerHTML = sprite('coin'); });
  const ui = {
    canvas: root.querySelector('canvas'),
    fps: root.querySelector('[data-fps]'),
    mode: root.querySelector('[data-hudmode]'),
    time: root.querySelector('[data-time]'),
    crashes: root.querySelector('[data-crashes]'),
    warn: root.querySelector('[data-warn]'),
    banner: root.querySelector('[data-banner]'),
    bKicker: root.querySelector('[data-bkicker]'),
    bTitle: root.querySelector('[data-btitle]'),
    bNote: root.querySelector('[data-bnote]'),
    flash: root.querySelector('[data-flash]'),
    slots: [...root.querySelectorAll('[data-slot]')],
  };

  /* ---------- Renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: ui.canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.navy);
  scene.fog = new THREE.Fog(COL.navy, 55, 165);
  scene.environment = makeEnvironment(renderer);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
  camera.position.set(0, 4.3, 8.6);

  /* ---------- Materials (basic = "normal PC", rich = AI PC) ---------- */
  const tex = {
    roadBasic: makeRoadTex(false, true),
    roadRich: makeRoadTex(false, false),
    roadLines: makeRoadTex(true, false),
    glow: glowTexture(),
    horizon: horizonTexture(),
  };
  const B = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, ...extra });
  const S = (o) => new THREE.MeshStandardMaterial(o);
  const MATS = {
    basic: {
      road: B(0xffffff, { map: tex.roadBasic }),
      ground: B(0x050c22),
      building: B(0x0c1c48),
      lampPole: B(0x22305a),
      lampCap: B(COL.blueHi),
      carBody: B(COL.blue),
      carCabin: B(COL.deep),
      wheel: B(0x0b0f1a),
      trafBody: B(0x8091b8),
      trafCabin: B(0x26324f),
      trafLight: B(0xdfe8ff),
      coin: B(COL.gold),
    },
    rich: {
      road: S({ map: tex.roadRich, roughness: 0.32, metalness: 0.45, emissive: 0xffffff, emissiveMap: tex.roadLines, emissiveIntensity: 0.35 }),
      ground: S({ color: 0x040a1c, roughness: 0.95, metalness: 0 }),
      building: S({ color: 0x0a1434, roughness: 0.55, metalness: 0.4 }),
      lampPole: S({ color: 0x1b2440, roughness: 0.4, metalness: 0.8 }),
      lampCap: S({ color: COL.blueHi, emissive: COL.blueHi, emissiveIntensity: 1.6 }),
      carBody: new THREE.MeshPhysicalMaterial({ color: COL.blue, metalness: 0.65, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.4 }),
      carCabin: new THREE.MeshPhysicalMaterial({ color: 0x050a18, metalness: 0.9, roughness: 0.05, envMapIntensity: 2 }),
      wheel: S({ color: 0x0b0e16, roughness: 0.8 }),
      trafBody: S({ color: 0x6878a0, roughness: 0.35, metalness: 0.55 }),
      trafCabin: S({ color: 0x0a0f1e, roughness: 0.1, metalness: 0.9 }),
      trafLight: S({ color: 0xffffff, emissive: 0xcfe0ff, emissiveIntensity: 1.6 }),
      coin: S({ color: COL.gold, metalness: 1, roughness: 0.22, emissive: COL.gold, emissiveIntensity: 0.35 }),
    },
  };
  const CAST = new Set(['carBody', 'carCabin', 'wheel', 'trafBody', 'trafCabin', 'coin']);
  const RECEIVE = new Set(['road', 'ground']);
  const edgeMat = new THREE.LineBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.85, fog: true });

  let mode = 'basic';
  const swaps = new Set();
  function skin(mesh, key) {
    mesh.userData.mk = key;
    mesh.material = MATS[mode][key];
    mesh.castShadow = mode === 'rich' && CAST.has(key);
    mesh.receiveShadow = mode === 'rich' && RECEIVE.has(key);
    swaps.add(mesh);
    return mesh;
  }
  function unskin(obj) { obj.traverse(o => swaps.delete(o)); }
  function applyMode(m) {
    mode = m;
    swaps.forEach(mesh => skin(mesh, mesh.userData.mk));
  }

  /* ---------- Lights (only affect rich materials) ---------- */
  const hemi = new THREE.HemisphereLight(COL.blueHi, COL.navy, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xdfe9ff, 1.8);
  sun.position.set(6, 14, 4);
  sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  /* ---------- World ---------- */
  const ROAD_LEN = 400;
  const road = skin(new THREE.Mesh(new THREE.PlaneGeometry(10, ROAD_LEN), MATS.basic.road), 'road');
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -ROAD_LEN / 2 + 20);
  scene.add(road);

  const ground = skin(new THREE.Mesh(new THREE.PlaneGeometry(400, ROAD_LEN), MATS.basic.ground), 'ground');
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.02, -ROAD_LEN / 2 + 20);
  scene.add(ground);

  const grid = new THREE.GridHelper(400, 100, COL.blue, COL.blue);
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.position.set(0, -0.01, -170);
  scene.add(grid);

  const horizon = new THREE.Mesh(new THREE.PlaneGeometry(600, 60),
    new THREE.MeshBasicMaterial({ map: tex.horizon, transparent: true, fog: false, depthWrite: false }));
  horizon.position.set(0, 18, -230);
  scene.add(horizon);

  // City blocks on both sides (recycled)
  const SPAN = 200;
  const buildings = [];
  for (let side of [-1, 1]) {
    for (let i = 0; i < 18; i++) {
      const w = rand(3, 6), h = rand(4, 18), d = rand(4, 9);
      const geo = new THREE.BoxGeometry(w, h, d);
      const m = skin(new THREE.Mesh(geo), 'building');
      m.position.set(side * rand(11, 22), h / 2, -i * (SPAN / 18) + 10);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat);
      edges.visible = false;
      m.add(edges);
      m.userData.edges = edges;
      scene.add(m);
      buildings.push(m);
    }
  }

  // Street lamps along the road edges (recycled)
  const lamps = [];
  const poleGeo = new THREE.BoxGeometry(0.18, 3.2, 0.18);
  const capGeo = new THREE.BoxGeometry(0.9, 0.16, 0.3);
  for (let i = 0; i < 20; i++) {
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      const pole = skin(new THREE.Mesh(poleGeo), 'lampPole');
      pole.position.y = 1.6;
      const cap = skin(new THREE.Mesh(capGeo), 'lampCap');
      cap.position.set(-side * 0.35, 3.2, 0);
      g.add(pole, cap);
      g.position.set(side * 5.8, 0, -i * 10);
      scene.add(g);
      lamps.push(g);
    }
  }

  /* ---------- Player car: blocky (normal) and detailed (AI upscaled) ---------- */
  const car = new THREE.Group();
  scene.add(car);

  const basicCar = new THREE.Group();
  {
    const body = skin(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 3.8)), 'carBody');
    body.position.y = 0.6;
    const cabin = skin(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.8)), 'carCabin');
    cabin.position.set(0, 1.25, 0.3);
    basicCar.add(body, cabin);
    for (const [x, z] of [[-0.95, -1.25], [0.95, -1.25], [-0.95, 1.25], [0.95, 1.25]]) {
      const w = skin(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.55, 0.8)), 'wheel');
      w.position.set(x, 0.3, z);
      basicCar.add(w);
    }
  }
  car.add(basicCar);

  const richCar = new THREE.Group();
  const richWheels = [];
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: COL.blueHi, emissive: COL.blueHi, emissiveIntensity: 2.5 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xc9d6f2, metalness: 1, roughness: 0.2 });
  const underglowMat = new THREE.MeshBasicMaterial({ color: COL.blue, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, map: tex.glow });
  {
    const body = skin(new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.6, 4.1, 5, 0.26)), 'carBody');
    body.position.y = 0.58;
    const nose = skin(new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.3, 1.2, 4, 0.14)), 'carBody');
    nose.position.set(0, 0.86, -1.35);
    nose.rotation.x = 0.12;
    const cabin = skin(new THREE.Mesh(new RoundedBoxGeometry(1.55, 0.58, 2.0, 5, 0.26)), 'carCabin');
    cabin.position.set(0, 1.08, 0.3);
    const spoiler = skin(new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.08, 0.45, 2, 0.04)), 'carBody');
    spoiler.position.set(0, 1.12, 1.85);
    const spoilerL = skin(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.2)), 'carCabin');
    spoilerL.position.set(-0.7, 0.98, 1.85);
    const spoilerR = spoilerL.clone(); skin(spoilerR, 'carCabin'); spoilerR.position.x = 0.7;
    richCar.add(body, nose, cabin, spoiler, spoilerL, spoilerR);

    const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 24);
    const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.36, 12);
    for (const [x, z] of [[-0.98, -1.3], [0.98, -1.3], [-0.98, 1.3], [0.98, 1.3]]) {
      const w = new THREE.Group();
      const tire = skin(new THREE.Mesh(tireGeo), 'wheel');
      const rim = new THREE.Mesh(rimGeo, rimMat);
      w.add(tire, rim);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.4, z);
      richCar.add(w);
      richWheels.push(w);
    }
    for (const x of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.13, 0.1, 2, 0.04), headlightMat);
      hl.position.set(x, 0.72, -2.04);
      richCar.add(hl);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xdfeaff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
      glow.scale.set(1.6, 1.0, 1);
      glow.position.set(x, 0.72, -2.2);
      richCar.add(glow);
      const spot = new THREE.SpotLight(0xe6efff, 60, 45, 0.38, 0.6, 1.4);
      spot.position.set(x, 0.75, -2);
      spot.target.position.set(x * 1.5, 0, -22);
      richCar.add(spot, spot.target);
    }
    const tail = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.1, 0.08, 2, 0.04), tailMat);
    tail.position.set(0, 0.78, 2.05);
    richCar.add(tail);
    const under = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.4), underglowMat);
    under.rotation.x = -Math.PI / 2;
    under.position.y = 0.03;
    richCar.add(under);
  }
  richCar.visible = false;
  car.add(richCar);
  // meshes that blink after a crash (lights stay on to avoid shader recompiles)
  const carMeshes = [];
  car.traverse(o => { if (o.isMesh || o.isSprite) carMeshes.push(o); });
  let carShown = true;

  /* ---------- Traffic ---------- */
  const trafficGeo = {
    body: new THREE.BoxGeometry(1.9, 0.8, 3.9),
    cabin: new THREE.BoxGeometry(1.6, 0.6, 2.0),
    light: new THREE.BoxGeometry(1.7, 0.22, 0.06),
  };
  const traffic = [];
  function spawnTraffic(lane, zOffset = 0) {
    const g = new THREE.Group();
    const body = skin(new THREE.Mesh(trafficGeo.body), 'trafBody');
    body.position.y = 0.62;
    const cabin = skin(new THREE.Mesh(trafficGeo.cabin), 'trafCabin');
    cabin.position.set(0, 1.3, 0.3);
    const light = skin(new THREE.Mesh(trafficGeo.light), 'trafLight');
    light.position.set(0, 0.8, 1.97);
    g.add(body, cabin, light);
    g.position.set(CFG.lanes[lane], 0, CFG.spawnZ + zOffset);
    g.userData = { hit: false, vx: 0, vy: 0, spin: 0 };
    scene.add(g);
    traffic.push(g);
  }
  function removeTraffic(i) {
    const g = traffic[i];
    unskin(g);
    scene.remove(g);
    traffic.splice(i, 1);
  }

  /* ---------- Coin ---------- */
  const coinGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.18, 20);
  const coinGlowMat = new THREE.SpriteMaterial({ map: tex.glow, color: COL.gold, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 });
  let coin = null;
  function spawnCoin() {
    const g = new THREE.Group();
    const disc = skin(new THREE.Mesh(coinGeo), 'coin');
    disc.rotation.x = Math.PI / 2;
    const glow = new THREE.Sprite(coinGlowMat);
    glow.scale.set(4, 4, 1);
    glow.visible = mode === 'rich';
    g.add(disc, glow);
    g.userData.glow = glow;
    g.position.set(CFG.lanes[randInt(0, 2)], 1.3, CFG.spawnZ);
    scene.add(g);
    coin = g;
    coinSpawned = true;
    spawnAcc = -20; // keep a clear stretch of road around the coin
  }

  /* ---------- Particles ---------- */
  // Speed streaks (stage 4 only)
  const STREAKS = 500;
  const streakPos = new Float32Array(STREAKS * 3);
  for (let i = 0; i < STREAKS; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    streakPos[i * 3] = side * rand(4.5, 24);
    streakPos[i * 3 + 1] = rand(0.2, 14);
    streakPos[i * 3 + 2] = rand(-160, 12);
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
  const streaks = new THREE.Points(streakGeo, new THREE.PointsMaterial({
    color: COL.blueHi, size: 0.35, map: tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  streaks.visible = false;
  scene.add(streaks);

  // Coin burst
  const BURST = 90;
  const burstPos = new Float32Array(BURST * 3);
  const burstVel = new Float32Array(BURST * 3);
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
  const burstMat = new THREE.PointsMaterial({ color: COL.gold, size: 0.28, map: tex.glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const burst = new THREE.Points(burstGeo, burstMat);
  burst.visible = false;
  burst.frustumCulled = false;
  scene.add(burst);
  let burstLife = 0;
  function fireBurst(at) {
    for (let i = 0; i < BURST; i++) {
      burstPos[i * 3] = at.x; burstPos[i * 3 + 1] = at.y; burstPos[i * 3 + 2] = at.z;
      const a = Math.random() * Math.PI * 2, u = rand(-1, 1), s = rand(4, 10);
      const r = Math.sqrt(1 - u * u);
      burstVel[i * 3] = r * Math.cos(a) * s; burstVel[i * 3 + 1] = Math.abs(u) * s + 2; burstVel[i * 3 + 2] = r * Math.sin(a) * s;
    }
    burstGeo.attributes.position.needsUpdate = true;
    burstLife = 1;
    burst.visible = true;
  }

  /* ---------- Post-processing (stage 4 bloom) ---------- */
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- State ---------- */
  let stage = 0;                // 0 normal, 1 +fps, 2 +AI upscaling, 3 +reduced lag
  let quality = 0;
  let dist = 0, stageDist = 0, congDist = 0, elapsed = 0;
  let congestion = false, stutter = false, coinSpawned = false, ending = false;
  let spawnAcc = -70, nextGap = 28, prevFree = 1;
  let lane = 1, carX = 0, carTilt = 0;
  let crashT = 0, invulnT = 0, crashes = 0, shake = 0;
  let raf = 0, last = performance.now(), lastRender = 0;
  let hitchUntil = 0, nextHitch = 0, stutterInterval = 40;
  let framesWin = 0, fpsWinStart = performance.now();
  let perfAcc = 0, perfFrames = 0, perfWinStart = performance.now();
  let endTimer = 0, bannerTimer = 0;
  let destroyed = false;

  /* ---------- Stage visuals ---------- */
  function setStage(s) {
    stage = s;
    applyMode(s >= 2 ? 'rich' : 'basic');
    basicCar.visible = s < 2;
    richCar.visible = s >= 2;
    hemi.visible = sun.visible = s >= 2;
    sun.castShadow = s >= 2 && QUALITY[quality].shadow > 0;
    buildings.forEach(b => { b.userData.edges.visible = s >= 2; });
    if (coin) coin.userData.glow.visible = s >= 2;
    ui.canvas.classList.toggle('is-pixelated', s < 2);
    streaks.visible = s >= 3;
    underglowMat.opacity = s >= 3 ? 0.9 : 0;
    const neon = s >= 3;
    edgeMat.color.setRGB(...(neon ? [0.25, 0.7, 2.4] : [0.1, 0.45, 1]));
    MATS.rich.lampCap.emissiveIntensity = neon ? 2.6 : 1.6;
    MATS.rich.road.emissiveIntensity = neon ? 0.7 : 0.35;
    grid.material.opacity = neon ? 0.45 : 0.22;
    ui.mode.textContent = COPY.modes[s];
    root.classList.toggle('is-neon', neon);
    resize();
  }

  function applyQuality(q) {
    quality = q;
    const Q = QUALITY[q];
    sun.castShadow = stage >= 2 && Q.shadow > 0;
    if (Q.shadow) {
      sun.shadow.mapSize.set(Q.shadow, Q.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    resize();
  }

  function resize() {
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    const pr = stage < 2 ? CFG.lowResHeight / h : Math.min(window.devicePixelRatio || 1, QUALITY[quality].pr);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    bloom.resolution.set(w * pr * QUALITY[quality].bloomScale, h * pr * QUALITY[quality].bloomScale);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 78 : 62; // portrait displays see more road
    camera.updateProjectionMatrix();
  }

  /* ---------- HUD helpers ---------- */
  function showBanner(kicker, title, note, ms = 2800, kind = '') {
    ui.bKicker.textContent = kicker;
    ui.bTitle.textContent = title;
    ui.bNote.textContent = note;
    ui.banner.className = `hud-banner ${kind}`;
    void ui.banner.offsetWidth;
    ui.banner.classList.add('is-on');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => ui.banner.classList.remove('is-on'), ms);
  }
  function flash(kind) {
    ui.flash.className = 'hud-flash';
    void ui.flash.offsetWidth;
    ui.flash.classList.add(`is-${kind}`);
  }

  /* ---------- Input ---------- */
  function steer(dir) {
    if (ending) return;
    lane = clamp(lane + dir, 0, 2);
  }
  function onKey(e) {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { steer(-1); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { steer(1); e.preventDefault(); }
  }
  function onSteerBtn(e) {
    const b = e.target.closest('[data-steer]');
    if (!b) return;
    e.preventDefault();
    steer(Number(b.dataset.steer));
  }
  window.addEventListener('keydown', onKey);
  root.addEventListener('pointerdown', onSteerBtn);
  window.addEventListener('resize', resize);

  /* ---------- Spawning ---------- */
  function spawnRow() {
    if (congestion) {
      const free = clamp(prevFree + randInt(-1, 1), 0, 2);
      prevFree = free;
      for (let l = 0; l < 3; l++) if (l !== free) spawnTraffic(l, rand(-1.5, 1.5));
      return;
    }
    if (Math.random() < 0.15) return;
    const l = randInt(0, 2);
    spawnTraffic(l, rand(-2, 2));
    if (stage >= 1 && Math.random() < 0.3) {
      const other = l === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1;
      spawnTraffic(other, rand(6, 9));
    }
  }

  /* ---------- Story events ---------- */
  function collectCoin() {
    const idx = stage;
    fireBurst(coin.position.clone());
    unskin(coin);
    scene.remove(coin);
    coin = null;
    coinSpawned = false;
    ui.slots[idx].classList.add('is-filled');
    flash('gold');
    showBanner('UPGRADE ACQUIRED!', COPY.upgrades[idx].title, COPY.upgrades[idx].note, 3200, 'is-upgrade');
    if (idx === 2) { congestion = false; stutter = false; ui.warn.hidden = true; }
    setStage(idx + 1);
    stageDist = 0;
  }

  function crash(obs) {
    crashes++;
    ui.crashes.textContent = crashes;
    crashT = CFG.crashRecover;
    invulnT = CFG.invulnerable;
    shake = 0.6;
    obs.userData.hit = true;
    obs.userData.vx = Math.sign(obs.position.x - carX || (Math.random() - 0.5)) * rand(8, 12);
    obs.userData.vy = rand(5, 8);
    obs.userData.spin = rand(-6, 6);
    flash('hit');
    showBanner('', COPY.crash, COPY.crashSub, 1200, 'is-crash');
  }

  function finish() {
    ending = true;
    showBanner('', COPY.finish, '', 2200, 'is-upgrade');
    endTimer = setTimeout(() => {
      if (destroyed) return;
      onEnd({
        upgrades: COPY.upgrades.map(u => u.title),
        timeSec: Math.round(elapsed),
        crashes,
      });
    }, 2000);
  }

  /* ---------- Simulation step (always smooth, fixed step) ---------- */
  function update(h) {
    elapsed += ending ? 0 : h;
    if (crashT > 0) crashT = Math.max(0, crashT - h);
    if (invulnT > 0) invulnT = Math.max(0, invulnT - h);
    const speedMul = crashT > 0 ? CFG.crashSlow + (1 - CFG.crashSlow) * (1 - crashT / CFG.crashRecover) : 1;
    const sp = CFG.speed * speedMul * (ending ? 0.6 : 1);
    const rel = Math.max(sp - CFG.trafficSpeed, 3);
    const d = sp * h;
    dist += d; stageDist += d;
    if (congestion) congDist += d;

    // Scrolling world
    tex.roadBasic.offset.y = tex.roadRich.offset.y = tex.roadLines.offset.y = dist / 10;
    grid.position.z = -170 + (dist % 4);
    for (const b of buildings) { b.position.z += d; if (b.position.z > 25) b.position.z -= SPAN; }
    for (const l of lamps) { l.position.z += d; if (l.position.z > 15) l.position.z -= 200; }

    // Spawning
    if (!ending) {
      spawnAcc += rel * h;
      if (spawnAcc >= nextGap) {
        spawnRow();
        spawnAcc = 0;
        nextGap = congestion ? rand(13, 16) : rand(24, 34);
      }
    }

    // Player
    const targetX = CFG.lanes[lane];
    const dx = targetX - carX;
    carX += dx * Math.min(1, 11 * h);
    carTilt += (-dx * 0.12 - carTilt) * Math.min(1, 10 * h);
    car.position.x = carX;
    car.rotation.y = carTilt;
    car.rotation.z = -carTilt * 0.4;
    const blinkOn = invulnT <= 0 || Math.floor(invulnT * 12) % 2 === 0;
    if (blinkOn !== carShown) { carShown = blinkOn; carMeshes.forEach(m => { m.visible = blinkOn; }); }
    for (const w of richWheels) w.rotation.x -= d / 0.4;

    // Traffic
    for (let i = traffic.length - 1; i >= 0; i--) {
      const o = traffic[i];
      const u = o.userData;
      if (u.hit) {
        o.position.x += u.vx * h; o.position.y += u.vy * h; u.vy -= 22 * h;
        o.rotation.y += u.spin * h; o.rotation.z += u.spin * 0.5 * h;
        o.position.z += rel * 0.5 * h;
        if (o.position.y < -6) removeTraffic(i);
        continue;
      }
      o.position.z += rel * h;
      if (o.position.z > CFG.despawnZ) { removeTraffic(i); continue; }
      if (invulnT <= 0 && !ending && Math.abs(o.position.x - carX) < 1.7 && Math.abs(o.position.z) < 3.8) crash(o);
    }

    // Coin: drifts toward the player once close, so it is always collected
    if (coin) {
      coin.position.z += rel * h;
      coin.rotation.y += 4 * h;
      if (coin.position.z > -45) coin.position.x += (carX - coin.position.x) * Math.min(1, 3.5 * h);
      if (Math.abs(coin.position.z) < 2.6 && Math.abs(coin.position.x - carX) < 1.8) collectCoin();
      else if (coin.position.z > 4) { coin.position.z = -2; coin.position.x = carX; } // safety net
    }

    // Story
    if (!ending) {
      if (stage === 0 && !coinSpawned && stageDist > CFG.coin1After) spawnCoin();
      if (stage === 1 && !coinSpawned && stageDist > CFG.coin2After) spawnCoin();
      if (stage === 2) {
        if (!congestion && stageDist > CFG.congestionAfter) {
          congestion = true; congDist = 0;
          showBanner('WARNING', COPY.traffic, COPY.trafficSub, 2600, 'is-warn');
        }
        if (congestion && !stutter && congDist > CFG.stutterAfter) { stutter = true; ui.warn.hidden = false; }
        if (congestion && !coinSpawned && congDist > CFG.coin3After) spawnCoin();
      }
      if (stage === 3 && stageDist > CFG.finishAfter) finish();
    }

    // Particles
    if (streaks.visible) {
      const p = streakGeo.attributes.position.array;
      for (let i = 0; i < STREAKS; i++) {
        p[i * 3 + 2] += sp * 2.2 * h;
        if (p[i * 3 + 2] > 12) p[i * 3 + 2] -= 172;
      }
      streakGeo.attributes.position.needsUpdate = true;
    }
    if (burstLife > 0) {
      burstLife -= h * 1.1;
      for (let i = 0; i < BURST; i++) {
        burstPos[i * 3] += burstVel[i * 3] * h;
        burstPos[i * 3 + 1] += burstVel[i * 3 + 1] * h;
        burstPos[i * 3 + 2] += burstVel[i * 3 + 2] * h + rel * h;
        burstVel[i * 3 + 1] -= 12 * h;
      }
      burstGeo.attributes.position.needsUpdate = true;
      burstMat.opacity = Math.max(0, burstLife);
      if (burstLife <= 0) burst.visible = false;
    }

    // Camera
    shake = Math.max(0, shake - h * 1.5);
    const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
    camera.position.x += (carX * 0.55 - camera.position.x) * Math.min(1, 5 * h);
    camera.position.y = 4.3 + sy;
    camera.lookAt(carX * 0.4 + sx, 1, -14);
    sun.position.set(carX + 6, 14, 4);
    sun.target.position.set(carX, 0, -2);
  }

  /* ---------- Frame pacing (the simulated performance) ---------- */
  function shouldRender(now) {
    if (stage === 0) return now - lastRender >= 1000 / CFG.basicFps - 4;
    if (stutter) {
      if (now < hitchUntil) return false;
      if (now >= nextHitch) {
        hitchUntil = now + rand(150, 360);
        nextHitch = hitchUntil + rand(320, 900);
        return false;
      }
      if (now - lastRender < stutterInterval) return false;
      stutterInterval = rand(30, 75);
      return true;
    }
    return now - lastRender >= 1000 / CFG.smoothFps - 4;
  }

  function render() {
    if (stage >= 3) composer.render();
    else renderer.render(scene, camera);
  }

  function frame(now) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    let t = dt;
    while (t > 1e-6) { const h = Math.min(t, 1 / 60); update(h); t -= h; }

    if (shouldRender(now)) {
      render();
      lastRender = now;
      framesWin++;
    }
    // Real-performance guard: only in the smooth stages, never during the intended lag
    if (stage >= 2 && !stutter && !ending) { perfAcc += dt * 1000; perfFrames++; }

    if (now - fpsWinStart >= 500) {
      const fps = Math.min(60, Math.round(framesWin * 1000 / (now - fpsWinStart)));
      ui.fps.textContent = fps;
      ui.fps.className = `hud-v ${fps < 30 ? 'is-low' : fps >= 55 ? 'is-high' : ''}`;
      framesWin = 0; fpsWinStart = now;
      const s = Math.floor(elapsed);
      ui.time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
    if (now - perfWinStart >= 2000) {
      if (perfFrames > 30 && perfAcc / perfFrames > 21 && quality < QUALITY.length - 1) applyQuality(quality + 1);
      perfAcc = 0; perfFrames = 0; perfWinStart = now;
    }
  }

  /* ---------- Boot ---------- */
  // Pre-compile the rich materials so the AI Upscaling switch doesn't hitch.
  setStage(2);
  renderer.compile(scene, camera);
  composer.render();
  setStage(0);
  // Dev shortcut: index.html#game&stage=2 starts with upgrades already unlocked
  const devStage = Number((location.hash.match(/stage=(\d)/) || [])[1] || 0);
  for (let i = 0; i < Math.min(devStage, 3); i++) ui.slots[i].classList.add('is-filled');
  if (devStage) setStage(Math.min(devStage, 3));
  if (devStage === 2 && /jam/.test(location.hash)) { stageDist = CFG.congestionAfter; congDist = CFG.stutterAfter; }
  resize();
  raf = requestAnimationFrame(t => { last = t; lastRender = 0; frame(t); });

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      clearTimeout(endTimer);
      clearTimeout(bannerTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', resize);
      root.removeEventListener('pointerdown', onSteerBtn);
      scene.traverse(o => { o.geometry?.dispose(); });
      Object.values(MATS).forEach(set => Object.values(set).forEach(m => m.dispose()));
      Object.values(tex).forEach(t => t.dispose());
      scene.environment?.dispose();
      composer.dispose();
      rt.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      root.innerHTML = '';
    },
  };
}

window.LevelUpGame = { load: loadGame };
})();
