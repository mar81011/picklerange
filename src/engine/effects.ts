// Hit feedback: ball flight, spark bursts, shockwaves and floating text.
import * as THREE from 'three';
import type { Vec3 } from '../core/geometry';
import { CAMERA_POSITION } from './stage';
import { easeInCubic, linear, type Scope } from './scope';
import { NEON_HEX, canvasTexture, sparkTexture } from './textures';

let spark: THREE.Texture | null = null;
function sharedSpark(): THREE.Texture {
  if (!spark) {
    spark = sparkTexture();
    spark.userData.shared = true;
  }
  return spark;
}

/**
 * Drawn about twice a real pickleball's size (74 mm): on a projected wall
 * the real size is only a few pixels and the holes would be invisible.
 */
export const BALL_RADIUS = 0.065;

/** Number of holes, like a regulation outdoor ball. */
const HOLES = 40;
/** Angular radius of each hole on the sphere, in radians. */
const HOLE_RADIUS = 0.15;

/**
 * Pickleball skin, computed per pixel on the sphere so every hole is perfectly
 * round and evenly spaced (a flat drawing would stretch near the poles).
 * Holes sit on a Fibonacci spiral, which spreads points evenly over a sphere.
 */
function pickleballTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 256;
  const holes: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < HOLES; i++) {
    const y = 1 - ((i + 0.5) / HOLES) * 2;
    const r = Math.sqrt(1 - y * y);
    holes.push([Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]);
  }
  const cosHole = Math.cos(HOLE_RADIUS);
  const cosRim = Math.cos(HOLE_RADIUS * 1.35);
  return canvasTexture(W, H, (ctx) => {
    const img = ctx.createImageData(W, H);
    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    for (let row = 0; row < H; row++) {
      // Same mapping as THREE.SphereGeometry's UVs (texture row 0 = top of the ball).
      const theta = ((row + 0.5) / H) * Math.PI;
      for (let col = 0; col < W; col++) {
        const phi = ((col + 0.5) / W) * Math.PI * 2;
        const dx = -Math.cos(phi) * Math.sin(theta);
        const dy = Math.cos(theta);
        const dz = Math.sin(phi) * Math.sin(theta);
        let best = -1;
        for (const [hx, hy, hz] of holes) best = Math.max(best, dx * hx + dy * hy + dz * hz);
        // Ball yellow, a slightly darker raised rim, and the dark hole inside.
        const rim = smooth(cosRim, cosHole, best);
        const hole = smooth(cosHole - 0.002, cosHole + 0.004, best);
        const base = [228, 242, 60];
        const rimColor = [196, 214, 40];
        const holeColor = [58, 70, 10];
        const i = (row * W + col) * 4;
        for (let k = 0; k < 3; k++) {
          const c = base[k] + (rimColor[k] - base[k]) * rim;
          img.data[i + k] = c + (holeColor[k] - c) * hole;
        }
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
}

const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 40, 28);
ballGeometry.userData.shared = true;
const ballTexture = pickleballTexture();
ballTexture.userData.shared = true;
const ballMaterial = new THREE.MeshStandardMaterial({ map: ballTexture, emissive: NEON_HEX, emissiveIntensity: 0.08, roughness: 0.45 });
ballMaterial.userData.shared = true;

/** A pickleball mesh (shared geometry and material). */
export function makeBall(): THREE.Mesh {
  const ball = new THREE.Mesh(ballGeometry, ballMaterial);
  ball.rotation.set(Math.random() * 6, Math.random() * 6, 0);
  ball.castShadow = true;
  ball.userData.shared = true;
  return ball;
}

/**
 * A ball flies from in front of the camera to `to` in a shallow arc. Resolves
 * on arrival. The ball is removed unless keep is true.
 */
export async function ballFlight(scope: Scope, to: Vec3, ms = 260, keep = false): Promise<THREE.Mesh> {
  const ball = scope.add(makeBall());
  const from = new THREE.Vector3(CAMERA_POSITION.x + (to.x > 0 ? -0.4 : 0.4), 1.3, 2.2);
  const end = new THREE.Vector3(to.x, to.y, to.z);
  const arc = Math.min(1.4, from.distanceTo(end) * 0.12);
  await scope.animate(
    ms,
    (t) => {
      ball.position.lerpVectors(from, end, t);
      ball.position.y += Math.sin(Math.PI * t) * arc;
      ball.scale.setScalar(1.6 - 0.6 * t);
      ball.rotation.x -= 0.25;
    },
    linear,
  );
  if (!keep) scope.remove(ball);
  return ball;
}

/** A ball that drops onto the court and bounces, for landing spots. */
export async function ballBounce(scope: Scope, at: Vec3): Promise<void> {
  const ball = scope.add(makeBall());
  const height = 0.9;
  await scope.animate(
    700,
    (t) => {
      ball.position.set(at.x + t * 0.3, Math.abs(Math.cos(t * Math.PI * 1.5)) * height * (1 - t) + BALL_RADIUS, at.z - t * 0.6);
    },
    linear,
  );
  await scope.animate(250, (t) => ball.scale.setScalar(1 - t));
  scope.remove(ball);
}

/** Sparks flying out from a point. intensity 0..1 scales count and speed. */
export function burst(scope: Scope, at: Vec3, color: number, intensity = 0.6): void {
  const count = Math.round(20 + intensity * 60);
  const positions = new Float32Array(count * 3);
  const velocities: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    positions.set([at.x, at.y, at.z], i * 3);
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.3).normalize();
    velocities.push(dir.multiplyScalar(1.5 + Math.random() * (2 + intensity * 4)));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size: 0.09 + intensity * 0.05,
    map: sharedSpark(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = scope.add(new THREE.Points(geometry, material));

  let last = performance.now();
  scope
    .animate(
      800,
      (t) => {
        const now = performance.now();
        const dt = (now - last) / 1000;
        last = now;
        const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < count; i++) {
          velocities[i].y -= 6 * dt;
          attr.setXYZ(i, attr.getX(i) + velocities[i].x * dt, attr.getY(i) + velocities[i].y * dt, attr.getZ(i) + velocities[i].z * dt);
        }
        attr.needsUpdate = true;
        material.opacity = 1 - t;
      },
      linear,
    )
    .then(() => scope.remove(points));
}

/** Expanding ring facing the camera. */
export function shockwave(scope: Scope, at: Vec3, color: number, size = 1): void {
  const ring = scope.add(
    new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    ),
  );
  ring.position.set(at.x, at.y, at.z + 0.05);
  scope
    .animate(500, (t) => {
      ring.scale.setScalar(0.1 + t * 0.7 * size);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - t;
    })
    .then(() => scope.remove(ring));
}

/** Flat ring on the court floor, e.g. where a ball landed. */
export function groundRipple(scope: Scope, at: Vec3, color: number): void {
  const ring = scope.add(
    new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }),
    ),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(at.x, 0.02, at.z);
  scope
    .animate(700, (t) => {
      ring.scale.setScalar(0.1 + t * 0.9);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - easeInCubic(t);
    })
    .then(() => scope.remove(ring));
}

/** Big text that pops at a world point and floats up. cls adds color variants. */
export function floatText(scope: Scope, at: Vec3, text: string, cls = '', size = 84): void {
  const p = scope.stage.toOverlay(at);
  const el = scope.el('div', `float display ${cls}`, scope.layer, text);
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y - 40}px`;
  el.style.fontSize = `${size}px`;
  scope.after(1100, () => el.remove());
}

