// Indoor firing range: concrete lanes, acoustic side walls, a rubber backstop
// with baffles, overhead light strips and a red "HOT RANGE" beacon. Used by Firing Range.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture } from '../textures';
import { buildCourt, shadowLight } from './court';
import type { Environment } from './types';

const BACK_Z = -10;

function concrete(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#5b5f66';
    ctx.fillRect(0, 0, 256, 256);
    // Speckle and expansion joints.
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, 256, 256);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(12, 10);
  return t;
}

function acousticPanels(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#23262c';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        const g = ctx.createLinearGradient(0, y * 128, 0, y * 128 + 128);
        g.addColorStop(0, '#3a3f48');
        g.addColorStop(1, '#2a2e35');
        ctx.fillStyle = g;
        ctx.fillRect(x * 128 + 6, y * 128 + 6, 116, 116);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function sign(text: string, color: string, bg: string, w: number, h: number): THREE.Mesh {
  const texture = canvasTexture(512, Math.round((512 * h) / w), (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = color;
    ctx.font = `${Math.round(ctx.canvas.height * 0.7)}px "Bebas Neue"`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, ctx.canvas.height / 2 + 4);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
}

export function range(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xe8eeff, 0x2a2420, 0.9));
  const key = shadowLight(0xfff4e0, 2.2, [2, 14, 6]);
  root.add(key, key.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 50), new THREE.MeshStandardMaterial({ map: concrete(), roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -12;
  floor.receiveShadow = true;
  root.add(floor);
  root.add(buildCourt({ surface: ['#4a4e55', '#565a62'], line: '#f2b705', kitchen: 'rgba(242,183,5,0.08)', apron: 0x41454c, roughness: 0.9 }));

  // Side walls with acoustic panels.
  const panels = acousticPanels();
  for (const side of [-1, 1]) {
    const tex = panels.clone();
    tex.needsUpdate = true;
    tex.repeat.set(10, 3);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 7), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    wall.position.set(side * (COURT.halfWidth + 3.2), 3.5, -4);
    wall.rotation.y = -side * (Math.PI / 2);
    wall.receiveShadow = true;
    root.add(wall);
  }

  // Sloped rubber backstop (the berm) and angled steel baffles above it.
  const berm = new THREE.Mesh(new THREE.PlaneGeometry(30, 9), new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 1 }));
  berm.position.set(0, 3, BACK_Z);
  berm.rotation.x = 0.35;
  root.add(berm);
  const baffleMat = new THREE.MeshStandardMaterial({ color: 0x2e3238, metalness: 0.5, roughness: 0.5 });
  for (let i = 0; i < 4; i++) {
    const baffle = new THREE.Mesh(new THREE.BoxGeometry(30, 0.15, 2.2), baffleMat);
    baffle.position.set(0, 6.5 + i * 1.6, BACK_Z + 4 - i * 3);
    baffle.rotation.x = 0.5;
    root.add(baffle);
  }

  // Lane dividers between shooting lanes (posts with yellow caps) along the back.
  const post = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.5, roughness: 0.4 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xf2b705, emissive: 0xf2b705, emissiveIntensity: 0.3 });
  for (let x = -COURT.halfWidth - 1.5; x <= COURT.halfWidth + 1.6; x += 1.5) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2, 0.12), post);
    p.position.set(x, 1, BACK_Z + 2);
    p.castShadow = true;
    root.add(p);
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), cap);
    c.position.set(x, 2.06, BACK_Z + 2);
    root.add(c);
  }

  // Overhead light strips running down the range.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  for (const x of [-3, 0, 3]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 18), lightMat);
    strip.position.set(x, 7.5, -4);
    root.add(strip);
  }

  const title = sign('PICKLERANGE • LIVE FIRE', '#f2b705', '#121417', 10, 1.2);
  title.position.set(0, 5.6, BACK_Z + 1.6);
  title.rotation.x = 0.2;
  root.add(title);
  const hot = sign('HOT RANGE', '#ffffff', '#b3121b', 3, 0.9);
  hot.position.set(-COURT.halfWidth - 1, 4.2, BACK_Z + 2.2);
  root.add(hot);

  // Rotating beacon light that flashes on a big hit.
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false }));
  beacon.position.set(COURT.halfWidth + 1, 4.4, BACK_Z + 2.2);
  root.add(beacon);

  let flash = 0;
  return {
    root,
    background: new THREE.Color(0x0d0e11),
    fog: new THREE.Fog(0x0d0e11, 22, 50),
    update: (dt, now) => {
      flash = Math.max(0, flash - dt * 2);
      const pulse = 0.5 + 0.5 * Math.sin(now / 160);
      (beacon.material as THREE.MeshBasicMaterial).color.setRGB(0.6 + 0.4 * pulse + flash, 0.08 + flash * 0.5, 0.08);
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
