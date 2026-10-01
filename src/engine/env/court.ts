// Far half of a pickleball court plus its surroundings, styled per environment.
import * as THREE from 'three';
import { BASELINE_Z, COURT } from '../../core/court';
import { canvasTexture } from '../textures';

export interface CourtStyle {
  /** Court surface gradient, far to near. */
  surface: [string, string];
  line: string;
  /** Kitchen (non-volley zone) tint drawn over the surface. */
  kitchen: string;
  /** Run-off area right around the court. */
  apron: number;
  /** Lines glow (for night/neon looks). */
  glow?: boolean;
  roughness?: number;
}

export function buildCourt(style: CourtStyle): THREE.Group {
  const group = new THREE.Group();

  // 1 px = 1 cm so lines are drawn at real widths.
  const W = Math.round(COURT.width * 100);
  const L = Math.round(COURT.halfLength * 100);
  const kitchenPx = (COURT.kitchen / COURT.halfLength) * L;
  const drawLines = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = style.line;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, W - 6, L + 10); // sidelines and far baseline
    ctx.beginPath();
    ctx.moveTo(0, L - kitchenPx);
    ctx.lineTo(W, L - kitchenPx); // kitchen line
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, L - kitchenPx); // centerline
    ctx.stroke();
  };
  const map = canvasTexture(W, L, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, L);
    g.addColorStop(0, style.surface[0]);
    g.addColorStop(1, style.surface[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, L);
    ctx.fillStyle = style.kitchen;
    ctx.fillRect(0, L - kitchenPx, W, kitchenPx);
    drawLines(ctx);
  });
  const material = new THREE.MeshStandardMaterial({ map, roughness: style.roughness ?? 0.75 });
  if (style.glow) {
    // Only the lines emit light.
    material.emissive.setHex(0xffffff);
    material.emissiveMap = canvasTexture(W, L, (ctx) => {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, L);
      drawLines(ctx);
    });
    material.emissiveIntensity = 1.4;
  }
  const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT.width, COURT.halfLength), material);
  court.rotation.x = -Math.PI / 2;
  court.position.set(0, 0.003, BASELINE_Z / 2);
  court.receiveShadow = true;
  group.add(court);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(COURT.width + 4, COURT.halfLength + 2.5),
    new THREE.MeshStandardMaterial({ color: style.apron, roughness: style.roughness ?? 0.85 }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.set(0, 0.0015, BASELINE_Z / 2 - 1.2);
  apron.receiveShadow = true;
  group.add(apron);
  return group;
}

/** Key light with tuned shadow settings; add both the light and its target. */
export function shadowLight(color: number, intensity: number, position: [number, number, number]): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(color, intensity);
  light.position.set(...position);
  light.target.position.set(0, 0, -4);
  light.castShadow = true;
  // 1024 is plenty for a court this size and much cheaper than 2048.
  light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  light.shadow.bias = -0.0005;
  return light;
}

/** Vertical gradient used as a scene background. */
export function skyTexture(stops: [number, string][], extra?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  return canvasTexture(w, h, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [at, color] of stops) g.addColorStop(at, color);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    extra?.(ctx, w, h);
  });
}
