// Client for the lane server's score cards (see server/cards.ts) and the staff
// page link. Fails soft: null when the server is unreachable (e.g. the online
// demo), and the game simply shows no QR.
import type { RoundResult } from '../games';

export interface QrLink {
  url: string;
  /** QR image as a data URL. */
  qr: string;
}

export interface ScoreCard extends QrLink {
  code: string;
}

const TIMEOUT_MS = 4000;

export async function openScoreCard(result: RoundResult, highScore: boolean): Promise<ScoreCard | null> {
  try {
    const res = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId: result.gameId, score: result.score, level: result.level, stats: result.stats, highScore }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as ScoreCard) : null;
  } catch {
    return null;
  }
}

export async function staffLink(): Promise<QrLink | null> {
  try {
    const res = await fetch('/api/staff-link', { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? ((await res.json()) as QrLink) : null;
  } catch {
    return null;
  }
}
