import type { LevelInfo } from '../levels';

export interface OpenCourtLevel {
  info: LevelInfo;
  shots: number;
  /** How far the opponent can reach, in meters. Bigger = harder to beat. */
  reach: number;
  /** How quickly the opponent repositions after a shot (ms). */
  moveMs: number;
  /** The final opponent is drawn bigger. */
  boss: boolean;
}

/** Tune difficulty here. A winner is worth 10–40 points. */
export const OPEN_COURT_LEVELS: readonly OpenCourtLevel[] = [
  { info: { name: 'Rookie', description: 'A slow opponent with short reach.', target: 80 }, shots: 8, reach: 1.0, moveMs: 600, boss: false },
  { info: { name: 'Club Player', description: 'Reaches a bit farther.', target: 90 }, shots: 8, reach: 1.25, moveMs: 520, boss: false },
  { info: { name: 'Contender', description: 'Faster and covers more court.', target: 100 }, shots: 8, reach: 1.45, moveMs: 450, boss: false },
  { info: { name: 'Pro', description: 'Hard to get past. Use the corners and the kitchen.', target: 100 }, shots: 8, reach: 1.65, moveMs: 380, boss: false },
  { info: { name: 'The Boss', description: 'The champion. Find the open court!', target: 100 }, shots: 8, reach: 1.85, moveMs: 320, boss: true },
];
