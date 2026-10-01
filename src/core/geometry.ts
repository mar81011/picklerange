// Minimal 3D math for the game rules. Kept independent of Three.js so the rules
// stay pure and unit-testable. World units are meters: x = left/right,
// y = up, z = toward the player (the net is at z = 0, the far court is z < 0).

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A line from the camera through the point on the screen where the ball hit. */
export interface Ray {
  origin: Vec3;
  /** Need not be normalized. */
  dir: Vec3;
}

export function pointAt(ray: Ray, t: number): Vec3 {
  return { x: ray.origin.x + ray.dir.x * t, y: ray.origin.y + ray.dir.y * t, z: ray.origin.z + ray.dir.z * t };
}

/** Where the ray crosses the vertical plane at depth z, or null if it never does (parallel or behind). */
export function intersectPlaneZ(ray: Ray, z: number): Vec3 | null {
  if (Math.abs(ray.dir.z) < 1e-9) return null;
  const t = (z - ray.origin.z) / ray.dir.z;
  return t > 0 ? pointAt(ray, t) : null;
}

/** Where the ray meets the ground (y = 0), or null if it points at or above the horizon. */
export function intersectGround(ray: Ray): Vec3 | null {
  if (ray.dir.y >= -1e-9) return null;
  const t = -ray.origin.y / ray.dir.y;
  return t > 0 ? pointAt(ray, t) : null;
}

/** A ray from `from` aimed at `to`. Used by tests and by aim-assist helpers. */
export function rayThrough(from: Vec3, to: Vec3): Ray {
  return { origin: from, dir: { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z } };
}

/** Area on the court floor, used for placing things. */
export interface FloorArea {
  minX: number;
  maxX: number;
  /** Farthest from the player (most negative z). */
  minZ: number;
  /** Nearest to the player. */
  maxZ: number;
}

/** Returns a number in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
