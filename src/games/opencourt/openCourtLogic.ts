// Open Court: a CPU opponent stands on the far court. Place each shot away from
// them. Anything they can reach comes back (no points); the farther the winner
// lands from them, the more it scores. They move after every shot.
import { BASELINE_Z, COURT, KITCHEN_Z } from '../../core/court';
import { clamp, intersectGround, lerp, type Ray, type Rng } from '../../core/geometry';

export interface OpenCourtOptions {
  shots: number;
  /** How far the opponent can lunge to return a ball, in meters. */
  reach: number;
  debounceMs: number;
}

export const DEFAULT_OPEN_COURT: OpenCourtOptions = { shots: 10, reach: 1.3, debounceMs: 250 };

export interface Opponent {
  x: number;
  z: number;
}

export type ShotKind = 'winner' | 'returned' | 'out';

export interface ShotResult {
  kind: ShotKind;
  points: number;
  /** Where the ball came down, or null if it sailed over everything. */
  landing: { x: number; z: number } | null;
  /** Distance from the opponent to the landing spot. */
  distance: number | null;
  /** Winner that dropped into the kitchen while the opponent was deep. */
  dropShot: boolean;
  outReason?: 'long' | 'wide';
}

export interface OpenCourtState {
  shotsLeft: number;
  score: number;
  opponent: Opponent;
  lastHitAt: number | null;
  winners: number;
  streak: number;
  bestStreak: number;
}

/** Points for a winner by how far past the opponent's reach it landed. */
export const WINNER_POINTS = { tight: 10, clear: 20, unreachable: 30 } as const;
export const DROP_SHOT_BONUS = 10;

/** Opponent counts as "deep" beyond this z, which makes a kitchen drop shot a bonus. */
const DEEP_Z = BASELINE_Z + 2.2;
/** Where the opponent may stand: inside the far court, behind the kitchen. */
const OPPONENT_MIN_Z = BASELINE_Z + 0.4;
const OPPONENT_MAX_Z = KITCHEN_Z - 0.5;
const OPPONENT_MAX_X = COURT.halfWidth - 0.4;

export function createOpenCourt(opts: OpenCourtOptions): OpenCourtState {
  return {
    shotsLeft: opts.shots,
    score: 0,
    opponent: { x: 0, z: BASELINE_Z + 1 },
    lastHitAt: null,
    winners: 0,
    streak: 0,
    bestStreak: 0,
  };
}

export function classifyShot(opponent: Opponent, opts: OpenCourtOptions, ray: Ray): ShotResult {
  const ground = intersectGround(ray);
  if (!ground || ground.z < BASELINE_Z) {
    return { kind: 'out', points: 0, landing: ground && { x: ground.x, z: ground.z }, distance: null, dropShot: false, outReason: 'long' };
  }
  const landing = { x: ground.x, z: ground.z };
  if (Math.abs(landing.x) > COURT.halfWidth) {
    return { kind: 'out', points: 0, landing, distance: null, dropShot: false, outReason: 'wide' };
  }

  const distance = Math.hypot(landing.x - opponent.x, landing.z - opponent.z);
  if (distance <= opts.reach) return { kind: 'returned', points: 0, landing, distance, dropShot: false };

  const margin = distance - opts.reach;
  const base = margin < 1 ? WINNER_POINTS.tight : margin < 2.2 ? WINNER_POINTS.clear : WINNER_POINTS.unreachable;
  const dropShot = landing.z > KITCHEN_Z && opponent.z < DEEP_Z;
  return { kind: 'winner', points: base + (dropShot ? DROP_SHOT_BONUS : 0), landing, distance, dropShot };
}

/**
 * The opponent's next position: they chase toward the last ball, then
 * recover partway to the middle, with some randomness so it can't be predicted.
 */
export function nextOpponentPosition(opponent: Opponent, landing: { x: number; z: number } | null, rng: Rng): Opponent {
  const chaseX = landing ? clamp(landing.x, -OPPONENT_MAX_X, OPPONENT_MAX_X) : opponent.x;
  const x = lerp(chaseX, 0, 0.45) + (rng() - 0.5) * 2.2;
  const z = lerp(OPPONENT_MIN_Z, OPPONENT_MAX_Z, rng());
  return { x: clamp(x, -OPPONENT_MAX_X, OPPONENT_MAX_X), z: clamp(z, OPPONENT_MIN_Z, OPPONENT_MAX_Z) };
}

export function isRoundOver(state: OpenCourtState): boolean {
  return state.shotsLeft <= 0;
}

/** Returns result null when the hit is ignored (round over or debounce). */
export function applyHit(
  state: OpenCourtState,
  opts: OpenCourtOptions,
  ray: Ray,
  timestamp: number,
  rng: Rng,
): { state: OpenCourtState; result: ShotResult | null } {
  if (isRoundOver(state)) return { state, result: null };
  if (state.lastHitAt !== null && timestamp - state.lastHitAt < opts.debounceMs) return { state, result: null };

  const result = classifyShot(state.opponent, opts, ray);
  const won = result.kind === 'winner';
  const streak = won ? state.streak + 1 : 0;
  const shotsLeft = state.shotsLeft - 1;
  return {
    state: {
      shotsLeft,
      score: state.score + result.points,
      opponent: shotsLeft > 0 ? nextOpponentPosition(state.opponent, result.landing, rng) : state.opponent,
      lastHitAt: timestamp,
      winners: state.winners + (won ? 1 : 0),
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
    },
    result,
  };
}
