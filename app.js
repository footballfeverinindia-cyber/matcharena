/* ============================================================
   MATCHARENA — app.js
   Hero 3D arena with per-sport courts + themes, exploded-view
   stages, cart, join form and full UI wiring.
   
   ⚠️ IMPORTANT: If your Render URL is different from 
   https://matcharena-backend-1.onrender.com, change it in the 
   3 fetch() calls below!
   ============================================================ */
(() => {
'use strict';
const THREE = window.THREE;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const hoverable = matchMedia('(hover:hover)').matches;

/* ---------------- helpers ---------------- */
function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .55, metalness: .08 }, o));
}
function M(geo, m) { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; return mesh; }
function capsule(r, len, material, seg = 10) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), material); c.castShadow = true;
  const t = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material); t.castShadow = true;
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), material); b.castShadow = true;
  t.position.y = len / 2; b.position.y = -len / 2;
  g.add(c, t, b); return g;
}
function canvasTex(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4; t.encoding = THREE.sRGBEncoding;
  return t;
}
function damp(cur, target, lambda, dt) {
  return cur + (target - cur) * (1 - Math.exp(-lambda * dt));
}
function dampC(cur, target, lambda, dt) { cur.lerp(target, 1 - Math.exp(-lambda * dt)); }
function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

/* ---------------- preloader ---------------- */
const pre = document.getElementById('preloader');
let preDone = false;
function hidePre() {
  if (preDone) return; preDone = true;
  pre.classList.add('done');
  document.body.classList.add('loaded');
}
if (document.readyState === 'complete') setTimeout(hidePre, 600);
else addEventListener('load', () => setTimeout(hidePre, 700));
setTimeout(hidePre, 3500);

/* Three.js may be missing (offline) — the page still works without 3D */
const HAS3D = !!window.THREE;
const stageRefs = [];
if (HAS3D) {

/* ============================================================
   HERO — light premium arena, per-sport courts
   ============================================================ */
const canvas = document.getElementById('arena-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, .1, 100);
camera.position.set(0, 3.4, 9.8);

const hemi = new THREE.HemisphereLight(0xffffff, 0x9a8f6f, .75);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff7e6, 1.15);
key.position.set(5, 9, 6); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = .5; key.shadow.camera.far = 30;
key.shadow.camera.left = key.shadow.camera.bottom = -9;
key.shadow.camera.right = key.shadow.camera.top = 9;
scene.add(key);
const rim = new THREE.DirectionalLight(0xc9a24b, .5);
rim.position.set(-6, 5, -7);
scene.add(rim);
const spot = new THREE.PointLight(0xc9a24b, .5, 18);
spot.position.set(0, 5.2, 0);
scene.add(spot);

/* stage + calm base floor */
const stage = new THREE.Group();
scene.add(stage);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xEDE7D8, roughness: .95, metalness: 0 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
floor.rotation.x = -Math.PI / 2; floor.position.y = -.02; floor.receiveShadow = true;
scene.add(floor);

/* gold dust (calm, no spin) */
const dustGeo = new THREE.BufferGeometry();
const dustN = 180, dustPos = new Float32Array(dustN * 3);
for (let i = 0; i < dustN; i++) {
  dustPos[i * 3] = (Math.random() - .5) * 20;
  dustPos[i * 3 + 1] = Math.random() * 7 + .3;
  dustPos[i * 3 + 2] = (Math.random() - .5) * 20;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xa87e2c, size: .05, transparent: true, opacity: .4 }));
scene.add(dust);

/* textures */
const grassTex = canvasTex(ctx => {
  ctx.fillStyle = '#3E9A63'; ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) { ctx.fillStyle = x % 64 ? 'rgba(255,255,255,.03)' : 'rgba(0,60,30,.08)'; ctx.fillRect(x, 0, 32, 256); }
  ctx.fillStyle = 'rgba(255,255,255,.03)';
  for (let i = 0; i < 130; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
}, 256, 256);
grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(6.5, 4.75);
const netTex = canvasTex(ctx => {
  ctx.strokeStyle = 'rgba(235,240,255,.9)'; ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 14) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke(); }
  for (let y = 0; y <= 256; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke(); }
}, 256, 256);
const stringTex = canvasTex(ctx => {
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.4;
  for (let i = 0; i <= 128; i += 9) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); }
  for (let j = 0; j <= 128; j += 9) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(128, j); ctx.stroke(); }
}, 128, 128);
const basketTex = canvasTex(ctx => {
  ctx.fillStyle = '#f07820'; ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#2a1205'; ctx.lineWidth = 9;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(256, 256, 140 + i * 36, i % 2 ? .4 : .1, (i % 2 ? 1.9 : 1.6), !!i % 2); ctx.stroke(); }
  ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(256, 256, 200, 200, 0, 0, Math.PI * 2); ctx.stroke();
});
const pickleTex = canvasTex(ctx => {
  ctx.fillStyle = '#dbe81f'; ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let y = 24; y < 256; y += 34) for (let x = 24; x < 256; x += 34) { ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); }
});
const honeyTex = canvasTex(ctx => {
  ctx.fillStyle = '#2FCA75'; ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(0,60,20,.35)'; ctx.lineWidth = 2;
  const s = 18, h = s * Math.sin(Math.PI / 3);
  for (let row = 0; row * h < 300; row++) {
    for (let col = -1; col * s * 1.5 < 300; col++) {
      const x = col * s * 1.5 + (row % 2 ? s * .75 : 0), y = row * h;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6; k ? ctx.lineTo(x + s * Math.cos(a), y + s * Math.sin(a)) : ctx.moveTo(x + s * Math.cos(a), y + s * Math.sin(a)); }
      ctx.closePath(); ctx.stroke();
    }
  }
}, 256, 256);
const soccerTex = canvasTex(ctx => {
  ctx.fillStyle = '#f6f6f4'; ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#12121a';
  const pts = [[120,110],[392,102],[256,256],[112,342],[384,382],[218,470],[468,212],[60,472],[302,62],[168,196],[430,320]];
  pts.forEach(([x, y]) => { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = (i * 2 + 0.6) * Math.PI / 5, px = x + 52 * Math.cos(a), py = y + 52 * Math.sin(a); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.fill(); });
  ctx.strokeStyle = '#12121a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(256, 256, 150, 0, Math.PI * 2); ctx.stroke();
});

/* light per-sport hero palettes */
const COLORS = {
  football:   { bg: 0xEAF1E8, light: 0x2FA37B },
  cricket:    { bg: 0xF2EBDD, light: 0xD9A441 },
  badminton:  { bg: 0xECEAF6, light: 0x7A6AE0 },
  basketball: { bg: 0xF6EBE2, light: 0xE0703F },
  pickleball: { bg: 0xE6F2F3, light: 0x2FA6B8 },
};
const sceneBg = new THREE.Color(0xEAF1E8);
const sceneFog = new THREE.Color(0xEAF1E8);
scene.background = sceneBg;
scene.fog = new THREE.Fog(sceneFog, 20, 44);

/* ---------------- per-sport courts (static layer) ---------------- */
const courtLayer = new THREE.Group();
scene.add(courtLayer);
const courtMap = {};
function courtLines(g) {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  return (w, d, x, z, y = .015) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .012, d), lineMat); m.position.set(x, y, z); g.add(m); };
}
function arcXZ(g, cx, cz, r, sa, ea) {
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = sa + (ea - sa) * i / n, a1 = sa + (ea - sa) * (i + 1) / n, m = (a0 + a1) / 2;
    const seg = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .3), lineMat);
    seg.position.set(cx + Math.cos(m) * r, .015, cz + Math.sin(m) * r);
    seg.rotation.y = -m;
    g.add(seg);
  }
}
function buildCourts() {
  const add = (key, fn) => { const g = new THREE.Group(); fn(g); g.visible = false; courtLayer.add(g); courtMap[key] = g; };

  /* FOOTBALL — drifting grass + full pitch */
  add('football', g => {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(13, 9.6), new THREE.MeshStandardMaterial({ map: grassTex, roughness: .95 }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = .001; grass.receiveShadow = true; g.add(grass);
    const strip = courtLines(g);
    const HX = 5.3, HZ = 3.6, L = .05;
    strip(L, HZ * 2, -HX, 0); strip(L, HZ * 2, HX, 0);
    strip(HX * 2, L, 0, -HZ); strip(HX * 2, L, 0, HZ);
    strip(HX * 2, L, 0, 0);
    const cc = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.4, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cc.rotation.x = -Math.PI / 2; cc.position.y = .015; g.add(cc);
    const cd = new THREE.Mesh(new THREE.CircleGeometry(.08, 18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cd.rotation.x = -Math.PI / 2; cd.position.y = .015; g.add(cd);
    const box = (goalZ, depth, halfW) => {
      const dir = Math.sign(goalZ);
      strip(halfW * 2, L, 0, goalZ - dir * depth);
      strip(L, depth, -halfW, goalZ - dir * depth / 2);
      strip(L, depth, halfW, goalZ - dir * depth / 2);
    };
    box(HZ, 1.8, 1.6); box(-HZ, 1.8, 1.6);
    box(HZ, .95, .95); box(-HZ, .95, .95);
    const pDot = z => { const c = new THREE.Mesh(new THREE.CircleGeometry(.07, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); c.rotation.x = -Math.PI / 2; c.position.set(0, .015, z); g.add(c); };
    pDot(HZ - 1.15); pDot(-(HZ - 1.15));
    arcXZ(g, HX, -HZ, .85, Math.PI / 2, Math.PI); arcXZ(g, HX, HZ, .85, Math.PI, Math.PI * 1.5);
    arcXZ(g, -HX, -HZ, .85, 0, Math.PI / 2); arcXZ(g, -HX, HZ, .85, Math.PI * 1.5, Math.PI * 2);
  });

  /* CRICKET — outfield, boundary, pitch, creases */
  add('cricket', g => {
    const strip = courtLines(g);
    const oval = new THREE.Mesh(new THREE.CircleGeometry(6.4, 56), mat(0x5FA05A, { roughness: .95 }));
    oval.scale.set(1, 1, .6); oval.rotation.x = -Math.PI / 2; oval.position.y = .001; oval.receiveShadow = true; g.add(oval);
    const ring = new THREE.Mesh(new THREE.RingGeometry(6.15, 6.24, 64), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .014; g.add(ring);
    const pitch = new THREE.Mesh(new THREE.BoxGeometry(7.8, .045, 1.1), mat(0xC9A768, { roughness: .95 }));
    pitch.position.y = .02; pitch.receiveShadow = true; g.add(pitch);
    [-3.6, 3.6].forEach(x => strip(.05, 1.25, x, 0, .05));
  });

  /* BADMINTON — full court + proper net */
  add('badminton', g => {
    const strip = courtLines(g);
    const court = new THREE.Mesh(new THREE.BoxGeometry(5.4, .035, 3), mat(0x2E9E5B, { roughness: .92 }));
    court.position.y = .017; court.receiveShadow = true; g.add(court);
    const y = .045;
    strip(5.25, .045, 0, -1.43, y); strip(5.25, .045, 0, 1.43, y);
    strip(.045, 2.82, -2.62, 0, y); strip(.045, 2.82, 2.62, 0, y);
    strip(.045, 2.82, 0, 0, y);            /* net line */
    strip(5.25, .045, 0, 0, y);            /* center line */
    strip(.045, 2.82, .88, 0, y); strip(.045, 2.82, -.88, 0, y);   /* short service */
    strip(.045, 2.82, 2.1, 0, y); strip(.045, 2.82, -2.1, 0, y);   /* long service */
    const netG = new THREE.Group();
    const n = new THREE.Mesh(new THREE.PlaneGeometry(2.84, .92), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .85, side: THREE.DoubleSide }));
    n.rotation.y = Math.PI / 2;  /* net spans across the court width */
    n.position.y = .46; netG.add(n);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(2.86, .03, .02), mat(0xF5F5F5, { roughness: .35 }));
    tape.rotation.y = Math.PI / 2;  /* tape spans the width with the net */
    tape.position.y = .93; netG.add(tape);
    [-1.43, 1.43].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.024, .024, 1.04, 8), mat(0x3A3A46, { roughness: .5 })); p.position.set(0, .52, z); netG.add(p); });
    g.add(netG);
  });

  /* BASKETBALL — hardwood court with keys, arcs, circles */
  add('basketball', g => {
    const strip = courtLines(g);
    const court = new THREE.Mesh(new THREE.BoxGeometry(10.2, .035, 6.6), mat(0xC98F52, { roughness: .9 }));
    court.position.y = .017; court.receiveShadow = true; g.add(court);
    const y = .045, L = .05;
    strip(10.1, L, 0, -3.22, y); strip(10.1, L, 0, 3.22, y);
    strip(L, 6.5, -5.05, 0, y); strip(L, 6.5, 5.05, 0, y);
    strip(10.1, L, 0, 0, y);    /* half-court line */
    const cc = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.2, 48), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cc.rotation.x = -Math.PI / 2; cc.position.y = y; g.add(cc);
    const key = dir => {
      const zL = 1.55 * dir, zB = 3.22 * dir;
      strip(L, 1.67, -.95, (zL + zB) / 2, y); strip(L, 1.67, .95, (zL + zB) / 2, y);
      strip(1.9, L, 0, zL, y);
      const ft = new THREE.Mesh(new THREE.RingGeometry(.8, .85, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      ft.rotation.x = -Math.PI / 2; ft.position.set(0, y, zL); g.add(ft);
      arcXZ(g, 0, 2.9 * dir, 2.5, dir > 0 ? Math.PI : 0, dir > 0 ? Math.PI * 2 : Math.PI);
    };
    key(1); key(-1);
  });

  /* PICKLEBALL — kitchen, center lines, proper net */
  add('pickleball', g => {
    const strip = courtLines(g);
    const court = new THREE.Mesh(new THREE.BoxGeometry(5.4, .035, 2.7), mat(0x1F8FB0, { roughness: .92 }));
    court.position.y = .017; court.receiveShadow = true; g.add(court);
    const y = .045;
    strip(5.25, .045, 0, -1.3, y); strip(5.25, .045, 0, 1.3, y);
    strip(.045, 2.55, -2.62, 0, y); strip(.045, 2.55, 2.62, 0, y);
    strip(.045, 2.55, 0, 0, y);                  /* net line */
    strip(2.55, .045, 0, 0, y);                  /* center line */
    strip(.045, 2.55, .7, 0, y); strip(.045, 2.55, -.7, 0, y);      /* kitchen lines */
    strip(.045, 1.2, -1.25, 0, y); strip(.045, 1.2, 1.25, 0, y);    /* center service */
    const netG = new THREE.Group();
    const n = new THREE.Mesh(new THREE.PlaneGeometry(2.56, .4), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .8, side: THREE.DoubleSide }));
    n.rotation.y = Math.PI / 2;  /* net spans across the court width */
    n.position.y = .2; netG.add(n);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(2.58, .028, .02), mat(0xF5F5F5, { roughness: .35 }));
    tape.rotation.y = Math.PI / 2;  /* tape spans the width with the net */
    tape.position.y = .41; netG.add(tape);
    [-1.3, 1.3].forEach(z => { const p = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .44, 8), mat(0x3A3A46, { roughness: .5 })); p.position.set(0, .22, z); netG.add(p); });
    g.add(netG);
  });
}
buildCourts();

/* ---------------- improved props ---------------- */
function buildRacket() {
  const g = new THREE.Group();
  const frameMat = mat(0x6B5BD6, { roughness: .3, metalness: .5 });
  const strMat = new THREE.MeshBasicMaterial({ map: stringTex, transparent: true, opacity: .6, side: THREE.DoubleSide });
  const head = M(new THREE.TorusGeometry(.3, .02, 10, 40), frameMat);
  head.scale.set(1, 1.32, 1); head.rotation.y = Math.PI / 2; head.position.y = .32;
  const head2 = M(new THREE.TorusGeometry(.291, .011, 8, 40), frameMat);
  head2.scale.set(1, 1.32, 1); head2.rotation.y = Math.PI / 2; head2.position.set(0, .32, .014);
  const str = M(new THREE.PlaneGeometry(.5, .68), strMat);
  str.rotation.y = Math.PI / 2; str.position.y = .32;
  const t1 = M(new THREE.CylinderGeometry(.011, .02, .24, 8), frameMat); t1.position.set(.05, .07, 0); t1.rotation.z = -.6;
  const t2 = M(new THREE.CylinderGeometry(.011, .02, .24, 8), frameMat); t2.position.set(-.05, .07, 0); t2.rotation.z = .6;
  const shaft = M(new THREE.CylinderGeometry(.016, .02, .2, 8), mat(0x4A3E8F, { roughness: .4, metalness: .5 }));
  shaft.position.y = -.06;
  const grip = M(new THREE.CylinderGeometry(.028, .034, .26, 12), mat(0x1E1E28, { roughness: .7 }));
  grip.position.y = -.3;
  const b1 = M(new THREE.CylinderGeometry(.029, .029, .028, 12), mat(0xC09A45, { roughness: .5, metalness: .3 })); b1.position.y = -.19;
  const b2 = M(new THREE.CylinderGeometry(.029, .029, .028, 12), mat(0xC09A45, { roughness: .5, metalness: .3 })); b2.position.y = -.42;
  const cap = M(new THREE.SphereGeometry(.034, 10, 8), mat(0x1E1E28, { roughness: .7 })); cap.position.y = -.44;
  g.add(head, head2, str, t1, t2, shaft, grip, b1, b2, cap);
  g.scale.setScalar(1.05);
  return g;
}
function buildShuttle() {
  const g = new THREE.Group();
  const cork = M(new THREE.SphereGeometry(.085, 16, 12), mat(0xF3E7C4, { roughness: .5 }));
  cork.scale.set(1, .8, 1); cork.position.y = .03;
  const tip = M(new THREE.SphereGeometry(.05, 10, 8), mat(0xE8DCC0, { roughness: .4 }));
  tip.position.y = .085;
  const vaneMat = mat(0xF7F3E4, { roughness: .55, transparent: true, opacity: .95 });
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const v = M(new THREE.BoxGeometry(.015, .27, .048), vaneMat);
    v.position.set(Math.cos(a) * .19, -.06, Math.sin(a) * .19);
    v.rotation.y = -a; v.rotation.x = .5;
    g.add(v);
  }
  const skirt = M(new THREE.ConeGeometry(.2, .24, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xFAFAF5, side: THREE.DoubleSide, transparent: true, opacity: .5 }));
  skirt.position.y = -.16;
  const band = M(new THREE.TorusGeometry(.13, .01, 6, 20), new THREE.MeshBasicMaterial({ color: 0xD64541 }));
  band.position.set(0, -.13, 0); band.rotation.x = Math.PI / 2;
  g.add(cork, tip, skirt, band);
  return g;
}
function buildPaddle() {
  const g = new THREE.Group();
  const w = .24, h = .34, r = .07;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const edge = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0x1F1F2A, { roughness: .4 }));
  edge.scale.set(1.04, 1.06, 1); edge.rotation.x = -Math.PI / 2; edge.position.y = .172;
  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0x2FCA75, { map: honeyTex, roughness: .45 }));
  face.rotation.x = -Math.PI / 2; face.position.y = .182;
  const handle = M(new THREE.CylinderGeometry(.016, .02, .16, 8), mat(0x2A2A34, { roughness: .7 }));
  handle.position.y = -.1;
  const cap = M(new THREE.SphereGeometry(.02, 8, 8), mat(0x2A2A34, { roughness: .7 }));
  cap.position.y = -.19;
  g.add(edge, face, handle, cap);
  return g;
}
function buildHoop(side) {
  const g = new THREE.Group();
  const poleMat = mat(0xd8d8e2, { roughness: .35, metalness: .5 });
  const boardZ = .36 * side, poleZ = .92 * side;
  const pole = M(new THREE.CylinderGeometry(.055, .055, 2.35, 12), poleMat); pole.position.set(0, 1.17, poleZ);
  const arm = M(new THREE.BoxGeometry(.05, .05, Math.abs(poleZ - boardZ) + .06), poleMat); arm.position.set(0, 2.26, (poleZ + boardZ) / 2);
  const board = M(new THREE.BoxGeometry(.78, .5, .05), mat(0xeef0f6, { roughness: .3, metalness: .2, transparent: true, opacity: .94 }));
  board.position.set(0, 2.24, boardZ);
  const square = M(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: .9 }));
  square.position.set(0, 2.24, boardZ - .028 * side);
  square.rotation.y = side > 0 ? Math.PI : 0;
  const rim = M(new THREE.TorusGeometry(.19, .02, 10, 26), mat(0xff5a1f, { roughness: .35, metalness: .6 }));
  rim.position.set(0, 2.0, 0); rim.rotation.x = Math.PI / 2;
  const net = M(new THREE.CylinderGeometry(.19, .135, .46, 16, 1, true), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .85, side: THREE.DoubleSide }));
  net.position.set(0, 1.74, 0);
  g.add(pole, arm, board, square, rim, net);
  g.position.z = 2.9 * side;
  return { g, net };
}
function buildPlayer({ skin = 0xf2c19a, jersey, shorts = 0x232334, hair, female = false, trim = 0xffffff }) {
  const g = new THREE.Group();
  const skinMat = mat(skin, { roughness: .6 }), jerseyMat = mat(jersey, { roughness: .55 });
  const shortsMat = mat(shorts), shoeMat = mat(0x15151d, { roughness: .35 }), hairMat = mat(hair, { roughness: .7 });
  const eyeMat = mat(0x0e0e16, { roughness: .15 });
  const leg = x => {
    const p = new THREE.Group(); p.position.set(x, .6, 0);
    const l = capsule(.085, .5, skinMat, 8); l.position.y = -.24;
    const sock = M(new THREE.CylinderGeometry(.09, .088, .12, 10), mat(0xf5f5f5, { roughness: .8 })); sock.position.y = -.38;
    const shoe = M(new THREE.SphereGeometry(.1, 10, 8), shoeMat); shoe.scale.set(1, .55, 1.5); shoe.position.set(0, -.6, .06);
    p.add(l, sock, shoe); return p;
  };
  const legL = leg(-.1), legR = leg(.1);
  const torso = M(new THREE.CylinderGeometry(.17, .15, .6, 14), jerseyMat); torso.position.y = 1.05;
  const trimT = M(new THREE.CylinderGeometry(.172, .172, .07, 14), mat(trim, { roughness: .5 })); trimT.position.y = 1.36;
  const sh = M(new THREE.CylinderGeometry(.17, .15, .26, 14), shortsMat); sh.position.y = .7;
  const headG = new THREE.Group(); headG.position.y = 1.5;
  const head = M(new THREE.SphereGeometry(.165, 18, 16), skinMat); headG.add(head);
  const hairBack = M(new THREE.SphereGeometry(.176, 16, 12, 0, Math.PI * 2, 0, Math.PI * .62), hairMat);
  hairBack.position.y = .04; hairBack.scale.y = 1.16; headG.add(hairBack);
  if (female) {
    const pony = new THREE.Group(); pony.position.set(-.06, .1, .02);
    for (let i = 0; i < 3; i++) { const b = M(new THREE.SphereGeometry(.1 - i * .022, 10, 8), hairMat); b.position.set(.02, -.05 - i * .14, -.01 - i * .05); pony.add(b); }
    headG.add(pony);
  } else {
    const top = M(new THREE.SphereGeometry(.17, 16, 12, 0, Math.PI * 2, 0, Math.PI * .5), hairMat);
    top.position.y = .06; top.scale.y = 1.1; headG.add(top);
  }
  [-.065, .065].forEach(z => { const e = M(new THREE.SphereGeometry(.02, 8, 8), eyeMat); e.position.set(.165, .015, z); headG.add(e); });
  g.add(legL, legR, torso, trimT, sh, headG);
  const arm = side => {
    const shP = new THREE.Group(); shP.position.set(.21 * side, 1.26, 0);
    const upper = capsule(.055, .3, jerseyMat, 8); upper.position.y = -.15;
    const elb = new THREE.Group(); elb.position.y = -.32;
    const fore = capsule(.045, .28, skinMat, 8); fore.position.y = -.14;
    const hand = M(new THREE.SphereGeometry(.05, 8, 8), skinMat); hand.position.y = -.31;
    elb.add(fore, hand); shP.add(upper, elb);
    return { shP, elb };
  };
  const lA = arm(-1), rA = arm(1);
  g.add(lA.shP, rA.shP);
  g.userData = { lA, rA, headG, legL, legR };
  return g;
}
function applySwing(arm, p) {
  let z;
  if (p < .18) z = THREE.MathUtils.lerp(1.5, -1.55, easeOutCubic(p / .18));
  else if (p < .48) z = THREE.MathUtils.lerp(-1.55, -.35, easeOutCubic((p - .18) / .3));
  else z = THREE.MathUtils.lerp(-.35, -.2, Math.min(1, (p - .48) / .52));
  arm.shP.rotation.z = z;
  arm.elb.rotation.z = -z * .32;
}

/* ---------------- hero scenes ---------------- */
const heroSports = {};

heroSports.football = {
  build() {
    const root = new THREE.Group();
    const postMat = mat(0xf5f5f7, { roughness: .3, metalness: .4 });
    const goalAt = z => {
      const goalG = new THREE.Group(); goalG.position.set(0, 0, z);
      if (z < 0) goalG.rotation.y = Math.PI;
      [-1.15, 1.15].forEach(x => { const p = M(new THREE.CylinderGeometry(.045, .045, 1.55, 12), postMat); p.position.set(x, .775, 0); goalG.add(p); });
      const bar = M(new THREE.CylinderGeometry(.045, .045, 2.3, 12), postMat); bar.rotation.z = Math.PI / 2; bar.position.y = 1.55; goalG.add(bar);
      const netMat = new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .55, side: THREE.DoubleSide });
      const netM = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.55), netMat); netM.position.set(0, .775, .12); netM.userData.kick = 0; goalG.add(netM);
      root.add(goalG);
      return netM;
    };
    const netM = goalAt(3.6);
    goalAt(-3.6);
    const ball = M(new THREE.SphereGeometry(.34, 32, 24), mat(0xffffff, { map: soccerTex, roughness: .5 }));
    ball.position.set(0, .34, .4); root.add(ball);
    root.userData = { ball, netM };
    return root;
  },
  update(dt, t, g) {
    const { ball, netM } = g.userData;
    const cyc = t % 9;
    if (cyc < 6) {
      ball.position.x = Math.sin(t * 1.35) * .9;
      ball.position.y = .34 + Math.abs(Math.sin(t * 2.6)) * .5;
      ball.position.z = .4 + Math.cos(t * 1.1) * .3;
      ball.rotation.x += dt * 5; ball.rotation.z += dt * 1.4;
    } else if (cyc < 8) {
      const u = (cyc - 6) / 2;
      ball.position.x = Math.sin(t * 1.35) * .9 * (1 - u);
      ball.position.z = THREE.MathUtils.lerp(.7, 3.5, u);
      ball.position.y = .4 + 2.05 * Math.sin(Math.PI * u);
      ball.rotation.x += dt * 9; ball.rotation.z += dt * 3;
      if (u > .985 && netM.userData.kick === 0) netM.userData.kick = 1;
    } else {
      ball.position.set(Math.sin(t * 1.35) * .9 * (1 - (cyc - 8)), .34 + Math.abs(Math.sin(t * 2.6)) * .5, THREE.MathUtils.lerp(3.5, .4, (cyc - 8)));
      ball.rotation.x += dt * 5;
      netM.userData.kick = 0;
    }
    if (netM.userData.kick > 0) { netM.userData.kick += dt * 3.2; const k = Math.max(0, 1 - (netM.userData.kick - 1)); netM.scale.z = 1 + .38 * Math.sin(k * Math.PI) * k; if (netM.userData.kick > 2) netM.userData.kick = 0; }
  }
};

heroSports.cricket = {
  build() {
    const root = new THREE.Group();
    const stumpMat = mat(0xE8D9B8, { roughness: .55, metalness: .02 });
    const bailMat = mat(0xB91C1C, { roughness: .4 });
    const stumps = new THREE.Group(); stumps.position.set(0.85, 0, 0);
    [-0.11, 0, 0.11].forEach(z => {
      const s = M(new THREE.CylinderGeometry(0.028, 0.028, 0.82, 12), stumpMat);
      s.position.set(0, 0.41, z);
      stumps.add(s);
      const top = M(new THREE.CylinderGeometry(0.032, 0.028, 0.03, 12), stumpMat);
      top.position.set(0, 0.83, z);
      stumps.add(top);
    });
    const bails = [];
    [-0.055, 0.055].forEach((z, i) => {
      const bg = new THREE.Group(); bg.position.set(0, 0.86, z);
      const b = M(new THREE.BoxGeometry(0.22, 0.018, 0.022), bailMat);
      bg.add(b);
      bg.userData = { pop: 0, p: 0, A: z < 0 ? -1.8 : 1.8 };
      stumps.add(bg); bails.push(bg);
    });
    root.add(stumps);

    const bat = new THREE.Group();
    bat.position.set(1.55, 0, 0.55);
    const bladeMat = mat(0xF3E4C0, { roughness: .65 });
    const blade = M(new THREE.BoxGeometry(0.105, 0.58, 0.038), bladeMat);
    blade.position.y = 0.52;
    const toe = M(new THREE.SphereGeometry(0.052, 10, 8), bladeMat);
    toe.scale.set(1, 0.55, 0.75);
    toe.position.set(0, 0.23, 0);
    const handle = M(new THREE.CylinderGeometry(0.022, 0.028, 0.28, 10), mat(0x1a1a22, { roughness: .5 }));
    handle.position.y = 0.14;
    const grip = M(new THREE.CylinderGeometry(0.029, 0.029, 0.12, 10), mat(0x222230, { roughness: .8 }));
    grip.position.y = 0.12;
    bat.add(blade, toe, handle, grip);
    bat.rotation.z = -0.42;
    bat.rotation.y = 0.15;
    root.add(bat);

    const ball = M(new THREE.SphereGeometry(0.095, 20, 16), mat(0xC41E3A, { roughness: .4, metalness: .05 }));
    ball.position.set(-2.6, 0.22, 0.1);
    root.add(ball);

    root.userData = { ball, bails, stumps };
    return root;
  },
  update(dt, t, g) {
    const { ball, bails } = g.userData;
    const cyc = t % 7.5;
    if (cyc < 1.1) {
      ball.position.set(-2.6, 0.22, 0.1);
      ball.rotation.x += dt * 2;
    } else if (cyc < 2.7) {
      const u = (cyc - 1.1) / 1.6, e = u * u * (3 - 2 * u);
      ball.position.x = THREE.MathUtils.lerp(-2.6, 0.85, e);
      ball.position.y = THREE.MathUtils.lerp(0.85, 0.28, e);
      ball.position.z = Math.sin(u * Math.PI) * 0.12;
      ball.rotation.x += dt * 16;
      ball.rotation.z += dt * 4;
      if (u >= 0.95) bails.forEach(b => { if (b.userData.pop === 0) { b.userData.pop = 1; b.userData.p = 0; } });
    } else if (cyc < 4.2) {
      ball.position.x += dt * 1.15;
      ball.position.y = Math.max(0.12, ball.position.y - dt * 1.5);
      ball.rotation.x += dt * 14;
    } else {
      ball.position.x = THREE.MathUtils.lerp(ball.position.x, -2.6, 1 - Math.exp(-2.4 * dt));
      ball.position.y = THREE.MathUtils.lerp(ball.position.y, 0.22, 1 - Math.exp(-3 * dt));
      ball.position.z = THREE.MathUtils.lerp(ball.position.z, 0.1, 1 - Math.exp(-3 * dt));
      ball.rotation.x += dt * 2;
    }
    bails.forEach(b => {
      if (b.userData.pop === 1) {
        b.userData.p += dt;
        const p = b.userData.p, A = b.userData.A;
        b.rotation.z = A * Math.exp(-2.2 * p) * Math.cos(9 * p);
        b.position.y = 0.86 + 0.08 * Math.exp(-2.2 * p);
        if (p > 2.1) b.userData.pop = 2;
      } else if (b.userData.pop === 2) {
        b.rotation.z = damp(b.rotation.z, 0, 9, dt);
        b.position.y = damp(b.position.y, 0.86, 9, dt);
        if (Math.abs(b.rotation.z) < 0.015) b.userData.pop = 0;
      }
    });
  }
};

heroSports.badminton = {
  build() {
    const root = new THREE.Group();
    const A = buildPlayer({ jersey: 0x2563eb, shorts: 0x1e1e2e, hair: 0x241a12, skin: 0xf2c19a, trim: 0xe8e8f0 });
    A.position.set(-1.75, 0, 0); root.add(A);
    const B = buildPlayer({ jersey: 0xdb2777, shorts: 0x1e1e2e, hair: 0x2b1a0e, skin: 0xc98a5e, female: true, trim: 0xf7d9e4 });
    B.position.set(1.75, 0, 0); B.scale.x = -1; root.add(B);
    const rA = buildRacket(), rB = buildRacket();
    A.userData.rA.shP.add(rA); B.userData.rA.shP.add(rB);
    const sh = buildShuttle(); root.add(sh);
    root.userData = { A, B, sh };
    return root;
  },
  update(dt, t, g) {
    const { A, B, sh } = g.userData;
    const P = 3.0, u = (t % P) / P;
    const going = u < .5;
    const v = going ? u * 2 : (u - .5) * 2;
    const x = THREE.MathUtils.lerp(-1.55, 1.55, v);
    sh.position.set(going ? x : -x, 1.5 + 1.85 * Math.sin(Math.PI * v), 0);
    sh.rotation.z += dt * 7; sh.rotation.y += dt * 3;
    const swA = (u >= .02 && u < .3) ? (u - .02) / .28 : -1;
    const swB = (u >= .52 && u < .8) ? (u - .52) / .28 : -1;
    if (swA >= 0) applySwing(A.userData.rA, swA); else { A.userData.rA.shP.rotation.z = damp(A.userData.rA.shP.rotation.z, -.2, 8, dt); A.userData.rA.elb.rotation.z = damp(A.userData.rA.elb.rotation.z, .06, 8, dt); }
    if (swB >= 0) applySwing(B.userData.rA, swB); else { B.userData.rA.shP.rotation.z = damp(B.userData.rA.shP.rotation.z, -.2, 8, dt); B.userData.rA.elb.rotation.z = damp(B.userData.rA.elb.rotation.z, .06, 8, dt); }
    A.userData.lA.shP.rotation.z = damp(A.userData.lA.shP.rotation.z, .35, 6, dt);
    A.userData.lA.elb.rotation.z = damp(A.userData.lA.elb.rotation.z, -1.1, 6, dt);
    B.userData.lA.shP.rotation.z = damp(B.userData.lA.shP.rotation.z, .35, 6, dt);
    B.userData.lA.elb.rotation.z = damp(B.userData.lA.elb.rotation.z, -1.1, 6, dt);
    const bob = .045 * Math.sin(t * 2.1);
    A.userData.headG.position.y = 1.5 + bob; B.userData.headG.position.y = 1.5 - bob;
    A.userData.legL.rotation.x = Math.sin(t * 2.1) * .06; A.userData.legR.rotation.x = -Math.sin(t * 2.1) * .06;
    B.userData.legL.rotation.x = -Math.sin(t * 2.1) * .06; B.userData.legR.rotation.x = Math.sin(t * 2.1) * .06;
  }
};

heroSports.basketball = {
  build() {
    const root = new THREE.Group();
    const h1 = buildHoop(1), h2 = buildHoop(-1);
    root.add(h1.g, h2.g);
    const ball = M(new THREE.SphereGeometry(.3, 32, 24), mat(0xf07820, { map: basketTex, roughness: .5 }));
    ball.position.set(0, .3, .5); root.add(ball);
    root.userData = { ball, nets: [h1.net, h2.net] };
    return root;
  },
  update(dt, t, g) {
    const { ball, nets } = g.userData;
    const cyc = t % 10;
    if (cyc < 7) {
      const b = Math.abs(Math.sin(t * 3.1));
      ball.position.set(Math.sin(t * 1.2) * .7, .3 + b * 1.05, .5 + Math.cos(t * .9) * .4);
      ball.rotation.x += dt * 7; ball.rotation.z += dt * 2.2;
    } else if (cyc < 9) {
      const u = (cyc - 7) / 2, e = u * u * (3 - 2 * u);
      ball.position.x = THREE.MathUtils.lerp(Math.sin(t * 1.2) * .7, 0, e);
      ball.position.z = THREE.MathUtils.lerp(.5, 2.9, e);
      ball.position.y = .35 + 3.05 * Math.sin(Math.PI * u);
      ball.rotation.x += dt * 10; ball.rotation.z += dt * 4;
    } else {
      const u = (cyc - 9);
      ball.position.x = 0; ball.position.z = 2.9;
      ball.position.y = Math.max(.3, 2.35 - u * 2.05);
      ball.rotation.x += dt * 6;
      if (u > .95) { ball.position.x = damp(ball.position.x, 0, 4, dt); ball.position.z = damp(ball.position.z, .5, 4, dt); ball.position.y = damp(ball.position.y, .3, 6, dt); }
    }
    nets[0].scale.y = 1 + .06 * Math.sin(t * 3.1);
    nets[1].scale.y = 1 + .03 * Math.sin(t * 3.1 + 1.5);
  }
};

heroSports.pickleball = {
  build() {
    const root = new THREE.Group();
    const pL = buildPaddle(), pR = buildPaddle();
    pL.position.set(-2.35, .32, .55); pL.rotation.z = -.5; pL.rotation.x = .2;
    pR.position.set(2.35, .32, .55); pR.scale.x = -1; pR.rotation.z = -.5; pR.rotation.x = .2;
    root.add(pL, pR);
    const ball = M(new THREE.SphereGeometry(.08, 16, 12), mat(0xdbe81f, { map: pickleTex, roughness: .55 }));
    root.add(ball);
    root.userData = { ball, pL, pR };
    return root;
  },
  update(dt, t, g) {
    const { ball, pL, pR } = g.userData;
    const P = 2.6, u = (t % P) / P;
    const v = u < .5 ? u * 2 : (u - .5) * 2;
    const dir = u < .5 ? 1 : -1;
    ball.position.x = dir * THREE.MathUtils.lerp(-2.05, 2.05, v);
    ball.position.y = .45 + 1.55 * Math.sin(Math.PI * v);
    ball.position.z = .55;
    ball.rotation.x += dt * 8; ball.rotation.z += dt * 5;
    const hit = p => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    if (u < .1 || u > .92) { const h = u < .1 ? u / .1 : (u - .92) / .08; pL.position.x = damp(pL.position.x, ball.position.x - .5, 12, dt); pL.rotation.z = -.5 - .6 * hit(h); pR.rotation.z = damp(pR.rotation.z, -.5, 8, dt); pR.position.x = damp(pR.position.x, 2.35, 6, dt); }
    else if (Math.abs(u - .5) < .1) { const h = (u - .5) / .1; pR.position.x = damp(pR.position.x, ball.position.x + .5, 12, dt); pR.rotation.z = -.5 - .6 * hit(h); pL.rotation.z = damp(pL.rotation.z, -.5, 8, dt); pL.position.x = damp(pL.position.x, -2.35, 6, dt); }
    else { pL.position.x = damp(pL.position.x, -2.35, 6, dt); pR.position.x = damp(pR.position.x, 2.35, 6, dt); pL.rotation.z = damp(pL.rotation.z, -.5, 8, dt); pR.rotation.z = damp(pR.rotation.z, -.5, 8, dt); }
  }
};

/* ---------------- hero orchestration ---------------- */
const ORDER = ['football', 'cricket', 'badminton', 'basketball', 'pickleball'];
const SPORT_META = {
  football:   { emoji: '⚽', name: 'Football',   tag: '5v5 · 7v7 · 11v11 on real turf', stat: 'Open player pool · Join the community', css: '#1f7a50' },
  cricket:    { emoji: '🏏', name: 'Cricket',    tag: '6-a-side box cricket', stat: 'Open player pool · Join the community', css: '#c08a2d' },
  badminton:  { emoji: '🏸', name: 'Badminton',  tag: 'Singles · Doubles · smash rally', stat: 'Open player pool · Join the community', css: '#6b5bd6' },
  basketball: { emoji: '🏀', name: 'Basketball', tag: '3v3 · 5v5 streetball', stat: 'Open player pool · Join the community', css: '#d95b2b' },
  pickleball: { emoji: '🎾', name: 'Pickleball', tag: 'Singles · Doubles rallies', stat: 'Open player pool · Join the community', css: '#1596a8' },
};
function setupAssembly(s) {
  s.pieces = [];
  s.assemble = 0; s.target = 0;
  s.root.children.forEach(c => {
    const home = c.position.clone();
    const homeRot = c.rotation.clone();
    const homeScale = c.scale.clone();
    let dir = new THREE.Vector3(home.x + (Math.random() - .5) * 1.2, Math.abs(home.y) + .5 + Math.random() * 1.6, home.z + (Math.random() - .5) * 1.2);
    if (dir.lengthSq() < .4) dir = new THREE.Vector3((Math.random() - .5) * 2.4, .8 + Math.random() * 1.6, (Math.random() - .5) * 2.4);
    dir.normalize();
    s.pieces.push({ m: c, home, homeRot, homeScale, dir, dist: 2.8 + Math.random() * 2.8, rot: (Math.random() - .5) * 3.6 });
  });
}
Object.keys(heroSports).forEach(k => { const s = heroSports[k]; s.root = s.build(); s.root.visible = false; stage.add(s.root); setupAssembly(s); });
let current = 'football';
heroSports.football.target = 1;

/* burst particles */
const burstN = 36;
const burstGeo = new THREE.BufferGeometry();
const burstPos = new Float32Array(burstN * 3), burstVel = [];
burstGeo.setAttribute('position', new THREE.BufferAttribute(burstPos, 3));
const burstMat = new THREE.PointsMaterial({ color: 0xc09a45, size: .07, transparent: true, opacity: 0, depthWrite: false });
const burst = new THREE.Points(burstGeo, burstMat);
burst.visible = false;
scene.add(burst);
let burstT = 99;
function spawnBurst(color) {
  burstT = 0;
  burstMat.color.set(color);
  for (let i = 0; i < burstN; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 3.2 + 1.4;
    burstPos[i * 3] = Math.cos(a) * r; burstPos[i * 3 + 1] = Math.random() * 3.2 + .4; burstPos[i * 3 + 2] = Math.sin(a) * r;
    burstVel[i] = { x: -burstPos[i * 3] * .5, y: 2.2 + Math.random() * 3, z: -burstPos[i * 3 + 2] * .5 };
  }
  burstGeo.attributes.position.needsUpdate = true;
}

/* camera orbit — calm, slow */
let theta = 0, phi = 1.24, r = 9.6, auto = true, lastInteract = 0;
function updateCamera(dt) {
  if (auto && performance.now() - lastInteract > 3800) theta += dt * .05;
  camera.position.set(r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi) + .9, r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(0, 1.55, 0);
}
let dragging = false, px = 0, py = 0;
canvas.addEventListener('pointerdown', e => { dragging = true; px = e.clientX; py = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (_) { } });
canvas.addEventListener('pointermove', e => {
  if (!dragging) return;
  theta -= (e.clientX - px) * .006; phi = Math.max(1.02, Math.min(1.44, phi - (e.clientY - py) * .004));
  px = e.clientX; py = e.clientY; auto = false; lastInteract = performance.now();
  const hd = document.querySelector('.hint-drag'); if (hd) hd.style.opacity = 0;
});
['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.addEventListener(ev, () => dragging = false));

/* hero theme UI — switching a sport rethemes the whole page */
const tabsEl = document.getElementById('sportTabs');
const panel = document.getElementById('sportPanel');
ORDER.forEach(k => {
  const m = SPORT_META[k];
  const b = document.createElement('button');
  b.className = 'sport-tab' + (k === current ? ' active' : '');
  b.innerHTML = '<span class="em">' + m.emoji + '</span><span class="nm">' + m.name + '</span>';
  b.onclick = () => selectSport(k);
  tabsEl.appendChild(b);
});
function applyTheme(k) {
  const m = SPORT_META[k];
  document.getElementById('spIco').textContent = m.emoji;
  document.getElementById('spName').textContent = m.name;
  document.getElementById('spTag').textContent = m.tag;
  document.getElementById('spStat').textContent = m.stat;
  panel.classList.remove('show'); void panel.offsetWidth; panel.classList.add('show');
  document.body.dataset.theme = k;
  Object.keys(courtMap).forEach(key => courtMap[key].visible = key === k);
  document.querySelectorAll('.sport-tab').forEach(t => t.classList.toggle('active', t.textContent.indexOf(m.name) !== -1));
  spawnBurst(new THREE.Color(m.css));
}
function selectSport(k) {
  if (k === current) return;
  heroSports[current].target = 0;
  current = k;
  heroSports[k].target = 1;
  applyTheme(k);
  renderSportDetail(k);
}
applyTheme('football');
window.maSelect = selectSport;

/* ============================================================
   PER-SPORT 3D STAGES — Apple-style exploded views
   ============================================================ */
const V3 = THREE.Vector3;

function truncatedIcosahedron(radius) {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const pos = ico.attributes.position.array;
  const keyOf = i => pos[i * 3].toFixed(5) + ',' + pos[i * 3 + 1].toFixed(5) + ',' + pos[i * 3 + 2].toFixed(5);
  const id = new Map(); const verts = [];
  for (let i = 0; i < pos.length / 3; i++) {
    const k = keyOf(i);
    if (!id.has(k)) { id.set(k, verts.length); verts.push(new V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])); }
  }
  const faces = [];
  for (let i = 0; i < pos.length / 9; i++) faces.push([id.get(keyOf(i * 3)), id.get(keyOf(i * 3 + 1)), id.get(keyOf(i * 3 + 2))]);
  const adj = Array.from({ length: verts.length }, () => new Set());
  faces.forEach(f => f.forEach(a => f.forEach(b => { if (a !== b) { adj[a].add(b); adj[b].add(a); } })));
  const pentagons = [];
  for (let i = 0; i < verts.length; i++) {
    const axis = verts[i].clone().normalize();
    let up = Math.abs(axis.y) > .9 ? new V3(1, 0, 0) : new V3(0, 1, 0);
    const u = new V3().crossVectors(axis, up).normalize();
    const v = new V3().crossVectors(axis, u);
    const nbrs = [...adj[i]].sort((a, b) => {
      const ta = verts[a].clone().sub(axis.clone().multiplyScalar(verts[a].dot(axis)));
      const tb = verts[b].clone().sub(axis.clone().multiplyScalar(verts[b].dot(axis)));
      return Math.atan2(ta.dot(v), ta.dot(u)) - Math.atan2(tb.dot(v), tb.dot(u));
    });
    pentagons.push(nbrs.map(n => verts[i].clone().multiplyScalar(2).add(verts[n]).multiplyScalar(1 / 3)));
  }
  const hexagons = faces.map(f => {
    const [a, b, c] = f.map(i => verts[i]);
    return [
      a.clone().multiplyScalar(2).add(b).multiplyScalar(1 / 3),
      a.clone().add(b.clone().multiplyScalar(2)).multiplyScalar(1 / 3),
      b.clone().multiplyScalar(2).add(c).multiplyScalar(1 / 3),
      b.clone().add(c.clone().multiplyScalar(2)).multiplyScalar(1 / 3),
      c.clone().multiplyScalar(2).add(a).multiplyScalar(1 / 3),
      c.clone().add(a.clone().multiplyScalar(2)).multiplyScalar(1 / 3),
    ];
  });
  return { pentagons, hexagons };
}
function panelGeo(pts) {
  let arr = [];
  for (let i = 1; i < pts.length - 1; i++) arr.push(pts[0], pts[i], pts[i + 1]);
  const cen = new V3(); pts.forEach(p => cen.add(p)); cen.multiplyScalar(1 / pts.length);
  const cr = new V3().crossVectors(new V3().subVectors(pts[1], pts[0]), new V3().subVectors(pts[2], pts[0]));
  if (cr.dot(cen) < 0) { const rev = []; for (let i = arr.length - 1; i >= 0; i--) rev.push(arr[i]); arr = rev; }
  const pos = new Float32Array(arr.length * 3);
  arr.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
function panelEdges(pts, cen) {
  const arr = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i].clone().sub(cen), b = pts[(i + 1) % pts.length].clone().sub(cen);
    arr.push(a, b);
  }
  const pos = new Float32Array(arr.length * 3);
  arr.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return geo;
}
function buildPanelBall(radius) {
  const { pentagons, hexagons } = truncatedIcosahedron(radius);
  const group = new THREE.Group();
  const parts = [];
  const hexMat = new THREE.MeshStandardMaterial({ color: 0xEFE9DC, roughness: .5, metalness: .04, flatShading: true });
  const penMat = new THREE.MeshStandardMaterial({ color: 0x2A2A33, roughness: .55, metalness: .1, flatShading: true });
  const seamMat = new THREE.LineBasicMaterial({ color: 0xc09a45, transparent: true, opacity: .8 });
  const add = (faces, material, isPent) => {
    faces.forEach(pts => {
      const cen = new V3(); pts.forEach(p => cen.add(p)); cen.multiplyScalar(1 / pts.length);
      const norm = cen.clone().normalize();
      const geo = panelGeo(pts);
      geo.translate(-cen.x, -cen.y, -cen.z);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.copy(cen);
      mesh.add(new THREE.LineSegments(panelEdges(pts, cen), seamMat));
      group.add(mesh);
      const stagger = isPent ? .6 : .42;
      parts.push({
        obj: mesh, home: cen.clone(),
        out: norm.clone().multiplyScalar(radius + stagger + (parts.length % 3) * .09),
        homeRot: new V3(),
        outRot: new V3(parts.length % 2 ? .55 : -.5, (parts.length % 3) * .55, parts.length % 2 ? -.35 : .4),
        bob: .9 + (parts.length % 4) * .3, wob: .7 + (parts.length % 3) * .25, phase: parts.length * .8,
      });
    });
  };
  add(pentagons, penMat, true);
  add(hexagons, hexMat, false);
  return { group, parts };
}

function groundDisc(scene, color, size = 2.5) {
  const r = size * .16, half = size;
  const s = new THREE.Shape();
  s.moveTo(-half + r, -half); s.lineTo(half - r, -half); s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r); s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half); s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r); s.quadraticCurveTo(-half, -half, -half + r, -half);
  const g = new THREE.Mesh(new THREE.ShapeGeometry(s), mat(color, { roughness: .92 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true;
  scene.add(g);
}

class StageScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.wrap = canvas.closest('.stage');
    this.sport = this.wrap.dataset.scene;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, .1, 60);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.parts = []; this.floaters = []; this.spinners = [];
    this.explode = 0; this.target = 0;
    this.theta = -.45; this.autoRot = true;
    this.t = Math.random() * 10; this.running = false; this.raf = 0;
    this.dragging = false; this.dragged = false; this.px = 0; this.lastDrag = 0;
    this.suppressExit = false;
    this.camPos = new V3(0, 2, 5); this.camLook = new V3(0, .7, 0); this.camBaseY = 2;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f6f, .7));
    const key = new THREE.DirectionalLight(0xfff7e6, 1.2); key.position.set(4, 7, 5);
    const rim = new THREE.DirectionalLight(0xc9a24b, .55); rim.position.set(-5, 3, -6);
    this.scene.add(key, rim);
    this.buildSport();
    this.camera.position.copy(this.camPos);
    this.camBaseY = this.camPos.y;
    const label = document.createElement('div');
    label.className = 'stage-exploded'; label.textContent = 'Exploded view';
    this.wrap.appendChild(label);
    this.bind();
    this.resize();
    addEventListener('resize', () => this.resize());
    if (reduced) { this.explode = 0; this.renderer.render(this.scene, this.camera); return; }
    const obs = new IntersectionObserver(es => es.forEach(en => en.isIntersecting ? this.start() : this.stop()), { threshold: .05 });
    obs.observe(this.wrap);
  }
  buildSport() {
    switch (this.sport) {
      case 'football': this.buildFootball(); break;
      case 'cricket': this.buildCricket(); break;
      case 'badminton': this.buildBadminton(); break;
      case 'basketball': this.buildBasketball(); break;
      case 'pickleball': this.buildPickleball(); break;
    }
  }
  part(obj, home, out, o = {}) {
    this.parts.push(Object.assign({
      obj, home: home.clone ? home.clone() : home, out: out.clone ? out.clone() : out,
      homeRot: new V3(), outRot: new V3(), bob: 0, wob: 0, phase: Math.random() * 7, fade: 0, mat: null,
    }, o));
  }
  float(obj, amp, spd) { this.floaters.push({ obj, baseY: obj.position.y, amp, spd, ph: Math.random() * 7 }); }
  setExplode(v) {
    this.target = v;
    this.wrap.dataset.ex = v > .5 ? '1' : '0';
    this.wrap.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', (b.dataset.view === 'exploded') === (v > .5)));
  }
  bind() {
    const cv = this.canvas;
    if (hoverable) {
      cv.addEventListener('pointerenter', () => { this.suppressExit = false; this.setExplode(1); });
      cv.addEventListener('pointerleave', () => { if (this.suppressExit) { this.suppressExit = false; return; } this.setExplode(0); });
    }
    cv.addEventListener('pointerdown', e => {
      this.dragging = true; this.dragged = false; this.px = e.clientX; this.autoRot = false; this.lastDrag = performance.now();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { }
    });
    cv.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      const dx = e.clientX - this.px;
      if (Math.abs(dx) > 4) this.dragged = true;
      this.theta -= dx * .008; this.px = e.clientX; this.lastDrag = performance.now();
    });
    const up = e => {
      if (!this.dragging) return;
      this.dragging = false; this.lastDrag = performance.now();
      if (e.pointerType === 'touch' && !this.dragged) this.setExplode(this.explode > .5 ? 0 : 1);
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    this.wrap.querySelectorAll('.view-btn').forEach(b => {
      b.addEventListener('click', () => {
        this.autoRot = true;
        this.suppressExit = true;
        this.setExplode(b.dataset.view === 'exploded' ? 1 : 0);
      });
    });
  }
  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  start() { if (this.running) return; this.running = true; this.last = performance.now(); this.tick(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  tick() {
    this.raf = requestAnimationFrame(() => this.tick());
    const dt = Math.min((performance.now() - this.last) / 1000, .05);
    this.last = performance.now(); this.t += dt;
    if (!this.dragging) {
      if (this.autoRot) this.theta += dt * (this.explode > .5 ? .08 : .2);
      else if (performance.now() - this.lastDrag > 4000) this.autoRot = true;
    }
    const p = damp(this.explode, this.target, 5, dt);
    this.explode = p;
    const e = easeOutCubic(p);
    for (const pt of this.parts) {
      if (pt.fade && pt.mat) pt.mat.opacity = p * pt.fade;
      pt.obj.position.lerpVectors(pt.home, pt.out, e);
      pt.obj.rotation.set(
        pt.homeRot.x + (pt.outRot.x - pt.homeRot.x) * e,
        pt.homeRot.y + (pt.outRot.y - pt.homeRot.y) * e,
        pt.homeRot.z + (pt.outRot.z - pt.homeRot.z) * e
      );
      if (p > .02) {
        if (pt.bob) pt.obj.position.y += Math.sin(this.t * pt.bob + pt.phase) * .05 * p;
        if (pt.wob) pt.obj.rotation.z += Math.sin(this.t * pt.wob + pt.phase) * .07 * p;
      }
    }
    for (const f of this.floaters) f.obj.position.y += Math.sin(this.t * f.spd + f.ph) * f.amp * (1 - this.explode * .5);
    for (const s of this.spinners) s.obj.rotation.y += dt * s.speed;
    this.root.rotation.y = this.theta;
    this.camera.position.y = this.camBaseY + Math.sin(this.t * .7) * .07;
    this.camera.lookAt(this.camLook);
    this.renderer.render(this.scene, this.camera);
  }
}

StageScene.prototype.buildFootball = function () {
  this.camPos.set(0, 1.9, 5.1); this.camLook.set(0, .85, .15);
  groundDisc(this.root, 0x3E9A63, 2.6);
  const ball = buildPanelBall(.8);
  ball.group.position.set(0, 1.02, -.3);
  this.root.add(ball.group);
  this.parts.push(...ball.parts);
  const core = new THREE.Mesh(new THREE.SphereGeometry(.28, 24, 18), new THREE.MeshBasicMaterial({ color: 0xe8ce8f, transparent: true, opacity: 0 }));
  ball.group.add(core);
  this.part(core, new V3(0, 0, 0), new V3(0, 0, 0), { mat: core.material, fade: .95 });
  this.spinners.push({ obj: ball.group, speed: .42 });
  const postMat = mat(0xf2efe6, { roughness: .3, metalness: .5 });
  const postL = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.15, 12), postMat);
  const postR = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.15, 12), postMat);
  postL.position.set(-.78, .58, 1.7); postR.position.set(.78, .58, 1.7);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.6, 12), postMat);
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 1.16, 1.7);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.15), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .6, side: THREE.DoubleSide }));
  net.position.set(0, .58, 1.6);
  this.root.add(postL, postR, bar, net);
  this.part(postL, postL.position, new V3(-1.55, .58, 1.7), { outRot: new V3(0, 0, -.18) });
  this.part(postR, postR.position, new V3(1.55, .58, 1.7), { outRot: new V3(0, 0, .18) });
  this.part(bar, bar.position, new V3(0, 1.7, 1.7), { outRot: new V3(0, 0, .12), bob: 1.1, wob: .6 });
  this.part(net, net.position, new V3(0, .58, .9), { wob: .8 });
  const lampMat = mat(0xe8ce8f, { roughness: .3, metalness: .4, emissive: 0xe8ce8f, emissiveIntensity: .5 });
  [-1.9, 1.9].forEach(x => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.4, 8), mat(0x1c2027, { roughness: .6 }));
    pole.position.set(x, .7, -1.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.09, 14, 12), lampMat);
    head.position.set(x, 1.46, -1.4);
    this.root.add(pole, head);
  });
};

StageScene.prototype.buildCricket = function () {
  this.camPos.set(0, 1.85, 5.2); this.camLook.set(0, 0.45, 0);
  groundDisc(this.root, 0x5FA05A, 2.6);
  const pitch = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.9), mat(0xc9ae7c, { roughness: 0.95 }));
  pitch.position.y = 0.025; pitch.receiveShadow = true;
  this.root.add(pitch);
  const creaseMat = new THREE.MeshBasicMaterial({ color: 0xefe6d2 });
  const crease = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 1.05), creaseMat);
  crease.position.set(0, 0.055, 1.15); this.root.add(crease);
  const crease2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 1.05), creaseMat);
  crease2.position.set(0, 0.055, -1.15); this.root.add(crease2);
  const stumpMat = mat(0xE8D9B8, { roughness: 0.55 });
  const stump = (x, z) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.72, 12), stumpMat);
    s.position.set(x, 0.36, z);
    this.root.add(s);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.028, 12), stumpMat);
    top.position.set(x, 0.73, z);
    this.root.add(top);
    return s;
  };
  const sL = stump(-0.1, 1.15), sM = stump(0, 1.15), sR = stump(0.1, 1.15);
  this.part(sL, sL.position, new V3(-0.7, 0.55, 1.15));
  this.part(sM, sM.position, new V3(0, 0.78, 1.15));
  this.part(sR, sR.position, new V3(0.7, 0.55, 1.15));
  const bailMat = mat(0xB91C1C, { roughness: 0.4 });
  const bail = (x) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.018, 0.022), bailMat);
    b.position.set(x, 0.76, 1.15);
    this.root.add(b);
    return b;
  };
  const bA = bail(-0.05), bB = bail(0.05);
  this.part(bA, bA.position, new V3(-0.05, 1.15, 1.15), { bob: 1.6, wob: 2.2 });
  this.part(bB, bB.position, new V3(0.05, 1.2, 1.15), { bob: 1.4, wob: 2.6 });
  const bladeMat = mat(0xF3E4C0, { roughness: 0.65 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.56, 0.04), bladeMat);
  blade.position.set(0.85, 0.58, -0.7); blade.rotation.z = -0.38;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.26, 10), mat(0x1a1a22, { roughness: 0.5 }));
  handle.position.set(0.72, 0.16, -0.7); handle.rotation.z = -0.38;
  this.root.add(blade, handle);
  this.part(blade, blade.position, new V3(0.85, 0.08, -1.25), { outRot: new V3(0, 0, -0.6), bob: 1.2 });
  this.part(handle, handle.position, new V3(0.65, 1.0, -0.7), { outRot: new V3(0, 0, -0.18), bob: 1.4 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), mat(0xC41E3A, { roughness: 0.4, metalness: 0.05 }));
  ball.position.set(-0.55, 0.11, -0.95);
  this.root.add(ball);
  this.part(ball, ball.position, new V3(-0.55, 0.7, -1.45), { bob: 1.7, wob: 1.1 });
};

StageScene.prototype.buildBadminton = function () {
  this.camPos.set(0, 1.9, 5.0); this.camLook.set(0, .7, 0);
  groundDisc(this.root, 0x2E9E5B, 2.5);
  const court = new THREE.Mesh(new THREE.BoxGeometry(2.5, .03, 1.7), mat(0x27905a, { roughness: .92 }));
  court.position.y = .015; court.receiveShadow = true;
  this.root.add(court);
  const lMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 });
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(2.35, .01, .03), lMat); l1.position.y = .035; this.root.add(l1);
  const l2 = new THREE.Mesh(new THREE.BoxGeometry(.03, .01, 1.55), lMat); l2.position.y = .035; this.root.add(l2);
  const l3 = new THREE.Mesh(new THREE.BoxGeometry(.03, .01, 1.55), lMat); l3.position.set(.78, .035, 0); this.root.add(l3);
  const l4 = new THREE.Mesh(new THREE.BoxGeometry(.03, .01, 1.55), lMat); l4.position.set(-.78, .035, 0); this.root.add(l4);
  const postMat = mat(0x3a3a46, { roughness: .5 });
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1.05, 8), postMat); pL.position.set(-1.1, .52, 0);
  const pR = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1.05, 8), postMat); pR.position.set(1.1, .52, 0);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .8), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .85, side: THREE.DoubleSide }));
  net.position.set(0, .42, 0);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(2.22, .028, .018), mat(0xf5f5f7)); tape.position.set(0, .83, 0);
  this.root.add(pL, pR, net, tape);
  this.part(pL, pL.position, new V3(-1.65, .52, 0));
  this.part(pR, pR.position, new V3(1.65, .52, 0));
  this.part(net, net.position, new V3(0, .42, -.5), { wob: .6 });
  this.part(tape, tape.position, new V3(0, 1.25, 0), { bob: 1 });
  const cork = new THREE.Mesh(new THREE.SphereGeometry(.08, 14, 12), mat(0xf3e7c4, { roughness: .5 }));
  cork.scale.set(1, .85, 1); cork.position.set(0, .74, .42);
  const skirt = new THREE.Mesh(new THREE.ConeGeometry(.2, .26, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfafaf5, side: THREE.DoubleSide, transparent: true, opacity: .85 }));
  skirt.position.set(0, .47, .42);
  const feathers = new THREE.Group(); feathers.position.set(0, .58, .42);
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    const f = new THREE.Mesh(new THREE.BoxGeometry(.018, .26, .04), mat(0xf6f1e0, { roughness: .6, transparent: true, opacity: .92 }));
    f.position.set(Math.cos(a) * .16, .04, Math.sin(a) * .16);
    f.rotation.y = -a; f.rotation.x = .38;
    feathers.add(f);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(.13, .009, 6, 18), new THREE.MeshBasicMaterial({ color: 0xd64541 }));
  band.position.set(0, .37, .42); band.rotation.x = Math.PI / 2;
  this.root.add(cork, skirt, feathers, band);
  this.part(cork, cork.position, new V3(0, 1.28, .42), { bob: 1.2 });
  this.part(skirt, skirt.position, new V3(0, .16, .42), { bob: .9 });
  this.part(feathers, feathers.position, new V3(0, .7, .42), { outRot: new V3(0, .6, .35), wob: 1.1, bob: 1.4 });
  this.part(band, band.position, new V3(0, .2, .42), { wob: .7 });
  this.float(cork, .03, 1.1); this.float(skirt, .03, 1.1); this.float(feathers, .03, 1.1); this.float(band, .03, 1.1);
  const rack = new THREE.Group();
  rack.position.set(.9, .42, -.6); rack.rotation.z = -.42; rack.rotation.x = .25;
  const head = new THREE.Mesh(new THREE.TorusGeometry(.235, .018, 10, 32), mat(0x6b5bd6, { roughness: .3, metalness: .5 }));
  head.scale.set(1, 1.32, 1); head.rotation.y = Math.PI / 2; head.position.y = .34;
  const head2 = new THREE.Mesh(new THREE.TorusGeometry(.228, .009, 8, 32), mat(0x6b5bd6, { roughness: .3, metalness: .5 }));
  head2.scale.set(1, 1.32, 1); head2.rotation.y = Math.PI / 2; head2.position.set(0, .34, .012);
  const strings = new THREE.Mesh(new THREE.PlaneGeometry(.4, .54), new THREE.MeshBasicMaterial({ map: stringTex, transparent: true, opacity: .6, side: THREE.DoubleSide }));
  strings.rotation.y = Math.PI / 2; strings.position.y = .34;
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.01, .017, .18, 8), mat(0x6b5bd6, { roughness: .3, metalness: .5 }));
  t1.position.set(.045, .08, 0); t1.rotation.z = -.6;
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(.01, .017, .18, 8), mat(0x6b5bd6, { roughness: .3, metalness: .5 }));
  t2.position.set(-.045, .08, 0); t2.rotation.z = .6;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.014, .018, .18, 8), mat(0x4a3e8f, { roughness: .4, metalness: .5 }));
  shaft.position.y = -.01;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.024, .03, .2, 10), mat(0x24242f, { roughness: .75 }));
  handle.position.y = -.18;
  const band1 = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .022, 10), mat(0xc09a45, { roughness: .5 })); band1.position.y = -.11;
  const band2 = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .022, 10), mat(0xc09a45, { roughness: .5 })); band2.position.y = -.26;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), mat(0x24242f, { roughness: .75 })); cap.position.y = -.29;
  rack.add(head, head2, strings, t1, t2, shaft, handle, band1, band2, cap);
  this.root.add(rack);
  this.part(head, new V3(0, .34, 0), new V3(0, 1.0, 0), { bob: 1.3, wob: .7 });
  this.part(head2, new V3(0, .34, .012), new V3(0, 1.05, .012), { bob: 1.2, wob: .8 });
  this.part(strings, new V3(0, .34, 0), new V3(0, 1.08, 0), { bob: 1.1, wob: 1 });
  this.part(t1, new V3(.045, .08, 0), new V3(.16, .28, 0));
  this.part(t2, new V3(-.045, .08, 0), new V3(-.16, .28, 0));
  this.part(shaft, new V3(0, -.01, 0), new V3(0, -.4, 0));
  this.part(handle, new V3(0, -.18, 0), new V3(0, -.6, 0), { wob: .8 });
  this.part(band1, new V3(0, -.11, 0), new V3(0, -.5, 0), { wob: .6 });
  this.part(band2, new V3(0, -.26, 0), new V3(0, -.65, 0), { wob: .7 });
  this.part(cap, new V3(0, -.29, 0), new V3(0, -.7, 0), { wob: .5 });
};

StageScene.prototype.buildBasketball = function () {
  this.camPos.set(0, 2.5, 5.3); this.camLook.set(0, 1.25, .2);
  groundDisc(this.root, 0xC98F52, 2.5);
  const hoop = new THREE.Group();
  hoop.position.set(0, 0, 1.45);
  const poleMat = mat(0xd8d8e2, { roughness: .4, metalness: .5 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, 2.3, 12), poleMat);
  pole.position.set(.95, 1.15, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(.74, .05, .05), poleMat);
  arm.position.set(.52, 2.22, 0);
  const board = new THREE.Mesh(new THREE.BoxGeometry(.78, .5, .05), mat(0xeef0f6, { roughness: .3, metalness: .2, transparent: true, opacity: .94 }));
  board.position.set(.05, 2.2, 0);
  const square = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0xe07a4f, transparent: true, opacity: .85 }));
  square.position.set(-.22, 2.2, .028);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.19, .02, 10, 26), mat(0xe07a4f, { roughness: .35, metalness: .6 }));
  rim.position.set(-.32, 1.97, 0); rim.rotation.x = Math.PI / 2;
  const net = new THREE.Mesh(new THREE.CylinderGeometry(.19, .135, .46, 16, 1, true), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .85, side: THREE.DoubleSide }));
  net.position.set(-.32, 1.7, 0);
  hoop.add(pole, arm, board, square, rim, net);
  this.root.add(hoop);
  this.part(pole, new V3(.95, 1.15, 0), new V3(.95, .45, 0));
  this.part(arm, new V3(.52, 2.22, 0), new V3(.6, 2.75, 0));
  this.part(board, new V3(.05, 2.2, 0), new V3(.05, 2.85, 0), { outRot: new V3(0, 0, -.25), bob: 1.1 });
  this.part(square, new V3(-.22, 2.2, .028), new V3(-.22, 2.85, .028), { outRot: new V3(0, 0, -.25) });
  this.part(rim, new V3(-.32, 1.97, 0), new V3(-.32, 2.55, 0), { bob: 1.4 });
  this.part(net, new V3(-.32, 1.7, 0), new V3(-.32, 1.35, 0), { wob: .8 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.24, 28, 22), mat(0xf07820, { map: basketTex, roughness: .5 }));
  ball.position.set(-.32, .26, .05);
  this.root.add(ball);
  this.part(ball, ball.position, new V3(-.32, 1.0, .05), { bob: 1.6, wob: .9 });
};

StageScene.prototype.buildPickleball = function () {
  this.camPos.set(0, 1.9, 5.0); this.camLook.set(0, .6, 0);
  groundDisc(this.root, 0x1F8FB0, 2.5);
  const court = new THREE.Mesh(new THREE.BoxGeometry(2.7, .03, 1.5), mat(0x1b82a1, { roughness: .9 }));
  court.position.y = .015; court.receiveShadow = true;
  this.root.add(court);
  const lMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .7 });
  [[0, 0, .03, 2.55], [0, 0, 2.55, .03], [0, -.42, .03, 2.55], [0, .42, .03, 2.55]].forEach(([x, z, lw, ld]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(lw, .01, ld), lMat); l.position.set(x, .035, z); this.root.add(l);
  });
  const postMat = mat(0x3a3a46, { roughness: .5 });
  const pL = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5, 8), postMat); pL.position.set(-1.2, .25, 0);
  const pR = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .5, 8), postMat); pR.position.set(1.2, .25, 0);
  const net = new THREE.Mesh(new THREE.PlaneGeometry(2.42, .4), new THREE.MeshBasicMaterial({ map: netTex, transparent: true, opacity: .85, side: THREE.DoubleSide }));
  net.position.set(0, .2, 0);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(2.44, .028, .018), mat(0xf5f5f7)); tape.position.set(0, .41, 0);
  this.root.add(pL, pR, net, tape);
  this.part(pL, pL.position, new V3(-1.8, .3, 0));
  this.part(pR, pR.position, new V3(1.8, .3, 0));
  this.part(net, net.position, new V3(0, .2, -.55), { wob: .7 });
  this.part(tape, tape.position, new V3(0, .95, 0), { bob: 1 });
  const pad = new THREE.Group();
  pad.position.set(.62, .42, -.55); pad.rotation.z = -.45; pad.rotation.x = .2;
  const w = .22, h = .3, r = .06;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2); shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r); shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2); shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r); shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const edge = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0x1f1f2a, { roughness: .4 }));
  edge.scale.set(1.04, 1.06, 1); edge.rotation.x = -Math.PI / 2; edge.position.y = .03;
  const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(0x2fca75, { map: honeyTex, roughness: .45 }));
  face.rotation.x = -Math.PI / 2; face.position.y = .045;
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.014, .018, .14, 8), mat(0x24242f, { roughness: .75 }));
  handle.position.y = -.12;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 8), mat(0x24242f, { roughness: .75 }));
  cap.position.y = -.2;
  pad.add(edge, face, handle, cap);
  this.root.add(pad);
  this.part(edge, new V3(0, .03, 0), new V3(0, -.15, 0), { wob: .5 });
  this.part(face, new V3(0, .045, 0), new V3(0, .5, 0), { bob: 1.2, wob: .8 });
  this.part(handle, new V3(0, -.12, 0), new V3(0, -.5, 0));
  this.part(cap, new V3(0, -.2, 0), new V3(0, -.6, 0));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), mat(0xdbe81f, { map: pickleTex, roughness: .55 }));
  ball.position.set(-.6, .16, .4);
  this.root.add(ball);
  this.part(ball, ball.position, new V3(-.6, .75, .4), { bob: 1.6, wob: 1.2 });
};

document.querySelectorAll('.stage canvas').forEach(cv => {
  try { stageRefs.push(new StageScene(cv)); } catch (err) { console.error('stage error', err); }
});

/* ============================================================
   HERO MAIN LOOP
   ============================================================ */
const clock = new THREE.Clock();
const tBg = new THREE.Color(), tFog = new THREE.Color(), tL = new THREE.Color();
function resize() { const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
updateCamera(0);

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  ORDER.forEach(k => {
    const s = heroSports[k], g = s.root;
    s.assemble = damp(s.assemble, s.target, 4.4, dt);
    const a = s.assemble;
    g.visible = a > .015;
    if (Math.abs(a - s.target) > .004) {
      const kk = 1 - a, e = easeOutCubic(kk);
      s.pieces.forEach(p => {
        p.m.position.copy(p.home).addScaledVector(p.dir, p.dist * e);
        p.m.rotation.set(p.homeRot.x, p.homeRot.y, p.homeRot.z + p.rot * e);
        p.m.scale.copy(p.homeScale).multiplyScalar(1 - .42 * e);
      });
    } else if (a < .999) {
      s.pieces.forEach(p => { p.m.position.copy(p.home); p.m.rotation.copy(p.homeRot); p.m.scale.copy(p.homeScale); });
    }
    if (a > .55 && s.update) s.update(dt, t, g);
  });
  const C = COLORS[current];
  dampC(sceneBg, tBg.setHex(C.bg), 2.6, dt);
  dampC(sceneFog, tFog.setHex(C.bg), 2.6, dt);
  dampC(key.color, tL.setHex(C.light), 2.6, dt);
  grassTex.offset.x += dt * .02;
  updateCamera(dt);
  if (burstT < 1) {
    burstT += dt;
    burst.visible = true;
    burstMat.opacity = Math.sin(Math.PI * Math.min(1, burstT));
    for (let i = 0; i < burstN; i++) {
      burstPos[i * 3] += burstVel[i].x * dt; burstPos[i * 3 + 1] += burstVel[i].y * dt; burstPos[i * 3 + 2] += burstVel[i].z * dt;
    }
    burstGeo.attributes.position.needsUpdate = true;
  } else { burst.visible = false; burstMat.opacity = 0; }
  const pos = dust.geometry.attributes.position.array;
  for (let i = 1; i < pos.length; i += 3) pos[i] += Math.sin(t * .5 + i) * .0006;
  dust.geometry.attributes.position.needsUpdate = true;
  renderer.render(scene, camera);
}
if (!reduced) tick();
else {
  ORDER.forEach(k => {
    const s = heroSports[k];
    s.assemble = s.target;
    s.root.visible = s.assemble > .015;
    s.pieces.forEach(p => { p.m.position.copy(p.home); p.m.rotation.copy(p.homeRot); p.m.scale.copy(p.homeScale); });
  });
  updateCamera(0);
  renderer.render(scene, camera);
}

} /* end HAS3D */

/* ============================================================
   UI WIRING
   ============================================================ */
const nav = document.getElementById('nav');
addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 40), { passive: true });
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');
burger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  burger.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', open);
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
}));

const vw = document.getElementById('vword');
'MATCHARENA'.split('').forEach((ch, i) => {
  const w = document.createElement('span');
  w.className = 'vl';
  w.textContent = ch;
  w.style.animationDelay = (i * .4) + 's';
  vw.appendChild(w);
});

const io = new IntersectionObserver(es => es.forEach(en => {
  if (en.isIntersecting) {
    en.target.classList.add('in'); io.unobserve(en.target);
    en.target.querySelectorAll('.counter').forEach(runCounter);
    if (en.target.classList.contains('counter')) runCounter(en.target);
  }
}), { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));
document.querySelectorAll('.counter').forEach(el => io.observe(el));
function runCounter(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const end = +el.dataset.count, dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
  const t0 = performance.now(), dur = 1600;
  (function step(now) {
    const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = (end * e).toFixed(dec) + suf;
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}

const GAMES = [
  { e: '⚽', s: 'football',   t: 'Sunday Evening 7v7',    m: 'GreenTurf Arena, Gomti Nagar · Sun 6:00 PM · All levels', j: 11, c: 14 },
  { e: '⚽', s: 'football',   t: 'Weekday 5v5 Kickabout', m: 'KickOff Turf, Hazratganj · Wed 7:30 PM · Intermediate', j: 8, c: 10 },
  { e: '🏏', s: 'cricket',    t: 'Box Cricket Night',     m: 'SixerBox, Indira Nagar · Sat 8:00 PM · Beginner', j: 9, c: 12 },
  { e: '🏏', s: 'cricket',    t: 'Weekend Gully League',  m: 'Alambagh Grounds · Sun 9:00 AM · Competitive', j: 14, c: 16 },
  { e: '🏸', s: 'badminton',  t: 'Doubles Ladder Night',  m: 'SmashCourt, Aliganj · Tue 7:00 PM · Intermediate', j: 6, c: 8 },
  { e: '🏀', s: 'basketball', t: '3v3 Streetball',        m: 'HoopZone, Gomti Nagar · Fri 6:30 PM · All levels', j: 5, c: 6 },
  { e: '🎾', s: 'pickleball', t: 'Sunrise Pickleball',    m: 'PaddleUp Courts, Vibhuti Khand · Sat 6:30 AM · Just starting', j: 4, c: 8 },
  { e: '🏀', s: 'basketball', t: 'Weeknight 5v5 Run',     m: 'CourtSide, Vikas Nagar · Thu 8:00 PM · Competitive', j: 7, c: 10 },
];
const grid = document.getElementById('gameGrid');
let filter = 'all';
function renderGames() {
  grid.innerHTML = '';
  GAMES.filter(g => filter === 'all' || g.s === filter).forEach(g => {
    const d = document.createElement('div');
    d.className = 'game card';
    const left = g.c - g.j, pct = Math.round(g.j / g.c * 100);
    d.innerHTML = '<div class="g-top"><span class="g-ico">' + g.e + '</span><div><div class="g-title">' + g.t + '</div><div class="g-meta">' + g.m + '</div></div></div>' +
      '<div class="g-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="g-foot"><span class="g-spots ' + (left <= 2 ? 'warn' : '') + '"><b>' + g.j + '/' + g.c + '</b> joined · ' + left + ' spot' + (left === 1 ? '' : 's') + ' left</span>' +
      '<button class="g-join">Join</button></div>';
    d.querySelector('.g-join').addEventListener('click', ev => {
      const b = ev.currentTarget;
      if (b.classList.contains('joined')) return;
      b.classList.add('joined'); b.textContent = 'Joined ✓';
      toast('You’re in the squad for ' + g.t + '. Venue details coming by WhatsApp.');
    });
    grid.appendChild(d);
  });
}
renderGames();
document.querySelectorAll('#filters .chip').forEach(ch => ch.addEventListener('click', () => {
  document.querySelectorAll('#filters .chip').forEach(c => c.classList.remove('active'));
  ch.classList.add('active'); filter = ch.dataset.f;
  grid.style.opacity = 0; grid.style.transform = 'translateY(10px)';
  setTimeout(() => { renderGames(); grid.style.transition = '.4s'; grid.style.opacity = 1; grid.style.transform = 'none'; }, 200);
}));

const toastEl = document.getElementById('toast');
let toastT;
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 3400); }

function setTheme(k) {
  document.body.dataset.theme = k;
  document.querySelectorAll('.arena-btn').forEach(b => b.classList.toggle('active', b.dataset.sport === k));
  document.querySelectorAll('.sport-card').forEach(c => c.classList.toggle('active', c.dataset.sport === k));
  if (window.maSelect) window.maSelect(k);
  renderSportDetail(k);
}
document.querySelectorAll('.arena-btn').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.sport)));
document.querySelectorAll('#joinChips input').forEach(inp => inp.addEventListener('change', () => { if (inp.checked) setTheme(inp.value.toLowerCase()); }));

const SD_EMOJI = { Football: '⚽', Cricket: '🏏', Badminton: '🏸', Basketball: '🏀', Pickleball: '🎾' };
const SPORT_DETAILS = {
  football: {
    emoji: '⚽', name: 'Football', tag: '5v5 · 7v7 · 11v11 on real turf',
    upcoming: [
      { d: 'Sun · 6:00 PM', v: 'GreenTurf, Gomti Nagar', s: '5v5 · 8/10 spots' },
      { d: 'Wed · 8:00 PM', v: 'SkyPark, Vibhuti Khand', s: '7v7 · 11/14 spots' },
      { d: 'Fri · 7:00 PM', v: 'ArenaTurf, Aliganj', s: '11v11 · 17/22 spots' },
    ],
    past: [
      { d: 'Jul 28', r: 'MatchArena Reds 3–2 Blues', v: 'GreenTurf · 47 min' },
      { d: 'Jul 21', r: 'North XI 1–1 South United', v: 'SkyPark · shootout' },
      { d: 'Jul 14', r: 'Gomti FC 4–1 Aliganj', v: 'ArenaTurf · cup round' },
    ],
    photos: [{ e: '🥅', c: 'Goal-line drama' }, { e: '⚽', c: 'Dribble at dusk' }, { e: '🧤', c: 'Save of the season' }, { e: '🏆', c: 'City cup night' }],
    related: ['Cricket', 'Basketball', 'Pickleball'],
  },
  cricket: {
    emoji: '🏏', name: 'Cricket', tag: '6-a-side box cricket · gully leagues',
    upcoming: [
      { d: 'Sat · 8:00 PM', v: 'SixerBox, Indira Nagar', s: '6v6 · 4/12 spots' },
      { d: 'Sun · 7:00 AM', v: 'GullyGround, Aliganj', s: '8v8 · 7/16 spots' },
      { d: 'Thu · 9:00 PM', v: 'Midwicket, Hazratganj', s: '6v6 · 9/12 spots' },
    ],
    past: [
      { d: 'Jul 27', r: 'Cover Drive 84 – 79 Dot Ball', v: 'SixerBox · 6 overs' },
      { d: 'Jul 20', r: 'Sweepers 96 – 88 Strikers', v: 'GullyGround · run fest' },
      { d: 'Jul 13', r: 'Gomti Tigers 112 – 101 Royals', v: 'Midwicket · final over' },
    ],
    photos: [{ e: '🏏', c: 'Straight down the ground' }, { e: '🧢', c: 'Box cricket nights' }, { e: '🎯', c: 'Yorker clinic' }, { e: '🏆', c: 'Gully league trophy' }],
    related: ['Football', 'Badminton', 'Basketball'],
  },
  badminton: {
    emoji: '🏸', name: 'Badminton', tag: 'Singles · Doubles · smash rally',
    upcoming: [
      { d: 'Tue · 7:00 PM', v: 'SmashCourt, Aliganj', s: 'Doubles · 6/8 spots' },
      { d: 'Sat · 6:00 AM', v: 'FeatherFit, Gomti Nagar', s: 'Singles ladder · 5/10' },
      { d: 'Mon · 8:00 PM', v: 'NetPlay, Indira Nagar', s: 'Mixed doubles · 3/8' },
    ],
    past: [
      { d: 'Jul 26', r: 'Rally Kings 21–18 Net Ninjas', v: 'SmashCourt · best of 3' },
      { d: 'Jul 19', r: 'Drop Shot 21–15 Smashers', v: 'FeatherFit · singles' },
      { d: 'Jul 12', r: 'Deuce Crew 21–19 Shuttle', v: 'NetPlay · final' },
    ],
    photos: [{ e: '🏸', c: 'Smash hour' }, { e: '🪶', c: 'Feather flicks' }, { e: '🏃', c: 'Court sprints' }, { e: '🥇', c: 'Ladder night' }],
    related: ['Pickleball', 'Football', 'Basketball'],
  },
  basketball: {
    emoji: '🏀', name: 'Basketball', tag: '3v3 · 5v5 streetball',
    upcoming: [
      { d: 'Fri · 6:30 PM', v: 'HoopZone, Gomti Nagar', s: '3v3 · 5/9 spots' },
      { d: 'Sun · 8:00 AM', v: 'FullCourt, Vikas Nagar', s: '5v5 · 7/10 spots' },
      { d: 'Wed · 7:30 PM', v: 'SkyHook, Gomti Nagar', s: '3v3 · 8/9 spots' },
    ],
    past: [
      { d: 'Jul 25', r: 'Ballers 42–38 Shooters', v: 'HoopZone · OT thriller' },
      { d: 'Jul 18', r: 'Rim Rattlers 51–47 Dunkers', v: 'FullCourt · street night' },
      { d: 'Jul 11', r: 'City Hoops 46–44 Gunners', v: 'SkyHook · buzzer beater' },
    ],
    photos: [{ e: '🏀', c: 'Street night' }, { e: '🧱', c: 'Overtime legs' }, { e: '🔺', c: 'Pick and roll' }, { e: '🏆', c: '3v3 champs' }],
    related: ['Football', 'Badminton', 'Cricket'],
  },
  pickleball: {
    emoji: '🎾', name: 'Pickleball', tag: 'Singles · Doubles rallies',
    upcoming: [
      { d: 'Sat · 6:30 AM', v: 'PaddleUp, Vibhuti Khand', s: 'Doubles · 6/8 spots' },
      { d: 'Sun · 6:00 AM', v: 'DinkDen, Gomti Nagar', s: 'Open rally · 9/12' },
      { d: 'Tue · 6:30 PM', v: 'KitchenCourt, Aliganj', s: 'Singles · 4/8 spots' },
    ],
    past: [
      { d: 'Jul 24', r: 'Dinkers 11–9 Poppers', v: 'PaddleUp · 2 sets' },
      { d: 'Jul 17', r: 'Kitchen Crew 11–7 Volley', v: 'DinkDen · doubles' },
      { d: 'Jul 10', r: 'Spin City 11–10 Netters', v: 'KitchenCourt · rally night' },
    ],
    photos: [{ e: '🎾', p: 'paddle', c: 'Dink drills' }, { e: '🌅', c: 'Sunrise rallies' }, { e: '🕸️', c: 'Net battles' }, { e: '🏆', c: 'First ladder title' }],
    related: ['Badminton', 'Basketball', 'Football'],
  },
};
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function renderSportDetail(k) {
  const el = document.getElementById('sportDetail');
  const d = SPORT_DETAILS[k];
  if (!el || !d) return;
  const up = d.upcoming.map(u => '<div class="sd-row"><b>' + esc(u.d) + '</b><span>' + esc(u.v) + '</span><i>' + esc(u.s) + '</i></div>').join('');
  const past = d.past.map(p => '<div class="sd-row"><b>' + esc(p.r) + '</b><span>' + esc(p.d) + '</span><i>' + esc(p.v) + '</i></div>').join('');
  const rel = d.related.map(r => '<button class="chip" data-goto="' + esc(r.toLowerCase()) + '">' + (SD_EMOJI[r] || '') + ' ' + esc(r) + '</button>').join('');
  el.innerHTML =
    '<div class="sd-head">' +
      '<span class="sd-ico">' + d.emoji + '</span>' +
      '<div class="sd-id"><h3>' + d.name + ' clubroom</h3><p>' + esc(d.tag) + '</p></div>' +
      '<button class="btn btn-ghost btn-sm sd-3d" data-stage="' + esc(k) + '">Explore 3D arena <span>→</span></button>' +
    '</div>' +
    '<div class="sd-grid sd-grid-3">' +
      '<div class="sd-col"><h4>Upcoming games</h4>' + up + '</div>' +
      '<div class="sd-col"><h4>Past matches</h4>' + past + '</div>' +
      '<div class="sd-col"><h4>Related arenas</h4><div class="sd-related">' + rel + '</div>' +
        '<form class="sd-form" data-form="' + esc(d.name) + '"><h4>Join ' + d.name + ' now</h4>' +
        '<label>Full name<input name="n" placeholder="Your name" autocomplete="name" required /></label>' +
        '<label>Phone<input name="p" placeholder="98xxxxxxxx" inputmode="numeric" autocomplete="tel" required /></label>' +
        '<button class="btn btn-gold btn-sm btn-block" type="submit">Join the community <span>→</span></button>' +
        '<div class="sd-msg" role="status" aria-live="polite"></div>' +
        '</form>' +
      '</div>' +
    '</div>';
  el.hidden = false;
  el.querySelectorAll('[data-stage]').forEach(b => b.addEventListener('click', () => openStage(b.dataset.stage)));
  el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => {
    setTheme(b.dataset.goto);
    const card = document.getElementById('sport-' + b.dataset.goto);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  const form = el.querySelector('.sd-form');
  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const msg = form.querySelector('.sd-msg');
    const n = form.n.value.trim(), p = form.p.value.trim();
    if (!n) return msg.textContent = 'Tell us your name.', msg.className = 'sd-msg err';
    if (!/^\d{10}$/.test(p)) return msg.textContent = 'Enter a valid 10-digit phone number.', msg.className = 'sd-msg err';

    // Send data to your new backend
    fetch('https://matcharena-backend-1.onrender.com/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'join', name: n, phone: p, sport: form.dataset.form })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        msg.textContent = 'You’re in, ' + n.split(' ')[0] + '! Fixture invites go to ' + p + ' on WhatsApp.';
        msg.className = 'sd-msg ok';
        toast('🎉 Welcome to the ' + form.dataset.form + ' clubroom!');
        form.reset();
      } else {
        msg.textContent = 'Something went wrong. Please try again.';
        msg.className = 'sd-msg err';
      }
    })
    .catch(() => {
      msg.textContent = 'Network error. Please check your connection.';
      msg.className = 'sd-msg err';
    });
  });
}
renderSportDetail('football');

document.querySelectorAll('.join-community').forEach(b => b.addEventListener('click', () => {
  const sport = b.dataset.sport;
  document.querySelectorAll('#joinChips input').forEach(inp => { inp.checked = inp.value === sport; if (inp.checked) setTheme(inp.value.toLowerCase()); });
  document.getElementById('join').scrollIntoView({ behavior: 'smooth' });
  setTimeout(() => { const n = document.querySelector('#joinForm input[name=jname]'); if (n) n.focus(); }, 600);
}));

document.querySelectorAll('.sport-card').forEach(card => card.addEventListener('click', e => {
  if (e.target.closest('button, a')) return;
  setTheme(card.dataset.sport);
  const sd = document.getElementById('sportDetail');
  if (sd) sd.scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

let cart = [];
try { cart = JSON.parse(localStorage.getItem('ma_cart') || '[]'); } catch (_) { cart = []; }
const cartBtn = document.getElementById('cartBtn');
const cartCount = document.getElementById('cartCount');
const cartDrawer = document.getElementById('cartDrawer');
const cartOverlay = document.getElementById('cartOverlay');
const cartItemsEl = document.getElementById('cartItems');
const cartTotalEl = document.getElementById('cartTotal');
const cartCheckout = document.getElementById('cartCheckout');
function saveCart() { try { localStorage.setItem('ma_cart', JSON.stringify(cart)); } catch (_) { } }
function cartQty() { return cart.reduce((s, i) => s + i.q, 0); }
function renderCart() {
  const q = cartQty();
  cartCount.hidden = q === 0;
  cartCount.textContent = q;
  document.getElementById('cartTabCount').textContent = q;
  if (q === 0) {
    cartItemsEl.innerHTML = '<div class="cart-empty"><span class="big">🛒</span>Your cart is empty.<br />Grab a jersey from the shop!</div>';
    cartTotalEl.textContent = '₹0';
    cartCheckout.removeAttribute('href');
    return;
  }
  let html = '';
  cart.forEach((it, idx) => {
    html += '<div class="cart-item"><span class="ci-emoji">' + it.emoji + '</span><div><div class="ci-name">' + it.name + '</div><div class="ci-price">₹' + (it.price * it.q).toLocaleString('en-IN') + '</div></div>' +
      '<div class="ci-qty"><button data-act="dec" data-i="' + idx + '">−</button><b>' + it.q + '</b><button data-act="inc" data-i="' + idx + '">+</button></div>' +
      '<button class="ci-remove" data-act="del" data-i="' + idx + '" aria-label="Remove ' + it.name + '">✕</button></div>';
  });
  cartItemsEl.innerHTML = html;
  cartTotalEl.textContent = '₹' + cart.reduce((s, i) => s + i.price * i.q, 0).toLocaleString('en-IN');
  const lines = cart.map(i => '- ' + i.name + ' x' + i.q + ' (₹' + (i.price * i.q).toLocaleString('en-IN') + ')').join('\n');
  cartCheckout.setAttribute('href', 'https://wa.me/919000000000?text=' + encodeURIComponent('Hi MatchArena! I’d like to order:\n' + lines + '\nTotal: ₹' + cart.reduce((s, i) => s + i.price * i.q, 0).toLocaleString('en-IN')));
}
function addCart(name, price, emoji) {
  const it = cart.find(i => i.name === name);
  if (it) it.q++; else cart.push({ name, price, emoji, q: 1 });
  saveCart(); renderCart();
  cartCount.classList.add('bump'); setTimeout(() => cartCount.classList.remove('bump'), 300);
  toast(emoji + ' ' + name + ' added to cart');
}
function openDrawer(tab) {
  cartDrawer.classList.add('open'); cartOverlay.classList.add('open');
  cartBtn.setAttribute('aria-expanded', 'true');
  setDrawerTab(tab);
}
function setDrawerTab(tab) {
  document.querySelectorAll('.cart-tab').forEach(b => {
    const on = b.dataset.ctab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  document.getElementById('shopView').hidden = tab !== 'shop';
  document.getElementById('cartView').hidden = tab !== 'cart';
}
cartBtn.addEventListener('click', () => openDrawer('shop'));
function closeCart() { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('open'); cartBtn.setAttribute('aria-expanded', 'false'); }
document.querySelectorAll('[data-cart-close]').forEach(el => el.addEventListener('click', closeCart));
addEventListener('keydown', e => { if (e.key === 'Escape') { closeCart(); closeStage(); } });
cartItemsEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const idx = +b.dataset.i, act = b.dataset.act;
  if (act === 'inc') cart[idx].q++;
  else if (act === 'dec') { cart[idx].q--; if (cart[idx].q <= 0) cart.splice(idx, 1); }
  else cart.splice(idx, 1);
  saveCart(); renderCart();
});
const SHOP_ITEMS = [
  { name: 'Football Home Kit',    price: 1499, emoji: '⚽', c1: '#1F7A50', c2: '#155C3B' },
  { name: 'Cricket Box Kit',      price: 1299, emoji: '🏏', c1: '#2B3A86', c2: '#1C2A5E' },
  { name: 'Streetball Jersey',    price: 1899, emoji: '🏀', c1: '#D95B2B', c2: '#A8441F' },
  { name: 'Sunrise Pickleball Tee', price: 999, emoji: '🎾', c1: '#1596A8', c2: '#0F7A88' },
  { name: 'Smash Club Tee',       price: 1199, emoji: '🏸', c1: '#6B5BD6', c2: '#4A3E8F' },
  { name: 'Captain Edition',      price: 2499, emoji: '👑', c1: '#23262E', c2: '#13141C' },
];
const shopView = document.getElementById('shopView');
function renderShop() {
  shopView.innerHTML = SHOP_ITEMS.map(it =>
    '<div class="mini-jersey"><div class="mj-top" style="background:linear-gradient(135deg,' + it.c1 + ',' + it.c2 + ')">' + it.emoji + '</div>' +
    '<div class="mj-info"><span class="mj-name">' + it.name + '</span><span class="mj-price">₹' + it.price.toLocaleString('en-IN') + '</span>' +
    '<button class="mj-btn" data-name="' + it.name + '" data-price="' + it.price + '" data-emoji="' + it.emoji + '">Add to cart</button></div></div>').join('');
  shopView.querySelectorAll('.mj-btn').forEach(b => b.addEventListener('click', () => addCart(b.dataset.name, +b.dataset.price, b.dataset.emoji)));
}
renderShop();
document.querySelectorAll('.cart-tab').forEach(b => b.addEventListener('click', () => setDrawerTab(b.dataset.ctab)));
document.querySelectorAll('[data-open-shop]').forEach(el => el.addEventListener('click', e => {
  e.preventDefault();
  openDrawer('shop');
  navLinks.classList.remove('open'); burger.classList.remove('open'); burger.setAttribute('aria-expanded', 'false');
}));
renderCart();

/* ============================================================
   JOIN COMMUNITY FORM
   ============================================================ */
document.getElementById('joinForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.currentTarget, msg = document.getElementById('joinMsg');
  const name = f.jname.value.trim(), phone = f.jphone.value.trim(), email = f.jemail.value.trim();
  const city = f.jcity.value, level = f.jlevel.value;
  const sports = [...f.querySelectorAll('input[name=jsport]:checked')].map(i => i.value);
  const agree = f.querySelector('.jagree input').checked;
  if (!name) return jfail(msg, 'Please tell us your full name.');
  if (!/^\d{10}$/.test(phone)) return jfail(msg, 'Enter a valid 10-digit phone number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jfail(msg, 'Enter a valid email address.');
  if (!city) return jfail(msg, 'Select your city.');
  if (!level) return jfail(msg, 'Select your skill level.');
  if (!sports.length) return jfail(msg, 'Select at least one sport you play.');
  if (!agree) return jfail(msg, 'Please accept updates to join the community.');

  // Send data to your new backend
  fetch('https://matcharena-backend-1.onrender.com/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'join', name, phone, email, city, level, sports })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      msg.textContent = 'Welcome to the club, ' + name.split(' ')[0] + '! Your ' + sports.join(', ') + ' invites start this week in ' + city + '.';
      msg.className = 'join-msg ok';
      toast('🎉 You’re in the community — check WhatsApp for your first invite!');
      f.reset();
    } else {
      jfail(msg, 'Something went wrong. Please try again.');
    }
  })
  .catch(() => jfail(msg, 'Network error. Please check your connection.'));
});
function jfail(msg, text) { msg.textContent = text; msg.className = 'join-msg err'; }

document.querySelectorAll('.sport-register').forEach(btn => {
  btn.addEventListener('click', () => {
    const sport = btn.dataset.sport;
    document.querySelectorAll('#sportChips input').forEach(inp => inp.checked = inp.value === sport);
    document.getElementById('register').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { const n = document.querySelector('#regForm input[name=name]'); if (n) n.focus(); }, 600);
  });
});

/* register form */
document.getElementById('regForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.currentTarget, msg = document.getElementById('formMsg');
  const val = n => f.querySelector('[name=' + n + ']').value.trim();
  const name = val('name'), phone = val('phone'), email = val('email'), level = val('level'), area = val('area');
  const sportsPick = [...f.querySelectorAll('#sportChips input:checked')].map(i => i.value);
  const agree = f.querySelector('.agree input').checked;
  if (!name) return fail(msg, 'Please tell us your name.');
  if (!/^\d{10}$/.test(phone)) return fail(msg, 'Enter a valid 10-digit phone number.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(msg, 'Enter a valid email address.');
  if (!level) return fail(msg, 'Choose your playing level.');
  if (!area) return fail(msg, 'Pick the area of Lucknow closest to you.');
  if (!sportsPick.length) return fail(msg, 'Select at least one sport to play.');
  if (!agree) return fail(msg, 'Please accept the match invites to register.');

  // Send data to your new backend
  fetch('https://matcharena-backend-1.onrender.com/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'register', name, phone, email, area, level, sports: sportsPick })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      msg.textContent = 'You’re in the draft, ' + name.split(' ')[0] + '! Playing ' + sportsPick.join(', ') + ' in ' + area + '. Our team picks you up within 24 hours.';
      msg.className = 'form-msg ok';
      toast('🎽 Registration sent — you’re in the draft!');
      f.reset();
    } else {
      fail(msg, 'Something went wrong. Please try again.');
    }
  })
  .catch(() => fail(msg, 'Network error. Please check your connection.'));
});
function fail(msg, text) { msg.textContent = text; msg.className = 'form-msg err'; msg.scrollIntoView({ block: 'center', behavior: 'smooth' }); }

/* ============================================================
   3D ARENA MODALS
   ============================================================ */
const STAGE_MODELS = {};
document.querySelectorAll('.stage-modal').forEach(m => {
  const sport = m.dataset.modal;
  STAGE_MODELS[sport] = { m, scene: HAS3D ? stageRefs.find(st => st.sport === sport) : null };
});
let lastOpener = null;
function openStage(sport) {
  const rec = STAGE_MODELS[sport];
  if (!rec || !rec.scene) { toast('3D view needs the Three.js library to load (internet required).'); return; }
  lastOpener = document.activeElement;
  document.querySelectorAll('.stage-modal').forEach(mm => mm.classList.remove('open'));
  rec.m.classList.add('open');
  document.body.classList.add('modal-open');
  if (reduced) { rec.scene.resize(); rec.scene.renderer.render(rec.scene.scene, rec.scene.camera); }
  else requestAnimationFrame(() => rec.scene.resize());
  setTimeout(() => { const c = rec.m.querySelector('.stage-close'); if (c) c.focus(); }, 80);
}
function closeStage() {
  document.querySelectorAll('.stage-modal').forEach(m => m.classList.remove('open'));
  document.body.classList.remove('modal-open');
  if (lastOpener && document.contains(lastOpener) && lastOpener.focus) lastOpener.focus();
}
document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeStage));

if (!HAS3D) {
  document.querySelectorAll('.stage-modal, .open-stage, .arena-btn, #sportTabs, .hint-drag').forEach(el => el.remove());
}

})();
