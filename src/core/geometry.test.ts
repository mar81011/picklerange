import { describe, expect, it } from 'vitest';
import { intersectGround, intersectPlaneZ, rayThrough } from './geometry';

const camera = { x: 0, y: 3, z: 5 };

describe('intersectPlaneZ', () => {
  it('finds where the ray crosses a vertical plane', () => {
    const p = intersectPlaneZ(rayThrough(camera, { x: 1, y: 1, z: -3 }), -3);
    expect(p?.x).toBeCloseTo(1);
    expect(p?.y).toBeCloseTo(1);
    expect(p?.z).toBeCloseTo(-3);
  });

  it('returns null for planes behind the camera or parallel rays', () => {
    expect(intersectPlaneZ(rayThrough(camera, { x: 0, y: 3, z: 0 }), 10)).toBeNull();
    expect(intersectPlaneZ({ origin: camera, dir: { x: 1, y: 0, z: 0 } }, -3)).toBeNull();
  });
});

describe('intersectGround', () => {
  it('finds the landing spot of a downward ray', () => {
    const p = intersectGround(rayThrough(camera, { x: 2, y: 0, z: -4 }));
    expect(p?.x).toBeCloseTo(2);
    expect(p?.y).toBeCloseTo(0);
    expect(p?.z).toBeCloseTo(-4);
  });

  it('returns null at or above the horizon', () => {
    expect(intersectGround({ origin: camera, dir: { x: 0, y: 0, z: -1 } })).toBeNull();
    expect(intersectGround({ origin: camera, dir: { x: 0, y: 0.2, z: -1 } })).toBeNull();
  });
});
