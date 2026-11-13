import { describe, expect, it } from 'vitest';
import type { Ray } from '../../core/geometry';
import { POINTS, applyHit, createRound, isOver, isPassed, raySphere, targetAt, type DunkOptions } from './logic';

const CAMERA = { x: 0, y: 4, z: 6 };
/** A ray from the camera straight through a world point. */
const at = (x: number, y: number, z: number): Ray => ({ origin: CAMERA, dir: { x: x - CAMERA.x, y: y - CAMERA.y, z: z - CAMERA.z } });

const opts: DunkOptions = {
  target: { x: 2, y: 1.3, z: -3 },
  radius: 0.4,
  rim: 0.55,
  motion: { ampX: 0, ampY: 0, speed: 0 },
  clown: { center: { x: -1.3, y: 2.4, z: -4.4 }, radius: 0.5 },
  balls: 5,
  dunks: 2,
  resetMs: 3000,
  debounceMs: 100,
};

describe('dunk tank', () => {
  it('dunks when the red circle is hit', () => {
    const { state, result } = applyHit(createRound(opts), opts, at(2.1, 1.35, -3), 1000);
    expect(result?.kind).toBe('dunk');
    expect(state.dunks).toBe(1);
    expect(state.score).toBe(POINTS.dunk);
    expect(state.ballsLeft).toBe(4);
  });

  it('counts the white rim as a near miss', () => {
    const { state, result } = applyHit(createRound(opts), opts, at(2.5, 1.3, -3), 1000);
    expect(result?.kind).toBe('rim');
    expect(state.dunks).toBe(0);
    expect(state.score).toBe(POINTS.rim);
  });

  it('misses beyond the rim', () => {
    const { result } = applyHit(createRound(opts), opts, at(3, 1.3, -3), 1000);
    expect(result?.kind).toBe('miss');
  });

  it('hitting the clown scores nothing but uses a ball', () => {
    const { state, result } = applyHit(createRound(opts), opts, at(-1.3, 2.4, -4.4), 1000);
    expect(result?.kind).toBe('clown');
    expect(state.score).toBe(0);
    expect(state.ballsLeft).toBe(4);
  });

  it('ignores hits (without using a ball) while the clown climbs back up', () => {
    const first = applyHit(createRound(opts), opts, at(2, 1.3, -3), 1000).state;
    const { state, result } = applyHit(first, opts, at(2, 1.3, -3), 2000);
    expect(result?.kind).toBe('wait');
    expect(state.ballsLeft).toBe(first.ballsLeft);
    expect(state.dunks).toBe(1);
    expect(applyHit(state, opts, at(2, 1.3, -3), 4100).result?.kind).toBe('dunk');
  });

  it('debounces hits that come too close together', () => {
    const first = applyHit(createRound(opts), opts, at(3, 1.3, -3), 1000).state;
    expect(applyHit(first, opts, at(3, 1.3, -3), 1050).result).toBeNull();
  });

  it('ends as soon as the dunks are reached and pays for balls left', () => {
    let state = createRound(opts);
    state = applyHit(state, opts, at(2, 1.3, -3), 1000).state;
    state = applyHit(state, opts, at(2, 1.3, -3), 5000).state;
    expect(isPassed(state, opts)).toBe(true);
    expect(isOver(state, opts)).toBe(true);
    expect(state.score).toBe(2 * POINTS.dunk + 3 * POINTS.ballLeft);
    expect(applyHit(state, opts, at(2, 1.3, -3), 9000).result).toBeNull();
  });

  it('fails when the balls run out first', () => {
    let state = createRound(opts);
    for (let i = 0; i < 5; i++) state = applyHit(state, opts, at(3.5, 1.3, -3), 1000 + i * 500).state;
    expect(isOver(state, opts)).toBe(true);
    expect(isPassed(state, opts)).toBe(false);
  });

  it('scores a moving target where it is at the moment of the hit', () => {
    const moving = { ...opts, motion: { ampX: 1, ampY: 0, speed: 0.25 } };
    // A quarter cycle in (1 s at 0.25 Hz) the target is 1 m to the right.
    expect(targetAt(moving, 1000).x).toBeCloseTo(3);
    expect(applyHit(createRound(moving), moving, at(3, 1.3, -3), 1000).result?.kind).toBe('dunk');
    expect(applyHit(createRound(moving), moving, at(2, 1.3, -3), 1000).result?.kind).toBe('miss');
  });

  it('finds where a ray enters a sphere', () => {
    expect(raySphere({ origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 } }, { x: 0, y: 0, z: -5 }, 1)).toBeCloseTo(4);
    expect(raySphere({ origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 } }, { x: 3, y: 0, z: -5 }, 1)).toBeNull();
  });
});
