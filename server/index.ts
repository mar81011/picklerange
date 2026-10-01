// Local lane server: the high-score database (SQLite file in data/), phone
// name entry, and the staff page. Phones and the staff page reach it directly
// on the venue network; the game reaches it through the Vite dev proxy at /api.
// Run with: node server/index.ts
import { randomInt, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import QRCode from 'qrcode';
import { ClaimStore } from './claims.ts';
import { expiredPage, namePage, successPage } from './phonePage.ts';
import { GAME_ID, ScoreDb } from './scores.ts';
import { staffPage } from './staffPage.ts';

const PORT = Number(process.env.PICKLERANGE_PORT ?? 8787);
const MAX_BODY_BYTES = 4096;
/** Where the database, backups and staff PIN live. */
const DATA_DIR = resolve(process.env.PICKLERANGE_DATA ?? 'data');
const DB_FILE = join(DATA_DIR, 'picklerange.db');
const BACKUP_DIR = join(DATA_DIR, 'backups');
const DAY_MS = 24 * 60 * 60 * 1000;

/** The address phones should use. Override with PICKLERANGE_HOST if the guess is wrong. */
function lanAddress(): string {
  if (process.env.PICKLERANGE_HOST) return process.env.PICKLERANGE_HOST;
  const candidates = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i !== undefined && i.family === 'IPv4' && !i.internal)
    .map((i) => i!.address);
  const isPrivate = (a: string) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a);
  return candidates.find(isPrivate) ?? candidates[0] ?? 'localhost';
}

const HOST = lanAddress();
const claims = new ClaimStore();
const scores = new ScoreDb(DB_FILE);

/**
 * Staff PIN: PICKLERANGE_STAFF_PIN if set, otherwise a random 6-digit PIN
 * created on first run and kept in data/staff-pin.txt.
 */
function staffPin(): string {
  if (process.env.PICKLERANGE_STAFF_PIN) return process.env.PICKLERANGE_STAFF_PIN;
  const file = join(DATA_DIR, 'staff-pin.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  const pin = String(randomInt(100000, 1000000));
  writeFileSync(file, `${pin}\n`);
  return pin;
}
const STAFF_PIN = staffPin();

function isStaff(req: IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers['x-staff-pin'] ?? ''));
  const expected = Buffer.from(STAFF_PIN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function backupNow(): string {
  const file = scores.backup(BACKUP_DIR, new Date());
  console.log(`Backup saved: ${file}`);
  return file;
}

/** Start of the leaderboard window for ?period=day|week (0 = all time). */
function periodStart(period: string | null, now: number): number {
  if (period === 'day') return new Date(new Date(now).toDateString()).getTime();
  if (period === 'week') return now - 7 * DAY_MS;
  return 0;
}

function send(res: ServerResponse, status: number, body: string, type: string): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
const json = (res: ServerResponse, status: number, body: unknown) => send(res, status, JSON.stringify(body), 'application/json');
const html = (res: ServerResponse, status: number, body: string) => send(res, status, body, 'text/html; charset=utf-8');

async function readBody(req: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function createClaim(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: { gameId?: unknown; score?: unknown };
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return json(res, 400, { error: 'invalid_json' });
  }
  const { gameId, score } = body;
  if (typeof gameId !== 'string' || !GAME_ID.test(gameId) || !Number.isInteger(score) || (score as number) < 0) {
    return json(res, 400, { error: 'invalid_claim' });
  }

  const claim = claims.create(gameId, score as number, Date.now());
  const url = `http://${HOST}:${PORT}/n/${claim.code}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 512, errorCorrectionLevel: 'M' });
  json(res, 201, { code: claim.code, url, qr });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);
  const now = Date.now();

  // High scores
  if (parts[0] === 'api' && parts[1] === 'scores' && parts.length === 2) {
    if (req.method === 'GET') {
      const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit')) || 10));
      return json(res, 200, scores.topAll(limit, periodStart(url.searchParams.get('period'), now)));
    }
    if (req.method === 'POST') {
      let body: { gameId?: unknown; name?: unknown; score?: unknown; level?: unknown; at?: unknown };
      try {
        body = JSON.parse(await readBody(req));
      } catch {
        return json(res, 400, { error: 'invalid_json' });
      }
      const row = scores.add(
        String(body.gameId ?? ''),
        String(body.name ?? ''),
        Number(body.score),
        body.level === undefined || body.level === null ? null : Number(body.level),
        // Trust the lane's clock only within a day of ours (offline scores sync later).
        typeof body.at === 'number' && Math.abs(body.at - now) < DAY_MS ? body.at : now,
      );
      return row ? json(res, 201, row) : json(res, 400, { error: 'invalid_score' });
    }
  }

  // Staff
  if (parts[0] === 'staff' && parts.length === 1 && req.method === 'GET') return html(res, 200, staffPage());
  if (parts[0] === 'api' && parts[1] === 'staff') {
    if (!isStaff(req)) {
      // A short pause makes guessing the PIN slow.
      await new Promise((r) => setTimeout(r, 400));
      return json(res, 401, { error: 'unauthorized' });
    }
    if (parts[2] === 'scores' && parts.length === 3 && req.method === 'GET') {
      const since = periodStart(url.searchParams.get('period'), now);
      return json(res, 200, { top: scores.topAll(10, since), recent: scores.recent(50), count: scores.count(), file: DB_FILE });
    }
    if (parts[2] === 'scores' && parts.length === 4 && req.method === 'DELETE') {
      return scores.delete(Number(parts[3])) ? (res.writeHead(204).end(), undefined) : json(res, 404, { error: 'not_found' });
    }
    if (parts[2] === 'backup' && req.method === 'POST') return json(res, 200, { file: backupNow() });
    return json(res, 404, { error: 'not_found' });
  }

  // Name claims
  if (parts[0] === 'api' && parts[1] === 'claims') {
    if (parts.length === 2 && req.method === 'POST') return createClaim(req, res);
    if (parts.length === 3) {
      const claim = claims.get(parts[2]);
      if (req.method === 'DELETE') {
        claims.cancel(parts[2]);
        res.writeHead(204).end();
        return;
      }
      if (req.method === 'GET') {
        if (!claim) return json(res, 404, { error: 'not_found' });
        return json(res, 200, { name: claim.name, expired: claims.isExpired(claim, now) });
      }
    }
    return json(res, 404, { error: 'not_found' });
  }

  // Phone pages
  if (parts[0] === 'n' && parts.length === 2) {
    const claim = claims.get(parts[1]);
    if (!claim || claims.isExpired(claim, now)) return html(res, 410, expiredPage());

    if (req.method === 'GET') {
      if (claim.name) return html(res, 200, successPage(claim.name));
      return html(res, 200, namePage(claim.code, claim.gameId, claim.score));
    }
    if (req.method === 'POST') {
      let name = '';
      try {
        name = new URLSearchParams(await readBody(req)).get('name') ?? '';
      } catch {
        return html(res, 413, namePage(claim.code, claim.gameId, claim.score, 'That name is too long.'));
      }
      const result = claims.submit(claim.code, name, now);
      if (result.ok) return html(res, 200, successPage(result.claim.name!));
      if (result.error === 'already_named') return html(res, 200, successPage(claim.name!));
      if (result.error === 'invalid_name') {
        return html(res, 400, namePage(claim.code, claim.gameId, claim.score, 'Use letters and numbers only.'));
      }
      return html(res, 410, expiredPage());
    }
  }

  send(res, 404, 'Not found', 'text/plain');
}

createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    console.error(err);
    if (!res.headersSent) send(res, 500, 'Server error', 'text/plain');
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`PickleRange lane server on port ${PORT}`);
  console.log(`Phones will open: http://${HOST}:${PORT}/n/<code>`);
  console.log(`Scores database: ${DB_FILE} (${scores.count()} scores)`);
  console.log(`Staff page: http://${HOST}:${PORT}/staff  (PIN: ${STAFF_PIN})`);
});

// Back up at startup and then once a day; the newest 14 backups are kept.
backupNow();
setInterval(backupNow, DAY_MS);
