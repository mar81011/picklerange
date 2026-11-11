// 3D props built from simple shapes and canvas textures.
import * as THREE from 'three';
import { BRICK_HP, type BrickKind } from '../games/bricks/brickLogic';
import type { Ring } from '../games/bullseye/bullseyeLogic';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { NEON, RED_HEX, canvasTexture, seededRandom } from './textures';

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

const BRICK_ROW_COLORS = [0x06d6a0, 0x2f8bff, 0x8338ec, 0xff006e, 0x00d9ff, 0xe040fb];

export function brickColor(row: number): number {
  return BRICK_ROW_COLORS[row % BRICK_ROW_COLORS.length];
}

const FACE_W = 256;
const FACE_H = 128;
const BEVEL = 16;

function tint(hex: number, lightness: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, lightness);
  return `#${c.getHexString()}`;
}

/** Clips to the brick's outline and cuts four lit bevels around the edge, like a gem. */
function bevelFace(ctx: CanvasRenderingContext2D, top: string, left: string, right: string, bottom: string): void {
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  ctx.beginPath();
  ctx.roundRect(0, 0, FACE_W, FACE_H, 16);
  ctx.clip();
  const facet = (color: string, points: number[][]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.fill();
  };
  const [x1, y1] = [FACE_W - BEVEL, FACE_H - BEVEL];
  facet(top, [[0, 0], [FACE_W, 0], [x1, BEVEL], [BEVEL, BEVEL]]);
  facet(left, [[0, 0], [BEVEL, BEVEL], [BEVEL, y1], [0, FACE_H]]);
  facet(right, [[FACE_W, 0], [FACE_W, FACE_H], [x1, y1], [x1, BEVEL]]);
  facet(bottom, [[0, FACE_H], [BEVEL, y1], [x1, y1], [FACE_W, FACE_H]]);
}

/** Starts a drawing clipped to the flat panel inside the bevels. Pair with ctx.restore(). */
function clipPanel(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(BEVEL, BEVEL, FACE_W - BEVEL * 2, FACE_H - BEVEL * 2);
  ctx.clip();
}

/** A band of reflected light slanting across the panel. */
function glint(ctx: CanvasRenderingContext2D, x: number, width: number, alpha: number): void {
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x + 40, 0);
  ctx.lineTo(x + 40 + width, 0);
  ctx.lineTo(x + width, FACE_H);
  ctx.lineTo(x, FACE_H);
  ctx.fill();
}

/** A different raised pattern for each row, so rows read apart even at a glance. */
const BRICK_MOTIFS: ((ctx: CanvasRenderingContext2D) => void)[] = [
  // Chevrons
  (ctx) => {
    ctx.lineWidth = 11;
    for (let x = 6; x < FACE_W; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.lineTo(x + 24, 64);
      ctx.lineTo(x, 104);
      ctx.stroke();
    }
  },
  // Diamonds
  (ctx) => {
    for (let x = 40; x < FACE_W; x += 44) {
      ctx.beginPath();
      ctx.moveTo(x, 40);
      ctx.lineTo(x + 18, 64);
      ctx.lineTo(x, 88);
      ctx.lineTo(x - 18, 64);
      ctx.fill();
    }
  },
  // Diagonal stripes
  (ctx) => {
    ctx.lineWidth = 12;
    for (let x = -60; x < FACE_W; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, FACE_H);
      ctx.lineTo(x + FACE_H * 0.7, 0);
      ctx.stroke();
    }
  },
  // Zigzag
  (ctx) => {
    ctx.lineWidth = 10;
    for (const y of [48, 80]) {
      ctx.beginPath();
      for (let x = 0, i = 0; x <= FACE_W; x += 26, i++) ctx.lineTo(x, y + (i % 2 ? 11 : -11));
      ctx.stroke();
    }
  },
  // Dot grid
  (ctx) => {
    for (let y = 36; y < 100; y += 28) {
      for (let x = 34; x < FACE_W - 20; x += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
  // Triangles
  (ctx) => {
    for (let x = 22, i = 0; x < FACE_W; x += 26, i++) {
      const up = i % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(x - 20, up ? 86 : 42);
      ctx.lineTo(x + 20, up ? 86 : 42);
      ctx.lineTo(x, up ? 42 : 86);
      ctx.fill();
    }
  },
];

function drawNormalFace(ctx: CanvasRenderingContext2D, row: number): void {
  const color = brickColor(row);
  bevelFace(ctx, tint(color, 0.28), tint(color, 0.12), tint(color, -0.12), tint(color, -0.2));
  clipPanel(ctx);
  const g = ctx.createLinearGradient(0, BEVEL, 0, FACE_H - BEVEL);
  g.addColorStop(0, tint(color, 0.08));
  g.addColorStop(1, tint(color, -0.1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  BRICK_MOTIFS[row % BRICK_MOTIFS.length](ctx);
  glint(ctx, 44, 36, 0.24);
  glint(ctx, 92, 10, 0.2);
  ctx.restore();
}

const TOUGH_STYLE = {
  silver: { bevel: ['#ffffff', '#dbe2ee', '#8a96aa', '#6f7b90'], panel: ['#eef2f8', '#aab5c7'], ink: '#1b2333', plate: '#1b2333', digit: '#ffffff', shell: 0xc3ccdb },
  gold: { bevel: ['#fff6c4', '#ffdd70', '#b57a0c', '#8f5e06'], panel: ['#ffe58a', '#e5a311'], ink: '#4a2e00', plate: '#3a2400', digit: '#ffd23f', shell: 0xd9a21b },
} as const;

/** Cracks get worse with each hit taken. Each one is a main line plus branches. */
const BRICK_CRACKS = [
  [[[56, 0], [74, 30], [60, 54], [84, 76], [70, 104], [88, 128]], [[60, 54], [36, 62], [24, 88]], [[84, 76], [100, 70]]],
  [[[206, 0], [186, 32], [200, 60], [174, 82], [192, 128]], [[200, 60], [226, 52], [240, 30]], [[174, 82], [160, 96]]],
];

function drawCracks(ctx: CanvasRenderingContext2D, count: number, ink: string): void {
  for (const crack of BRICK_CRACKS.slice(0, count)) {
    for (const [color, width, offset] of [['rgba(255,255,255,0.7)', 3, 3], [ink, 5, 0]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      for (const line of crack) {
        ctx.beginPath();
        line.forEach(([x, y]) => ctx.lineTo(x + offset, y));
        ctx.stroke();
      }
    }
  }
}

function drawToughFace(ctx: CanvasRenderingContext2D, kind: 'silver' | 'gold', hitsLeft: number): void {
  const style = TOUGH_STYLE[kind];
  const [top, left, right, bottom] = style.bevel;
  bevelFace(ctx, top, left, right, bottom);
  clipPanel(ctx);
  const g = ctx.createLinearGradient(0, BEVEL, 0, FACE_H - BEVEL);
  g.addColorStop(0, style.panel[0]);
  g.addColorStop(1, style.panel[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  if (kind === 'silver') {
    // Brushed-metal grain and corner bolts.
    const rand = seededRandom(11);
    for (let y = BEVEL; y < FACE_H - BEVEL; y += 2) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '40,50,70'},${0.05 + rand() * 0.1})`;
      ctx.fillRect(0, y, FACE_W, 1);
    }
    for (const [x, y] of [[34, 34], [222, 34], [34, 94], [222, 94]]) {
      ctx.fillStyle = '#5c687c';
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e7ecf4';
      ctx.beginPath();
      ctx.arc(x - 1.5, y - 1.5, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Four-point sparkles.
    ctx.fillStyle = '#fffbe0';
    for (const [x, y, r] of [[48, 42, 18], [214, 86, 16], [70, 92, 9], [190, 38, 9]]) {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.quadraticCurveTo(x, y, x, y + r);
      ctx.quadraticCurveTo(x, y, x - r, y);
      ctx.quadraticCurveTo(x, y, x, y - r);
      ctx.fill();
    }
  }
  glint(ctx, 18, 30, 0.3);
  ctx.restore();
  drawCracks(ctx, BRICK_HP[kind] - hitsLeft, style.ink);
  // The hits-left number on a dark plate, so it reads from across the court.
  ctx.fillStyle = style.plate;
  ctx.beginPath();
  ctx.roundRect(FACE_W / 2 - 40, FACE_H / 2 - 42, 80, 84, 14);
  ctx.fill();
  ctx.fillStyle = style.digit;
  ctx.font = '88px "Bebas Neue"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(hitsLeft), FACE_W / 2, FACE_H / 2 + 7);
}

function drawTntFace(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, FACE_W, FACE_H);
  ctx.beginPath();
  ctx.roundRect(0, 0, FACE_W, FACE_H, 16);
  ctx.clip();
  ctx.fillStyle = '#1a0a0c';
  ctx.fillRect(0, 0, FACE_W, FACE_H);
  // A bundle of dynamite sticks, each shaded like a cylinder.
  const stick = FACE_W / 5;
  for (let i = 0; i < 5; i++) {
    const x = i * stick;
    const g = ctx.createLinearGradient(x, 0, x + stick, 0);
    g.addColorStop(0, '#7a0d14');
    g.addColorStop(0.4, '#ff4a3d');
    g.addColorStop(1, '#6a0a12');
    ctx.fillStyle = g;
    ctx.fillRect(x + 2, 0, stick - 4, FACE_H);
  }
  // Yellow strap with the label.
  ctx.fillStyle = '#16090c';
  ctx.fillRect(0, 28, FACE_W, 72);
  const strap = ctx.createLinearGradient(0, 34, 0, 94);
  strap.addColorStop(0, '#ffe066');
  strap.addColorStop(1, '#f2a900');
  ctx.fillStyle = strap;
  ctx.fillRect(0, 34, FACE_W, 60);
  ctx.fillStyle = '#16090c';
  ctx.font = '72px "Bebas Neue"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', FACE_W / 2, 69);
}

/** Face textures, cached by look (they never change). */
const brickFaces = new Map<string, THREE.CanvasTexture>();

function cachedFace(key: string, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  let texture = brickFaces.get(key);
  if (texture) return texture;
  texture = canvasTexture(FACE_W, FACE_H, draw);
  texture.userData.shared = true;
  brickFaces.set(key, texture);
  return texture;
}

function brickFace(kind: BrickKind, row: number, hitsLeft: number): THREE.CanvasTexture {
  if (kind === 'silver' || kind === 'gold') return cachedFace(`${kind}-${hitsLeft}`, (ctx) => drawToughFace(ctx, kind, hitsLeft));
  if (kind === 'bomb') return cachedFace('bomb', drawTntFace);
  const motif = row % BRICK_ROW_COLORS.length;
  return cachedFace(`normal-${motif}`, (ctx) => drawNormalFace(ctx, motif));
}

/** A brick face as an image URL, for the how-to-play pictures. */
export function brickPicture(kind: BrickKind, row = 3): string {
  return (brickFace(kind, row, BRICK_HP[kind]).image as HTMLCanvasElement).toDataURL();
}

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

/**
 * A rounded, glossy brick with a printed front (userData.front). Silver and
 * gold show how many hits they have left; call setBrickHits after damage.
 */
export function createBrick(width: number, height: number, kind: BrickKind, row: number): THREE.Mesh {
  let body: THREE.MeshStandardMaterial;
  if (kind === 'silver' || kind === 'gold') {
    // Low metalness: there is no environment map, so high metalness renders near-black.
    body = new THREE.MeshStandardMaterial({ color: TOUGH_STYLE[kind].shell, metalness: 0.4, roughness: 0.25, emissive: TOUGH_STYLE[kind].shell, emissiveIntensity: 0.25 });
  } else if (kind === 'bomb') {
    body = new THREE.MeshStandardMaterial({ color: 0x2a0f12, emissive: RED_HEX, emissiveIntensity: 0.25, roughness: 0.4 });
  } else {
    const color = brickColor(row);
    // Candy-like: glossy, with a little self-glow so colors pop on dark scenes.
    body = new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.1, emissive: color, emissiveIntensity: 0.15 });
  }
  const brick = new THREE.Mesh(brickGeometry(width, height), body);
  brick.castShadow = true;
  brick.receiveShadow = true;
  const face = brickFace(kind, row, BRICK_HP[kind]);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.05, height - 0.05),
    // Mostly self-lit, so the scene's pink light doesn't tint silver and gold.
    new THREE.MeshStandardMaterial({ map: face, transparent: true, roughness: 0.35, emissive: 0xffffff, emissiveMap: face, emissiveIntensity: 0.55 }),
  );
  plate.position.z = BRICK_DEPTH / 2 + 0.003;
  brick.add(plate);
  brick.userData.front = plate;
  return brick;
}

/** Updates a silver or gold brick front to show the hits it has left. */
export function setBrickHits(brick: THREE.Mesh, kind: BrickKind, hitsLeft: number): void {
  if (kind !== 'silver' && kind !== 'gold') return;
  const material = (brick.userData.front as THREE.Mesh).material as THREE.MeshStandardMaterial;
  material.map = brickFace(kind, 0, hitsLeft);
  material.emissiveMap = material.map;
  material.needsUpdate = true;
}

/**
 * The dark neon backboard the bricks plug into, standing on the floor. Each
 * brick has a lit socket, which shows once the brick is knocked out.
 */
export function createBrickBoard(bricks: readonly { x: number; y: number }[], brickWidth: number, brickHeight: number, wallZ: number): THREE.Group {
  const margin = 0.14;
  const halfWidth = Math.max(...bricks.map((b) => Math.abs(b.x))) + brickWidth / 2 + margin;
  const height = Math.max(...bricks.map((b) => b.y)) + brickHeight / 2 + margin;
  const px = 200; // texture pixels per meter
  const face = canvasTexture(Math.round(halfWidth * 2 * px), Math.round(height * px), (ctx) => {
    const { width: w, height: h } = ctx.canvas;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1c0c44');
    g.addColorStop(1, '#0a0420');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,47,214,0.16)';
    ctx.lineWidth = 2;
    for (let x = w / 2 % 30; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = h % 30; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.shadowColor = '#3ff5ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(63,245,255,0.75)';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#05020f';
    for (const b of bricks) {
      const x = (b.x + halfWidth - brickWidth / 2) * px;
      const y = h - (b.y + brickHeight / 2) * px;
      ctx.beginPath();
      ctx.roundRect(x, y, brickWidth * px, brickHeight * px, 8);
      ctx.fill();
      ctx.stroke();
    }
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0x140a2e, roughness: 0.5 });
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, height, 0.06),
    [edge, edge, edge, edge, new THREE.MeshBasicMaterial({ map: face }), edge],
  );
  board.position.set(0, height / 2, wallZ - BRICK_DEPTH - 0.035);
  board.castShadow = true;

  // Neon tubes up the sides and across the top.
  const g = new THREE.Group();
  g.add(board);
  const tube = new THREE.MeshBasicMaterial({ color: 0xff2fd6, toneMapped: false });
  const thickness = 0.04;
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(thickness, height + thickness, thickness), tube);
    post.position.set(side * halfWidth, (height + thickness) / 2, board.position.z + 0.03);
    g.add(post);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2, thickness, thickness), tube);
  bar.position.set(0, height + thickness / 2, board.position.z + 0.03);
  g.add(bar);
  return g;
}
