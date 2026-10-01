// Rally Survival: on every feed (matched to the ball feeder's pace) a zone lights
// up on the court. Land that ball in the zone. Landing elsewhere or not hitting
// before the next feed costs a life. Make enough good returns to clear the level.
import { BASELINE_Z, COURT, KITCHEN_Z } from '../../core/court';
import { intersectGround, type Ray, type Rng } from '../../core/geometry';

export interface RallyOptions {
  /** Time between feeds; set to match the feeder. */
  feedEveryMs: number;
  zoneRadius: number;
  /** Good returns needed to clear the level. */
  returnsNeeded: number;
  debounceMs: number;
}

export interface RallyZone {
  x: number;
  z: number;
  radius: number;
}

export interface RallyState {
  feed: number;
  feedStartedAt: number;
  zone: RallyZone;
  /** Whether this feed's ball has already been played. */
  resolved: boolean;
  lives: number;
  returns: number;
  streak: number;
  score: number;
  lastHitAt: number | null;
}

export const POINTS_PER_RETURN = 20;
export const STREAK_BONUS = 5;

export function randomZone(radius: number, rng: Rng): RallyZone {
  const margin = radius + 0.2;
  return {
    x: -COURT.halfWidth + margin + rng() * (COURT.width - 2 * margin),
    z: BASELINE_Z + margin + rng() * (KITCHEN_Z + 1.4 - BASELINE_Z - 2 * margin),
    radius,
  };
}

export function createRally(opts: RallyOptions, now: number, lives: number, rng: Rng): RallyState {
  return { feed: 1, feedStartedAt: now, zone: randomZone(opts.zoneRadius, rng), resolved: false, lives, returns: 0, streak: 0, score: 0, lastHitAt: null };
}

export function isCleared(state: RallyState, opts: RallyOptions): boolean {
  return state.returns >= opts.returnsNeeded;
}

export function isOver(state: RallyState, opts: RallyOptions): boolean {
  return state.lives <= 0 || isCleared(state, opts);
}

/** 1 at the start of a feed window, 0 when the next feed arrives. */
export function windowLeft(state: RallyState, opts: RallyOptions, now: number): number {
  return Math.max(0, 1 - (now - state.feedStartedAt) / opts.feedEveryMs);
}

/** Starts the next feed when its time comes. late is true if the previous ball was never played. */
export function tick(state: RallyState, opts: RallyOptions, now: number, rng: Rng): { state: RallyState; newFeed: boolean; late: boolean } {
  if (isOver(state, opts) || now - state.feedStartedAt < opts.feedEveryMs) return { state, newFeed: false, late: false };
  const late = !state.resolved;
  const lives = late ? state.lives - 1 : state.lives;
  const next: RallyState = {
    ...state,
    feed: state.feed + 1,
    feedStartedAt: now,
    zone: randomZone(opts.zoneRadius, rng),
    resolved: false,
    lives,
    streak: late ? 0 : state.streak,
  };
  return { state: next, newFeed: lives > 0, late };
}

export type RallyResult =
  | { kind: 'good'; points: number; landing: { x: number; z: number } }
  | { kind: 'bad'; landing: { x: number; z: number } | null };

/** Only the first ball of each feed counts. */
export function applyHit(state: RallyState, opts: RallyOptions, ray: Ray, now: number): { state: RallyState; result: RallyResult | null } {
  if (isOver(state, opts) || state.resolved) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };
  const ground = intersectGround(ray);
  const landing = ground && { x: ground.x, z: ground.z };
  const good = landing !== null && Math.hypot(landing.x - state.zone.x, landing.z - state.zone.z) <= state.zone.radius;
  if (!good) {
    return { state: { ...state, resolved: true, lives: state.lives - 1, streak: 0, lastHitAt: now }, result: { kind: 'bad', landing } };
  }
  const streak = state.streak + 1;
  const points = POINTS_PER_RETURN + (streak - 1) * STREAK_BONUS;
  return {
    state: { ...state, resolved: true, returns: state.returns + 1, streak, score: state.score + points, lastHitAt: now },
    result: { kind: 'good', points, landing: landing! },
  };
}
