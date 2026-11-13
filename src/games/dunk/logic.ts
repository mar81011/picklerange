// Dunk Tank rules: a clown sits on a plank over a tank of water. Hit the red
// circle on the target beside the tank and the plank drops: SPLASH. The white
// rim around the red is a near miss; hitting the clown just makes him laugh.
// Later levels shrink the target and set it sliding along its rail. Pure (no
// Three.js) so it can be unit-tested. Units are meters; times are milliseconds.
import { intersectPlaneZ, type Ray, type Vec3 } from '../../core/geometry';

export interface DunkOptions {
  /** Home position of the target's center; it faces the player. */
  target: Vec3;
  /** Radius of the red circle (the part that dunks). */
  radius: number;
  /** Radius of the white rim around it (a near miss). */
  rim: number;
  /** Side-to-side slide and up-and-down bob, meters either side of home; cycles per second. */
  motion: { ampX: number; ampY: number; speed: number };
  /** The clown's body, for "you hit the clown" (he laughs it off). */
  clown: { center: Vec3; radius: number };
  balls: number;
  /** Dunks needed to clear the level; the level ends as soon as you get them. */
  dunks: number;
  /** After a dunk the clown climbs back up; hits during that time don't count (or use a ball). */
  resetMs: number;
  debounceMs: number;
}

export const POINTS = { dunk: 100, rim: 10, ballLeft: 20 } as const;

export type HitKind = 'dunk' | 'rim' | 'clown' | 'miss' | 'wait';

export interface HitResult {
  kind: HitKind;
  points: number;
  /** Where the ball struck (target face, clown or the target's plane), or null if it went nowhere near. */
  at: Vec3 | null;
}

export interface DunkState {
  ballsLeft: number;
  dunks: number;
  score: number;
  /** While the clown is climbing back up after a dunk. */
  resetUntil: number | null;
  lastHitAt: number | null;
  /** Bonus already added for balls left over (once, when the goal is reached). */
  bonus: number;
}

export function createRound(opts: DunkOptions): DunkState {
  return { ballsLeft: opts.balls, dunks: 0, score: 0, resetUntil: null, lastHitAt: null, bonus: 0 };
}

/** Where the target's center is at time `now`. */
export function targetAt(opts: DunkOptions, now: number): Vec3 {
  const angle = (now / 1000) * opts.motion.speed * Math.PI * 2;
  return {
    x: opts.target.x + Math.sin(angle) * opts.motion.ampX,
    y: opts.target.y + Math.sin(angle * 2) * opts.motion.ampY,
    z: opts.target.z,
  };
}

export function isPassed(state: DunkState, opts: DunkOptions): boolean {
  return state.dunks >= opts.dunks;
}

export function isOver(state: DunkState, opts: DunkOptions): boolean {
  return isPassed(state, opts) || state.ballsLeft <= 0;
}

/** Distance along the ray to where it first enters the sphere, or null if it misses. */
export function raySphere(ray: Ray, center: Vec3, radius: number): number | null {
  const len = Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z);
  const d = { x: ray.dir.x / len, y: ray.dir.y / len, z: ray.dir.z / len };
  const o = { x: ray.origin.x - center.x, y: ray.origin.y - center.y, z: ray.origin.z - center.z };
  const b = o.x * d.x + o.y * d.y + o.z * d.z;
  const c = o.x * o.x + o.y * o.y + o.z * o.z - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t / len : null;
}

/**
 * Applies one hit at time `now` (the same clock that draws the target).
 * Returns result null when the hit is ignored (round over, or debounce).
 */
export function applyHit(state: DunkState, opts: DunkOptions, ray: Ray, now: number): { state: DunkState; result: HitResult | null } {
  if (isOver(state, opts)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };
  if (state.resetUntil !== null && now < state.resetUntil) {
    return { state: { ...state, lastHitAt: now }, result: { kind: 'wait', points: 0, at: null } };
  }

  const center = targetAt(opts, now);
  const onPlane = intersectPlaneZ(ray, center.z);
  const dist = onPlane ? Math.hypot(onPlane.x - center.x, onPlane.y - center.y) : Infinity;
  const tPlane = onPlane ? (center.z - ray.origin.z) / ray.dir.z : Infinity;
  const tClown = raySphere(ray, opts.clown.center, opts.clown.radius);
  // Whatever the ball reaches first: the clown can stand in front of the target's plane.
  const clownFirst = tClown !== null && (dist > opts.rim || tClown < tPlane);

  let kind: HitKind;
  let at: Vec3 | null = onPlane;
  if (dist <= opts.radius && !clownFirst) kind = 'dunk';
  else if (dist <= opts.rim && !clownFirst) kind = 'rim';
  else if (tClown !== null) {
    kind = 'clown';
    at = { x: ray.origin.x + ray.dir.x * tClown, y: ray.origin.y + ray.dir.y * tClown, z: ray.origin.z + ray.dir.z * tClown };
  } else kind = 'miss';

  const points = kind === 'dunk' ? POINTS.dunk : kind === 'rim' ? POINTS.rim : 0;
  const next: DunkState = {
    ...state,
    ballsLeft: state.ballsLeft - 1,
    dunks: state.dunks + (kind === 'dunk' ? 1 : 0),
    score: state.score + points,
    resetUntil: kind === 'dunk' ? now + opts.resetMs : state.resetUntil,
    lastHitAt: now,
  };
  // Reaching the goal early pays for every ball left.
  if (isPassed(next, opts) && next.bonus === 0) {
    next.bonus = next.ballsLeft * POINTS.ballLeft;
    next.score += next.bonus;
  }
  return { state: next, result: { kind, points, at } };
}
