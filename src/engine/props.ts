// 3D props built from simple shapes and canvas textures.
import * as THREE from 'three';
import { BRICK_HP, type BrickKind } from '../games/bricks/brickLogic';
import type { Ring } from '../games/bullseye/bullseyeLogic';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NEON, RED_HEX, canvasTexture } from './textures';

const RING_COLORS = [NEON, '#e63946', '#ffffff', '#e63946'];

function ringFaceTexture(rings: readonly Ring[]): THREE.CanvasTexture {
  const size = 512;
  const outer = rings[rings.length - 1].radius;
  return canvasTexture(size, size, (ctx) => {
    const c = size / 2;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, size, size);
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = (rings[i].radius / outer) * (c - 6);
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fillStyle = RING_COLORS[i % RING_COLORS.length];
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0b1220';
      ctx.stroke();
    }
  });
}

/** How brightly a glowing target's printed face lights itself. */
export const GLOW_FACE_INTENSITY = 0.45;

export interface TargetOptions {
  /** Stand on a post (default). Without one the target floats. */
  stand?: boolean;
  /** Adds a glowing rim in this color. */
  glow?: number;
  /** Draw as a bomb (black face, red X) instead of rings. */
  bomb?: boolean;
}

let bombTexture: THREE.Texture | null = null;

/** Shared face for bomb targets: black with a red X. */
function bombFace(): THREE.Texture {
  if (bombTexture) return bombTexture;
  bombTexture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#0d0d12';
    ctx.fillRect(0, 0, 512, 512);
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1b24';
    ctx.fill();
    ctx.strokeStyle = '#ff2b2b';
    ctx.lineWidth = 56;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.lineTo(362, 362);
    ctx.moveTo(362, 150);
    ctx.lineTo(150, 362);
    ctx.stroke();
  });
  bombTexture.userData.shared = true;
  return bombTexture;
}

/**
 * Archery target, on a post or floating. The group's origin is the center of
 * the face, so position it at the target's (x, y, z). userData.face is the
 * part to scale (in x/y) to shrink the target; userData.faceMaterial is the
 * printed side, for flashing it.
 */
export function createTarget(rings: readonly Ring[], options: TargetOptions = {}): THREE.Group {
  const outer = rings[rings.length - 1].radius;
  const group = new THREE.Group();
  const face = new THREE.Group();
  group.add(face);

  const rim = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.5 });
  const printed = new THREE.MeshStandardMaterial({ map: options.bomb ? bombFace() : ringFaceTexture(rings), roughness: 0.55 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, 0.07, 64), [rim, printed, rim]);
  disc.rotation.x = Math.PI / 2; // the cylinder's top cap now faces the player
  disc.castShadow = true;
  face.add(disc);
  if (options.glow !== undefined) {
    // Self-lit print so glowing targets stay readable in dark scenes.
    printed.emissive.setHex(0xffffff);
    printed.emissiveMap = printed.map;
    printed.emissiveIntensity = GLOW_FACE_INTENSITY;
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(outer + 0.035, 0.03, 10, 64),
      new THREE.MeshBasicMaterial({ color: options.glow, toneMapped: false }),
    );
    halo.position.z = 0.02;
    face.add(halo);
  }
  group.userData.face = face;
  group.userData.faceMaterial = printed;

  if (options.stand === false) return group;

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1, 8),
    new THREE.MeshStandardMaterial({ color: 0x1b2333, metalness: 0.5, roughness: 0.4 }),
  );
  post.userData.isPost = true;
  post.castShadow = true;
  group.add(post);

  const foot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: 0x1b2333, roughness: 0.6 }),
  );
  foot.userData.isFoot = true;
  foot.castShadow = true;
  group.add(foot);
  return group;
}

/** Positions the target so its face center sits at (x, y, z) and its post reaches the ground. */
export function placeTargetProp(target: THREE.Group, x: number, y: number, z: number): void {
  target.position.set(x, y, z);
  for (const child of target.children) {
    if (child.userData.isPost) {
      child.scale.y = y;
      child.position.y = -y / 2;
      child.position.z = -0.06;
    }
    if (child.userData.isFoot) {
      child.position.y = -y + 0.025;
      child.position.z = -0.06;
    }
  }
}

/** Floor ring showing how far the opponent can reach. */
export function createReachRing(reach: number): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(reach - 0.05, reach, 64),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  return ring;
}

const BRICK_ROW_COLORS = [0x06d6a0, 0x118ab2, 0x8338ec, 0xff006e, 0xffb703, 0xfb5607];

export function brickColor(row: number): number {
  return BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length];
}

const TOUGH_STYLE = {
  silver: { top: '#f4f7fb', bottom: '#9aa6ba', ink: '#1b2333', shell: 0xc3ccdb },
  gold: { top: '#ffe58a', bottom: '#c98a12', ink: '#3a2400', shell: 0xd9a21b },
} as const;

/** Face textures for tough bricks, cached by kind and hits left (they never change). */
const toughFaces = new Map<string, THREE.Texture>();

function toughFace(kind: 'silver' | 'gold', hitsLeft: number, maxHits: number): THREE.Texture {
  const key = `${kind}-${hitsLeft}`;
  let texture = toughFaces.get(key);
  if (texture) return texture;
  const style = TOUGH_STYLE[kind];
  texture = canvasTexture(256, 128, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, style.top);
    g.addColorStop(1, style.bottom);
    ctx.clearRect(0, 0, 256, 128);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 128, 18);
    ctx.fill();
    // Rivets in the corners.
    ctx.fillStyle = style.ink;
    for (const [x, y] of [[16, 16], [240, 16], [16, 112], [240, 112]]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cracks get worse with each hit taken.
    ctx.strokeStyle = style.ink;
    ctx.lineWidth = 4;
    const cracks = [
      [[40, 0], [62, 40], [48, 70], [70, 128]],
      [[200, 0], [180, 36], [206, 66], [186, 128]],
    ];
    for (let i = 0; i < maxHits - hitsLeft && i < cracks.length; i++) {
      ctx.beginPath();
      cracks[i].forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    ctx.fillStyle = style.ink;
    ctx.font = '96px "Bebas Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(hitsLeft), 128, 72);
  });
  texture.userData.shared = true;
  toughFaces.set(key, texture);
  return texture;
}

/**
 * A brick. Silver and gold bricks show how many hits they have left on the
 * front; call setBrickHits after damage to update it.
 */
const BRICK_DEPTH = 0.22;
const BRICK_RADIUS = 0.045;

/** Shared rounded-brick geometry per size (all bricks in a wall are the same size). */
const brickGeometries = new Map<string, THREE.BufferGeometry>();
function brickGeometry(width: number, height: number): THREE.BufferGeometry {
  const key = `${width}x${height}`;
  let g = brickGeometries.get(key);
  if (!g) {
    g = new RoundedBoxGeometry(width, height, BRICK_DEPTH, 3, BRICK_RADIUS);
    g.userData.shared = true;
    brickGeometries.set(key, g);
  }
  return g;
}

let tntTexture: THREE.Texture | null = null;
function tntFace(): THREE.Texture {
  if (tntTexture) return tntTexture;
  tntTexture = canvasTexture(256, 128, (ctx) => {
    ctx.clearRect(0, 0, 256, 128);
    // Hazard stripes along the edges, label in the middle.
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 256, 128, 18);
    ctx.clip();
    for (let x = -128; x < 256; x += 32) {
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 16 + 128, 128);
      ctx.lineTo(x + 128, 128);
      ctx.fill();
    }
    ctx.fillStyle = '#1a1016';
    ctx.fillRect(14, 22, 228, 84);
    ctx.restore();
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ff4d4d';
    ctx.font = '80px "Bebas Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 128, 70);
  });
  tntTexture.userData.shared = true;
  return tntTexture;
}

/**
 * A rounded, glossy brick. Silver/gold bricks and TNT carry a printed plate
 * on the front (userData.front); setBrickHits updates the silver/gold number.
 */
export function createBrick(width: number, height: number, kind: BrickKind, row: number): THREE.Mesh {
  let body: THREE.MeshStandardMaterial;
  let face: THREE.Texture | null = null;
  if (kind === 'silver' || kind === 'gold') {
    // Low metalness: there is no environment map, so high metalness renders near-black.
    body = new THREE.MeshStandardMaterial({ color: TOUGH_STYLE[kind].shell, metalness: 0.4, roughness: 0.25 });
    face = toughFace(kind, BRICK_HP[kind], BRICK_HP[kind]);
  } else if (kind === 'bomb') {
    body = new THREE.MeshStandardMaterial({ color: 0x2a0f12, emissive: RED_HEX, emissiveIntensity: 0.25, roughness: 0.4 });
    face = tntFace();
  } else {
    const color = brickColor(row);
    // Candy-like: glossy, with a little self-glow so colors pop on dark scenes.
    body = new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.1, emissive: color, emissiveIntensity: 0.15 });
  }
  const brick = new THREE.Mesh(brickGeometry(width, height), body);
  brick.castShadow = true;
  brick.receiveShadow = true;
  if (face) {
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(width - 0.08, height - 0.08),
      new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.35, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.2 }),
    );
    plate.position.z = BRICK_DEPTH / 2 + 0.003;
    brick.add(plate);
    brick.userData.front = plate;
  }
  return brick;
}

/** Updates a silver or gold brick front to show the hits it has left. */
export function setBrickHits(brick: THREE.Mesh, kind: BrickKind, hitsLeft: number): void {
  if (kind !== 'silver' && kind !== 'gold') return;
  const material = (brick.userData.front as THREE.Mesh).material as THREE.MeshStandardMaterial;
  material.map = toughFace(kind, hitsLeft, BRICK_HP[kind]);
  material.emissiveMap = material.map;
  material.needsUpdate = true;
}
