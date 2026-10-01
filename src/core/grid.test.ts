import { describe, expect, it } from 'vitest';
import { rayThrough } from './geometry';
import { tileAt, tileCenter, type TileGrid } from './grid';

const GRID: TileGrid = { cols: 3, rows: 3, tileWidth: 1, tileHeight: 0.6, gap: 0.1, baseY: 0.2, z: -3.5 };
const CAMERA = { x: 0, y: 3.6, z: 3.6 };

describe('tile grid', () => {
  it('centers the grid and counts rows from the top', () => {
    expect(tileCenter(GRID, 1, 0).x).toBeCloseTo(0);
    expect(tileCenter(GRID, 0, 0).x).toBeCloseTo(-1.1);
    expect(tileCenter(GRID, 0, 2).y).toBeCloseTo(0.5); // bottom row
    expect(tileCenter(GRID, 0, 0).y).toBeCloseTo(0.5 + 2 * 0.7); // top row
  });

  it('finds the tile a ray hits', () => {
    for (const [col, row] of [[0, 0], [2, 1], [1, 2]]) {
      expect(tileAt(GRID, rayThrough(CAMERA, tileCenter(GRID, col, row)))).toEqual({ col, row });
    }
  });

  it('returns null for gaps and misses', () => {
    const between = { x: (tileCenter(GRID, 0, 0).x + tileCenter(GRID, 1, 0).x) / 2, y: tileCenter(GRID, 0, 0).y, z: GRID.z };
    expect(tileAt(GRID, rayThrough(CAMERA, between))).toBeNull();
    expect(tileAt(GRID, rayThrough(CAMERA, { x: 5, y: 1, z: GRID.z }))).toBeNull();
  });
});
