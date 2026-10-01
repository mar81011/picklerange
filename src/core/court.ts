// The court, in meters. Only the far half (the "opponent's" side, beyond the
// wall) is drawn; the net line is the bottom of the projection.
//
// The court is drawn wider than regulation: a real court is nearly square
// (20 ft × 22 ft per half) but the projection wall is 16:9, so a regulation
// court leaves the sides of the wall empty. Depth and the kitchen stay real.

/** How much wider than a regulation court (20 ft) the drawn court is. */
export const COURT_WIDTH_SCALE = 1.35;

const REGULATION_WIDTH = 6.096;

export const COURT = {
  width: REGULATION_WIDTH * COURT_WIDTH_SCALE,
  halfWidth: (REGULATION_WIDTH * COURT_WIDTH_SCALE) / 2,
  /** Net to baseline: 22 ft. */
  halfLength: 6.706,
  /** Non-volley zone depth: 7 ft. */
  kitchen: 2.134,
} as const;

/** Far baseline z (the court runs from z = 0 at the net to this). */
export const BASELINE_Z = -COURT.halfLength;
/** Kitchen line z on the far side. */
export const KITCHEN_Z = -COURT.kitchen;
