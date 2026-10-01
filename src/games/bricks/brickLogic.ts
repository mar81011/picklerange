// Brick Breaker: a wall of bricks stands on the court. Each ball smashes the
// bricks around where it hits. Silver bricks take two hits, gold take three; bomb bricks blow
// up their neighbors (and can chain). Clear the wall before the balls run out.
// Each level supplies its own wall layout, and the wall can sway side to side.
import { intersectPlaneZ, type Ray, type Rng } from '../../core/geometry';

export interface BrickOptions {
  /**
   * The wall, top row first. One character per brick:
   *   # normal   s silver (2 hits)   g gold (3 hits)   t TNT
   *   ? random (by the chances below)   . gap
   */
  layout: readonly string[];
  brickWidth: number;
  brickHeight: number;
  gap: number;
  /** Depth of the wall face. */
  wallZ: number;
  /** Height of the bottom row's lower edge. */
  baseY: number;
  /** Bricks whose face is within this distance of the impact are hit. */
  blastRadius: number;
  balls: number;
  silverChance: number;
  goldChance: number;
  bombChance: number;
  /** Side-to-side movement of the whole wall. */
  sway: { amplitude: number; speed: number };
  debounceMs: number;
}

export const DEFAULT_BRICKS: BrickOptions = {
  layout: ['????????', '????????', '????????', '????????', '????????'],
  brickWidth: 0.62,
  brickHeight: 0.3,
  gap: 0.05,
  wallZ: -3.6,
  baseY: 0.12,
  blastRadius: 0.32,
  balls: 15,
  silverChance: 0.16,
  goldChance: 0.1,
  bombChance: 0.06,
  sway: { amplitude: 0, speed: 0 },
  debounceMs: 250,
};

export type BrickKind = 'normal' | 'silver' | 'gold' | 'bomb';

/** Hits each kind takes to break. */
export const BRICK_HP: Record<BrickKind, number> = { normal: 1, silver: 2, gold: 3, bomb: 1 };

export interface Brick {
  id: number;
  col: number;
  row: number;
  /** Center of the brick face. */
  x: number;
  y: number;
  kind: BrickKind;
  hp: number;
}

export interface BrickState {
  bricks: readonly Brick[];
  ballsLeft: number;
  score: number;
  lastHitAt: number | null;
  /** Total bricks at the start, for progress display. */
  total: number;
}

export interface BrickHitResult {
  /** Bricks destroyed by this ball, including by bombs. */
  destroyed: Brick[];
  /** Tough bricks that lost a hit point but survived. */
  cracked: Brick[];
  /** Bombs that went off. */
  exploded: Brick[];
  points: number;
  /** Where the ball met the wall plane, or null if it never did. */
  at: { x: number; y: number; z: number } | null;
  cleared: boolean;
  clearBonus: number;
}

export const POINTS = { normal: 10, silver: 25, gold: 40, bomb: 15, comboPerBrick: 5, comboMin: 3, perBallLeftOnClear: 100 } as const;

const LAYOUT_KINDS: Record<string, BrickKind> = { '#': 'normal', s: 'silver', g: 'gold', t: 'bomb' };

function randomKind(opts: BrickOptions, rng: Rng): BrickKind {
  const roll = rng();
  if (roll < opts.bombChance) return 'bomb';
  if (roll < opts.bombChance + opts.goldChance) return 'gold';
  if (roll < opts.bombChance + opts.goldChance + opts.silverChance) return 'silver';
  return 'normal';
}

/** Builds the wall from the layout. bonusBalls are carried over from the previous level. */
export function createWall(opts: BrickOptions, rng: Rng, bonusBalls = 0): BrickState {
  const cols = Math.max(...opts.layout.map((r) => r.length));
  const totalWidth = cols * opts.brickWidth + (cols - 1) * opts.gap;
  const bricks: Brick[] = [];
  let id = 1;
  // Row 0 is the bottom row, i.e. the last line of the layout.
  opts.layout.forEach((line, lineIndex) => {
    const row = opts.layout.length - 1 - lineIndex;
    [...line].forEach((ch, col) => {
      if (ch === '.' || ch === ' ') return;
      const kind = ch === '?' ? randomKind(opts, rng) : LAYOUT_KINDS[ch] ?? 'normal';
      bricks.push({
        id: id++,
        col,
        row,
        x: -totalWidth / 2 + opts.brickWidth / 2 + col * (opts.brickWidth + opts.gap),
        y: opts.baseY + opts.brickHeight / 2 + row * (opts.brickHeight + opts.gap),
        kind,
        hp: BRICK_HP[kind],
      });
    });
  });
  bricks.sort((a, b) => a.row - b.row || a.col - b.col);
  return { bricks, ballsLeft: opts.balls + bonusBalls, score: 0, lastHitAt: null, total: bricks.length };
}

/** How far the wall has swayed sideways at time now (ms). */
export function wallOffsetAt(opts: BrickOptions, now: number): number {
  return Math.sin((now / 1000) * opts.sway.speed * Math.PI * 2) * opts.sway.amplitude;
}

/** Distance from a point to the nearest edge of a brick's face (0 if inside). */
function distanceToBrick(b: Brick, opts: BrickOptions, x: number, y: number): number {
  const dx = Math.max(Math.abs(x - b.x) - opts.brickWidth / 2, 0);
  const dy = Math.max(Math.abs(y - b.y) - opts.brickHeight / 2, 0);
  return Math.hypot(dx, dy);
}

export function isOver(state: BrickState): boolean {
  return state.ballsLeft <= 0 || state.bricks.length === 0;
}

/** Returns result null when the hit is ignored (game over or debounce). */
export function applyHit(
  state: BrickState,
  opts: BrickOptions,
  ray: Ray,
  now: number,
): { state: BrickState; result: BrickHitResult | null } {
  if (isOver(state)) return { state, result: null };
  if (state.lastHitAt !== null && now - state.lastHitAt < opts.debounceMs) return { state, result: null };
  const offset = wallOffsetAt(opts, now);

  const at = intersectPlaneZ(ray, opts.wallZ);
  const hp = new Map(state.bricks.map((b) => [b.id, b.hp]));
  const destroyed: Brick[] = [];
  const cracked: Brick[] = [];
  const exploded: Brick[] = [];

  const damage = (b: Brick, amount: number) => {
    const left = (hp.get(b.id) ?? 0) - amount;
    if ((hp.get(b.id) ?? 0) <= 0) return; // already gone
    hp.set(b.id, left);
    if (left > 0) {
      cracked.push(b);
      return;
    }
    destroyed.push(b);
    if (b.kind === 'bomb') {
      exploded.push(b);
      // Bombs destroy the surrounding 3x3 block outright, chaining into other bombs.
      for (const n of state.bricks) {
        if (n !== b && Math.abs(n.col - b.col) <= 1 && Math.abs(n.row - b.row) <= 1) damage(n, Infinity);
      }
    }
  };

  if (at) {
    for (const b of state.bricks) {
      // Brick positions are stored unswayed, so undo the sway on the impact point.
      if (distanceToBrick(b, opts, at.x - offset, at.y) <= opts.blastRadius) damage(b, 1);
    }
  }

  const destroyedIds = new Set(destroyed.map((b) => b.id));
  const bricks = state.bricks
    .filter((b) => !destroyedIds.has(b.id))
    .map((b) => (hp.get(b.id) === b.hp ? b : { ...b, hp: hp.get(b.id)! }));
  const crackedSurvivors = cracked.filter((b) => !destroyedIds.has(b.id));

  let points = destroyed.reduce((sum, b) => sum + POINTS[b.kind], 0);
  if (destroyed.length >= POINTS.comboMin) points += destroyed.length * POINTS.comboPerBrick;

  const ballsLeft = state.ballsLeft - 1;
  const cleared = bricks.length === 0;
  const clearBonus = cleared ? ballsLeft * POINTS.perBallLeftOnClear : 0;

  return {
    state: { ...state, bricks, ballsLeft, score: state.score + points + clearBonus, lastHitAt: now },
    result: { destroyed, cracked: crackedSurvivors, exploded, points, at, cleared, clearBonus },
  };
}
