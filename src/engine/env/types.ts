import type * as THREE from 'three';

/** A themed backdrop: everything around the court, plus its lighting. */
export interface Environment {
  root: THREE.Group;
  background: THREE.Texture | THREE.Color;
  fog: THREE.Fog | null;
  /** Called every frame while this environment is showing. */
  update?(dt: number, now: number): void;
  /** React to a good shot. level is 0..1. */
  cheer?(level: number): void;
}
