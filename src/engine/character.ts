// Animated glTF characters (e.g. the Quaternius zombie). Each model file is
// downloaded once; every Character is a lightweight copy with its own animation.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const cache = new Map<string, Promise<GLTF>>();

export function loadModel(url: string): Promise<GLTF> {
  let promise = cache.get(url);
  if (!promise) {
    promise = new GLTFLoader().loadAsync(url);
    cache.set(url, promise);
  }
  return promise;
}

export interface CharacterOptions {
  heightM: number;
  /** Multiplies the model's colors, e.g. to tint a variant. Gives this copy its own materials. */
  tint?: number;
  /** Replaces the color texture (e.g. a recolored atlas). Gives this copy its own materials. */
  map?: THREE.Texture;
  /** Stretches the model sideways (and front to back) for a heavier build. Default 1. */
  girth?: number;
  /** Bones shrunk to nothing (with everything they carry), e.g. a tongue. Kept that way through animations. */
  hideBones?: string[];
}

export class Character {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private clips: THREE.AnimationClip[];
  private current: THREE.AnimationAction | null = null;
  /** Materials this copy owns (only when tinted), for flashing on hits. */
  readonly materials: THREE.MeshStandardMaterial[] = [];

  constructor(gltf: GLTF, options: CharacterOptions) {
    const model = cloneSkinned(gltf.scene);
    model.traverse((o) => {
      // Geometry (and untinted materials) are shared with the cached original: never dispose them.
      o.userData.shared = true;
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      // Skinned meshes animate outside their original bounds; skip culling so they never pop out.
      mesh.frustumCulled = false;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (options.tint !== undefined || options.map) {
        const tinted = list.map((m) => {
          const copy = (m as THREE.MeshStandardMaterial).clone();
          if (options.tint !== undefined) copy.color.multiply(new THREE.Color(options.tint));
          if (options.map && copy.map) copy.map = options.map;
          this.materials.push(copy);
          return copy;
        });
        mesh.material = Array.isArray(mesh.material) ? tinted : tinted[0];
      } else {
        for (const m of list) m.userData.shared = true;
      }
    });

    // Bones need world matrices before measuring, or a skinned mesh reports a garbage size.
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const s = options.heightM / size.y;
    const girth = options.girth ?? 1;
    model.scale.set(s * girth, s, s * girth);
    this.root.add(model);
    this.model = model;

    this.clips = gltf.animations;
    this.mixer = new THREE.AnimationMixer(model);
    for (const name of options.hideBones ?? []) {
      const bone = model.getObjectByName(name);
      if (bone) this.hidden.push(bone);
    }
    this.applyHidden();
  }

  private hidden: THREE.Object3D[] = [];

  private applyHidden(): void {
    for (const bone of this.hidden) bone.scale.setScalar(0.001);
  }

  private model: THREE.Object3D;
  /** Things worn on the body (hats); disposed with the character. */
  private worn: THREE.Object3D[] = [];

  /**
   * Puts something on the head so it moves with it: `object` is built in
   * meters, upright, centered on the crown of the head and facing +z, and is
   * placed at the top of the model above the head bone (lowered by `sink` m).
   */
  wearOnHead(object: THREE.Object3D, sink = 0, boneName = 'Head'): void {
    const bone = this.model.getObjectByName(boneName);
    if (!bone) return;
    this.root.updateMatrixWorld(true);
    const head = bone.getWorldPosition(new THREE.Vector3());
    const top = new THREE.Box3().setFromObject(this.model).max.y;
    // Work in the character's own space (its root), then hand it to the bone keeping that pose.
    const inv = this.root.matrixWorld.clone().invert();
    head.applyMatrix4(inv);
    object.position.set(head.x, top - this.root.getWorldPosition(new THREE.Vector3()).y - sink, head.z);
    this.root.add(object);
    this.root.updateMatrixWorld(true);
    bone.attach(object);
    this.worn.push(object);
  }

  static async create(url: string, options: CharacterOptions): Promise<Character> {
    return new Character(await loadModel(url), options);
  }

  /**
   * Plays a clip by name. Looping clips repeat; one-shots hold their last frame
   * (e.g. Death) and resolve when finished.
   */
  play(name: string, { loop = true, timeScale = 1, fade = 0.2, offset = 0 } = {}): Promise<void> {
    const clip = THREE.AnimationClip.findByName(this.clips, name);
    if (!clip) return Promise.resolve();
    const action = this.mixer.clipAction(clip);
    action.reset();
    // Start part-way through (0..1), so a crowd doesn't move in lockstep.
    action.time = offset * clip.duration;
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = !loop;
    action.timeScale = timeScale;
    if (this.current && this.current !== action) action.crossFadeFrom(this.current, fade, false);
    action.play();
    this.current = action;
    if (loop) return Promise.resolve();
    return new Promise((resolve) => {
      const done = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== action) return;
        this.mixer.removeEventListener('finished', done);
        resolve();
      };
      this.mixer.addEventListener('finished', done);
    });
  }

  update(dt: number): void {
    this.mixer.update(dt);
    // After the animation, which may have set these bones' scale.
    this.applyHidden();
  }

  /** Brief red flash, for hits. Only works on tinted copies (they own their materials). */
  flash(on: boolean): void {
    for (const m of this.materials) m.emissive.setHex(on ? 0xff2020 : 0x000000);
  }

  dispose(): void {
    for (const m of this.materials) m.dispose();
    for (const w of this.worn) {
      w.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.shared) return;
        mesh.geometry.dispose();
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
      });
    }
  }
}
