import type { LevelInfo } from '../levels';
import type { DunkOptions } from './logic';

export interface DunkLevel {
  info: LevelInfo;
  settings: Pick<DunkOptions, 'radius' | 'motion' | 'balls' | 'dunks'>;
}

const goal = (n: number) => ({ target: null, goal: `Dunk the clown ${n} times` });

/** Tune difficulty here. Rim = red radius + RIM_WIDTH. */
export const RIM_WIDTH = 0.14;

export const DUNK_LEVELS: readonly DunkLevel[] = [
  {
    info: { name: 'Warm-Up', description: 'A big, still target. Hit the red circle!', ...goal(2) },
    settings: { radius: 0.42, motion: { ampX: 0, ampY: 0, speed: 0 }, balls: 10, dunks: 2 },
  },
  {
    info: { name: 'Smaller Circle', description: 'The red circle shrinks.', ...goal(3) },
    settings: { radius: 0.32, motion: { ampX: 0, ampY: 0, speed: 0 }, balls: 10, dunks: 3 },
  },
  {
    info: { name: 'On the Move', description: 'The target slides along its rail.', ...goal(3) },
    settings: { radius: 0.36, motion: { ampX: 0.75, ampY: 0, speed: 0.22 }, balls: 12, dunks: 3 },
  },
  {
    info: { name: 'Slippery', description: 'Faster, smaller, and it bobs!', ...goal(3) },
    settings: { radius: 0.3, motion: { ampX: 0.9, ampY: 0.15, speed: 0.32 }, balls: 12, dunks: 3 },
  },
  {
    info: { name: 'Big Top Finale', description: 'Tiny and quick. Soak that clown!', ...goal(4) },
    settings: { radius: 0.26, motion: { ampX: 1.0, ampY: 0.2, speed: 0.42 }, balls: 14, dunks: 4 },
  },
];
