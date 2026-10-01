// Pickle Darts 301: a giant dartboard stands on the court. Players take turns
// of three balls, counting down from 301. Land exactly on zero to win; going
// below zero is a "bust" and the turn's score is undone. Rings are much wider
// than a real board so a pickleball can hit them.
import { intersectPlaneZ, type Ray } from '../../core/geometry';

/** Standard dartboard order, clockwise from the top. */
export const SECTORS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** Ring edges as a fraction of the board radius. */
export const RINGS = { bull: 0.08, outerBull: 0.17, tripleIn: 0.52, tripleOut: 0.64, doubleIn: 0.86, doubleOut: 1 } as const;

export interface Board {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface Dart {
  /** Sector number (1-20), 25 for the outer bull, 50 for the bullseye, 0 for a miss. */
  sector: number;
  multiplier: 0 | 1 | 2 | 3;
  points: number;
  label: string;
}

const MISS: Dart = { sector: 0, multiplier: 0, points: 0, label: 'MISS' };

/** Scores a point on the board face, in meters relative to the board center (y up). */
export function scoreAt(dx: number, dy: number, radius: number): Dart {
  const r = Math.hypot(dx, dy) / radius;
  if (r > RINGS.doubleOut) return MISS;
  if (r <= RINGS.bull) return { sector: 50, multiplier: 1, points: 50, label: 'BULLSEYE' };
  if (r <= RINGS.outerBull) return { sector: 25, multiplier: 1, points: 25, label: '25' };
  // Angle clockwise from straight up, with sector 20 centered on the top.
  const angle = (Math.atan2(dx, dy) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const sector = SECTORS[Math.floor(angle / (Math.PI / 10)) % 20];
  const multiplier = r >= RINGS.doubleIn ? 2 : r >= RINGS.tripleIn && r <= RINGS.tripleOut ? 3 : 1;
  const label = multiplier === 3 ? `TRIPLE ${sector}` : multiplier === 2 ? `DOUBLE ${sector}` : String(sector);
  return { sector, multiplier, points: sector * multiplier, label };
}

export function throwAt(board: Board, ray: Ray): Dart & { at: { x: number; y: number; z: number } | null } {
  const at = intersectPlaneZ(ray, board.z);
  if (!at) return { ...MISS, at: null };
  return { ...scoreAt(at.x - board.x, at.y - board.y, board.radius), at };
}

export const DARTS_PER_TURN = 3;

export interface DartsState {
  scores: readonly number[];
  turn: number;
  /** Darts thrown this turn. */
  darts: readonly Dart[];
  /** Score at the start of this turn, restored on a bust. */
  turnStart: number;
  winner: number | null;
}

export function createDarts(players: number, start = 301): DartsState {
  return { scores: Array(players).fill(start), turn: 0, darts: [], turnStart: start, winner: null };
}

export type DartOutcome = 'scored' | 'bust' | 'win';

/** Applies one throw. turnOver says whether the next throw belongs to the next player. */
export function applyDart(state: DartsState, dart: Dart): { state: DartsState; outcome: DartOutcome; turnOver: boolean } {
  if (state.winner !== null) return { state, outcome: 'scored', turnOver: false };
  const remaining = state.scores[state.turn] - dart.points;
  const scores = state.scores.slice();
  const next = (s: DartsState): DartsState => {
    const turn = (s.turn + 1) % s.scores.length;
    return { ...s, turn, darts: [], turnStart: s.scores[turn] };
  };

  if (remaining === 0) {
    scores[state.turn] = 0;
    return { state: { ...state, scores, darts: [...state.darts, dart], winner: state.turn }, outcome: 'win', turnOver: true };
  }
  if (remaining < 0) {
    // Bust: the whole turn is undone.
    scores[state.turn] = state.turnStart;
    return { state: next({ ...state, scores }), outcome: 'bust', turnOver: true };
  }
  scores[state.turn] = remaining;
  const darts = [...state.darts, dart];
  if (darts.length >= DARTS_PER_TURN) return { state: next({ ...state, scores, darts }), outcome: 'scored', turnOver: true };
  return { state: { ...state, scores, darts }, outcome: 'scored', turnOver: false };
}
