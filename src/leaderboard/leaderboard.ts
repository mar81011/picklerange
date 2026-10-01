// High-score tables, one per game. Storage is behind an interface so the
// browser store can later be swapped for a local server or cloud sync.
import { sanitizeName } from './names';

export interface LeaderboardEntry {
  name: string;
  score: number;
  /** Epoch milliseconds. */
  at: number;
  /** Highest level reached, for games with levels. */
  level?: number;
}

export interface LeaderboardStore {
  load(gameId: string): LeaderboardEntry[];
  save(gameId: string, entries: LeaderboardEntry[]): void;
  /** Told about each new score, e.g. to send it to the lane server's database. */
  added?(gameId: string, entry: LeaderboardEntry): void;
}

/** Higher score first; on ties the earlier score keeps the higher rank. */
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || a.at - b.at;
}

export class Leaderboard {
  constructor(
    private readonly store: LeaderboardStore,
    private readonly maxEntries = 10,
  ) {}

  top(gameId: string, limit = this.maxEntries): LeaderboardEntry[] {
    return [...this.store.load(gameId)].sort(compareEntries).slice(0, limit);
  }

  /** True if this score would make the table. A score must beat (not tie) the last entry of a full table. */
  qualifies(gameId: string, score: number): boolean {
    if (score <= 0) return false;
    const entries = this.top(gameId);
    return entries.length < this.maxEntries || score > entries[entries.length - 1].score;
  }

  /** Adds the score and returns its 1-based rank, or null if it did not qualify or the name was invalid. */
  submit(gameId: string, rawName: string, score: number, at: number, level?: number): number | null {
    const name = sanitizeName(rawName);
    if (name === null || !this.qualifies(gameId, score)) return null;

    const entry: LeaderboardEntry = level === undefined ? { name, score, at } : { name, score, at, level };
    const entries = [...this.top(gameId), entry].sort(compareEntries).slice(0, this.maxEntries);
    this.store.save(gameId, entries);
    this.store.added?.(gameId, entry);
    return entries.indexOf(entry) + 1;
  }
}

export class MemoryStore implements LeaderboardStore {
  private data = new Map<string, LeaderboardEntry[]>();

  load(gameId: string): LeaderboardEntry[] {
    return [...(this.data.get(gameId) ?? [])];
  }

  save(gameId: string, entries: LeaderboardEntry[]): void {
    this.data.set(gameId, [...entries]);
  }
}

/** Parses a stored entry, accepting the earlier `initials` field name. */
function toEntry(value: unknown): LeaderboardEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const name = typeof v.name === 'string' ? v.name : v.initials;
  if (typeof name !== 'string' || typeof v.score !== 'number' || typeof v.at !== 'number') return null;
  const entry: LeaderboardEntry = { name, score: v.score, at: v.at };
  if (typeof v.level === 'number') entry.level = v.level;
  return entry;
}

/**
 * Browser storage for the single-lane v1. Scores live only on this PC and are
 * lost if the browser data is cleared, so move to a server store before scores matter.
 */
export class LocalStorageStore implements LeaderboardStore {
  constructor(private readonly prefix = 'picklerange.leaderboard.') {}

  load(gameId: string): LeaderboardEntry[] {
    try {
      const raw = localStorage.getItem(this.prefix + gameId);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(toEntry).filter((e): e is LeaderboardEntry => e !== null) : [];
    } catch {
      return [];
    }
  }

  save(gameId: string, entries: LeaderboardEntry[]): void {
    try {
      localStorage.setItem(this.prefix + gameId, JSON.stringify(entries));
    } catch {
      // Storage full or blocked: the game keeps working, the score just isn't persisted.
    }
  }
}
