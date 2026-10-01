// Staff page served by the lane server at /staff: enter the PIN, then view and
// delete scores and make a backup. Plain HTML plus a little script; the PIN is
// sent with each request and kept only for this browser tab.

const GAME_TITLES: Record<string, string> = {
  bullseye: 'Bullseye',
  popup: 'Pop-Up',
  opencourt: 'Open Court',
  bricks: 'Brick Breaker',
  zombies: 'Zombie Court',
  gallery: 'Firing Range',
  rally: 'Rally Survival',
};

export function staffPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PickleRange Staff</title>
<style>
  :root { color-scheme: dark; --neon: #d4f53c; --muted: #9fb0cf; --line: rgba(255,255,255,.1); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 24px 16px 60px; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: #0b1220; color: #fff; }
  main { max-width: 1100px; margin: 0 auto; }
  h1 { margin: 0 0 4px; font-size: 26px; letter-spacing: .04em; }
  h1 span { color: var(--neon); }
  h2 { font-size: 16px; text-transform: uppercase; letter-spacing: .12em; color: var(--muted); margin: 28px 0 10px; }
  .bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 16px 0; }
  input, select, button { font: inherit; border-radius: 10px; border: 1px solid var(--line); background: #131c33; color: #fff; padding: 10px 14px; }
  button { cursor: pointer; font-weight: 700; }
  button.primary { background: var(--neon); color: #0b1220; border: 0; }
  button.danger { color: #ff8a8a; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }
  .card { background: #111a2e; border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
  .card h3 { margin: 0 0 8px; font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td, th { padding: 6px 6px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
  th { color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: var(--muted); }
  #msg { min-height: 22px; color: var(--neon); }
  .hidden { display: none; }
</style>
</head>
<body><main>
  <h1>PICKLERANGE <span>STAFF</span></h1>
  <div class="muted" id="sub">Scores database on this lane PC</div>

  <form id="login" class="bar">
    <input id="pin" type="password" inputmode="numeric" placeholder="Staff PIN" autocomplete="off" required>
    <button class="primary">Unlock</button>
  </form>

  <section id="app" class="hidden">
    <div class="bar">
      <label class="muted">Leaderboards for
        <select id="period">
          <option value="all">All time</option>
          <option value="week">This week</option>
          <option value="day">Today</option>
        </select>
      </label>
      <button id="refresh">Refresh</button>
      <button id="backup">Back up now</button>
      <button id="lock" class="danger">Lock</button>
    </div>
    <div id="msg"></div>
    <h2>Leaderboards</h2>
    <div class="grid" id="boards"></div>
    <h2>Latest scores</h2>
    <div class="card"><table><thead><tr><th>When</th><th>Game</th><th>Name</th><th class="num">Score</th><th>Level</th><th></th></tr></thead><tbody id="recent"></tbody></table></div>
  </section>
</main>
<script>
const TITLES = ${JSON.stringify(GAME_TITLES)};
const $ = (id) => document.getElementById(id);
let pin = sessionStorage.getItem('staffPin') || '';

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { 'x-staff-pin': pin, 'content-type': 'application/json' } });
  if (res.status === 401) { lock('Wrong PIN'); throw new Error('unauthorized'); }
  if (!res.ok) throw new Error('Request failed (' + res.status + ')');
  return res.status === 204 ? null : res.json();
}

function lock(message) {
  pin = '';
  sessionStorage.removeItem('staffPin');
  $('app').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('sub').textContent = message || 'Scores database on this lane PC';
}

function cell(tr, text, cls) {
  const td = document.createElement('td');
  td.textContent = text;
  if (cls) td.className = cls;
  tr.appendChild(td);
  return td;
}

function deleteButton(row) {
  const b = document.createElement('button');
  b.className = 'danger';
  b.textContent = 'Delete';
  b.onclick = async () => {
    if (!confirm('Delete ' + row.name + ' — ' + row.score + ' (' + (TITLES[row.gameId] || row.gameId) + ')?')) return;
    await api('/api/staff/scores/' + row.id, { method: 'DELETE' });
    $('msg').textContent = 'Deleted. The lane updates when the next game starts.';
    load();
  };
  return b;
}

async function load() {
  const data = await api('/api/staff/scores?period=' + $('period').value);
  $('sub').textContent = data.count + ' scores saved • database: ' + data.file;
  const boards = $('boards');
  boards.replaceChildren();
  for (const [gameId, title] of Object.entries(TITLES)) {
    const card = document.createElement('div');
    card.className = 'card';
    const h = document.createElement('h3');
    h.textContent = title;
    card.appendChild(h);
    const rows = data.top[gameId] || [];
    if (!rows.length) {
      const p = document.createElement('div');
      p.className = 'muted';
      p.textContent = 'No scores yet';
      card.appendChild(p);
    } else {
      const table = document.createElement('table');
      rows.forEach((r, i) => {
        const tr = document.createElement('tr');
        cell(tr, String(i + 1), 'muted');
        cell(tr, r.name);
        cell(tr, String(r.score), 'num');
        cell(tr, r.level ? 'LV ' + r.level : '', 'muted');
        cell(tr, '').appendChild(deleteButton(r));
        table.appendChild(tr);
      });
      card.appendChild(table);
    }
    boards.appendChild(card);
  }
  const recent = $('recent');
  recent.replaceChildren();
  for (const r of data.recent) {
    const tr = document.createElement('tr');
    cell(tr, new Date(r.at).toLocaleString(), 'muted');
    cell(tr, TITLES[r.gameId] || r.gameId);
    cell(tr, r.name);
    cell(tr, String(r.score), 'num');
    cell(tr, r.level ? 'LV ' + r.level : '', 'muted');
    cell(tr, '').appendChild(deleteButton(r));
    recent.appendChild(tr);
  }
}

$('login').onsubmit = async (e) => {
  e.preventDefault();
  pin = $('pin').value;
  try {
    await load();
    sessionStorage.setItem('staffPin', pin);
    $('login').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('pin').value = '';
  } catch {}
};
$('refresh').onclick = load;
$('period').onchange = load;
$('lock').onclick = () => lock();
$('backup').onclick = async () => {
  const r = await api('/api/staff/backup', { method: 'POST' });
  $('msg').textContent = 'Backup saved: ' + r.file;
};
if (pin) $('login').requestSubmit ? (($('pin').value = pin), $('login').requestSubmit()) : null;
</script>
</body>
</html>`;
}
