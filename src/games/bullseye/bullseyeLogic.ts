// Bullseye rules: one target at a time stands on the court. Later levels make
// it smaller and set it sliding/bobbing. Pure (no Three.js) so it can be
// unit-tested. Units are meters; times are milliseconds.
import { intersectPlaneZ, type FloorArea, type Ray, type Rng } from '../../core/geometry';

export interface Ring {
  radius: number;
  points: number;
}

/** Innermost first. */
export const DEFAULT_RINGS: readonly Ring[] = [
  { radius: 0.14, points: 50 },
  { radius: 0.28, points: 25 },
  { radius: 0.42, points: 10 },
  { radius: 0.56, points: 5 },
];

/** Same points, every ring radius multiplied by `factor`. */
export function scaleRings(rings: readonly Ring[], factor: number): Ring[] {
  return rings.map((r) => ({ ...r, radius: r.radius * factor }));
}

/** How a target moves around its home spot. Zero amplitudes = stands still. */
export interface Motion {
  /** Side-to-side sway, meters either side of home. */
  ampX: number;
  /** Up-and-down bob, meters either side of home. */
  ampY: number;
  /** Cycles per second. */
  speed: number;
}

export const STILL: Motion = { ampX: 0, ampY: 0, speed: 0 };

export interface BullseyeOptions {
  /** Where the target may stand. */
  area: FloorArea;
  /** Height of the target's center above the court. */
  centerHeight: number;
  shots: number;
  rings: readonly Ring[];
  motion: Motion;
  debounceMs: number;
}

export interface Target {
  /** Home position; with motion, the target moves around it. */
  x: number;
  y: number;
  z: number;
  motion: Motion;
  /** Offsets each target's cycle so they don't all move in step. */
  phase: number;
}

export type ShotOutcome = 'ring' | 'miss';

export interface ShotResult {
  outcome: ShotOutcome;
  points: number;
  /** Index into rings, or null for a miss. */
  ringIndex: number | null;
  /** Where the ball crossed the target's plane, or null if it never did. */
  at: { x: number; y: number; z: number } | null;
}

export interface BullseyeState {
  shotsLeft: number;
  score: number;
  target: Target;
  lastHitAt: number | null;
  results: readonly ShotResult[];
}

function outerRadius(rings: readonly Ring[]): number {
  return rings.reduce((max, r) => Math.max(max, r.radius), 0);
}

/** Where the target's center is at time `now`. */
export function targetPositionAt(target: Target, now: number): { x: number; y: number; z: number } {
  const angle = (now / 1000) * target.motion.speed * Math.PI * 2 + target.phase;
  return {
    x: target.x + Math.sin(angle) * target.motion.ampX,
    // Bob at a different rhythm so the path isn't a simple line.
    y: target.y + Math.sin(angle * 1.7) * target.motion.ampY,
    z: target.z,
  };
}

/** Random home spot, keeping the whole target (including its sway) inside the area. */
export function placeTarget(opts: BullseyeOptions, rng: Rng): Target {
  const margin = outerRadius(opts.rings) + opts.motion.ampX;
  const { minX, maxX, minZ, maxZ } = opts.area;
  // If the area is too narrow for the target plus its sway, keep it centered.
  const mid = (minX + maxX) / 2;
  const left = Math.min(mid, minX + margin);
  const right = Math.max(mid, maxX - margin);
  return {
    x: left + rng() * (right - left),
    y: opts.centerHeight,
    z: minZ + rng() * (maxZ - minZ),
    motion: opts.motion,
    phase: rng() * Math.PI * 2,
  };
}

export function createRound(opts: BullseyeOptions, rng: Rng): BullseyeState {
  return { shotsLeft: opts.shots, score: 0, target: placeTarget(opts, rng), lastHitAt: null, results: [] };
}

/** Scores a point on the target's face by its distance from the center. */
export function scoreAt(center: { x: number; y: number }, rings: readonly Ring[], x: number, y: number): { points: number; ringIndex: number | null } {
  const dist = Math.hypot(x - center.x, y - center.y);
  const ringIndex = rings.findIndex((ring) => dist <= ring.radius);
  return ringIndex === -1 ? { points: 0, ringIndex: null } : { points: rings[ringIndex].points, ringIndex };
}

/** Share of shots so far that landed on the target, 0..1. */
export function accuracy(state: BullseyeState): number {
  if (state.results.length === 0) return 0;
  return state.results.filter((r) => r.outcome === 'ring').length / state.results.length;
}

export function isRoundOver(state: BullseyeState): boolean {
  return state.shotsLeft <= 0;
}

/**
 * Applies one hit at time `now` (the same clock that draws the target, so a
 * moving target is scored where it was shown). Returns result null when the hit
 * is ignored: the round is over, or it is within the debounce window.
 */
export function applyHit(
  state: BullseyeState,
  opts: BullseyeOptions,
  ray: Ray,
  now: number,
  rng: Rng,
): { state: BullseyeState; result: ShotResult | null } {
  if (isRoundOver(state)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };

  const center = targetPositionAt(state.target, now);
  const at = intersectPlaneZ(ray, center.z);
  const { points, ringIndex } = at ? scoreAt(center, opts.rings, at.x, at.y) : { points: 0, ringIndex: null };
  const result: ShotResult = { outcome: ringIndex === null ? 'miss' : 'ring', points, ringIndex, at };

  const shotsLeft = state.shotsLeft - 1;
  return {
    state: {
      shotsLeft,
      score: state.score + points,
      target: shotsLeft > 0 ? placeTarget(opts, rng) : state.target,
      lastHitAt: now,
      results: [...state.results, result],
    },
    result,
  };
}
