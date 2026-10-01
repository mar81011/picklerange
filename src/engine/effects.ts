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
export const BALL_RADIUS = 0.08;

/** Pickleball skin: yellow-green with rows of round holes (equirectangular, so the holes wrap the sphere). */
function pickleballTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#e9ff6a');
    g.addColorStop(0.5, '#d4f53c');
    g.addColorStop(1, '#b9d92a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    // Five rings of holes around the ball plus one at each pole, like a 26-40 hole outdoor ball.
    const rings = [
      { lat: 0, count: 10 },
      { lat: 38, count: 8 },
      { lat: -38, count: 8 },
      { lat: 68, count: 5 },
      { lat: -68, count: 5 },
    ];
    for (const [ri, ring] of rings.entries()) {
      const y = 128 - (ring.lat / 90) * 128;
      // Holes stretch sideways near the poles in this projection.
      const stretch = 1 / Math.max(0.35, Math.cos((ring.lat * Math.PI) / 180));
      for (let i = 0; i < ring.count; i++) {
        const x = ((i + (ri % 2) * 0.5) / ring.count) * 512;
        for (const dx of [0, 512, -512]) {
          ctx.fillStyle = '#7d8f12';
          ctx.beginPath();
          ctx.ellipse(x + dx, y, 14 * stretch, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#4a560a';
          ctx.beginPath();
          ctx.ellipse(x + dx + 1.5, y + 1.5, 10 * stretch, 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (const y of [4, 252]) {
      ctx.fillStyle = '#4a560a';
      ctx.fillRect(0, y - 6, 512, 12);
    }
  });
}

const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 24, 16);
ballGeometry.userData.shared = true;
const ballTexture = pickleballTexture();
ballTexture.userData.shared = true;
const ballMaterial = new THREE.MeshStandardMaterial({ map: ballTexture, emissive: NEON_HEX, emissiveIntensity: 0.12, roughness: 0.55 });
ballMaterial.userData.shared = true;

function makeBall(): THREE.Mesh {
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

