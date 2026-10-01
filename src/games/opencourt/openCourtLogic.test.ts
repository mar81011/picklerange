import { describe, expect, it } from 'vitest';
import { BASELINE_Z, COURT, KITCHEN_Z } from '../../core/court';
import { rayThrough } from '../../core/geometry';
import {
  DEFAULT_OPEN_COURT as OPTS,
  DROP_SHOT_BONUS,
  WINNER_POINTS,
  applyHit,
  classifyShot,
  createOpenCourt,
  isRoundOver,
  nextOpponentPosition,
  type OpenCourtState,
} from './openCourtLogic';

const CAMERA = { x: 0, y: 3.4, z: 5.2 };
/** A ray that lands on the court at (x, z). */
const landAt = (x: number, z: number) => rayThrough(CAMERA, { x, y: 0, z });

const deepCenter = { x: 0, z: BASELINE_Z + 1 };

describe('classifyShot', () => {
  it('finds the landing spot where the ray meets the court', () => {
    const r = classifyShot(deepCenter, OPTS, landAt(2, -4));
    expect(r.landing?.x).toBeCloseTo(2);
    expect(r.landing?.z).toBeCloseTo(-4);
  });

  it('gives no points for a ball the opponent can reach', () => {
    const r = classifyShot(deepCenter, OPTS, landAt(0.5, deepCenter.z));
    expect(r).toMatchObject({ kind: 'returned', points: 0 });
  });

  it('scores winners more the farther they land past the reach', () => {
    const opp = { x: 0, z: -4.5 };
    expect(classifyShot(opp, OPTS, landAt(OPTS.reach + 0.5, -4.5)).points).toBe(WINNER_POINTS.tight);
    expect(classifyShot(opp, OPTS, landAt(OPTS.reach + 1.5, -4.5)).points).toBe(WINNER_POINTS.clear);
    expect(classifyShot({ x: -2.5, z: -4.5 }, OPTS, landAt(2.8, -4.5)).points).toBe(WINNER_POINTS.unreachable);
  });

  it('adds a bonus for a drop shot into the kitchen while the opponent is deep', () => {
    const r = classifyShot(deepCenter, OPTS, landAt(2.5, KITCHEN_Z + 1));
    expect(r.dropShot).toBe(true);
    expect(r.points).toBe(WINNER_POINTS.unreachable + DROP_SHOT_BONUS);

    const upAtKitchen = { x: -2, z: KITCHEN_Z - 0.6 };
    expect(classifyShot(upAtKitchen, OPTS, landAt(2.5, KITCHEN_Z + 1)).dropShot).toBe(false);
  });

  it('calls balls past the baseline or above the horizon long', () => {
    expect(classifyShot(deepCenter, OPTS, landAt(0, BASELINE_Z - 0.5))).toMatchObject({ kind: 'out', outReason: 'long' });
    const skyward = { origin: CAMERA, dir: { x: 0, y: 0.1, z: -1 } };
    expect(classifyShot(deepCenter, OPTS, skyward)).toMatchObject({ kind: 'out', outReason: 'long', landing: null });
  });

  it('calls balls past the sideline wide', () => {
    expect(classifyShot(deepCenter, OPTS, landAt(COURT.halfWidth + 0.3, -4))).toMatchObject({ kind: 'out', outReason: 'wide' });
  });
});

describe('nextOpponentPosition', () => {
  it('always stays inside the far court and behind the kitchen', () => {
    for (const r of [0, 0.3, 0.7, 0.9999]) {
      for (const landing of [null, { x: -5, z: -1 }, { x: 5, z: -6 }]) {
        const p = nextOpponentPosition(deepCenter, landing, () => r);
        expect(Math.abs(p.x)).toBeLessThan(COURT.halfWidth);
        expect(p.z).toBeGreaterThan(BASELINE_Z);
        expect(p.z).toBeLessThan(KITCHEN_Z);
      }
    }
  });

  it('drifts toward the side the last ball went to', () => {
    const right = nextOpponentPosition(deepCenter, { x: 2.5, z: -4 }, () => 0.5);
    const left = nextOpponentPosition(deepCenter, { x: -2.5, z: -4 }, () => 0.5);
    expect(right.x).toBeGreaterThan(left.x);
  });
});

describe('applyHit', () => {
  const start = (): OpenCourtState => createOpenCourt(OPTS);

  it('adds points, counts winners and moves the opponent', () => {
    const s0 = start();
    const { state, result } = applyHit(s0, OPTS, landAt(2.6, -4), 1000, () => 0.5);
    expect(result?.kind).toBe('winner');
    expect(state.score).toBe(result!.points);
    expect(state.winners).toBe(1);
    expect(state.streak).toBe(1);
    expect(state.opponent).not.toEqual(s0.opponent);
  });

  it('resets the streak on a returned or out ball', () => {
    const s = { ...start(), streak: 3, bestStreak: 3 };
    const { state } = applyHit(s, OPTS, landAt(0, s.opponent.z), 1000, () => 0.5);
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(3);
  });

  it('ignores duplicates and hits after the last ball', () => {
    const first = applyHit(start(), OPTS, landAt(2.6, -4), 1000, () => 0.5);
    expect(applyHit(first.state, OPTS, landAt(2.6, -4), 1100, () => 0.5).result).toBeNull();

    let s = start();
    for (let i = 0; i < OPTS.shots; i++) s = applyHit(s, OPTS, landAt(0, -4), i * 1000, () => 0.5).state;
    expect(isRoundOver(s)).toBe(true);
    expect(applyHit(s, OPTS, landAt(0, -4), 99_000, () => 0.5).result).toBeNull();
  });
});
