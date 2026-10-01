// Everything one screen creates (3D objects, HTML, timers, listeners) is
// registered here and torn down together when the screen changes.
import * as THREE from 'three';
import { hitBus, type HitEvent } from '../input/hitEvents';
import type { Stage, UpdateFn } from './stage';

export type Ease = (t: number) => number;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInCubic: Ease = (t) => t ** 3;
export const easeOutBack: Ease = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
export const linear: Ease = (t) => t;

/** Frees GPU memory for an object tree, skipping anything marked userData.shared. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj.userData.shared) return;
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const m of materials) {
      if (m.userData.shared) continue;
      for (const value of Object.values(m)) if (value instanceof THREE.Texture && !value.userData.shared) value.dispose();
      m.dispose();
    }
  });
}

export class Scope {
  readonly layer: HTMLElement;
  private objects = new Set<THREE.Object3D>();
  private cleanups: (() => void)[] = [];
  private disposed = false;

  constructor(readonly stage: Stage) {
    this.layer = document.createElement('div');
    this.layer.className = 'layer';
    stage.overlay.appendChild(this.layer);
  }

  get alive(): boolean {
    return !this.disposed;
  }

  add<T extends THREE.Object3D>(obj: T): T {
    this.stage.scene.add(obj);
    this.objects.add(obj);
    return obj;
  }

  remove(obj: THREE.Object3D): void {
    this.stage.scene.remove(obj);
    this.objects.delete(obj);
    disposeObject(obj);
  }

  /** Creates an HTML element in this screen's overlay layer. */
  el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', parent: HTMLElement = this.layer, text?: string): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    parent.appendChild(el);
    return el;
  }

  onHit(fn: (hit: HitEvent) => void): void {
    this.cleanups.push(hitBus.subscribe((hit) => this.alive && fn(hit)));
  }

  /** Runs when the screen closes. */
  onDispose(fn: () => void): void {
    this.cleanups.push(fn);
  }

  onUpdate(fn: UpdateFn): void {
    this.cleanups.push(this.stage.onUpdate(fn));
  }

  after(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => this.alive && fn(), ms);
    this.cleanups.push(() => window.clearTimeout(id));
  }

  every(ms: number, fn: () => void): () => void {
    const id = window.setInterval(() => this.alive && fn(), ms);
    const stop = () => window.clearInterval(id);
    this.cleanups.push(stop);
    return stop;
  }

  wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.after(ms, resolve));
  }

  /** Calls fn(t) every frame with eased t from 0 to 1 over ms. Resolves when done (never, if the screen changes first). */
  animate(ms: number, fn: (t: number) => void, ease: Ease = easeOutCubic): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const stop = this.stage.onUpdate((_, now) => {
        const raw = Math.min(1, (now - start) / ms);
        fn(ease(raw));
        if (raw >= 1) {
          stop();
          resolve();
        }
      });
      this.cleanups.push(stop);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const fn of this.cleanups) fn();
    for (const obj of this.objects) {
      this.stage.scene.remove(obj);
      disposeObject(obj);
    }
    this.objects.clear();
    this.layer.remove();
  }
}
