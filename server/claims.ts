// Name claims: when a player sets a high score, the game opens a claim and shows
// its code as a QR. The player's phone submits a name against the code, and the
// game polls until the name arrives. Written in plain erasable TypeScript so
// Node can run it directly.
import { sanitizeName } from '../src/leaderboard/names.ts';

/** No 0/O, 1/I/L, so codes are easy to read off the wall if typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

export interface Claim {
  code: string;
  gameId: string;
  score: number;
  expiresAt: number;
  name: string | null;
}

export type SubmitResult =
  | { ok: true; claim: Claim }
  | { ok: false; error: 'not_found' | 'expired' | 'already_named' | 'invalid_name' };

export interface ClaimStoreOptions {
  ttlMs?: number;
  /** Returns a number in [0, 1). Injected so tests are deterministic. */
  random?: () => number;
}

export class ClaimStore {
  #claims = new Map<string, Claim>();
  #ttlMs: number;
  #random: () => number;

  constructor(options: ClaimStoreOptions = {}) {
    this.#ttlMs = options.ttlMs ?? 3 * 60_000;
    this.#random = options.random ?? Math.random;
  }

  create(gameId: string, score: number, now: number): Claim {
    this.#prune(now);
    let code: string;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[Math.floor(this.#random() * CODE_ALPHABET.length)]).join('');
    } while (this.#claims.has(code));

    const claim: Claim = { code, gameId, score, expiresAt: now + this.#ttlMs, name: null };
    this.#claims.set(code, claim);
    return claim;
  }

  /** Looks up a claim, including expired ones that have not been pruned yet. */
  get(code: string): Claim | undefined {
    return this.#claims.get(code.toUpperCase());
  }

  isExpired(claim: Claim, now: number): boolean {
    return now >= claim.expiresAt;
  }

  submit(code: string, rawName: string, now: number): SubmitResult {
    const claim = this.get(code);
    if (!claim) return { ok: false, error: 'not_found' };
    if (this.isExpired(claim, now)) return { ok: false, error: 'expired' };
    if (claim.name !== null) return { ok: false, error: 'already_named' };
    const name = sanitizeName(rawName);
    if (name === null) return { ok: false, error: 'invalid_name' };
    claim.name = name;
    return { ok: true, claim };
  }

  /** Called by the game when it stops waiting, so a late phone gets a clear "expired" message. */
  cancel(code: string): void {
    this.#claims.delete(code.toUpperCase());
  }

  #prune(now: number): void {
    for (const [code, claim] of this.#claims) {
      if (this.isExpired(claim, now)) this.#claims.delete(code);
    }
  }
}
