import { pointAt, type Ray, type Vec3 } from '../core/geometry';
import type { Stage } from '../engine/stage';

/** A point along the ray, for drawing balls that hit nothing in particular. */
export function pointAlong(ray: Ray, distance = 9): Vec3 {
  const len = Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z);
  return pointAt(ray, distance / len);
}

/**
 * Index of the HTML element under a hit (normalized game coordinates), or -1.
 * Compared in window pixels: when the game is turned 90° on an upright phone,
 * each element's on-screen rectangle is still exact, just rotated into place.
 */
export function elementAt(stage: Stage, x: number, y: number, elements: readonly HTMLElement[]): number {
  const client = stage.frameToClient(x, y);
  const px = client.x * window.innerWidth;
  const py = client.y * window.innerHeight;
  return elements.findIndex((el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
  });
}

/** Center of an HTML element in normalized game coordinates (for dev tooling's debugAimScreen). */
export function elementCenter(stage: Stage, el: HTMLElement): { x: number; y: number } | null {
  const r = el.getBoundingClientRect();
  return stage.clientToFrame(r.left + r.width / 2, r.top + r.height / 2);
}
