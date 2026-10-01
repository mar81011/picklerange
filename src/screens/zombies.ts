import { music } from '../audio/music';
import type { App } from '../app';
import { HIT_DEBOUNCE_MS } from '../config';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Character, loadModel } from '../engine/character';
import { easeInCubic, type Scope } from '../engine/scope';
import { STARTING_LIVES, ZOMBIE_LEVELS } from '../games/zombies/levels';
import { ZOMBIE_HEIGHT, applyHit, createWave, isWaveOver, sizeOf, tick, totalToSpawn, zombieZ, type WaveOptions, type ZombieKind } from '../games/zombies/logic';
import { hudBar, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

const hearts = (n: number) => (n > 0 ? '♥'.repeat(n) : '—');

/** CC0 zombie by Quaternius (see public/models/CREDITS.md). */
export const ZOMBIE_MODEL = '/models/zombie.glb';
/** Color tint per kind: walkers keep the model's colors. */
const TINTS: Record<ZombieKind, number> = { walker: 0xffffff, brute: 0xff8f8f, boss: 0xb98cff };
/** The walk clip covers about this many meters per second at normal speed. */
const WALK_CLIP_SPEED = 0.6;

/** Red flash over the whole screen when a zombie gets through. */
function damageFlash(scope: Scope): void {
  const el = scope.el('div', 'layer damage-flash');
  scope.after(500, () => el.remove());
}

function playLevel(app: App, ctx: LevelContext, zombieModel: GLTF): Promise<LevelOutcome> {
  const { scope } = ctx;
  const level = ZOMBIE_LEVELS[ctx.index];
  const opts: WaveOptions = { ...level.wave, debounceMs: HIT_DEBOUNCE_MS };
  const lives = typeof ctx.carry === 'number' ? ctx.carry : STARTING_LIVES;
  let state = createWave(performance.now(), lives);
  const total = totalToSpawn(opts);
  const actors = new Map<number, Character>();
  /** Zombies out of play but still animating (dying or attacking). */
  const dying = new Set<Character>();
  let finished = false;

  const [scoreEl, livesEl, leftEl, killsEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Lives', value: hearts(lives), className: 'red' },
    { label: 'Zombies left', value: String(total) },
    { label: 'Kills', value: '0', className: 'neon' },
  ]);
  const refresh = () => {
    setValue(scoreEl, String(ctx.totalBefore + state.score));
    setValue(livesEl, hearts(state.lives));
    setValue(leftEl, String(total - state.spawned + state.zombies.length));
    setValue(killsEl, String(state.kills));
    ctx.setProgress(state.kills / total);
  };

  const removeActor = async (id: number, how: 'die' | 'attack') => {
    const actor = actors.get(id);
    if (!actor) return;
    actors.delete(id);
    dying.add(actor);
    await actor.play(how === 'die' ? 'Death' : 'Punch', { loop: false, timeScale: how === 'die' ? 1.4 : 1.6 });
    // Sink into the ground, then clean up.
    const y0 = actor.root.position.y;
    await scope.animate(400, (t) => (actor.root.position.y = y0 - t * 0.6), easeInCubic);
    dying.delete(actor);
    scope.remove(actor.root);
    actor.dispose();
  };

  app.debugAim = () => {
    const now = performance.now();
    const nearest = [...state.zombies].sort((a, b) => zombieZ(b, now) - zombieZ(a, now))[0];
    return nearest ? { x: nearest.x, y: 1.0 * sizeOf(nearest.kind), z: zombieZ(nearest, now) } : null;
  };

  // Animate every zombie still on screen, including ones playing their death.
  scope.onUpdate((dt) => {
    for (const actor of actors.values()) actor.update(dt);
    for (const actor of dying) actor.update(dt);
  });

  return new Promise((resolve) => {
    scope.onUpdate((_, now) => {
      if (finished) return;
      const { state: next, arrived, spawned } = tick(state, opts, now, Math.random);
      state = next;
      for (const z of spawned) {
        const actor = new Character(zombieModel, { heightM: ZOMBIE_HEIGHT * sizeOf(z.kind), tint: TINTS[z.kind] });
        actor.root.position.set(z.x, 0, zombieZ(z, now));
        scope.add(actor.root);
        // Faster zombies play the walk faster so their feet match the ground.
        void actor.play('Walk', { timeScale: z.speed / WALK_CLIP_SPEED, fade: 0 });
        actors.set(z.id, actor);
        if (z.kind === 'boss') floatText(scope, { x: 0, y: 3.2, z: zombieZ(z, now) }, 'THE BOSS!', 'red', 110);
      }
      for (const z of arrived) {
        void removeActor(z.id, 'attack');
        damageFlash(scope);
        app.stage.shake(0.2, 400);
        music.sfx('bad');
        floatText(scope, { x: z.x, y: 1.6, z: -0.8 }, '−1 LIFE', 'red', 90);
      }
      for (const z of state.zombies) actors.get(z.id)?.root.position.setZ(zombieZ(z, now));
      if (spawned.length || arrived.length) refresh();

      if (isWaveOver(state, opts)) {
        finished = true;
        scope.after(700, () => resolve({ score: state.score, passed: state.lives > 0, carry: state.lives }));
      }
    });

    scope.onHit(async (hit) => {
      if (finished) return;
      const now = performance.now();
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, now);
      if (!result) return;
      state = next;
      refresh();

      if (result.kind === 'miss') {
        const at = pointAlong(ray);
        await ballFlight(scope, at, 200);
        music.sfx('miss');
        burst(scope, at, 0xffffff, 0.1);
        return;
      }
      await ballFlight(scope, result.at, 200);
      const actor = actors.get(result.zombie.id);
      if (result.kind === 'hurt') {
        burst(scope, result.at, 0x7cff6b, 0.4);
        music.sfx('hit');
        floatText(scope, result.at, `${result.zombie.hp} MORE!`, 'neon', 64);
        if (actor) {
          actor.flash(true);
          scope.after(150, () => actor.flash(false));
          // Flinch, then keep walking.
          void actor.play('HitReact', { loop: false, timeScale: 1.5, fade: 0.05 }).then(() => {
            if (actors.has(result.zombie.id)) void actor.play('Walk', { timeScale: result.zombie.speed / WALK_CLIP_SPEED });
          });
        }
        return;
      }
      burst(scope, result.at, 0x7cff6b, result.zombie.kind === 'boss' ? 1 : 0.6);
      if (result.zombie.kind === 'boss') {
        shockwave(scope, result.at, 0x7cff6b, 3);
        app.stage.shake(0.2, 400);
      }
      music.sfx(result.zombie.kind === 'boss' ? 'big' : 'hit');
      floatText(scope, { ...result.at, y: Math.min(result.at.y + 0.4, ZOMBIE_HEIGHT) }, `+${result.points}`, 'neon', 80);
      app.world.cheer(result.zombie.kind === 'boss' ? 1 : 0.4);
      void removeActor(result.zombie.id, 'die');
    });
  });
}

export function zombiesScreen(app: App, scope: Scope): void {
  app.world.show('graveyard');
  // The model is preloaded at startup, so this normally resolves at once.
  void loadModel(ZOMBIE_MODEL).then((model) => {
    if (!scope.alive) return;
    void runLevels(app, scope, { gameId: 'zombies', levels: ZOMBIE_LEVELS.map((l) => l.info), play: (ctx) => playLevel(app, ctx, model) });
  });
}
