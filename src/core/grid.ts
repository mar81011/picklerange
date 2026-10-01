// A wall of equal tiles standing on the court (Tic-Tac-Toe, Memory Match).
import { intersectPlaneZ, type Ray } from './geometry';

export interface TileGrid {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
  gap: number;
  /** Height of the bottom row's lower edge. */
  baseY: number;
  /** Depth of the tile faces. */
  z: number;
}

/** Center of a tile. Row 0 is the top row. */
export function tileCenter(grid: TileGrid, col: number, row: number): { x: number; y: number; z: number } {
  const width = grid.cols * grid.tileWidth + (grid.cols - 1) * grid.gap;
  const fromBottom = grid.rows - 1 - row;
  return {
    x: -width / 2 + grid.tileWidth / 2 + col * (grid.tileWidth + grid.gap),
    y: grid.baseY + grid.tileHeight / 2 + fromBottom * (grid.tileHeight + grid.gap),
    z: grid.z,
  };
}

/** The tile the ray hits, or null for gaps and misses. */
export function tileAt(grid: TileGrid, ray: Ray): { col: number; row: number } | null {
  const p = intersectPlaneZ(ray, grid.z);
  if (!p) return null;
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const c = tileCenter(grid, col, row);
      if (Math.abs(p.x - c.x) <= grid.tileWidth / 2 && Math.abs(p.y - c.y) <= grid.tileHeight / 2) return { col, row };
    }
  }
  return null;
}
