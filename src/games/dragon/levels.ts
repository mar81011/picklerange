import { HIT_DEBOUNCE_MS } from '../../config';
import type { LevelInfo } from '../levels';
import type { DragonOptions } from './logic';

export interface DragonLevel {
  info: LevelInfo;
  options: DragonOptions;
  /** Scale color, and the color of the belly and wing membranes. */
  colors: { main: number; secondary: number };
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
    colors: { main: 0xf07a22, secondary: 0x4a1f3a },
  },
  {
    info: { name: 'Swamp Drake', description: 'Faster swoops and shorter hovers.', ...DEFEAT },
    options: { ...BASE, hp: 26, balls: 16, speed: 0.6, flyMs: 5000, hoverMs: 3000 },
    colors: { main: 0x2fa95a, secondary: 0x16352a },
  },
  {
    info: { name: 'Iron Helm', description: 'Head armor! Break it before head hits count.', ...DEFEAT },
    options: { ...BASE, hp: 30, balls: 20, speed: 0.65, flyMs: 5000, hoverMs: 3000, armor: 3 },
    colors: { main: 0x4f7fd6, secondary: 0x1b2448 },
  },
  {
    info: { name: 'Fire Breather', description: 'Hit its fireballs back! Each one that gets through burns a ball.', ...DEFEAT },
    options: { ...BASE, hp: 34, balls: 22, speed: 0.7, flyMs: 5000, hoverMs: 2800, fireballs: { everyMs: 6500, flightMs: 3200 } },
    colors: { main: 0xd8242f, secondary: 0x2a0d12 },
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
    colors: { main: 0x7b3fd6, secondary: 0x1c0d33 },
  },
];
