import { describe, expect, it, vi } from 'vitest';
import { HitBus, pointerToHit, type HitEvent } from './hitEvents';

const AREA = { left: 100, top: 50, width: 800, height: 400 };

describe('pointerToHit', () => {
  it('normalizes a click to the game area', () => {
    expect(pointerToHit(500, 250, AREA, 42)).toEqual({ x: 0.5, y: 0.5, timestamp: 42, confidence: 1, source: 'pointer' });
    expect(pointerToHit(100, 50, AREA, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointerToHit(900, 450, AREA, 0)).toMatchObject({ x: 1, y: 1 });
  });

  it('ignores clicks in the letterbox outside the game area', () => {
    expect(pointerToHit(99, 250, AREA, 0)).toBeNull();
    expect(pointerToHit(500, 451, AREA, 0)).toBeNull();
  });

  it('ignores an empty game area', () => {
    expect(pointerToHit(0, 0, { left: 0, top: 0, width: 0, height: 0 }, 0)).toBeNull();
  });
});

describe('HitBus', () => {
  const hit: HitEvent = { x: 0.5, y: 0.5, timestamp: 0, confidence: 1, source: 'sensor' };

  it('delivers hits to subscribers until they unsubscribe', () => {
    const bus = new HitBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe(listener);

    bus.publish(hit);
    unsubscribe();
    bus.publish(hit);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(hit);
  });

  it('lets a listener unsubscribe during delivery without skipping others', () => {
    const bus = new HitBus();
    const second = vi.fn();
    const unsubscribeFirst = bus.subscribe(() => unsubscribeFirst());
    bus.subscribe(second);

    bus.publish(hit);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
