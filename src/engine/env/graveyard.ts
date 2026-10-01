// Spooky night graveyard: full moon, dead trees, tombstones, green fog. Used by Zombie Court.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

function moon(): THREE.Mesh {
  const texture = canvasTexture(256, 256, (ctx) => {
    const glow = ctx.createRadialGradient(128, 128, 40, 128, 128, 128);
    glow.addColorStop(0, 'rgba(230,255,220,1)');
    glow.addColorStop(0.45, 'rgba(210,240,200,0.9)');
    glow.addColorStop(0.55, 'rgba(160,255,150,0.25)');
    glow.addColorStop(1, 'rgba(160,255,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(150,170,140,0.35)';
    for (const [x, y, r] of [[105, 110, 14], [150, 140, 10], [120, 160, 8]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ map: texture, transparent: true, fog: false, toneMapped: false }));
  // Low on the horizon so it shows below the scoreboard.
  mesh.position.set(-9, 3, -34);
  return mesh;
}

function deadTree(x: number, z: number, scale: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const bark = new THREE.MeshLambertMaterial({ color: 0x1a1512 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 4, 6), bark);
  trunk.position.y = 2;
  g.add(trunk);
  for (let i = 0; i < 6; i++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 1.8, 5), bark);
    const h = 2.2 + rand() * 1.6;
    const a = rand() * Math.PI * 2;
    branch.position.set(Math.cos(a) * 0.5, h, Math.sin(a) * 0.5);
    branch.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(branch);
  }
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.position.set(x, 0, z);
  g.scale.setScalar(scale);
  return g;
}

function tombstones(root: THREE.Group): void {
  const rand = seededRandom(13);
  const stone = new THREE.MeshLambertMaterial({ color: 0x5d6470 });
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (COURT.halfWidth + 1.2 + rand() * 6);
    const z = -1 - rand() * 12;
    const w = 0.5 + rand() * 0.3;
    const h = 0.7 + rand() * 0.6;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), stone);
    slab.position.set(x, h / 2 - 0.05, z);
    slab.rotation.set((rand() - 0.5) * 0.25, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.25);
    slab.castShadow = true;
    root.add(slab);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.16, 12, 1, false, 0, Math.PI), stone);
    cap.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    cap.position.set(0, h / 2, 0);
    slab.add(cap);
  }
  // A few behind the court, too.
  for (let i = 0; i < 14; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.16), stone);
    slab.position.set(-12 + rand() * 24, 0.4, -9.5 - rand() * 6);
    slab.rotation.y = (rand() - 0.5) * 0.5;
    root.add(slab);
  }
}

function ironFence(root: THREE.Group): void {
  const iron = new THREE.MeshLambertMaterial({ color: 0x0c0d10 });
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 5), iron, 90);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 90; i++) {
    m.makeTranslation(-13.5 + i * 0.3, 0.8, -9);
    bars.setMatrixAt(i, m);
  }
  root.add(bars);
  for (const y of [0.35, 1.45]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(27, 0.05, 0.05), iron);
    rail.position.set(0, y, -9);
    root.add(rail);
  }
}

export function graveyard(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xa8c8ff, 0x1a2a1a, 1.6));
  const moonLight = shadowLight(0xd8ffe0, 2.6, [-6, 12, 4]);
  root.add(moonLight, moonLight.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshLambertMaterial({ color: 0x18261a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(buildCourt({ surface: ['#2b3a33', '#34463c'], line: '#cfe8d0', kitchen: 'rgba(124,255,107,0.08)', apron: 0x1f2f23, roughness: 0.9 }));

  ironFence(root);
  tombstones(root);
  const rand = seededRandom(21);
  for (const [x, z, s] of [[-8, -12, 1.2], [9, -13, 1.4], [-14, -18, 1.6], [14, -20, 1.5], [3, -24, 1.3], [-4, -22, 1.1]]) {
    root.add(deadTree(x, z, s, rand));
  }
  root.add(moon());

  // Low drifting mist.
  const mistTexture = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(170,255,170,0.35)');
    g.addColorStop(1, 'rgba(170,255,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const mist = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 3),
      new THREE.MeshBasicMaterial({ map: mistTexture, transparent: true, depthWrite: false, opacity: 0.6 }),
    );
    mist.position.set(-14 + i * 3.2, 0.5, -7 - (i % 3) * 2.5);
    root.add(mist);
    mists.push(mist);
  }

  let flash = 0;
  return {
    root,
    background: skyTexture([
      [0, '#03060a'],
      [0.55, '#0c1d1a'],
      [0.8, '#1a3a2a'],
      [1, '#05080a'],
    ]),
    fog: new THREE.Fog(0x112218, 14, 45),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      mists.forEach((m, i) => (m.position.x += Math.sin(now / 3000 + i) * dt * 0.3));
      moonLight.intensity = 2.6 + flash * 2.5;
    },
    // A flash of moonlight on a big hit.
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
