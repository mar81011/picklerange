import { HIT_DEBOUNCE_MS } from '../../config';
import type { LevelInfo } from '../levels';
import type { DragonOptions } from './logic';

export interface DragonLevel {
  info: LevelInfo;
  options: DragonOptions;
  /** Multiplies the model's colors so each dragon looks different. */
  tint: number;
}

const DEFEAT = { target: null, goal: 'Defeat the dragon' };

const BASE: DragonOptions = {
  hp: 30,
  balls: 15,
  size: 1.8,
  speed: 0.55,
  flyMs: 4500,
  hoverMs: 3500,
  width: 2.5,
  baseY: 0.4,
  bob: 0.2,
  near: -2.6,
  far: -4.2,
  armor: 0,
  fireballs: null,
  rage: false,
  debounceMs: HIT_DEBOUNCE_MS,
};

/**
 * Tune difficulty here. Balls left when a dragon goes down carry into the
 * next level, like Brick Breaker.
 */
export const DRAGON_LEVELS: readonly DragonLevel[] = [
  {
    info: { name: 'Baby Dragon', description: 'Slow, with long hovers. Aim for the head!', ...DEFEAT },
    options: { ...BASE, hp: 20, balls: 14, size: 1.6, speed: 0.4, flyMs: 4000, hoverMs: 4500, width: 2.1 },
    tint: 0xffffff,
  },
  {
    info: { name: 'Swamp Drake', description: 'Faster swoops and shorter hovers.', ...DEFEAT },
    options: { ...BASE, hp: 26, balls: 16, speed: 0.6, flyMs: 5000, hoverMs: 3000 },
    tint: 0xa8ff9a,
  },
  {
    info: { name: 'Iron Helm', description: 'Head armor! Break it before head hits count.', ...DEFEAT },
    options: { ...BASE, hp: 30, balls: 20, speed: 0.65, flyMs: 5000, hoverMs: 3000, armor: 3 },
    tint: 0xb8c8ff,
  },
  {
    info: { name: 'Fire Breather', description: 'Hit its fireballs back! Each one that gets through burns a ball.', ...DEFEAT },
    options: { ...BASE, hp: 34, balls: 22, speed: 0.7, flyMs: 5000, hoverMs: 2800, fireballs: { everyMs: 6500, flightMs: 3200 } },
    tint: 0xff8a7a,
  },
  {
    info: { name: 'Elder Dragon', description: 'The boss. Armor, fireballs, and every broken part makes it angrier!', ...DEFEAT },
    options: {
      ...BASE,
      hp: 44,
      balls: 28,
      size: 2.1,
      speed: 0.7,
      flyMs: 5500,
      hoverMs: 2600,
      width: 2.6,
      baseY: 0.35,
      armor: 4,
      fireballs: { everyMs: 6000, flightMs: 3000 },
      rage: true,
    },
    tint: 0xd09cff,
  },
];
