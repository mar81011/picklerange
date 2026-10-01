// Sunny outdoor park court: grass, chain-link fence, trees and hills. Used by Open Court.
import * as THREE from 'three';
import { canvasTexture, seededRandom } from '../textures';
import { buildCourt, shadowLight, skyTexture } from './court';
import type { Environment } from './types';

const FENCE_Z = -9;

function grass(): THREE.Mesh {
  const texture = canvasTexture(256, 256, (ctx) => {
    // Mowing stripes.
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#3f9a4a' : '#47a853';
      ctx.fillRect(0, i * 32, 256, 32);
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(10, 10);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshLambertMaterial({ map: texture }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = -30;
  mesh.receiveShadow = true;
  return mesh;
}

function fence(root: THREE.Group): void {
  const mesh = canvasTexture(64, 64, (ctx) => {
    ctx.clearRect(0, 0, 64, 64);
    ctx.strokeStyle = '#c9d2dc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(64, 64);
    ctx.moveTo(64, 0);
    ctx.lineTo(0, 64);
    ctx.stroke();
  });
  mesh.wrapS = mesh.wrapT = THREE.RepeatWrapping;
  const material = new THREE.MeshLambertMaterial({ map: mesh, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });

  const panel = (width: number, x: number, z: number, rotY: number) => {
    const tex = material.map!.clone();
    tex.needsUpdate = true;
    tex.repeat.set(width / 0.35, 3 / 0.35);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, 3), material.clone());
    (m.material as THREE.MeshLambertMaterial).map = tex;
    m.position.set(x, 1.5, z);
    m.rotation.y = rotY;
    root.add(m);
  };
  panel(16, 0, FENCE_Z, 0);
  panel(9, -8, FENCE_Z + 4.5, Math.PI / 2);
  panel(9, 8, FENCE_Z + 4.5, Math.PI / 2);

  const postMaterial = new THREE.MeshLambertMaterial({ color: 0x2f4f3a });
  const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3.1, 8);
  const posts: [number, number][] = [];
  for (let x = -8; x <= 8; x += 2) posts.push([x, FENCE_Z]);
  for (let z = FENCE_Z + 2; z <= 0; z += 2) posts.push([-8, z], [8, z]);
  for (const [x, z] of posts) {
    const p = new THREE.Mesh(postGeometry, postMaterial);
    p.position.set(x, 1.55, z);
    p.castShadow = true;
    root.add(p);
  }
}

function trees(root: THREE.Group): void {
  const rand = seededRandom(7);
  const count = 46;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), count);
  const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.6, 0), new THREE.MeshLambertMaterial({ flatShading: true }), count);
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const greens = [0x2e7d32, 0x388e3c, 0x43a047, 0x1b5e20, 0x558b2f];
  for (let i = 0; i < count; i++) {
    const x = -26 + rand() * 52;
    const z = FENCE_Z - 3 - rand() * 18;
    const s = 0.8 + rand() * 0.9;
    m.compose(new THREE.Vector3(x, 1.1 * s, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 3.1 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)), new THREE.Vector3(s, s * 1.2, s));
    leaves.setMatrixAt(i, m);
    leaves.setColorAt(i, color.setHex(greens[Math.floor(rand() * greens.length)]));
  }
  trunks.castShadow = leaves.castShadow = true;
  root.add(trunks, leaves);

  // Distant hills.
  const hillMaterial = new THREE.MeshLambertMaterial({ color: 0x6aa86f, flatShading: true });
  for (const [x, z, r] of [[-30, -60, 18], [5, -70, 24], [38, -62, 20]]) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), hillMaterial);
    hill.position.set(x, -2, z);
    hill.scale.y = 0.45;
    root.add(hill);
  }
}

function bench(root: THREE.Group, x: number, z: number): void {
  const wood = new THREE.MeshLambertMaterial({ color: 0x9c6b3c });
  const metal = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.45), wood);
  seat.position.set(x, 0.45, z);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.05), wood);
  back.position.set(x, 0.75, z - 0.22);
  for (const dx of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), metal);
    leg.position.set(x + dx, 0.22, z);
    root.add(leg);
  }
  seat.castShadow = back.castShadow = true;
  root.add(seat, back);
}

export function park(): Environment {
  const root = new THREE.Group();
  root.add(new THREE.HemisphereLight(0xdcefff, 0x4f7a3a, 1.35));
  const sun = shadowLight(0xfff1d6, 2.6, [-7, 12, 6]);
  root.add(sun, sun.target);

  root.add(grass());
  root.add(buildCourt({ surface: ['#2a62c9', '#3473dd'], line: '#ffffff', kitchen: 'rgba(255,255,255,0.06)', apron: 0x2f8f5b }));
  fence(root);
  trees(root);
  bench(root, -6, -8.2);
  bench(root, 5.5, -8.2);

  return {
    root,
    background: skyTexture(
      [
        [0, '#4f9be8'],
        [0.55, '#9fd0ff'],
        [1, '#e6f4ff'],
      ],
      (ctx, w) => {
        // Soft clouds.
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (const [cx, cy, s] of [[90, 90, 1], [300, 60, 1.3], [430, 130, 0.9], [200, 170, 0.7]]) {
          for (const [dx, dy, r] of [[0, 0, 26], [24, -8, 22], [48, 2, 24], [-22, 4, 18]]) {
            ctx.beginPath();
            ctx.arc((cx + dx * s) % w, cy + dy * s, r * s, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
    ),
    fog: new THREE.Fog(0xcfe6ff, 40, 110),
  };
}
