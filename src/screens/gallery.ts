import { music } from '../audio/music';
import type * as THREE from 'three';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { createPlate, createRangeRails } from '../engine/gameProps';
import type { Scope } from '../engine/scope';
import { GALLERY_LEVELS } from '../games/gallery/levels';
import { RAILS, RAIL_HALF_LENGTH, applyHit, createGallery, isOver, platePosition, tick, timeLeftMs, type GalleryOptions } from '../games/gallery/logic';
import { hudBar, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = GALLERY_LEVELS[ctx.index];
  const opts: GalleryOptions = { ...level.settings, debounceMs: HIT_DEBOUNCE_MS };
  const target = level.info.target!;
  let state = createGallery(performance.now());
  let finished = false;
  const plates = new Map<number, THREE.Group>();
  scope.add(createRangeRails(RAILS, RAIL_HALF_LENGTH));

  const [scoreEl, timeEl, hitsEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Time', value: String(Math.round(opts.durationMs / 1000)) },
    { label: 'Plates rung', value: '0', className: 'neon' },
    { label: 'Gold plate', value: '50 pts' },
  ]);

  /** Removes a plate; when knocked, it swings back on its hinge first, like real steel. */
  const dropPlate = async (id: number, knocked: boolean) => {
    const mesh = plates.get(id);
    if (!mesh) return;
    plates.delete(id);
    if (knocked) {
      const swing = mesh.userData.plate as THREE.Object3D;
      // Swing back, rock forward a little, then fall flat.
      await scope.animate(700, (t) => {
        const s = t < 0.35 ? t / 0.35 : t < 0.6 ? 1 - ((t - 0.35) / 0.25) * 0.35 : 0.65 + ((t - 0.6) / 0.4) * 0.35;
        swing.rotation.x = -s * (Math.PI / 2);
      });
    }
    scope.remove(mesh);
  };

  app.debugAim = () => {
    const now = performance.now();
    // Aim at the nearest scoring plate that is on the court.
    const good = state.plates.filter((d) => d.kind !== 'noshoot').map((d) => platePosition(d, opts, now)).filter((p) => Math.abs(p.x) < 3);
    return good.sort((a, b) => b.z - a.z)[0] ?? null;
  };

  return new Promise((resolve) => {
    scope.onUpdate((_, now) => {
      if (finished) return;
      if (isOver(state, opts, now)) {
        finished = true;
        for (const id of [...plates.keys()]) void dropPlate(id, false);
        scope.after(600, () => resolve({ score: state.score, passed: state.score >= target }));
        return;
      }
      const { state: next, gone } = tick(state, opts, now, Math.random);
      state = next;
      for (const d of gone) void dropPlate(d.id, false);
      for (const d of state.plates) {
        let mesh = plates.get(d.id);
        if (!mesh) {
          mesh = scope.add(createPlate(d.kind, opts.size, RAILS[d.rail].y));
          plates.set(d.id, mesh);
        }
        const p = platePosition(d, opts, now);
        mesh.position.set(p.x, p.y, p.z);
      }
      setValue(timeEl, String(Math.ceil(timeLeftMs(state, opts, now) / 1000)));
    });

    scope.onHit(async (hit) => {
      if (finished) return;
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, performance.now());
      if (!result) return;
      state = next;
      setValue(scoreEl, String(ctx.totalBefore + state.score), result.kind === 'hit' && result.points > 0);
      setValue(hitsEl, String(state.hits));
      ctx.setProgress(state.score / target);

      if (result.kind === 'miss') {
        const at = pointAlong(ray);
        await ballFlight(scope, at, 200);
        music.sfx('miss');
        burst(scope, at, 0xffffff, 0.1);
        return;
      }
      void dropPlate(result.plate.id, true);
      await ballFlight(scope, result.at, 200);
      if (result.plate.kind === 'noshoot') {
        burst(scope, result.at, 0xd62828, 0.6);
        music.sfx('bad');
        floatText(scope, result.at, `NO SHOOT! ${result.points}`, 'red', 84);
        app.stage.shake(0.1, 250);
        return;
      }
      const bonus = result.plate.kind === 'bonus';
      // Sparks off the steel.
      burst(scope, result.at, bonus ? 0xffd23f : 0xffb066, bonus ? 1 : 0.5);
      if (bonus) shockwave(scope, result.at, 0xffd23f, 2);
      music.sfx(bonus ? 'big' : 'hit');
      floatText(scope, result.at, bonus ? `BONUS! +${result.points}` : `DING! +${result.points}`, 'neon', bonus ? 96 : 76);
      app.world.cheer(bonus ? 1 : 0.3);
    });
  });
}

export function galleryScreen(app: App, scope: Scope): void {
  app.world.show('range');
  void runLevels(app, scope, { gameId: 'gallery', levels: GALLERY_LEVELS.map((l) => l.info), play: (ctx) => playLevel(app, ctx) });
}
