// Three.js renderer, camera and frame loop. The camera stands behind the player,
// looking over the net (the bottom edge of the projection) at the far court.
import * as THREE from 'three';
import type { Ray, Vec3 } from '../core/geometry';

export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/**
 * Camera framings. Both put the screen's bottom edge at the net and keep the
 * whole court width on screen; a long lens from high and far back makes the
 * court large on the wall (better for real balls).
 * - balanced: court fills ~67% of the height and 78–98% of the width; tall
 *   things (robot, zombies, dartboard) stay fully visible above the baseline.
 * - max: court fills ~86% of the height; tall things near the back get cut off.
 * Choose with ?camera=max (default balanced).
 */
const CAMERA_PRESETS = {
  balanced: { position: { x: 0, y: 13.224, z: 18.201 }, lookAt: { x: 0, y: 8.224, z: 9.541 }, fov: 12 },
  max: { position: { x: 0, y: 19.479, z: 18.811 }, lookAt: { x: 0, y: 12.919, z: 11.264 }, fov: 10 },
} as const;
const PRESET = CAMERA_PRESETS[new URLSearchParams(location.search).get('camera') === 'max' ? 'max' : 'balanced'];

export const CAMERA_POSITION = PRESET.position;
const CAMERA_LOOK_AT = PRESET.lookAt;
/** Vertical field of view on a 16:9 screen. Narrower screens widen it to keep the whole court in view. */
const CAMERA_FOV = PRESET.fov;
const DESIGN_ASPECT = 16 / 9;

export type UpdateFn = (dt: number, now: number) => void;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  /** Fills the window; holds the canvas and the HTML overlay. */
  readonly frame: HTMLElement;
  /** HTML layer laid out in 1920x1080 design pixels, scaled to fit and centered. */
  readonly overlay: HTMLElement;

  /** Off while a full-screen HTML screen (the menu) covers the 3D view, to save GPU/CPU. */
  render3d = true;
  private updates = new Set<UpdateFn>();
  private raycaster = new THREE.Raycaster();
  private shakeUntil = 0;
  private shakeStrength = 0;
  private shakeDuration = 1;
  private basePosition: THREE.Vector3;
  private lastTime = performance.now();
  /** How the 1920x1080 overlay maps onto the window. */
  private overlayFit = { scale: 1, x: 0, y: 0 };

  constructor(root: HTMLElement) {
    this.frame = document.createElement('div');
    this.frame.className = 'frame';
    root.appendChild(this.frame);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    // The projector is 1080p; rendering above 1x on high-DPI screens multiplies GPU work for no visible gain.
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.frame.appendChild(this.renderer.domElement);

    this.overlay = document.createElement('div');
    this.overlay.className = 'overlay';
    this.frame.appendChild(this.overlay);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, DESIGN_WIDTH / DESIGN_HEIGHT, 1, 300);
    this.camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
    this.camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);
    // Screens project points before the first frame renders, so compute matrices now.
    this.camera.updateMatrixWorld();
    this.basePosition = this.camera.position.clone();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.frameTick());
  }

  /**
   * Fills the whole window. The 3D view adapts to the window shape; the HTML
   * overlay keeps its 16:9 layout, scaled to fit and centered.
   */
  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.frame.style.width = `${width}px`;
    this.frame.style.height = `${height}px`;
    this.renderer.setSize(width, height);

    const aspect = width / height;
    this.camera.aspect = aspect;
    // On screens narrower than 16:9 (e.g. a 4:3 projector), widen the vertical
    // view so the horizontal view, and so the full court width, stays the same.
    this.camera.fov =
      aspect >= DESIGN_ASPECT
        ? CAMERA_FOV
        : (2 * Math.atan(Math.tan((CAMERA_FOV * Math.PI) / 360) * (DESIGN_ASPECT / aspect)) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();

    const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    this.overlayFit = { scale, x: (width - DESIGN_WIDTH * scale) / 2, y: (height - DESIGN_HEIGHT * scale) / 2 };
    this.overlay.style.transform = `translate(${this.overlayFit.x}px, ${this.overlayFit.y}px) scale(${scale})`;
  }

  /** Toggles browser fullscreen (no tabs or address bar). */
  toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  private frameTick(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    for (const fn of [...this.updates]) fn(dt, now);

    if (now < this.shakeUntil) {
      const s = this.shakeStrength * ((this.shakeUntil - now) / this.shakeDuration);
      this.camera.position.set(
        this.basePosition.x + (Math.random() - 0.5) * s,
        this.basePosition.y + (Math.random() - 0.5) * s,
        this.basePosition.z,
      );
    } else {
      this.camera.position.copy(this.basePosition);
    }
    if (this.render3d) this.renderer.render(this.scene, this.camera);
  }

  /** Runs every frame until the returned function is called. */
  onUpdate(fn: UpdateFn): () => void {
    this.updates.add(fn);
    return () => this.updates.delete(fn);
  }

  /** The line from the camera through a normalized screen point (0..1, top-left origin). */
  rayFromScreen(x: number, y: number): Ray {
    this.raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, -(y * 2 - 1)), this.camera);
    const { origin, direction } = this.raycaster.ray;
    return { origin: { x: origin.x, y: origin.y, z: origin.z }, dir: { x: direction.x, y: direction.y, z: direction.z } };
  }

  /** Where a world point appears in overlay design pixels. */
  toOverlay(p: Vec3): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    const { scale, x, y } = this.overlayFit;
    const screenX = ((v.x + 1) / 2) * window.innerWidth;
    const screenY = ((1 - v.y) / 2) * window.innerHeight;
    return { x: (screenX - x) / scale, y: (screenY - y) / scale };
  }

  /** Where a world point appears as a normalized screen position (0..1), e.g. for aiming in tests. */
  toScreen(p: Vec3): { x: number; y: number } {
    const v = new THREE.Vector3(p.x, p.y, p.z).project(this.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  /** Small frames-per-second readout in the corner, for checking performance on venue hardware. */
  showFps(): void {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;right:8px;bottom:6px;font:bold 14px monospace;color:#d4f53c;background:rgba(0,0,0,.6);padding:2px 6px;border-radius:4px;z-index:10';
    this.frame.appendChild(el);
    let frames = 0;
    let worst = 0;
    let windowStart = performance.now();
    let last = windowStart;
    this.onUpdate((_, now) => {
      frames++;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - windowStart >= 1000) {
        el.textContent = `${Math.round((frames * 1000) / (now - windowStart))} fps · worst ${Math.round(worst)} ms`;
        frames = 0;
        worst = 0;
        windowStart = now;
      }
    });
  }

  shake(strength = 0.12, durationMs = 300): void {
    this.shakeStrength = strength;
    this.shakeDuration = durationMs;
    this.shakeUntil = performance.now() + durationMs;
  }
}
