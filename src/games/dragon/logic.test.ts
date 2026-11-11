import { describe, expect, it } from 'vitest';
import { rayThrough, type Vec3 } from '../../core/geometry';
import { DRAGON_LEVELS } from './levels';
import {
  BREAK_DAMAGE,
  FIREBALL_DAMAGE,
  PARTS,
  POINTS,
  applyHit,
  createDragon,
  fireballAt,
  flightPosition,
  flightSpeed,
  isHovering,
  isOver,
  rayDistance,
  tick,
  type DragonOptions,
  type PartTarget,
} from './logic';

const opts: DragonOptions = { ...DRAGON_LEVELS[0].options, debounceMs: 0 };
const EYE: Vec3 = { x: 0, y: 3, z: 9 };
const TARGETS: PartTarget[] = [
  { part: 'head', center: { x: 0, y: 2, z: -5 }, radius: 0.3 },
  { part: 'body', center: { x: 0, y: 1.2, z: -5 }, radius: 0.4 },
  { part: 'wingL', center: { x: -1, y: 1.6, z: -5 }, radius: 0.4 },
  { part: 'tail', center: { x: 0, y: 0.6, z: -5 }, radius: 0.25 },
];
const at = (p: Vec3) => rayThrough(EYE, p);

describe('dragon hits', () => {
  it('scores the part the ball hits and spends a ball', () => {
    const s = createDragon(opts, 0);
    const { state, result } = applyHit(s, opts, at({ x: 0, y: 2, z: -5 }), TARGETS, 0);
    expect(result).toMatchObject({ kind: 'part', part: 'head', points: PARTS.head.points });
    expect(state.hp).toBe(s.hp - PARTS.head.damage);
    expect(state.ballsLeft).toBe(s.ballsLeft - 1);
  });

  it('misses when the ray passes no part, still spending the ball', () => {
    const s = createDragon(opts, 0);
    const { state, result } = applyHit(s, opts, at({ x: 3, y: 3, z: -5 }), TARGETS, 0);
    expect(result).toEqual({ kind: 'miss' });
    expect(state.ballsLeft).toBe(s.ballsLeft - 1);
    expect(state.score).toBe(0);
  });

  it('picks the part the ray is most centered on when spheres overlap', () => {
    const s = createDragon(opts, 0);
    // Just inside the body's top edge, well outside the head's center.
    const { result } = applyHit(s, opts, at({ x: 0, y: 1.5, z: -5 }), TARGETS, 0);
    expect(result).toMatchObject({ part: 'body' });
  });

  it('breaks a part after enough hits, for a bonus and extra damage', () => {
    let s = createDragon(opts, 0);
    const hits = PARTS.wingL.hp!;
    let last;
    for (let i = 0; i < hits; i++) ({ state: s, result: last } = applyHit(s, opts, at({ x: -1, y: 1.6, z: -5 }), TARGETS, i));
    expect(last).toMatchObject({ kind: 'part', part: 'wingL', broke: true, points: PARTS.wingL.points + POINTS.break });
    expect(s.parts.wingL.broken).toBe(true);
    expect(s.breaks).toBe(1);
    expect(s.hp).toBe(opts.hp - hits * PARTS.wingL.damage - BREAK_DAMAGE);
    // A broken part can't be hit again.
    const again = applyHit(s, opts, at({ x: -1, y: 1.6, z: -5 }), TARGETS, 99).result;
    expect(again).toEqual({ kind: 'miss' });
  });

  it('head armor soaks hits until it breaks', () => {
    const armored = { ...opts, armor: 2 };
    let s = createDragon(armored, 0);
    const head = at({ x: 0, y: 2, z: -5 });
    let r = applyHit(s, armored, head, TARGETS, 0);
    expect(r.result).toMatchObject({ armor: 'clang', points: POINTS.armor });
    expect(r.state.hp).toBe(s.hp);
    s = r.state;
    r = applyHit(s, armored, head, TARGETS, 1);
    expect(r.result).toMatchObject({ armor: 'broke' });
    r = applyHit(r.state, armored, head, TARGETS, 2);
    expect(r.result).toMatchObject({ armor: null, points: PARTS.head.points });
  });

  it('defeats the dragon at zero health with a bonus for spare balls', () => {
    const s = { ...createDragon(opts, 0), hp: 2 };
    const { state, result } = applyHit(s, opts, at({ x: 0, y: 2, z: -5 }), TARGETS, 0);
    expect(state.defeated).toBe(true);
    expect(isOver(state)).toBe(true);
    const spare = s.ballsLeft - 1;
    expect(result).toMatchObject({ defeated: true, points: PARTS.head.points + POINTS.defeat + POINTS.spareBall * spare });
    expect(state.score).toBe(PARTS.head.points + POINTS.defeat + POINTS.spareBall * spare);
  });

  it('ignores hits inside the debounce window and after the game ends', () => {
    const slow = { ...opts, debounceMs: 250 };
    const s = applyHit(createDragon(slow, 0), slow, at({ x: 0, y: 2, z: -5 }), TARGETS, 1000).state;
    expect(applyHit(s, slow, at({ x: 0, y: 2, z: -5 }), TARGETS, 1100).result).toBeNull();
    expect(applyHit({ ...s, ballsLeft: 0 }, slow, at({ x: 0, y: 2, z: -5 }), TARGETS, 5000).result).toBeNull();
  });
});

describe('fireballs', () => {
  const fiery: DragonOptions = { ...opts, fireballs: { everyMs: 1000, flightMs: 2000 } };
  const mouth = { x: 0, y: 2, z: -5 };

  it('launches on schedule and burns a ball when one reaches the net', () => {
    let s = createDragon(fiery, 0);
    let t = tick(s, fiery, 500, mouth, () => 0.5);
    expect(t.launched).toHaveLength(0);
    t = tick(s, fiery, 1000, mouth, () => 0.5);
    expect(t.launched).toHaveLength(1);
    s = t.state;
    t = tick(s, fiery, 3000, mouth, () => 0.5);
    expect(t.burned).toHaveLength(1);
    expect(t.state.ballsLeft).toBe(s.ballsLeft - 1);
  });

  it('can be hit back for points and damage, ahead of the dragon behind it', () => {
    let s = createDragon(fiery, 0);
    s = tick(s, fiery, 1000, mouth, () => 0.5).state;
    const where = fireballAt(s.fireballs[0], 2000);
    const { state, result } = applyHit(s, fiery, at(where), TARGETS, 2000);
    expect(result).toMatchObject({ kind: 'fireball', points: POINTS.fireball });
    expect(state.fireballs).toHaveLength(0);
    expect(state.hp).toBe(s.hp - FIREBALL_DAMAGE);
  });
});

describe('flight', () => {
  it('alternates flying and hovering', () => {
    expect(isHovering(opts, 0, opts.flyMs - 1)).toBe(false);
    expect(isHovering(opts, 0, opts.flyMs + 1)).toBe(true);
    expect(isHovering(opts, 0, opts.flyMs + opts.hoverMs + 1)).toBe(false);
  });

  it('stays over the far court', () => {
    const s = createDragon(opts, 0);
    for (let phase = 0; phase < 20; phase += 0.3) {
      const p = flightPosition(s, opts, phase);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(opts.width);
      expect(p.z).toBeLessThanOrEqual(opts.near + 1e-9);
      expect(p.z).toBeGreaterThanOrEqual(opts.far - 1e-9);
    }
  });

  it('flies lower and slower with a broken wing, faster when enraged', () => {
    const s = createDragon(opts, 0);
    const hurt = { ...s, parts: { ...s.parts, wingL: { hp: 0, broken: true } } };
    expect(flightPosition(hurt, opts, 0).y).toBeLessThan(flightPosition(s, opts, 0).y);
    expect(flightSpeed(hurt, opts)).toBeLessThan(flightSpeed(s, opts));
    const raging = { ...opts, rage: true };
    expect(flightSpeed({ ...s, breaks: 2 }, raging)).toBeGreaterThan(flightSpeed(s, raging));
  });

  it('measures ray distance and ignores points behind the camera', () => {
    const ray = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 } };
    expect(rayDistance(ray, { x: 0.5, y: 0, z: -3 })).toBeCloseTo(0.5);
    expect(rayDistance(ray, { x: 0, y: 0, z: 3 })).toBe(Infinity);
  });
});

describe('levels', () => {
  it('has five levels that get harder', () => {
    expect(DRAGON_LEVELS).toHaveLength(5);
    expect(DRAGON_LEVELS[4].options.hp).toBeGreaterThan(DRAGON_LEVELS[0].options.hp);
  });

  it('can always be won with perfect play (head shots after the armor)', () => {
    for (const { options: o } of DRAGON_LEVELS) expect((o.balls - o.armor) * PARTS.head.damage).toBeGreaterThanOrEqual(o.hp * 1.5);
  });
});
