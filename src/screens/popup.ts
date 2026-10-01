import { music } from '../audio/music';
import * as THREE from 'three';
import type { App } from '../app';
import { BASELINE_Z, COURT } from '../core/court';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { GLOW_FACE_INTENSITY, createTarget, placeTargetProp } from '../engine/props';
import { easeInCubic, easeOutBack, type Scope } from '../engine/scope';
import { NEON_HEX, RED_HEX } from '../engine/textures';
import { DEFAULT_RINGS, scaleRings } from '../games/bullseye/bullseyeLogic';
import { POPUP_LEVELS } from '../games/popup/levels';
import {
  DEFAULT_POPUP,
  applyHit,
  createPopUp,
  isOver,
  lifeLeft,
  multiplierFor,
  radiusAt,
  tick,
  timeLeftMs,
  type PopUpOptions,
  type PopUpState,
} from '../games/popup/popupLogic';
import { banner, hudBar, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = POPUP_LEVELS[ctx.index];
  const opts: PopUpOptions = {
    ...DEFAULT_POPUP,
    ...level.settings,
    area: { minX: -COURT.halfWidth + 0.1, maxX: COURT.halfWidth - 0.1, minZ: BASELINE_Z + 0.6, maxZ: -1.4 },
    // No posts: targets hover high enough that their shadow on the court reads as floating.
    centerHeight: 1.05,
  };
  // The Bullseye ring design, scaled to this level's target size.
  const rings = scaleRings(DEFAULT_RINGS, opts.radius / DEFAULT_RINGS[3].radius);
  const target = level.info.target!;

  let state: PopUpState = createPopUp(performance.now());
  const meshes = new Map<number, THREE.Group>();
  let lastMultiplier = 1;
  let finished = false;

  const [scoreEl, timeEl, streakEl, hitsEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Time', value: String(opts.durationMs / 1000) },
    { label: 'Multiplier', value: 'x1', className: 'neon' },
    { label: 'Hits', value: '0' },
  ]);
  const showScore = (bump: boolean) => {
    setValue(scoreEl, String(ctx.totalBefore + state.score), bump);
    ctx.setProgress(state.score / target);
  };

  /** Takes a target out of play immediately and animates it away. */
  const removeMesh = async (id: number, how: 'pop' | 'sink', delayMs = 0) => {
    const mesh = meshes.get(id);
    if (!mesh) return;
    meshes.delete(id);
    if (delayMs) await scope.wait(delayMs);
    const start = mesh.scale.x;
    await scope.animate(
      how === 'pop' ? 220 : 260,
      (t) => mesh.scale.setScalar(how === 'pop' ? start * (1 + t * 0.6) : Math.max(0.01, start * (1 - t))),
      easeInCubic,
    );
    scope.remove(mesh);
  };

  app.debugAim = () => {
    const real = state.targets.find((t) => !t.bomb);
    return real ? { x: real.x, y: real.y, z: real.z } : null;
  };

  return new Promise((resolve) => {
    scope.onUpdate((_, now) => {
      if (finished) return;
      if (isOver(state, opts, now)) {
        finished = true;
        for (const id of [...meshes.keys()]) void removeMesh(id, 'sink');
        scope.after(600, () => resolve({ score: state.score, passed: state.score >= target }));
        return;
      }

      const { state: next, vanished } = tick(state, opts, now, Math.random);
      state = next;
      for (const t of vanished) void removeMesh(t.id, 'sink');
      if (vanished.some((t) => !t.bomb)) setValue(streakEl, 'x1');

      for (const t of state.targets) {
        let mesh = meshes.get(t.id);
        if (!mesh) {
          // Floating targets with a neon rim (no post); bombs glow red.
          const glow = t.bomb ? 0xff2b2b : t.id % 2 ? 0x3ff5ff : 0xff2fd6;
          mesh = scope.add(createTarget(rings, { stand: false, glow, bomb: t.bomb }));
          placeTargetProp(mesh, t.x, t.y, t.z);
          meshes.set(t.id, mesh);
          const m = mesh;
          void scope.animate(300, (k) => m.scale.setScalar(Math.max(0.01, k)), easeOutBack);
        }
        // Hover gently. A few cm of bob is far smaller than the target, so scoring is unaffected.
        mesh.position.y = t.y + Math.sin(now / 420 + t.id) * 0.05;
        // Shrink the face as time runs out, and flash red near the end (not for bombs).
        const scale = radiusAt(t, opts, now) / opts.radius;
        (mesh.userData.face as THREE.Group).scale.set(scale, scale, 1);
        const face = mesh.userData.faceMaterial as THREE.MeshStandardMaterial;
        const urgent = !t.bomb && lifeLeft(t, opts, now) < 0.3;
        face.emissive.setHex(urgent ? RED_HEX : 0xffffff);
        face.emissiveIntensity = urgent ? 0.4 + 0.4 * Math.sin(now / 60) : GLOW_FACE_INTENSITY;
      }

      setValue(timeEl, String(Math.ceil(timeLeftMs(state, opts, now) / 1000)));
    });

    scope.onHit(async (hit) => {
      if (finished) return;
      const now = performance.now();
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, now);
      if (!result) return;
      state = next;
      showScore(result.kind === 'hit');
      setValue(hitsEl, String(state.hits));
      const multiplier = multiplierFor(state.streak);
      setValue(streakEl, `x${multiplier}`, multiplier > lastMultiplier);

      if (result.kind === 'miss') {
        lastMultiplier = 1;
        const at = pointAlong(ray);
        await ballFlight(scope, at, 200);
        burst(scope, at, 0xffffff, 0.1);
        music.sfx('miss');
        floatText(scope, at, 'MISS', 'muted', 64);
        return;
      }

      void removeMesh(result.target.id, 'pop', 180);
      await ballFlight(scope, result.at, 180);

      if (result.kind === 'bomb') {
        lastMultiplier = 1;
        burst(scope, result.at, 0xff4b1f, 1);
        shockwave(scope, result.at, RED_HEX, 2.5);
        music.sfx('bad');
        floatText(scope, result.at, `BOOM! ${result.points}`, 'red', 96);
        app.stage.shake(0.18, 400);
        return;
      }

      burst(scope, result.at, NEON_HEX, 0.5 + result.multiplier * 0.12);
      shockwave(scope, result.at, NEON_HEX, 1.2);
      music.sfx(result.multiplier >= 3 ? 'big' : 'hit');
      floatText(scope, result.at, `+${result.points}`, 'neon', 80 + result.multiplier * 8);
      app.world.cheer(0.2 + result.multiplier * 0.2);
      if (multiplier > lastMultiplier) void banner(scope, `x${multiplier} STREAK!`, 'neon', 230, 90, 500);
      lastMultiplier = multiplier;
    });
  });
}

export function popUpScreen(app: App, scope: Scope): void {
  app.world.show('neon');
  void runLevels(app, scope, {
    gameId: 'popup',
    levels: POPUP_LEVELS.map((l) => l.info),
    play: (ctx) => playLevel(app, ctx),
  });
}
