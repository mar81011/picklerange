// Props for the newer games: tiles, firing-range plates, dartboard, floor zones.
import * as THREE from 'three';
import { RINGS, SECTORS } from '../games/darts/logic';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from './textures';

// ---------- Tiles (menu, Tic-Tac-Toe, Memory) ----------

export type FaceDrawer = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function faceTexture(width: number, height: number, draw: FaceDrawer): THREE.CanvasTexture {
  const w = 512;
  const h = Math.round((512 * height) / width);
  return canvasTexture(w, h, (ctx) => draw(ctx, w, h));
}

const TILE_DEPTH = 0.16;
const TILE_RADIUS = 0.09;
/** Gap between the tile body's edge and its printed face. */
const FACE_INSET = 0.07;

/**
 * A rounded, glossy block with a printed face drawn on a canvas. Origin at the
 * face center. frame is the block's color (it reads as a bezel around the face).
 */
export function createTile(width: number, height: number, draw: FaceDrawer, frame = 0x1d2a4d): THREE.Group {
  const tile = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(width, height, TILE_DEPTH, 4, TILE_RADIUS),
    new THREE.MeshStandardMaterial({ color: frame, roughness: 0.28, metalness: 0.35, emissive: frame, emissiveIntensity: 0.12 }),
  );
  body.position.z = -TILE_DEPTH / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  tile.add(body);

  const fw = width - FACE_INSET * 2;
  const fh = height - FACE_INSET * 2;
  const material = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.3 });
  material.map = faceTexture(fw, fh, draw);
  material.emissiveMap = material.map;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), material);
  face.position.z = 0.005;
  tile.add(face);

  tile.userData = { size: { width: fw, height: fh }, face, body };
  return tile;
}

/** Redraws a tile's face, and optionally recolors its bezel. */
export function redrawTile(tile: THREE.Object3D, draw: FaceDrawer, frame?: number): void {
  const face = tile.userData.face as THREE.Mesh;
  const material = face.material as THREE.MeshStandardMaterial;
  const { width, height } = tile.userData.size as { width: number; height: number };
  material.map?.dispose();
  material.map = faceTexture(width, height, draw);
  material.emissiveMap = material.map;
  material.needsUpdate = true;
  if (frame !== undefined) {
    const body = (tile.userData.body as THREE.Mesh).material as THREE.MeshStandardMaterial;
    body.color.setHex(frame);
    body.emissive.setHex(frame);
  }
}

function shade(hex: string, amount: number): string {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return `#${c.getHexString()}`;
}

/**
 * Face background: a rounded card with a vertical gradient, a thin inner
 * border and a soft gloss across the top. Corners are left transparent.
 */
export function panelFace(ctx: CanvasRenderingContext2D, w: number, h: number, fill: string, border: string): void {
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) * 0.12;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(fill, 0.1));
  g.addColorStop(1, shade(fill, -0.04));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();

  // Inner glow line in the accent color.
  ctx.save();
  ctx.shadowColor = border;
  ctx.shadowBlur = 18;
  ctx.lineWidth = 6;
  ctx.strokeStyle = border;
  ctx.beginPath();
  ctx.roundRect(12, 12, w - 24, h - 24, r * 0.75);
  ctx.stroke();
  ctx.restore();

  // Gloss on the upper half.
  const gloss = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h * 0.5, [r, r, 0, 0]);
  ctx.fill();
}

// ---------- Firing range ----------

export type PlateLook = 'steel' | 'bonus' | 'noshoot';

const plateFaces = new Map<PlateLook, THREE.Texture>();

/** Painted plate face: orange steel, gold bonus, or a white NO-SHOOT plate. */
function plateFace(kind: PlateLook): THREE.Texture {
  let t = plateFaces.get(kind);
  if (t) return t;
  t = canvasTexture(256, 256, (ctx) => {
    const c = 128;
    if (kind === 'noshoot') {
      ctx.fillStyle = '#f4f4f0';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#d62828';
      ctx.lineWidth = 14;
      ctx.strokeRect(14, 14, 228, 228);
      ctx.fillStyle = '#d62828';
      ctx.font = '70px "Bebas Neue"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NO', c, 96);
      ctx.fillText('SHOOT', c, 166);
      return;
    }
    const base = kind === 'bonus' ? ['#fff0a0', '#f2b705', '#9a6c00'] : ['#ffb37a', '#f26b1d', '#8f3708'];
    const g = ctx.createRadialGradient(c - 30, c - 40, 10, c, c, 128);
    g.addColorStop(0, base[0]);
    g.addColorStop(0.5, base[1]);
    g.addColorStop(1, base[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // Hit marks from earlier rounds, and the center bolt.
    ctx.fillStyle = 'rgba(60,30,10,0.35)';
    for (const [x, y, r] of [[90, 150, 9], [160, 95, 7], [150, 175, 6], [80, 90, 5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(c, c, 92, 0, Math.PI * 2);
    ctx.stroke();
    if (kind === 'bonus') {
      ctx.fillStyle = '#fff';
      ctx.font = '90px "Bebas Neue"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('50', c, c + 8);
    } else {
      ctx.fillStyle = '#3a1a08';
      ctx.beginPath();
      ctx.arc(c, c, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  t.userData.shared = true;
  plateFaces.set(kind, t);
  return t;
}

/**
 * A steel target on a sled post. Origin is the plate center; size is the hit
 * radius. userData.plate is the swinging part (it pivots at the top of the post).
 */
export function createPlate(kind: PlateLook, size: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.6, roughness: 0.35 });

  const swing = new THREE.Group();
  g.add(swing);
  const face = new THREE.MeshStandardMaterial({ map: plateFace(kind), metalness: kind === 'noshoot' ? 0 : 0.35, roughness: 0.4 });
  const plateMesh =
    kind === 'noshoot'
      ? new THREE.Mesh(new THREE.BoxGeometry(size * 1.9, size * 1.9, 0.03), [steel, steel, steel, steel, face, steel])
      : new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.035, 40), [steel, face, steel]);
  if (kind !== 'noshoot') plateMesh.rotation.x = Math.PI / 2;
  plateMesh.castShadow = true;
  swing.add(plateMesh);
  g.userData.plate = swing;

  // Post down to a little sled riding the floor rail.
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.06), steel);
  post.position.set(0, -height / 2, -0.06);
  post.castShadow = true;
  g.add(post);
  const sled = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.3), new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.5 }));
  sled.position.set(0, -height + 0.05, -0.06);
  sled.castShadow = true;
  g.add(sled);
  return g;
}

/** Floor rails the plate sleds ride on, one per lane. */
export function createRangeRails(lanes: readonly { z: number }[], halfLength: number): THREE.Group {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x6b717a, metalness: 0.6, roughness: 0.3 });
  const hazard = canvasTexture(256, 32, (ctx) => {
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 ? '#111' : '#f2b705';
      ctx.beginPath();
      ctx.moveTo(i * 16, 32);
      ctx.lineTo(i * 16 + 16, 0);
      ctx.lineTo(i * 16 + 32, 0);
      ctx.lineTo(i * 16 + 16, 32);
      ctx.fill();
    }
  });
  hazard.wrapS = THREE.RepeatWrapping;
  hazard.repeat.set(halfLength * 2, 1);
  for (const lane of lanes) {
    for (const dz of [-0.16, 0.04]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(halfLength * 2, 0.04, 0.04), metal);
      rail.position.set(0, 0.02, lane.z + dz);
      g.add(rail);
    }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(halfLength * 2, 0.12), new THREE.MeshBasicMaterial({ map: hazard }));
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.005, lane.z + 0.18);
    g.add(strip);
  }
  return g;
}

// ---------- Dartboard ----------

/** Board face radius (the double ring's outer edge); the number band adds 18% outside it. */
export function createDartboard(radius: number): THREE.Group {
  const outer = radius * 1.18;
  const texture = canvasTexture(1024, 1024, (ctx) => {
    const c = 512;
    const px = 512 / 1.18; // pixels per board radius
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(c, c, 510, 0, Math.PI * 2);
    ctx.fill();
    const ring = (r0: number, r1: number, colorFor: (i: number) => string) => {
      for (let i = 0; i < 20; i++) {
        // Sector i is centered on the top, clockwise.
        const a0 = -Math.PI / 2 + (i - 0.5) * (Math.PI / 10);
        const a1 = a0 + Math.PI / 10;
        ctx.beginPath();
        ctx.arc(c, c, r1 * px, a0, a1);
        ctx.arc(c, c, r0 * px, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = colorFor(i);
        ctx.fill();
      }
    };
    const single = (i: number) => (i % 2 ? '#f3e7c9' : '#16161a');
    const scoring = (i: number) => (i % 2 ? '#1f8a4c' : '#d62839');
    ring(RINGS.outerBull, RINGS.tripleIn, single);
    ring(RINGS.tripleIn, RINGS.tripleOut, scoring);
    ring(RINGS.tripleOut, RINGS.doubleIn, single);
    ring(RINGS.doubleIn, RINGS.doubleOut, scoring);
    ctx.fillStyle = '#1f8a4c';
    ctx.beginPath();
    ctx.arc(c, c, RINGS.outerBull * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d62839';
    ctx.beginPath();
    ctx.arc(c, c, RINGS.bull * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '58px "Bebas Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    SECTORS.forEach((n, i) => {
      const a = -Math.PI / 2 + i * (Math.PI / 10);
      ctx.fillText(String(n), c + Math.cos(a) * 1.09 * px, c + Math.sin(a) * 1.09 * px);
    });
  });
  const g = new THREE.Group();
  const rim = new THREE.MeshStandardMaterial({ color: 0x1b1b1f });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, 0.1, 80), [rim, new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 }), rim]);
  // Face the player, then spin about the board axis so sector 20 sits at the top
  // (the cap texture is drawn with 20 at its local +x).
  disc.rotation.set(Math.PI / 2, Math.PI / 2, 0);
  disc.castShadow = true;
  g.add(disc);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.1), new THREE.MeshStandardMaterial({ color: 0x3a2a1e }));
    leg.userData.leg = true;
    leg.position.set(side * outer * 0.6, 0, -0.15);
    leg.castShadow = true;
    g.add(leg);
  }
  g.userData.outer = outer;
  return g;
}

/** Places the board so its center is at height y and its legs reach the ground. */
export function placeDartboard(board: THREE.Group, x: number, y: number, z: number): void {
  board.position.set(x, y, z);
  for (const child of board.children) {
    if (!child.userData.leg) continue;
    child.scale.y = y;
    child.position.y = -y / 2;
  }
}

// ---------- Floor zones (Around the World, Rally) ----------

/** A numbered floor pad. state changes how it is drawn. */
export function drawZonePad(ctx: CanvasRenderingContext2D, w: number, h: number, label: string, state: 'idle' | 'lit' | 'done'): void {
  ctx.clearRect(0, 0, w, h);
  const fill = state === 'lit' ? 'rgba(63,245,255,0.55)' : state === 'done' ? 'rgba(63,245,138,0.35)' : 'rgba(255,255,255,0.08)';
  const border = state === 'lit' ? '#3ff5ff' : state === 'done' ? '#3ff58a' : 'rgba(255,255,255,0.35)';
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 30);
  ctx.fill();
  ctx.lineWidth = 12;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = state === 'idle' ? 'rgba(255,255,255,0.45)' : '#ffffff';
  ctx.font = `${Math.round(h * 0.62)}px "Bebas Neue"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state === 'done' ? '✓' : label, w / 2, h / 2 + h * 0.04);
}

/** Flat pad lying on the court. */
export function createFloorPad(width: number, depth: number, draw: FaceDrawer): THREE.Mesh {
  const w = 512;
  const h = Math.round((512 * depth) / width);
  const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false });
  material.map = canvasTexture(w, h, (ctx) => draw(ctx, w, h));
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.02;
  pad.userData.size = { width, depth };
  return pad;
}

export function redrawFloorPad(pad: THREE.Mesh, draw: FaceDrawer): void {
  const material = pad.material as THREE.MeshBasicMaterial;
  const { width, depth } = pad.userData.size as { width: number; depth: number };
  const w = 512;
  const h = Math.round((512 * depth) / width);
  material.map?.dispose();
  material.map = canvasTexture(w, h, (ctx) => draw(ctx, w, h));
  material.needsUpdate = true;
}

/** Glowing target ring on the floor (Rally Survival). */
export function createFloorTarget(radius: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.08, radius, 64), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  for (const m of [disc, ring]) {
    m.rotation.x = -Math.PI / 2;
    g.add(m);
  }
  disc.position.y = 0.02;
  ring.position.y = 0.025;
  g.userData.disc = disc;
  return g;
}
