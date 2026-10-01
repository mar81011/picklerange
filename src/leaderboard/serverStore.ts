// Leaderboard store backed by the lane server's SQLite database, with a copy
// in browser storage so the game keeps working when the server can't be
// reached (lane PC offline, or the online demo on Vercel, which has no
// server). Scores made while offline are queued and sent on the next refresh.
import type { LeaderboardEntry, LeaderboardStore } from './leaderboard';

export interface PendingScore {
  gameId: string;
  entry: LeaderboardEntry;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** Most offline scores kept in the queue (oldest dropped first). */
const MAX_PENDING = 200;
const TIMEOUT_MS = 3000;

export class ServerStore implements LeaderboardStore {
  private cache = new Map<string, LeaderboardEntry[]>();
  private pending: PendingScore[] = [];
  private refreshing: Promise<void> | null = null;
  /** The send in progress, so two callers never post the same queued score twice. */
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly local: LeaderboardStore,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null,
    private readonly fetcher: Fetch = (input, init) => fetch(input, init),
    private readonly base = '/api',
  ) {
    try {
      const raw = storage?.getItem(PENDING_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) this.pending = parsed as PendingScore[];
    } catch {
      this.pending = [];
    }
  }

  /** True once a refresh has reached the server. */
  online = false;

  load(gameId: string): LeaderboardEntry[] {
    return [...(this.cache.get(gameId) ?? this.local.load(gameId))];
  }

  save(gameId: string, entries: LeaderboardEntry[]): void {
    this.cache.set(gameId, [...entries]);
    this.local.save(gameId, entries);
  }

  added(gameId: string, entry: LeaderboardEntry): void {
    this.pending.push({ gameId, entry });
    if (this.pending.length > MAX_PENDING) this.pending.splice(0, this.pending.length - MAX_PENDING);
    this.persistPending();
    void this.flush();
  }

  /** Sends queued scores, then reloads every leaderboard from the server. Never throws. */
  refresh(): Promise<void> {
    this.refreshing ??= (async () => {
      try {
        await this.flush();
        const res = await this.fetcher(`${this.base}/scores?limit=10`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (!res.ok) throw new Error(String(res.status));
        const tables = (await res.json()) as Record<string, { name: string; score: number; at: number; level: number | null }[]>;
        this.online = true;
        const games = new Set([...this.cache.keys(), ...Object.keys(tables)]);
        for (const gameId of games) {
          const rows = (tables[gameId] ?? []).map((r) => {
            const entry: LeaderboardEntry = { name: r.name, score: r.score, at: r.at };
            if (r.level !== null) entry.level = r.level;
            return entry;
          });
          // Scores still waiting to be sent stay visible.
          const waiting = this.pending.filter((p) => p.gameId === gameId).map((p) => p.entry);
          this.save(gameId, [...rows, ...waiting].sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 10));
        }
      } catch {
        this.online = false;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Posts queued scores in order; stops at the first failure and keeps the rest. */
  private flush(): Promise<void> {
    this.flushing ??= this.sendQueued().finally(() => (this.flushing = null));
    return this.flushing;
  }

  private async sendQueued(): Promise<void> {
    while (this.pending.length) {
      const { gameId, entry } = this.pending[0];
      try {
        const res = await this.fetcher(`${this.base}/scores`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ gameId, name: entry.name, score: entry.score, level: entry.level ?? null, at: entry.at }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        // 400 means the server will never accept it (bad data): drop it rather than retry forever.
        if (!res.ok && res.status !== 400) return;
      } catch {
        return;
      }
      this.pending.shift();
      this.persistPending();
    }
  }

  private persistPending(): void {
    try {
      this.storage?.setItem(PENDING_KEY, JSON.stringify(this.pending));
    } catch {
      // Not persisted; the queue still lives in memory.
    }
  }
}

const PENDING_KEY = 'picklerange.pendingScores';
