// Holds the themed environments and shows one at a time. Each is built on
// first use and then kept, so switching games is instant.
import * as THREE from 'three';
import type { Stage } from '../stage';
import { beach } from './beach';
import { graveyard } from './graveyard';
import { lodge } from './lodge';
import { neon } from './neon';
import { park } from './park';
import { pub } from './pub';
import { range } from './range';
import { space } from './space';
import { stadium } from './stadium';
import { synthwave } from './synthwave';
import type { Environment } from './types';

const COURT_CENTER = new THREE.Vector3(0, 0, -3.35);
const AUTHORED_CAMERA_DISTANCE = 11;

export type EnvironmentId =
  | 'stadium'
  | 'park'
  | 'neon'
  | 'synthwave'
  | 'graveyard'
  | 'range'
  | 'beach'
  | 'space'
  | 'pub'
  | 'lodge';

const BUILDERS: Record<EnvironmentId, () => Environment> = { stadium, park, neon, synthwave, graveyard, range, beach, space, pub, lodge };

export class World {
  private built = new Map<EnvironmentId, Environment>();
  private current: Environment | null = null;

  constructor(private readonly stage: Stage) {
    stage.onUpdate((dt, now) => this.current?.update?.(dt, now));
  }

  show(id: EnvironmentId): void {
    let env = this.built.get(id);
    if (!env) {
      env = BUILDERS[id]();
      env.root.visible = false;
      this.stage.scene.add(env.root);
      this.built.set(id, env);
    }
    if (env === this.current) return;
    if (this.current) this.current.root.visible = false;
    env.root.visible = true;
    this.stage.scene.background = env.background;
    // Fog distances are authored for a camera ~11 m from the court; push them
    // out by however much farther the current camera sits.
    const extra = Math.max(0, this.stage.camera.position.distanceTo(COURT_CENTER) - AUTHORED_CAMERA_DISTANCE);
    this.stage.scene.fog = env.fog && new THREE.Fog(env.fog.color, env.fog.near + extra, env.fog.far + extra);
    this.current = env;
  }

  cheer(level: number): void {
    this.current?.cheer?.(level);
  }
}
