// Dev tool: renders a lineup of Zombie Court zombies (walkers, a brute, the
// boss) mid-walk and saves .shots/zombies-lineup.png. Needs `npm run dev`.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9343;
const W = 1600;
const H = 800;
mkdirSync('.shots', { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${join(tmpdir(), 'picklerange-zombies')}`, 'about:blank',
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
  const { Character, loadModel } = await import('/src/engine/character.ts');
  const { zombieLook } = await import('/src/engine/zombieLooks.ts');
  const { ZOMBIE_HEIGHT, sizeOf } = await import('/src/games/zombies/logic.ts');
  const gltf = await loadModel('/models/zombie.glb');
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(${W}, ${H});
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1c2a24);
  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x203020, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 5, 6); scene.add(sun);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const kinds = ['walker', 'walker', 'walker', 'brute', 'boss', 'walker', 'walker', 'walker', 'brute'];
  kinds.forEach((kind, i) => {
    const look = zombieLook(gltf, kind, rand);
    const size = sizeOf(kind) * look.height;
    const a = new Character(gltf, { heightM: ZOMBIE_HEIGHT * size, map: look.map, girth: look.girth });
    if (look.hat) { const h = look.hat(); h.scale.multiplyScalar(size); a.wearOnHead(h, look.sink * size); }
    a.root.position.set((i - (kinds.length - 1) / 2) * 1.25, 0, kind === 'boss' ? -1.2 : 0);
    scene.add(a.root);
    a.play('Walk', { offset: rand() });
    a.update(0.01);
  });
  const cam = new THREE.PerspectiveCamera(38, ${W} / ${H}, 0.1, 100);
  cam.position.set(0, 2.6, 9.5); cam.lookAt(0, 1.2, 0);
  renderer.render(scene, cam);
  return 'ok';
})()` });
console.log(JSON.stringify(r).slice(0, 600));
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.shots/zombies-lineup.png', Buffer.from(data, 'base64'));
ws.close();
edge.kill();
process.exit(0);
