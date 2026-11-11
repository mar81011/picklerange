import { music } from '../audio/music';
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { App } from '../app';
import type { Vec3 } from '../core/geometry';
import { Character, loadModel } from '../engine/character';
import { ballFlight, burst, floatText, groundRipple, shockwave } from '../engine/effects';
import { easeInCubic, linear, type Scope } from '../engine/scope';
import { sparkTexture } from '../engine/textures';
import { DRAGON_LEVELS } from '../games/dragon/levels';
import {
  PARTS,
  PART_IDS,
  applyHit,
  createDragon,
  fireballAt,
  flightPosition,
  flightSpeed,
  isHovering,
  isOver,
  tick,
  type DragonOptions,
  type DragonState,
  type Fireball,
  type PartId,
  type PartTarget,
} from '../games/dragon/logic';
import { hudBar, setPips, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

/** CC0 "Dragon Evolved" by Quaternius (see public/models/CREDITS.md). */
export const DRAGON_MODEL = '/models/dragon.glb';
const clip = (name: string) => `CharacterArmature|${name}`;
/** The model faces the player, so its own left side is on screen right. */
const BREAKABLE: Partial<Record<PartId, string>> = { wingL: 'Wing1R', wingR: 'Wing1L', clawL: 'LowerArmR', clawR: 'LowerArmL', tail: 'Body2' };
const PART_COLORS: Record<PartId, number> = { head: 0xffd23f, wingL: 0xff8a3d, wingR: 0xff8a3d, clawL: 0xff5a5f, clawR: 0xff5a5f, tail: 0xffb703, body: 0xffffff };
const BROKEN_PARTS = PART_IDS.filter((p) => PARTS[p].hp !== null).length;

/** Bone lookups for one dragon copy. Names lose their dots when three.js loads them (Wing1.L → Wing1L). */
function bones(actor: Character): (name: string) => THREE.Object3D {
  const found = new Map<string, THREE.Object3D>();
  actor.root.traverse((o) => found.set(o.name, o));
  return (name) => found.get(name)!;
}

function damageFlash(scope: Scope): void {
  const el = scope.el('div', 'layer damage-flash');
  scope.after(500, () => el.remove());
}

const TRAIL = 8;

/**
 * A ball of fire: a white-hot core in flickering flame layers and a trail of
 * embers. Call flicker each frame.
 */
function fireballMesh(): { root: THREE.Group; flicker(now: number): void; trail: THREE.Sprite[] } {
  const root = new THREE.Group();
  const flame = (color: number, size: number, opacity: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity }));
    s.scale.setScalar(size);
    root.add(s);
    return s;
  };
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0, toneMapped: false }));
  root.add(core);
  const outer = flame(0xff3a0a, 1.3, 0.9);
  const mid = flame(0xff8a1a, 0.85, 1);
  const inner = flame(0xffe08a, 0.5, 1);
  // Trail sprites live in the scene, not the group, so they stay behind as it moves.
  const trail = Array.from({ length: TRAIL }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: 0xff6a1a, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.7 * (1 - i / TRAIL) }));
    s.scale.setScalar(0.5 * (1 - i / TRAIL) + 0.1);
    return s;
  });
  return {
    root,
    trail,
    flicker: (now) => {
      outer.scale.setScalar(1.2 + 0.2 * Math.sin(now / 47));
      mid.scale.setScalar(0.8 + 0.12 * Math.sin(now / 31 + 1));
      inner.scale.setScalar(0.5 + 0.08 * Math.sin(now / 23 + 2));
      outer.material.rotation = now / 300;
    },
  };
}
type FireballMesh = ReturnType<typeof fireballMesh>;

/** A broken-off piece shaped like the part it came from. */
function debrisMesh(part: PartId | 'armor', color: THREE.Color, size: number): THREE.Object3D {
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  if (part === 'armor') return helmetMesh(size);
  if (part === 'wingL' || part === 'wingR') {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.9, 0.25);
    shape.lineTo(0.75, -0.35);
    shape.lineTo(0.45, -0.15);
    shape.lineTo(0.25, -0.45);
    shape.closePath();
    const membrane = new THREE.MeshStandardMaterial({ color: 0x3a1a3a, side: THREE.DoubleSide, roughness: 0.8 });
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), membrane);
    const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 6), skin);
    bone.rotation.z = -Math.PI / 2 + 0.27;
    bone.position.set(0.45, 0.13, 0);
    const g = new THREE.Group();
    g.add(wing, bone);
    if (part === 'wingL') g.scale.x = -1;
    g.scale.multiplyScalar(size);
    return g;
  }
  if (part === 'tail') {
    const g = new THREE.Group();
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.11, 0.8, 8), skin);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 4), new THREE.MeshStandardMaterial({ color: 0xc8ccd8 }));
    spike.position.y = -0.48;
    spike.rotation.x = Math.PI;
    g.add(tail, spike);
    g.scale.setScalar(size);
    return g;
  }
  // A claw: a stubby arm with three white talons.
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 8), skin));
  const talon = new THREE.MeshStandardMaterial({ color: 0xf0ece0 });
  for (const dx of [-0.06, 0, 0.06]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5), talon);
    t.position.set(dx, -0.3, 0.02);
    t.rotation.x = Math.PI;
    g.add(t);
  }
  g.scale.setScalar(size);
  return g;
}

/** Steel helmet with a spike, worn over the head in armored levels. */
function helmetMesh(size: number): THREE.Group {
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa6ba, metalness: 0.5, roughness: 0.3, emissive: 0x3a4250, emissiveIntensity: 0.4 });
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), steel);
  dome.scale.set(1.15, 0.85, 1.05);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.035, 6, 24), steel);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1.08, 1, 1);
  const spike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), steel);
  spike.position.y = 0.3;
  g.add(dome, band, spike);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  g.scale.setScalar(size);
  return g;
}

/** Throws a piece off the dragon: it flies out, spins, bounces once on the court and fades. */
function throwDebris(scope: Scope, piece: THREE.Object3D, from: Vec3, side: number): void {
  scope.add(piece);
  const v = new THREE.Vector3(side * (1 + Math.random()), 2 + Math.random() * 1.5, 1 + Math.random());
  const spin = new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
  const p = new THREE.Vector3(from.x, from.y, from.z);
  let last = performance.now();
  void scope
    .animate(
      1800,
      (t) => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        v.y -= 9.8 * dt;
        p.addScaledVector(v, dt);
        if (p.y < 0.1 && v.y < 0) {
          p.y = 0.1;
          v.set(v.x * 0.5, -v.y * 0.35, v.z * 0.5);
          spin.multiplyScalar(0.5);
        }
        piece.position.copy(p);
        piece.rotation.x += spin.x * dt;
        piece.rotation.y += spin.y * dt;
        piece.rotation.z += spin.z * dt;
        if (t > 0.75) piece.scale.multiplyScalar(0.94);
      },
      linear,
    )
    .then(() => scope.remove(piece));
}

/** The dragon's health bar, at the bottom of the screen. */
function healthBar(scope: Scope, name: string): (fraction: number) => void {
  const wrap = scope.el('div', 'panel dragon-health');
  scope.el('div', 'label', wrap, name);
  const bar = scope.el('div', 'bar', wrap);
  const fill = scope.el('div', '', bar);
  return (fraction) => {
    fill.style.width = `${Math.max(0, fraction) * 100}%`;
    bar.classList.add('hurt');
    void bar.offsetWidth;
    scope.after(10, () => bar.classList.remove('hurt'));
  };
}

function playLevel(app: App, ctx: LevelContext, model: GLTF): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = DRAGON_LEVELS[ctx.index];
  const opts: DragonOptions = level.options;
  const bonusBalls = typeof ctx.carry === 'number' ? ctx.carry : 0;
  const startedAt = performance.now();
  let state: DragonState = createDragon(opts, startedAt, bonusBalls);
  const totalBalls = state.ballsLeft;
  let finished = false;

  // Tinting gives this dragon its own materials; then repaint them in the level's colors.
  const actor = new Character(model, { heightM: opts.size, tint: 0xffffff });
  for (const m of actor.materials) {
    if (m.name === 'Dragon_Main') m.color.setHex(level.colors.main);
    else if (m.name === 'Dragon_Secondary') m.color.setHex(level.colors.secondary);
    else if (m.name === 'Dragon_Horn') m.color.setHex(0xf2ead8);
    if (m.name.startsWith('Dragon')) {
      m.roughness = 0.5;
      m.metalness = 0.1;
    }
  }
  /** A white-hot flash on a hit (the default red flash turns the whole dragon into a blob). */
  const flash = () => {
    for (const m of actor.materials) {
      m.emissive.setHex(0xffffff);
      m.emissiveIntensity = 0.35;
    }
    scope.after(110, () => actor.materials.forEach((m) => m.emissive.setHex(0x000000)));
  };
  const bone = bones(actor);
  const k = opts.size / 2;
  scope.add(actor.root);
  scope.onDispose(() => actor.dispose());
  const skinColor = new THREE.Color(level.colors.main);

  // Flight: the phase moves along the path, easing to a stop for each hover.
  let phase = 0;
  let pace = 1;
  let loop = clip('Fast_Flying');
  /** Set while a one-shot (hit, spit) plays, so the flight loop doesn't cut it off. */
  let busy = false;
  let alive = true;
  void actor.play(loop, { fade: 0 });

  const v = new THREE.Vector3();
  const at = (name: string) => bone(name).getWorldPosition(v.clone());
  const mid = (a: string, b: string) => at(a).add(at(b)).multiplyScalar(0.5);
  /** Where each part is right now, as spheres for the rules. */
  const targets = (): PartTarget[] => {
    const head = at('Head');
    head.add(head.clone().sub(at('Neck')).multiplyScalar(0.6));
    const list: PartTarget[] = [
      { part: 'head', center: head, radius: 0.3 * k },
      { part: 'body', center: at('Torso').add(new THREE.Vector3(0, -0.05 * k, 0.15 * k)), radius: 0.36 * k },
      { part: 'wingL', center: mid('Wing2R', 'Wing3R'), radius: 0.42 * k },
      { part: 'wingR', center: mid('Wing2L', 'Wing3L'), radius: 0.42 * k },
      { part: 'clawL', center: mid('LowerArmR', 'Middle1R'), radius: 0.26 * k },
      { part: 'clawR', center: mid('LowerArmL', 'Middle1L'), radius: 0.26 * k },
      { part: 'tail', center: at('Body3'), radius: 0.24 * k },
    ];
    return list.filter((t) => !state.parts[t.part].broken);
  };
  const targetOf = (part: PartId) => targets().find((t) => t.part === part)?.center ?? at('Torso');

  const helmet = state.armor > 0 ? scope.add(helmetMesh(k)) : null;

  /** One-shot animation, then back to the flight loop. */
  const react = (name: string, timeScale = 1.4) => {
    if (!alive) return;
    busy = true;
    void actor.play(clip(name), { loop: false, timeScale, fade: 0.05 }).then(() => {
      busy = false;
      if (alive) void actor.play(loop, { fade: 0.15 });
    });
  };

  // Hit zones, for tuning with ?zones (dev builds only).
  const zoneMeshes = new Map<PartId, THREE.Mesh>();
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('zones')) {
    for (const id of PART_IDS) {
      const mesh = scope.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: PART_COLORS[id], wireframe: true })));
      zoneMeshes.set(id, mesh);
    }
  }

  const [scoreEl, ballsEl, brokenEl, lastEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Balls left', value: null },
    { label: 'Parts broken', value: `0/${BROKEN_PARTS}` },
    { label: 'Last hit', value: '—', className: 'neon' },
  ]);
  const setHealth = healthBar(scope, level.info.name.toUpperCase());
  const refresh = () => {
    setValue(scoreEl, String(ctx.totalBefore + state.score));
    setPips(ballsEl, state.ballsLeft, totalBalls);
    setValue(brokenEl, `${state.breaks}/${BROKEN_PARTS}`);
    setHealth(state.hp / state.maxHp);
    ctx.setProgress(1 - state.hp / state.maxHp);
  };
  refresh();

  const fireballs = new Map<number, FireballMesh>();
  // One light follows the nearest fireball. It is always in the scene (dark when
  // there is no fireball): adding and removing lights makes three.js rebuild every shader.
  const fireLight = scope.add(new THREE.PointLight(0xff7a1a, 0, 5, 1.6));
  app.debugAim = (key) => {
    const fire = state.fireballs[0];
    if (fire && key !== 'dragon') return fireballAt(fire, performance.now());
    const part = PART_IDS.includes(key as PartId) ? (key as PartId) : 'head';
    return targets().find((t) => t.part === part)?.center ?? targets()[0]?.center ?? null;
  };

  /** Each trail sprite eases toward the one ahead of it, so the trail curves behind the fireball. */
  const followTrail = (mesh: FireballMesh) => {
    let lead = mesh.root.position;
    for (const s of mesh.trail) {
      s.position.lerp(lead, 0.45);
      lead = s.position;
    }
  };
  const removeFireball = (mesh: FireballMesh) => {
    scope.remove(mesh.root);
    for (const s of mesh.trail) scope.remove(s);
  };

  // Wingbeats kick up dust on the court below while the dragon hovers.
  scope.every(650, () => {
    if (!alive || finished || !isHovering(opts, startedAt, performance.now())) return;
    const p = actor.root.position;
    groundRipple(scope, { x: p.x, y: 0, z: p.z }, 0xffb36b);
  });

  return new Promise((resolve) => {
    const finish = async (passed: boolean) => {
      if (finished) return;
      finished = true;
      for (const mesh of fireballs.values()) removeFireball(mesh);
      fireballs.clear();
      if (passed) {
        alive = false;
        helmet && scope.remove(helmet);
        await actor.play(clip('Death'), { loop: false, timeScale: 0.8, fade: 0.1 });
        const from = actor.root.position.clone();
        await scope.animate(700, (t) => {
          actor.root.position.set(from.x, from.y * (1 - t), from.z);
          actor.root.rotation.z = t * 0.6;
        }, easeInCubic);
        shockwave(scope, { x: from.x, y: 0.2, z: from.z }, 0xff8a3d, 4);
        burst(scope, { x: from.x, y: 0.3, z: from.z }, 0xff8a3d, 1);
        app.stage.shake(0.25, 500);
        music.sfx('big');
        app.world.cheer(1);
        floatText(scope, { x: from.x, y: 2.2, z: from.z }, 'DRAGON DEFEATED!', 'neon', 110);
        await scope.wait(1400);
      } else {
        // Out of balls: it flies off, laughing.
        void actor.play(clip('Fast_Flying'), { fade: 0.2 });
        const from = actor.root.position.clone();
        floatText(scope, { x: from.x, y: from.y + 2, z: from.z }, 'IT GOT AWAY!', 'red', 100);
        await scope.animate(1400, (t) => actor.root.position.set(from.x + t * 3, from.y + t * 6, from.z - t * 12), easeInCubic);
        alive = false;
      }
      resolve({ score: state.score, passed, carry: state.ballsLeft });
    };

    scope.onUpdate((dt, now) => {
      actor.update(dt);
      if (alive && !finished) {
        const hovering = isHovering(opts, startedAt, now);
        pace += ((hovering ? 0.06 : 1) - pace) * Math.min(1, dt * 2.5);
        const before = flightPosition(state, opts, phase);
        phase += dt * flightSpeed(state, opts) * pace;
        const p = flightPosition(state, opts, phase);
        actor.root.position.set(p.x, p.y, p.z);
        // Lean into the turns.
        const vx = (p.x - before.x) / Math.max(dt, 1e-3);
        actor.root.rotation.z += (-vx * 0.12 - actor.root.rotation.z) * Math.min(1, dt * 4);
        actor.root.rotation.y += (vx * 0.15 - actor.root.rotation.y) * Math.min(1, dt * 4);
        const want = clip(hovering ? 'Flying_Idle' : 'Fast_Flying');
        if (want !== loop) {
          loop = want;
          if (!busy) void actor.play(loop, { fade: 0.3 });
        }
      }
      // Broken parts stay gone whatever the animation does.
      for (const [part, name] of Object.entries(BREAKABLE)) if (state.parts[part as PartId].broken) bone(name).scale.setScalar(1e-4);
      actor.root.updateMatrixWorld(true);

      const live = targets();
      if (helmet) {
        const head = live.find((t) => t.part === 'head');
        if (head) helmet.position.set(head.center.x, head.center.y + 0.02 * k, head.center.z);
        helmet.rotation.copy(actor.root.rotation);
      }
      for (const [id, mesh] of zoneMeshes) {
        const t = live.find((x) => x.part === id);
        mesh.visible = !!t;
        if (t) {
          mesh.position.set(t.center.x, t.center.y, t.center.z);
          mesh.scale.setScalar(t.radius);
        }
      }

      if (finished) return;
      const head = live.find((t) => t.part === 'head')?.center ?? at('Head');
      const mouth = { x: head.x, y: head.y - 0.1 * k, z: head.z + 0.3 * k };
      const t = tick(state, opts, now, mouth, Math.random);
      state = t.state;
      for (const f of t.launched) {
        const mesh = fireballMesh();
        scope.add(mesh.root);
        for (const s of mesh.trail) {
          s.position.set(mouth.x, mouth.y, mouth.z);
          scope.add(s);
        }
        fireballs.set(f.id, mesh);
        react('Headbutt', 1.8);
        music.sfx('count');
        floatText(scope, { x: mouth.x, y: mouth.y + 0.6, z: mouth.z }, 'FIREBALL!', 'red', 70);
      }
      for (const f of t.burned) {
        const mesh = fireballs.get(f.id);
        fireballs.delete(f.id);
        if (mesh) removeFireball(mesh);
        burst(scope, f.to, 0xff6a1a, 0.8);
        damageFlash(scope);
        app.stage.shake(0.15, 350);
        music.sfx('bad');
        floatText(scope, { x: f.to.x, y: 1.6, z: -0.8 }, 'BURNED! −1 BALL', 'red', 80);
      }
      for (const f of state.fireballs) {
        const mesh = fireballs.get(f.id);
        if (!mesh) continue;
        const p = fireballAt(f, now);
        mesh.root.position.set(p.x, p.y, p.z);
        mesh.flicker(now);
        followTrail(mesh);
      }
      const lit = state.fireballs.length ? fireballs.get(state.fireballs[0].id) : undefined;
      fireLight.intensity = lit ? 7 + 2 * Math.sin(now / 41) : 0;
      if (lit) fireLight.position.copy(lit.root.position);
      if (t.burned.length) {
        refresh();
        if (isOver(state)) void finish(false);
      }
    });

    /** Knocks a part off: the bone collapses and a matching piece tumbles to the court. */
    const breakPart = (part: PartId, where: Vec3) => {
      const side = part.endsWith('L') ? -1 : part.endsWith('R') ? 1 : 0;
      throwDebris(scope, debrisMesh(part, skinColor, k), where, side);
      burst(scope, where, 0xff8a3d, 1);
      shockwave(scope, where, 0xffd23f, 2.2);
      app.stage.shake(0.18, 400);
      music.sfx('big');
      app.world.cheer(0.9);
      floatText(scope, { ...where, y: where.y + 0.7 }, `${PARTS[part].label} BROKEN!`, 'neon', 100);
    };

    /** A fireball hit back: it flies into the dragon's chest and explodes. */
    const returnFireball = async (f: Fireball, from: Vec3) => {
      const mesh = fireballs.get(f.id);
      fireballs.delete(f.id);
      if (!mesh) return;
      const to = targetOf('body');
      const start = new THREE.Vector3(from.x, from.y, from.z);
      await scope.animate(
        350,
        (t) => {
          mesh.root.position.lerpVectors(start, to, t);
          mesh.flicker(performance.now());
          followTrail(mesh);
        },
        linear,
      );
      removeFireball(mesh);
      burst(scope, to, 0xff6a1a, 1);
      shockwave(scope, to, 0xff6a1a, 2);
      if (alive) react('HitReact');
    };

    scope.onHit(async (hit) => {
      if (finished) return;
      const now = performance.now();
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, targets(), now);
      if (!result) return;
      state = next;
      setPips(ballsEl, state.ballsLeft, totalBalls);

      if (result.kind === 'miss') {
        const where = pointAlong(ray);
        await ballFlight(scope, where, 220);
        burst(scope, where, 0xffffff, 0.12);
        music.sfx('miss');
        floatText(scope, where, 'MISS', 'muted', 64);
      } else if (result.kind === 'fireball') {
        await ballFlight(scope, result.at, 200);
        music.sfx('big');
        floatText(scope, result.at, `RETURNED! +${result.points}`, 'neon', 84);
        setValue(lastEl, 'FIREBALL', true);
        void returnFireball(result.fireball, result.at);
      } else {
        await ballFlight(scope, result.at, 220);
        // The dragon moved while the ball flew; show the effects where the part is now.
        const where = state.parts[result.part].broken ? result.at : targetOf(result.part);
        const label = PARTS[result.part].label;
        if (result.armor) {
          burst(scope, where, 0xc8d4e6, 0.5);
          music.sfx('hit');
          if (result.armor === 'broke' && helmet) {
            scope.remove(helmet);
            throwDebris(scope, helmetMesh(k), where, 0);
            shockwave(scope, where, 0xc8d4e6, 1.8);
            floatText(scope, { ...where, y: where.y + 0.5 }, 'ARMOR BROKEN!', 'neon', 96);
          } else {
            floatText(scope, { ...where, y: where.y + 0.5 }, `CLANG! +${result.points}`, 'muted', 76);
          }
          setValue(lastEl, 'ARMOR', true);
        } else {
          burst(scope, where, PART_COLORS[result.part], 0.5);
          flash();
          react('HitReact');
          if (result.broke) breakPart(result.part, where);
          else {
            music.sfx(result.part === 'head' ? 'big' : 'hit');
            const more = result.hitsLeft !== null ? ` • ${result.hitsLeft} MORE` : '';
            floatText(scope, { ...where, y: where.y + 0.4 }, `${label} +${PARTS[result.part].points}${more}`, result.part === 'head' ? 'neon' : '', 76);
          }
          setValue(lastEl, label, true);
        }
      }
      refresh();
      if (isOver(state)) {
        await scope.wait(300);
        void finish(state.defeated);
      }
    });
  });
}

export function dragonScreen(app: App, scope: Scope): void {
  app.world.show('volcano');
  // Lava and fire glow; the other games keep the plain renderer.
  app.stage.setBloom(0.7);
  scope.onDispose(() => app.stage.setBloom(0));
  void loadModel(DRAGON_MODEL).then((model) => {
    if (!scope.alive) return;
    void runLevels(app, scope, {
      gameId: 'dragon',
      levels: DRAGON_LEVELS.map((l) => l.info),
      play: (ctx) => playLevel(app, ctx, model),
    });
  });
}
