import { describe, expect, it } from 'vitest';
import { rayThrough, type Ray } from '../../core/geometry';
import {
  DEFAULT_RINGS,
  STILL,
  accuracy,
  applyHit,
  createRound,
  isRoundOver,
  placeTarget,
  scaleRings,
  scoreAt,
  targetPositionAt,
  type BullseyeOptions,
  type BullseyeState,
  type Target,
} from './bullseyeLogic';

const OPTS: BullseyeOptions = {
  area: { minX: -2.5, maxX: 2.5, minZ: -5.5, maxZ: -2 },
  centerHeight: 0.8,
  shots: 3,
  rings: DEFAULT_RINGS,
  motion: STILL,
  debounceMs: 250,
};
const CAMERA = { x: 0, y: 3.4, z: 5.2 };
const center = () => 0.5;

function aimAt(target: Target, dx = 0, dy = 0): Ray {
  return rayThrough(CAMERA, { x: target.x + dx, y: target.y + dy, z: target.z });
}

function stateWithTarget(target: Target): BullseyeState {
  return { ...createRound(OPTS, center), target };
}

const T: Target = { x: 0.5, y: 0.8, z: -3, motion: STILL, phase: 0 };

describe('scoreAt', () => {
  it('scores each ring by distance from center', () => {
    expect(scoreAt(T, DEFAULT_RINGS, 0.5, 0.8)).toEqual({ points: 50, ringIndex: 0 });
    expect(scoreAt(T, DEFAULT_RINGS, 0.5 + 0.2, 0.8)).toEqual({ points: 25, ringIndex: 1 });
    expect(scoreAt(T, DEFAULT_RINGS, 0.5, 0.8 + 0.35)).toEqual({ points: 10, ringIndex: 2 });
    expect(scoreAt(T, DEFAULT_RINGS, 0.5 + 0.5, 0.8)).toEqual({ points: 5, ringIndex: 3 });
  });

  it('counts a hit exactly on a ring edge as inside that ring', () => {
    expect(scoreAt(T, DEFAULT_RINGS, 0.5 + 0.14, 0.8).points).toBe(50);
  });

  it('scores zero outside the outer ring', () => {
    expect(scoreAt(T, DEFAULT_RINGS, 0.5 + 0.57, 0.8)).toEqual({ points: 0, ringIndex: null });
  });
});

describe('placeTarget', () => {
  it('keeps the whole target inside the area', () => {
    for (const r of [0, 0.25, 0.5, 0.9999]) {
      const t = placeTarget(OPTS, () => r);
      expect(t.x).toBeGreaterThanOrEqual(OPTS.area.minX + 0.56);
      expect(t.x).toBeLessThanOrEqual(OPTS.area.maxX - 0.56);
      expect(t.z).toBeGreaterThanOrEqual(OPTS.area.minZ);
      expect(t.z).toBeLessThanOrEqual(OPTS.area.maxZ);
      expect(t.y).toBe(OPTS.centerHeight);
    }
  });
});

describe('applyHit', () => {
  it('scores a ray through the center as a bullseye', () => {
    const { state, result } = applyHit(stateWithTarget(T), OPTS, aimAt(T), 1000, center);
    expect(result).toMatchObject({ outcome: 'ring', points: 50, ringIndex: 0 });
    expect(result?.at?.z).toBeCloseTo(T.z);
    expect(state.score).toBe(50);
    expect(state.shotsLeft).toBe(2);
  });

  it('scores by where the ray crosses the target plane, not the screen', () => {
    const { result } = applyHit(stateWithTarget(T), OPTS, aimAt(T, 0.2, 0), 1000, center);
    expect(result?.points).toBe(25);
  });

  it('counts a miss as a used shot with no points', () => {
    const { state, result } = applyHit(stateWithTarget(T), OPTS, aimAt(T, 2, 0), 1000, center);
    expect(result?.outcome).toBe('miss');
    expect(state.shotsLeft).toBe(2);
  });

  it('treats a ray that never reaches the target plane as a miss', () => {
    const away: Ray = { origin: CAMERA, dir: { x: 0, y: 0, z: 1 } };
    const { result } = applyHit(stateWithTarget(T), OPTS, away, 1000, center);
    expect(result).toMatchObject({ outcome: 'miss', at: null });
  });

  it('ignores a duplicate detection inside the debounce window', () => {
    const first = applyHit(stateWithTarget(T), OPTS, aimAt(T), 1000, center);
    const dup = applyHit(first.state, OPTS, aimAt(first.state.target), 1100, center);
    expect(dup.result).toBeNull();
    expect(dup.state).toBe(first.state);
    expect(applyHit(first.state, OPTS, aimAt(first.state.target), 1250, center).result).not.toBeNull();
  });

  it('tracks accuracy as the share of shots that hit the target', () => {
    let state = stateWithTarget(T);
    expect(accuracy(state)).toBe(0);
    state = applyHit(state, OPTS, aimAt(state.target), 0, center).state;
    state = applyHit(state, OPTS, aimAt(state.target, 3, 0), 1000, center).state;
    expect(accuracy(state)).toBe(0.5);
  });

  it('ends the round after the last shot and ignores further hits', () => {
    let state = stateWithTarget(T);
    for (let i = 0; i < OPTS.shots; i++) state = applyHit(state, OPTS, aimAt(state.target), i * 1000, center).state;
    expect(isRoundOver(state)).toBe(true);
    expect(state.score).toBe(150);
    expect(applyHit(state, OPTS, aimAt(state.target), 99_000, center).result).toBeNull();
  });
});

describe('moving targets', () => {
  const sway = { ampX: 1, ampY: 0.2, speed: 0.5 };
  const moving: Target = { ...T, x: 0, motion: sway, phase: 0 };

  it('slides side to side around its home spot over time', () => {
    expect(targetPositionAt(moving, 0).x).toBeCloseTo(0);
    // speed 0.5 cycles/s: a quarter cycle is 500 ms, the far edge of the sway.
    expect(targetPositionAt(moving, 500).x).toBeCloseTo(1);
    expect(targetPositionAt(moving, 1500).x).toBeCloseTo(-1);
  });

  it('scores against where the target is at the moment of the hit', () => {
    const state = stateWithTarget(moving);
    const whereItIs = targetPositionAt(moving, 500);
    const aimed = rayThrough(CAMERA, whereItIs);
    expect(applyHit(state, { ...OPTS, motion: sway }, aimed, 500, center).result?.points).toBe(50);
    // The same shot half a second later finds the target gone.
    expect(applyHit(state, { ...OPTS, motion: sway }, aimed, 1500, center).result?.outcome).toBe('miss');
  });

  it('keeps the whole sway inside the area', () => {
    const opts = { ...OPTS, motion: sway };
    for (const r of [0, 0.9999]) {
      const t = placeTarget(opts, () => r);
      expect(t.x - sway.ampX - 0.56).toBeGreaterThanOrEqual(OPTS.area.minX - 1e-9);
      expect(t.x + sway.ampX + 0.56).toBeLessThanOrEqual(OPTS.area.maxX + 1e-9);
    }
  });

  it('centers the target if the area is too narrow for its sway', () => {
    const opts = { ...OPTS, area: { ...OPTS.area, minX: 1, maxX: 2 }, motion: sway };
    expect(placeTarget(opts, () => 0.9).x).toBeCloseTo(1.5);
  });
});

describe('scaleRings', () => {
  it('shrinks every ring and keeps the points', () => {
    const half = scaleRings(DEFAULT_RINGS, 0.5);
    expect(half.map((r) => r.radius)).toEqual(DEFAULT_RINGS.map((r) => r.radius / 2));
    expect(half.map((r) => r.points)).toEqual(DEFAULT_RINGS.map((r) => r.points));
  });
});
