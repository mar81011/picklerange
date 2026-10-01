import { music } from '../audio/music';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { BASELINE_Z, COURT, KITCHEN_Z } from '../core/court';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { createTarget, placeTargetProp } from '../engine/props';
import { easeInCubic, easeOutBack, type Scope } from '../engine/scope';
import { NEON_HEX, RED_HEX } from '../engine/textures';
import { accuracy, applyHit, createRound, isRoundOver, targetPositionAt, type BullseyeOptions } from '../games/bullseye/bullseyeLogic';
import { BULLSEYE_LEVELS, type BullseyeLevel } from '../games/bullseye/levels';
import { gameInfo } from '../games';
import { hudBar, setPips, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

function optionsFor(level: BullseyeLevel): BullseyeOptions {
  return {
    area: { minX: -COURT.halfWidth + 0.2, maxX: COURT.halfWidth - 0.2, minZ: BASELINE_Z + 1.2, maxZ: KITCHEN_Z - 0.3 },
    centerHeight: 0.85,
    shots: level.shots,
    rings: level.rings,
    motion: level.motion,
    debounceMs: HIT_DEBOUNCE_MS,
  };
}

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = BULLSEYE_LEVELS[ctx.index];
  const opts = optionsFor(level);
  let state = createRound(opts, Math.random);

  const target = scope.add(createTarget(opts.rings));
  let shown = state.target;
  const showTarget = async () => {
    shown = state.target;
    target.scale.setScalar(0.01);
    await scope.animate(380, (t) => target.scale.setScalar(Math.max(0.01, t)), easeOutBack);
  };
  void showTarget();
  // Moving targets: draw them where the rules say they are, on the same clock.
  scope.onUpdate((_, now) => {
    const p = targetPositionAt(shown, now);
    placeTargetProp(target, p.x, p.y, p.z);
  });
  app.debugAim = () => targetPositionAt(state.target, performance.now());

  const [scoreEl, , ballsEl, accuracyEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Game', value: gameInfo('bullseye').title, className: 'neon small' },
    { label: 'Balls left', value: null },
    { label: 'Accuracy', value: '0%' },
  ]);
  setPips(ballsEl, opts.shots, opts.shots);

  return new Promise((resolve) => {
    scope.onHit(async (hit) => {
      const now = performance.now();
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, now, Math.random);
      if (!result) return;
      state = next;
      setValue(scoreEl, String(ctx.totalBefore + state.score), result.points > 0);
      setPips(ballsEl, state.shotsLeft, opts.shots);
      setValue(accuracyEl, `${Math.round(accuracy(state) * 100)}%`);
      ctx.setProgress(state.score / level.info.target!);

      const at = result.at ?? pointAlong(ray);
      await ballFlight(scope, at, 220);

      if (result.outcome === 'ring') {
        const bullseye = result.ringIndex === 0;
        burst(scope, at, bullseye ? NEON_HEX : 0xffffff, bullseye ? 1 : 0.5);
        shockwave(scope, at, bullseye ? NEON_HEX : RED_HEX, bullseye ? 2 : 1);
        music.sfx(bullseye ? 'big' : 'hit');
        floatText(scope, at, bullseye ? 'BULLSEYE!' : `+${result.points}`, 'neon', bullseye ? 110 : 84);
        app.world.cheer(bullseye ? 1 : 0.25 + result.points / 100);
        if (bullseye) app.stage.shake(0.15, 350);
        await scope.animate(300, (t) => (target.rotation.x = -Math.sin(t * Math.PI) * 0.5));
      } else {
        burst(scope, at, 0xffffff, 0.15);
        music.sfx('miss');
        floatText(scope, at, 'MISS', 'muted', 72);
      }

      if (isRoundOver(state)) {
        await scope.wait(500);
        resolve({ score: state.score, passed: state.score >= level.info.target! });
        return;
      }
      // Sink, then pop up at the next spot.
      await scope.animate(160, (t) => target.scale.setScalar(Math.max(0.01, 1 - t)), easeInCubic);
      await showTarget();
    });
  });
}

export function bullseyeScreen(app: App, scope: Scope): void {
  app.world.show('stadium');
  void runLevels(app, scope, {
    gameId: 'bullseye',
    levels: BULLSEYE_LEVELS.map((l) => l.info),
    play: (ctx) => playLevel(app, ctx),
  });
}
