// Local lane server. Phones on the venue Wi-Fi reach it directly to enter their
// names; the game reaches it through the Vite dev proxy at /api.
// Run with: node server/index.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import QRCode from 'qrcode';
import { ClaimStore } from './claims.ts';
import { expiredPage, namePage, successPage } from './phonePage.ts';

const PORT = Number(process.env.PICKLERANGE_PORT ?? 8787);
const MAX_BODY_BYTES = 4096;
const GAME_ID = /^[a-z0-9-]{1,32}$/;

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

  // Game API
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
});
