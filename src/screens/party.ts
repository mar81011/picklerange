// Shared pieces for turn-based party games: picking the number of players,
// whose turn it is, and the winner screen.
import type { App } from '../app';
import { tileAt, tileCenter, type TileGrid } from '../core/grid';
import { burst } from '../engine/effects';
import * as THREE from 'three';
import { createTile, panelFace } from '../engine/gameProps';
import { easeOutBack, type Scope } from '../engine/scope';
import type { GameId } from '../games';
import { banner } from '../ui/hud';

/** Hits are ignored this long after choice tiles appear. */
const CHOICE_GRACE_MS = 1500;

export const PLAYER_COLORS = ['#ff5a5f', '#3ff5ff', '#d4f53c', '#c77dff'];
export const PLAYER_HEX = [0xff5a5f, 0x3ff5ff, 0xd4f53c, 0xc77dff];

export function playerName(i: number): string {
  return `PLAYER ${i + 1}`;
}

/** A row of big tiles to hit, e.g. "2 / 3 / 4" or "PLAY AGAIN / MENU". Resolves with the index hit. */
export function chooseTile(app: App, scope: Scope, labels: string[], colors: string[], width = 1.5): Promise<number> {
  const grid: TileGrid = { cols: labels.length, rows: 1, tileWidth: width, tileHeight: 1.0, gap: 0.35, baseY: 0.55, z: -3.4 };
  const tiles = labels.map((label, i) => {
    const tile = scope.add(
      createTile(grid.tileWidth, grid.tileHeight, (ctx, w, h) => {
        panelFace(ctx, w, h, '#101a33', colors[i]);
        ctx.shadowColor = colors[i];
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#fff';
        ctx.font = `${label.length > 3 ? 110 : 220}px "Bebas Neue"`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, w / 2, h / 2 + 10);
      }, new THREE.Color(colors[i]).getHex()),
    );
    const c = tileCenter(grid, i, 0);
    tile.position.set(c.x, c.y, c.z);
    tile.scale.setScalar(0.01);
    void scope.animate(400, (t) => tile.scale.setScalar(Math.max(0.01, t)), easeOutBack);
    return tile;
  });
  app.debugAim = (key) => tileCenter(grid, key ? Math.min(labels.length - 1, Number(key)) : 0, 0);

  // Ignore balls for a moment so a late shot from the last turn can't pick an option.
  const shownAt = performance.now();
  return new Promise((resolve) => {
    let chosen = false;
    scope.onHit((hit) => {
      if (chosen || performance.now() - shownAt < CHOICE_GRACE_MS) return;
      const cell = tileAt(grid, app.stage.rayFromScreen(hit.x, hit.y));
      if (!cell) return;
      chosen = true;
      const c = tileCenter(grid, cell.col, 0);
      burst(scope, c, 0xffffff, 0.8);
      app.world.cheer(0.6);
      const tile = tiles[cell.col];
      void scope
        .animate(350, (t) => tile.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.15))
        .then(() => {
          // The choice tiles are done; clear them so they don't sit behind the game.
          for (const t of tiles) scope.remove(t);
          resolve(cell.col);
        });
    });
  });
}

/** Asks how many players, unless the game only allows one count. */
export async function choosePlayers(app: App, scope: Scope, [min, max]: [number, number]): Promise<number> {
  if (min === max) return min;
  const prompt = scope.el('div', 'center display neon', scope.layer, 'HOW MANY PLAYERS?');
  Object.assign(prompt.style, { top: '170px', fontSize: '90px' });
  const counts = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const pick = await chooseTile(app, scope, counts.map(String), counts.map((_, i) => PLAYER_COLORS[i + 1]));
  prompt.remove();
  return counts[pick];
}

/** Score strip under the scoreboard showing every player; returns an updater. */
export function playerBar(scope: Scope, players: number): (values: string[], current: number) => void {
  const bar = scope.el('div', 'player-bar');
  const cells = Array.from({ length: players }, (_, i) => {
    const cell = scope.el('div', 'player-cell panel', bar);
    cell.style.setProperty('--player', PLAYER_COLORS[i]);
    scope.el('div', 'label', cell, playerName(i));
    return scope.el('div', 'display value', cell, '');
  });
  return (values, current) => {
    cells.forEach((cell, i) => {
      cell.textContent = values[i];
      cell.parentElement!.classList.toggle('active', i === current);
    });
  };
}

export function turnBanner(scope: Scope, player: number): Promise<void> {
  return banner(scope, `${playerName(player)} — YOUR TURN`, `player-${player}`, 380, 100, 700);
}

/** Winner card with Play Again / Menu choices. */
export async function partyEnd(app: App, scope: Scope, gameId: GameId, headline: string, color: string, lines: string[]): Promise<void> {
  const card = scope.el('div', 'panel party-end');
  const title = scope.el('div', 'display', card, headline);
  title.style.color = color;
  for (const line of lines) scope.el('div', 'label', card, line);
  app.world.cheer(1);
  const choice = await chooseTile(app, scope, ['PLAY AGAIN', 'MENU'], ['#d4f53c', '#9fb0cf'], 2.2);
  if (choice === 0) app.play(gameId);
  else app.menu();
}
