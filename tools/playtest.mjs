// Dev tool: plays games in headless Edge and saves screenshots to .shots/.
// Needs `npm run dev` running. Usage:
//   node tools/playtest.mjs menu                 screenshot the menu
//   node tools/playtest.mjs <game>[:level][:seconds] ...   play games
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const OUT = resolve('.shots');
const RUNS = process.argv.slice(2);
const W = 1600;
const H = 900;
const PORT = 9340;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
mkdirSync(OUT, { recursive: true });

const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${W},${H}`,
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--user-data-dir=${join(tmpdir(), 'picklerange-playtest')}`, 'about:blank',
]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40 && !targets; i++) {
  await sleep(500);
  targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => undefined);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.value;
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
};
const click = async (p) => {
  for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: p.x * W, y: p.y * H, button: 'left', clickCount: 1 });
};
const aim = (key) => evaluate(`window.__aim(${key ? JSON.stringify(key) : ''})`);
const ended = () => evaluate(`!!document.querySelector('.qr, .board-rows, .name-box, .party-end')`);
const PACE = { bullseye: 1100, popup: 650, opencourt: 2300, bricks: 1100, zombies: 800, gallery: 800, rally: 1100, tictactoe: 1700, memory: 1500, darts: 1400 };

async function openMenu(level = 1) {
  await send('Page.navigate', { url: `http://localhost:5173/?level=${level}` });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (await evaluate(`typeof window.__aim === 'function' && !!window.__aim('bullseye')`)) break;
  }
  await sleep(1500);
}

for (const spec of RUNS) {
  const [game, startLevel = '1', maxSec = '30'] = spec.split(':');
  await openMenu(startLevel);
  if (game === 'menu') {
    await shot('menu');
    continue;
  }
  await click(await aim(game));
  await sleep(2500);
  await shot(`${game}-0-card`);
  await sleep(2600);
  await shot(`${game}-1-start`);
  const start = Date.now();
  let n = 0;
  let lastShot = 0;
  while (Date.now() - start < Number(maxSec) * 1000) {
    if (await ended()) break;
    const target = await aim();
    if (target) {
      await click(target);
      n++;
    }
    await sleep(350);
    if (Date.now() - lastShot > 9000 && target) {
      await shot(`${game}-play-${String(Math.round((Date.now() - start) / 1000)).padStart(3, '0')}s`);
      lastShot = Date.now();
    }
    await sleep((PACE[game] ?? 1000) - 350);
  }
  console.log(`${game} from level ${startLevel}: ${n} hits in ${Math.round((Date.now() - start) / 1000)}s`);
}
console.log('errors:', errors.length ? [...new Set(errors)].slice(0, 15) : 'none');
ws.close();
edge.kill();
process.exit(0);
