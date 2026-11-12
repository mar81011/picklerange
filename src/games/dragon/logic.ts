// Dragon Hunt: a dragon flies over the far court. Each part of it (head,
// wings, claws, tail, belly) is worth different points. Damage to a part adds
// up until it breaks off, for a bonus. Every hit also wears down the dragon;
// knock its health to zero before the balls run out. Later dragons wear head
// armor and spit fireballs, which can be hit straight back at them.
import type { Ray, Rng, Vec3 } from '../../core/geometry';

export type PartId = 'head' | 'wingL' | 'wingR' | 'clawL' | 'clawR' | 'tail' | 'body';

/** L and R are as the player sees them (screen left and right). */
export const PART_IDS: readonly PartId[] = ['head', 'wingL', 'wingR', 'clawL', 'clawR', 'tail', 'body'];

export interface PartRule {
  label: string;
  /** Points per hit. */
  points: number;
  /** Dragon health each hit takes away. */
  damage: number;
  /** Hits until the part breaks off, or null if it can't break. */
  hp: number | null;
}

export const PARTS: Record<PartId, PartRule> = {
  head: { label: 'HEAD', points: 50, damage: 3, hp: null },
  tail: { label: 'TAIL', points: 30, damage: 2, hp: 3 },
  wingL: { label: 'WING', points: 20, damage: 2, hp: 4 },
  wingR: { label: 'WING', points: 20, damage: 2, hp: 4 },
  clawL: { label: 'CLAW', points: 20, damage: 2, hp: 3 },
  clawR: { label: 'CLAW', points: 20, damage: 2, hp: 3 },
  body: { label: 'BELLY', points: 10, damage: 1, hp: null },
};

export const POINTS = {
  /** Extra for breaking a part off. */
  break: 100,
  /** A clang off the head armor. */
  armor: 10,
  /** Hitting a fireball back into the dragon. */
  fireball: 40,
  defeat: 300,
  /** Per ball left over when the dragon goes down. */
  spareBall: 25,
};

/** Dragon health lost when a part breaks off, on top of the hit itself. */
export const BREAK_DAMAGE = 4;
export const FIREBALL_DAMAGE = 3;
/** How far a ray may pass outside a part and still count (the ball and the dragon both move). */
export const AIM_ASSIST = 0.2;
export const FIREBALL_RADIUS = 0.3;

export interface DragonOptions {
  hp: number;
  balls: number;
  /** Dragon height in meters (wingspan is about 1.25×). The camera sees only ~2 m up at the back of the court. */
  size: number;
  /** Flight speed (path radians per second). */
  speed: number;
  /** Flying time between hovers, and how long each hover lasts. Hovering is the easy moment to aim. */
  flyMs: number;
  hoverMs: number;
  /** Side-to-side reach of the flight path, from the court center. */
  width: number;
  /** Height of the dragon's feet, and how far it bobs up and down. */
  baseY: number;
  bob: number;
  /** Depth range of the flight (z, negative is away from the player). */
  near: number;
  far: number;
  /** Hits the head armor takes before head hits count (0 = no armor). */
  armor: number;
  /** Fireball spitting, or null for none. flightMs = time to reach the net. */
  fireballs: { everyMs: number; flightMs: number } | null;
  /** Each broken part makes the dragon faster. */
  rage: boolean;
  debounceMs: number;
}

export interface Fireball {
  id: number;
  from: Vec3;
  to: Vec3;
  launchedAt: number;
  flightMs: number;
}

export interface PartState {
  /** Hits left, or null for parts that can't break. */
  hp: number | null;
  broken: boolean;
}

export interface DragonState {
  hp: number;
  maxHp: number;
  parts: Record<PartId, PartState>;
  armor: number;
  ballsLeft: number;
  score: number;
  lastHitAt: number | null;
  fireballs: readonly Fireball[];
  nextFireballAt: number | null;
  nextId: number;
  breaks: number;
  defeated: boolean;
}

/** Where a part is right now, as a sphere (the screen measures it from the model). */
export interface PartTarget {
  part: PartId;
  center: Vec3;
  radius: number;
}

export type HitResult =
  | { kind: 'part'; part: PartId; at: Vec3; points: number; broke: boolean; hitsLeft: number | null; armor: 'clang' | 'broke' | null; defeated: boolean }
  | { kind: 'fireball'; fireball: Fireball; at: Vec3; points: number; defeated: boolean }
  | { kind: 'miss' };

export function createDragon(opts: DragonOptions, now: number, bonusBalls = 0): DragonState {
  const parts = {} as Record<PartId, PartState>;
  for (const id of PART_IDS) parts[id] = { hp: PARTS[id].hp, broken: false };
  return {
    hp: opts.hp,
    maxHp: opts.hp,
    parts,
    armor: opts.armor,
    ballsLeft: opts.balls + bonusBalls,
    score: 0,
    lastHitAt: null,
    fireballs: [],
    nextFireballAt: opts.fireballs ? now + opts.fireballs.everyMs : null,
    nextId: 1,
    breaks: 0,
    defeated: false,
  };
}

export function isOver(state: DragonState): boolean {
  return state.defeated || state.ballsLeft <= 0;
}

/** Hovering now? The dragon flies for flyMs, then hovers for hoverMs, over and over. */
export function isHovering(opts: DragonOptions, startedAt: number, now: number): boolean {
  const cycle = opts.flyMs + opts.hoverMs;
  return (now - startedAt) % cycle >= opts.flyMs;
}

function wingsBroken(state: DragonState): number {
  return (state.parts.wingL.broken ? 1 : 0) + (state.parts.wingR.broken ? 1 : 0);
}

/** How fast the dragon moves along its path. Broken wings slow it down; rage speeds it up. */
export function flightSpeed(state: DragonState, opts: DragonOptions): number {
  const rage = opts.rage ? 1 + 0.15 * state.breaks : 1;
  return opts.speed * rage * (1 - 0.2 * wingsBroken(state));
}

/** Position of the dragon's feet for a point along its figure-eight path. Broken wings make it fly lower. */
export function flightPosition(state: DragonState, opts: DragonOptions, phase: number): Vec3 {
  const mid = (opts.near + opts.far) / 2;
  const depth = (opts.near - opts.far) / 2;
  return {
    x: Math.sin(phase) * opts.width,
    y: Math.max(0.15, opts.baseY - 0.12 * wingsBroken(state) + Math.sin(phase * 2) * opts.bob),
    z: mid + Math.sin(phase * 0.5 + 1) * depth,
  };
}

export function fireballAt(f: Fireball, now: number): Vec3 {
  const t = Math.min(1, Math.max(0, (now - f.launchedAt) / f.flightMs));
  return {
    x: f.from.x + (f.to.x - f.from.x) * t,
    // A slight arc so it reads as thrown, not slid.
    y: f.from.y + (f.to.y - f.from.y) * t + Math.sin(Math.PI * t) * 0.5,
    z: f.from.z + (f.to.z - f.from.z) * t,
  };
}

/**
 * Advances time: spits a fireball from the mouth when one is due, and
 * reports fireballs that reached the net (each one burns a ball).
 */
export function tick(
  state: DragonState,
  opts: DragonOptions,
  now: number,
  mouth: Vec3,
  rng: Rng,
): { state: DragonState; launched: Fireball[]; burned: Fireball[] } {
  if (isOver(state)) return { state, launched: [], burned: [] };
  const burned = state.fireballs.filter((f) => now - f.launchedAt >= f.flightMs);
  let fireballs = state.fireballs.filter((f) => !burned.includes(f));
  const launched: Fireball[] = [];
  let { nextFireballAt, nextId } = state;
  if (opts.fireballs && nextFireballAt !== null && now >= nextFireballAt) {
    const rage = opts.rage ? 1 + 0.15 * state.breaks : 1;
    const fireball: Fireball = {
      id: nextId++,
      from: mouth,
      to: { x: (rng() - 0.5) * 3, y: 1 + rng() * 0.6, z: -0.6 },
      launchedAt: now,
      flightMs: opts.fireballs.flightMs / rage,
    };
    launched.push(fireball);
    fireballs = [...fireballs, fireball];
    nextFireballAt = now + opts.fireballs.everyMs / rage;
  }
  if (!burned.length && !launched.length) return { state, launched, burned };
  return {
    state: { ...state, fireballs, nextFireballAt, nextId, ballsLeft: Math.max(0, state.ballsLeft - burned.length) },
    launched,
    burned,
  };
}

/** Distance from a ray to a point (0 if the point is on it), or Infinity if the point is behind. */
export function rayDistance(ray: Ray, p: Vec3): number {
  const d = ray.dir;
  const len2 = d.x * d.x + d.y * d.y + d.z * d.z;
  const t = ((p.x - ray.origin.x) * d.x + (p.y - ray.origin.y) * d.y + (p.z - ray.origin.z) * d.z) / len2;
  if (t <= 0) return Infinity;
  return Math.hypot(ray.origin.x + d.x * t - p.x, ray.origin.y + d.y * t - p.y, ray.origin.z + d.z * t - p.z);
}

function wound(state: DragonState, damage: number, points: number): { hp: number; score: number; defeated: boolean; bonus: number } {
  const hp = Math.max(0, state.hp - damage);
  const defeated = hp === 0;
  // state has this ball spent already, so ballsLeft is the spares.
  const bonus = defeated ? POINTS.defeat + POINTS.spareBall * state.ballsLeft : 0;
  return { hp, score: state.score + points + bonus, defeated, bonus };
}

/**
 * One ball hits the wall. Fireballs are checked first (they fly in front of
 * the dragon), then the part the ray passes closest to, relative to its size.
 * Returns result null when the hit is ignored (game over or debounce).
 */
export function applyHit(
  state: DragonState,
  opts: DragonOptions,
  ray: Ray,
  targets: readonly PartTarget[],
  now: number,
): { state: DragonState; result: HitResult | null } {
  if (isOver(state)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };
  const spent = { ...state, ballsLeft: state.ballsLeft - 1, lastHitAt: now };

  const fireball = state.fireballs.find((f) => rayDistance(ray, fireballAt(f, now)) <= FIREBALL_RADIUS + AIM_ASSIST);
  if (fireball) {
    const w = wound(spent, FIREBALL_DAMAGE, POINTS.fireball);
    return {
      state: { ...spent, hp: w.hp, score: w.score, defeated: w.defeated, fireballs: state.fireballs.filter((f) => f !== fireball) },
      result: { kind: 'fireball', fireball, at: fireballAt(fireball, now), points: POINTS.fireball + w.bonus, defeated: w.defeated },
    };
  }

  let best: { target: PartTarget; score: number } | null = null;
  for (const target of targets) {
    if (state.parts[target.part].broken) continue;
    const d = rayDistance(ray, target.center);
    if (d > target.radius + AIM_ASSIST) continue;
    const score = d / target.radius;
    if (!best || score < best.score) best = { target, score };
  }
  if (!best) return { state: spent, result: { kind: 'miss' } };

  const { part, center } = best.target;
  if (part === 'head' && state.armor > 0) {
    const armor = state.armor - 1;
    const w = wound(spent, 0, POINTS.armor);
    return {
      state: { ...spent, armor, score: w.score },
      result: { kind: 'part', part, at: center, points: POINTS.armor, broke: false, hitsLeft: null, armor: armor === 0 ? 'broke' : 'clang', defeated: false },
    };
  }

  const rule = PARTS[part];
  const before = state.parts[part];
  const hitsLeft = before.hp === null ? null : before.hp - 1;
  const broke = hitsLeft === 0;
  const points = rule.points + (broke ? POINTS.break : 0);
  const w = wound(spent, rule.damage + (broke ? BREAK_DAMAGE : 0), points);
  return {
    state: {
      ...spent,
      hp: w.hp,
      score: w.score,
      defeated: w.defeated,
      breaks: state.breaks + (broke ? 1 : 0),
      parts: { ...state.parts, [part]: { hp: hitsLeft, broken: broke } },
    },
    result: { kind: 'part', part, at: center, points: points + w.bonus, broke, hitsLeft, armor: null, defeated: w.defeated },
  };
}
