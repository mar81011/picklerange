// Memory Match for two players taking turns. Each turn, hit two face-down
// tiles. A match scores a point and you go again; otherwise the tiles flip back
// and the other player goes. A ball that hits no face-down tile ends the turn.
import type { Rng } from '../../core/geometry';

export interface MemoryState {
  /** Symbol index per tile; equal numbers are a pair. */
  tiles: readonly number[];
  /** Tiles matched so far (they stay face up). */
  matched: readonly boolean[];
  /** Tile turned over this turn, waiting for its partner. */
  open: number | null;
  turn: 0 | 1;
  pairs: readonly [number, number];
}

export function createMemory(pairs: number, rng: Rng): MemoryState {
  const tiles = Array.from({ length: pairs * 2 }, (_, i) => Math.floor(i / 2));
  // Fisher-Yates shuffle.
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return { tiles, matched: tiles.map(() => false), open: null, turn: 0, pairs: [0, 0] };
}

export function isOver(state: MemoryState): boolean {
  return state.matched.every(Boolean);
}

/** Who won, or 'draw', once the game is over. */
export function winner(state: MemoryState): 0 | 1 | 'draw' {
  const [a, b] = state.pairs;
  return a === b ? 'draw' : a > b ? 0 : 1;
}

export type FlipResult =
  | { kind: 'first'; tile: number }
  | { kind: 'match'; tiles: [number, number] }
  | { kind: 'nomatch'; tiles: [number, number] }
  | { kind: 'miss'; reopened: number | null };

/** Plays a shot that hit tile `index`, or null when it hit no face-down tile. */
export function flip(state: MemoryState, index: number | null): { state: MemoryState; result: FlipResult } {
  const other = state.turn === 0 ? 1 : 0;
  const playable = index !== null && !state.matched[index] && index !== state.open;
  if (!playable || isOver(state)) {
    // Turn over; any half-open pair flips back.
    return { state: { ...state, open: null, turn: other }, result: { kind: 'miss', reopened: state.open } };
  }
  if (state.open === null) return { state: { ...state, open: index }, result: { kind: 'first', tile: index } };

  const first = state.open;
  if (state.tiles[first] === state.tiles[index]) {
    const matched = state.matched.slice();
    matched[first] = matched[index] = true;
    const pairs: [number, number] = [...state.pairs];
    pairs[state.turn]++;
    // A match keeps the turn.
    return { state: { ...state, matched, pairs, open: null }, result: { kind: 'match', tiles: [first, index] } };
  }
  return { state: { ...state, open: null, turn: other }, result: { kind: 'nomatch', tiles: [first, index] } };
}
