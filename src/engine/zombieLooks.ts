// Variety for Zombie Court's horde. Every zombie is the same Quaternius model,
// dressed up as Frankenstein's monster: this repaints its skin and shorts (by
// recoloring the model's color atlas) and adds a flat-top haircut with jagged
// bangs, a stitched scar and neck bolts. Each kind reads at a glance: walkers
// in assorted greens, brutes in hard hats, and the boss in a crown.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ZombieKind } from '../games/zombies/logic';

/** Frankenstein greens: classic, grey-green, pale, olive, mossy. */
const SKINS = [0x7fa85a, 0x93a88a, 0xa6b98a, 0x8e9c4e, 0x6f9a6a];
/** Shorts: denim, brown, charcoal, maroon, olive. */
const PANTS = [0x2f5a86, 0x6a4e34, 0x4a4c52, 0x7a2c30, 0x6b6a38];
const HAIR_COLORS = [0x15151a, 0x1e1a16, 0x2a2018];
const BRUTE_SKIN = 0x6a8a48;
const BOSS_SKIN = 0x7a5f9e;

/** Frankenstein's monster doesn't hang his tongue out: shrink the model's tongue away. */
export const ZOMBIE_HIDDEN_BONES = ['Tongue1'];

export interface ZombieLook {
  map: THREE.Texture;
  girth: number;
  /** Visual height multiplier (small variations only). */
  height: number;
  /** Builds what's worn on the head (hair, hat, scar, bolts), in meters for a normal-size zombie, origin on top of the head. */
  gear: () => THREE.Object3D;
}

type Range = { hue: [number, number] };
const SKIN_RANGE: Range = { hue: [0.17, 0.42] };
const CLOTH_RANGE: Range = { hue: [0.52, 0.7] };
/** The pink inside the mouth and nose. */
const MOUTH_RANGE: Range = { hue: [0.86, 0.97] };
const MOUTH = 0x4e1820;

const textures = new Map<string, THREE.Texture>();

/**
 * The model's atlas with its green (skin) and blue (shorts) swatches
 * repainted, keeping each swatch's light and dark relative to the rest.
 */
function recolored(gltf: GLTF, skin: number, pants: number): THREE.Texture | null {
  const key = `${skin}-${pants}`;
  const cached = textures.get(key);
  if (cached) return cached;
  let original: THREE.Texture | null = null;
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!original && m?.map) original = m.map;
  });
  const source = (original as THREE.Texture | null)?.image as CanvasImageSource & { width: number; height: number } | undefined;
  if (!original || !source) return null;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hsl = { h: 0, s: 0, l: 0 };
  const c = new THREE.Color();
  const inRange = (r: Range) => hsl.s > 0.2 && hsl.l > 0.12 && hsl.h >= r.hue[0] && hsl.h <= r.hue[1];
  // Average lightness of each group, so the new color keeps the same shading steps.
  const mean = { skin: [0, 0], cloth: [0, 0], mouth: [0, 0] };
  for (let i = 0; i < d.length; i += 4) {
    c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
    if (inRange(SKIN_RANGE)) (mean.skin[0] += hsl.l), mean.skin[1]++;
    else if (inRange(CLOTH_RANGE)) (mean.cloth[0] += hsl.l), mean.cloth[1]++;
    else if (inRange(MOUTH_RANGE)) (mean.mouth[0] += hsl.l), mean.mouth[1]++;
  }
  const targets = {
    skin: new THREE.Color(skin).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace),
    cloth: new THREE.Color(pants).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace),
    mouth: new THREE.Color(MOUTH).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace),
  };
  for (let i = 0; i < d.length; i += 4) {
    c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
    const group = inRange(SKIN_RANGE) ? 'skin' : inRange(CLOTH_RANGE) ? 'cloth' : inRange(MOUTH_RANGE) ? 'mouth' : null;
    if (!group) continue;
    const t = targets[group];
    const avg = mean[group][0] / Math.max(1, mean[group][1]);
    c.setHSL(t.h, t.s, THREE.MathUtils.clamp(t.l * (hsl.l / avg), 0.03, 0.95), THREE.SRGBColorSpace);
    const rgb = c.getStyle(THREE.SRGBColorSpace).match(/[\d.]+/g)!.map(Number);
    d[i] = rgb[0];
    d[i + 1] = rgb[1];
    d[i + 2] = rgb[2];
  }
  ctx.putImageData(img, 0, 0);
  // A clone shares the original's image source; give this one its own.
  const tex = (original as THREE.Texture).clone();
  tex.source = new THREE.TextureSource(canvas);
  tex.needsUpdate = true;
  // Shared by every zombie with this look: never disposed with one of them.
  tex.userData.shared = true;
  textures.set(key, tex);
  return tex;
}

const pick = <T>(list: readonly T[], rand: () => number): T => list[Math.floor(rand() * list.length)];

/** A random look for one zombie of this kind. */
export function zombieLook(gltf: GLTF, kind: ZombieKind, rand: () => number = Math.random): ZombieLook | null {
  const skin = kind === 'boss' ? BOSS_SKIN : kind === 'brute' ? BRUTE_SKIN : pick(SKINS, rand);
  const pants = kind === 'boss' ? 0x2a2230 : pick(PANTS, rand);
  const map = recolored(gltf, skin, pants);
  if (!map) return null;
  const hair = pick(HAIR_COLORS, rand);
  const flip = rand() < 0.5 ? -1 : 1;
  if (kind === 'boss') return { map, girth: 1.1, height: 1, gear: () => monster({ hair, flip, hat: crown(), sink: 0.06 }) };
  if (kind === 'brute') return { map, girth: 1.22, height: 1, gear: () => monster({ hair: null, flip, hat: hardHat(), sink: 0.07 }) };
  return { map, girth: 0.95 + rand() * 0.1, height: 0.94 + rand() * 0.1, gear: () => monster({ hair, flip }) };
}

// ---------- Frankenstein's monster, in meters for a normal-size zombie ----------
// Measured from the model: the skull is about 0.66 m wide; the forehead is
// about 0.38 m in front of the origin; the jaw hinge about 0.72 m below the top.

/** Hair, scar and bolts (and an optional hat on top), with the origin on the top of the head. */
function monster(o: { hair: number | null; flip: number; hat?: THREE.Object3D; sink?: number }): THREE.Object3D {
  const g = new THREE.Group();
  if (o.hair !== null) g.add(flatTop(o.hair));
  g.add(scar(o.flip), bolts());
  if (o.hat) {
    o.hat.position.y -= o.sink ?? 0;
    // Sits on the hair, if any.
    if (o.hair !== null) o.hat.position.y += 0.08;
    g.add(o.hat);
  }
  return g;
}

/** The flat-top: a squared-off block of hair with ragged bangs over the forehead. */
function flatTop(color: number): THREE.Object3D {
  const g = new THREE.Group();
  const hair = std(color, { roughness: 0.9 });
  const block = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.14, 0.6, 3, 0.04), hair));
  block.position.set(0, -0.015, 0.09);
  g.add(block);
  // Jagged bangs: uneven points hanging down at the front.
  const lengths = [0.1, 0.16, 0.09, 0.14, 0.11, 0.17, 0.1];
  lengths.forEach((len, i) => {
    const x = -0.27 + (0.54 * i) / (lengths.length - 1);
    const point = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.06, len, 4), hair));
    point.rotation.set(Math.PI, Math.PI / 4, 0);
    point.position.set(x, -0.07 - len / 2, 0.4 - Math.abs(x) * 0.3);
    point.scale.set(1, 1, 0.45);
    g.add(point);
  });
  return g;
}

/** A crooked stitched scar across the forehead. */
function scar(flip: number): THREE.Object3D {
  const g = new THREE.Group();
  const thread = new THREE.MeshStandardMaterial({ color: 0x1a1414, roughness: 0.8 });
  const y = -0.2;
  // Follows the curve of the forehead, a little tilted.
  const path = new THREE.CatmullRomCurve3([-0.2, -0.07, 0.07, 0.2].map((x, i) => new THREE.Vector3(x * flip, y + (i - 1.5) * 0.02 * flip + (i === 1 ? 0.02 : 0), 0.4 - x * x * 1.6)));
  const line = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 0.009, 6), thread);
  g.add(line);
  for (let i = 0; i <= 6; i++) {
    const p = path.getPointAt(i / 6);
    const stitch = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.06, 2, 6), thread);
    stitch.position.copy(p);
    stitch.rotation.z = 0.2;
    g.add(stitch);
  }
  return g;
}

/** A bolt sticking out of each side of the neck. */
function bolts(): THREE.Object3D {
  const g = new THREE.Group();
  const steel = std(0x9aa0a8, { metalness: 0.8, roughness: 0.35 });
  for (const s of [-1, 1]) {
    const shaft = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), steel));
    shaft.rotation.z = Math.PI / 2;
    shaft.position.set(s * 0.36, -0.72, 0.02);
    const nut = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 6), steel));
    nut.rotation.z = Math.PI / 2;
    nut.position.set(s * 0.45, -0.72, 0.02);
    g.add(shaft, nut);
  }
  return g;
}

// ---------- Hats, in meters for a normal-size zombie (the head is about 0.6 m wide) ----------

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const shadowed = <T extends THREE.Mesh>(m: T): T => ((m.castShadow = true), m);

/** A dented yellow construction hard hat. */
function hardHat(): THREE.Object3D {
  const g = new THREE.Group();
  const plastic = std(0xf2b220, { roughness: 0.35 });
  const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.23, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), plastic));
  dome.scale.set(1.05, 0.85, 1.12);
  const rim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.025, 28), plastic));
  rim.scale.set(1, 1, 1.12);
  const ridge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.44), plastic));
  ridge.position.y = 0.19;
  g.add(dome, rim, ridge);
  g.rotation.set(0, 0, -0.1);
  g.scale.setScalar(1.8);
  return g;
}

/** A gold crown with jewels. */
function crown(): THREE.Object3D {
  const g = new THREE.Group();
  const gold = std(0xf5c542, { metalness: 0.85, roughness: 0.25, emissive: 0x6a4a00, emissiveIntensity: 0.4 });
  const band = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.19, 0.1, 24, 1, true), gold.clone()));
  band.material.side = THREE.DoubleSide;
  band.position.y = 0.05;
  g.add(band);
  const jewels = [0xe0283a, 0x2a7ae0, 0x2ad06a];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const point = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 6), gold));
    point.position.set(Math.sin(a) * 0.19, 0.16, Math.cos(a) * 0.19);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), gold);
    ball.position.set(Math.sin(a) * 0.19, 0.235, Math.cos(a) * 0.19);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), std(jewels[i % 3], { metalness: 0.2, roughness: 0.1, emissive: jewels[i % 3], emissiveIntensity: 0.5 }));
    gem.position.set(Math.sin(a) * 0.205, 0.05, Math.cos(a) * 0.205);
    g.add(point, ball, gem);
  }
  g.rotation.z = 0.12;
  g.scale.setScalar(1.35);
  return g;
}
