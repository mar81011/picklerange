// Dunk Tank's clown: the CC0 Quaternius "Animated Human" (a plain grey
// mannequin) painted as a clown by body part, with a red nose, orange wig puffs,
// a striped party hat, a ruff collar and pom-pom buttons. He sits by having his
// leg bones aimed on top of the idle clip, waves when he taunts and flails when
// he drops into the water.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Character } from './character';
import { canvasTexture } from './textures';

export const CLOWN_MODEL = '/models/human.glb';
export const CLOWN_HEIGHT = 1.55;

const FACE = 0xf7f1ea;
const GLOVE = 0xffffff;
const SHIRT_A = 0xffcf2e;
const SHIRT_B = 0xe8384a;
const PANTS = 0x2f6fd8;
const SHOES = 0xe02424;

/** Paint color for a vertex from the bone that moves it most (and which side of the body it's on). */
function paintFor(bone: string, x: number): number {
  if (/Head|Neck/.test(bone)) return FACE;
  if (/Hand/.test(bone)) return GLOVE;
  if (/Foot|Toe/.test(bone)) return SHOES;
  if (/UpLeg|Leg|Hips/.test(bone)) return PANTS;
  // Shirt: one half yellow, the other red, harlequin style.
  const left = /Left/.test(bone) || (!/Right/.test(bone) && x > 0);
  return left ? SHIRT_A : SHIRT_B;
}

/** Adds clown paint as vertex colors to the model's (shared) geometry, once. */
function paint(gltf: GLTF): void {
  gltf.scene.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh || mesh.geometry.userData.clownPaint) return;
    const g = mesh.geometry;
    const index = g.getAttribute('skinIndex');
    const weight = g.getAttribute('skinWeight');
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (weight.getComponent(i, k) > weight.getComponent(i, best)) best = k;
      const bone = mesh.skeleton.bones[index.getComponent(i, best)]?.name ?? '';
      c.setHex(paintFor(bone, pos.getX(i)), THREE.SRGBColorSpace);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.userData.clownPaint = true;
  });
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

/** Hat, wig, nose and face paint, in meters with the origin on top of the head (face toward +z). */
function headGear(): THREE.Object3D {
  const g = new THREE.Group();
  // Party hat: a striped cone with a pom-pom, tipped to one side.
  const stripes = canvasTexture(128, 128, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#2f6fd8' : '#ffffff';
      ctx.fillRect(0, i * 16, 128, 16);
    }
  });
  stripes.wrapS = THREE.RepeatWrapping;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.24, 20), std(0xffffff, { map: stripes, roughness: 0.5 }));
  hat.position.set(0.03, 0.09, 0.02);
  hat.rotation.z = -0.3;
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), std(0xffcf2e, { roughness: 0.9 }));
  pom.position.set(0.075, 0.21, 0.02);
  g.add(hat, pom);
  // Wig: big orange puffs over the ears.
  const wig = std(0xff7a1a, { roughness: 0.95 });
  for (const s of [-1, 1]) {
    for (const [dx, dy, dz, r] of [[0.13, -0.08, 0.0, 0.085], [0.16, -0.15, -0.02, 0.08], [0.11, -0.03, -0.06, 0.075], [0.15, -0.1, -0.08, 0.07]]) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), wig);
      puff.position.set(s * dx, dy, dz);
      g.add(puff);
    }
  }
  // Big shiny red nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 12), std(0xff1a1a, { roughness: 0.15, emissive: 0x400000 }));
  nose.position.set(0, -0.2, 0.2);
  g.add(nose);
  // Eyes with blue diamond paint, arched brows, and a wide red smile.
  const black = std(0x111111, { roughness: 0.3 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), black);
    eye.position.set(s * 0.048, -0.15, 0.175);
    const diamond = new THREE.Mesh(new THREE.CircleGeometry(0.03, 4), std(0x2f8fff, { roughness: 0.5 }));
    diamond.position.set(s * 0.048, -0.15, 0.168);
    diamond.scale.set(0.8, 1.5, 1);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12, Math.PI), black);
    brow.position.set(s * 0.048, -0.115, 0.17);
    g.add(diamond, eye, brow);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), std(0xd0101a, { roughness: 0.4 }));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.235, 0.165);
  g.add(smile);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

/** Frilly collar and pom-pom buttons, in meters from the top of the head (worn on the chest). */
function collarGear(): THREE.Object3D {
  const g = new THREE.Group();
  const frill = std(0xffffff, { roughness: 0.8 });
  const ruff = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 18), frill);
  ruff.rotation.x = Math.PI / 2;
  ruff.position.set(0, -0.33, 0.04);
  ruff.scale.set(1.15, 1, 1);
  g.add(ruff);
  // Scallops around the ruff.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), frill);
    bump.position.set(Math.sin(a) * 0.15, -0.34, 0.04 + Math.cos(a) * 0.13);
    g.add(bump);
  }
  [0x2f6fd8, 0x3ad06a, 0xff7a1a].forEach((color, i) => {
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), std(color, { roughness: 0.9 }));
    button.position.set(0, -0.48 - i * 0.12, 0.16 - i * 0.005);
    g.add(button);
  });
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  return g;
}

export type ClownPose = 'sit' | 'taunt' | 'fall' | 'swim';

export class Clown {
  readonly actor: Character;
  pose: ClownPose = 'sit';
  private time = Math.random() * 10;

  constructor(gltf: GLTF) {
    paint(gltf);
    this.actor = new Character(gltf, { heightM: CLOWN_HEIGHT, tint: 0xffffff });
    for (const m of this.actor.materials) {
      m.vertexColors = true;
      m.color.setHex(0xffffff);
      m.metalness = 0;
      m.roughness = 0.65;
    }
    this.actor.wearOnHead(headGear(), 0.0);
    this.actor.wearOnHead(collarGear(), 0.0, 'Spine2');
    void this.actor.play('Idle', { offset: Math.random() });
    this.actor.afterUpdate.push(() => this.applyPose());
  }

  get root(): THREE.Group {
    return this.actor.root;
  }

  update(dt: number): void {
    this.time += dt;
    this.actor.update(dt);
  }

  private applyPose(): void {
    const t = this.time;
    const a = this.actor;
    const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    if (this.pose === 'fall' || this.pose === 'swim') {
      // Arms thrown up, legs kicking.
      const kick = Math.sin(t * (this.pose === 'fall' ? 18 : 7));
      a.aimBone('LeftArm', 'LeftForeArm', v(0.5, 1, 0.1));
      a.aimBone('RightArm', 'RightForeArm', v(-0.5, 1, 0.1));
      a.aimBone('LeftForeArm', 'LeftHand', v(0.3 + kick * 0.3, 1, 0.2));
      a.aimBone('RightForeArm', 'RightHand', v(-0.3 - kick * 0.3, 1, 0.2));
      a.aimBone('LeftUpLeg', 'LeftLeg', v(0.15, -1, 0.5 + kick * 0.4));
      a.aimBone('RightUpLeg', 'RightLeg', v(-0.15, -1, 0.5 - kick * 0.4));
      a.aimBone('LeftLeg', 'LeftFoot', v(0.1, -1, -0.2 - kick * 0.4));
      a.aimBone('RightLeg', 'RightFoot', v(-0.1, -1, -0.2 + kick * 0.4));
      return;
    }
    // Sitting on the plank: thighs forward, shins hanging and swinging.
    const swing = Math.sin(t * 2.4) * 0.35;
    a.aimBone('LeftUpLeg', 'LeftLeg', v(0.14, -0.08, 1));
    a.aimBone('RightUpLeg', 'RightLeg', v(-0.14, -0.08, 1));
    a.aimBone('LeftLeg', 'LeftFoot', v(0.04, -1, 0.15 + swing));
    a.aimBone('RightLeg', 'RightFoot', v(-0.04, -1, 0.15 - swing));
    // Hands on the knees.
    a.aimBone('LeftArm', 'LeftForeArm', v(0.3, -1, 0.35));
    a.aimBone('RightArm', 'RightForeArm', v(-0.3, -1, 0.35));
    a.aimBone('LeftForeArm', 'LeftHand', v(0.05, -0.5, 1));
    a.aimBone('RightForeArm', 'RightHand', v(-0.05, -0.5, 1));
    if (this.pose === 'taunt') {
      // Right hand up, waving; left thumb to the nose.
      a.aimBone('RightArm', 'RightForeArm', v(-0.7, 0.8, 0.25));
      a.aimBone('RightForeArm', 'RightHand', v(-0.2 + Math.sin(t * 14) * 0.6, 1, 0.3));
      a.aimBone('LeftArm', 'LeftForeArm', v(0.45, -0.1, 0.8));
      a.aimBone('LeftForeArm', 'LeftHand', v(-0.6, 0.6, 0.6));
    }
  }

  dispose(): void {
    this.actor.dispose();
  }
}
