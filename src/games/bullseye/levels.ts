import type { LevelInfo } from '../levels';
import { DEFAULT_RINGS, STILL, scaleRings, type Motion, type Ring } from './bullseyeLogic';

export interface BullseyeLevel {
  info: LevelInfo;
  shots: number;
  rings: readonly Ring[];
  motion: Motion;
}

/** Tune difficulty here. Max per level is shots × 50. */
export const BULLSEYE_LEVELS: readonly BullseyeLevel[] = [
  { info: { name: 'Warm-up', description: 'Standing targets. Find your aim.', target: 100 }, shots: 6, rings: DEFAULT_RINGS, motion: STILL },
  { info: { name: 'Sharpshooter', description: 'Smaller targets.', target: 100 }, shots: 6, rings: scaleRings(DEFAULT_RINGS, 0.8), motion: STILL },
  { info: { name: 'On the Move', description: 'Targets slide side to side!', target: 90 }, shots: 6, rings: DEFAULT_RINGS, motion: { ampX: 0.6, ampY: 0, speed: 0.2 } },
  { info: { name: 'Fast Lane', description: 'Smaller and faster.', target: 90 }, shots: 6, rings: scaleRings(DEFAULT_RINGS, 0.85), motion: { ampX: 0.9, ampY: 0, speed: 0.26 } },
  { info: { name: 'Bullseye Master', description: 'Small, fast, and bobbing up and down!', target: 80 }, shots: 6, rings: scaleRings(DEFAULT_RINGS, 0.75), motion: { ampX: 1.1, ampY: 0.15, speed: 0.3 } },
];
