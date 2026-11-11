// Arcade-style game select. Each game is a numbered card; hit a card with the
// ball (or staff can type its number) to start it; S shows the staff page QR. Cards are HTML laid over a
// dimmed stadium, and hits are matched against their on-screen rectangles.
import type { App } from '../app';
import type { Scope } from '../engine/scope';
import { GAMES, type GameId, type GameInfo } from '../games';
import { elementAt, elementCenter } from './common';
import { staffLink } from '../leaderboard/scoreCards';
import { leaderboard, scoreStore } from '../services';

/** How often the idle menu reloads best scores (so staff deletions show up). */
const REFRESH_MS = 60_000;

const ICONS: Record<GameId, string> = {
  bullseye: '🏹',
  popup: '⚡',
  opencourt: '🤖',
  bricks: '🧱',
  zombies: '🧟',
  dragon: '🐉',
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
  scope.el('div', 'best', el, bestText(game));
  return el;
}

function bestText(game: GameInfo): string {
  if (game.mode !== 'solo') return '';
  const best = leaderboard.top(game.id, 1)[0];
  return best ? `🏆 ${best.name}  ${best.score}` : 'NO SCORE YET';
}

/** Staff key S: a QR to open the staff page on a phone. Press S again to hide it. */
function toggleStaffQr(scope: Scope): void {
  const open = scope.layer.querySelector('.staff-qr');
  if (open) return open.remove();
  const panel = scope.el('div', 'panel staff-qr');
  scope.el('div', 'display neon', panel, 'STAFF PAGE');
  const body = scope.el('div', 'label', panel, 'Loading…');
  void staffLink().then((link) => {
    if (!scope.alive) return;
    if (!link) {
      body.textContent = 'Lane server is not running';
      return;
    }
    body.remove();
    const box = scope.el('div', 'qr-box', panel);
    scope.el('img', '', box).src = link.qr;
    scope.el('div', 'label', panel, link.url);
    scope.el('div', 'label muted', panel, 'PIN is in data/staff-pin.txt • S to hide');
  });
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

  // Reload best scores now and then, so new records and staff deletions show up.
  const refreshBest = () =>
    void scoreStore.refresh().then(() => {
      if (!scope.alive) return;
      GAMES.forEach((game, i) => (cards[i].querySelector('.best')!.textContent = bestText(game)));
    });
  scope.every(REFRESH_MS, refreshBest);

  // Attract mode: a glow travels across the cards.
  let lit = 0;
  scope.every(1100, () => {
    cards[lit].classList.remove('lit');
    lit = (lit + 1) % cards.length;
    cards[lit].classList.add('lit');
  });

  app.debugAimScreen = (key) => elementCenter(app.stage, cards[Math.max(0, GAMES.findIndex((g) => g.id === key))]);

  let chosen = false;
  const start = (index: number) => {
    if (chosen || index < 0 || index >= GAMES.length) return;
    chosen = true;
    cards[index].classList.add('chosen');
    app.world.cheer(0.8);
    scope.after(550, () => app.play(GAMES[index].id));
  };

  scope.onHit((hit) => start(elementAt(app.stage, hit.x, hit.y, cards)));

  // Staff shortcut: type the game number. Two digits typed quickly make 10.
  let typed = '';
  let typedAt = 0;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 's' || e.key === 'S') return toggleStaffQr(scope);
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
