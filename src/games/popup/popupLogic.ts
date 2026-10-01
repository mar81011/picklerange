// Pop-Up Targets: targets appear around the court, shrink, and vanish.
// Hit them fast for more points; consecutive hits build a multiplier. Later
// levels mix in bomb targets that cost points when hit.
import { intersectPlaneZ, type FloorArea, type Ray, type Rng } from '../../core/geometry';

export interface PopUpOptions {
  area: FloorArea;
  centerHeight: number;
  durationMs: number;
  maxActive: number;
  spawnEveryMs: number;
  /** How long a target stays up before vanishing. */
  lifeMs: number;
  /** Radius when it first pops up. */
  radius: number;
  /** Fraction of the full radius left just before it vanishes. */
  minScale: number;
  basePoints: number;
  /** Chance each new target is a bomb (0..1). */
  bombChance: number;
  /** Points lost for hitting a bomb. */
  bombPenalty: number;
  debounceMs: number;
}

export const DEFAULT_POPUP: Omit<PopUpOptions, 'area'> = {
  centerHeight: 0.75,
  durationMs: 60_000,
  maxActive: 3,
  spawnEveryMs: 900,
  lifeMs: 2800,
  radius: 0.5,
  minScale: 0.35,
  basePoints: 100,
  bombChance: 0,
  bombPenalty: 150,
  debounceMs: 250,
};

export interface PopTarget {
  id: number;
  x: number;
  y: number;
  z: number;
  bornAt: number;
  /** Don't hit it: costs points and breaks the streak. */
  bomb: boolean;
}

export interface PopUpState {
  startedAt: number;
  targets: readonly PopTarget[];
  nextId: number;
  lastSpawnAt: number;
  lastHitAt: number | null;
  score: number;
  streak: number;
  bestStreak: number;
  hits: number;
  shots: number;
}

export type PopUpResult =
  | { kind: 'hit'; target: PopTarget; points: number; multiplier: number; at: { x: number; y: number; z: number } }
  | { kind: 'bomb'; target: PopTarget; points: number; at: { x: number; y: number; z: number } }
  | { kind: 'miss' };

export function createPopUp(now: number): PopUpState {
  // lastSpawnAt in the past so the first target appears immediately.
  return { startedAt: now, targets: [], nextId: 1, lastSpawnAt: -Infinity, lastHitAt: null, score: 0, streak: 0, bestStreak: 0, hits: 0, shots: 0 };
}

export function timeLeftMs(state: PopUpState, opts: PopUpOptions, now: number): number {
  return Math.max(0, opts.durationMs - (now - state.startedAt));
}

export function isOver(state: PopUpState, opts: PopUpOptions, now: number): boolean {
  return timeLeftMs(state, opts, now) <= 0;
}

/** 1 when just spawned, falling to 0 as it vanishes. */
export function lifeLeft(target: PopTarget, opts: PopUpOptions, now: number): number {
  return Math.max(0, 1 - (now - target.bornAt) / opts.lifeMs);
}

export function radiusAt(target: PopTarget, opts: PopUpOptions, now: number): number {
  return opts.radius * (opts.minScale + (1 - opts.minScale) * lifeLeft(target, opts, now));
}

/** x1 for the first 2 hits in a row, x2 from 3, x3 from 6, capped at x4 from 9. */
export function multiplierFor(streak: number): number {
  return Math.min(4, 1 + Math.floor(streak / 3));
}

function spawn(state: PopUpState, opts: PopUpOptions, now: number, rng: Rng): PopUpState {
  const { minX, maxX, minZ, maxZ } = opts.area;
  // Try a few spots and keep the first that doesn't overlap a live target.
  for (let attempt = 0; attempt < 8; attempt++) {
    const x = minX + opts.radius + rng() * (maxX - minX - 2 * opts.radius);
    const z = minZ + rng() * (maxZ - minZ);
    const clear = state.targets.every((t) => Math.hypot(t.x - x, t.z - z) > opts.radius * 2.4);
    if (clear) {
      const target: PopTarget = { id: state.nextId, x, y: opts.centerHeight, z, bornAt: now, bomb: rng() < opts.bombChance };
      return { ...state, targets: [...state.targets, target], nextId: state.nextId + 1, lastSpawnAt: now };
    }
  }
  return { ...state, lastSpawnAt: now };
}

/**
 * Advances time: removes vanished targets and spawns new ones. Returns the
 * targets that vanished unhit so the view can animate them away. A real target
 * that escapes resets the streak; a bomb that fades away does not.
 */
export function tick(state: PopUpState, opts: PopUpOptions, now: number, rng: Rng): { state: PopUpState; vanished: PopTarget[] } {
  if (isOver(state, opts, now)) return { state: { ...state, targets: [] }, vanished: [...state.targets] };

  const vanished = state.targets.filter((t) => lifeLeft(t, opts, now) <= 0);
  let next: PopUpState = vanished.length
    ? { ...state, targets: state.targets.filter((t) => !vanished.includes(t)), streak: vanished.some((t) => !t.bomb) ? 0 : state.streak }
    : state;
  if (next.targets.length < opts.maxActive && now - next.lastSpawnAt >= opts.spawnEveryMs) {
    next = spawn(next, opts, now, rng);
  }
  return { state: next, vanished };
}

/** Returns result null when the hit is ignored (game over or debounce). */
export function applyHit(
  state: PopUpState,
  opts: PopUpOptions,
  ray: Ray,
  now: number,
): { state: PopUpState; result: PopUpResult | null } {
  if (isOver(state, opts, now)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };

  // Pick the target the ball came closest to the center of, relative to its current size.
  let best: { target: PopTarget; closeness: number; at: { x: number; y: number; z: number } } | null = null;
  for (const target of state.targets) {
    const at = intersectPlaneZ(ray, target.z);
    if (!at) continue;
    const closeness = Math.hypot(at.x - target.x, at.y - target.y) / radiusAt(target, opts, now);
    if (closeness <= 1 && (!best || closeness < best.closeness)) best = { target, closeness, at };
  }

  const shots = state.shots + 1;
  if (!best) {
    return { state: { ...state, shots, streak: 0, lastHitAt: now }, result: { kind: 'miss' } };
  }

  if (best.target.bomb) {
    return {
      state: {
        ...state,
        targets: state.targets.filter((t) => t !== best.target),
        score: Math.max(0, state.score - opts.bombPenalty),
        streak: 0,
        shots,
        lastHitAt: now,
      },
      result: { kind: 'bomb', target: best.target, points: -opts.bombPenalty, at: best.at },
    };
  }

  const streak = state.streak + 1;
  const multiplier = multiplierFor(streak);
  // Faster hits are worth more: 50% of base when about to vanish, 150% when fresh.
  const speedFactor = 0.5 + lifeLeft(best.target, opts, now);
  const points = Math.round(opts.basePoints * speedFactor) * multiplier;
  return {
    state: {
      ...state,
      targets: state.targets.filter((t) => t !== best.target),
      score: state.score + points,
      streak,
      bestStreak: Math.max(state.bestStreak, streak),
      hits: state.hits + 1,
      shots,
      lastHitAt: now,
    },
    result: { kind: 'hit', target: best.target, points, multiplier, at: best.at },
  };
}
