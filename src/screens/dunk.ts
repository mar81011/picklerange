import * as THREE from 'three';
import { music } from '../audio/music';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { CLOWN_TOP, Clown } from '../engine/clown';
import { DunkTank, SEAT, TANK, WATER_Y, createDunkTarget } from '../engine/dunkTank';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { easeInCubic, easeOutCubic, linear, type Scope } from '../engine/scope';
import { DUNK_LEVELS, RIM_WIDTH } from '../games/dunk/levels';
import { applyHit, createRound, isOver, isPassed, targetAt, type DunkOptions } from '../games/dunk/logic';
import { gameInfo } from '../games';
import { hudBar, setPips, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

/** Where the target hangs when it's not sliding. */
const TARGET_HOME = { x: 2.0, y: 1.1, z: -2.2 };
/** Height of the clown's root (his hips) while he sits on the plank. */
const SEATED_Y = SEAT.y + 0.05;
/** Root heights: all the way under, and bobbing back up with his head out of the water. */
const UNDER_Y = WATER_Y - CLOWN_TOP - 0.08;
const POPPED_Y = WATER_Y - 0.66;
/** How long the dunk, swim and climb back up take, in ms. */
const RESET_MS = 2900;

const TAUNTS = ['NYAH NYAH!', 'CAN’T HIT ME!', 'TOO SLOW!', 'HONK HONK!', 'BUTTERFINGERS!', 'I’M BONE DRY!'];
const MISS_TAUNTS = ['MISSED ME!', 'HA HA HA!', 'NOT EVEN CLOSE!'];

function optionsFor(index: number): DunkOptions {
  const s = DUNK_LEVELS[index].settings;
  return {
    target: TARGET_HOME,
    radius: s.radius,
    rim: s.radius + RIM_WIDTH,
    motion: s.motion,
    clown: { center: { x: SEAT.x, y: SEAT.y + 0.6, z: SEAT.z }, radius: 0.5 },
    balls: s.balls,
    dunks: s.dunks,
    resetMs: RESET_MS,
    debounceMs: HIT_DEBOUNCE_MS,
  };
}

/** Bubbles rising from the clown underwater. */
function bubbles(scope: Scope, from: THREE.Vector3): void {
  const material = new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: 0.8, roughness: 0.1 });
  for (let i = 0; i < 10; i++) {
    const b = scope.add(new THREE.Mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 8, 6), i ? material : material));
    const start = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, Math.random() * 0.3, (Math.random() - 0.5) * 0.3));
    const delay = i * 90;
    b.visible = false;
    scope.after(delay, () => {
      b.visible = true;
      void scope
        .animate(900, (t) => {
          b.position.set(start.x + Math.sin(t * 9 + i) * 0.04, start.y + t * (WATER_Y - start.y), start.z);
        }, linear)
        .then(() => scope.remove(b));
    });
  }
}

/** Water flying up out of the tank. */
function splash(scope: Scope, tank: DunkTank, at: THREE.Vector3): void {
  tank.ripple(at.x, at.z, 1.2);
  const surface = { x: at.x, y: WATER_Y, z: at.z };
  burst(scope, surface, 0x8fdcff, 1);
  burst(scope, { ...surface, y: WATER_Y + 0.1 }, 0xffffff, 0.8);
  shockwave(scope, { ...surface, z: TANK.z + TANK.depth / 2 }, 0x8fdcff, 2.5);
  // A few big drops arcing out over the sides.
  const drop = new THREE.MeshStandardMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.85, roughness: 0.05 });
  for (let i = 0; i < 14; i++) {
    const d = scope.add(new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 10, 8), drop));
    const v = new THREE.Vector3((Math.random() - 0.5) * 4, 3.5 + Math.random() * 2.5, (Math.random() - 0.2) * 2.5);
    const p = new THREE.Vector3(surface.x, surface.y, surface.z);
    let last = performance.now();
    void scope
      .animate(1100, () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        v.y -= 9.8 * dt;
        p.addScaledVector(v, dt);
        d.position.copy(p);
        d.visible = p.y > 0;
      }, linear)
      .then(() => scope.remove(d));
  }
}

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const opts = optionsFor(ctx.index);
  let state = createRound(opts);

  const tank = new DunkTank();
  scope.add(tank.root);
  const clown = new Clown();
  clown.root.position.set(SEAT.x, SEATED_Y, SEAT.z);
  // Turned a little toward the target (and the player), so he reads as sitting from the high camera.
  clown.root.rotation.y = 0.45;
  scope.add(clown.root);
  scope.onDispose(() => clown.dispose());
  const { root: targetRoot, target } = createDunkTarget(opts.radius, opts.rim, TARGET_HOME, opts.motion.ampX);
  scope.add(targetRoot);

  // Clown animation: 'sit' (taunting now and then), or busy being dunked.
  let busy = false;
  let tauntUntil = 0;
  let nextTaunt = performance.now() + 2500;
  const taunt = (text: string, ms = 1500) => {
    tauntUntil = performance.now() + ms;
    floatText(scope, { x: SEAT.x, y: SEAT.y + 1.05, z: SEAT.z }, text, 'neon', 60);
  };

  let flip = 0;
  scope.onUpdate((dt, now) => {
    tank.update(dt);
    clown.update(dt);
    if (!busy) clown.pose = now < tauntUntil ? 'taunt' : 'sit';
    if (!busy && now > nextTaunt && !isOver(state, opts)) {
      taunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
      nextTaunt = now + 4500 + Math.random() * 3000;
    }
    const p = targetAt(opts, now);
    target.position.set(p.x, p.y, p.z);
    target.rotation.x = -Math.sin(flip * Math.PI) * 0.6;
  });
  app.debugAim = () => targetAt(opts, performance.now());

  const [scoreEl, , ballsEl, dunksEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Game', value: gameInfo('dunk').title, className: 'neon small' },
    { label: 'Balls left', value: null },
    { label: 'Dunks', value: `0/${opts.dunks}`, className: 'neon' },
  ]);
  setPips(ballsEl, opts.balls, opts.balls);

  /** Plank drops, clown falls in, splashes, swims, then climbs back up. */
  const dunk = async () => {
    busy = true;
    clown.pose = 'fall';
    const seatY = SEATED_Y;
    void scope.animate(160, (t) => tank.setPlank(-1.35 * t), easeInCubic);
    let splashed = false;
    await scope.animate(520, (t) => {
      clown.root.position.y = seatY + (UNDER_Y - seatY) * t;
      clown.root.rotation.z = t * 0.25;
      // Splash as his hips reach the water.
      if (!splashed && clown.root.position.y < WATER_Y) {
        splashed = true;
        splash(scope, tank, clown.root.position);
        music.sfx('big');
        app.stage.shake(0.12, 300);
        app.world.cheer(1);
      }
    }, easeInCubic);
    clown.pose = 'swim';
    bubbles(scope, clown.root.position.clone().setY(WATER_Y - 0.5));
    await scope.wait(350);
    // Pops back up, head out of the water, sputtering.
    await scope.animate(380, (t) => (clown.root.position.y = UNDER_Y + (POPPED_Y - UNDER_Y) * t), easeOutCubic);
    tank.ripple(clown.root.position.x, clown.root.position.z, 0.7);
    floatText(scope, { x: SEAT.x, y: WATER_Y + 0.9, z: SEAT.z }, 'BRRRR!', 'muted', 60);
    await scope.animate(500, (t) => (clown.root.position.y = POPPED_Y + Math.sin(t * Math.PI * 2) * 0.04));
    // Plank back up, then he climbs out and sits back down, dripping.
    void scope.animate(300, (t) => tank.setPlank(-1.35 * (1 - t)));
    await scope.animate(900, (t) => {
      clown.root.position.y = POPPED_Y + (seatY - POPPED_Y) * t;
      clown.root.rotation.z = 0.25 * (1 - t);
    }, easeOutCubic);
    tank.ripple(clown.root.position.x, clown.root.position.z, 0.5);
    clown.pose = 'sit';
    busy = false;
    if (!isOver(state, opts)) taunt('THAT’S COLD!', 1400);
    nextTaunt = performance.now() + 4000;
  };

  return new Promise((resolve) => {
    let ending = false;
    scope.onHit(async (hit) => {
      if (ending) return;
      const now = performance.now();
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, now);
      if (!result) return;
      state = next;
      if (result.kind === 'wait') {
        floatText(scope, { x: SEAT.x, y: WATER_Y + 0.4, z: TANK.z + 0.9 }, 'WAIT FOR IT!', 'muted', 56);
        return;
      }
      setValue(scoreEl, String(ctx.totalBefore + state.score), result.points > 0);
      setPips(ballsEl, state.ballsLeft, opts.balls);
      setValue(dunksEl, `${state.dunks}/${opts.dunks}`, result.kind === 'dunk');
      ctx.setProgress(state.dunks / opts.dunks);
      const over = isOver(state, opts);
      if (over) ending = true;

      const at = result.at ?? pointAlong(ray);
      await ballFlight(scope, at, 220);

      let dunking: Promise<void> | null = null;
      if (result.kind === 'dunk') {
        burst(scope, at, 0xff3a4a, 0.9);
        floatText(scope, at, 'DUNK! +100', 'neon', 96);
        music.sfx('hit');
        void scope.animate(450, (t) => (flip = t), linear).then(() => (flip = 0));
        dunking = dunk();
      } else if (result.kind === 'rim') {
        burst(scope, at, 0xffffff, 0.4);
        floatText(scope, at, `SO CLOSE! +${result.points}`, 'muted', 72);
        music.sfx('miss');
        void scope.animate(300, (t) => (flip = t * 0.3), linear).then(() => (flip = 0));
        taunt(MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)], 1200);
      } else if (result.kind === 'clown') {
        burst(scope, at, 0xffd23f, 0.4);
        music.sfx('bad');
        taunt('OUCH! HIT THE RED!', 1500);
      } else {
        burst(scope, at, 0xffffff, 0.15);
        music.sfx('miss');
        floatText(scope, at, 'MISS', 'muted', 64);
        taunt(MISS_TAUNTS[Math.floor(Math.random() * MISS_TAUNTS.length)], 1200);
      }

      if (over) {
        if (dunking) await dunking;
        if (state.bonus > 0) {
          floatText(scope, { x: 0, y: 2.2, z: -3 }, `BALLS LEFT +${state.bonus}`, 'neon', 84);
          setValue(scoreEl, String(ctx.totalBefore + state.score), true);
        }
        await scope.wait(900);
        resolve({ score: state.score, passed: isPassed(state, opts) });
      }
    });
  });
}

export function dunkScreen(app: App, scope: Scope): void {
  app.world.show('carnival');
  void runLevels(app, scope, { gameId: 'dunk', levels: DUNK_LEVELS.map((l) => l.info), play: (ctx) => playLevel(app, ctx) });
}
