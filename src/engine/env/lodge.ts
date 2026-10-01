// Snowy mountain lodge: snow field, frosted pines, a log cabin with a glowing
// window, mountains, falling snow and an aurora. Used by Memory Match.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom, sparkTexture } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

function pine(x: number, z: number, s: number): THREE.Group {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1, 6), new THREE.MeshLambertMaterial({ color: 0x4a3020 }));
  trunk.position.y = 0.5;
  g.add(trunk);
  const green = new THREE.MeshLambertMaterial({ color: 0x1f5a3a, flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: 0xf4f8ff, flatShading: true });
  for (let i = 0; i < 3; i++) {
    const r = 1.4 - i * 0.35;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.6, 7), green);
    cone.position.y = 1.4 + i * 0.95;
    cone.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, 0.6, 7), snow);
    cap.position.y = cone.position.y + 0.55;
    g.add(cone, cap);
  }
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  return g;
}

function cabin(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const logs = canvasTexture(128, 128, (ctx) => {
    for (let y = 0; y < 128; y += 16) {
      ctx.fillStyle = y % 32 ? '#6b4325' : '#7a4f2c';
      ctx.fillRect(0, y, 128, 15);
    }
  });
  logs.wrapS = logs.wrapT = THREE.RepeatWrapping;
  logs.repeat.set(2, 2);
  const body = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 4), new THREE.MeshLambertMaterial({ map: logs }));
  body.position.y = 1.5;
  body.castShadow = true;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 4), new THREE.MeshLambertMaterial({ color: 0xf4f8ff }));
  roof.position.y = 4.1;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.05, 1, 0.85);
  const window = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: 0xffc46b, toneMapped: false }));
  window.position.set(0, 1.7, 2.01);
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.6, 0.6), new THREE.MeshLambertMaterial({ color: 0x6a6a72 }));
  chimney.position.set(1.4, 4.4, 0);
  g.add(body, roof, window, chimney);
  g.position.set(x, 0, z);
  g.userData.window = window;
  return g;
}

export function lodge(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xdfe8ff, 0x9fb0cf, 1.4));
  const sun = shadowLight(0xffffff, 1.8, [6, 12, 6]);
  root.add(sun, sun.target);

  const snowField = new THREE.Mesh(new THREE.PlaneGeometry(120, 80), new THREE.MeshLambertMaterial({ color: 0xeef3fb }));
  snowField.rotation.x = -Math.PI / 2;
  snowField.position.z = -20;
  snowField.receiveShadow = true;
  root.add(snowField);
  root.add(buildCourt({ surface: ['#1f4f8a', '#2a5fa0'], line: '#ffffff', kitchen: 'rgba(200,230,255,0.12)', apron: 0xc8d6ea, roughness: 0.8 }));

  // Mountains with snowy peaks.
  const rock = new THREE.MeshLambertMaterial({ color: 0x5a6a85, flatShading: true });
  const cap = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  for (const [x, z, r, h] of [[-30, -55, 16, 22], [-6, -65, 20, 30], [20, -58, 17, 24], [42, -62, 18, 20]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), rock);
    m.position.set(x, h / 2 - 2, z);
    root.add(m);
    const top = new THREE.Mesh(new THREE.ConeGeometry(r * 0.38, h * 0.38, 7), cap);
    top.position.set(x, h - 2 - h * 0.19, z);
    root.add(top);
  }

  const rand = seededRandom(23);
  for (let i = 0; i < 26; i++) {
    const side = i % 2 ? 1 : -1;
    root.add(pine(side * (COURT.halfWidth + 2 + rand() * 9), -1 - rand() * 16, 0.9 + rand() * 0.8));
  }
  for (let i = 0; i < 12; i++) root.add(pine(-14 + rand() * 28, -11 - rand() * 10, 1 + rand()));
  const house = cabin(COURT.halfWidth + 6, -12);
  house.rotation.y = -0.4;
  root.add(house);

  // Falling snow.
  const count = 900;
  const flakes = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) flakes.set([-25 + rand() * 50, rand() * 16, -25 + rand() * 30], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(flakes, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.16, map: sparkTexture(), transparent: true, depthWrite: false, color: 0xffffff }));
  root.add(snow);

  let flash = 0;
  return {
    root,
    background: skyTexture(
      [
        [0, '#0d1b3d'],
        [0.5, '#3a5a9a'],
        [0.8, '#9fc0e8'],
        [1, '#eef3fb'],
      ],
      (ctx, w, h) => {
        // Aurora ribbons.
        for (const [y, c] of [[h * 0.18, '63,245,160'], [h * 0.26, '120,180,255']] as const) {
          const g = ctx.createLinearGradient(0, y - 40, 0, y + 40);
          g.addColorStop(0, `rgba(${c},0)`);
          g.addColorStop(0.5, `rgba(${c},0.45)`);
          g.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x / 50) * 18);
          ctx.lineTo(w, y + 60);
          ctx.lineTo(0, y + 60);
          ctx.fill();
        }
      },
    ),
    fog: new THREE.Fog(0xdfe8f5, 30, 90),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      const attr = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        let y = attr.getY(i) - dt * (0.8 + (i % 5) * 0.15);
        if (y < 0) y = 16;
        attr.setY(i, y);
        attr.setX(i, attr.getX(i) + Math.sin(now / 1000 + i) * dt * 0.2);
      }
      attr.needsUpdate = true;
      ((house.userData.window as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(1, 0.75 + flash * 0.25, 0.4 + flash * 0.5);
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
