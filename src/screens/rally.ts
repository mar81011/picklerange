import { music } from '../audio/music';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { ballBounce, ballFlight, burst, floatText, groundRipple } from '../engine/effects';
import { createFloorTarget } from '../engine/gameProps';
import type { Scope } from '../engine/scope';
import { RALLY_LEVELS, STARTING_LIVES } from '../games/rally/levels';
import { applyHit, createRally, isCleared, isOver, tick, windowLeft, type RallyOptions } from '../games/rally/logic';
import { hudBar, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

const hearts = (n: number) => (n > 0 ? '♥'.repeat(n) : '—');

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const opts: RallyOptions = { ...RALLY_LEVELS[ctx.index].settings, debounceMs: HIT_DEBOUNCE_MS };
  const lives = typeof ctx.carry === 'number' ? ctx.carry : STARTING_LIVES;
  let state = createRally(opts, performance.now(), lives, Math.random);
  let finished = false;

  const target = scope.add(createFloorTarget(opts.zoneRadius, 0x06d6a0));
  // Inner ring shrinks to show how long until the next ball.
  const timer = scope.add(createFloorTarget(opts.zoneRadius * 0.98, 0xffffff));
  (timer.userData.disc as { visible: boolean }).visible = false;
  const placeTarget = () => {
    target.position.set(state.zone.x, 0, state.zone.z);
    timer.position.set(state.zone.x, 0.003, state.zone.z);
  };
  placeTarget();

  const [scoreEl, livesEl, returnsEl, nextEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Lives', value: hearts(lives), className: 'red' },
    { label: 'Returns', value: `0/${opts.returnsNeeded}`, className: 'neon' },
    { label: 'Next ball', value: '' },
  ]);
  const refresh = () => {
    setValue(scoreEl, String(ctx.totalBefore + state.score));
    setValue(livesEl, hearts(state.lives));
    setValue(returnsEl, `${state.returns}/${opts.returnsNeeded}`);
    ctx.setProgress(state.returns / opts.returnsNeeded);
  };

  app.debugAim = () => (state.resolved ? null : { x: state.zone.x, y: 0, z: state.zone.z });

  const finishIfOver = () => {
    if (finished || !isOver(state, opts)) return;
    finished = true;
    scope.after(800, () => resolve({ score: state.score, passed: isCleared(state, opts), carry: state.lives }));
  };
  let resolve: (o: LevelOutcome) => void = () => undefined;

  return new Promise((done) => {
    resolve = done;
    scope.onUpdate((_, now) => {
      if (finished) return;
      const { state: next, newFeed, late } = tick(state, opts, now, Math.random);
      if (next !== state) {
        state = next;
        if (late) {
          music.sfx('bad');
          floatText(scope, { x: 0, y: 1.6, z: -2.5 }, 'TOO LATE! −1 LIFE', 'red', 80);
          app.stage.shake(0.12, 300);
        }
        if (newFeed) {
          placeTarget();
          groundRipple(scope, { x: state.zone.x, y: 0, z: state.zone.z }, 0x06d6a0);
        }
        refresh();
        finishIfOver();
      }
      const left = windowLeft(state, opts, now);
      timer.scale.setScalar(Math.max(0.02, left));
      target.visible = !state.resolved;
      timer.visible = !state.resolved;
      setValue(nextEl, `${((left * opts.feedEveryMs) / 1000).toFixed(1)}s`);
    });

    scope.onHit(async (hit) => {
      if (finished) return;
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, performance.now());
      if (!result) return;
      state = next;
      refresh();
      const at = result.landing ? { x: result.landing.x, y: 0.04, z: result.landing.z } : pointAlong(ray, 15);
      await ballFlight(scope, at, 420);
      if (result.kind === 'good') {
        void ballBounce(scope, at);
        groundRipple(scope, at, 0x06d6a0);
        burst(scope, at, 0x06d6a0, 0.5);
        music.sfx('hit');
        floatText(scope, { ...at, y: 0.8 }, `+${result.points}`, 'neon', 80);
        app.world.cheer(0.3 + Math.min(0.7, state.streak / 10));
      } else {
        if (result.landing) groundRipple(scope, at, 0xff5a5f);
        music.sfx('bad');
        floatText(scope, { ...at, y: Math.max(at.y, 0.6) }, 'MISSED THE ZONE −1 LIFE', 'red', 64);
      }
      finishIfOver();
    });
  });
}

export function rallyScreen(app: App, scope: Scope): void {
  app.world.show('beach');
  void runLevels(app, scope, { gameId: 'rally', levels: RALLY_LEVELS.map((l) => l.info), play: (ctx) => playLevel(app, ctx) });
}
