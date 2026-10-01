// Guards against tuning mistakes that would make a level impossible.
import { describe, expect, it } from 'vitest';
import { COURT } from '../core/court';
import { BRICK_LEVELS } from './bricks/levels';
import { DEFAULT_BRICKS } from './bricks/brickLogic';
import { BULLSEYE_LEVELS } from './bullseye/levels';
import { DROP_SHOT_BONUS, WINNER_POINTS } from './opencourt/openCourtLogic';
import { OPEN_COURT_LEVELS } from './opencourt/levels';
import { POPUP_LEVELS } from './popup/levels';
import { GALLERY_LEVELS } from './gallery/levels';
import { RALLY_LEVELS } from './rally/levels';
import { ZOMBIE_LEVELS } from './zombies/levels';

describe('level tables', () => {
  it('give every game 5 levels', () => {
    for (const levels of [BULLSEYE_LEVELS, POPUP_LEVELS, OPEN_COURT_LEVELS, BRICK_LEVELS, ZOMBIE_LEVELS, GALLERY_LEVELS, RALLY_LEVELS]) {
      expect(levels).toHaveLength(5);
    }
  });

  it('never ask for more than a perfect Bullseye level can score', () => {
    for (const l of BULLSEYE_LEVELS) expect(l.info.target!).toBeLessThanOrEqual(l.shots * 50);
  });

  it('never ask for more than a perfect Open Court level can score', () => {
    const best = WINNER_POINTS.unreachable + DROP_SHOT_BONUS;
    for (const l of OPEN_COURT_LEVELS) expect(l.info.target!).toBeLessThanOrEqual(l.shots * best);
  });

  it('make Open Court harder each level', () => {
    const reaches = OPEN_COURT_LEVELS.map((l) => l.reach);
    expect([...reaches].sort((a, b) => a - b)).toEqual(reaches);
  });

  it('keep every brick wall (including its sway) on the court', () => {
    for (const l of BRICK_LEVELS) {
      const cols = Math.max(...l.settings.layout.map((r) => r.length));
      const width = cols * DEFAULT_BRICKS.brickWidth + (cols - 1) * DEFAULT_BRICKS.gap;
      expect(width / 2 + l.settings.sway.amplitude).toBeLessThanOrEqual(COURT.halfWidth);
    }
  });

  it('only use known brick characters in layouts', () => {
    for (const l of BRICK_LEVELS) for (const row of l.settings.layout) expect(row).toMatch(/^[#sgt?.]+$/);
  });

  it('keep Pop-Up levels at 20–30 seconds', () => {
    for (const l of POPUP_LEVELS) {
      expect(l.settings.durationMs).toBeGreaterThanOrEqual(20_000);
      expect(l.settings.durationMs).toBeLessThanOrEqual(30_000);
    }
  });

  it('give every level without a score target a goal to show', () => {
    const all = [ZOMBIE_LEVELS, RALLY_LEVELS, BRICK_LEVELS].flat();
    for (const l of all) if (l.info.target === null) expect(l.info.goal).toBeTruthy();
  });

  it('give every zombie wave a forward walking speed', () => {
    for (const l of ZOMBIE_LEVELS) expect(l.wave.speed[0]).toBeGreaterThan(0);
    for (const l of ZOMBIE_LEVELS) expect(l.wave.speed[1]).toBeGreaterThanOrEqual(l.wave.speed[0]);
  });
});
