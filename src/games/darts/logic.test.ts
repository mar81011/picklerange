import { describe, expect, it } from 'vitest';
import { RINGS, applyDart, createDarts, scoreAt, type Dart, type DartsState } from './logic';

const R = 1;
/** Point at fraction `r` of the radius, at the center of the sector `index` places clockwise from the top. */
const polar = (r: number, sectorIndex: number) => {
  const a = (sectorIndex * Math.PI) / 10;
  return [Math.sin(a) * r, Math.cos(a) * r] as const;
};
const dart = (points: number): Dart => ({ sector: points, multiplier: 1, points, label: String(points) });

describe('scoreAt', () => {
  it('scores the bull and outer bull', () => {
    expect(scoreAt(0, 0, R)).toMatchObject({ points: 50, label: 'BULLSEYE' });
    expect(scoreAt(0, 0.12, R).points).toBe(25);
  });

  it('uses the standard sector order clockwise from 20 at the top', () => {
    expect(scoreAt(...polar(0.4, 0), R)).toMatchObject({ sector: 20, points: 20 });
    expect(scoreAt(...polar(0.4, 1), R).sector).toBe(1);
    expect(scoreAt(...polar(0.4, 5), R).sector).toBe(6); // right
    expect(scoreAt(...polar(0.4, 10), R).sector).toBe(3); // bottom
    expect(scoreAt(...polar(0.4, 15), R).sector).toBe(11); // left
  });

  it('triples and doubles in their rings', () => {
    const mid = (RINGS.tripleIn + RINGS.tripleOut) / 2;
    expect(scoreAt(...polar(mid, 0), R)).toMatchObject({ multiplier: 3, points: 60, label: 'TRIPLE 20' });
    expect(scoreAt(...polar(0.93, 0), R)).toMatchObject({ multiplier: 2, points: 40, label: 'DOUBLE 20' });
  });

  it('misses outside the board', () => {
    expect(scoreAt(0, 1.01, R)).toMatchObject({ points: 0, label: 'MISS' });
  });
});

describe('301', () => {
  it('counts down and passes the turn after three darts', () => {
    let s = createDarts(2);
    for (const p of [20, 20]) {
      const r = applyDart(s, dart(p));
      expect(r.turnOver).toBe(false);
      s = r.state;
    }
    const r = applyDart(s, dart(20));
    expect(r.turnOver).toBe(true);
    expect(r.state.scores).toEqual([241, 301]);
    expect(r.state.turn).toBe(1);
  });

  it('undoes the whole turn on a bust', () => {
    let s: DartsState = { ...createDarts(2), scores: [40, 301], turnStart: 40 };
    s = applyDart(s, dart(20)).state; // 20 left
    const r = applyDart(s, dart(25)); // would go below zero
    expect(r.outcome).toBe('bust');
    expect(r.state.scores[0]).toBe(40);
    expect(r.state.turn).toBe(1);
  });

  it('wins on exactly zero', () => {
    const s = { ...createDarts(3), scores: [301, 50, 301], turn: 1, turnStart: 50 };
    const r = applyDart(s, dart(50));
    expect(r.outcome).toBe('win');
    expect(r.state.winner).toBe(1);
    expect(applyDart(r.state, dart(20)).state).toBe(r.state);
  });

  it('wraps turns around all players', () => {
    let s = createDarts(3);
    for (let i = 0; i < 9; i++) s = applyDart(s, dart(1)).state;
    expect(s.turn).toBe(0);
    expect(s.scores).toEqual([298, 298, 298]);
  });
});
