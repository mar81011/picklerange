// Space station: the court floats on a metal deck among the stars, with a
// ringed planet, a nebula, drifting asteroids and glowing deck edges. Used by Tic-Tac-Toe.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom, sparkTexture } from '../textures';
import { buildCourt, shadowLight } from './court';
import type { Environment } from './types';

function nebulaSky(): THREE.CanvasTexture {
  return canvasTexture(1024, 512, (ctx) => {
    ctx.fillStyle = '#03030c';
    ctx.fillRect(0, 0, 1024, 512);
    const rand = seededRandom(9);
    // Soft nebula clouds.
    for (const [x, y, r, c] of [[300, 180, 260, '120,60,220'], [700, 120, 220, '40,140,255'], [520, 300, 300, '255,60,160']] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${c},0.45)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 1024, 512);
    }
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.7})`;
      const s = rand() < 0.05 ? 2.5 : 1.2;
      ctx.fillRect(rand() * 1024, rand() * 512, s, s);
    }
  });
}

function planet(): THREE.Group {
  const g = new THREE.Group();
  const surface = canvasTexture(512, 256, (ctx) => {
    for (let y = 0; y < 256; y += 8) {
      ctx.fillStyle = `hsl(${25 + Math.sin(y / 20) * 15}, 70%, ${45 + Math.sin(y / 9) * 12}%)`;
      ctx.fillRect(0, y, 512, 8);
    }
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(9, 48, 32), new THREE.MeshStandardMaterial({ map: surface, roughness: 0.8, fog: false }));
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(12, 18, 96),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, fog: false }),
  );
  ring.rotation.x = Math.PI / 2.4;
  g.add(ball, ring);
  g.position.set(-26, 6, -70);
  g.rotation.z = 0.35;
  return g;
}

export function space(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xb8c8ff, 0x1a1030, 1.2));
  const starLight = shadowLight(0xffffff, 2.4, [8, 12, 6]);
  root.add(starLight, starLight.target);

  // Hexagonal metal deck the court sits on, with a glowing rim.
  const deckTex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#20263a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#3a4466';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 248);
    ctx.fillStyle = '#2b3350';
    for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(8, 8);
  const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(COURT.halfWidth + 4, COURT.halfWidth + 3.4, 0.6, 6),
    new THREE.MeshStandardMaterial({ map: deckTex, metalness: 0.6, roughness: 0.4 }),
  );
  deck.position.set(0, -0.31, -3.4);
  deck.receiveShadow = true;
  root.add(deck);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(COURT.halfWidth + 3.7, 0.08, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x3ff5ff, toneMapped: false }),
  );
  rim.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  rim.position.set(0, 0.02, -3.4);
  root.add(rim);
  root.add(buildCourt({ surface: ['#1a1446', '#262070'], line: '#3ff5ff', kitchen: 'rgba(199,125,255,0.14)', apron: 0x1d2140, glow: true, roughness: 0.4 }));

  // Antenna towers with blinking lights at the deck corners.
  const blinkers: THREE.Mesh[] = [];
  for (const [x, z] of [[-COURT.halfWidth - 2.5, -8], [COURT.halfWidth + 2.5, -8]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 5, 6), new THREE.MeshStandardMaterial({ color: 0x8890a8, metalness: 0.7, roughness: 0.3 }));
    mast.position.set(x, 2.5, z);
    root.add(mast);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b6b, toneMapped: false }));
    light.position.set(x, 5.1, z);
    root.add(light);
    blinkers.push(light);
  }

  root.add(planet());

  // Drifting asteroids.
  const rand = seededRandom(17);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b6070, roughness: 0.95, flatShading: true });
  const rocks: { mesh: THREE.Mesh; spin: THREE.Vector3; speed: number }[] = [];
  for (let i = 0; i < 14; i++) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4 + rand() * 1.4, 0), rockMat);
    rock.position.set(-30 + rand() * 60, 3 + rand() * 14, -18 - rand() * 30);
    root.add(rock);
    rocks.push({ mesh: rock, spin: new THREE.Vector3(rand(), rand(), rand()).multiplyScalar(0.4), speed: 0.3 + rand() * 0.6 });
  }

  // Twinkling near stars in front of the sky texture, for depth.
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(400 * 3);
  for (let i = 0; i < 400; i++) pos.set([-60 + rand() * 120, rand() * 40, -30 - rand() * 40], i * 3);
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 0.5, map: sparkTexture(), transparent: true, depthWrite: false, color: 0xffffff, fog: false }),
  );
  root.add(stars);

  let flash = 0;
  return {
    root,
    background: nebulaSky(),
    fog: null,
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      for (const r of rocks) {
        r.mesh.rotation.x += r.spin.x * dt;
        r.mesh.rotation.y += r.spin.y * dt;
        r.mesh.position.x += r.speed * dt;
        if (r.mesh.position.x > 32) r.mesh.position.x = -32;
      }
      blinkers.forEach((b, i) => (b.visible = Math.sin(now / 400 + i * 2) > 0));
      (rim.material as THREE.MeshBasicMaterial).color.setRGB(0.25 + flash, 0.96, 1);
      (stars.material as THREE.PointsMaterial).opacity = 0.7 + 0.3 * Math.sin(now / 300);
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
