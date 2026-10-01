import { music } from '../audio/music';
import * as THREE from 'three';
import type { App } from '../app';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { brickColor, createBrick, setBrickHits } from '../engine/props';
import { disposeObject, linear, type Scope } from '../engine/scope';
import { DEFAULT_BRICKS, applyHit, createWall, isOver, wallOffsetAt, type Brick, type BrickOptions } from '../games/bricks/brickLogic';
import { BRICK_LEVELS } from '../games/bricks/levels';
import { banner, hudBar, setPips, setValue } from '../ui/hud';
import { pointAlong } from './common';
import { runLevels, type LevelContext, type LevelOutcome } from './levelRunner';

const BRICK_DEPTH = 0.22;

function playLevel(app: App, ctx: LevelContext): Promise<LevelOutcome> {
  const { scope } = ctx;
  const opts: BrickOptions = { ...DEFAULT_BRICKS, ...BRICK_LEVELS[ctx.index].settings };
  const bonusBalls = typeof ctx.carry === 'number' ? ctx.carry : 0;
  let state = createWall(opts, Math.random, bonusBalls);
  const totalBalls = state.ballsLeft;

  // All bricks live in one group so the whole wall can sway together.
  const wall = scope.add(new THREE.Group());
  const meshes = new Map<number, THREE.Mesh>();
  state.bricks.forEach((b, i) => {
    const mesh = createBrick(opts.brickWidth, opts.brickHeight, b.kind, b.row);
    mesh.position.set(b.x, b.y, opts.wallZ - BRICK_DEPTH / 2);
    wall.add(mesh);
    meshes.set(b.id, mesh);
    // Build the wall from the bottom up.
    mesh.scale.setScalar(0.01);
    scope.after(i * 18, () => void scope.animate(260, (t) => mesh.scale.setScalar(Math.max(0.01, t))));
  });

  scope.onUpdate((_, now) => {
    wall.position.x = wallOffsetAt(opts, now);
    // TNT bricks pulse so players spot them.
    const glow = 0.25 + 0.25 * Math.sin(now / 180);
    for (const b of state.bricks) {
      if (b.kind !== 'bomb') continue;
      const material = meshes.get(b.id)?.material;
      const list = (Array.isArray(material) ? material : material ? [material] : []) as THREE.MeshStandardMaterial[];
      for (const m of list) m.emissiveIntensity = glow;
    }
  });

  /** World position of a brick right now, including the sway. */
  const brickAt = (b: Brick) => ({ x: b.x + wall.position.x, y: b.y, z: opts.wallZ });
  app.debugAim = () => {
    const b = state.bricks[Math.floor(state.bricks.length / 2)];
    return b ? brickAt(b) : null;
  };

  const [scoreEl, bricksEl, ballsEl, comboEl] = hudBar(scope, [
    { label: 'Total', value: String(ctx.totalBefore) },
    { label: 'Bricks left', value: `${state.bricks.length}` },
    { label: 'Balls left', value: null },
    { label: 'Last smash', value: '—', className: 'neon' },
  ]);
  setPips(ballsEl, state.ballsLeft, totalBalls);
  if (bonusBalls > 0) void banner(scope, `+${bonusBalls} BONUS BALL${bonusBalls > 1 ? 'S' : ''}`, 'neon', 230, 80, 900);

  /** Sends a brick flying off the wall, spinning, then removes it. */
  const smash = (brick: Brick, from: { x: number; y: number }, power: number) => {
    const mesh = meshes.get(brick.id);
    if (!mesh) return;
    meshes.delete(brick.id);
    const away = new THREE.Vector3(brick.x - from.x, brick.y - from.y + 0.6, 0).normalize();
    const velocity = new THREE.Vector3(away.x * (1.5 + power), 2 + Math.random() * 2 * power, 1.2 + Math.random() * 2.5 * power);
    const spin = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    const start = mesh.position.clone();
    void scope
      .animate(
        900,
        (t) => {
          const s = t * 0.9;
          mesh.position.set(start.x + velocity.x * s, start.y + velocity.y * s - 4.9 * s * s, start.z + velocity.z * s);
          mesh.rotation.set(spin.x * s, spin.y * s, spin.z * s);
          if (t > 0.6) mesh.scale.setScalar(Math.max(0.01, 1 - (t - 0.6) / 0.4));
        },
        linear,
      )
      .then(() => {
        wall.remove(mesh);
        disposeObject(mesh);
      });
  };

  return new Promise((resolve) => {
    scope.onHit(async (hit) => {
      const ray = app.stage.rayFromScreen(hit.x, hit.y);
      const { state: next, result } = applyHit(state, opts, ray, performance.now());
      if (!result) return;
      state = next;
      setValue(scoreEl, String(ctx.totalBefore + state.score), result.points > 0);
      setValue(bricksEl, String(state.bricks.length));
      setPips(ballsEl, state.ballsLeft, totalBalls);
      setValue(comboEl, result.destroyed.length ? `${result.destroyed.length} brick${result.destroyed.length > 1 ? 's' : ''}` : '—', result.destroyed.length >= 3);
      ctx.setProgress(1 - state.bricks.length / state.total);

      const at = result.at ?? pointAlong(ray);
      // Impact point in the wall's own (unswayed) coordinates, for aiming the debris.
      const localAt = { x: at.x - wall.position.x, y: at.y };
      await ballFlight(scope, at, 220);

      if (result.destroyed.length === 0 && result.cracked.length === 0) {
        burst(scope, at, 0xffffff, 0.12);
        music.sfx('miss');
        floatText(scope, at, 'MISS', 'muted', 64);
      }
      for (const b of result.cracked) {
        const mesh = meshes.get(b.id);
        if (!mesh) continue;
        setBrickHits(mesh, b.kind, state.bricks.find((x) => x.id === b.id)?.hp ?? 1);
        const x0 = mesh.position.x;
        void scope.animate(240, (t) => (mesh.position.x = x0 + Math.sin(t * Math.PI * 6) * 0.03 * (1 - t)));
        burst(scope, brickAt(b), 0xdfe6f5, 0.2);
      }

      const power = result.exploded.length ? 2.2 : 1;
      for (const b of result.destroyed) {
        smash(b, localAt, power);
        burst(scope, brickAt(b), b.kind === 'bomb' ? 0xff6a00 : brickColor(b.row), 0.25);
      }
      for (const bomb of result.exploded) {
        burst(scope, brickAt(bomb), 0xff6a00, 1);
        shockwave(scope, brickAt(bomb), 0xff3b3b, 2.5);
      }
      if (result.exploded.length) {
        app.stage.shake(0.2, 450);
        music.sfx('big');
        floatText(scope, at, 'BOOM!', 'red', 120);
      }
      if (result.points > 0) {
        if (!result.exploded.length) music.sfx(result.destroyed.length >= 3 ? 'big' : 'hit');
        scope.after(result.exploded.length ? 250 : 0, () => floatText(scope, { ...at, y: at.y + 0.4 }, `+${result.points}`, 'neon', 84));
        app.world.cheer(Math.min(1, result.destroyed.length / 6));
      }

      if (isOver(state)) {
        if (result.cleared && result.clearBonus) {
          await banner(scope, `+${result.clearBonus} SPARE BALL BONUS`, 'neon', 300, 90, 700);
        }
        await scope.wait(400);
        // Spare balls carry into the next level.
        resolve({ score: state.score, passed: result.cleared, carry: state.ballsLeft });
      }
    });
  });
}

export function bricksScreen(app: App, scope: Scope): void {
  app.world.show('synthwave');
  void runLevels(app, scope, {
    gameId: 'bricks',
    levels: BRICK_LEVELS.map((l) => l.info),
    play: (ctx) => playLevel(app, ctx),
  });
}
