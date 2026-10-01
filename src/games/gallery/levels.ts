import type { LevelInfo } from '../levels';
import type { GalleryOptions } from './logic';

export interface GalleryLevel {
  info: LevelInfo;
  settings: Omit<GalleryOptions, 'debounceMs'>;
}

const SECONDS = 30;

/** Tune difficulty here. A steel plate is 10, a gold bonus plate 50, a NO-SHOOT plate −30. */
export const GALLERY_LEVELS: readonly GalleryLevel[] = [
  { info: { name: 'Range Day', description: 'Steel plates slide across three lanes. Ring them!', target: 80 }, settings: { durationMs: SECONDS * 1000, spawnEveryMs: 2400, speed: 1.0, size: 0.34, bonusChance: 0.1, noShootChance: 0 } },
  { info: { name: 'Quick Draw', description: 'Faster plates.', target: 100 }, settings: { durationMs: SECONDS * 1000, spawnEveryMs: 2100, speed: 1.35, size: 0.32, bonusChance: 0.1, noShootChance: 0 } },
  { info: { name: 'No-Shoots', description: 'White NO-SHOOT plates cost 30 points. Hold fire!', target: 110 }, settings: { durationMs: SECONDS * 1000, spawnEveryMs: 1900, speed: 1.5, size: 0.3, bonusChance: 0.12, noShootChance: 0.18 } },
  { info: { name: 'Speed Steel', description: 'Smaller and quicker.', target: 120 }, settings: { durationMs: SECONDS * 1000, spawnEveryMs: 1700, speed: 1.8, size: 0.28, bonusChance: 0.12, noShootChance: 0.22 } },
  { info: { name: 'Marksman', description: 'The fastest steel on the range!', target: 130 }, settings: { durationMs: SECONDS * 1000, spawnEveryMs: 1500, speed: 2.1, size: 0.27, bonusChance: 0.15, noShootChance: 0.25 } },
];
