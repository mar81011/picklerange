import type { LevelInfo } from '../levels';
import type { RallyOptions } from './logic';

export interface RallyLevel {
  info: LevelInfo;
  settings: Omit<RallyOptions, 'debounceMs'>;
}

/** Lives at the start of a run; they carry from level to level. */
export const STARTING_LIVES = 3;

/**
 * Tune difficulty here. feedEveryMs should match the ball feeder's interval
 * (the game cannot control the feeder yet, so set the feeder to this pace).
 */
export const RALLY_LEVELS: readonly RallyLevel[] = [
  { info: { name: 'Warm-up Rally', description: 'Land each ball in the glowing zone.', target: null, goal: '6 good returns' }, settings: { feedEveryMs: 4000, zoneRadius: 1.0, returnsNeeded: 6 } },
  { info: { name: 'Steady', description: 'A slightly faster pace.', target: null, goal: '8 good returns' }, settings: { feedEveryMs: 3500, zoneRadius: 0.9, returnsNeeded: 8 } },
  { info: { name: 'Pressure', description: 'Smaller zones.', target: null, goal: '10 good returns' }, settings: { feedEveryMs: 3200, zoneRadius: 0.75, returnsNeeded: 10 } },
  { info: { name: 'Tournament', description: 'Faster feeds, smaller zones.', target: null, goal: '10 good returns' }, settings: { feedEveryMs: 2800, zoneRadius: 0.65, returnsNeeded: 10 } },
  { info: { name: 'Marathon', description: 'Twelve in a row-ish. Don’t crack!', target: null, goal: '12 good returns' }, settings: { feedEveryMs: 2600, zoneRadius: 0.6, returnsNeeded: 12 } },
];
