// Firing Range: steel plates slide across the range on three rails at
// different depths. Hit them for points; gold bonus plates are worth more; NO-SHOOT plates
// (later levels) cost points. Each level is a timed round.
import { COURT } from '../../core/court';
import { intersectPlaneZ, type Ray, type Rng } from '../../core/geometry';

export interface Rail {
  z: number;
  y: number;
  /** +1 moves left to right, -1 right to left. */
  dir: 1 | -1;
}

export const RAILS: readonly Rail[] = [
  { z: -5.6, y: 1.55, dir: 1 },
  { z: -4.2, y: 1.1, dir: -1 },
  { z: -2.8, y: 0.65, dir: 1 },
];

/** Ducks travel between these x positions (a little past the court). */
export const RAIL_HALF_LENGTH = COURT.halfWidth + 0.6;

export interface GalleryOptions {
  durationMs: number;
  /** Time between plates on each rail. */
  spawnEveryMs: number;
  /** m/s, multiplied up for nearer rails. */
  speed: number;
  /** Hit radius of a plate, meters. */
  size: number;
  bonusChance: number;
  noShootChance: number;
  debounceMs: number;
}

export type PlateKind = 'steel' | 'bonus' | 'noshoot';

export interface Plate {
  id: number;
  rail: number;
  kind: PlateKind;
  spawnAt: number;
}

export interface GalleryState {
  plates: readonly Plate[];
  nextId: number;
  /** Spawns done per rail. */
  spawnedPerRail: readonly number[];
  startedAt: number;
  score: number;
  hits: number;
  lastHitAt: number | null;
}

export const POINTS: Record<PlateKind, number> = { steel: 10, bonus: 50, noshoot: -30 };

export function createGallery(now: number): GalleryState {
  return { plates: [], nextId: 1, spawnedPerRail: RAILS.map(() => 0), startedAt: now, score: 0, hits: 0, lastHitAt: null };
}

export function railSpeed(opts: GalleryOptions, rail: number): number {
  return opts.speed * (1 + rail * 0.25);
}

export function platePosition(plate: Plate, opts: GalleryOptions, now: number): { x: number; y: number; z: number } {
  const rail = RAILS[plate.rail];
  const travelled = ((now - plate.spawnAt) / 1000) * railSpeed(opts, plate.rail);
  return { x: rail.dir * (-RAIL_HALF_LENGTH + travelled), y: rail.y, z: rail.z };
}

export function timeLeftMs(state: GalleryState, opts: GalleryOptions, now: number): number {
  return Math.max(0, opts.durationMs - (now - state.startedAt));
}

export function isOver(state: GalleryState, opts: GalleryOptions, now: number): boolean {
  return timeLeftMs(state, opts, now) <= 0;
}

/** Spawns plates on each rail on its schedule (rails are staggered) and drops plates that reached the far end. */
export function tick(state: GalleryState, opts: GalleryOptions, now: number, rng: Rng): { state: GalleryState; gone: Plate[] } {
  if (isOver(state, opts, now)) return { state: { ...state, plates: [] }, gone: [...state.plates] };
  let next = state;
  const spawnedPerRail = state.spawnedPerRail.slice();
  RAILS.forEach((_, rail) => {
    const offset = (rail * opts.spawnEveryMs) / RAILS.length;
    const due = Math.max(0, Math.floor((now - state.startedAt - offset) / opts.spawnEveryMs) + 1);
    while (spawnedPerRail[rail] < due) {
      const roll = rng();
      const kind: PlateKind = roll < opts.noShootChance ? 'noshoot' : roll < opts.noShootChance + opts.bonusChance ? 'bonus' : 'steel';
      next = { ...next, plates: [...next.plates, { id: next.nextId, rail, kind, spawnAt: now }], nextId: next.nextId + 1 };
      spawnedPerRail[rail]++;
    }
  });
  const gone = next.plates.filter((d) => Math.abs(platePosition(d, opts, now).x) > RAIL_HALF_LENGTH);
  return { state: { ...next, spawnedPerRail, plates: next.plates.filter((d) => !gone.includes(d)) }, gone };
}

export type GalleryResult =
  | { kind: 'hit'; plate: Plate; points: number; at: { x: number; y: number; z: number } }
  | { kind: 'miss' };

/** The nearest plate (to the player) the ball strikes is hit. */
export function applyHit(state: GalleryState, opts: GalleryOptions, ray: Ray, now: number): { state: GalleryState; result: GalleryResult | null } {
  if (isOver(state, opts, now)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };
  const byNearest = [...state.plates].sort((a, b) => RAILS[b.rail].z - RAILS[a.rail].z);
  for (const plate of byNearest) {
    const p = platePosition(plate, opts, now);
    const at = intersectPlaneZ(ray, p.z);
    if (!at || Math.hypot(at.x - p.x, at.y - p.y) > opts.size) continue;
    const points = POINTS[plate.kind];
    return {
      state: {
        ...state,
        plates: state.plates.filter((d) => d !== plate),
        score: Math.max(0, state.score + points),
        hits: state.hits + (points > 0 ? 1 : 0),
        lastHitAt: now,
      },
      result: { kind: 'hit', plate, points, at },
    };
  }
  return { state: { ...state, lastHitAt: now }, result: { kind: 'miss' } };
}
