import { describe, expect, it } from 'vitest';
import { rayThrough } from '../../core/geometry';
import {
  DEFAULT_POPUP,
  applyHit,
  createPopUp,
  isOver,
  lifeLeft,
  multiplierFor,
  radiusAt,
  tick,
  type PopTarget,
  type PopUpOptions,
  type PopUpState,
} from './popupLogic';

const OPTS: PopUpOptions = { ...DEFAULT_POPUP, area: { minX: -2.5, maxX: 2.5, minZ: -5.5, maxZ: -2 } };
const CAMERA = { x: 0, y: 3.4, z: 5.2 };
const aim = (t: PopTarget, dx = 0) => rayThrough(CAMERA, { x: t.x + dx, y: t.y, z: t.z });

function withTargets(targets: PopTarget[], now = 0): PopUpState {
  return { ...createPopUp(now), targets, nextId: targets.length + 1, lastSpawnAt: now };
}
const target = (id: number, x: number, z: number, bornAt = 0, bomb = false): PopTarget => ({ id, x, y: OPTS.centerHeight, z, bornAt, bomb });

describe('tick', () => {
  it('spawns the first target immediately, then on the spawn interval', () => {
    let { state } = tick(createPopUp(0), OPTS, 0, () => 0.5);
    expect(state.targets).toHaveLength(1);
    state = tick(state, OPTS, OPTS.spawnEveryMs - 1, () => 0.1).state;
    expect(state.targets).toHaveLength(1);
    state = tick(state, OPTS, OPTS.spawnEveryMs, () => 0.1).state;
    expect(state.targets).toHaveLength(2);
  });

  it('never exceeds the active target limit', () => {
    let state = createPopUp(0);
    const draws = [0, 0, 0.5, 0.5, 0.99, 0.99, 0.25, 0.75];
    for (let i = 0; i < 6; i++) state = tick(state, OPTS, i * OPTS.spawnEveryMs, () => draws.shift() ?? Math.random()).state;
    expect(state.targets.length).toBeLessThanOrEqual(OPTS.maxActive);
  });

  it('removes vanished targets and resets the streak', () => {
    const start = { ...withTargets([target(1, 0, -3, 0)]), streak: 4 };
    const { state, vanished } = tick(start, OPTS, OPTS.lifeMs, () => 0.5);
    expect(vanished.map((t) => t.id)).toEqual([1]);
    expect(state.targets.some((t) => t.id === 1)).toBe(false);
    expect(state.streak).toBe(0);
  });

  it('clears the court when time runs out', () => {
    const { state } = tick(withTargets([target(1, 0, -3, OPTS.durationMs - 100)]), OPTS, OPTS.durationMs, () => 0.5);
    expect(state.targets).toEqual([]);
    expect(isOver(state, OPTS, OPTS.durationMs)).toBe(true);
  });
});

describe('target size', () => {
  it('shrinks from full size to minScale over its life', () => {
    const t = target(1, 0, -3, 0);
    expect(radiusAt(t, OPTS, 0)).toBeCloseTo(OPTS.radius);
    expect(radiusAt(t, OPTS, OPTS.lifeMs)).toBeCloseTo(OPTS.radius * OPTS.minScale);
    expect(lifeLeft(t, OPTS, OPTS.lifeMs / 2)).toBeCloseTo(0.5);
  });
});

describe('applyHit', () => {
  it('scores a fresh hit at 150% of base and removes the target', () => {
    const t = target(1, 0.5, -3, 1000);
    const { state, result } = applyHit(withTargets([t], 1000), OPTS, aim(t), 1000);
    expect(result).toMatchObject({ kind: 'hit', points: 150, multiplier: 1 });
    expect(state.targets).toEqual([]);
    expect(state.hits).toBe(1);
  });

  it('pays less for a target that is about to vanish', () => {
    const t = target(1, 0.5, -3, 0);
    const { result } = applyHit(withTargets([t]), OPTS, aim(t), OPTS.lifeMs - 1);
    expect(result?.kind === 'hit' && result.points).toBe(50);
  });

  it('misses when the ball passes outside the shrunken target', () => {
    const t = target(1, 0.5, -3, 0);
    // Inside the full radius, but outside the radius after it has shrunk.
    const late = OPTS.lifeMs * 0.9;
    const { state, result } = applyHit({ ...withTargets([t]), streak: 5 }, OPTS, aim(t, OPTS.radius * 0.8), late);
    expect(result).toEqual({ kind: 'miss' });
    expect(state.streak).toBe(0);
    expect(state.targets).toHaveLength(1);
  });

  it('hits the target closest to center when targets overlap on screen', () => {
    const near = target(1, 0.3, -2.2, 0);
    const far = target(2, 0.3, -5, 0);
    const { result } = applyHit(withTargets([near, far]), OPTS, aim(far), 0);
    expect(result?.kind === 'hit' && result.target.id).toBe(2);
  });

  it('builds a multiplier from consecutive hits', () => {
    expect([0, 1, 2, 3, 5, 6, 9, 20].map(multiplierFor)).toEqual([1, 1, 1, 2, 2, 3, 4, 4]);
    const t = target(9, 0, -3, 0);
    const { state, result } = applyHit({ ...withTargets([t]), streak: 2 }, OPTS, aim(t), 0);
    expect(result).toMatchObject({ kind: 'hit', multiplier: 2, points: 300 });
    expect(state.bestStreak).toBe(3);
  });

  it('ignores duplicate detections and hits after time is up', () => {
    const t1 = target(1, -1, -3, 0);
    const t2 = target(2, 1, -3, 0);
    const first = applyHit(withTargets([t1, t2]), OPTS, aim(t1), 1000);
    expect(applyHit(first.state, OPTS, aim(t2), 1100).result).toBeNull();
    expect(applyHit(withTargets([t1]), OPTS, aim(t1), OPTS.durationMs).result).toBeNull();
  });
});

describe('bombs', () => {
  const BOMBS: PopUpOptions = { ...OPTS, bombChance: 0.3 };

  it('spawns bombs at the configured rate', () => {
    // Draws: x, z, then the bomb roll.
    const spawnWith = (roll: number) => tick(createPopUp(0), BOMBS, 0, (() => { const d = [0.5, 0.5, roll]; return () => d.shift() ?? 0.5; })()).state.targets[0];
    expect(spawnWith(0.1).bomb).toBe(true);
    expect(spawnWith(0.5).bomb).toBe(false);
  });

  it('costs points and breaks the streak when hit, never going below zero', () => {
    const bomb = target(1, 0.5, -3, 0, true);
    const { state, result } = applyHit({ ...withTargets([bomb]), score: 400, streak: 5 }, BOMBS, aim(bomb), 0);
    expect(result).toMatchObject({ kind: 'bomb', points: -BOMBS.bombPenalty });
    expect(state.score).toBe(400 - BOMBS.bombPenalty);
    expect(state.streak).toBe(0);
    expect(state.targets).toEqual([]);

    expect(applyHit({ ...withTargets([bomb]), score: 50 }, BOMBS, aim(bomb), 0).state.score).toBe(0);
  });

  it('lets a bomb fade away without breaking the streak', () => {
    const start = { ...withTargets([target(1, 0, -3, 0, true)]), streak: 4 };
    expect(tick(start, BOMBS, BOMBS.lifeMs, () => 0.5).state.streak).toBe(4);
  });
});
