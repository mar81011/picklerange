// Neon city rooftop at night: glowing court lines, lit skyline, neon signs. Used by Pop-Up.
import * as THREE from 'three';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

function windowsTexture(seed: number): THREE.CanvasTexture {
  const rand = seededRandom(seed);
  const texture = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = '#0c0f22';
    ctx.fillRect(0, 0, 128, 256);
    const lit = ['#ffd27a', '#9ad7ff', '#ff9ee6', '#fff3c4'];
    for (let y = 6; y < 256; y += 14) {
      for (let x = 6; x < 128; x += 14) {
        if (rand() < 0.45) continue;
        ctx.fillStyle = lit[Math.floor(rand() * lit.length)];
        ctx.globalAlpha = 0.5 + rand() * 0.5;
        ctx.fillRect(x, y, 7, 8);
      }
    }
    ctx.globalAlpha = 1;
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function skyline(root: THREE.Group): void {
  const rand = seededRandom(11);
  const materials = [1, 2, 3].map((seed) => {
    const map = windowsTexture(seed);
    return new THREE.MeshLambertMaterial({ color: 0x1a1f3d, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.9, map });
  });
  for (let i = 0; i < 44; i++) {
    const w = 2.5 + rand() * 4;
    const h = 6 + rand() * 22;
    const d = 3 + rand() * 4;
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials[i % 3]);
    const row = i % 2;
    building.position.set(-40 + rand() * 80, h / 2 - 4, -16 - row * 10 - rand() * 14);
    root.add(building);
  }
}

function neonSign(text: string, color: string, width: number): THREE.Mesh {
  const texture = canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, 512, 160);
    ctx.font = '120px "Bebas Neue"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 88);
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, 492, 140);
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, width * (160 / 512)),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
}

export function neon(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0x8f84ff, 0x1a1030, 1.5));
  const moon = shadowLight(0xc4d0ff, 2.2, [4, 13, 8]);
  root.add(moon, moon.target);

  // Rooftop deck with a glowing grid.
  const grid = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#ff2fd6';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 128, 128);
  });
  grid.wrapS = grid.wrapT = THREE.RepeatWrapping;
  grid.repeat.set(30, 20);
  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 40),
    new THREE.MeshStandardMaterial({ color: 0x15102b, roughness: 0.35, metalness: 0.2, emissive: 0xffffff, emissiveMap: grid, emissiveIntensity: 0.35 }),
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.z = -10;
  deck.receiveShadow = true;
  root.add(deck);

  root.add(
    buildCourt({ surface: ['#1a1446', '#231a5c'], line: '#3ff5ff', kitchen: 'rgba(255,47,214,0.12)', apron: 0x1d1640, glow: true, roughness: 0.4 }),
  );

  // Rooftop ledge with a neon strip.
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(30, 0.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x0d0a1f }));
  ledge.position.set(0, 0.4, -10);
  root.add(ledge);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(30, 0.06, 0.42), new THREE.MeshBasicMaterial({ color: 0x3ff5ff, toneMapped: false }));
  strip.position.set(0, 0.82, -10);
  root.add(strip);

  skyline(root);

  const signs = [neonSign('POP!', '#ff2fd6', 5), neonSign('PICKLE', '#3ff5ff', 6), neonSign('ARCADE', '#d4f53c', 5.5)];
  signs[0].position.set(-9, 6.5, -15);
  signs[1].position.set(0.5, 9, -24);
  signs[2].position.set(10, 7, -17);
  signs[0].rotation.y = 0.25;
  signs[2].rotation.y = -0.25;
  root.add(...signs);

  let flash = 0;
  return {
    root,
    background: skyTexture(
      [
        [0, '#05031a'],
        [0.5, '#1d0f4a'],
        [0.75, '#4a1670'],
        [1, '#0a0618'],
      ],
      (ctx, w, h) => {
        const rand = seededRandom(5);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 140; i++) {
          ctx.globalAlpha = 0.3 + rand() * 0.7;
          ctx.fillRect(rand() * w, rand() * h * 0.6, 1.5, 1.5);
        }
        ctx.globalAlpha = 1;
      },
    ),
    fog: new THREE.Fog(0x1a0b3a, 25, 75),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      // Signs buzz gently, and blaze on a cheer.
      signs.forEach((s, i) => {
        const buzz = 0.85 + 0.15 * Math.sin(now / (300 + i * 70));
        (s.material as THREE.MeshBasicMaterial).color.setScalar(buzz + flash);
      });
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
