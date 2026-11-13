// Dev tool: renders every level's dragon (front, three-quarter and side views)
// on a plain background and saves .shots/dragons.png. Needs `npm run dev`.
//   node tools/dragonpreview.mjs [flapPhase]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9342;
const W = 1500;
const H = 1500;
const PHASE = Number(process.argv[2] ?? 0);
const ONLY = process.argv[3] === undefined ? null : Number(process.argv[3]);
mkdirSync('.shots', { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${join(tmpdir(), 'picklerange-dragon')}`, 'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t;
for (let i = 0; i < 40 && !t; i++) { await sleep(500); t = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => undefined); }
const ws = new WebSocket(t.find((x) => x.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const msg = JSON.parse(m.data); if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/' });
await sleep(6000);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
  const THREE = await import('/node_modules/.vite/deps/three.js');
  const { DragonRig } = await import('/src/engine/dragonRig.ts');
  const { DRAGON_LEVELS } = await import('/src/games/dragon/levels.ts');
  const { helmetMesh } = await import('/src/screens/dragon.ts');
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(${W}, ${H});
  renderer.setScissorTest(true);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const views = ${ONLY === null ? "[[0, 1.2, 6], [3.6, 1.6, 4.6], [6, 1.0, 0]]" : "[[0, 2.2, 5.5], [3.6, 1.6, 4.6]]"};
  const cell = ${W} / views.length;
  const rows = ${ONLY === null ? 5 : 1};
  const rh = ${H} / rows;
  const LEVELS = ${ONLY === null ? "DRAGON_LEVELS" : `[DRAGON_LEVELS[${ONLY}]]`};
  LEVELS.forEach((lvl, row) => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x40485a);
    scene.add(new THREE.HemisphereLight(0xffe0c0, 0x302020, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 4, 5); scene.add(sun);
    const rim = new THREE.DirectionalLight(0xff8040, 1.5); rim.position.set(-3, 2, -4); scene.add(rim);
    const rig = new DragonRig(lvl.look, 2.4, renderer);
    rig.mode = 'hover';
    if (lvl.options.armor) rig.wear(helmetMesh());
    scene.add(rig.root);
    // Advance to the requested flap phase.
    rig.update(${PHASE} + 0.001, new THREE.Vector3(0, 1.2, 6));
    views.forEach((v, col) => {
      const cam = new THREE.PerspectiveCamera(35, cell / rh, 0.1, 50);
      cam.position.set(...v); cam.lookAt(0, 1.1, 0);
      renderer.setViewport(col * cell, (rows - 1 - row) * rh, cell, rh);
      renderer.setScissor(col * cell, (rows - 1 - row) * rh, cell, rh);
      renderer.render(scene, cam);
    });
  });
  return 'ok';
})()` });
console.log(JSON.stringify(r).slice(0, 400));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(`.shots/dragons${ONLY === null ? "" : "-L" + ONLY}${PHASE ? "-" + PHASE : ""}.png`, Buffer.from(data, 'base64'));
ws.close();
edge.kill();
process.exit(0);
