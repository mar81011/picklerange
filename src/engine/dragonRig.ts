// Dragon Hunt's dragon, built entirely in code (no model file), in a chunky
// cartoon style: a big round head with big shiny eyes, a bean-shaped body with
// a striped belly, stubby limbs with round paws, soft rounded horns and spikes,
// and a dark outline around everything. Each breakable part is its own group,
// so breaking one really detaches it. The dragon faces the player (+z); screen
// left is -x.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { PartId } from '../games/dragon/logic';
import { canvasTexture, seededRandom } from './textures';

export interface DragonLook {
  /** Skin on the back, limbs and head. */
  main: number;
  /** Throat, chest, belly and muzzle. */
  belly: number;
  /** Wing membranes. */
  membrane: number;
  /** Iris color (default gold). */
  eyes?: number;
  horns: 'none' | 'nubs' | 'swept' | 'ram' | 'crown';
  /** bat: smooth scallops; ragged: torn, jagged edges; broad: longer span. */
  wings: 'bat' | 'ragged' | 'broad';
  tail: 'spade' | 'club' | 'blade';
  /** A fan of webbed spines behind the head. */
  frill?: boolean;
  /** Long barbels hanging from the snout. */
  whiskers?: boolean;
  /** Glowing spots down the flanks and tail. */
  glow?: number;
  /** cute: round, raised brows and pink cheeks; mean (default): angry slanted brows. */
  mood?: 'cute' | 'mean';
  /** Multipliers (default 1): back-spike size, body thickness, eye size, head size. */
  spikes?: number;
  bulk?: number;
  eyeSize?: number;
  headSize?: number;
}

type Curve = THREE.CatmullRomCurve3;
type Colors = { main: THREE.Color; belly: THREE.Color };
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const curve = (...points: [number, number, number][]) => new THREE.CatmullRomCurve3(points.map(([x, y, z]) => v3(x, y, z)));

/** Right arm joints (shoulder, elbow, wrist); the left is mirrored. */
const ARM: [number, number, number][] = [[0.19, 0.4, 0.1], [0.29, 0.29, 0.13], [0.25, 0.24, 0.27]];
/** Right wing shoulder. */
const SHOULDER = v3(0.13, 0.44, -0.14);
/** Outline thickness, in model units. */
const OUTLINE = 0.009;

// ---------- Textures and materials (shared by every dragon) ----------

let veinTexture: THREE.CanvasTexture | null = null;

/** Wing membrane: pale skin with soft branching veins (multiplied by the membrane color). */
function membraneTexture(): THREE.CanvasTexture {
  if (veinTexture) return veinTexture;
  veinTexture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#e4dcd4';
    ctx.fillRect(0, 0, 512, 512);
    const rand = seededRandom(5);
    const vein = (x: number, y: number, angle: number, width: number, depth: number) => {
      if (depth > 3 || width < 1) return;
      const len = 60 + rand() * 70;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      ctx.strokeStyle = 'rgba(70,30,35,0.22)';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo((x + nx) / 2 + (rand() - 0.5) * 20, (y + ny) / 2 + (rand() - 0.5) * 20, nx, ny);
      ctx.stroke();
      vein(nx, ny, angle + (rand() - 0.5) * 0.6 - 0.35, width * 0.7, depth + 1);
      vein(nx, ny, angle + (rand() - 0.5) * 0.6 + 0.35, width * 0.65, depth + 1);
    };
    for (let i = 0; i < 6; i++) vein(rand() * 60, rand() * 512, (rand() - 0.5) * 0.8, 6, 0);
  });
  veinTexture.wrapS = veinTexture.wrapT = THREE.RepeatWrapping;
  veinTexture.userData.shared = true;
  return veinTexture;
}

let environment: THREE.Texture | null = null;

/** A soft studio reflection so the skin catches highlights. */
function environmentMap(renderer: THREE.WebGLRenderer): THREE.Texture {
  if (environment) return environment;
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  environment.userData.shared = true;
  pmrem.dispose();
  return environment;
}

let outlineMaterial: THREE.MeshBasicMaterial | null = null;

/** Cartoon ink line: the back faces, pushed out along the normals. */
function outline(): THREE.MeshBasicMaterial {
  if (outlineMaterial) return outlineMaterial;
  outlineMaterial = new THREE.MeshBasicMaterial({ color: 0x160a0c, side: THREE.BackSide });
  outlineMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE.toFixed(4)};`);
  };
  outlineMaterial.userData.shared = true;
  return outlineMaterial;
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
  /** Where the belly color starts (dot with `ventral`); higher = a narrower stripe. Above 1 = no belly. */
  bellyFrom?: number;
  /** Dark lines across the belly, per unit of length. */
  bands?: number;
  /** Round the ends into domes over this fraction of the length (start, end), instead of flat caps. */
  round?: [number, number];
}

/** A tube with a varying, oval cross-section swept along a curve, with belly coloring. */
function sweep(path: Curve, look: Colors, o: SweepOptions): THREE.BufferGeometry {
  const segments = o.segments ?? 32;
  const radial = o.radial ?? 20;
  const ref = o.ref ?? v3(1, 0, 0);
  const ventral = o.ventral ?? v3(0, 0, 1);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const [round0, round1] = o.round ?? [0, 0];
  const dome = (x: number) => Math.sqrt(Math.max(0, 1 - (1 - x) ** 2)) * 0.97 + 0.03;
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
    const r = o.radius(t) * (t < round0 ? dome(t / round0) : 1) * (1 - t < round1 ? dome((1 - t) / round1) : 1);
    const band = o.bands ? (0.5 + 0.5 * Math.cos(2 * Math.PI * length * o.bands)) ** 14 : 0;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const dir = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(front, Math.sin(a));
      const p = center.clone().addScaledVector(side, Math.cos(a) * r * (o.width ?? 1)).addScaledVector(front, Math.sin(a) * r * (o.depth ?? 1));
      positions.push(p.x, p.y, p.z);
      const belly = THREE.MathUtils.smoothstep(dir.dot(ventral), o.bellyFrom ?? 0.3, (o.bellyFrom ?? 0.3) + 0.25);
      color.copy(look.main).lerp(look.belly, belly).multiplyScalar(1 - band * belly * 0.3);
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
  // Caps: a center point fanned to the first and last rings (tiny when the ends are rounded).
  for (const [ring, t, flip] of [[0, 0, true], [segments, 1, false]] as const) {
    const c = path.getPointAt(t);
    const centerIndex = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    colors.push(...colors.slice(ring * (radial + 1) * 3, ring * (radial + 1) * 3 + 3));
    for (let j = 0; j < radial; j++) {
      const a = ring * (radial + 1) + j;
      indices.push(...(flip ? [centerIndex, a + 1, a] : [centerIndex, a, a + 1]));
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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

/** A soft horn, claw, tooth or spike: a sweep that tapers to a rounded tip. */
function spike(points: [number, number, number][], base: number, look: Colors, ref = v3(1, 0, 0)): THREE.BufferGeometry {
  return sweep(curve(...points), look, { radius: (t) => base * (1 - 0.78 * t), segments: 12, radial: 10, ref, round: [0, 0.3], bellyFrom: 2 });
}

/** A sphere colored main on top and belly underneath (toward `ventral`). */
function ball(radius: number, look: Colors, ventral = v3(0, -1, 0), bellyFrom = 0.2): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(radius, 28, 20);
  const n = g.getAttribute('normal');
  const colors: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < n.count; i++) {
    const d = n.getX(i) * ventral.x + n.getY(i) * ventral.y + n.getZ(i) * ventral.z;
    color.copy(look.main).lerp(look.belly, THREE.MathUtils.smoothstep(d, bellyFrom, bellyFrom + 0.25));
    colors.push(color.r, color.g, color.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return g;
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
  const across = 8;
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
      p.z -= Math.sin(Math.PI * v) * 0.05 * Math.sin((Math.PI * e) / (edge.length - 1));
      positions.push(p.x, p.y, p.z);
      uvs.push(p.x * 1.6, p.y * 1.6);
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
  /** Center and radius of the skull, in head units (for fitting a helmet). */
  private cranium = { center: v3(0, 0.09, -0.01), radius: 0.2 };
  /** Model units to meters. */
  readonly scale: number;

  constructor(look: DragonLook, size: number, renderer: THREE.WebGLRenderer) {
    const main = new THREE.Color(look.main);
    const belly = new THREE.Color(look.belly);
    const colors = { main, belly };
    const bone = { main: new THREE.Color(0xf2e6c8), belly: new THREE.Color(0xf2e6c8) };
    const env = environmentMap(renderer);
    const cute = look.mood === 'cute';

    const skin = this.material({ vertexColors: true, roughness: 0.42, metalness: 0, envMap: env, envMapIntensity: 0.5 });
    const ivory = this.material({ vertexColors: true, roughness: 0.5, metalness: 0, envMap: env, envMapIntensity: 0.3 });
    const wingSkin = this.material({ color: look.membrane, map: membraneTexture(), side: THREE.DoubleSide, roughness: 0.7, emissive: look.membrane, emissiveIntensity: 0.15, envMap: env, envMapIntensity: 0.2 });
    const white = this.material({ color: 0xffffff, roughness: 0.15, envMap: env, envMapIntensity: 0.6 });
    const iris = this.material({ color: look.eyes ?? 0xffc23a, emissive: look.eyes ?? 0xffa21a, emissiveIntensity: 0.6, roughness: 0.2 });
    const dark = this.material({ color: 0x120808, roughness: 0.2, envMap: env, envMapIntensity: 0.6 });
    const mouth = this.material({ color: 0x6a1820, roughness: 0.6, emissive: 0xff3a10, emissiveIntensity: 0.12 });
    const tongueSkin = this.material({ color: 0xe0606a, roughness: 0.5 });
    // Pure white catch-lights, so the eyes look wet and alive.
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.ownedBasic.push(shine);
    const inked = new Set<THREE.Material>([skin, ivory]);

    const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = true;
      parent.add(m);
      if (inked.has(material)) {
        const ink = new THREE.Mesh(geometry, outline());
        ink.userData.extra = true;
        m.add(ink);
      }
      return m;
    };
    /** Marks a mesh as decoration that doesn't count toward the dragon's size. */
    const extra = (m: THREE.Mesh) => ((m.userData.extra = true), m);

    // Body: a chubby bean, posed upright as if hovering, with a striped belly.
    const bulk = look.bulk ?? 1;
    const spikeSize = look.spikes ?? 1;
    const bodyPath = curve([0, 0.0, -0.03], [0, 0.18, 0.01], [0, 0.36, 0.02], [0, 0.52, -0.01]);
    const bodyRadius = (t: number) => (0.25 + Math.sin(Math.PI * t) * 0.05 - t * 0.07) * bulk;
    mesh(sweep(bodyPath, colors, { radius: bodyRadius, depth: 0.92, round: [0.42, 0.3], bellyFrom: 0.15, bands: 14 }), skin, this.body);
    // Soft back plates.
    for (let i = 0; i < 4; i++) {
      const t = 0.25 + i * 0.18;
      const c = bodyPath.getPointAt(t);
      const z = c.z - bodyRadius(t) * 0.88;
      const h = 0.07 * spikeSize;
      mesh(spike([[0, c.y, z + 0.03], [0, c.y + h * 0.5, z - h * 0.6], [0, c.y + h * 0.9, z - h]], 0.035 * spikeSize, bone, v3(1, 0, 0)), ivory, this.body);
    }
    const glow = look.glow !== undefined ? this.material({ color: look.glow, emissive: look.glow, emissiveIntensity: 1.6, roughness: 0.4 }) : null;
    if (glow) {
      for (const s of [-1, 1]) {
        for (let i = 1; i < 5; i++) {
          const t = 0.15 + i * 0.15;
          const c = bodyPath.getPointAt(t);
          const r = bodyRadius(t);
          const spot = mesh(new THREE.SphereGeometry(0.025, 12, 8), glow, this.body);
          spot.position.set(s * r * 0.86, c.y, c.z - r * 0.4);
          spot.scale.set(0.4, 1, 1);
        }
      }
    }

    // A short neck (it nods) and a big head (it looks at the player).
    this.neck.position.set(0, 0.46, 0.0);
    this.body.add(this.neck);
    mesh(sweep(curve([0, -0.08, -0.02], [0, 0.04, 0.02], [0, 0.14, 0.05]), colors, { radius: () => 0.15 * bulk, depth: 0.95, round: [0.3, 0.3], bellyFrom: 0.15 }), skin, this.neck);
    this.head.position.set(0, 0.16, 0.06);
    this.head.scale.setScalar(look.headSize ?? 1);
    this.neck.add(this.head);
    this.buildHead(look, colors, bone, { skin, ivory, wingSkin, white, iris, dark, mouth, tongueSkin, shine }, mesh, extra, cute);

    // Tail: three chunky segments that sway one after another. It curls out
    // to one side below the wing, where the player can see (and hit) it.
    const tailPath = curve([0, 0.06, -0.16], [0.04, -0.07, -0.32], [0.24, -0.16, -0.38], [0.48, -0.13, -0.24], [0.62, -0.01, -0.04]);
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
      const more = tailPath.getPointAt(Math.min(1, cuts[i + 1] + 0.04)).sub(start);
      pts.push([more.x, more.y, more.z]);
      const r0 = (0.15 * (1 - cuts[i]) + 0.035) * bulk;
      const r1 = (0.15 * (1 - cuts[i + 1]) + 0.035) * bulk;
      mesh(sweep(curve(...pts), colors, { radius: (t) => r0 + (r1 - r0) * t, segments: 16, ventral: v3(0, -0.4, 1).normalize(), bellyFrom: 0.35, round: [i ? 0.15 : 0.35, i === 2 ? 0.15 : 0] }), skin, seg);
      // Soft back plates.
      for (let s = 1; s < 3; s++) {
        const p = tailPath.getPointAt(cuts[i] + ((cuts[i + 1] - cuts[i]) * s) / 3).sub(start);
        const r = r0 + ((r1 - r0) * s) / 3;
        const h = (0.06 * (1 - cuts[i] * 0.5)) * spikeSize;
        mesh(spike([[p.x, p.y + r * 0.6, p.z - r * 0.6], [p.x, p.y + r * 0.6 + h * 0.6, p.z - r * 0.6 - h * 0.6], [p.x, p.y + r * 0.6 + h, p.z - r * 0.6 - h * 0.7]], (0.03 * (1 - cuts[i] * 0.5)) * spikeSize, bone), ivory, seg);
        if (glow && i < 2) {
          for (const side of [-1, 1]) {
            const spot = mesh(new THREE.SphereGeometry(0.02, 10, 8), glow, seg);
            spot.position.set(p.x + side * r * 0.8, p.y + r * 0.3, p.z);
            spot.scale.set(0.4, 1, 1);
          }
        }
      }
      this.tail.push(seg);
      parent = seg;
      origin = start;
    }
    this.tailTip(look.tail, tailPath.getPointAt(1).sub(origin), tailPath.getTangentAt(1), bone, ivory, mesh);

    // Limbs: stubby, with round paws and soft claws. Arms (the breakable
    // claws) are held up in front of the chest; legs are drawn up.
    const limb = (s: number, joints: [number, number, number][], thick: number, parentGroup: THREE.Object3D, foot: boolean) => {
      const g = new THREE.Group();
      const [ox, oy, oz] = joints[0];
      g.position.set(s * ox, oy, oz);
      parentGroup.add(g);
      const local = joints.map(([x, y, z]) => v3(s * x - s * ox, y - oy, z - oz));
      mesh(sweep(new THREE.CatmullRomCurve3(local), colors, { radius: (t) => thick * (1 - t * 0.3), segments: 16, radial: 14, ref: v3(0, 0, 1), bellyFrom: 2, round: [0.3, 0.15] }), skin, g);
      const end = local[local.length - 1];
      const dir = end.clone().sub(local[local.length - 2]).normalize();
      // Paw: a squashed ball at the end, with three little claws poking forward.
      const paw = mesh(ball(thick * (foot ? 1.0 : 1.05), colors, v3(0, -1, 0), 0.6), skin, g);
      paw.position.copy(end).addScaledVector(foot ? v3(0, -0.2, 1).normalize() : dir, thick * 0.55);
      paw.scale.set(1.05, foot ? 0.62 : 0.85, foot ? 1.35 : 1.1);
      const ahead = foot ? v3(0, -0.15, 1).normalize() : v3(0, -0.6, 1).normalize();
      for (const spread of [-1, 0, 1]) {
        const a = paw.position.clone().add(v3(spread * thick * 0.55, foot ? -thick * 0.2 : 0, 0)).addScaledVector(ahead, thick * (foot ? 1.2 : 0.85));
        const b = a.clone().addScaledVector(ahead, thick * 0.45).add(v3(spread * thick * 0.12, -thick * 0.25, 0));
        mesh(spike([[a.x, a.y, a.z], [b.x, b.y, b.z]], thick * 0.24, bone, v3(1, 0, 0)), ivory, g);
      }
      return g;
    };
    this.arms = {
      L: limb(-1, ARM, 0.068 * bulk, this.body, false),
      R: limb(1, ARM, 0.068 * bulk, this.body, false),
    };
    for (const s of [-1, 1]) limb(s, [[0.15, 0.1, 0.0], [0.24, 0.02, 0.17], [0.23, -0.1, 0.12]], 0.09 * bulk, this.body, true);

    // Wings: arm bones out to the wrist, four fingers fanning out, membranes between.
    const wingCenter = v3(0, 0, 0);
    const wing = (s: number) => {
      const g = new THREE.Group();
      g.position.set(s * SHOULDER.x, SHOULDER.y, SHOULDER.z);
      this.body.add(g);
      const P = (x: number, y: number, z: number) => v3(s * x, y, z).sub(v3(s * SHOULDER.x, SHOULDER.y, SHOULDER.z));
      const span = look.wings === 'broad' ? 1.15 : 1;
      const S = P(SHOULDER.x, SHOULDER.y, SHOULDER.z);
      const E = P(0.42, 0.66, -0.22);
      const W = P(0.74 * span, 0.6, -0.2);
      const F = [P(1.28 * span, 0.86, -0.25), P(1.36 * span, 0.46, -0.25), P(1.18 * span, 0.12, -0.22), P(0.84 * span, -0.04, -0.2)];
      const B = P(0.14, 0.06, -0.18);
      const bones = (a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number) =>
        mesh(sweep(new THREE.CatmullRomCurve3([a, a.clone().lerp(b, 0.5).add(v3(0, 0.02, 0)), b]), colors, { radius: (t) => r0 + (r1 - r0) * t, segments: 12, radial: 12, ref: v3(0, 0, 1), bellyFrom: 2, round: [0.15, 0.15] }), skin, g);
      bones(S, E, 0.042, 0.034);
      bones(E, W, 0.034, 0.028);
      for (const f of F) bones(W, f, 0.02, 0.011);
      // Thumb claw at the wrist.
      mesh(spike([[W.x, W.y + 0.02, W.z], [W.x + s * 0.01, W.y + 0.07, W.z + 0.03]], 0.02, bone), ivory, g);
      const sag = look.wings === 'ragged' ? 0.3 : look.wings === 'broad' ? 0.18 : 0.24;
      const jag = look.wings === 'ragged' ? 0.2 : 0;
      mesh(membrane(W, F, 0, sag, jag, s > 0 ? 11 : 12), wingSkin, g);
      mesh(membrane(S, [E, W, F[3], B], 2, sag, jag, s > 0 ? 13 : 14), wingSkin, g);
      if (s > 0) wingCenter.copy(F.reduce((sum, f) => sum.add(f), W.clone()).divideScalar(F.length + 1));
      return g;
    };
    this.wings = { L: wing(-1), R: wing(1) };

    this.parts.set('wingL', this.wings.L);
    this.parts.set('wingR', this.wings.R);
    this.parts.set('clawL', this.arms.L);
    this.parts.set('clawR', this.arms.R);
    this.parts.set('tail', this.tail[1]);

    // Hit markers: points inside each part that the hit spheres center on.
    // Generous on purpose: a real ball off the wall is never pin-point.
    const marker = (part: PartId, parentObj: THREE.Object3D, p: THREE.Vector3, radius: number) => {
      const o = new THREE.Object3D();
      o.position.copy(p);
      parentObj.add(o);
      this.markers.push({ part, object: o, radius });
    };
    const headSize = look.headSize ?? 1;
    marker('head', this.head, v3(0, 0.05, 0.06), 0.27 * headSize);
    marker('body', this.body, v3(0, 0.24, 0.06), 0.3 * bulk);
    marker('wingL', this.wings.L, v3(-wingCenter.x, wingCenter.y, wingCenter.z), 0.52);
    marker('wingR', this.wings.R, wingCenter, 0.52);
    // Around the forearm and paw.
    const hand = v3(ARM[2][0] - ARM[0][0], ARM[2][1] - ARM[0][1], ARM[2][2] - ARM[0][2] + 0.05);
    marker('clawL', this.arms.L, v3(-hand.x, hand.y, hand.z), 0.24);
    marker('clawR', this.arms.R, hand, 0.24);
    // On the visible curl, inside the piece that breaks off.
    marker('tail', this.tail[1], tailPath.getPointAt(0.62).sub(tailPath.getPointAt(0.34)), 0.27);

    // Scale to the requested height and stand the lowest point on y = 0.
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

  private ownedBasic: THREE.Material[] = [];

  /** The head: round skull, wide muzzle, hinged jaw, big shiny eyes, brows and horns. In head units. */
  private buildHead(
    look: DragonLook,
    colors: Colors,
    bone: Colors,
    m: Record<'skin' | 'ivory' | 'wingSkin' | 'white' | 'iris' | 'dark' | 'mouth' | 'tongueSkin' | 'shine', THREE.Material>,
    mesh: (g: THREE.BufferGeometry, mat: THREE.Material, p: THREE.Object3D) => THREE.Mesh,
    extra: (mm: THREE.Mesh) => THREE.Mesh,
    cute: boolean,
  ): void {
    const head = this.head;
    const { center, radius } = this.cranium;
    const skull = mesh(ball(radius, colors, v3(0, -0.3, 1).normalize(), 0.55), m.skin, head);
    skull.position.copy(center);
    skull.scale.set(1.08, 0.94, 1);
    // Muzzle: wide and round, pale underneath.
    const muzzle = mesh(ball(0.13, colors, v3(0, -1, 0.3).normalize(), 0.05), m.skin, head);
    muzzle.position.set(0, 0.02, 0.17);
    muzzle.scale.set(1.12, 0.72, 1.12);
    for (const s of [-1, 1]) {
      // Nostrils on top of the muzzle.
      const nostril = mesh(new THREE.SphereGeometry(0.014, 10, 8), m.dark, head);
      nostril.position.set(s * 0.045, 0.085, 0.27);
      nostril.scale.set(1.3, 0.6, 0.9);
      // A little fang over the lip.
      mesh(spike([[s * 0.07, -0.025, 0.25], [s * 0.07, -0.07, 0.255]], 0.014, bone), m.ivory, head);
    }
    // Inside of the mouth (shows when the jaw drops).
    const inside = mesh(new THREE.SphereGeometry(0.1, 16, 12), m.mouth, head);
    inside.position.set(0, -0.04, 0.15);
    inside.scale.set(1.05, 0.5, 1.1);
    // Lower jaw, hinged at the back.
    this.jaw.position.set(0, -0.03, 0.03);
    head.add(this.jaw);
    const jaw = mesh(ball(0.11, { main: colors.main, belly: colors.belly }, v3(0, -1, 0.2).normalize(), -0.2), m.skin, this.jaw);
    jaw.position.set(0, -0.035, 0.13);
    jaw.scale.set(1.05, 0.48, 1.12);
    const tongue = mesh(new THREE.SphereGeometry(0.05, 12, 8), m.tongueSkin, this.jaw);
    tongue.scale.set(0.9, 0.25, 1.4);
    tongue.position.set(0, -0.005, 0.15);
    this.mouthMarker.position.set(0, -0.05, 0.32);
    head.add(this.mouthMarker);

    // Eyes: big white balls, a colored iris, a round pupil and two catch-lights.
    const eyeR = 0.068 * (look.eyeSize ?? 1);
    for (const s of [-1, 1]) {
      const eye = new THREE.Group();
      eye.position.set(s * 0.095, 0.115, 0.115);
      // Turned a little outward, and looking slightly down at the player.
      eye.rotation.set(0.12, s * 0.12, 0);
      head.add(eye);
      const ballMesh = mesh(new THREE.SphereGeometry(eyeR, 24, 18), m.white, eye);
      ballMesh.scale.set(1, 1.1, 0.85);
      const ink = new THREE.Mesh(ballMesh.geometry, outline());
      ballMesh.add(ink);
      const irisMesh = mesh(new THREE.SphereGeometry(eyeR * 0.62, 20, 14), m.iris, eye);
      irisMesh.position.set(0, -eyeR * 0.05, eyeR * 0.5);
      irisMesh.scale.set(1, 1.1, 0.5);
      const pupil = mesh(new THREE.SphereGeometry(eyeR * 0.36, 16, 12), m.dark, eye);
      pupil.position.set(0, -eyeR * 0.05, eyeR * 0.72);
      pupil.scale.set(cute ? 1 : 0.7, 1.15, 0.45);
      for (const [x, y, r] of [[0.32, 0.32, 0.17], [-0.2, -0.28, 0.08]]) {
        const glint = mesh(new THREE.SphereGeometry(eyeR * r, 10, 8), m.shine, eye);
        glint.position.set(s * eyeR * x, eyeR * y, eyeR * 0.86);
        glint.castShadow = false;
      }
      // Brow: a soft ridge over the eye. Mean dragons slant theirs down toward the nose.
      const browTilt = cute ? -0.25 : 0.45;
      const brow = mesh(spike([[s * 0.04, 0, 0], [s * 0.1, 0.008, 0], [s * 0.15, 0.02, -0.03]], 0.032, colors, v3(0, 1, 0)), m.skin, head);
      brow.position.set(0, 0.115 + eyeR * 1.0 + (cute ? 0.025 : 0), 0.165);
      brow.rotation.z = s * browTilt * 0.5;
      brow.geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(brow.geometry.getAttribute('position').count * 3).fill(0).map((_, i) => [colors.main.r, colors.main.g, colors.main.b][i % 3] * 0.8), 3));
      if (cute) {
        // Pink cheeks.
        const blush = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff7a90, transparent: true, opacity: 0.55, depthWrite: false }));
        this.ownedBasic.push(blush.material);
        blush.position.set(s * 0.15, 0.03, 0.16);
        blush.scale.set(1, 0.6, 0.4);
        blush.rotation.y = s * 0.6;
        head.add(blush);
      }
      if (look.whiskers) {
        extra(mesh(spike([[s * 0.1, 0.03, 0.24], [s * 0.2, 0.0, 0.27], [s * 0.27, -0.09, 0.25], [s * 0.28, -0.2, 0.2]], 0.012, bone, v3(0, 0, 1)), m.ivory, head));
      }
      this.horns(look.horns, s, bone, m.ivory, mesh);
    }
    if (look.horns === 'crown') {
      // A little horn on the nose.
      extra(mesh(spike([[0, 0.08, 0.22], [0, 0.13, 0.24], [0, 0.17, 0.22]], 0.026, bone), m.ivory, head));
    }
    if (look.frill) {
      // A fan of spines behind the head, webbed with wing skin.
      const hub = v3(0, 0.07, -0.12);
      const tips: THREE.Vector3[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = -1.8 + (3.6 * i) / 6;
        tips.push(v3(Math.sin(a) * 0.3, 0.07 + Math.cos(a) * 0.27, -0.2));
      }
      for (const tip of tips) extra(mesh(spike([[hub.x, hub.y, hub.z], [tip.x, tip.y, tip.z]], 0.016, bone, v3(0, 0, 1)), m.ivory, head));
      extra(mesh(membrane(hub, tips, 0, 0.2, 0, 9), m.wingSkin, head));
    }
    // Soft spikes down the back of the head.
    for (let i = 0; i < 3; i++) {
      const y = 0.24 - i * 0.08;
      const z = -0.12 - i * 0.05;
      mesh(spike([[0, y, z + 0.03], [0, y + 0.04, z - 0.04]], 0.028 - i * 0.004, bone), m.ivory, head);
    }
  }

  /** One side's horns (s = -1 left, 1 right), in head units. They don't count toward the dragon's size. */
  private horns(
    kind: DragonLook['horns'],
    s: number,
    bone: Colors,
    ivory: THREE.Material,
    mesh: (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D) => THREE.Mesh,
  ): void {
    const horn = (points: [number, number, number][], base: number, ref?: THREE.Vector3) => {
      mesh(spike(points, base, bone, ref), ivory, this.head).userData.extra = true;
    };
    const swept = () => horn([[s * 0.1, 0.22, -0.06], [s * 0.15, 0.32, -0.12], [s * 0.18, 0.42, -0.14], [s * 0.17, 0.5, -0.1]], 0.045);
    const cheek = () => horn([[s * 0.18, 0.04, -0.04], [s * 0.25, 0.06, -0.1], [s * 0.3, 0.1, -0.12]], 0.028, v3(0, 1, 0));
    switch (kind) {
      case 'none':
        return;
      case 'nubs':
        horn([[s * 0.09, 0.22, -0.05], [s * 0.11, 0.28, -0.08], [s * 0.12, 0.32, -0.1]], 0.04);
        return;
      case 'swept':
        swept();
        cheek();
        return;
      case 'ram':
        // Thick horns curling back, down and forward beside the face.
        horn([[s * 0.12, 0.2, -0.05], [s * 0.21, 0.27, -0.13], [s * 0.28, 0.2, -0.2], [s * 0.31, 0.08, -0.15], [s * 0.28, 0.02, -0.06], [s * 0.24, 0.05, 0.0]], 0.055);
        return;
      case 'crown':
        swept();
        cheek();
        // More horns fanning back behind the main pair.
        for (let k = 1; k <= 2; k++) {
          const x = s * (0.1 + 0.04 * k);
          horn([[x, 0.2 - 0.04 * k, -0.1], [x * 1.4, 0.26 - 0.04 * k, -0.2], [x * 1.7, 0.32 - 0.06 * k, -0.26]], 0.03 - 0.004 * k);
        }
        return;
    }
  }

  /** The end of the tail: a spade, a spiked club or a fan of fins. */
  private tailTip(kind: DragonLook['tail'], tip: THREE.Vector3, along: THREE.Vector3, bone: Colors, ivory: THREE.Material, mesh: (g: THREE.BufferGeometry, m: THREE.Material, p: THREE.Object3D) => THREE.Mesh): void {
    const seg = this.tail[2];
    const fin = (angle: number, len: number, width: number) => {
      // A flat rounded leaf, pointing along the tail and fanned by `angle` around its back.
      const dir = along.clone().applyAxisAngle(v3(0, 1, 0), angle * 0.6).add(v3(0, angle * 0.3, 0)).normalize();
      const a = tip.clone().addScaledVector(along, -0.02);
      const mid = a.clone().addScaledVector(dir, len * 0.5);
      const b = a.clone().addScaledVector(dir, len);
      mesh(sweep(curve([a.x, a.y, a.z], [mid.x, mid.y, mid.z], [b.x, b.y, b.z]), bone, { radius: (t) => width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)), width: 1, depth: 0.3, ref: v3(0, 1, 0), round: [0.2, 0.25], bellyFrom: 2, segments: 14 }), ivory, seg);
    };
    if (kind === 'spade') {
      fin(-0.7, 0.16, 0.05);
      fin(0.7, 0.16, 0.05);
      fin(0, 0.2, 0.05);
    } else if (kind === 'club') {
      // A round bony club studded with soft spikes.
      const club = mesh(ball(0.07, bone), ivory, seg);
      club.position.copy(tip).addScaledVector(along, 0.04);
      const rand = seededRandom(31);
      for (let i = 0; i < 6; i++) {
        const d = v3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        const a = club.position.clone().addScaledVector(d, 0.05);
        const b = club.position.clone().addScaledVector(d, 0.11);
        mesh(spike([[a.x, a.y, a.z], [b.x, b.y, b.z]], 0.024, bone, Math.abs(d.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0)), ivory, seg);
      }
    } else {
      fin(-1.1, 0.22, 0.04);
      fin(-0.4, 0.28, 0.045);
      fin(0.4, 0.2, 0.04);
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
    this.flapRate += ((hover ? 1.6 : 2.4) - this.flapRate) * Math.min(1, dt * 2);
    this.flap += dt * Math.PI * 2 * this.flapRate;
    const beat = Math.sin(this.flap);
    const amp = hover ? 0.7 : 0.5;
    for (const [s, w] of [[-1, this.wings.L], [1, this.wings.R]] as const) {
      // Positive z rotation lifts the right wing; mirror it for the left.
      w.rotation.z = s * (0.15 + amp * beat);
      // Sweep back on the upstroke, forward on the downstroke.
      w.rotation.y = s * -0.25 * Math.cos(this.flap);
    }
    // The body bobs on each downstroke, with a little squash and stretch.
    this.body.position.y = -beat * 0.03;
    this.body.scale.set(1 + beat * 0.015, 1 - beat * 0.015, 1 + beat * 0.015);

    // Spring recoil from hits.
    this.recoilSpeed += (-this.recoil * 120 - this.recoilSpeed * 12) * dt;
    this.recoil += this.recoilSpeed * dt;
    this.body.rotation.x = -0.08 - this.recoil;

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
    // A slight head tilt now and then.
    this.head.rotation.z = 0.08 * Math.sin(t * 0.6);

    const wantJaw = performance.now() < this.jawUntil ? 0.6 : 0.1 + 0.05 * Math.sin(t * 0.7);
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
      if (m.emissiveIntensity > 1) continue; // glowing spots keep glowing
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
    this.neck.rotation.x = 0.5;
    this.head.rotation.set(0.5, 0, 0.3);
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

  /** Puts a helmet on the skull: `object` should be about 0.6 across, centered on its rim. */
  wear(object: THREE.Object3D): void {
    const { center, radius } = this.cranium;
    object.scale.setScalar((radius * 2.15) / 0.6);
    // Rim above the brows, so the eyes still show.
    object.position.set(center.x, center.y + radius * 0.62, center.z - 0.02);
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
    for (const m of this.ownedBasic) m.dispose();
  }
}
