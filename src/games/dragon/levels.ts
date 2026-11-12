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
  // Sizes are body height without horns. Big and close, so the parts are easy to hit.
  size: 2.55,
  speed: 0.55,
  flyMs: 4500,
  hoverMs: 3500,
  // The wingspan is about 1.5x the height; keep the wing tips on screen at the ends of the path.
  width: 1.8,
  baseY: 0.35,
  bob: 0.18,
  near: -1.7,
  far: -2.9,
  armor: 0,
  fireballs: null,
  rage: false,
  debounceMs: HIT_DEBOUNCE_MS,
};

/**
 * Tune difficulty here. Balls left when a dragon goes down carry into the
 * next level, like Brick Breaker. Each level is its own kind of dragon (look).
 */
export const DRAGON_LEVELS: readonly DragonLevel[] = [
  {
    info: { name: 'Baby Dragon', description: 'Slow, with long hovers. Aim for the head!', ...DEFEAT },
    options: { ...BASE, hp: 20, balls: 14, size: 2.35, speed: 0.4, flyMs: 4000, hoverMs: 4500, width: 1.6 },
    // Chubby, big-headed and big-eyed, with little horn nubs.
    look: { main: 0xb8501a, belly: 0xe8b874, membrane: 0x8a2f1c, horns: 'nubs', wings: 'bat', tail: 'spade', headSize: 1.8, eyeSize: 1.2, bulk: 1.15, spikes: 0.6 },
  },
  {
    info: { name: 'Swamp Drake', description: 'Faster swoops and shorter hovers.', ...DEFEAT },
    options: { ...BASE, hp: 26, balls: 16, speed: 0.6, flyMs: 5000, hoverMs: 3000 },
    // Hornless, with a webbed frill, drooping whiskers, torn wings and a finned tail.
    look: { main: 0x2f6a3a, belly: 0xc4bf78, membrane: 0x3f5a28, eyes: 0xc8ff4a, horns: 'none', frill: true, whiskers: true, wings: 'ragged', tail: 'blade' },
  },
  {
    info: { name: 'Iron Helm', description: 'Head armor! Break it before head hits count.', ...DEFEAT },
    options: { ...BASE, hp: 30, balls: 20, speed: 0.65, flyMs: 5000, hoverMs: 3000, armor: 3 },
    // Heavy-set, with curled ram horns under the helmet and a spiked club tail.
    look: { main: 0x3c5582, belly: 0xb8c4d8, membrane: 0x2c3a5e, eyes: 0x7ad8ff, horns: 'ram', wings: 'bat', tail: 'club', bulk: 1.2, spikes: 1.1 },
  },
  {
    info: { name: 'Fire Breather', description: 'Hit its fireballs back! Each one that gets through burns a ball.', ...DEFEAT },
    options: { ...BASE, hp: 34, balls: 22, speed: 0.7, flyMs: 5000, hoverMs: 2800, fireballs: { everyMs: 6500, flightMs: 3200 } },
    // Lean and spiky, with glowing lava spots and fiery wing veins.
    look: { main: 0x8e1a22, belly: 0xe09a56, membrane: 0x5c1418, eyes: 0xff7a1a, horns: 'swept', wings: 'ragged', tail: 'spade', glow: 0xff6a1a, spikes: 1.5, bulk: 0.95 },
  },
  {
    info: { name: 'Elder Dragon', description: 'The boss. Armor, fireballs, and every broken part makes it angrier!', ...DEFEAT },
    options: {
      ...BASE,
      hp: 44,
      balls: 28,
      size: 2.55,
      speed: 0.7,
      flyMs: 5500,
      hoverMs: 2600,
      width: 1.8,
      baseY: 0.3,
      armor: 4,
      fireballs: { everyMs: 6000, flightMs: 3000 },
      rage: true,
    },
    // A crown of horns, whiskers, huge wings and glowing violet markings.
    look: { main: 0x2e2244, belly: 0xa489c4, membrane: 0x4c2266, eyes: 0xd47aff, horns: 'crown', whiskers: true, wings: 'broad', tail: 'blade', glow: 0xb45aff, spikes: 1.3, bulk: 1.1 },
  },
];
