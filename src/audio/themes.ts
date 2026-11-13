// Background music themes, one per game, as data. The synth (music.ts) turns
// these into a looping 4-bar song. Everything is generated, so there are no
// audio files and no licensing to worry about.

export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Theme {
  bpm: number;
  /** MIDI note of the key's root, e.g. 57 = A3. */
  root: number;
  /** Semitone steps of the scale from the root. */
  scale: readonly number[];
  /** One chord per bar, as a scale degree (0-based) the chord is built on. */
  progression: readonly number[];
  /** 16-step drum patterns per bar: x = hit, . = rest. Empty string = no part. */
  kick: string;
  snare: string;
  hat: string;
  /** Bass rhythm (16 steps): x plays the chord root, o the fifth. */
  bass: string;
  bassWave: Wave;
  /** Lead: an arpeggio over chord tones, or a seeded melody, or nothing. */
  lead: 'arp' | 'melody' | 'none';
  leadWave: Wave;
  /** Lead note length in steps and how many steps between notes. */
  leadEvery: number;
  /** Lead octave offset from the root. */
  leadOctave: number;
  /** Sustained chord pad. */
  pad: Wave | null;
  /** Swing amount 0..0.5 (shuffles off-beat 16ths). */
  swing: number;
  /** Mix volume for this theme. */
  volume: number;
  /** Seed so each theme's melody is always the same tune. */
  seed: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11];

export type ThemeId =
  | 'menu'
  | 'bullseye'
  | 'popup'
  | 'opencourt'
  | 'bricks'
  | 'zombies'
  | 'gallery'
  | 'rally'
  | 'tictactoe'
  | 'darts'
  | 'memory';

export const THEMES: Record<ThemeId, Theme> = {
  // Upbeat arcade attract loop.
  menu: {
    bpm: 122, root: 60, scale: MAJOR, progression: [0, 4, 5, 3],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x..x..x.x..x..o.', bassWave: 'square', lead: 'arp', leadWave: 'square', leadEvery: 2, leadOctave: 12,
    pad: 'sawtooth', swing: 0, volume: 0.8, seed: 1,
  },
  // Stadium anthem with big claps.
  bullseye: {
    bpm: 116, root: 55, scale: MAJOR, progression: [0, 5, 3, 4],
    kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x.......x...o...', bassWave: 'sawtooth', lead: 'melody', leadWave: 'square', leadEvery: 4, leadOctave: 12,
    pad: 'sawtooth', swing: 0, volume: 0.8, seed: 2,
  },
  // Fast neon electro.
  popup: {
    bpm: 142, root: 57, scale: MINOR, progression: [0, 5, 2, 6],
    kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx',
    bass: 'x.xxx.xxx.xxx.xo', bassWave: 'sawtooth', lead: 'arp', leadWave: 'square', leadEvery: 1, leadOctave: 12,
    pad: null, swing: 0, volume: 0.7, seed: 3,
  },
  // Sunny, relaxed park.
  opencourt: {
    bpm: 98, root: 62, scale: MAJOR, progression: [0, 3, 4, 0],
    kick: 'x.......x.x.....', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x...o...x...o...', bassWave: 'triangle', lead: 'melody', leadWave: 'triangle', leadEvery: 2, leadOctave: 12,
    pad: 'triangle', swing: 0.18, volume: 0.9, seed: 4,
  },
  // Synthwave: driving 8th bass, lush pads, arps.
  bricks: {
    bpm: 108, root: 52, scale: MINOR, progression: [0, 5, 2, 6],
    kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x.x.x.x.x.x.x.x.', bassWave: 'sawtooth', lead: 'arp', leadWave: 'sawtooth', leadEvery: 2, leadOctave: 24,
    pad: 'sawtooth', swing: 0, volume: 0.75, seed: 5,
  },
  // Spooky, sparse, minor drone.
  zombies: {
    bpm: 84, root: 45, scale: HARMONIC_MINOR, progression: [0, 0, 5, 4],
    kick: 'x.........x.....', snare: '............x...', hat: '',
    bass: 'x.......x.......', bassWave: 'sawtooth', lead: 'melody', leadWave: 'sine', leadEvery: 4, leadOctave: 24,
    pad: 'sawtooth', swing: 0, volume: 0.85, seed: 6,
  },
  // Tense, driving firing-range beat.
  gallery: {
    bpm: 128, root: 50, scale: MINOR, progression: [0, 0, 5, 6],
    kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.',
    bass: 'x..x..x.x..x..x.', bassWave: 'square', lead: 'arp', leadWave: 'square', leadEvery: 4, leadOctave: 12,
    pad: null, swing: 0, volume: 0.75, seed: 7,
  },
  // Tropical beach: marimba-like plucks.
  rally: {
    bpm: 104, root: 60, scale: MAJOR, progression: [0, 4, 5, 3],
    kick: 'x..x....x..x....', snare: '....x.......x...', hat: '..x...x...x...x.',
    bass: 'x..x..o.x..x..o.', bassWave: 'triangle', lead: 'arp', leadWave: 'sine', leadEvery: 2, leadOctave: 24,
    pad: null, swing: 0.12, volume: 0.9, seed: 8,
  },
  // Floating space ambience.
  tictactoe: {
    bpm: 88, root: 53, scale: LYDIAN, progression: [0, 1, 0, 4],
    kick: 'x.......x.......', snare: '', hat: '....x.......x...',
    bass: 'x...............', bassWave: 'sine', lead: 'arp', leadWave: 'sine', leadEvery: 3, leadOctave: 24,
    pad: 'sawtooth', swing: 0, volume: 0.9, seed: 9,
  },
  // Bluesy pub shuffle.
  darts: {
    bpm: 112, root: 55, scale: MIXOLYDIAN, progression: [0, 3, 0, 4],
    kick: 'x.....x.x.....x.', snare: '....x.......x...', hat: 'x.xx.xx.xx.xx.xx',
    bass: 'x.x.o.x.x.x.o.x.', bassWave: 'triangle', lead: 'melody', leadWave: 'square', leadEvery: 2, leadOctave: 12,
    pad: null, swing: 0.3, volume: 0.8, seed: 10,
  },
  // Calm winter bells.
  memory: {
    bpm: 94, root: 65, scale: MAJOR, progression: [0, 5, 3, 4],
    kick: 'x.......x.......', snare: '....x.......x...', hat: '',
    bass: 'x.......o.......', bassWave: 'sine', lead: 'melody', leadWave: 'sine', leadEvery: 2, leadOctave: 12,
    pad: 'triangle', swing: 0, volume: 0.9, seed: 11,
  },
};
