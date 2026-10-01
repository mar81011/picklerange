import { music } from '../audio/music';
import type * as THREE from 'three';
import type { App } from '../app';
import { tileAt, tileCenter, type TileGrid } from '../core/grid';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { createTile, panelFace, redrawTile } from '../engine/gameProps';
import { easeOutBack, type Scope } from '../engine/scope';
import { gameInfo } from '../games';
import { createGame, isOver, play, type Cell } from '../games/tictactoe/logic';
import { introCard } from '../ui/hud';
import { pointAlong } from './common';
import { PLAYER_COLORS, PLAYER_HEX, partyEnd, playerBar, playerName, turnBanner } from './party';

// As big as the screen allows: just behind the net, top row right under the player scores.
const GRID: TileGrid = { cols: 3, rows: 3, tileWidth: 1.9, tileHeight: 1.33, gap: 0.12, baseY: 0.15, z: -0.4 };
const MARKS = ['X', 'O'];

/** Bezel color for a square: neutral when free, the owner's color when claimed. */
function frameFor(cell: Cell): number {
  return cell === null ? 0x24305a : PLAYER_HEX[cell];
}

function drawCell(cell: Cell, index: number, winning: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const color = cell === null ? '#4a5a8a' : PLAYER_COLORS[cell];
    panelFace(ctx, w, h, winning ? '#1f4a2a' : '#0e1630', color);
    const cx = w / 2;
    const cy = h / 2;
    const size = Math.min(w, h) * 0.3;
    if (cell === null) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.font = '110px "Bebas Neue"';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1), cx, cy + 8);
      return;
    }
    // Neon marks: a bright core over a wide glow.
    ctx.lineCap = 'round';
    for (const [width, alpha, blur] of [[44, 0.35, 40], [26, 1, 18]] as const) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
      ctx.strokeStyle = width > 30 ? color : '#ffffff';
      ctx.lineWidth = width;
      ctx.beginPath();
      if (MARKS[cell] === 'X') {
        ctx.moveTo(cx - size, cy - size);
        ctx.lineTo(cx + size, cy + size);
        ctx.moveTo(cx + size, cy - size);
        ctx.lineTo(cx - size, cy + size);
      } else {
        ctx.arc(cx, cy, size, 0, Math.PI * 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  };
}

export function ticTacToeScreen(app: App, scope: Scope): void {
  app.world.show('space');
  const info = gameInfo('tictactoe');
  let state = createGame();
  let ready = false;

  const tiles: THREE.Object3D[] = Array.from({ length: 9 }, (_, i) => {
    const tile = scope.add(createTile(GRID.tileWidth, GRID.tileHeight, drawCell(null, i, false), frameFor(null)));
    const c = tileCenter(GRID, i % 3, Math.floor(i / 3));
    tile.position.set(c.x, c.y, c.z);
    return tile;
  });
  const center = (i: number) => tileCenter(GRID, i % 3, Math.floor(i / 3));

  const updateBar = playerBar(scope, 2);
  const showTurn = () => updateBar(['X', 'O'], state.turn);
  showTurn();

  app.debugAim = () => {
    const free = state.board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0);
    return free.length ? center(free[Math.floor(Math.random() * free.length)]) : null;
  };

  void introCard(scope, info.title, info.howTo, 'PLAYER 1 = X • PLAYER 2 = O', undefined, false).then(async () => {
    await turnBanner(scope, state.turn);
    ready = true;
  });

  scope.onHit(async (hit) => {
    if (!ready || isOver(state)) return;
    ready = false;
    const ray = app.stage.rayFromScreen(hit.x, hit.y);
    const cell = tileAt(GRID, ray);
    const index = cell ? cell.row * 3 + cell.col : null;
    const mover = state.turn;
    const { state: next, result } = play(state, index);
    state = next;

    const at = index !== null ? center(index) : pointAlong(ray);
    await ballFlight(scope, at, 220);
    if (result === 'claimed') {
      const tile = tiles[index!];
      redrawTile(tile, drawCell(mover, index!, false), frameFor(mover));
      music.sfx('hit');
      burst(scope, at, PLAYER_HEX[mover], 0.6);
      await scope.animate(300, (t) => tile.scale.setScalar(0.6 + 0.4 * t), easeOutBack);
    } else {
      burst(scope, at, 0xffffff, 0.15);
      music.sfx('miss');
      floatText(scope, at, result === 'taken' ? 'TAKEN! TURN LOST' : 'MISS! TURN LOST', 'muted', 64);
    }

    if (isOver(state)) {
      if (state.line) {
        for (const i of state.line) redrawTile(tiles[i], drawCell(state.board[i], i, true));
        music.sfx('big');
        shockwave(scope, center(state.line[1]), PLAYER_HEX[state.winner!], 3);
      }
      await scope.wait(900);
      const headline = state.winner !== null ? `${playerName(state.winner)} WINS!` : 'IT’S A DRAW!';
      const color = state.winner !== null ? PLAYER_COLORS[state.winner] : '#ffffff';
      void partyEnd(app, scope, 'tictactoe', headline, color, state.winner !== null ? [`Three in a row with ${MARKS[state.winner]}`] : ['Nobody got three in a row']);
      return;
    }
    showTurn();
    await turnBanner(scope, state.turn);
    ready = true;
  });
}
