// Zombie Court: zombies shamble from the far baseline toward the net. Hit them
// before they arrive; each one that reaches the net costs a life. A level is
// one wave; survive it to move on. Times are ms; distances are meters.
import { BASELINE_Z, COURT } from '../../core/court';
import { intersectPlaneZ, type Ray, type Rng } from '../../core/geometry';

export interface WaveOptions {
  count: number;
  /** Time between spawns. */
  spawnEveryMs: number;
  /** Walking speed range, m/s. */
  speed: [number, number];
  /** Chance a zombie is a "brute" that takes 2 hits. */
  bruteChance: number;
  /** A boss (5 hits, slow) arrives last. */
  boss: boolean;
  debounceMs: number;
}

/** Zombies are hit as an upright box: this wide either side of center, this tall. */
export const ZOMBIE_HALF_WIDTH = 0.32;
export const ZOMBIE_HEIGHT = 1.75;
export const BOSS_SCALE = 1.6;
/** Where zombies "reach the net" (just in front of the screen's bottom edge). */
export const NET_Z = -0.6;
export const START_Z = BASELINE_Z - 0.5;

export type ZombieKind = 'walker' | 'brute' | 'boss';

export interface Zombie {
  id: number;
  kind: ZombieKind;
  x: number;
  spawnAt: number;
  speed: number;
  hp: number;
}

export interface WaveState {
  zombies: readonly Zombie[];
  spawned: number;
  startedAt: number;
  lives: number;
  score: number;
  kills: number;
  lastHitAt: number | null;
}

export const POINTS: Record<ZombieKind, number> = { walker: 10, brute: 25, boss: 100 };
const HP: Record<ZombieKind, number> = { walker: 1, brute: 2, boss: 5 };

export function createWave(now: number, lives: number): WaveState {
  return { zombies: [], spawned: 0, startedAt: now, lives, score: 0, kills: 0, lastHitAt: null };
}

export function totalToSpawn(opts: WaveOptions): number {
  return opts.count + (opts.boss ? 1 : 0);
}

export function zombieZ(z: Zombie, now: number): number {
  return START_Z + Math.max(0, now - z.spawnAt) / 1000 * z.speed;
}

export function sizeOf(kind: ZombieKind): number {
  return kind === 'boss' ? BOSS_SCALE : kind === 'brute' ? 1.15 : 1;
}

export function isWaveOver(state: WaveState, opts: WaveOptions): boolean {
  return state.lives <= 0 || (state.spawned >= totalToSpawn(opts) && state.zombies.length === 0);
}

/** Spawns new zombies and removes any that reached the net (each costs a life). */
export function tick(state: WaveState, opts: WaveOptions, now: number, rng: Rng): { state: WaveState; arrived: Zombie[]; spawned: Zombie[] } {
  if (isWaveOver(state, opts)) return { state, arrived: [], spawned: [] };
  const spawned: Zombie[] = [];
  let next = state;
  const due = Math.min(totalToSpawn(opts), Math.floor((now - state.startedAt) / opts.spawnEveryMs) + 1);
  while (next.spawned < due) {
    const isBoss = opts.boss && next.spawned === opts.count;
    const kind: ZombieKind = isBoss ? 'boss' : rng() < opts.bruteChance ? 'brute' : 'walker';
    const margin = ZOMBIE_HALF_WIDTH * sizeOf(kind) + 0.2;
    const zombie: Zombie = {
      id: next.spawned + 1,
      kind,
      x: isBoss ? 0 : -COURT.halfWidth + margin + rng() * (COURT.width - 2 * margin),
      spawnAt: now,
      speed: isBoss ? opts.speed[0] * 0.7 : opts.speed[0] + rng() * (opts.speed[1] - opts.speed[0]),
      hp: HP[kind],
    };
    spawned.push(zombie);
    next = { ...next, zombies: [...next.zombies, zombie], spawned: next.spawned + 1 };
  }
  const arrived = next.zombies.filter((z) => zombieZ(z, now) >= NET_Z);
  if (arrived.length) {
    next = { ...next, zombies: next.zombies.filter((z) => !arrived.includes(z)), lives: Math.max(0, next.lives - arrived.length) };
  }
  return { state: next, arrived, spawned };
}

export type ZombieHit =
  | { kind: 'hurt'; zombie: Zombie; at: { x: number; y: number; z: number } }
  | { kind: 'kill'; zombie: Zombie; points: number; at: { x: number; y: number; z: number } }
  | { kind: 'miss' };

/** The closest zombie (to the player) that the ball strikes takes the hit. */
export function applyHit(state: WaveState, opts: WaveOptions, ray: Ray, now: number): { state: WaveState; result: ZombieHit | null } {
  if (isWaveOver(state, opts)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };

  const candidates = [...state.zombies].sort((a, b) => zombieZ(b, now) - zombieZ(a, now));
  for (const z of candidates) {
    const at = intersectPlaneZ(ray, zombieZ(z, now));
    const s = sizeOf(z.kind);
    if (!at || Math.abs(at.x - z.x) > ZOMBIE_HALF_WIDTH * s || at.y < 0 || at.y > ZOMBIE_HEIGHT * s) continue;
    if (z.hp > 1) {
      const hurt = { ...z, hp: z.hp - 1 };
      return {
        state: { ...state, zombies: state.zombies.map((x) => (x === z ? hurt : x)), lastHitAt: now },
        result: { kind: 'hurt', zombie: hurt, at },
      };
    }
    const points = POINTS[z.kind];
    return {
      state: { ...state, zombies: state.zombies.filter((x) => x !== z), score: state.score + points, kills: state.kills + 1, lastHitAt: now },
      result: { kind: 'kill', zombie: z, points, at },
    };
  }
  return { state: { ...state, lastHitAt: now }, result: { kind: 'miss' } };
}
