import { describe, expect, it } from 'vitest';
import { createMemory, flip, isOver, winner, type MemoryState } from './logic';

/** A fixed layout: tiles [0,0,1,1,2,2]. */
function fixed(): MemoryState {
  return { tiles: [0, 0, 1, 1, 2, 2], matched: Array(6).fill(false), open: null, turn: 0, pairs: [0, 0] };
}

describe('memory match', () => {
  it('deals each symbol exactly twice', () => {
    const s = createMemory(6, Math.random);
    expect(s.tiles).toHaveLength(12);
    for (let sym = 0; sym < 6; sym++) expect(s.tiles.filter((t) => t === sym)).toHaveLength(2);
  });

  it('scores a match and keeps the turn', () => {
    let s = flip(fixed(), 0).state;
    const { state, result } = flip(s, 1);
    expect(result).toEqual({ kind: 'match', tiles: [0, 1] });
    expect(state.pairs).toEqual([1, 0]);
    expect(state.turn).toBe(0);
    expect(state.matched.slice(0, 2)).toEqual([true, true]);
    s = state;
  });

  it('passes the turn on a mismatch', () => {
    const s = flip(fixed(), 0).state;
    const { state, result } = flip(s, 2);
    expect(result).toEqual({ kind: 'nomatch', tiles: [0, 2] });
    expect(state.turn).toBe(1);
    expect(state.open).toBeNull();
  });

  it('ends the turn on a miss, matched tile, or the same tile twice', () => {
    expect(flip(fixed(), null)).toMatchObject({ result: { kind: 'miss', reopened: null }, state: { turn: 1 } });
    const open = flip(fixed(), 3).state;
    expect(flip(open, 3)).toMatchObject({ result: { kind: 'miss', reopened: 3 }, state: { turn: 1, open: null } });
    const matched = flip(flip(fixed(), 0).state, 1).state;
    expect(flip(matched, 0).result.kind).toBe('miss');
  });

  it('ends when every pair is found and names the winner', () => {
    let s = fixed();
    for (const i of [0, 1, 2, 3]) s = flip(s, i).state; // player 0: two pairs
    s = flip(s, null).state; // player 0 misses
    for (const i of [4, 5]) s = flip(s, i).state; // player 1: one pair
    expect(isOver(s)).toBe(true);
    expect(s.pairs).toEqual([2, 1]);
    expect(winner(s)).toBe(0);
  });
});
