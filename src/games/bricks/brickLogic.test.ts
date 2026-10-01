import { describe, expect, it } from 'vitest';
import { rayThrough } from '../../core/geometry';
import { BRICK_HP, DEFAULT_BRICKS, POINTS, applyHit, createWall, isOver, wallOffsetAt, type Brick, type BrickOptions, type BrickState } from './brickLogic';

const OPTS: BrickOptions = { ...DEFAULT_BRICKS, silverChance: 0, goldChance: 0, bombChance: 0 };
const CAMERA = { x: 0, y: 3.4, z: 5.2 };
const aimAt = (x: number, y: number) => rayThrough(CAMERA, { x, y, z: OPTS.wallZ });
const plainWall = () => createWall(OPTS, () => 0.99);

function withKinds(state: BrickState, kinds: Record<number, Brick['kind']>): BrickState {
  return {
    ...state,
    bricks: state.bricks.map((b) => (kinds[b.id] ? { ...b, kind: kinds[b.id], hp: BRICK_HP[kinds[b.id]] } : b)),
  };
}
const brickAt = (s: BrickState, col: number, row: number) => s.bricks.find((b) => b.col === col && b.row === row)!;

describe('createWall', () => {
  it('builds a centered grid of cols x rows', () => {
    const s = plainWall();
    expect(s.bricks).toHaveLength(8 * 5);
    expect(s.total).toBe(40);
    const xs = s.bricks.map((b) => b.x);
    expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0);
    expect(brickAt(s, 0, 0).y).toBeCloseTo(OPTS.baseY + OPTS.brickHeight / 2);
  });

  it('mixes in tough and bomb bricks by chance', () => {
    // bomb < 0.06, gold < 0.16, silver < 0.32, otherwise normal
    const rolls = [0.01, 0.1, 0.2, 0.9];
    const s = createWall({ ...DEFAULT_BRICKS, layout: ['????'] }, () => rolls.shift()!);
    expect(s.bricks.map((b) => [b.kind, b.hp])).toEqual([['bomb', 1], ['gold', 3], ['silver', 2], ['normal', 1]]);
  });
});

describe('applyHit', () => {
  it('breaks the brick at the center of a hit and uses a ball', () => {
    const s = plainWall();
    const b = brickAt(s, 3, 2);
    const { state, result } = applyHit(s, OPTS, aimAt(b.x, b.y), 0);
    expect(result!.destroyed.map((d) => d.id)).toContain(b.id);
    expect(state.bricks.find((x) => x.id === b.id)).toBeUndefined();
    expect(state.ballsLeft).toBe(OPTS.balls - 1);
  });

  it('breaks neighbors within the blast radius and pays a combo bonus', () => {
    const s = plainWall();
    // Aim at the corner where four bricks meet.
    const a = brickAt(s, 3, 2);
    const cornerX = a.x + OPTS.brickWidth / 2 + OPTS.gap / 2;
    const cornerY = a.y + OPTS.brickHeight / 2 + OPTS.gap / 2;
    const { result } = applyHit(s, OPTS, aimAt(cornerX, cornerY), 0);
    expect(result!.destroyed.length).toBeGreaterThanOrEqual(4);
    expect(result!.points).toBe(result!.destroyed.length * (POINTS.normal + POINTS.comboPerBrick));
  });

  it('cracks a silver brick on the first hit and breaks it on the second', () => {
    const s = withKinds(plainWall(), { [brickAt(plainWall(), 0, 0).id]: 'silver' });
    const b = brickAt(s, 0, 0);
    // Aim at the outer corner so only this brick is in range.
    const ray = aimAt(b.x - OPTS.brickWidth / 2, b.y - OPTS.brickHeight / 2);

    const first = applyHit(s, OPTS, ray, 0);
    expect(first.result!.cracked.map((c) => c.id)).toEqual([b.id]);
    expect(first.result!.destroyed).toEqual([]);
    expect(brickAt(first.state, 0, 0).hp).toBe(1);

    const second = applyHit(first.state, OPTS, ray, 1000);
    expect(second.result!.destroyed.map((d) => d.id)).toEqual([b.id]);
    expect(second.result!.points).toBe(POINTS.silver);
  });

  it('takes three hits to break a gold brick', () => {
    const s = withKinds(plainWall(), { [brickAt(plainWall(), 0, 0).id]: 'gold' });
    const b = brickAt(s, 0, 0);
    const ray = aimAt(b.x - OPTS.brickWidth / 2, b.y - OPTS.brickHeight / 2);
    let state = s;
    for (const [i, hpLeft] of [[0, 2], [1, 1]]) {
      const r = applyHit(state, OPTS, ray, i * 1000);
      expect(r.result!.destroyed).toEqual([]);
      state = r.state;
      expect(brickAt(state, 0, 0).hp).toBe(hpLeft);
    }
    const third = applyHit(state, OPTS, ray, 5000);
    expect(third.result!.destroyed.map((d) => d.id)).toEqual([b.id]);
    expect(third.result!.points).toBe(POINTS.gold);
  });

  it('lets a bomb break a gold brick outright', () => {
    const base = plainWall();
    const s = withKinds(base, { [brickAt(base, 0, 0).id]: 'bomb', [brickAt(base, 1, 0).id]: 'gold' });
    const bomb = brickAt(s, 0, 0);
    const { result } = applyHit(s, OPTS, aimAt(bomb.x - OPTS.brickWidth / 2, bomb.y - OPTS.brickHeight / 2), 0);
    expect(result!.destroyed.map((b) => b.kind)).toContain('gold');
  });

  it('bombs clear their 3x3 block and chain into other bombs', () => {
    const base = plainWall();
    const bomb = brickAt(base, 0, 0);
    const chained = brickAt(base, 1, 1);
    const s = withKinds(base, { [bomb.id]: 'bomb', [chained.id]: 'bomb' });

    const { result } = applyHit(s, OPTS, aimAt(bomb.x - OPTS.brickWidth / 2, bomb.y - OPTS.brickHeight / 2), 0);
    expect(result!.exploded.map((b) => b.id).sort()).toEqual([bomb.id, chained.id].sort());
    const destroyed = new Set(result!.destroyed.map((b) => `${b.col},${b.row}`));
    // The second bomb at (1,1) reaches up to column 2 / row 2.
    for (const cell of ['0,0', '1,0', '0,1', '1,1', '2,2', '2,0', '0,2']) expect(destroyed.has(cell)).toBe(true);
    expect(destroyed.has('3,3')).toBe(false);
  });

  it('counts a ball that misses the wall entirely', () => {
    const s = plainWall();
    const { state, result } = applyHit(s, OPTS, aimAt(8, 3), 0);
    expect(result!.destroyed).toEqual([]);
    expect(result!.points).toBe(0);
    expect(state.ballsLeft).toBe(OPTS.balls - 1);
  });

  it('pays a bonus for every ball left when the wall is cleared', () => {
    const s = plainWall();
    const last = brickAt(s, 0, 0);
    const oneLeft: BrickState = { ...s, bricks: [last], ballsLeft: 5 };
    const { state, result } = applyHit(oneLeft, OPTS, aimAt(last.x, last.y), 0);
    expect(result!.cleared).toBe(true);
    expect(result!.clearBonus).toBe(4 * POINTS.perBallLeftOnClear);
    expect(state.score).toBe(POINTS.normal + 400);
    expect(isOver(state)).toBe(true);
  });

  it('ends when the balls run out and ignores duplicates', () => {
    const s = { ...plainWall(), ballsLeft: 1 };
    const first = applyHit(s, OPTS, aimAt(0, 1), 0);
    expect(isOver(first.state)).toBe(true);
    expect(applyHit(first.state, OPTS, aimAt(0, 1), 5000).result).toBeNull();

    const fresh = applyHit(plainWall(), OPTS, aimAt(0, 1), 1000);
    expect(applyHit(fresh.state, OPTS, aimAt(0, 1), 1100).result).toBeNull();
  });
});

describe('level layouts', () => {
  it('reads the layout top row first, with gaps and fixed kinds', () => {
    const s = createWall({ ...OPTS, layout: ['.g.', 's#t'] }, () => 0.99);
    const at = (col: number, row: number) => s.bricks.find((b) => b.col === col && b.row === row)?.kind;
    expect(s.total).toBe(4);
    expect([at(0, 0), at(1, 0), at(2, 0)]).toEqual(['silver', 'normal', 'bomb']);
    expect(at(1, 1)).toBe('gold');
    expect(at(0, 1)).toBeUndefined();
  });

  it('adds balls carried over from the previous level', () => {
    expect(createWall(OPTS, () => 0.99, 4).ballsLeft).toBe(OPTS.balls + 4);
  });
});

describe('swaying wall', () => {
  const SWAY: BrickOptions = { ...OPTS, sway: { amplitude: 1, speed: 0.25 } };

  it('moves the wall side to side over time', () => {
    expect(wallOffsetAt(SWAY, 0)).toBeCloseTo(0);
    expect(wallOffsetAt(SWAY, 1000)).toBeCloseTo(1); // quarter cycle at 0.25 cycles/s
    expect(wallOffsetAt(SWAY, 3000)).toBeCloseTo(-1);
  });

  it('hits the brick that is shown at that spot, not where it started', () => {
    const s = createWall(SWAY, () => 0.99);
    const b = brickAt(s, 3, 2);
    // At t=1000 the wall is shifted +1 m, so the brick is drawn at b.x + 1.
    const { result } = applyHit(s, SWAY, aimAt(b.x + 1, b.y), 1000);
    expect(result!.destroyed.map((d) => d.id)).toContain(b.id);
  });
});
