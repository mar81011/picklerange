// Client for the lane server's name claims (see server/claims.ts).
// Every call fails soft: null/void when the server is unreachable, so the game
// can fall back to keyboard entry instead of losing the score.

export interface NameClaim {
  code: string;
  /** What the QR encodes; also shown as text under it. */
  url: string;
  /** QR image as a data URL. */
  qr: string;
}

export interface ClaimStatus {
  name: string | null;
  expired: boolean;
}

const TIMEOUT_MS = 4000;

export async function openNameClaim(gameId: string, score: number): Promise<NameClaim | null> {
  try {
    const res = await fetch('/api/claims', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId, score }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok ? ((await res.json()) as NameClaim) : null;
  } catch {
    return null;
  }
}

/** Null on a network error (keep polling); expired when the server no longer knows the code. */
export async function checkNameClaim(code: string): Promise<ClaimStatus | null> {
  try {
    const res = await fetch(`/api/claims/${encodeURIComponent(code)}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return { name: null, expired: true };
    return res.ok ? ((await res.json()) as ClaimStatus) : null;
  } catch {
    return null;
  }
}

export function cancelNameClaim(code: string): void {
  fetch(`/api/claims/${encodeURIComponent(code)}`, { method: 'DELETE' }).catch(() => undefined);
}
