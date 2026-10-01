import { music } from '../audio/music';
import type * as THREE from 'three';
import type { App } from '../app';
import { tileAt, tileCenter, type TileGrid } from '../core/grid';
import { ballFlight, burst, floatText } from '../engine/effects';
import { createTile, panelFace, redrawTile } from '../engine/gameProps';
import { easeInCubic, easeOutCubic, type Scope } from '../engine/scope';
import { gameInfo } from '../games';
import { createMemory, flip, isOver, winner } from '../games/memory/logic';
import { banner, introCard } from '../ui/hud';
import { pointAlong } from './common';
import { PLAYER_COLORS, PLAYER_HEX, partyEnd, playerBar, playerName, turnBanner } from './party';

// As big as the screen allows: just behind the net, top row right under the player scores.
const GRID: TileGrid = { cols: 4, rows: 3, tileWidth: 1.68, tileHeight: 1.33, gap: 0.12, baseY: 0.15, z: -0.4 };
const SYMBOLS = [
  { glyph: '★', color: '#ffd23f' },
  { glyph: '♥', color: '#ff4d6d' },
  { glyph: '♦', color: '#3ff5ff' },
  { glyph: '♣', color: '#7cff6b' },
  { glyph: '♠', color: '#c77dff' },
  { glyph: '●', color: '#d4f53c' },
];

const BACK_FRAME = 0x6a3fb5;

/** Card back: a pickleball pattern with a big question mark. */
function drawBack(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  panelFace(ctx, w, h, '#2a1660', '#c77dff');
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(14, 14, w - 28, h - 28, 30);
  ctx.clip();
  // Little ball holes in a diagonal grid.
  ctx.fillStyle = 'rgba(199,125,255,0.16)';
  for (let y = 10; y < h; y += 46) {
    for (let x = (y / 46) % 2 ? 33 : 10; x < w; x += 46) {
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = '#c77dff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#f0dcff';
  ctx.font = '180px "Bebas Neue"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', w / 2, h / 2 + 14);
  ctx.restore();
}

function drawFront(symbol: number, owner: number | null) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    panelFace(ctx, w, h, '#fbf8ff', owner === null ? '#c77dff' : PLAYER_COLORS[owner]);
    const s = SYMBOLS[symbol];
    ctx.fillStyle = s.color;
    ctx.strokeStyle = '#1a1440';
    ctx.lineWidth = 6;
    ctx.font = '190px "Segoe UI Symbol", "Noto Sans Symbols", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(s.glyph, w / 2, h / 2 + 10);
    ctx.fillText(s.glyph, w / 2, h / 2 + 10);
  };
}

export function memoryScreen(app: App, scope: Scope): void {
  app.world.show('lodge');
  const info = gameInfo('memory');
  let state = createMemory(SYMBOLS.length, Math.random);
  let ready = false;

  const center = (i: number) => tileCenter(GRID, i % GRID.cols, Math.floor(i / GRID.cols));
  const tiles: THREE.Object3D[] = state.tiles.map((_, i) => {
    const tile = scope.add(createTile(GRID.tileWidth, GRID.tileHeight, drawBack, BACK_FRAME));
    const c = center(i);
    tile.position.set(c.x, c.y, c.z);
    return tile;
  });

  /** Card-flip: squash to nothing, swap the face, open back up. */
  const turnTile = async (i: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
    const tile = tiles[i];
    await scope.animate(140, (t) => (tile.scale.x = Math.max(0.01, 1 - t)), easeInCubic);
    redrawTile(tile, draw);
    await scope.animate(140, (t) => (tile.scale.x = Math.max(0.01, t)), easeOutCubic);
  };

  const updateBar = playerBar(scope, 2);
  const refresh = () => updateBar(state.pairs.map((p) => `${p} PAIR${p === 1 ? '' : 'S'}`), state.turn);
  refresh();

  app.debugAim = () => {
    const hidden = state.tiles.map((_, i) => i).filter((i) => !state.matched[i] && i !== state.open);
    // Automated play: half the time, cheat and pick the open tile's partner.
    const partner = state.open !== null ? hidden.find((i) => state.tiles[i] === state.tiles[state.open!]) : undefined;
    const pick = partner !== undefined && Math.random() < 0.5 ? partner : hidden[Math.floor(Math.random() * hidden.length)];
    return pick === undefined ? null : center(pick);
  };

  void introCard(scope, info.title, info.howTo).then(async () => {
    await turnBanner(scope, state.turn);
    ready = true;
  });

  scope.onHit(async (hit) => {
    if (!ready || isOver(state)) return;
    ready = false;
    const ray = app.stage.rayFromScreen(hit.x, hit.y);
    const cell = tileAt(GRID, ray);
    const index = cell ? cell.row * GRID.cols + cell.col : null;
    const mover = state.turn;
    const { state: next, result } = flip(state, index);
    state = next;

    const at = index !== null ? center(index) : pointAlong(ray);
    await ballFlight(scope, at, 220);

    switch (result.kind) {
      case 'first':
        await turnTile(result.tile, drawFront(state.tiles[result.tile], null));
        ready = true;
        return;
      case 'match': {
        await turnTile(result.tiles[1], drawFront(state.tiles[result.tiles[1]], null));
        for (const i of result.tiles) {
          redrawTile(tiles[i], drawFront(state.tiles[i], mover), PLAYER_HEX[mover]);
          burst(scope, center(i), PLAYER_HEX[mover], 0.6);
        }
        music.sfx('big');
        floatText(scope, at, 'MATCH!', 'neon', 96);
        app.world.cheer(0.7);
        refresh();
        if (!isOver(state)) {
          await banner(scope, `${playerName(mover)} GOES AGAIN`, `player-${mover}`, 380, 80, 500);
          ready = true;
          return;
        }
        break;
      }
      case 'nomatch':
        await turnTile(result.tiles[1], drawFront(state.tiles[result.tiles[1]], null));
        music.sfx('miss');
        floatText(scope, at, 'NO MATCH', 'muted', 80);
        await scope.wait(1300); // time to memorize
        await Promise.all(result.tiles.map((i) => turnTile(i, drawBack)));
        break;
      case 'miss':
        burst(scope, at, 0xffffff, 0.15);
        music.sfx('miss');
        floatText(scope, at, 'MISS! TURN OVER', 'muted', 64);
        if (result.reopened !== null) await turnTile(result.reopened, drawBack);
        break;
    }

    if (isOver(state)) {
      await scope.wait(600);
      const w = winner(state);
      const headline = w === 'draw' ? 'IT’S A DRAW!' : `${playerName(w)} WINS!`;
      void partyEnd(app, scope, 'memory', headline, w === 'draw' ? '#ffffff' : PLAYER_COLORS[w], [
        `${playerName(0)}: ${state.pairs[0]} pairs  •  ${playerName(1)}: ${state.pairs[1]} pairs`,
      ]);
      return;
    }
    refresh();
    await turnBanner(scope, state.turn);
    ready = true;
  });
}
