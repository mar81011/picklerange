// Arcade-style game select. Each game is a numbered card; hit a card with the
// ball (or staff can type its number) to start it. Cards are HTML laid over a
// dimmed stadium, and hits are matched against their on-screen rectangles.
import type { App } from '../app';
import type { Scope } from '../engine/scope';
import { GAMES, type GameId, type GameInfo } from '../games';
import { leaderboard } from '../services';

const ICONS: Record<GameId, string> = {
  bullseye: '🏹',
  popup: '⚡',
  opencourt: '🤖',
  bricks: '🧱',
  zombies: '🧟',
  gallery: '🔫',
  rally: '🏓',
  tictactoe: '⭕',
  darts: '🎯',
  memory: '🃏',
};

function playersLabel(game: GameInfo): string {
  if (game.mode === 'solo') return '1 PLAYER • 5 LEVELS';
  const [min, max] = game.players!;
  return min === max ? `${min} PLAYERS` : `${min}–${max} PLAYERS`;
}

function card(scope: Scope, parent: HTMLElement, game: GameInfo, number: number): HTMLElement {
  const el = scope.el('div', `game-card ${game.mode}`, parent);
  el.style.setProperty('--accent', game.accent);
  el.style.animationDelay = `${number * 60}ms`;
  scope.el('div', 'num display', el, String(number));
  if (game.mode === 'party') scope.el('div', 'ribbon', el, 'PARTY');
  scope.el('div', 'icon', el, ICONS[game.id]);
  scope.el('div', 'title display', el, game.title);
  scope.el('div', 'chip', el, playersLabel(game));
  const best = game.mode === 'solo' ? leaderboard.top(game.id, 1)[0] : undefined;
  scope.el('div', 'best', el, best ? `🏆 ${best.name}  ${best.score}` : game.mode === 'solo' ? 'NO SCORE YET' : '');
  return el;
}

export function menuScreen(app: App, scope: Scope): void {
  app.world.show('stadium');
  // Full-window background (outside the 16:9 overlay so it reaches every edge).
  // Nothing 3D is visible behind it, so stop rendering the scene meanwhile.
  const backdrop = scope.el('div', 'menu-backdrop', app.stage.frame);
  for (let i = 0; i < 3; i++) scope.el('div', `orb orb-${i}`, backdrop);
  app.stage.render3d = false;
  scope.onDispose(() => {
    backdrop.remove();
    app.stage.render3d = true;
  });

  const header = scope.el('div', 'menu-header');
  const logo = scope.el('div', 'logo', header);
  scope.el('div', 'display', logo, 'PICKLERANGE');
  scope.el('div', 'pill display', logo, 'ARCADE');
  const prompt = scope.el('div', 'prompt', header);
  scope.el('div', 'ball', prompt);
  scope.el('div', 'display', prompt, 'HIT A GAME TO PLAY');

  const grid = scope.el('div', 'game-grid');
  const cards = GAMES.map((game, i) => card(scope, grid, game, i + 1));

  // Attract mode: a glow travels across the cards.
  let lit = 0;
  scope.every(1100, () => {
    cards[lit].classList.remove('lit');
    lit = (lit + 1) % cards.length;
    cards[lit].classList.add('lit');
  });

  /** Card under a normalized screen point (0..1). */
  const cardAt = (x: number, y: number): number => {
    const frame = app.stage.frame.getBoundingClientRect();
    const px = frame.left + x * frame.width;
    const py = frame.top + y * frame.height;
    return cards.findIndex((c) => {
      const r = c.getBoundingClientRect();
      return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
    });
  };

  app.debugAimScreen = (key) => {
    const index = Math.max(0, GAMES.findIndex((g) => g.id === key));
    const frame = app.stage.frame.getBoundingClientRect();
    const r = cards[index].getBoundingClientRect();
    return { x: (r.left + r.width / 2 - frame.left) / frame.width, y: (r.top + r.height / 2 - frame.top) / frame.height };
  };

  let chosen = false;
  const start = (index: number) => {
    if (chosen || index < 0 || index >= GAMES.length) return;
    chosen = true;
    cards[index].classList.add('chosen');
    app.world.cheer(0.8);
    scope.after(550, () => app.play(GAMES[index].id));
  };

  scope.onHit((hit) => start(cardAt(hit.x, hit.y)));

  // Staff shortcut: type the game number. Two digits typed quickly make 10.
  let typed = '';
  let typedAt = 0;
  const onKey = (e: KeyboardEvent) => {
    if (!/^[0-9]$/.test(e.key)) return;
    const now = performance.now();
    typed = now - typedAt < 700 ? typed + e.key : e.key;
    typedAt = now;
    const n = Number(typed);
    // Wait briefly when a second digit could still follow (e.g. "1" might become "10").
    const couldGrow = n * 10 <= GAMES.length;
    scope.after(couldGrow ? 700 : 0, () => {
      if (typed === String(n)) start(n - 1);
    });
  };
  window.addEventListener('keydown', onKey);
  scope.onDispose(() => window.removeEventListener('keydown', onKey));
}
