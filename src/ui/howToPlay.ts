// "How to play" pictures for the intro card: a row of small drawings showing
// what to hit, what it's worth, and what to avoid. Point values come from the
// game rules, so the pictures stay right when a game is retuned.
import type { GameId } from '../games';
import { POINTS as BRICK_POINTS, type BrickKind } from '../games/bricks/brickLogic';
import { DEFAULT_RINGS } from '../games/bullseye/bullseyeLogic';
import { POINTS as PLATE_POINTS } from '../games/gallery/logic';
import { DROP_SHOT_BONUS, WINNER_POINTS } from '../games/opencourt/openCourtLogic';
import { DEFAULT_POPUP, multiplierFor } from '../games/popup/popupLogic';
import { POINTS_PER_RETURN, STREAK_BONUS } from '../games/rally/logic';
import { POINTS as DUNK_POINTS } from '../games/dunk/logic';
import { POINTS as ZOMBIE_POINTS } from '../games/zombies/logic';
import { memoryPicture } from '../engine/memoryCards';
import { brickPicture } from '../engine/props';
import type { Scope } from '../engine/scope';

interface LegendItem {
  /** SVG markup drawn in a 100×100 box. A function when it needs the game's canvas art (ready only after fonts load). */
  art: string | (() => string);
  label: string;
  value: string;
  /** good = worth points, bad = avoid, plain = information. */
  tone: 'good' | 'bad' | 'plain';
}

const svg = (body: string) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const target = (highlightCenter: boolean) =>
  svg(
    ['#e63946', '#fff', '#e63946', '#fff']
      .map((fill, i) => `<circle cx="50" cy="50" r="${44 - i * 10}" fill="${fill}" opacity="${highlightCenter ? 0.45 : 1}"/>`)
      .join('') +
      `<circle cx="50" cy="50" r="10" fill="#ffd23f" stroke="#fff" stroke-width="3"${highlightCenter ? '' : ' opacity="0.45"'}/>`,
  );

const glowDisc = (color: string, inner = '') =>
  svg(
    `<circle cx="50" cy="50" r="42" fill="none" stroke="${color}" stroke-width="6" opacity="0.5"/>` +
      `<circle cx="50" cy="50" r="32" fill="${color}"/><circle cx="50" cy="50" r="14" fill="#fff" opacity="0.85"/>${inner}`,
  );

const bomb = svg(
  `<circle cx="50" cy="56" r="34" fill="#ff2b2b"/><rect x="44" y="12" width="12" height="14" rx="3" fill="#333"/>` +
    `<path d="M50 14 Q60 4 70 8" stroke="#ffd23f" stroke-width="4" fill="none"/>` +
    `<text x="50" y="72" font-size="44" font-weight="900" text-anchor="middle" fill="#fff" font-family="Arial">!</text>`,
);

/** The dunk target: red circle in a white rim; which part is highlighted. */
const dunkTarget = (part: 'red' | 'rim') =>
  svg(
    `<circle cx="50" cy="50" r="44" fill="#222"/><circle cx="50" cy="50" r="40" fill="#fff" opacity="${part === 'rim' ? 1 : 0.5}"/>` +
      `<circle cx="50" cy="50" r="28" fill="#e01e2e" opacity="${part === 'red' ? 1 : 0.45}"/><circle cx="50" cy="50" r="12" fill="none" stroke="#fff" stroke-width="3"/>`,
  );

const clownFace = svg(
  `<circle cx="26" cy="46" r="15" fill="#ff7a1a"/><circle cx="74" cy="46" r="15" fill="#ff7a1a"/><circle cx="50" cy="52" r="30" fill="#f7f1ea"/>` +
    `<path d="M36 18 L50 -4 L64 18 Z" fill="#2f6fd8"/><circle cx="40" cy="46" r="4" fill="#111"/><circle cx="60" cy="46" r="4" fill="#111"/>` +
    `<circle cx="50" cy="56" r="7" fill="#ff1a1a"/><path d="M36 66 Q50 80 64 66" stroke="#d0101a" stroke-width="5" fill="none" stroke-linecap="round"/>`,
);

const streak = (text: string) =>
  svg(
    `<text x="50" y="66" font-size="52" font-weight="900" text-anchor="middle" fill="#d4f53c" font-family="Arial">${text}</text>` +
      `<path d="M14 82 H86" stroke="#d4f53c" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`,
  );

const robot = (crossed: boolean) =>
  svg(
    `<rect x="26" y="22" width="48" height="40" rx="10" fill="#9fb0cf"/><circle cx="40" cy="42" r="6" fill="#0b1220"/>` +
      `<circle cx="60" cy="42" r="6" fill="#0b1220"/><rect x="34" y="62" width="32" height="26" rx="6" fill="#6c7a99"/>` +
      `<line x1="50" y1="10" x2="50" y2="22" stroke="#9fb0cf" stroke-width="4"/><circle cx="50" cy="9" r="4" fill="#ff5a5f"/>` +
      (crossed
        ? `<circle cx="50" cy="50" r="46" fill="none" stroke="#ff5a5f" stroke-width="6" stroke-dasharray="8 6"/>`
        : `<path d="M82 76 L94 90 M94 76 L94 90 L80 90" stroke="#d4f53c" stroke-width="6" fill="none" stroke-linecap="round"/>`),
  );

const kitchen = svg(
  `<rect x="10" y="12" width="80" height="76" fill="#2a6f97" stroke="#fff" stroke-width="3"/>` +
    `<rect x="10" y="64" width="80" height="24" fill="#d4f53c" opacity="0.8"/><line x1="10" y1="64" x2="90" y2="64" stroke="#fff" stroke-width="3"/>` +
    `<circle cx="62" cy="76" r="7" fill="#fff"/>`,
);

/** The real brick face from the game. */
const brick = (kind: BrickKind) => () => svg(`<image href="${brickPicture(kind)}" x="2" y="26" width="96" height="48"/>`);

/** The zombie emoji (same as the menu card), bigger for tougher zombies; the boss gets a crown. */
const zombie = (size: number, crown = false) =>
  svg(
    `<text x="50" y="94" font-size="${size}" text-anchor="middle">🧟</text>` +
      (crown ? `<text x="50" y="${100 - size}" font-size="30" text-anchor="middle">👑</text>` : ''),
  );

const netLife = svg(
  `<path d="M50 84 L18 52 A17 17 0 0 1 50 26 A17 17 0 0 1 82 52 Z" fill="#ff5a5f"/>` +
    `<path d="M50 30 L42 50 L56 58 L48 80" stroke="#0b1220" stroke-width="5" fill="none"/>`,
);

const plate = (fill: string, text = '') =>
  svg(
    `<rect x="46" y="60" width="8" height="34" fill="#555"/><circle cx="50" cy="42" r="34" fill="${fill}" stroke="rgba(0,0,0,.3)" stroke-width="3"/>` +
      (text ? `<text x="50" y="52" font-size="24" font-weight="900" text-anchor="middle" fill="#d62828" font-family="Arial">${text}</text>` : ''),
  );

const zone = (good: boolean) =>
  svg(
    `<ellipse cx="50" cy="62" rx="44" ry="24" fill="${good ? '#06d6a0' : 'none'}" opacity="${good ? 0.5 : 1}" stroke="${good ? '#06d6a0' : '#ff5a5f'}" stroke-width="5"/>` +
      (good
        ? `<circle cx="50" cy="56" r="10" fill="#fff"/>`
        : `<circle cx="84" cy="24" r="10" fill="#fff"/><path d="M30 44 L70 80 M70 44 L30 80" stroke="#ff5a5f" stroke-width="7" stroke-linecap="round"/>`),
  );

const xo = (mark: 'X' | 'O' | 'row') => {
  const grid = `<path d="M37 8 V92 M63 8 V92 M8 37 H92 M8 63 H92" stroke="#9fb0cf" stroke-width="4"/>`;
  if (mark === 'X') return svg(`<path d="M24 24 L76 76 M76 24 L24 76" stroke="#ff5a5f" stroke-width="12" stroke-linecap="round"/>`);
  if (mark === 'O') return svg(`<circle cx="50" cy="50" r="28" fill="none" stroke="#3ff5ff" stroke-width="12"/>`);
  return svg(grid + `<path d="M14 86 L86 14" stroke="#d4f53c" stroke-width="9" stroke-linecap="round"/>`);
};

/** Small dartboard; ring = which band to light up. */
const dartboard = (ring: 'bull' | 'triple' | 'double') => {
  const lit = (r: string) => (ring === r ? '#d4f53c' : '#e63946');
  return svg(
    `<circle cx="50" cy="50" r="46" fill="${lit('double')}"/><circle cx="50" cy="50" r="40" fill="#1b1b1b"/>` +
      `<circle cx="50" cy="50" r="28" fill="${lit('triple')}"/><circle cx="50" cy="50" r="23" fill="#1b1b1b"/>` +
      `<circle cx="50" cy="50" r="9" fill="${lit('bull')}"/>`,
  );
};

/** Two of the game's real cards, side by side. */
const tiles = (match: boolean) => () => {
  const card = (symbol: number, x: number, turn: number) =>
    `<image href="${memoryPicture(symbol)}" x="${x}" y="27" width="60" height="46" transform="rotate(${turn} ${x + 30} 50)"/>`;
  return svg(card(0, -2, -8) + card(match ? 0 : 2, 42, 8));
};

const rings = DEFAULT_RINGS.map((r) => r.points);

const LEGENDS: Record<GameId, LegendItem[]> = {
  bullseye: [
    { art: target(true), label: 'Bullseye', value: `+${rings[0]}`, tone: 'good' },
    { art: target(false), label: 'Outer rings', value: rings.slice(1).map((p) => `+${p}`).join(' '), tone: 'good' },
  ],
  popup: [
    { art: glowDisc('#3ff5ff'), label: 'Hit it fast', value: `Up to +${DEFAULT_POPUP.basePoints}`, tone: 'good' },
    { art: streak(`×${multiplierFor(Infinity)}`), label: 'Hit streak', value: `Up to ×${multiplierFor(Infinity)}`, tone: 'good' },
    { art: bomb, label: 'Red bomb', value: `Avoid −${DEFAULT_POPUP.bombPenalty}`, tone: 'bad' },
  ],
  opencourt: [
    { art: robot(false), label: 'Away from Ben', value: `+${WINNER_POINTS.tight} to +${WINNER_POINTS.unreachable}`, tone: 'good' },
    { art: kitchen, label: 'Drop in kitchen', value: `+${DROP_SHOT_BONUS} bonus`, tone: 'good' },
    { art: robot(true), label: 'Ben reaches it', value: '0', tone: 'bad' },
  ],
  bricks: [
    { art: brick('normal'), label: 'Brick', value: `+${BRICK_POINTS.normal}`, tone: 'good' },
    { art: brick('silver'), label: 'Silver • 2 hits', value: `+${BRICK_POINTS.silver}`, tone: 'good' },
    { art: brick('gold'), label: 'Gold • 3 hits', value: `+${BRICK_POINTS.gold}`, tone: 'good' },
    { art: brick('bomb'), label: 'TNT', value: 'Blasts neighbors', tone: 'good' },
  ],
  zombies: [
    { art: zombie(56), label: 'Zombie', value: `+${ZOMBIE_POINTS.walker}`, tone: 'good' },
    { art: zombie(72), label: 'Brute • 2 hits', value: `+${ZOMBIE_POINTS.brute}`, tone: 'good' },
    { art: zombie(74, true), label: 'Boss • 5 hits', value: `+${ZOMBIE_POINTS.boss}`, tone: 'good' },
    { art: netLife, label: 'Reaches the net', value: '−1 life', tone: 'bad' },
  ],
  gallery: [
    { art: plate('#9aa4b2'), label: 'Steel plate', value: `+${PLATE_POINTS.steel}`, tone: 'good' },
    { art: plate('#ffd23f'), label: 'Gold plate', value: `+${PLATE_POINTS.bonus}`, tone: 'good' },
    { art: plate('#f4f4f4', 'NO'), label: 'No-shoot', value: `Avoid −${Math.abs(PLATE_POINTS.noshoot)}`, tone: 'bad' },
  ],
  rally: [
    { art: zone(true), label: 'Land in the zone', value: `+${POINTS_PER_RETURN}`, tone: 'good' },
    { art: streak(`+${STREAK_BONUS}`), label: 'Keep it going', value: `+${STREAK_BONUS} more each`, tone: 'good' },
    { art: zone(false), label: 'Miss or too slow', value: '−1 life', tone: 'bad' },
  ],
  dunk: [
    { art: dunkTarget('red'), label: 'Red circle', value: `DUNK! +${DUNK_POINTS.dunk}`, tone: 'good' },
    { art: dunkTarget('rim'), label: 'White rim', value: `So close +${DUNK_POINTS.rim}`, tone: 'plain' },
    { art: clownFace, label: 'Hit the clown', value: 'He just laughs', tone: 'bad' },
  ],
  tictactoe: [
    { art: xo('X'), label: 'Player 1', value: 'X', tone: 'plain' },
    { art: xo('O'), label: 'Player 2', value: 'O', tone: 'plain' },
    { art: xo('row'), label: 'Three in a row', value: 'Wins', tone: 'good' },
  ],
  darts: [
    { art: dartboard('bull'), label: 'Bullseye', value: '50', tone: 'good' },
    { art: dartboard('triple'), label: 'Inner ring', value: 'Triple', tone: 'good' },
    { art: dartboard('double'), label: 'Outer ring', value: 'Double', tone: 'good' },
  ],
  memory: [
    { art: tiles(true), label: 'Pair', value: '+1 & go again', tone: 'good' },
    { art: tiles(false), label: 'No match', value: 'Next player', tone: 'bad' },
  ],
};

/** Adds the picture row for a game to the intro card. */
export function howToPlayRow(scope: Scope, parent: HTMLElement, gameId: GameId): void {
  const row = scope.el('div', 'legend', parent);
  for (const item of LEGENDS[gameId]) {
    const cell = scope.el('div', `legend-item ${item.tone}`, row);
    // Static markup from this file only, never player input.
    scope.el('div', 'art', cell).innerHTML = typeof item.art === 'string' ? item.art : item.art();
    scope.el('div', 'what label', cell, item.label);
    scope.el('div', 'worth display', cell, item.value);
  }
}
