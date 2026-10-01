import type { LevelInfo } from '../levels';
import type { PopUpOptions } from './popupLogic';

export interface PopUpLevel {
  info: LevelInfo;
  settings: Pick<PopUpOptions, 'durationMs' | 'spawnEveryMs' | 'lifeMs' | 'maxActive' | 'radius' | 'bombChance'>;
}

const SECONDS = 25;

/** Tune difficulty here. Each level lasts SECONDS. */
export const POPUP_LEVELS: readonly PopUpLevel[] = [
  {
    info: { name: 'Warm-up', description: 'Big, slow targets.', target: 500 },
    settings: { durationMs: SECONDS * 1000, spawnEveryMs: 950, lifeMs: 3200, maxActive: 2, radius: 0.55, bombChance: 0 },
  },
  {
    info: { name: 'Quick Hands', description: 'More targets, less time.', target: 650 },
    settings: { durationMs: SECONDS * 1000, spawnEveryMs: 850, lifeMs: 2700, maxActive: 3, radius: 0.5, bombChance: 0 },
  },
  {
    info: { name: 'Bomb Squad', description: 'Red bombs appear. Don’t hit them!', target: 700 },
    settings: { durationMs: SECONDS * 1000, spawnEveryMs: 780, lifeMs: 2400, maxActive: 3, radius: 0.48, bombChance: 0.15 },
  },
  {
    info: { name: 'Speed Round', description: 'Faster targets, more bombs.', target: 750 },
    settings: { durationMs: SECONDS * 1000, spawnEveryMs: 680, lifeMs: 2100, maxActive: 3, radius: 0.45, bombChance: 0.2 },
  },
  {
    info: { name: 'Chaos', description: 'Small, fast, and bombs everywhere!', target: 800 },
    settings: { durationMs: SECONDS * 1000, spawnEveryMs: 600, lifeMs: 1850, maxActive: 4, radius: 0.42, bombChance: 0.25 },
  },
];
