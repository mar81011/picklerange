// Night stadium: LED boards, tiered stands and a cheering crowd. Used by the
// menu and Bullseye.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { NEON, canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

const BOARD_Z = -9.2;

function boards(root: THREE.Group): void {
  const texture = canvasTexture(4096, 128, (ctx) => {
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, 4096, 128);
    ctx.font = '84px "Bebas Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = ['PICKLERANGE', 'ARCADE', 'DINK • DRIVE • WIN', 'PICKLERANGE', 'ARCADE', 'HIT THE TARGETS', 'PICKLERANGE', 'ARCADE'];
    const step = 4096 / labels.length;
    labels.forEach((label, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : NEON;
      ctx.fillText(label, step * i + step / 2, 70);
    });
    ctx.fillStyle = NEON;
    ctx.fillRect(0, 0, 4096, 6);
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b1220 });
  const face = new THREE.MeshStandardMaterial({ map: texture, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(34, 1.0, 0.15), [dark, dark, dark, dark, face, dark]);
  back.position.set(0, 0.5, BOARD_Z);
  back.castShadow = true;
  root.add(back);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.7, 7), new THREE.MeshStandardMaterial({ color: 0x16255a, roughness: 0.6 }));
    wall.position.set(side * (COURT.halfWidth + 3), 0.35, BOARD_Z + 3.5);
    wall.receiveShadow = true;
    root.add(wall);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.05, 7),
      new THREE.MeshStandardMaterial({ color: 0xd4f53c, emissive: 0xd4f53c, emissiveIntensity: 0.6 }),
    );
    strip.position.set(side * (COURT.halfWidth + 3), 0.72, BOARD_Z + 3.5);
    root.add(strip);
  }

  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2333, metalness: 0.6, roughness: 0.4 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d8, emissiveIntensity: 2.5 });
  for (const side of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 14, 8), poleMaterial);
    pole.position.set(side * 15, 7, -16);
    root.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 0.3), lampMaterial);
    lamp.position.set(side * 15, 14.2, -15.8);
    lamp.rotation.x = 0.3;
    root.add(lamp);
  }
}

/**
 * Crowd drawn as two instanced meshes (bodies and heads). It only rewrites
 * instance positions while cheering, so an idle crowd costs nothing per frame.
 */
class Crowd {
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private seats: { x: number; y: number; z: number; phase: number; hype: number }[] = [];
  private level = 0;
  private atRest = false;
  private matrix = new THREE.Matrix4();

  constructor(root: THREE.Group) {
    const rand = seededRandom(2026);
    const rows = 14;
    const perRow = 62;
    const shirts = [0xe63946, 0xf1faee, 0x457b9d, 0xffb703, 0x2a9d8f, 0xe76f51, 0x8338ec, 0xd4f53c, 0x1d3557, 0xff006e, 0x06d6a0];
    const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e];

    // Tiered stand steps, one row of seats per step.
    const steps = new THREE.Group();
    const stepMaterial = new THREE.MeshStandardMaterial({ color: 0x2b3550, roughness: 0.9 });
    for (let r = 0; r < rows; r++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(40, 0.55, 0.95), stepMaterial);
      step.position.set(0, 0.6 + r * 0.55 - 0.275, BOARD_Z - 1.4 - r * 0.95);
      steps.add(step);
      for (let i = 0; i < perRow; i++) {
        if (rand() < 0.07) continue;
        this.seats.push({
          x: -18 + (i + (r % 2) * 0.5) * (36 / perRow) + (rand() - 0.5) * 0.1,
          y: 0.6 + r * 0.55,
          z: BOARD_Z - 1.4 - r * 0.95 + (rand() - 0.5) * 0.1,
          phase: rand() * Math.PI * 2,
          hype: 0.6 + rand() * 0.8,
        });
      }
    }
    root.add(steps);

    // Low-poly shapes: the crowd is far away, so extra detail is wasted.
    this.bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.32, 2, 6), new THREE.MeshLambertMaterial(), this.seats.length);
    this.heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshLambertMaterial(), this.seats.length);
    const color = new THREE.Color();
    this.seats.forEach((_, i) => {
      this.bodies.setColorAt(i, color.setHex(shirts[Math.floor(rand() * shirts.length)]));
      this.heads.setColorAt(i, color.setHex(skins[Math.floor(rand() * skins.length)]));
    });
    root.add(this.bodies, this.heads);
    this.write(0);
  }

  cheer(level: number): void {
    this.level = Math.max(this.level, Math.min(1, level));
    this.atRest = false;
  }

  update(dt: number, now: number): void {
    if (this.atRest) return;
    this.level = Math.max(0, this.level - dt * 0.8);
    this.write(now / 1000);
    if (this.level === 0) this.atRest = true;
  }

  private write(t: number): void {
    this.seats.forEach((s, i) => {
      const jump = this.level * s.hype * Math.max(0, Math.sin(t * 11 + s.phase)) * 0.28;
      this.matrix.makeTranslation(s.x, s.y + jump + 0.33, s.z);
      this.bodies.setMatrixAt(i, this.matrix);
      this.matrix.makeTranslation(s.x, s.y + jump + 0.72, s.z);
      this.heads.setMatrixAt(i, this.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.heads.instanceMatrix.needsUpdate = true;
  }
}

export function stadium(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xcfe0ff, 0x1a2a5a, 1.1));
  const key = shadowLight(0xfff3dd, 2.2, [5, 14, 9]);
  root.add(key, key.target);

  const surround = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({ color: 0x1b3383, roughness: 0.9 }));
  surround.rotation.x = -Math.PI / 2;
  surround.position.z = -10;
  surround.receiveShadow = true;
  root.add(surround);
  root.add(
    buildCourt({ surface: ['#2c58c4', '#3a6ee0'], line: '#ffffff', kitchen: 'rgba(212,245,60,0.09)', apron: 0x22409c }),
  );
  boards(root);
  const crowd = new Crowd(root);

  return {
    root,
    background: skyTexture([
      [0, '#0b1a3d'],
      [0.45, '#2a4f9a'],
      [0.62, '#6f98d8'],
      [1, '#0b1220'],
    ]),
    fog: new THREE.Fog(0x0e1a36, 30, 70),
    update: (dt, now) => crowd.update(dt, now),
    cheer: (level) => crowd.cheer(level),
  };
}
