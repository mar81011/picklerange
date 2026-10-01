import { music } from '../audio/music';
import * as THREE from 'three';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { BASELINE_Z, COURT, KITCHEN_Z } from '../core/court';
import { ballBounce, ballFlight, burst, floatText, groundRipple } from '../engine/effects';
import { Opponent } from '../engine/opponent';
import { createReachRing } from '../engine/props';
import type { Scope } from '../engine/scope';
import { CAMERA_POSITION } from '../engine/stage';
import { NEON_HEX, RED_HEX } from '../engine/textures';
import { OPEN_COURT_LEVELS } from '../games/opencourt/levels';
import { applyHit, createOpenCourt, isRoundOver, type OpenCourtOptions, type Opponent as OpponentSpot } from '../games/opencourt/openCourtLogic';
import { hudBar, setPips, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = OPEN_COURT_LEVELS[ctx.index];
  const opts: OpenCourtOptions = { shots: level.shots, reach: level.reach, debounceMs: HIT_DEBOUNCE_MS };
  const target = level.info.target!;
  let state = createOpenCourt(opts);
  /** Increments per shot so a newer shot can take over the opponent mid-animation. */
  let shotId = 0;
  let moveId = 0;

  // The character is preloaded at startup, so this is normally instant; the
  // holder can be positioned before it arrives.
  const holder = scope.add(new THREE.Group());
  if (level.boss) holder.scale.setScalar(1.25);
  let opponent: Opponent | null = null;
  void Opponent.create().then((o) => {
    if (!scope.alive) return;
    opponent = o;
    holder.add(o.root);
  });
  scope.onUpdate((dt) => opponent?.update(dt));

  const reach = scope.add(createReachRing(opts.reach));
  const placeOpponent = (o: { x: number; z: number }) => {
    holder.position.set(o.x, 0, o.z);
    reach.position.set(o.x, 0.015, o.z);
  };
  placeOpponent(state.opponent);

  /** Runs from wherever the opponent is now; a later call takes over from an earlier one. */
  const moveOpponent = async (to: { x: number; z: number }, ms: number) => {
    const id = ++moveId;
    const from = { x: holder.position.x, z: holder.position.z };
    if (Math.hypot(to.x - from.x, to.z - from.z) < 0.05) return;
    opponent?.play('run');
    // Face the direction of travel (the model faces the player at angle 0).
    opponent?.face(Math.atan2(to.x - from.x, to.z - from.z));
    await scope.animate(ms, (t) => id === moveId && placeOpponent({ x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }));
    if (id !== moveId) return;
    opponent?.face(0);
    opponent?.play('idle');
  };

  /** Aim assist for automated playthroughs: the open corner. */
  app.debugAim = () => ({ x: state.opponent.x > 0 ? -2.5 : 2.5, y: 0, z: state.opponent.z < -4.5 ? -1.2 : -5.8 });

  const [scoreEl, winnersEl, ballsEl, streakEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Winners', value: '0' },
    { label: 'Balls left', value: null },
    { label: 'Streak', value: '0', className: 'neon' },
  ]);
  setPips(ballsEl, opts.shots, opts.shots);

  // Corner cones help players read depth.
  for (const [x, z] of [[-COURT.halfWidth, KITCHEN_Z], [COURT.halfWidth, KITCHEN_Z], [-COURT.halfWidth, BASELINE_Z], [COURT.halfWidth, BASELINE_Z]]) {
    const cone = scope.add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), new THREE.MeshStandardMaterial({ color: 0xff7b00 })));
    cone.position.set(x, 0.11, z);
    cone.castShadow = true;
  }

  return new Promise((resolve) => {
    scope.onHit(async (hit) => {
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const before: OpponentSpot = state.opponent;
      const { state: next, result } = applyHit(state, opts, ray, performance.now(), Math.random);
      if (!result) return;
      state = next;
      const id = ++shotId;
      setValue(scoreEl, String(ctx.totalBefore + state.score), result.points > 0);
      setValue(winnersEl, String(state.winners));
      setPips(ballsEl, state.shotsLeft, opts.shots);
      setValue(streakEl, String(state.streak), state.streak > 1);
      ctx.setProgress(state.score / target);

      if (result.kind === 'out' || !result.landing) {
        const at = result.landing ? { x: result.landing.x, y: 0.04, z: result.landing.z } : pointAlong(ray, 20);
        await ballFlight(scope, at, 450);
        music.sfx('miss');
        floatText(scope, { x: at.x, y: Math.max(at.y, 0.6), z: at.z }, result.outReason === 'wide' ? 'OUT — WIDE' : 'OUT — LONG', 'muted', 76);
      } else {
        const landing = { x: result.landing.x, y: 0.04, z: result.landing.z };
        await ballFlight(scope, landing, 450);
        groundRipple(scope, landing, result.kind === 'winner' ? NEON_HEX : 0xffffff);

        // The opponent lunges toward the ball, stopping at the edge of their reach.
        const dx = landing.x - before.x;
        const dz = landing.z - before.z;
        const dist = Math.hypot(dx, dz) || 1;
        const lunge = Math.min(dist - 0.35, opts.reach * 0.75);
        void moveOpponent({ x: before.x + (dx / dist) * lunge, z: before.z + (dz / dist) * lunge }, 220).then(() => {
          opponent?.play(result.kind === 'returned' ? 'swing' : 'beaten');
        });

        if (result.kind === 'returned') {
          music.sfx('bad');
          floatText(scope, { x: landing.x, y: 1.4, z: landing.z }, 'RETURNED!', 'red', 80);
          burst(scope, { x: landing.x, y: 0.9, z: landing.z }, RED_HEX, 0.3);
          // Ball comes back at the player.
          await scope.wait(150);
          const back = { x: CAMERA_POSITION.x + (Math.random() - 0.5) * 2, y: 1.5, z: 1.5 };
          await ballFlight(scope, back, 380);
        } else {
          void ballBounce(scope, landing);
          burst(scope, landing, NEON_HEX, 0.4 + result.points / 60);
          const label = result.dropShot ? `DROP SHOT! +${result.points}` : `WINNER! +${result.points}`;
          music.sfx(result.points >= 30 ? 'big' : 'hit');
          floatText(scope, { x: landing.x, y: 1.0, z: landing.z }, label, 'neon', result.points >= 30 ? 96 : 84);
          app.world.cheer(result.points / 40);
          if (result.points >= 30) app.stage.shake(0.1, 300);
        }
      }

      await scope.wait(300);
      // A newer shot already took over; it will finish the level or move the opponent.
      if (id !== shotId) return;
      if (isRoundOver(state)) {
        const passed = state.score >= target;
        // The opponent celebrates if they held you off.
        opponent?.play(passed ? 'beaten' : 'celebrate');
        await scope.wait(900);
        resolve({ score: state.score, passed });
        return;
      }
      await moveOpponent(state.opponent, level.moveMs);
    });
  });
}

export function openCourtScreen(app: App, scope: Scope): void {
  app.world.show('park');
  void runLevels(app, scope, {
    gameId: 'opencourt',
    levels: OPEN_COURT_LEVELS.map((l) => l.info),
    play: (ctx) => playLevel(app, ctx),
  });
}
