import type { LevelInfo } from '../levels';
import type { WaveOptions } from './logic';

export interface ZombieLevel {
  info: LevelInfo;
  wave: Omit<WaveOptions, 'debounceMs'>;
}

/** Lives at the start of a run; they carry from wave to wave. */
export const STARTING_LIVES = 5;
const SURVIVE = { target: null, goal: 'Survive the wave' };

/** Tune difficulty here. Speeds are m/s; the court is about 6.7 m deep. */
export const ZOMBIE_LEVELS: readonly ZombieLevel[] = [
  { info: { name: 'First Night', description: 'A few slow zombies. Hit them before they reach the net!', ...SURVIVE }, wave: { count: 6, spawnEveryMs: 2600, speed: [0.45, 0.6], bruteChance: 0, boss: false } },
  { info: { name: 'They Keep Coming', description: 'More zombies, a little faster.', ...SURVIVE }, wave: { count: 9, spawnEveryMs: 2200, speed: [0.5, 0.7], bruteChance: 0, boss: false } },
  { info: { name: 'Brutes', description: 'Big brutes take 2 hits.', ...SURVIVE }, wave: { count: 11, spawnEveryMs: 2000, speed: [0.55, 0.8], bruteChance: 0.25, boss: false } },
  { info: { name: 'The Horde', description: 'Fast and many. Stay calm!', ...SURVIVE }, wave: { count: 14, spawnEveryMs: 1700, speed: [0.65, 0.95], bruteChance: 0.3, boss: false } },
  { info: { name: 'The Boss', description: 'Survive the horde, then take down the giant (5 hits)!', ...SURVIVE }, wave: { count: 12, spawnEveryMs: 1700, speed: [0.65, 0.95], bruteChance: 0.3, boss: true } },
];
