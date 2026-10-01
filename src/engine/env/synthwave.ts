// Retro synthwave sunset: striped sun, neon grid floor, wireframe mountains. Used by Brick Breaker.
import * as THREE from 'three';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

function sun(): THREE.Mesh {
  const texture = canvasTexture(512, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#fff36b');
    g.addColorStop(0.55, '#ff8a3d');
    g.addColorStop(1, '#ff2e88');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(256, 256, 250, 0, Math.PI * 2);
    ctx.fill();
    // Classic horizontal cut-outs, thicker toward the horizon. Only the upper
    // half of the sun shows above the floor, so the stripes sit there.
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 8; i++) {
      const y = 130 + i * 17;
      ctx.fillRect(0, y, 512, 2 + i * 1.6);
    }
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 22),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, fog: false, toneMapped: false }),
  );
  // Close enough that its top half rises above the horizon, just below the scoreboard.
  mesh.position.set(0, 0.5, -32);
  return mesh;
}

function mountains(root: THREE.Group): void {
  const rand = seededRandom(3);
  const fill = new THREE.MeshBasicMaterial({ color: 0x1b0b33 });
  const edge = new THREE.LineBasicMaterial({ color: 0xff2fd6 });
  for (let i = 0; i < 9; i++) {
    const geometry = new THREE.ConeGeometry(6 + rand() * 8, 6 + rand() * 9, 4 + Math.floor(rand() * 3), 1);
    const mountain = new THREE.Mesh(geometry, fill);
    const x = -60 + i * 15 + (rand() - 0.5) * 6;
    // Leave a gap in the middle so the sun shows.
    if (Math.abs(x) < 13) continue;
    mountain.position.set(x, geometry.parameters.height / 2 - 1, -30 - rand() * 8);
    mountain.rotation.y = rand();
    mountain.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge));
    root.add(mountain);
  }
}

function palm(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x12061f });
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.9, 6), dark);
    seg.position.set(i * 0.06, 0.45 + i * 0.85, 0);
    seg.rotation.z = -0.05;
    g.add(seg);
  }
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3, 4), dark);
    leaf.position.set(0.4, 6.1, 0);
    leaf.rotation.set(0, (i / 7) * Math.PI * 2, 1.9);
    leaf.translateY(1.3);
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

export function synthwave(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xff9ad5, 0x2a0f4f, 1.0));
  const key = shadowLight(0xffc2e2, 1.8, [3, 12, 9]);
  root.add(key, key.target);

  const grid = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ff2fd6';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
  });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(60, 60);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ color: 0x0c0418, roughness: 0.5, emissive: 0xffffff, emissiveMap: grid, emissiveIntensity: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -50;
  floor.receiveShadow = true;
  root.add(floor);

  root.add(
    buildCourt({ surface: ['#22104a', '#2c1561'], line: '#3ff5ff', kitchen: 'rgba(255,138,61,0.12)', apron: 0x1a0a36, glow: true, roughness: 0.45 }),
  );

  const theSun = sun();
  root.add(theSun);
  mountains(root);
  root.add(palm(-9, -12), palm(10, -14), palm(-14, -20));

  let pulse = 0;
  return {
    root,
    background: skyTexture([
      [0, '#12052e'],
      [0.45, '#5b1a7a'],
      [0.68, '#ff2e88'],
      [0.8, '#ff9a4d'],
      [1, '#1a0630'],
    ]),
    fog: new THREE.Fog(0x3a0f55, 30, 90),
    update: (dt) => {
      pulse = Math.max(0, pulse - dt * 1.5);
      theSun.scale.setScalar(1 + pulse * 0.08);
    },
    cheer: (level) => (pulse = Math.max(pulse, level)),
  };
}
