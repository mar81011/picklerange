import { pointAt, type Ray, type Vec3 } from '../core/geometry';

/** A point along the ray, for drawing balls that hit nothing in particular. */
export function pointAlong(ray: Ray, distance = 9): Vec3 {
  const len = Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z);
  return pointAt(ray, distance / len);
}
