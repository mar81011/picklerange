// Shared level types. Each game lists its levels (with the settings that make
// them harder) in its own levels.ts, so difficulty can be tuned in one place.

export interface LevelInfo {
  /** Short name shown on the level card, e.g. "Warm-up". */
  name: string;
  /** One line on what changes this level. */
  description: string;
  /** Score needed in this level to move on, or null when the goal isn't a score (e.g. clear the wall). */
  target: number | null;
  /** Shown instead of a score target when target is null. */
  goal?: string;
}
