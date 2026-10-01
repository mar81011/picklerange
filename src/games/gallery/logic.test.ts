import { describe, expect, it } from 'vitest';
import { rayThrough } from '../../core/geometry';
import { POINTS, RAILS, RAIL_HALF_LENGTH, applyHit, createGallery, platePosition, tick, type Plate, type GalleryOptions, type GalleryState } from './logic';

const OPTS: GalleryOptions = { durationMs: 30_000, spawnEveryMs: 1500, speed: 1.5, size: 0.3, bonusChance: 0.1, noShootChance: 0, debounceMs: 250 };
const CAMERA = { x: 0, y: 3.6, z: 3.6 };
const plate = (over: Partial<Plate> = {}): Plate => ({ id: 1, rail: 0, kind: 'steel', spawnAt: 0, ...over });
const withPlates = (plates: Plate[]): GalleryState => ({ ...createGallery(0), plates, spawnedPerRail: [99, 99, 99] });
const aimAt = (d: Plate, now: number, dx = 0) => {
  const p = platePosition(d, OPTS, now);
  return rayThrough(CAMERA, { ...p, x: p.x + dx });
};

describe('firing range', () => {
  it('moves plates along their rail direction', () => {
    expect(platePosition(plate({ rail: 0 }), OPTS, 0).x).toBeCloseTo(-RAIL_HALF_LENGTH);
    expect(platePosition(plate({ rail: 0 }), OPTS, 1000).x).toBeCloseTo(-RAIL_HALF_LENGTH + 1.5);
    expect(platePosition(plate({ rail: 1 }), OPTS, 0).x).toBeCloseTo(RAIL_HALF_LENGTH); // right to left
  });

  it('spawns on every rail, staggered', () => {
    const s = tick(createGallery(0), OPTS, 0, () => 0.5).state;
    expect(s.plates.map((d) => d.rail)).toEqual([0]);
    const later = tick(s, OPTS, 1000, () => 0.5).state;
    expect(new Set(later.plates.map((d) => d.rail))).toEqual(new Set([0, 1, 2]));
  });

  it('removes plates that reach the end of the rail', () => {
    const { state, gone } = tick(withPlates([plate()]), OPTS, 10_000, () => 0.5);
    expect(gone.map((d) => d.id)).toEqual([1]);
    expect(state.plates.some((d) => d.id === 1)).toBe(false);
  });

  it('scores steel, bonus and no-shoot plates', () => {
    for (const kind of ['steel', 'bonus', 'noshoot'] as const) {
      const d = plate({ kind });
      const { state, result } = applyHit({ ...withPlates([d]), score: 100 }, OPTS, aimAt(d, 1000), 1000);
      expect(result).toMatchObject({ kind: 'hit', points: POINTS[kind] });
      expect(state.score).toBe(100 + POINTS[kind]);
    }
  });

  it('misses beside a plate', () => {
    const d = plate();
    expect(applyHit(withPlates([d]), OPTS, aimAt(d, 1000, 0.5), 1000).result).toEqual({ kind: 'miss' });
  });

  it('hits the nearer rail first', () => {
    // Put a far plate and a near plate in line from the camera.
    const near = plate({ id: 2, rail: 2 });
    const pNear = platePosition(near, OPTS, 1000);
    const far = plate({ id: 1, rail: 0 });
    const ray = rayThrough(CAMERA, pNear);
    const { result } = applyHit(withPlates([far, near]), OPTS, ray, 1000);
    expect(result?.kind === 'hit' && result.plate.id).toBe(2);
    expect(RAILS[2].z).toBeGreaterThan(RAILS[0].z);
  });
});
