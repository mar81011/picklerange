// Sunset beach: sand court, rolling ocean, palm trees, umbrellas and a low
// golden sun. Used by Rally Survival.
import * as THREE from 'three';
import { COURT } from '../../core/court';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

function sand(): THREE.CanvasTexture {
  const t = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#f3dcaa';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,250,235' : '150,110,60'},${Math.random() * 0.25})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(16, 16);
  return t;
}

function ocean(): { mesh: THREE.Mesh; texture: THREE.CanvasTexture } {
  const texture = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#1e8fd0');
    g.addColorStop(1, '#3fd0e0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // Glints from the low sun.
    ctx.fillStyle = 'rgba(255,220,160,0.55)';
    for (let i = 0; i < 160; i++) ctx.fillRect(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 14, 1.5);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(200, 80), new THREE.MeshBasicMaterial({ map: texture }));
  mesh.rotation.x = -Math.PI / 2;
  // The shoreline starts just past the baseline so the sea fills the view behind the court.
  mesh.position.set(0, 0.004, -49.3);
  return { mesh, texture };
}

function palm(x: number, z: number, lean: number, rand: () => number): THREE.Group {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 0.9 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f8f3a, roughness: 0.7, side: THREE.DoubleSide });
  let top = new THREE.Vector3();
  for (let i = 0; i < 9; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.008, 0.2 - i * 0.008, 0.85, 7), bark);
    seg.position.set(Math.sin(i * 0.12) * lean * i * 0.12, 0.42 + i * 0.8, 0);
    seg.rotation.z = -lean * 0.12;
    g.add(seg);
    top = seg.position.clone();
  }
  for (let i = 0; i < 8; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.45, 3.4, 3), leaf);
    frond.scale.z = 0.25;
    frond.position.copy(top).add(new THREE.Vector3(0, 0.4, 0));
    frond.rotation.set(0, (i / 8) * Math.PI * 2 + rand() * 0.3, 1.9);
    frond.translateY(1.6);
    g.add(frond);
  }
  g.position.set(x, 0, z);
  return g;
}

function umbrella(x: number, z: number, color: number): THREE.Group {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  pole.position.y = 1.2;
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 0.6, 12, 1, true),
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.7 }),
  );
  canopy.position.y = 2.5;
  canopy.castShadow = true;
  const towel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), new THREE.MeshStandardMaterial({ color: 0xffffff - color }));
  towel.rotation.x = -Math.PI / 2;
  towel.position.set(0.8, 0.02, 0.4);
  g.add(pole, canopy, towel);
  g.position.set(x, 0, z);
  return g;
}

export function beach(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xfff4e0, 0xc9a06a, 1.4));
  // High sun behind the player: short shadows that stay off the court.
  const sun = shadowLight(0xfff0d8, 2.6, [3, 16, 9]);
  root.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshStandardMaterial({ map: sand(), roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -8;
  ground.receiveShadow = true;
  root.add(ground);
  root.add(buildCourt({ surface: ['#1767bf', '#2280d6'], line: '#ffffff', kitchen: 'rgba(255,214,140,0.18)', apron: 0xf0d49c, roughness: 0.8 }));

  const sea = ocean();
  root.add(sea.mesh);
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  const sail = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 3), new THREE.MeshStandardMaterial({ color: 0xff5a5f }));
  sail.position.y = 1.7;
  boat.add(hull, sail);
  boat.position.set(-12, 0.1, -32);
  root.add(boat);
  // Wet sand / foam line where the waves come in.
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(200, 1.2), new THREE.MeshBasicMaterial({ color: 0xf6fbff, transparent: true, opacity: 0.85 }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, 0.012, -9.4);
  root.add(foam);

  const rand = seededRandom(31);
  for (const [x, z, lean] of [[-COURT.halfWidth - 2.2, -8.5, 1], [COURT.halfWidth + 2.2, -8.8, -1.2], [-COURT.halfWidth - 4.5, -5, 0.8], [COURT.halfWidth + 4.5, -4.5, -0.7], [-COURT.halfWidth - 3, -1.5, 0.6], [COURT.halfWidth + 3.2, -2, -0.9]]) {
    root.add(palm(x, z, lean, rand));
  }
  root.add(umbrella(-COURT.halfWidth - 1.6, -6.5, 0xff5a5f), umbrella(COURT.halfWidth + 1.6, -6.2, 0x3ff5ff));

  // Low sun disc on the horizon.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(6, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd38a, fog: false, toneMapped: false }),
  );
  disc.position.set(10, 2, -90);
  root.add(disc);

  let t = 0;
  let splash = 0;
  return {
    root,
    background: skyTexture([
      [0, '#3a5ca8'],
      [0.4, '#c77dbe'],
      [0.62, '#ff9a6b'],
      [0.75, '#ffd38a'],
      [1, '#e8c98f'],
    ]),
    fog: new THREE.Fog(0xffc9a0, 40, 110),
    update: (dt) => {
      t += dt;
      splash = Math.max(0, splash - dt);
      // Waves: scroll the water and breathe the foam line in and out.
      sea.texture.offset.set(t * 0.01, t * 0.03);
      boat.position.x = -12 + ((t * 0.4) % 30);
      boat.position.y = 0.1 + Math.sin(t * 1.5) * 0.08;
      foam.position.z = -9.4 + Math.sin(t * 0.8) * 0.3;
      (foam.material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.25 * Math.sin(t * 0.8 + 1) + splash * 0.2;
    },
    cheer: (level) => (splash = Math.max(splash, level)),
  };
}
