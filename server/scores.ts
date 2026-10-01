// High scores in a SQLite file on the lane PC (Node's built-in node:sqlite, so
// there is nothing to install and no service to pay for). Every score is kept;
// leaderboards are queries over them.
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { sanitizeName } from '../src/leaderboard/names.ts';

export interface ScoreRow {
  id: number;
  gameId: string;
  name: string;
  score: number;
  level: number | null;
  at: number;
}

export const GAME_ID = /^[a-z0-9-]{1,32}$/;
const MAX_SCORE = 10_000_000;

export class ScoreDb {
  #db: DatabaseSync;

  /** path is a file path, or ':memory:' for tests. */
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.#db = new DatabaseSync(path);
    this.#db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        level INTEGER,
        at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS scores_by_game ON scores (game_id, score DESC, at ASC);
    `);
  }

  /** Adds a score. Returns the new row, or null if the input is not valid. */
  add(gameId: string, rawName: string, score: number, level: number | null, at: number): ScoreRow | null {
    const name = sanitizeName(rawName);
    if (!GAME_ID.test(gameId) || name === null) return null;
    if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) return null;
    if (level !== null && (!Number.isInteger(level) || level < 1 || level > 99)) return null;
    if (!Number.isFinite(at)) return null;
    const result = this.#db
      .prepare('INSERT INTO scores (game_id, name, score, level, at) VALUES (?, ?, ?, ?, ?)')
      .run(gameId, name, score, level, Math.round(at));
    return { id: Number(result.lastInsertRowid), gameId, name, score, level, at: Math.round(at) };
  }

  /** Best scores for one game, highest first (earlier score wins a tie). since limits to a time window. */
  top(gameId: string, limit: number, since = 0): ScoreRow[] {
    return this.#rows(
      this.#db
        .prepare('SELECT * FROM scores WHERE game_id = ? AND at >= ? ORDER BY score DESC, at ASC LIMIT ?')
        .all(gameId, since, limit),
    );
  }

  /** The top `limit` of every game that has scores. */
  topAll(limit: number, since = 0): Record<string, ScoreRow[]> {
    const games = this.#db.prepare('SELECT DISTINCT game_id FROM scores').all() as { game_id: string }[];
    return Object.fromEntries(games.map(({ game_id }) => [game_id, this.top(game_id, limit, since)]));
  }

  /** Most recent scores across all games, for the staff page. */
  recent(limit: number): ScoreRow[] {
    return this.#rows(this.#db.prepare('SELECT * FROM scores ORDER BY at DESC, id DESC LIMIT ?').all(limit));
  }

  delete(id: number): boolean {
    return this.#db.prepare('DELETE FROM scores WHERE id = ?').run(id).changes > 0;
  }

  count(): number {
    return Number((this.#db.prepare('SELECT COUNT(*) AS n FROM scores').get() as { n: number }).n);
  }

  /**
   * Writes a consistent copy of the database to dir (safe while the game is
   * running) and keeps only the newest `keep` backups. Returns the file path.
   */
  backup(dir: string, now: Date, keep = 14): string {
    mkdirSync(dir, { recursive: true });
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const file = join(dir, `picklerange-${stamp}.db`);
    this.#db.prepare('VACUUM INTO ?').run(file);
    const old = readdirSync(dir)
      .filter((f) => /^picklerange-.*\.db$/.test(f))
      .sort()
      .reverse()
      .slice(keep);
    for (const f of old) rmSync(join(dir, f));
    return file;
  }

  close(): void {
    this.#db.close();
  }

  #rows(rows: unknown[]): ScoreRow[] {
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: Number(r.id),
      gameId: String(r.game_id),
      name: String(r.name),
      score: Number(r.score),
      level: r.level === null ? null : Number(r.level),
      at: Number(r.at),
    }));
  }
}
