// Animated opponent loaded from public/models/opponent.glb. Any rigged glTF
// character with a right-hand bone works; ANIMATIONS maps game moments to the
// clip names in the file (the default "Robot Expressive" model is CC0).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { NEON_HEX } from './textures';

const MODEL_URL = '/models/opponent.glb';
const HEIGHT_M = 1.75;
/** Three.js strips dots from bone names on load, so "Hand.R" in the file becomes "HandR". */
const HAND_BONES = ['HandR', 'Hand.R', 'RightHand', 'mixamorigRightHand'];

/** Game moment → clip name in the model. */
const ANIMATIONS = {
  idle: 'Idle',
  run: 'Running',
  swing: 'Punch',
  beaten: 'No',
  pleased: 'ThumbsUp',
  celebrate: 'Dance',
} as const;

export type OpponentMove = keyof typeof ANIMATIONS;

let loading: Promise<GLTF> | null = null;

/** Starts downloading the model; safe to call more than once. */
export function preloadOpponent(): Promise<GLTF> {
  loading ??= new GLTFLoader().loadAsync(MODEL_URL);
  return loading;
}

export class Opponent {
  readonly root = new THREE.Group();
  private mixer: THREE.AnimationMixer;
  private actions = new Map<OpponentMove, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private facing = 0;

  private constructor(gltf: GLTF) {
    const model = cloneSkinned(gltf.scene);
    // Geometry and materials are shared with the cached original: never dispose them.
    model.traverse((o) => {
      o.userData.shared = true;
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.userData.shared = true;
      }
    });

    // Bones need world matrices before measuring, or a skinned mesh reports a garbage size.
    model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const scale = HEIGHT_M / size.y;
    model.scale.setScalar(scale);
    this.root.add(model);

    const hand = HAND_BONES.map((n) => model.getObjectByName(n)).find(Boolean);
    if (hand) {
      // Built in meters, then divided by the model scale since it lives inside the scaled skeleton.
      const paddle = new THREE.Group();
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.025), new THREE.MeshStandardMaterial({ color: NEON_HEX, roughness: 0.4 }));
      face.position.y = 0.2;
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.13, 8), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      grip.position.y = 0.03;
      paddle.add(face, grip);
      paddle.traverse((o) => ((o as THREE.Mesh).castShadow = true));
      model.updateMatrixWorld(true);
      paddle.scale.setScalar(1 / hand.getWorldScale(new THREE.Vector3()).x);
      hand.add(paddle);
    }

    this.mixer = new THREE.AnimationMixer(model);
    for (const [move, clipName] of Object.entries(ANIMATIONS) as [OpponentMove, string][]) {
      const clip = THREE.AnimationClip.findByName(gltf.animations, clipName);
      if (clip) this.actions.set(move, this.mixer.clipAction(clip));
    }
    this.play('idle');
  }

  static async create(): Promise<Opponent> {
    return new Opponent(await preloadOpponent());
  }

  /** Loops idle/run; one-shot moves play once then return to idle. */
  play(move: OpponentMove): void {
    const next = this.actions.get(move);
    if (!next || next === this.current) return;
    const looping = move === 'idle' || move === 'run';
    next.reset();
    next.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    next.clampWhenFinished = !looping;
    next.timeScale = move === 'swing' ? 1.6 : 1;
    if (this.current) next.crossFadeFrom(this.current, 0.15, false);
    next.play();
    this.current = next;
    if (!looping) {
      const onDone = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== next) return;
        this.mixer.removeEventListener('finished', onDone);
        if (this.current === next) this.play('idle');
      };
      this.mixer.addEventListener('finished', onDone);
    }
  }

  /** Turns smoothly toward a heading (0 = facing the player). */
  face(angle: number): void {
    this.facing = angle;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    const y = this.root.rotation.y;
    this.root.rotation.y = y + (this.facing - y) * Math.min(1, dt * 10);
  }
}
