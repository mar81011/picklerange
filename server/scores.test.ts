import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScoreDb } from './scores.ts';

describe('ScoreDb', () => {
  let db: ScoreDb;

  beforeEach(() => {
    db = new ScoreDb(':memory:');
  });
  afterEach(() => db.close());

  it('stores scores with cleaned-up names', () => {
    const row = db.add('bullseye', '  joseph! ', 250, 3, 1000);
    expect(row).toMatchObject({ gameId: 'bullseye', name: 'JOSEPH', score: 250, level: 3 });
    expect(db.count()).toBe(1);
  });

  it('rejects bad input', () => {
    expect(db.add('../etc', 'ana', 10, null, 0)).toBeNull();
    expect(db.add('bullseye', '!!!', 10, null, 0)).toBeNull();
    expect(db.add('bullseye', 'ana', 0, null, 0)).toBeNull();
    expect(db.add('bullseye', 'ana', 1.5, null, 0)).toBeNull();
    expect(db.add('bullseye', 'ana', 99_999_999, null, 0)).toBeNull();
    expect(db.add('bullseye', 'ana', 10, 0, 0)).toBeNull();
    expect(db.count()).toBe(0);
  });

  it('ranks highest first and keeps the earlier score ahead on a tie', () => {
    db.add('bullseye', 'late', 100, null, 2000);
    db.add('bullseye', 'early', 100, null, 1000);
    db.add('bullseye', 'best', 300, null, 3000);
    db.add('popup', 'other', 999, null, 0);
    expect(db.top('bullseye', 10).map((r) => r.name)).toEqual(['BEST', 'EARLY', 'LATE']);
    expect(db.top('bullseye', 2)).toHaveLength(2);
  });

  it('limits a leaderboard to a time window', () => {
    db.add('bullseye', 'old', 500, null, 1000);
    db.add('bullseye', 'new', 100, null, 5000);
    expect(db.top('bullseye', 10, 2000).map((r) => r.name)).toEqual(['NEW']);
  });

  it('returns the top of every game', () => {
    db.add('bullseye', 'a', 1, null, 0);
    db.add('popup', 'b', 2, null, 0);
    expect(Object.keys(db.topAll(5)).sort()).toEqual(['bullseye', 'popup']);
  });

  it('lists recent scores and deletes by id', () => {
    const a = db.add('bullseye', 'a', 1, null, 1000)!;
    db.add('bullseye', 'b', 2, null, 2000);
    expect(db.recent(10).map((r) => r.name)).toEqual(['B', 'A']);
    expect(db.delete(a.id)).toBe(true);
    expect(db.delete(a.id)).toBe(false);
    expect(db.count()).toBe(1);
  });

  it('writes backups and keeps only the newest ones', () => {
    const dir = mkdtempSync(join(tmpdir(), 'picklerange-backup-'));
    try {
      db.add('bullseye', 'a', 1, null, 0);
      for (let day = 1; day <= 4; day++) db.backup(dir, new Date(Date.UTC(2026, 9, day)), 2);
      const files = readdirSync(dir).sort();
      expect(files).toHaveLength(2);
      expect(files[1]).toContain('2026-10-04');
      const copy = new ScoreDb(join(dir, files[1]));
      expect(copy.count()).toBe(1);
      copy.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
