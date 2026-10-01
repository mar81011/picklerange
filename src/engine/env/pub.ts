// Sports pub: wooden floor, brick back wall with a neon "PICKLE PUB" sign, TVs,
// a bar with stools and warm string lights. Used by Pickle Darts.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight } from './court';
import type { Environment } from './types';

const WALL_Z = -9;

function planks(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx) => {
    const rand = seededRandom(4);
    for (let y = 0; y < 256; y += 32) {
      for (let x = (y / 32) % 2 ? -64 : 0; x < 256; x += 128) {
        ctx.fillStyle = `hsl(28, ${45 + rand() * 15}%, ${26 + rand() * 10}%)`;
        ctx.fillRect(x, y, 126, 30);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

function bricks(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx) => {
    const rand = seededRandom(8);
    ctx.fillStyle = '#3a2620';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32) {
      for (let x = (y / 32) % 2 ? -32 : 0; x < 256; x += 64) {
        ctx.fillStyle = `hsl(${10 + rand() * 10}, 45%, ${28 + rand() * 12}%)`;
        ctx.fillRect(x + 2, y + 2, 60, 28);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 3);
  return t;
}

function neonSign(text: string, color: string, w: number, h: number): THREE.Mesh {
  const texture = canvasTexture(1024, Math.round((1024 * h) / w), (ctx) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.font = `${Math.round(ctx.canvas.height * 0.75)}px "Bebas Neue"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    for (const blur of [40, 20, 6]) {
      ctx.shadowBlur = blur;
      ctx.fillStyle = blur === 6 ? '#ffffff' : color;
      ctx.fillText(text, 512, ctx.canvas.height / 2 + 6);
    }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
}

function tv(x: number, y: number, hue: number): THREE.Group {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.9, 0.12), new THREE.MeshStandardMaterial({ color: 0x0b0b0e }));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 1.7),
    new THREE.MeshBasicMaterial({
      map: canvasTexture(320, 180, (ctx) => {
        const g2 = ctx.createLinearGradient(0, 0, 0, 180);
        g2.addColorStop(0, `hsl(${hue}, 70%, 45%)`);
        g2.addColorStop(1, `hsl(${hue + 30}, 60%, 25%)`);
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, 320, 180);
        // A pickleball court on TV.
        ctx.fillStyle = '#2f6fd0';
        ctx.fillRect(70, 50, 180, 100);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(70, 50, 180, 100);
        ctx.beginPath();
        ctx.moveTo(160, 50);
        ctx.lineTo(160, 150);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px "Barlow Condensed"';
        ctx.fillText('LIVE • PRO PICKLEBALL', 12, 30);
      }),
      toneMapped: false,
    }),
  );
  screen.position.z = 0.07;
  g.add(frame, screen);
  g.position.set(x, y, WALL_Z + 0.1);
  return g;
}

export function pub(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xffd9a8, 0x2a1a10, 1.0));
  const key = shadowLight(0xffcf8f, 2.0, [3, 12, 7]);
  root.add(key, key.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(50, 40), new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -8;
  floor.receiveShadow = true;
  root.add(floor);
  root.add(buildCourt({ surface: ['#24603a', '#2c7044'], line: '#f6f1e0', kitchen: 'rgba(255,215,140,0.08)', apron: 0x3a2a1c, roughness: 0.7 }));

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 12), new THREE.MeshStandardMaterial({ map: bricks(), roughness: 0.95 }));
  wall.position.set(0, 6, WALL_Z);
  wall.receiveShadow = true;
  root.add(wall);

  const sign = neonSign('PICKLE PUB', '#ff4fa3', 9, 2.2);
  sign.position.set(0, 7.2, WALL_Z + 0.15);
  root.add(sign);
  const sub = neonSign('DARTS • DRINKS • DINKS', '#3ff5ff', 8, 1.1);
  sub.position.set(0, 5.6, WALL_Z + 0.15);
  root.add(sub);
  root.add(tv(-10, 6.2, 210), tv(10, 6.2, 140));

  // Bar counter with stools along the back.
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a3420, roughness: 0.5 });
  const counter = new THREE.Mesh(new THREE.BoxGeometry(16, 1.1, 0.9), wood);
  counter.position.set(0, 0.55, WALL_Z + 2);
  counter.castShadow = true;
  root.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(16.3, 0.08, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.25 }));
  top.position.set(0, 1.14, WALL_Z + 2);
  root.add(top);
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd4dc, metalness: 0.8, roughness: 0.25 });
  const seat = new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.5 });
  for (let x = -7; x <= 7; x += 1.75) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 8), chrome);
    leg.position.set(x, 0.38, WALL_Z + 3);
    const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 16), seat);
    cushion.position.set(x, 0.8, WALL_Z + 3);
    root.add(leg, cushion);
  }

  // Warm string lights draped across the room.
  const bulbs: THREE.Mesh[] = [];
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd38a, toneMapped: false });
  for (const z of [-2, -6]) {
    for (let i = 0; i <= 24; i++) {
      const x = -14 + (i * 28) / 24;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bulbMat.clone());
      bulb.position.set(x, 8.5 - Math.sin((i / 24) * Math.PI) * 1.4, z);
      root.add(bulb);
      bulbs.push(bulb);
    }
  }
  // Side walls in dark wood paneling so the room feels enclosed.
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(22, 12), new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.8 }));
    panel.position.set(side * (COURT.halfWidth + 7), 6, -2);
    panel.rotation.y = -side * (Math.PI / 2);
    root.add(panel);
  }

  let flash = 0;
  return {
    root,
    background: new THREE.Color(0x120a08),
    fog: new THREE.Fog(0x1a0f0a, 24, 50),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      const buzz = 0.85 + 0.15 * Math.sin(now / 90) * Math.sin(now / 37);
      (sign.material as THREE.MeshBasicMaterial).color.setScalar(buzz + flash);
      bulbs.forEach((b, i) => (b.material as THREE.MeshBasicMaterial).color.setHSL(0.1, 1, 0.6 + 0.15 * Math.sin(now / 500 + i) + flash * 0.2));
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
