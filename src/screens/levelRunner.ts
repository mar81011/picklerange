// Runs a game as a series of levels: level card → play → cleared/failed.
// The running total carries across levels; failing a level ends the run.
import type { App } from '../app';
import { Scope } from '../engine/scope';
import { gameInfo, type GameId } from '../games';
import type { LevelInfo } from '../games/levels';
import { banner, introCard } from '../ui/hud';

export interface LevelContext {
  /** Everything for this level lives here and is cleaned up when it ends. */
  scope: Scope;
  /** 0-based. */
  index: number;
  /** Score from earlier levels, for showing a running total. */
  totalBefore: number;
  /** Whatever the previous level handed on (e.g. spare balls), or undefined. */
  carry: unknown;
  /** Updates the level progress bar (0..1). */
  setProgress(fraction: number): void;
}

export interface LevelOutcome {
  score: number;
  passed: boolean;
  /** Handed to the next level as ctx.carry. */
  carry?: unknown;
}

export interface LevelRun {
  gameId: GameId;
  levels: readonly LevelInfo[];
  play(ctx: LevelContext): Promise<LevelOutcome>;
}

/** Dev builds can jump to a level with ?level=N, to test it without playing the earlier ones. */
function startLevel(count: number): number {
  if (!import.meta.env.DEV) return 0;
  const n = Number(new URLSearchParams(location.search).get('level'));
  return Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : 0;
}

function levelPill(scope: Scope, index: number, count: number, info: LevelInfo): (fraction: number) => void {
  const pill = scope.el('div', 'panel level-pill');
  scope.el('div', 'lv display', pill, `LV ${index + 1}/${count}`);
  const bar = scope.el('div', 'level-bar', pill);
  const fill = scope.el('div', '', bar);
  scope.el('div', 'goal-text label', pill, info.target !== null ? `${info.target} to pass` : (info.goal ?? ''));
  return (fraction) => {
    const f = Math.max(0, Math.min(1, fraction));
    fill.style.width = `${f * 100}%`;
    bar.classList.toggle('done', f >= 1);
  };
}

export async function runLevels(app: App, scope: Scope, run: LevelRun): Promise<void> {
  const info = gameInfo(run.gameId);
  const count = run.levels.length;
  let total = 0;
  let carry: unknown;

  for (let index = startLevel(count); index < count; index++) {
    const level = run.levels[index];
    const levelScope = new Scope(app.stage);
    scope.onDispose(() => levelScope.dispose());

    const goal = level.target !== null ? `SCORE ${level.target} TO PASS` : (level.goal ?? '').toUpperCase();
    const howTo = index === 0 ? `${info.howTo}\n\n${level.description}` : level.description;
    await introCard(levelScope, level.name.toUpperCase(), howTo, goal, `${info.title} • Level ${index + 1} of ${count}`);
    if (!scope.alive) return;

    const setProgress = levelPill(levelScope, index, count, level);
    const outcome = await run.play({ scope: levelScope, index, totalBefore: total, carry, setProgress });
    if (!scope.alive) return;
    total += outcome.score;
    carry = outcome.carry;

    if (!outcome.passed) {
      await banner(levelScope, 'LEVEL FAILED', 'red', 330, 140, 900);
      levelScope.dispose();
      app.gameOver({ gameId: run.gameId, score: total, level: index + 1, stats: `Reached level ${index + 1} of ${count}` });
      return;
    }

    app.world.cheer(0.8);
    await banner(levelScope, index === count - 1 ? 'ALL LEVELS CLEARED!' : 'LEVEL CLEARED!', 'neon', 330, 140, 1000);
    levelScope.dispose();
  }

  app.world.cheer(1);
  app.gameOver({ gameId: run.gameId, score: total, level: count, stats: `Beat all ${count} levels!` });
}
