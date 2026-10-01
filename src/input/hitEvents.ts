// The single contract between detection hardware and the games. Games only ever
// see HitEvents, so the mouse simulator, Kinect bridge, or any later sensor are
// interchangeable.

export type HitSourceKind = 'pointer' | 'sensor';

export interface HitEvent {
  /** Impact position, normalized to the projected area: 0 = left, 1 = right. */
  x: number;
  /** Impact position, normalized to the projected area: 0 = top, 1 = bottom. */
  y: number;
  /** Milliseconds, from performance.now() or the sensor clock. */
  timestamp: number;
  /** 0..1 detection confidence. The pointer simulator always reports 1. */
  confidence: number;
  /** Estimated ball speed in m/s, when the source can measure it. */
  speedMps?: number;
  source: HitSourceKind;
}

export type HitListener = (hit: HitEvent) => void;

export class HitBus {
  private listeners = new Set<HitListener>();

  /** Returns an unsubscribe function. */
  subscribe(listener: HitListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  publish(hit: HitEvent): void {
    for (const listener of [...this.listeners]) listener(hit);
  }
}

export const hitBus = new HitBus();

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converts a screen-space click into a normalized hit, or null if the click
 * landed outside the game area (e.g. letterbox bars).
 */
export function pointerToHit(
  clientX: number,
  clientY: number,
  area: Rect,
  timestamp: number,
): HitEvent | null {
  if (area.width <= 0 || area.height <= 0) return null;
  const x = (clientX - area.left) / area.width;
  const y = (clientY - area.top) / area.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  return { x, y, timestamp, confidence: 1, source: 'pointer' };
}

/** Maps a click's window coordinates to a normalized point on the game, or null outside it. */
export type ClientMapper = (clientX: number, clientY: number) => { x: number; y: number } | null;

/**
 * Development stand-in for the sensor: every click or tap on the game area becomes
 * a HitEvent. toFrame handles a rotated game (upright phones); by default the
 * target's on-screen rectangle is used. Returns a detach function.
 */
export function attachPointerSimulator(target: HTMLElement, bus: HitBus = hitBus, toFrame?: ClientMapper): () => void {
  const onPointerDown = (e: PointerEvent) => {
    const now = performance.now();
    let hit: HitEvent | null;
    if (toFrame) {
      const p = toFrame(e.clientX, e.clientY);
      hit = p && { x: p.x, y: p.y, timestamp: now, confidence: 1, source: 'pointer' };
    } else {
      hit = pointerToHit(e.clientX, e.clientY, target.getBoundingClientRect(), now);
    }
    if (hit) bus.publish(hit);
  };
  target.addEventListener('pointerdown', onPointerDown);
  return () => target.removeEventListener('pointerdown', onPointerDown);
}
