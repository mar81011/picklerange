import { HIT_DEBOUNCE_MS } from '../../config';
import type { LevelInfo } from '../levels';
import type { DragonLook } from '../../engine/dragonRig';
import type { DragonOptions } from './logic';

export interface DragonLevel {
  info: LevelInfo;
  options: DragonOptions;
  /** Scale, belly and wing-membrane colors. */
  look: DragonLook;
}

const DEFEAT = { target: null, goal: 'Defeat the dragon' };

const BASE: DragonOptions = {
  hp: 30,
  balls: 15,
  size: 2.0,
  speed: 0.55,
  flyMs: 4500,
  hoverMs: 3500,
  width: 2.5,
  baseY: 0.4,
  bob: 0.2,
  near: -2.6,
  far: -3.9,
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
    options: { ...BASE, hp: 20, balls: 14, size: 1.8, speed: 0.4, flyMs: 4000, hoverMs: 4500, width: 2.1 },
    look: { main: 0xb8501a, belly: 0xe8b874, membrane: 0x8a2f1c },
  },
  {
    info: { name: 'Swamp Drake', description: 'Faster swoops and shorter hovers.', ...DEFEAT },
    options: { ...BASE, hp: 26, balls: 16, speed: 0.6, flyMs: 5000, hoverMs: 3000 },
    look: { main: 0x2f6a3a, belly: 0xc4bf78, membrane: 0x3f5a28 },
  },
  {
    info: { name: 'Iron Helm', description: 'Head armor! Break it before head hits count.', ...DEFEAT },
    options: { ...BASE, hp: 30, balls: 20, speed: 0.65, flyMs: 5000, hoverMs: 3000, armor: 3 },
    look: { main: 0x3c5582, belly: 0xb8c4d8, membrane: 0x2c3a5e },
  },
  {
    info: { name: 'Fire Breather', description: 'Hit its fireballs back! Each one that gets through burns a ball.', ...DEFEAT },
    options: { ...BASE, hp: 34, balls: 22, speed: 0.7, flyMs: 5000, hoverMs: 2800, fireballs: { everyMs: 6500, flightMs: 3200 } },
    look: { main: 0x8e1a22, belly: 0xe09a56, membrane: 0x5c1418 },
  },
  {
    info: { name: 'Elder Dragon', description: 'The boss. Armor, fireballs, and every broken part makes it angrier!', ...DEFEAT },
    options: {
      ...BASE,
      hp: 44,
      balls: 28,
      size: 2.3,
      speed: 0.7,
      flyMs: 5500,
      hoverMs: 2600,
      width: 2.6,
      baseY: 0.35,
      armor: 4,
      fireballs: { everyMs: 6000, flightMs: 3000 },
      rage: true,
    },
    look: { main: 0x2e2244, belly: 0xa489c4, membrane: 0x4c2266 },
  },
];
