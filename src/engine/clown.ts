// Dunk Tank's clown, built in code in a chunky cartoon style: a big round head
// with white face paint, shiny eyes, a red nose and a wide smile, orange hair
// puffs and a party hat; a round polka-dot jumpsuit with a frilly collar and
// pom-poms; puffy sleeves, white gloves, striped socks and giant red shoes; and
// a dark ink outline. His joints are groups, so he can sit, wave, flail and
// paddle. The origin is his hips (where he sits); he faces +z.
import * as THREE from 'three';
import { canvasTexture } from './textures';

/** Overall size (the parts below are built at 1). */
const SIZE = 1.12;
/** Head top above the hips, including the hat. */
export const CLOWN_TOP = 1.12 * SIZE;
/** Feet below the hips when standing. */
export const CLOWN_LEGS = 0.6 * SIZE;

const SKIN = 0xfff3ea;
const DOTS = ['#e8384a', '#2f6fd8', '#3ad06a'];
const OUTLINE = 0.011;

let ink: THREE.MeshBasicMaterial | null = null;

/** Cartoon ink line: back faces pushed out along the normals. */
function inkMaterial(): THREE.MeshBasicMaterial {
  if (ink) return ink;
  ink = new THREE.MeshBasicMaterial({ color: 0x1a0e12, side: THREE.BackSide });
  ink.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${OUTLINE.toFixed(4)};`);
  };
  ink.userData.shared = true;
  return ink;
}

function polkaDots(): THREE.CanvasTexture {
  const t = canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#ffcf2e';
    ctx.fillRect(0, 0, 512, 256);
    let i = 0;
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 10; col++) {
        ctx.fillStyle = DOTS[i++ % DOTS.length];
        ctx.beginPath();
        ctx.arc(col * 52 + (row % 2 ? 26 : 0) + 12, row * 44 + 22, 13, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function stripes(a: string, b: string, count: number): THREE.CanvasTexture {
  return canvasTexture(64, 128, (ctx) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect(0, (i * 128) / count, 64, 128 / count + 1);
    }
  });
}

export type ClownPose = 'sit' | 'taunt' | 'fall' | 'swim';

interface Limb {
  /** At the shoulder or hip. */
  upper: THREE.Group;
  /** At the elbow or knee. */
  lower: THREE.Group;
}

export class Clown {
  readonly root = new THREE.Group();
  pose: ClownPose = 'sit';
  private body = new THREE.Group();
  private head = new THREE.Group();
  private arms: Record<'L' | 'R', Limb>;
  private legs: Record<'L' | 'R', Limb>;
  private time = Math.random() * 10;
  private materials: THREE.Material[] = [];
  /** Joint angles eased toward each pose's targets. */
  private angles = new Map<string, number>();

  constructor() {
    const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
      this.materials.push(m);
      return m;
    };
    const skin = mat(SKIN, { roughness: 0.55 });
    const suit = mat(0xffffff, { map: polkaDots(), roughness: 0.65 });
    const glove = mat(0xffffff, { roughness: 0.6 });
    const shoe = mat(0xe02424, { roughness: 0.3 });
    const sock = mat(0xffffff, { map: stripes('#ffffff', '#e8384a', 8), roughness: 0.7 });
    const hair = mat(0xff7a1a, { roughness: 0.95 });
    const black = mat(0x141014, { roughness: 0.25 });
    const white = mat(0xffffff, { roughness: 0.15 });
    const red = mat(0xff1a24, { roughness: 0.15, emissive: 0x3a0004 });
    const lips = mat(0xd0101a, { roughness: 0.35 });
    const blue = mat(0x2f8fff, { roughness: 0.5 });
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.materials.push(shine);

    /** A mesh with an ink outline (skip for tiny details). */
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, outline = true) => {
      const m = new THREE.Mesh(geometry, material);
      m.castShadow = true;
      if (outline) m.add(new THREE.Mesh(geometry, inkMaterial()));
      parent.add(m);
      return m;
    };
    const ball = (r: number, material: THREE.Material, parent: THREE.Object3D, at: [number, number, number], scale: [number, number, number] = [1, 1, 1], outline = true) => {
      const m = part(new THREE.SphereGeometry(r, 28, 20), material, parent, outline);
      m.position.set(...at);
      m.scale.set(...scale);
      return m;
    };
    const capsule = (r: number, len: number, material: THREE.Material, parent: THREE.Object3D, y: number) => {
      const m = part(new THREE.CapsuleGeometry(r, len, 6, 16), material, parent);
      m.position.y = y;
      return m;
    };

    this.root.add(this.body);
    this.body.scale.setScalar(SIZE);

    // Round polka-dot jumpsuit, pom-pom buttons and a frilly two-tone collar.
    ball(0.27, suit, this.body, [0, 0.24, 0], [1, 1.12, 0.9]);
    const pompom = mat(0xffffff, { roughness: 0.95 });
    for (let i = 0; i < 3; i++) ball(0.048, pompom, this.body, [0, 0.38 - i * 0.13, 0.24 - Math.abs(i - 1) * 0.02]);
    const collar = new THREE.Group();
    collar.position.y = 0.54;
    this.body.add(collar);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ball(0.075, i % 2 ? mat(0x2f6fd8, { roughness: 0.8 }) : glove, collar, [Math.sin(a) * 0.17, 0, Math.cos(a) * 0.15], [1, 0.55, 1]);
    }

    // Head: nods and tilts on its own.
    this.head.position.y = 0.8;
    this.body.add(this.head);
    ball(0.235, skin, this.head, [0, 0, 0]);
    ball(0.058, red, this.head, [0, -0.015, 0.235]);
    for (const s of [-1, 1]) {
      // Big eye with a pupil and a catch-light, blue diamond paint above it, and an arched brow.
      const eye = new THREE.Group();
      eye.position.set(s * 0.082, 0.06, 0.19);
      eye.rotation.y = s * 0.15;
      this.head.add(eye);
      ball(0.055, white, eye, [0, 0, 0], [1, 1.15, 0.7]);
      ball(0.03, black, eye, [0, -0.004, 0.034], [1, 1.1, 0.5], false);
      ball(0.011, shine, eye, [s * 0.01, 0.014, 0.048], [1, 1, 1], false).castShadow = false;
      const diamond = ball(0.03, blue, this.head, [s * 0.088, 0.145, 0.175], [0.55, 1, 0.35], false);
      diamond.rotation.x = -0.6;
      const brow = part(new THREE.TorusGeometry(0.04, 0.008, 6, 14, Math.PI * 0.8), black, this.head, false);
      brow.position.set(s * 0.082, 0.12, 0.205);
      brow.rotation.set(-0.5, 0, Math.PI * 0.1);
      // Pink cheek.
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), new THREE.MeshBasicMaterial({ color: 0xff7a90, transparent: true, opacity: 0.5, depthWrite: false }));
      this.materials.push(cheek.material);
      cheek.position.set(s * 0.15, -0.05, 0.16);
      cheek.scale.set(1, 0.6, 0.4);
      cheek.rotation.y = s * 0.7;
      this.head.add(cheek);
      // Orange hair puffs over the ears.
      for (const [x, y, z, r] of [[0.2, 0.03, -0.03, 0.1], [0.22, -0.07, -0.07, 0.095], [0.17, 0.12, -0.08, 0.085], [0.13, 0.05, -0.17, 0.09]]) {
        ball(r, hair, this.head, [s * x, y, z]);
      }
    }
    // A wide smile, painted big.
    const smile = part(new THREE.TorusGeometry(0.095, 0.016, 8, 24, Math.PI), lips, this.head, false);
    smile.position.set(0, -0.075, 0.19);
    smile.rotation.set(-0.35, 0, Math.PI);
    // Little striped party hat with a pom-pom, tipped to one side.
    const hat = new THREE.Group();
    hat.position.set(0.05, 0.215, -0.01);
    hat.rotation.z = -0.35;
    this.head.add(hat);
    const cone = part(new THREE.ConeGeometry(0.075, 0.2, 24), mat(0xffffff, { map: stripes('#2f6fd8', '#ffffff', 8), roughness: 0.5 }), hat);
    cone.position.y = 0.09;
    ball(0.032, mat(0xffcf2e, { roughness: 0.9 }), hat, [0, 0.2, 0]);

    // Arms: puffy sleeve, forearm, big white glove with a thumb.
    const arm = (s: number): Limb => {
      const upper = new THREE.Group();
      upper.position.set(s * 0.24, 0.42, 0);
      this.body.add(upper);
      ball(0.085, suit, upper, [0, -0.02, 0]);
      capsule(0.052, 0.14, suit, upper, -0.12);
      const lower = new THREE.Group();
      lower.position.y = -0.24;
      upper.add(lower);
      capsule(0.045, 0.12, skin, lower, -0.08);
      ball(0.075, glove, lower, [0, -0.2, 0.01], [1, 1.1, 0.85]);
      ball(0.03, glove, lower, [s * -0.06, -0.17, 0.04]);
      return { upper, lower };
    };
    this.arms = { L: arm(1), R: arm(-1) };

    // Legs: baggy suit thighs, striped socks, giant red shoes.
    const leg = (s: number): Limb => {
      const upper = new THREE.Group();
      upper.position.set(s * 0.12, 0.02, 0.02);
      this.body.add(upper);
      capsule(0.085, 0.12, suit, upper, -0.12);
      const lower = new THREE.Group();
      lower.position.y = -0.26;
      upper.add(lower);
      capsule(0.05, 0.14, sock, lower, -0.1);
      ball(0.085, shoe, lower, [0, -0.25, 0.09], [1, 0.62, 1.9]);
      return { upper, lower };
    };
    this.legs = { L: leg(1), R: leg(-1) };
  }

  /** Eases a joint angle toward a target and returns it. */
  private ease(key: string, target: number, k: number): number {
    const v = this.angles.get(key) ?? target;
    const next = v + (target - v) * k;
    this.angles.set(key, next);
    return next;
  }

  update(dt: number): void {
    this.time += dt;
    const t = this.time;
    const k = 1 - Math.exp(-dt * 12);
    const L = { arm: this.arms.L, leg: this.legs.L, s: 1 };
    const R = { arm: this.arms.R, leg: this.legs.R, s: -1 };
    // Targets per pose: shoulder raise (out/up), shoulder forward, elbow bend; hip forward, knee bend.
    let arms: [number, number, number][];
    let legs: [number, number][];
    if (this.pose === 'fall' || this.pose === 'swim') {
      const fast = this.pose === 'fall' ? 16 : 6;
      const flap = Math.sin(t * fast);
      arms = [[2.5 + flap * 0.3, 0.2, 0.4], [2.5 - flap * 0.3, 0.2, 0.4]];
      legs = [[0.5 + flap * 0.4, 0.6 - flap * 0.3], [0.5 - flap * 0.4, 0.6 + flap * 0.3]];
    } else {
      // Sitting: thighs forward, shins hanging and swinging; hands on the knees.
      const swing = Math.sin(t * 2.4) * 0.3;
      legs = [[1.5, 1.45 + swing], [1.5, 1.45 - swing]];
      arms = [[0.25, 0.55, 0.9], [0.25, 0.55, 0.9]];
      if (this.pose === 'taunt') {
        // Right hand up and waving; left hand on the belly, laughing.
        arms[1] = [2.4, 0.1, 0.5 + Math.sin(t * 14) * 0.5];
        arms[0] = [0.5, 0.9, 1.7];
      }
    }
    [L, R].forEach((side, i) => {
      const [raise, forward, elbow] = arms[i];
      side.arm.upper.rotation.z = side.s * this.ease(`ar${i}`, raise, k);
      side.arm.upper.rotation.x = -this.ease(`af${i}`, forward, k);
      side.arm.lower.rotation.x = -this.ease(`ae${i}`, elbow, k);
      const [hip, knee] = legs[i];
      side.leg.upper.rotation.x = -this.ease(`lh${i}`, hip, k);
      side.leg.lower.rotation.x = this.ease(`lk${i}`, knee, k);
    });
    // Breathing, a bob when laughing, and a head that tilts and nods.
    const laugh = this.pose === 'taunt' ? Math.abs(Math.sin(t * 16)) * 0.02 : 0;
    this.body.position.y = Math.sin(t * 2) * 0.008 + laugh;
    this.body.rotation.x = this.ease('lean', this.pose === 'taunt' ? -0.15 : 0, k);
    this.head.rotation.z = Math.sin(t * 1.3) * 0.12;
    this.head.rotation.x = this.pose === 'taunt' ? -0.2 + Math.sin(t * 16) * 0.06 : Math.sin(t * 0.9) * 0.05;
  }

  dispose(): void {
    for (const m of this.materials) {
      for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose();
      m.dispose();
    }
  }
}
