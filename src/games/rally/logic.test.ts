import { describe, expect, it } from 'vitest';
import { BASELINE_Z, COURT } from '../../core/court';
import { rayThrough } from '../../core/geometry';
import { POINTS_PER_RETURN, STREAK_BONUS, applyHit, createRally, isOver, randomZone, tick, type RallyOptions } from './logic';

const OPTS: RallyOptions = { feedEveryMs: 3000, zoneRadius: 0.8, returnsNeeded: 3, debounceMs: 250 };
const CAMERA = { x: 0, y: 3.6, z: 3.6 };
const landOn = (x: number, z: number) => rayThrough(CAMERA, { x, y: 0, z });
const start = () => createRally(OPTS, 0, 3, () => 0.5);

describe('rally survival', () => {
  it('places zones fully inside the far court', () => {
    for (const r of [0, 0.9999]) {
      const z = randomZone(0.8, () => r);
      expect(Math.abs(z.x) + z.radius).toBeLessThanOrEqual(COURT.halfWidth);
      expect(z.z - z.radius).toBeGreaterThanOrEqual(BASELINE_Z);
    }
  });

  it('scores a ball landed in the zone, with a growing streak bonus', () => {
    let s = start();
    const first = applyHit(s, OPTS, landOn(s.zone.x, s.zone.z), 500);
    expect(first.result).toMatchObject({ kind: 'good', points: POINTS_PER_RETURN });
    s = tick(first.state, OPTS, 3000, () => 0.5).state;
    const second = applyHit(s, OPTS, landOn(s.zone.x, s.zone.z), 3500);
    expect(second.result).toMatchObject({ kind: 'good', points: POINTS_PER_RETURN + STREAK_BONUS });
  });

  it('costs a life for landing outside the zone, and only the first ball per feed counts', () => {
    const s = start();
    const bad = applyHit(s, OPTS, landOn(s.zone.x + 2, s.zone.z), 500);
    expect(bad.result?.kind).toBe('bad');
    expect(bad.state.lives).toBe(2);
    expect(applyHit(bad.state, OPTS, landOn(s.zone.x, s.zone.z), 1500).result).toBeNull();
  });

  it('costs a life when a feed passes without a shot', () => {
    const { state, late, newFeed } = tick(start(), OPTS, 3000, () => 0.5);
    expect(late).toBe(true);
    expect(newFeed).toBe(true);
    expect(state.lives).toBe(2);
    expect(state.feed).toBe(2);
  });

  it('clears after enough good returns and ends at zero lives', () => {
    let s = start();
    for (let i = 0; i < OPTS.returnsNeeded; i++) {
      s = applyHit(s, OPTS, landOn(s.zone.x, s.zone.z), i * 3000 + 500).state;
      s = tick(s, OPTS, (i + 1) * 3000, () => 0.5).state;
    }
    expect(isOver(s, OPTS)).toBe(true);
    expect(isOver({ ...start(), lives: 0 }, OPTS)).toBe(true);
  });
});
