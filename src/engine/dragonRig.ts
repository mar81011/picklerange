// Dragon Hunt's dragon, built entirely in code (no model file): a scaly body
// swept along curves, a horned head with glowing eyes and a jaw that opens,
// bat-like wings with finger bones and veined membranes, clawed limbs and a
// three-part tail. Each breakable part is its own group, so breaking one
// really detaches it. The dragon faces the player (+z); screen left is -x.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PartId } from '../games/dragon/logic';
import { canvasTexture, seededRandom } from './textures';

export interface DragonLook {
  /** Scales on the back, limbs and head. */
  main: number;
  /** Throat, chest and belly. */
  belly: number;
  /** Wing membranes. */
  membrane: number;
  /** Eye glow (default gold). */
  eyes?: number;
  horns: 'none' | 'nubs' | 'swept' | 'ram' | 'crown';
  /** bat: smooth scallops; ragged: torn, jagged edges; broad: longer span. */
  wings: 'bat' | 'ragged' | 'broad';
  tail: 'spade' | 'club' | 'blade';
  /** A fan of webbed spines behind the head. */
  frill?: boolean;
  /** Long barbels hanging from the snout. */
  whiskers?: boolean;
  /** Glowing spots down the flanks and tail, and glowing wing veins. */
  glow?: number;
  /** Multipliers (default 1): back-spike size, body thickness, eye size. */
  spikes?: number;
  bulk?: number;
  eyeSize?: number;
  /** Head scale relative to the body (default 1.55). */
  headSize?: number;
}

type Curve = THREE.CatmullRomCurve3;
/** Right arm joints (shoulder, elbow, wrist, hand); the left is mirrored. */
const ARM: [number, number, number][] = [[0.17, 0.6, 0.1], [0.28, 0.44, 0.06], [0.26, 0.36, 0.27], [0.21, 0.33, 0.37]];
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const curve = (...points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map(([x, y, z]) => v3(x, y, z)));

// ---------- Textures (shared by every dragon) ----------

let skinTextures: { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } | null = null;

/** Overlapping scales: a grayscale color map plus a matching normal map for depth. */
function scaleTextures(): { map: THREE.CanvasTexture; normal: THREE.CanvasTexture } {
  if (skinTextures) return skinTextures;
  const size = 512;
  const height = document.createElement('canvas');
  height.width = height.height = size;
  const h = height.getContext('2d')!;
  h.fillStyle = '#000';
  h.fillRect(0, 0, size, size);
  const w = 32;
  const rowH = 22;
  const rand = seededRandom(77);
  // Rows from the top down, so each row overlaps the one above (scales point toward the tail).
  for (let row = -1; row < size / rowH + 2; row++) {
    for (let col = -1; col < size / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0);
      const y = row * rowH;
      for (const [dx, dy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
        const cx = x + dx;
        const cy = y + dy;
        const g = h.createRadialGradient(cx, cy - 6, 2, cx, cy, w * 0.75);
        const peak = 200 + Math.floor(rand() * 55);
        g.addColorStop(0, `rgb(${peak},${peak},${peak})`);
        g.addColorStop(0.7, 'rgb(120,120,120)');
        g.addColorStop(1, 'rgb(20,20,20)');
        h.fillStyle = g;
        h.beginPath();
        h.ellipse(cx, cy, w * 0.62, rowH * 1.05, 0, 0, Math.PI);
        h.lineTo(cx - w * 0.62, cy - 4);
        h.fill();
      }
    }
  }
  const data = h.getImageData(0, 0, size, size).data;
  const at = (x: number, y: number) => data[(((y + size) % size) * size + ((x + size) % size)) * 4] / 255;

  const map = canvasTexture(size, size, (ctx) => {
    const out = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      // Light enough that the material color shows through; scale edges a bit darker.
      const v = Math.round(255 * (0.62 + 0.38 * data[i * 4] / 255));
      out.data.set([v, v, v, 255], i * 4);
    }
    ctx.putImageData(out, 0, 0);
  });
  const normal = canvasTexture(size, size, (ctx) => {
    const out = ctx.createImageData(size, size);
    const strength = 2.2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const len = Math.hypot(dx, dy, 1);
        out.data.set([((-dx / len) * 0.5 + 0.5) * 255, ((dy / len) * 0.5 + 0.5) * 255, (1 / len) * 255 * 0.5 + 127, 255], (y * size + x) * 4);
      }
    }
    ctx.putImageData(out, 0, 0);
  });
  // Normal maps hold directions, not colors.
  normal.colorSpace = THREE.NoColorSpace;
  for (const t of [map, normal]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.userData.shared = true;
  }
  skinTextures = { map, normal };
  return skinTextures;
}

let veinTexture: THREE.CanvasTexture | null = null;

/** Wing membrane: pale skin with branching veins (multiplied by the membrane color). */
function membraneTexture(): THREE.CanvasTexture {
  if (veinTexture) return veinTexture;
  veinTexture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#d8d0c8';
    ctx.fillRect(0, 0, 512, 512);
    const rand = seededRandom(5);
    // Soft blotches so it reads as skin, not plastic.
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '60,40,40'},0.06)`;
      ctx.beginPath();
      ctx.arc(rand() * 512, rand() * 512, 20 + rand() * 60, 0, Math.PI * 2);
      ctx.fill();
    }
    const vein = (x: number, y: number, angle: number, width: number, depth: number) => {
      if (depth > 5 || width < 0.6) return;
      const len = 40 + rand() * 60;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      ctx.strokeStyle = `rgba(70,30,35,${0.25 + width * 0.08})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + nx) / 2 + (rand() - 0.5) * 20, (y + ny) / 2 + (rand() - 0.5) * 20, nx, ny);
      ctx.stroke();
      vein(nx, ny, angle + (rand() - 0.5) * 0.9 - 0.35, width * 0.7, depth + 1);
      vein(nx, ny, angle + (rand() - 0.5) * 0.9 + 0.35, width * 0.65, depth + 1);
    };
    for (let i = 0; i < 9; i++) vein(rand() * 80, rand() * 512, (rand() - 0.5) * 0.8, 4, 0);
  });
  veinTexture.wrapS = veinTexture.wrapT = THREE.RepeatWrapping;
  veinTexture.userData.shared = true;
  return veinTexture;
}

let environment: THREE.Texture | null = null;

/** A soft studio reflection so the scales catch highlights. */
function environmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (environment) return environment;
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  environment.userData.shared = true;
  pmrem.dispose();
  return environment;
}

// ---------- Geometry ----------

interface SweepOptions {
  /** Radius along the curve, t = 0..1. */
  radius: (t: number) => number;
  segments?: number;
  radial?: number;
  /** Cross-section stretch across (side to side) and through (front to back) the curve. */
  width?: number;
  depth?: number;
  /** A direction never parallel to the curve, used to orient the cross-section. */
  ref?: THREE.Vector3;
  /** Which way the belly faces; that side gets the belly color. */
  ventral?: THREE.Vector3;
  /** Where the belly color starts (dot with `ventral`); higher = a narrower stripe. */
  bellyFrom?: number;
  /** Round the ends into domes over this fraction of the length (start, end), instead of flat caps. */
  round?: [number, number];
  /** Texture repeats around and per unit of length. */
  uRepeat?: number;
  vPerUnit?: number;
}

/** A tube with a varying, oval cross-section swept along a curve, with capped ends and belly coloring. */
function sweep(path: Curve, look: { main: THREE.Color; belly: THREE.Color }, o: SweepOptions): THREE.BufferGeometry {
  const segments = o.segments ?? 32;
  const radial = o.radial ?? 18;
  const ref = o.ref ?? v3(1, 0, 0);
  const ventral = o.ventral ?? v3(0, 0, 1);
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let length = 0;
  let last = path.getPointAt(0);
  const color = new THREE.Color();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = path.getPointAt(t);
    length += center.distanceTo(last);
    last = center;
    const tangent = path.getTangentAt(t);
    const side = ref.clone().sub(tangent.clone().multiplyScalar(ref.dot(tangent))).normalize();
    const front = tangent.clone().cross(side).normalize();
    const [r0, r1] = o.round ?? [0, 0];
    const dome = (x: number) => Math.sqrt(Math.max(0, 1 - (1 - x) ** 2)) * 0.97 + 0.03;
    const r = o.radius(t) * (t < r0 ? dome(t / r0) : 1) * (1 - t < r1 ? dome((1 - t) / r1) : 1);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(front, Math.sin(a));
      const p = center.clone().addScaledVector(side, Math.cos(a) * r * (o.width ?? 1)).addScaledVector(front, Math.sin(a) * r * (o.depth ?? 1));
      positions.push(p.x, p.y, p.z);
      uvs.push((j / radial) * (o.uRepeat ?? 3), length * (o.vPerUnit ?? 5));
      const belly = THREE.MathUtils.smoothstep(dir.dot(ventral), o.bellyFrom ?? 0.3, 0.95) * 0.85;
      color.copy(look.main).lerp(look.belly, belly);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      // (side, front, tangent) is right-handed, so this winding faces outward.
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  // Caps: a center point fanned to the first and last rings.
  for (const [ring, t, flip] of [[0, 0, true], [segments, 1, false]] as const) {
    const c = path.getPointAt(t);
    const centerIndex = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    uvs.push(0, 0);
    color.copy(look.main);
    colors.push(color.r, color.g, color.b);
    for (let j = 0; j < radial; j++) {
      const a = ring * (radial + 1) + j;
      indices.push(...(flip ? [centerIndex, a + 1, a] : [centerIndex, a, a + 1]));
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  // The first and last vertex of each ring sit on the same spot; average their
  // normals so there is no visible seam down the side.
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i <= segments; i++) {
    const a = i * (radial + 1);
    const b = a + radial;
    const avg = v3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, avg.x, avg.y, avg.z);
    n.setXYZ(b, avg.x, avg.y, avg.z);
  }
  return g;
}

/** A pointed horn, claw, tooth or spike: a thin sweep that tapers to a point. */
function spike(points: [number, number, number][], base: number, look: { main: THREE.Color; belly: THREE.Color }, ref = v3(1, 0, 0)): THREE.BufferGeometry {
  return sweep(curve(...points), look, { radius: (t) => base * (1 - t) ** 1.2 + 0.001, segments: 10, radial: 8, ref, uRepeat: 1, vPerUnit: 2 });
}

/**
 * One wing membrane panel fanned out from `hub` across a chain of edge points.
 * Between neighbouring finger tips the trailing edge sags inward in a scallop,
 * and the skin billows a little.
 */
function membrane(hub: THREE.Vector3, chain: THREE.Vector3[], scallopAfter: number, sag = 0.2, jag = 0, seed = 1): THREE.BufferGeometry {
  const rand = seededRandom(seed);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const rings = 6;
  const across = 6;
  // Sample the edge: straight along the bones, scalloped between tips.
  const edge: THREE.Vector3[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    for (let s = 0; s < across; s++) {
      const u = s / across;
      const p = chain[i].clone().lerp(chain[i + 1], u);
      // Ragged wings get a torn, uneven edge (never at the finger tips, s = 0).
      if (i >= scallopAfter) p.lerp(hub, (sag + (s ? jag * rand() : 0)) * Math.sin(Math.PI * u));
      edge.push(p);
    }
  }
  edge.push(chain[chain.length - 1].clone());
  for (let r = 0; r <= rings; r++) {
    const v = r / rings;
    for (let e = 0; e < edge.length; e++) {
      const p = hub.clone().lerp(edge[e], v);
      // Billow backward (away from the player) in the middle of the panel.
      p.z -= Math.sin(Math.PI * v) * 0.06 * Math.sin((Math.PI * e) / (edge.length - 1));
      positions.push(p.x, p.y, p.z);
      uvs.push(p.x * 1.3, p.y * 1.3);
    }
  }
  const row = edge.length;
  for (let r = 0; r < rings; r++) {
    for (let e = 0; e < row - 1; e++) {
      const a = r * row + e;
      indices.push(a, a + row, a + 1, a + row, a + row + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ---------- The rig ----------

interface Marker {
  part: PartId;
  object: THREE.Object3D;
  /** Hit radius in the dragon's own units. */
  radius: number;
}

export class DragonRig {
  /** Position this at the dragon's feet; turn it to lean. */
  readonly root = new THREE.Group();
  /** Materials this dragon owns (for flashes); disposed with the rig. */
  readonly materials: THREE.MeshStandardMaterial[] = [];
  mode: 'fly' | 'hover' = 'fly';

  private body = new THREE.Group();
  private head = new THREE.Group();
  private jaw = new THREE.Group();
  private neck = new THREE.Group();
  private wings: Record<'L' | 'R', THREE.Group>;
  private arms: Record<'L' | 'R', THREE.Group>;
  private tail: THREE.Group[] = [];
  private parts = new Map<PartId, THREE.Object3D>();
  private markers: Marker[] = [];
  private mouthMarker = new THREE.Object3D();
  private time = Math.random() * 10;
  private flap = 0;
  private flapRate = 2.2;
  private recoil = 0;
  private recoilSpeed = 0;
  private jawOpen = 0;
  private jawUntil = 0;
  private dead = false;
  /** Model units to meters. */
  readonly scale: number;

  constructor(look: DragonLook, size: number, renderer: THREE.WebGLRenderer) {
    const main = new THREE.Color(look.main);
    const belly = new THREE.Color(look.belly);
    const colors = { main, belly };
    const bone = { main: new THREE.Color(0xb8aa8a), belly: new THREE.Color(0x8c7c5c) };
    const env = environmentMap(renderer);
    const { map, normal } = scaleTextures();

    const skin = this.material({ vertexColors: true, map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.5, metalness: 0.05, envMap: env, envMapIntensity: 0.45 });
    const ivory = this.material({ vertexColors: true, roughness: 0.55, metalness: 0, envMap: env, envMapIntensity: 0.2 });
    const wingSkin = this.material({ color: look.membrane, map: membraneTexture(), side: THREE.DoubleSide, roughness: 0.75, emissive: look.glow ?? look.membrane, emissiveIntensity: look.glow !== undefined ? 0.1 : 0.12, envMap: env, envMapIntensity: 0.2 });
    const eyeGlow = this.material({ color: look.eyes ?? 0xffc23a, emissive: look.eyes ?? 0xffa21a, emissiveIntensity: 2.2, roughness: 0.2 });
    const dark = this.material({ color: 0x120808, roughness: 0.3 });
    const mouth = this.material({ color: 0x5a1218, roughness: 0.6, emissive: 0xff3a10, emissiveIntensity: 0.15 });

    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    /** Marks a mesh as decoration that doesn't count toward the dragon's size. */
    const extra = (m: THREE.Mesh) => ((m.userData.extra = true), m);

    // Body, posed upright as if hovering: chest toward the player, tail hanging below.
    const bulk = look.bulk ?? 1;
    const spikeSize = look.spikes ?? 1;
    const bodyPath = curve([0, -0.05, -0.2], [0, 0.18, -0.13], [0, 0.45, -0.02], [0, 0.68, 0.03], [0, 0.84, 0.07]);
    const bodyRadius = (t: number) => (0.19 + Math.sin(Math.PI * Math.min(1, t * 0.9)) * 0.13 - t * 0.04) * bulk;
    mesh(sweep(bodyPath, colors, { radius: bodyRadius, depth: 0.88, uRepeat: 4, round: [0.22, 0.07], bellyFrom: 0.5 }), skin, this.body);
    // Glowing markings: spots down both flanks.
    const glow = look.glow !== undefined ? this.material({ color: look.glow, emissive: look.glow, emissiveIntensity: 1.8, roughness: 0.4 }) : null;
    if (glow) {
      for (const s of [-1, 1]) {
        for (let i = 1; i < 7; i++) {
          const t = i / 7.5;
          const c = bodyPath.getPointAt(t);
          const r = bodyRadius(t);
          const spot = mesh(new THREE.SphereGeometry(0.03 * (1 - t * 0.4), 10, 8), glow, this.body);
          spot.position.set(s * r * 0.93, c.y, c.z + r * 0.2);
          spot.scale.set(0.35, 1, 1);
        }
      }
    }

    // Neck and head (the neck group nods; the head looks at the player).
    this.neck.position.set(0, 0.8, 0.06);
    this.body.add(this.neck);
    // Starts wide and low inside the shoulders so it grows out of the body instead of sitting on it.
    mesh(sweep(curve([0, -0.16, -0.04], [0, 0.04, 0.0], [0, 0.2, 0.06], [0, 0.34, 0.15], [0, 0.42, 0.24]), colors, { radius: (t) => 0.2 - t * 0.11, depth: 0.9, round: [0.12, 0.12], bellyFrom: 0.45 }), skin, this.neck);
    // Spikes down the back of the neck.
    for (let i = 0; i < 5; i++) {
      const t = i / 5;
      const y = -0.02 + t * 0.4;
      const z = -0.1 + t * 0.22 - 0.02;
      mesh(spike([[0, y, z], [0, y + 0.05 * spikeSize, z - 0.07 * spikeSize], [0, y + 0.08 * spikeSize, z - 0.12 * spikeSize]], (0.025 - t * 0.008) * spikeSize, bone), ivory, this.neck);
    }

    this.head.position.set(0, 0.42, 0.24);
    // Big head: it's the prize target, and the camera sees it from above.
    const headSize = look.headSize ?? 1.55;
    this.head.scale.setScalar(headSize);
    this.neck.add(this.head);
    const headColors = { main, belly };
    // Skull: wide at the back, tapering to the snout, a little flattened.
    mesh(
      sweep(curve([0, 0.02, -0.08], [0, 0.04, 0.06], [0, 0.01, 0.2], [0, -0.02, 0.33]), headColors, {
        radius: (t) => 0.11 - t * 0.06 + Math.sin(Math.PI * t) * 0.015,
        width: 1.05,
        depth: 0.72,
        round: [0.3, 0.12],
        ref: v3(1, 0, 0),
        ventral: v3(0, -1, 0),
      }),
      skin,
      this.head,
    );
    // Brow ridges over the eyes.
    for (const s of [-1, 1]) {
      mesh(sweep(curve([s * 0.035, 0.075, 0.04], [s * 0.08, 0.08, 0.1], [s * 0.065, 0.06, 0.17]), colors, { radius: (t) => 0.026 * (1 - t * 0.6), segments: 10, radial: 8, ref: v3(0, 1, 0) }), skin, this.head);
      // Eye: a glowing ball with a dark slit pupil.
      const eye = mesh(new THREE.SphereGeometry(0.026 * (look.eyeSize ?? 1), 16, 12), eyeGlow, this.head);
      eye.position.set(s * 0.086, 0.045, 0.125);
      const pupil = mesh(new THREE.SphereGeometry(0.026 * (look.eyeSize ?? 1), 12, 8), dark, eye);
      pupil.scale.set(0.18, 0.85, 0.5);
      pupil.position.set(s * 0.008, 0, 0.012);
      this.horns(look.horns, s, bone, ivory, mesh);
      if (look.whiskers) {
        extra(mesh(spike([[s * 0.04, -0.01, 0.3], [s * 0.12, -0.05, 0.35], [s * 0.2, -0.14, 0.33], [s * 0.24, -0.26, 0.28]], 0.009, bone, v3(0, 0, 1)), ivory, this.head));
      }
      // Nostril.
      const nostril = mesh(new THREE.SphereGeometry(0.01, 8, 6), dark, this.head);
      nostril.position.set(s * 0.026, 0.008, 0.325);
      nostril.scale.set(1.4, 0.6, 1);
      // Upper fangs.
      for (const z of [0.16, 0.22, 0.28]) mesh(spike([[s * 0.045, -0.035, z], [s * 0.045, -0.07, z + 0.005]], 0.011, bone), ivory, this.head);
    }
    if (look.horns === 'crown') {
      // A horn on the nose.
      extra(mesh(spike([[0, 0.03, 0.25], [0, 0.08, 0.28], [0, 0.13, 0.27]], 0.022, bone), ivory, this.head));
    }
    if (look.frill) {
      // A fan of spines behind the head, webbed with wing skin.
      const hub = v3(0, 0.02, -0.07);
      const tips: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = -1.75 + (3.5 * i) / 6;
        tips.push(v3(Math.sin(a) * 0.24, 0.02 + Math.cos(a) * 0.22, -0.15));
      }
      for (const tip of tips) extra(mesh(spike([[hub.x, hub.y, hub.z], [tip.x, tip.y, tip.z]], 0.012, bone, v3(0, 0, 1)), ivory, this.head));
      extra(mesh(membrane(hub, tips, 0, 0.18, 0, 9), wingSkin, this.head));
    }
    // A ridge of small spikes along the top of the skull.
    for (let i = 0; i < 4; i++) {
      const z = -0.07 + i * 0.05;
      mesh(spike([[0, 0.08, z], [0, 0.12, z - 0.04]], 0.016, bone), ivory, this.head);
    }
    // Lower jaw, hinged at the back so it can open.
    this.jaw.position.set(0, -0.04, 0.0);
    this.head.add(this.jaw);
    mesh(
      sweep(curve([0, 0, -0.02], [0, -0.03, 0.14], [0, -0.035, 0.29]), headColors, { radius: (t) => 0.068 - t * 0.035, width: 1.05, depth: 0.5, ventral: v3(0, -1, 0), round: [0.2, 0.15] }),
      skin,
      this.jaw,
    );
    const tongue = mesh(new THREE.SphereGeometry(0.05, 12, 8), mouth, this.jaw);
    tongue.scale.set(0.8, 0.25, 2.2);
    tongue.position.set(0, -0.005, 0.15);
    for (const s of [-1, 1]) for (const z of [0.18, 0.25]) mesh(spike([[s * 0.035, -0.01, z], [s * 0.035, 0.02, z]], 0.009, bone), ivory, this.jaw);
    this.mouthMarker.position.set(0, -0.06, 0.38);
    this.head.add(this.mouthMarker);

    // Tail: three segments that sway one after another, ending in a spade.
    // It curls out to one side below the wing, where the player can see (and hit) it.
    const tailPath = curve([0, -0.02, -0.2], [0.05, -0.25, -0.4], [0.3, -0.42, -0.5], [0.62, -0.46, -0.36], [0.88, -0.4, -0.1]);
    const cuts = [0, 0.34, 0.67, 1];
    let parent: THREE.Object3D = this.body;
    let origin = v3(0, 0, 0);
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group();
      const start = tailPath.getPointAt(cuts[i]);
      seg.position.copy(start.clone().sub(origin));
      parent.add(seg);
      const pts: [number, number, number][] = [];
      for (let s = 0; s <= 6; s++) {
        const p = tailPath.getPointAt(cuts[i] + ((cuts[i + 1] - cuts[i]) * s) / 6).sub(start);
        pts.push([p.x, p.y, p.z]);
      }
      // Overlap the next segment a little so bends never show a gap.
      const more = tailPath.getPointAt(Math.min(1, cuts[i + 1] + 0.03)).sub(start);
      pts.push([more.x, more.y, more.z]);
      const r0 = 0.17 * (1 - cuts[i]) + 0.014;
      const r1 = 0.17 * (1 - cuts[i + 1]) + 0.014;
      mesh(sweep(curve(...pts), colors, { radius: (t) => r0 + (r1 - r0) * t, segments: 14, ventral: v3(0, 0, 1), round: [i ? 0.12 : 0.3, i === 2 ? 0.1 : 0] }), skin, seg);
      // Back spikes.
      for (let s = 1; s < 4; s++) {
        const p = tailPath.getPointAt(cuts[i] + ((cuts[i + 1] - cuts[i]) * s) / 4).sub(start);
        const r = r0 + ((r1 - r0) * s) / 4;
        mesh(spike([[p.x, p.y, p.z - r * 0.8], [p.x, p.y + 0.02, p.z - r * 0.8 - 0.06 * (1 - cuts[i]) * spikeSize]], (0.02 * (1 - cuts[i]) + 0.006) * spikeSize, bone), ivory, seg);
        if (glow && i < 2) {
          for (const side of [-1, 1]) {
            const spot = mesh(new THREE.SphereGeometry(0.022 * (1 - cuts[i] * 0.6), 8, 6), glow, seg);
            spot.position.set(p.x + side * r * 0.75, p.y, p.z + r * 0.4);
            spot.scale.set(0.4, 1, 1);
          }
        }
      }
      this.tail.push(seg);
      parent = seg;
      origin = start;
    }
    // The spade at the tip.
    const tip = tailPath.getPointAt(1).sub(origin);
    const pale = (m: THREE.Mesh) => m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(m.geometry.getAttribute('position').count * 3).fill(0.9), 3));
    if (look.tail === 'spade') {
      const spade = mesh(new THREE.ConeGeometry(0.06, 0.16, 4), ivory, this.tail[2]);
      spade.position.set(tip.x + 0.03, tip.y, tip.z + 0.06);
      spade.rotation.set(Math.PI / 2.4, 0, -0.9);
      spade.scale.set(1, 1, 0.3);
      pale(spade);
    } else if (look.tail === 'club') {
      // A bony club studded with spikes.
      const club = mesh(new THREE.IcosahedronGeometry(0.075, 1), ivory, this.tail[2]);
      club.position.set(tip.x + 0.02, tip.y, tip.z + 0.03);
      pale(club);
      const rand = seededRandom(31);
      for (let i = 0; i < 7; i++) {
        const d = v3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        const a = club.position.clone().addScaledVector(d, 0.06);
        const b = club.position.clone().addScaledVector(d, 0.13);
        mesh(spike([[a.x, a.y, a.z], [b.x, b.y, b.z]], 0.022, bone, Math.abs(d.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0)), ivory, this.tail[2]);
      }
    } else {
      // A blade-like fin: three flat points fanned out.
      for (const [angle, len] of [[-0.9, 0.3], [-1.4, 0.2], [-0.4, 0.2]] as const) {
        const blade = mesh(new THREE.ConeGeometry(0.055, len, 4), ivory, this.tail[2]);
        blade.position.set(tip.x + 0.03, tip.y, tip.z + 0.06);
        blade.rotation.set(Math.PI / 2.4, 0, angle);
        blade.scale.set(1, 1, 0.25);
        blade.translateY(len / 2 - 0.04);
        pale(blade);
      }
    }

    // Limbs. Arms (the breakable claws) hang from the chest; legs from the hips.
    const limb = (s: number, joints: [number, number, number][], thick: number, parentGroup: THREE.Object3D) => {
      const g = new THREE.Group();
      const [ox, oy, oz] = joints[0];
      g.position.set(s * ox, oy, oz);
      parentGroup.add(g);
      const local = joints.map(([x, y, z]) => [s * x - s * ox, y - oy, z - oz] as [number, number, number]);
      mesh(sweep(curve(...local), colors, { radius: (t) => thick * (1 - t * 0.55) + Math.sin(Math.PI * t) * thick * 0.25, segments: 16, radial: 12, ref: v3(0, 0, 1), bellyFrom: 2, round: [0.2, 0.1] }), skin, g);
      // Three talons from the end, pointing forward and down.
      const [ex, ey, ez] = local[local.length - 1];
      for (const spread of [-1, 0, 1]) {
        mesh(spike([[ex + spread * thick * 0.5, ey, ez], [ex + spread * thick * 0.9, ey - thick * 0.6, ez + thick * 1.2], [ex + spread * thick * 1.0, ey - thick * 1.4, ez + thick * 1.6]], thick * 0.35, bone, v3(1, 0, 0)), ivory, g);
      }
      return g;
    };
    this.arms = {
      // Upper arm back and down, forearm raised forward: claws held out in front of the chest.
      L: limb(-1, ARM, 0.075 * bulk, this.body),
      R: limb(1, ARM, 0.075 * bulk, this.body),
    };
    // Legs drawn up while flying: knees forward, shins tucked back, feet hanging.
    for (const s of [-1, 1]) limb(s, [[0.15, 0.06, -0.06], [0.29, -0.04, 0.2], [0.28, -0.27, 0.1], [0.27, -0.35, 0.2]], 0.1 * bulk, this.body);

    // Wings: arm bones out to the wrist, four fingers fanning out, membranes between.
    const wing = (s: number) => {
      const g = new THREE.Group();
      const shoulder = v3(0.13, 0.7, -0.12);
      g.position.set(s * shoulder.x, shoulder.y, shoulder.z);
      this.body.add(g);
      const P = (x: number, y: number, z: number) => v3(s * x, y, z).sub(v3(s * shoulder.x, shoulder.y, shoulder.z));
      const S = P(0.13, 0.7, -0.12);
      const E = P(0.55, 0.92, -0.22);
      const W = P(1.0, 0.8, -0.2);
      const span = look.wings === 'broad' ? 1.15 : 1;
      const F = [P(1.78 * span, 1.02 * span, -0.26), P(1.8 * span, 0.5, -0.26), P(1.55 * span, 0.06, -0.22), P(1.08 * span, -0.18, -0.2)];
      const B = P(0.12, 0.12, -0.16);
      const bones = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) =>
        mesh(sweep(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(v3(0, 0.02, 0)), b]), colors, { radius: (t) => r0 + (r1 - r0) * t, segments: 10, radial: 10, ref: v3(0, 0, 1), ventral: v3(0, -1, 0), bellyFrom: 0.7, round: [0.15, 0.1] }), skin, g);
      bones(S, E, 0.055, 0.04);
      bones(E, W, 0.04, 0.03);
      for (const f of F) bones(W, f, 0.022, 0.006);
      // Thumb claw at the wrist.
      mesh(spike([[W.x, W.y, W.z], [W.x + s * 0.02, W.y + 0.06, W.z + 0.03], [W.x + s * 0.0, W.y + 0.1, W.z + 0.07]], 0.02, bone), ivory, g);
      // Membranes: between the fingers, and from the last finger back to the body.
      const sag = look.wings === 'ragged' ? 0.28 : look.wings === 'broad' ? 0.14 : 0.2;
      const jag = look.wings === 'ragged' ? 0.25 : 0;
      mesh(membrane(W, F, 0, sag, jag, s > 0 ? 11 : 12), wingSkin, g);
      mesh(membrane(S, [E, W, F[3], B], 2, sag, jag, s > 0 ? 13 : 14), wingSkin, g);
      return g;
    };
    this.wings = { L: wing(-1), R: wing(1) };

    this.parts.set('wingL', this.wings.L);
    this.parts.set('wingR', this.wings.R);
    this.parts.set('clawL', this.arms.L);
    this.parts.set('clawR', this.arms.R);
    this.parts.set('tail', this.tail[1]);

    // Hit markers: points inside each part that the hit spheres center on.
    const marker = (part: PartId, parentObj: THREE.Object3D, p: THREE.Vector3, radius: number) => {
      const o = new THREE.Object3D();
      o.position.copy(p);
      parentObj.add(o);
      this.markers.push({ part, object: o, radius });
    };
    // Generous on purpose: a real ball off the wall is never pin-point.
    marker('head', this.head, v3(0, 0.0, 0.1), 0.19 * headSize);
    marker('body', this.body, v3(0, 0.38, 0.1), 0.4 * bulk);
    marker('wingL', this.wings.L, v3(-1.05, -0.2, -0.1), 0.6);
    marker('wingR', this.wings.R, v3(1.05, -0.2, -0.1), 0.6);
    // Around the forearm and hand.
    const hand = v3(ARM[2][0] - ARM[0][0], ARM[2][1] - ARM[0][1], ARM[2][2] - ARM[0][2]);
    marker('clawL', this.arms.L, v3(-hand.x, hand.y, hand.z + 0.04), 0.29);
    marker('clawR', this.arms.R, v3(hand.x, hand.y, hand.z + 0.04), 0.29);
    // On the visible curl, inside the piece that breaks off.
    marker('tail', this.tail[1], tailPath.getPointAt(0.72).sub(tailPath.getPointAt(0.34)), 0.31);

    // Scale to the requested height and stand the lowest point (the tail tip) on y = 0.
    const inner = new THREE.Group();
    inner.add(this.body);
    this.root.add(inner);
    inner.updateMatrixWorld(true);
    // Measure without horns, frills and whiskers, so every dragon's body comes out the same size.
    const box = new THREE.Box3();
    inner.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.userData.extra) return;
      o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
    });
    this.scale = size / (box.max.y - box.min.y);
    inner.scale.setScalar(this.scale);
    inner.position.y = -box.min.y * this.scale;
  }

  /** One side's horns (s = -1 left, 1 right), in head units. They don't count toward the dragon's size. */
  private horns(
    kind: DragonLook['horns'],
    s: number,
    bone: { main: THREE.Color; belly: THREE.Color },
    ivory: THREE.Material,
    mesh: (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D) => THREE.Mesh,
  ): void {
    const horn = (points: [number, number, number][], base: number, ref?: THREE.Vector3) => {
      mesh(spike(points, base, bone, ref), ivory, this.head).userData.extra = true;
    };
    const swept = () => horn([[s * 0.06, 0.07, -0.02], [s * 0.1, 0.16, -0.1], [s * 0.13, 0.27, -0.12], [s * 0.12, 0.37, -0.06]], 0.038);
    const cheek = () => horn([[s * 0.09, -0.01, -0.02], [s * 0.15, 0.0, -0.08], [s * 0.2, 0.03, -0.1]], 0.022, v3(0, 1, 0));
    switch (kind) {
      case 'none':
        return;
      case 'nubs':
        horn([[s * 0.055, 0.07, -0.01], [s * 0.07, 0.11, -0.04], [s * 0.075, 0.14, -0.07]], 0.032);
        return;
      case 'swept':
        swept();
        cheek();
        return;
      case 'ram':
        // Thick horns curling back, down and forward beside the face.
        horn([[s * 0.07, 0.07, -0.02], [s * 0.15, 0.13, -0.09], [s * 0.22, 0.08, -0.15], [s * 0.25, -0.03, -0.11], [s * 0.22, -0.08, -0.02], [s * 0.18, -0.04, 0.04]], 0.05);
        return;
      case 'crown':
        swept();
        cheek();
        // More horns fanning back behind the main pair.
        for (let k = 1; k <= 3; k++) {
          const x = s * (0.05 + 0.025 * k);
          horn([[x, 0.06 - 0.02 * k, -0.05], [x * 1.6, 0.12 - 0.02 * k, -0.15], [x * 2.1, 0.2 - 0.05 * k, -0.22 + 0.02 * k]], 0.026 - 0.003 * k);
        }
        return;
    }
  }

  private material(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial(params);
    // Shared by the rig and any pieces broken off it; the rig disposes them.
    m.userData.shared = true;
    this.materials.push(m);
    return m;
  }

  /** Advances the flapping, tail sway, breathing, look-at and any reaction. */
  update(dt: number, camera: THREE.Vector3): void {
    this.time += dt;
    const t = this.time;
    if (this.dead) return;
    const hover = this.mode === 'hover';
    this.flapRate += ((hover ? 1.5 : 2.3) - this.flapRate) * Math.min(1, dt * 2);
    this.flap += dt * Math.PI * 2 * this.flapRate;
    const beat = Math.sin(this.flap);
    const amp = hover ? 0.75 : 0.55;
    for (const [s, w] of [[-1, this.wings.L], [1, this.wings.R]] as const) {
      // Positive z rotation lifts the right wing; mirror it for the left.
      w.rotation.z = s * (0.2 + amp * beat);
      // Sweep back on the upstroke, forward on the downstroke.
      w.rotation.y = s * -0.25 * Math.cos(this.flap);
    }
    // The body lifts a little on each downstroke.
    this.body.position.y = -beat * 0.03;

    // Spring recoil from hits.
    this.recoilSpeed += (-this.recoil * 120 - this.recoilSpeed * 12) * dt;
    this.recoil += this.recoilSpeed * dt;
    this.body.rotation.x = -0.12 - this.recoil;

    this.tail.forEach((seg, i) => (seg.rotation.z = Math.sin(t * 1.6 - i * 0.9) * (0.12 + i * 0.08)));
    this.tail.forEach((seg, i) => (seg.rotation.x = Math.sin(t * 1.1 - i * 0.7) * 0.08));
    for (const [s, a] of [[-1, this.arms.L], [1, this.arms.R]] as const) a.rotation.x = 0.15 * Math.sin(t * 2.2 + s);
    this.neck.rotation.x = 0.06 * Math.sin(t * 1.3) + this.recoil * 0.8;

    // The head turns to watch the player, against however the body is leaning.
    const headWorld = this.head.getWorldPosition(v3(0, 0, 0));
    const toCam = camera.clone().sub(headWorld);
    const yaw = Math.atan2(toCam.x, toCam.z) - this.root.rotation.y;
    this.head.rotation.y += (THREE.MathUtils.clamp(yaw, -0.6, 0.6) - this.head.rotation.y) * Math.min(1, dt * 3);
    // ...and tips up or down to look at the camera (positive x tips the snout down).
    const pitch = Math.atan2(toCam.y, Math.hypot(toCam.x, toCam.z));
    this.head.rotation.x = THREE.MathUtils.clamp(-pitch, -0.5, 0.5) + 0.05 * Math.sin(t * 0.9);

    const wantJaw = performance.now() < this.jawUntil ? 0.55 : 0.08 + 0.05 * Math.sin(t * 0.7);
    this.jawOpen += (wantJaw - this.jawOpen) * Math.min(1, dt * 10);
    this.jaw.rotation.x = this.jawOpen;
  }

  /** Flinch from a hit. */
  hitReact(): void {
    this.recoilSpeed += 4;
  }

  /** Open wide (to spit a fireball, or roar). */
  roar(ms = 600): void {
    this.jawUntil = performance.now() + ms;
  }

  /** Brief white-hot flash on a hit. */
  flash(scheduler: (ms: number, fn: () => void) => void): void {
    for (const m of this.materials) {
      if (m.emissiveIntensity > 1) continue; // the eyes keep glowing
      m.userData.emissive ??= { color: m.emissive.getHex(), intensity: m.emissiveIntensity };
      m.emissive.setHex(0xffffff);
      m.emissiveIntensity = 0.35;
    }
    scheduler(110, () => {
      for (const m of this.materials) {
        const e = m.userData.emissive as { color: number; intensity: number } | undefined;
        if (!e) continue;
        m.emissive.setHex(e.color);
        m.emissiveIntensity = e.intensity;
      }
    });
  }

  /** Death pose: wings fold, head and tail droop, jaw hangs open. */
  die(): void {
    this.dead = true;
    this.wings.L.rotation.set(0, 0.4, 0.9);
    this.wings.R.rotation.set(0, -0.4, -0.9);
    this.neck.rotation.x = 0.6;
    this.head.rotation.set(0.5, 0, 0);
    this.jaw.rotation.x = 0.5;
    this.tail.forEach((seg) => seg.rotation.set(0.15, 0, 0));
  }

  /** Where each unbroken part is in the world, with its hit radius in meters. */
  targets(): { part: PartId; center: THREE.Vector3; radius: number }[] {
    this.root.updateMatrixWorld(true);
    return this.markers
      .filter((m) => m.object.parent && this.isAttached(m.object))
      .map((m) => ({ part: m.part, center: m.object.getWorldPosition(v3(0, 0, 0)), radius: m.radius * this.scale }));
  }

  /** Where fireballs come out. */
  mouth(): THREE.Vector3 {
    return this.mouthMarker.getWorldPosition(v3(0, 0, 0));
  }

  /** Puts something on the head (e.g. armor), in head units: the skull is about 0.22 wide. */
  wear(object: THREE.Object3D): void {
    this.head.add(object);
  }

  /**
   * Breaks a part off. Returns it with its world position, turn and size baked
   * in, ready to add to the scene and throw.
   */
  detach(part: PartId | THREE.Object3D): THREE.Object3D | null {
    const piece = part instanceof THREE.Object3D ? part : this.parts.get(part);
    if (!piece?.parent) return null;
    piece.updateWorldMatrix(true, false);
    const world = piece.matrixWorld.clone();
    piece.removeFromParent();
    world.decompose(piece.position, piece.quaternion, piece.scale);
    return piece;
  }

  private isAttached(o: THREE.Object3D): boolean {
    let p: THREE.Object3D | null = o;
    while (p && p !== this.root) p = p.parent;
    return p === this.root;
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
  }
}
