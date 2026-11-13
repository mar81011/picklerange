// Night carnival: a striped big top behind the court, a lit Ferris wheel,
// strings of colored bulbs and game booths along the sides. Used by Dunk Tank.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

const BULB_COLORS = [0xffd23f, 0xff4a5a, 0x3ff5ff, 0x7cff6b, 0xff8ad8];

function stripes(a: string, b: string, count: number, vertical = true): THREE.CanvasTexture {
  return canvasTexture(256, 256, (ctx) => {
    const w = 256 / count;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      if (vertical) ctx.fillRect(i * w, 0, w + 1, 256);
      else ctx.fillRect(0, i * w, 256, w + 1);
    }
  });
}

/** Instanced glowing bulbs; returns the mesh so they can twinkle. */
function bulbs(points: THREE.Vector3[], size = 0.07): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ toneMapped: false }), points.length);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  points.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(BULB_COLORS[i % BULB_COLORS.length]));
  });
  return mesh;
}

/** A sagging string of bulbs between two points. */
function bulbString(a: THREE.Vector3, b: THREE.Vector3, count: number, sag: number): THREE.Vector3[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    return a.clone().lerp(b, t).add(new THREE.Vector3(0, -Math.sin(Math.PI * t) * sag, 0));
  });
}

function bigTop(): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 5, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: stripes('#d8283c', '#f6efe4', 24), roughness: 0.8, side: THREE.DoubleSide }),
  );
  (wall.material as THREE.MeshStandardMaterial).map!.wrapS = THREE.RepeatWrapping;
  (wall.material as THREE.MeshStandardMaterial).map!.repeat.set(2, 1);
  wall.position.y = 2.5;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(10, 5, 32, 1, true),
    new THREE.MeshStandardMaterial({ map: stripes('#d8283c', '#f6efe4', 24), roughness: 0.8, side: THREE.DoubleSide }),
  );
  (roof.material as THREE.MeshStandardMaterial).map!.wrapS = THREE.RepeatWrapping;
  (roof.material as THREE.MeshStandardMaterial).map!.repeat.set(2, 1);
  roof.position.y = 7.5;
  const flag = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 3), new THREE.MeshStandardMaterial({ color: 0xffd23f }));
  flag.rotation.z = -Math.PI / 2;
  flag.position.set(0.5, 10.6, 0);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
  pole.position.y = 10.6;
  // Glowing entrance.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.6), new THREE.MeshBasicMaterial({ color: 0xffb85a, toneMapped: false }));
  door.position.set(0, 1.8, 9.02);
  g.add(wall, roof, flag, pole, door);
  // Bulbs around the roof edge.
  const ring = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2;
    return new THREE.Vector3(Math.sin(a) * 9.6, 5.1, Math.cos(a) * 9.6);
  });
  g.add(bulbs(ring, 0.12));
  return g;
}

function ferrisWheel(): { root: THREE.Group; wheel: THREE.Group } {
  const root = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.5, roughness: 0.4 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 8.6, 6), steel);
    leg.position.set(s * 2.2, 4, 0);
    leg.rotation.z = s * 0.26;
    root.add(leg);
  }
  const wheel = new THREE.Group();
  wheel.position.y = 8;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(6, 0.12, 6, 48), steel);
  wheel.add(rim);
  const rimBulbs: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 6, 4), steel);
    spoke.position.set(Math.cos(a) * 3, Math.sin(a) * 3, 0);
    spoke.rotation.z = a - Math.PI / 2;
    wheel.add(spoke);
    const car = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: BULB_COLORS[i % BULB_COLORS.length], roughness: 0.5 }));
    car.position.set(Math.cos(a) * 6, Math.sin(a) * 6 - 0.5, 0);
    car.userData.car = true;
    wheel.add(car);
  }
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    rimBulbs.push(new THREE.Vector3(Math.cos(a) * 6, Math.sin(a) * 6, 0.15));
  }
  wheel.add(bulbs(rimBulbs, 0.1));
  root.add(wheel);
  return { root, wheel };
}

function booth(color: string, x: number, z: number, turn: number): THREE.Group {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a2a4a, roughness: 0.8 }));
  box.position.y = 1;
  const awning = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 1.7), new THREE.MeshStandardMaterial({ map: stripes(color, '#ffffff', 8), roughness: 0.7 }));
  awning.position.set(0, 2.3, 0.15);
  awning.rotation.x = 0.2;
  const counter = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false }));
  counter.position.set(0, 1.3, 0.71);
  g.add(box, awning, counter);
  g.position.set(x, 0, z);
  g.rotation.y = turn;
  return g;
}

export function carnival(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xffd8f0, 0x2a1838, 1.7));
  const key = shadowLight(0xfff0e0, 2.4, [4, 12, 8]);
  root.add(key, key.target);
  // Warm and pink fill lights from the sides, like midway lamps.
  const warm = new THREE.PointLight(0xffa040, 30, 18);
  warm.position.set(-6, 4, -2);
  const pink = new THREE.PointLight(0xff5aa8, 26, 18);
  pink.position.set(6, 4, -3);
  root.add(warm, pink);

  // Sawdust ground scattered with confetti (the part the camera sees, just past the court).
  const confetti = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#4a2c3e';
    ctx.fillRect(0, 0, 512, 512);
    const r = seededRandom(5);
    const colors = ['#ffd23f', '#ff4a5a', '#3ff5ff', '#7cff6b', '#ff8ad8', '#ffffff'];
    for (let i = 0; i < 900; i++) {
      ctx.save();
      ctx.translate(r() * 512, r() * 512);
      ctx.rotate(r() * Math.PI);
      ctx.fillStyle = colors[i % colors.length];
      ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
  });
  confetti.wrapS = confetti.wrapT = THREE.RepeatWrapping;
  confetti.repeat.set(14, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 70), new THREE.MeshStandardMaterial({ map: confetti, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -20;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(buildCourt({ surface: ['#5a2a6a', '#6e3482'], line: '#ffe9a8', kitchen: 'rgba(255,210,63,0.1)', apron: 0x3a2048, roughness: 0.85 }));

  const top = bigTop();
  top.position.set(2, 0, -24);
  root.add(top);
  const fw = ferrisWheel();
  fw.root.position.set(-15, 0, -20);
  fw.root.rotation.y = 0.35;
  root.add(fw.root);

  const rand = seededRandom(17);
  root.add(booth('#3fa0ff', -COURT.halfWidth - 2.6, -6.5, 0.5), booth('#7cff6b', COURT.halfWidth + 2.6, -6, -0.5), booth('#ffd23f', COURT.halfWidth + 3.2, -2.2, -0.9), booth('#ff8ad8', -COURT.halfWidth - 3.2, -2.5, 0.9));

  // Light poles and bulb strings zigzagging along both sides and across the back.
  const poles: THREE.Vector3[] = [];
  for (const s of [-1, 1]) for (const z of [-0.5, -4.5, -9]) poles.push(new THREE.Vector3(s * (COURT.halfWidth + 1.2), 4.2, z));
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.6 });
  for (const p of poles) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, p.y, 6), poleMat);
    pole.position.set(p.x, p.y / 2, p.z);
    root.add(pole);
  }
  const strung: THREE.Vector3[] = [];
  for (const s of [-1, 1]) {
    const side = poles.filter((p) => Math.sign(p.x) === s);
    for (let i = 0; i < side.length - 1; i++) strung.push(...bulbString(side[i], side[i + 1], 16, 0.5));
  }
  strung.push(...bulbString(poles[2], poles[5], 30, 1.1));
  const lights = bulbs(strung, 0.07);
  root.add(lights);

  // Stars.
  const starPoints = Array.from({ length: 120 }, () => new THREE.Vector3((rand() - 0.5) * 120, 10 + rand() * 30, -45 - rand() * 10));
  const stars = new THREE.Points(new THREE.BufferGeometry().setFromPoints(starPoints), new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, fog: false }));
  root.add(stars);

  let t = 0;
  let flash = 0;
  const color = new THREE.Color();
  return {
    root,
    background: skyTexture([
      [0, '#0a0620'],
      [0.5, '#2a1450'],
      [0.75, '#6a2a6a'],
      [0.9, '#c0507a'],
      [1, '#2a1838'],
    ]),
    fog: new THREE.Fog(0x2a1838, 22, 70),
    update: (dt) => {
      t += dt;
      flash = Math.max(0, flash - dt * 1.5);
      fw.wheel.rotation.z = t * 0.12;
      // Cars hang level as the wheel turns.
      for (const car of fw.wheel.children) if (car.userData.car) car.rotation.z = -fw.wheel.rotation.z;
      // Chasing lights; brighter on a big moment.
      for (let i = 0; i < strung.length; i++) {
        const on = Math.sin(t * 4 - i * 0.6) > -0.3 || flash > 0.2;
        color.setHex(BULB_COLORS[i % BULB_COLORS.length]).multiplyScalar(on ? 1 + flash * 1.5 : 0.25);
        lights.setColorAt(i, color);
      }
      lights.instanceColor!.needsUpdate = true;
      warm.intensity = 30 + flash * 40;
      pink.intensity = 26 + flash * 40;
    },
    cheer: (level) => (flash = Math.max(flash, level)),
  };
}
