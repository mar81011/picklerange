// Score cards: at the end of a run the game shows a QR code that opens a
// picture of the player's score on their phone, to save and share. Cards live
// in memory for a few hours; that's long enough to save the picture.
import { sanitizeName } from '../src/leaderboard/names.ts';
import { newCode } from './claims.ts';

export interface Card {
  code: string;
  gameId: string;
  score: number;
  level: number | null;
  /** One line under the score, e.g. "Reached level 3 of 5". */
  stats: string;
  highScore: boolean;
  name: string | null;
  at: number;
  expiresAt: number;
}

export type CardInput = Pick<Card, 'gameId' | 'score' | 'level' | 'stats' | 'highScore'>;

export interface CardStoreOptions {
  ttlMs?: number;
  /** Oldest cards are dropped beyond this many. */
  max?: number;
  random?: () => number;
}

const MAX_STATS_LENGTH = 60;

export class CardStore {
  #cards = new Map<string, Card>();
  #ttlMs: number;
  #max: number;
  #random: () => number;

  constructor(options: CardStoreOptions = {}) {
    this.#ttlMs = options.ttlMs ?? 6 * 60 * 60_000;
    this.#max = options.max ?? 500;
    this.#random = options.random ?? Math.random;
  }

  create(input: CardInput, now: number): Card {
    this.#prune(now);
    const code = newCode(this.#random, (c) => this.#cards.has(c));
    const stats = input.stats.replace(/[^\p{L}\p{N} .,!:•/–-]/gu, '').slice(0, MAX_STATS_LENGTH);
    const card: Card = { ...input, stats, code, name: null, at: now, expiresAt: now + this.#ttlMs };
    this.#cards.set(code, card);
    return card;
  }

  /** The card, or undefined if it is unknown or has expired. */
  get(code: string, now: number): Card | undefined {
    const card = this.#cards.get(code.toUpperCase());
    return card && now < card.expiresAt ? card : undefined;
  }

  setName(code: string, rawName: string): void {
    const card = this.#cards.get(code.toUpperCase());
    const name = sanitizeName(rawName);
    if (card && name !== null) card.name = name;
  }

  #prune(now: number): void {
    for (const [code, card] of this.#cards) {
      if (now >= card.expiresAt) this.#cards.delete(code);
    }
    // Maps keep insertion order, so the first keys are the oldest cards.
    for (const code of [...this.#cards.keys()].slice(0, Math.max(0, this.#cards.size - this.#max + 1))) {
      this.#cards.delete(code);
    }
  }
}
