// Dev tool: renders an enlarged pickleball in front of the camera and saves .shots/ball.png.
// Needs `npm run dev`.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9341;
mkdirSync('.shots', { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1600,900',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${join(tmpdir(), 'picklerange-ball')}`, 'about:blank',
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
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: 'http://localhost:5173/' });
await sleep(7000);
const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
  const { makeBall } = await import('/src/engine/effects.ts');
  const app = window.__app;
  app.play('bullseye');
  await new Promise((r) => setTimeout(r, 1500));
  const cam = app.stage.camera;
  const dir = cam.getWorldDirection(cam.position.clone());
  for (const [i, dx] of [[0, -1], [1, 0], [2, 1]]) {
    const ball = makeBall();
    ball.scale.setScalar(14);
    ball.position.copy(cam.position).addScaledVector(dir, 12);
    ball.position.x += dx * 2.2;
    ball.rotation.set(i * 0.9, i * 1.7, 0);
    app.stage.scene.add(ball);
  }
  document.querySelector('.overlay').style.display = 'none';
  return 'ok';
})()` });
console.log(r.result?.value ?? JSON.stringify(r).slice(0, 300));
await sleep(1500);
const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('.shots/ball.png', Buffer.from(data, 'base64'));
ws.close();
edge.kill();
process.exit(0);
