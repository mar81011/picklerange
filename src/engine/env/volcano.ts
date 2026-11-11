// Volcano at dusk: a smoking cone with a glowing crater and lava streams,
// black rock, lava pools beside the court and embers rising. Used by Dragon Hunt.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom, sparkTexture } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

/** Black rock with orange cracks; used for the volcano and the lava pools' glow. */
function lavaTexture(): THREE.CanvasTexture {
  const texture = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 180);
    g.addColorStop(0, '#fff1a8');
    g.addColorStop(0.35, '#ff9a1f');
    g.addColorStop(0.75, '#e2380b');
    g.addColorStop(1, '#5a0d04');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // Dark crust floating on top.
    const rand = seededRandom(5);
    ctx.fillStyle = 'rgba(40,10,6,0.55)';
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.ellipse(rand() * 256, rand() * 256, 10 + rand() * 26, 6 + rand() * 14, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/** Dark basalt with glowing cracks, tiled over the ground. */
function crackedGround(): THREE.CanvasTexture {
  const texture = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#1c1214';
    ctx.fillRect(0, 0, 512, 512);
    const rand = seededRandom(23);
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      let x = rand() * 512;
      let y = rand() * 512;
      const path: [number, number][] = [[x, y]];
      for (let j = 0; j < 6; j++) {
        x += (rand() - 0.5) * 120;
        y += (rand() - 0.5) * 120;
        path.push([x, y]);
      }
      for (const [color, width] of [['rgba(255,90,20,0.35)', 9], ['#ffb347', 2.5]] as const) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        path.forEach(([px, py]) => ctx.lineTo(px, py));
        ctx.stroke();
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(9, 7);
  return texture;
}

function volcano(root: THREE.Group): THREE.MeshBasicMaterial {
  const rock = new THREE.MeshLambertMaterial({ color: 0x1c1416, flatShading: true });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(4, 15, 13, 12, 3, true), rock);
  cone.position.set(3, 5.5, -40);
  root.add(cone);
  // Glowing crater lip and lava streams down the front.
  const glow = new THREE.MeshBasicMaterial({ color: 0xff6a1a, fog: false, toneMapped: false });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(4, 0.35, 6, 24), glow);
  lip.rotation.x = Math.PI / 2;
  lip.position.set(3, 12, -40);
  root.add(lip);
  for (const [dx, len, tilt] of [[-1.6, 9, 0.12], [0.8, 11, -0.05], [2.6, 7, -0.2]]) {
    const stream = new THREE.Mesh(new THREE.BoxGeometry(0.35, len, 0.2), glow);
    stream.position.set(3 + dx, 12 - len / 2, -40 + 4.2 + len * 0.42);
    stream.rotation.set(-0.86, 0, tilt);
    root.add(stream);
  }
  // Smaller peaks either side.
  const rand = seededRandom(9);
  for (let i = 0; i < 9; i++) {
    const x = -46 + i * 11 + (rand() - 0.5) * 5;
    if (Math.abs(x - 3) < 12) continue;
    const h = 6 + rand() * 8;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(5 + rand() * 6, h, 5 + Math.floor(rand() * 3)), rock);
    peak.position.set(x, h / 2 - 0.5, -34 - rand() * 8);
    peak.rotation.y = rand();
    root.add(peak);
  }
  return glow;
}

function rocks(root: THREE.Group): void {
  const rand = seededRandom(17);
  const rock = new THREE.MeshLambertMaterial({ color: 0x2a2024, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const side = i % 2 ? 1 : -1;
    const size = 0.3 + rand() * 1.1;
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), rock);
    boulder.position.set(side * (COURT.halfWidth + 0.9 + rand() * 7), size * 0.5, -1 - rand() * 14);
    boulder.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    boulder.castShadow = true;
    root.add(boulder);
  }
}

export function volcanoEnv(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xffb27a, 0x2a0a0a, 1.3));
  const lavaLight = new THREE.PointLight(0xff5a1a, 30, 22, 1.6);
  lavaLight.position.set(0, 3, -9);
  root.add(lavaLight);
  const key = shadowLight(0xffc9a0, 2.2, [-5, 12, 6]);
  root.add(key, key.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), new THREE.MeshLambertMaterial({ map: crackedGround(), emissive: 0xffffff, emissiveMap: crackedGround(), emissiveIntensity: 0.6 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(buildCourt({ surface: ['#3a2a2e', '#45323a'], line: '#ffd2a8', kitchen: 'rgba(255,120,40,0.1)', apron: 0x24181b, roughness: 0.9 }));

  // Lava pools beside the court and a river behind it, close enough for the camera to see.
  const lava = new THREE.MeshBasicMaterial({ map: lavaTexture(), toneMapped: false });
  for (const [x, z, w, d] of [[-COURT.halfWidth - 2.6, -4.5, 2.6, 6], [COURT.halfWidth + 2.8, -6, 3, 5], [0, -9, 26, 1.6]]) {
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lava);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.02, z);
    root.add(pool);
  }

  rocks(root);
  const crater = volcano(root);

  // Embers drifting up into the sky.
  const count = 160;
  const rand = seededRandom(31);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set([(rand() - 0.5) * 30, rand() * 10, -4 - rand() * 18], i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const embers = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: 0xffa040, size: 0.12, map: sparkTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  root.add(embers);

  let flash = 0;
  return {
    root,
    background: skyTexture([
      [0, '#12060c'],
      [0.45, '#3a0f14'],
      [0.75, '#a3341a'],
      [0.88, '#ff8a3a'],
      [1, '#2a0a08'],
    ]),
    fog: new THREE.Fog(0x2a0e0c, 16, 52),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let y = attr.getY(i) + dt * (0.6 + (i % 5) * 0.15);
        if (y > 11) y = 0;
        attr.setXYZ(i, attr.getX(i) + Math.sin(now / 900 + i) * dt * 0.2, y, attr.getZ(i));
      }
      attr.needsUpdate = true;
      lava.map!.offset.set(Math.sin(now / 5000) * 0.05, now / 40000);
      const pulse = 0.5 + 0.5 * Math.sin(now / 700);
      lavaLight.intensity = 26 + pulse * 8 + flash * 40;
      crater.color.setHSL(0.06, 1, 0.5 + pulse * 0.08);
    },
    // The lava flares up on a big hit.
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
