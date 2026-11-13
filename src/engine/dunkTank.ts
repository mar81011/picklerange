// Dunk Tank props: a glass tank of rippling water with a hinged plank the
// clown sits on, a ladder, a painted base, and the red-circle target that
// slides along a rail beside it. Meters; the tank faces the player (+z).
import * as THREE from 'three';
import type { Vec3 } from '../core/geometry';
import { canvasTexture } from './textures';

// Close to the net and fairly low: the camera looks down from high up, so
// anything much taller than this would sit behind the scoreboard.
export const TANK = {
  x: -1.35,
  z: -2.0,
  width: 2.1,
  depth: 1.45,
  /** Painted base under the glass. */
  base: 0.22,
  /** Water depth above the base. */
  water: 0.95,
  /** Glass height above the base. */
  glass: 1.08,
  /** Top of the plank. */
  seat: 1.55,
} as const;

/** Top of the water surface (world y). */
export const WATER_Y = TANK.base + TANK.water;
/** Where the clown sits (world): on the plank, a little left of center. */
export const SEAT = { x: TANK.x - 0.12, y: TANK.seat, z: TANK.z - 0.05 } as const;

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });

interface Ripple {
  x: number;
  z: number;
  born: number;
  size: number;
}

export class DunkTank {
  readonly root = new THREE.Group();
  /** Rotates about the hinge at the plank's left end; 0 = level. */
  private plank = new THREE.Group();
  private surface: THREE.Mesh;
  private ripples: Ripple[] = [];
  private time = 0;

  constructor() {
    const { x, z, width, depth, base, water, glass } = TANK;
    this.root.position.set(x, 0, z);

    // Base: a painted box with the sign on the front.
    const sign = canvasTexture(1024, 160, (ctx) => {
      ctx.fillStyle = '#d8283c';
      ctx.fillRect(0, 0, 1024, 160);
      ctx.fillStyle = '#ffd23f';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.arc(20 + i * 39.5, 14, 7, 0, Math.PI * 2);
        ctx.arc(20 + i * 39.5, 146, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = 'bold 92px "Bebas Neue", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#4a0a14';
      ctx.strokeText('DUNK THE CLOWN!', 512, 84);
      ctx.fillStyle = '#ffffff';
      ctx.fillText('DUNK THE CLOWN!', 512, 84);
    });
    const red = std(0xd8283c);
    const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(width + 0.16, base, depth + 0.16), [red, red, std(0xb02030), red, std(0xffffff, { map: sign }), red]);
    baseMesh.position.y = base / 2;
    baseMesh.castShadow = baseMesh.receiveShadow = true;
    this.root.add(baseMesh);

    // Water: a tinted block and a rippling surface.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width - 0.04, water, depth - 0.04),
      new THREE.MeshStandardMaterial({ color: 0x2aa8ff, transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x0a4a8a, emissiveIntensity: 0.5, depthWrite: false }),
    );
    body.position.y = base + water / 2;
    body.renderOrder = 1;
    this.root.add(body);
    const surfaceGeometry = new THREE.PlaneGeometry(width - 0.04, depth - 0.04, 28, 20);
    surfaceGeometry.rotateX(-Math.PI / 2);
    this.surface = new THREE.Mesh(
      surfaceGeometry,
      new THREE.MeshStandardMaterial({ color: 0x5cc8ff, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.1, emissive: 0x0a3a5a, emissiveIntensity: 0.6 }),
    );
    this.surface.position.y = base + water;
    this.surface.renderOrder = 2;
    this.root.add(this.surface);

    // Glass walls with a metal frame.
    const pane = new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
    const glassBox = new THREE.Mesh(new THREE.BoxGeometry(width, glass, depth), pane);
    glassBox.position.y = base + glass / 2;
    glassBox.renderOrder = 3;
    this.root.add(glassBox);
    const metal = std(0xd8dce4, { metalness: 0.3, roughness: 0.35 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, glass, 0.07), metal);
        post.position.set((sx * width) / 2, base + glass / 2, (sz * depth) / 2);
        post.castShadow = true;
        this.root.add(post);
      }
    }
    for (const [w, d, px, pz] of [[width, 0.07, 0, depth / 2], [width, 0.07, 0, -depth / 2], [0.07, depth, width / 2, 0], [0.07, depth, -width / 2, 0]]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.07, 0.07, d + 0.07), metal);
      rail.position.set(px, base + glass, pz);
      this.root.add(rail);
    }

    // The plank's frame: two uprights at the back holding the hinge bar.
    const wood = std(0x9a6a3a, { roughness: 0.8 });
    const hingeX = -width / 2 + 0.05;
    const plankZ = SEAT.z - z;
    for (const sz of [-1, 1]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.08, TANK.seat - base - glass + 0.1, 0.08), metal);
      upright.position.set(hingeX, base + glass + (TANK.seat - base - glass) / 2, plankZ + sz * 0.3);
      this.root.add(upright);
    }
    this.plank.position.set(hingeX, TANK.seat - 0.05, plankZ);
    this.root.add(this.plank);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.08, 0.5), wood);
    board.position.set(0.57, 0.01, 0);
    board.castShadow = true;
    this.plank.add(board);
    // Red-and-white stripes painted on the plank's edge.
    for (let i = 0; i < 5; i++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.085, 0.505), std(i % 2 ? 0xffffff : 0xd8283c));
      stripe.position.set(0.12 + i * 0.23, 0.01, 0);
      this.plank.add(stripe);
    }

    // Ladder on the right side, for climbing back up.
    const ladder = new THREE.Group();
    for (const sz of [-0.22, 0.22]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, TANK.seat + 0.1, 0.05), metal);
      side.position.set(0, (TANK.seat + 0.1) / 2, sz);
      ladder.add(side);
    }
    for (let i = 1; i < 7; i++) {
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 6), metal);
      rung.rotation.x = Math.PI / 2;
      rung.position.y = (i * TANK.seat) / 7;
      ladder.add(rung);
    }
    ladder.position.set(width / 2 + 0.14, 0, -0.2);
    this.root.add(ladder);
  }

  /** Plank angle in radians: 0 = level, about -1.3 = dropped. */
  setPlank(angle: number): void {
    this.plank.rotation.z = angle;
  }

  /** A ring of waves spreading from a point on the surface (world x, z). */
  ripple(worldX: number, worldZ: number, size = 1): void {
    this.ripples.push({ x: worldX - TANK.x, z: worldZ - TANK.z, born: this.time, size });
  }

  update(dt: number): void {
    this.time += dt;
    this.ripples = this.ripples.filter((r) => this.time - r.born < 4);
    const pos = this.surface.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      // Gentle slosh all the time, plus every ripple.
      let y = Math.sin(px * 3 + this.time * 1.8) * 0.012 + Math.cos(pz * 4 - this.time * 1.3) * 0.01;
      for (const r of this.ripples) {
        const age = this.time - r.born;
        const d = Math.hypot(px - r.x, pz - r.z);
        const front = age * 1.6;
        y += Math.sin((d - front) * 9) * 0.09 * r.size * Math.exp(-age * 1.2) * Math.exp(-Math.abs(d - front) * 2.5);
      }
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.surface.geometry.computeVertexNormals();
  }
}

/**
 * The target: a red circle in a white rim on a hanger, below a rail that spans
 * `travel` meters either side of home. Move `target` to slide it.
 */
export function createDunkTarget(radius: number, rim: number, home: Vec3, travel: number): { root: THREE.Group; target: THREE.Group; rail: THREE.Group } {
  const root = new THREE.Group();
  const metal = std(0xd8dce4, { metalness: 0.3, roughness: 0.35 });
  const railY = home.y + rim + 0.3;
  const half = travel + rim + 0.2;
  const rail = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, half * 2, 10), metal);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = railY;
  rail.add(bar);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, railY + 0.05, 10), std(0xd8283c, { roughness: 0.4 }));
    post.position.set(s * half, (railY + 0.05) / 2, -0.05);
    post.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), std(0xffd23f, { roughness: 0.4 }));
    cap.position.set(s * half, railY + 0.08, -0.05);
    rail.add(post, cap);
  }
  rail.position.set(home.x, 0, home.z);
  root.add(rail);

  const target = new THREE.Group();
  // Hanger rods from the rail down to the rim.
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, railY - home.y, 6), metal);
    rod.position.set(s * rim * 0.55, (railY - home.y) / 2, -0.02);
    target.add(rod);
  }
  const trolley = new THREE.Mesh(new THREE.BoxGeometry(rim * 1.4, 0.08, 0.12), std(0x333842, { metalness: 0.6, roughness: 0.4 }));
  trolley.position.y = railY - home.y;
  target.add(trolley);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(rim + 0.03, rim + 0.03, 0.05, 48), std(0x222222));
  back.rotation.x = Math.PI / 2;
  back.position.z = -0.03;
  back.castShadow = true;
  const white = new THREE.Mesh(new THREE.CircleGeometry(rim, 48), std(0xffffff, { roughness: 0.4 }));
  const redDisc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), std(0xe01e2e, { roughness: 0.35, emissive: 0x500008, emissiveIntensity: 0.6 }));
  redDisc.position.z = 0.002;
  const dot = new THREE.Mesh(new THREE.RingGeometry(radius * 0.42, radius * 0.5, 40), std(0xffffff, { roughness: 0.4 }));
  dot.position.z = 0.004;
  target.add(back, white, redDisc, dot);
  target.position.set(home.x, home.y, home.z);
  root.add(target);
  return { root, target, rail };
}
