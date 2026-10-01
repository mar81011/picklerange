import type { LevelInfo } from '../levels';
import type { BrickOptions } from './brickLogic';

export interface BrickLevel {
  info: LevelInfo;
  settings: Pick<BrickOptions, 'layout' | 'balls' | 'sway' | 'silverChance' | 'goldChance' | 'bombChance'>;
}

const STILL = { amplitude: 0, speed: 0 };
const NONE = { silverChance: 0, goldChance: 0, bombChance: 0 };
const CLEAR_THE_WALL = { target: null, goal: 'Clear the whole wall' };

/**
 * Tune difficulty here. Layouts are drawn top row first:
 *   # normal   s silver (2 hits)   g gold (3 hits)   t TNT   ? random   . gap
 * Balls left over when a wall is cleared carry into the next level.
 */
export const BRICK_LEVELS: readonly BrickLevel[] = [
  {
    info: { name: 'Warm-up', description: 'A small, plain wall.', ...CLEAR_THE_WALL },
    settings: { ...NONE, sway: STILL, balls: 10, layout: ['######', '######', '######'] },
  },
  {
    info: { name: 'Pyramid', description: 'Silver bricks take 2 hits. TNT helps!', ...CLEAR_THE_WALL },
    settings: { ...NONE, sway: STILL, balls: 10, layout: ['...ss...', '..####..', '.##tt##.', '########'] },
  },
  {
    info: { name: 'Fortress', description: 'Gold bricks take 3 hits.', ...CLEAR_THE_WALL },
    settings: { ...NONE, sway: STILL, balls: 12, layout: ['s#g#g#s', '##s#s##', '#t###t#', 's#####s', '#######'] },
  },
  {
    info: { name: 'Gold Rush', description: 'Almost all gold and silver. Find the TNT!', ...CLEAR_THE_WALL },
    settings: { ...NONE, sway: STILL, balls: 14, layout: ['gsgsgsgs', 's######s', 'g#t##t#g', 's######s', 'gsgsgsgs'] },
  },
  {
    info: { name: 'Moving Wall', description: 'A surprise wall that slides side to side!', ...CLEAR_THE_WALL },
    settings: {
      silverChance: 0.18,
      goldChance: 0.1,
      bombChance: 0.07,
      sway: { amplitude: 0.65, speed: 0.12 },
      balls: 14,
      layout: ['???????', '???????', '???????', '???????', '???????'],
    },
  },
];
