import { music } from '../audio/music';
import type * as THREE from 'three';
import type { App } from '../app';
import { ballFlight, burst, floatText, shockwave } from '../engine/effects';
import { createDartboard, placeDartboard } from '../engine/gameProps';
import type { Scope } from '../engine/scope';
import { gameInfo } from '../games';
import { DARTS_PER_TURN, applyDart, createDarts, throwAt, type Board } from '../games/darts/logic';
import { banner, introCard } from '../ui/hud';
import { pointAlong } from './common';
import { PLAYER_COLORS, PLAYER_HEX, choosePlayers, partyEnd, playerBar, playerName, turnBanner } from './party';

// As big as the screen allows: just behind the net, number ring right under the player scores.
const BOARD: Board = { x: 0, y: 2.2, z: -0.6, radius: 1.68 };

export async function dartsScreen(app: App, scope: Scope): Promise<void> {
  app.world.show('pub');
  const info = gameInfo('darts');
  const players = await choosePlayers(app, scope, info.players!);
  if (!scope.alive) return;

  const board = scope.add(createDartboard(BOARD.radius));
  placeDartboard(board, BOARD.x, BOARD.y, BOARD.z);
  let state = createDarts(players);
  let ready = false;
  /** Balls stuck in the board this turn, cleared when the turn ends. */
  let stuck: THREE.Mesh[] = [];

  const updateBar = playerBar(scope, players);
  const turnInfo = scope.el('div', 'center label');
  // Bottom-left corner, beside the board.
  Object.assign(turnInfo.style, { top: '980px', left: '40px', right: 'auto', textAlign: 'left', fontSize: '40px', color: '#fff' });
  const refresh = () => {
    updateBar(state.scores.map(String), state.turn);
    turnInfo.textContent = `${playerName(state.turn)} • BALL ${state.darts.length + 1} OF ${DARTS_PER_TURN}`;
    turnInfo.style.color = PLAYER_COLORS[state.turn];
  };
  refresh();

  // Automated play aims around the triple-20 / bull area with some spread.
  app.debugAim = () => ({ x: BOARD.x + (Math.random() - 0.5) * 0.9, y: BOARD.y + Math.random() * 0.7, z: BOARD.z });

  const clearStuck = () => {
    for (const ball of stuck) scope.remove(ball);
    stuck = [];
  };

  await introCard(scope, info.title, info.howTo, `${players} PLAYERS • START AT 301`);
  if (!scope.alive) return;
  await turnBanner(scope, state.turn);
  ready = true;

  scope.onHit(async (hit) => {
    if (!ready || state.winner !== null) return;
    ready = false;
    const ray = app.stage.rayFromScreen(hit.x, hit.y);
    const dart = throwAt(BOARD, ray);
    const thrower = state.turn;
    const { state: next, outcome, turnOver } = applyDart(state, dart);
    state = next;

    const at = dart.at && dart.points > 0 ? { ...dart.at, z: BOARD.z + 0.08 } : (dart.at ?? pointAlong(ray));
    const ball = await ballFlight(scope, at, 240, dart.points > 0);
    if (dart.points > 0) stuck.push(ball);
    burst(scope, at, dart.points > 0 ? PLAYER_HEX[thrower] : 0xffffff, dart.points >= 40 ? 0.9 : 0.4);
    music.sfx(dart.points === 0 ? 'miss' : dart.multiplier === 3 || dart.sector === 50 ? 'big' : 'hit');
    floatText(scope, at, dart.points > 0 ? `${dart.label}${dart.multiplier > 1 || dart.sector >= 25 ? '!' : ''}  ${dart.points}` : 'MISS', dart.points > 0 ? 'neon' : 'muted', dart.points >= 40 ? 96 : 76);
    if (dart.multiplier === 3 || dart.sector === 50) app.world.cheer(0.8);
    refresh();

    if (outcome === 'win') {
      shockwave(scope, at, PLAYER_HEX[thrower], 3);
      await scope.wait(900);
      void partyEnd(app, scope, 'darts', `${playerName(thrower)} WINS!`, PLAYER_COLORS[thrower], [
        state.scores.map((s, i) => `${playerName(i)}: ${s}`).join('  •  '),
      ]);
      return;
    }
    if (outcome === 'bust') {
      await banner(scope, 'BUST! SCORE RESET', 'red', 380, 110, 700);
    }
    if (turnOver) {
      await scope.wait(700);
      clearStuck();
      await turnBanner(scope, state.turn);
    }
    ready = true;
  });
}
