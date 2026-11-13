// Variety for Zombie Court's horde. Every zombie is the same Quaternius model;
// this repaints its skin and shorts (by recoloring the model's color atlas) and
// builds hats, so each one looks a little different and each kind reads at a
// glance: walkers in assorted colors (some in caps), brutes in hard hats, and
// the boss in a crown.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ZombieKind } from '../games/zombies/logic';

/** Skin tones: classic green, grey, sickly yellow, bruised violet, swamp teal. */
const SKINS = [0x86b84e, 0xa2ad9a, 0xb8b45a, 0x9a88aa, 0x6fa087];
/** Shorts: denim, brown, charcoal, maroon, olive. */
const PANTS = [0x2f5a86, 0x6a4e34, 0x4a4c52, 0x7a2c30, 0x6b6a38];
const CAP_COLORS = [0xd8322e, 0x2a6fd6, 0xf2b630, 0x2e9a52, 0xf27a1a];
const BRUTE_SKIN = 0x6f8f3c;
const BOSS_SKIN = 0x7a5f9e;

export interface ZombieLook {
  map: THREE.Texture;
  girth: number;
  /** Visual height multiplier (small variations only). */
  height: number;
  hat: (() => THREE.Object3D) | null;
  /** How far the hat sits down onto the head, in meters (at normal size). */
  sink: number;
}

type Range = { hue: [number, number] };
const SKIN_RANGE: Range = { hue: [0.17, 0.42] };
const CLOTH_RANGE: Range = { hue: [0.52, 0.7] };

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
  const mean = { skin: [0, 0], cloth: [0, 0] };
  for (let i = 0; i < d.length; i += 4) {
    c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
    if (inRange(SKIN_RANGE)) (mean.skin[0] += hsl.l), mean.skin[1]++;
    else if (inRange(CLOTH_RANGE)) (mean.cloth[0] += hsl.l), mean.cloth[1]++;
  }
  const targets = {
    skin: new THREE.Color(skin).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace),
    cloth: new THREE.Color(pants).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace),
  };
  for (let i = 0; i < d.length; i += 4) {
    c.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace).getHSL(hsl, THREE.SRGBColorSpace);
    const group = inRange(SKIN_RANGE) ? 'skin' : inRange(CLOTH_RANGE) ? 'cloth' : null;
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
  if (kind === 'boss') return { map, girth: 1.1, height: 1, hat: crown, sink: 0.1 };
  if (kind === 'brute') return { map, girth: 1.22, height: 1, hat: hardHat, sink: 0.07 };
  const capColor = pick(CAP_COLORS, rand);
  return { map, girth: 0.95 + rand() * 0.1, height: 0.94 + rand() * 0.1, hat: rand() < 0.35 ? () => cap(capColor) : null, sink: 0.06 };
}

// ---------- Hats, in meters for a normal-size zombie (the head is about 0.6 m wide) ----------

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const shadowed = <T extends THREE.Mesh>(m: T): T => ((m.castShadow = true), m);

/** A baseball cap, worn a little crooked. */
function cap(color: number): THREE.Object3D {
  const g = new THREE.Group();
  const cloth = std(color, { roughness: 0.8 });
  const crown = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), cloth));
  crown.scale.set(1.1, 0.75, 1.15);
  const brim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.02, 20, 1, false, -Math.PI / 2, Math.PI), cloth));
  brim.position.set(0, 0.0, 0.19);
  brim.scale.set(1.05, 1, 1.15);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), cloth);
  button.position.y = 0.15;
  g.add(crown, brim, button);
  g.rotation.set(-0.08, 0, 0.15);
  g.scale.setScalar(1.85);
  return g;
}

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
