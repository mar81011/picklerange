import { beforeEach, describe, expect, it } from 'vitest';
import { Leaderboard, MemoryStore } from './leaderboard';

describe('Leaderboard', () => {
  let board: Leaderboard;

  beforeEach(() => {
    board = new Leaderboard(new MemoryStore(), 3);
  });

  it('ranks by score, highest first', () => {
    board.submit('bullseye', 'AAA', 100, 1);
    board.submit('bullseye', 'BBB', 300, 2);
    board.submit('bullseye', 'CCC', 200, 3);
    expect(board.top('bullseye').map((e) => e.name)).toEqual(['BBB', 'CCC', 'AAA']);
  });

  it('returns the rank of a new score', () => {
    board.submit('bullseye', 'AAA', 100, 1);
    expect(board.submit('bullseye', 'BBB', 200, 2)).toBe(1);
    expect(board.submit('bullseye', 'CCC', 150, 3)).toBe(2);
  });

  it('keeps the earlier score ahead on a tie', () => {
    board.submit('bullseye', 'OLD', 100, 1);
    expect(board.submit('bullseye', 'NEW', 100, 2)).toBe(2);
  });

  it('drops the lowest entry when full and rejects scores that do not beat it', () => {
    board.submit('bullseye', 'AAA', 100, 1);
    board.submit('bullseye', 'BBB', 200, 2);
    board.submit('bullseye', 'CCC', 300, 3);

    expect(board.qualifies('bullseye', 100)).toBe(false);
    expect(board.submit('bullseye', 'TIE', 100, 4)).toBeNull();

    expect(board.submit('bullseye', 'DDD', 150, 5)).toBe(3);
    expect(board.top('bullseye').map((e) => e.name)).toEqual(['CCC', 'BBB', 'DDD']);
  });

  it('never records a zero score', () => {
    expect(board.qualifies('bullseye', 0)).toBe(false);
    expect(board.submit('bullseye', 'ZZZ', 0, 1)).toBeNull();
  });

  it('rejects invalid names', () => {
    expect(board.submit('bullseye', '***', 500, 1)).toBeNull();
    expect(board.top('bullseye')).toEqual([]);
  });

  it('keeps separate tables per game', () => {
    board.submit('bullseye', 'AAA', 100, 1);
    expect(board.top('popup')).toEqual([]);
  });

  it('remembers the level reached', () => {
    board.submit('bricks', 'ana', 500, 1, 4);
    expect(board.top('bricks')[0]).toMatchObject({ name: 'ANA', level: 4 });
  });
});
