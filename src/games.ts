// The game catalog shown on the menu.

export type GameId =
  | 'bullseye'
  | 'popup'
  | 'opencourt'
  | 'bricks'
  | 'zombies'
  | 'gallery'
  | 'rally'
  | 'tictactoe'
  | 'darts'
  | 'memory';

export interface GameInfo {
  id: GameId;
  title: string;
  tagline: string;
  howTo: string;
  accent: string;
  /** Solo games have levels and a leaderboard; party games are turn-based with a winner. */
  mode: 'solo' | 'party';
  /** Player count range for party games. */
  players?: [number, number];
}

export const GAMES: readonly GameInfo[] = [
  {
    id: 'bullseye',
    title: 'BULLSEYE',
    tagline: '5 levels • aim small',
    howTo: 'Hit the center of the target. Bullseye = 50 points.\nReach the target score to unlock the next level.',
    accent: '#e63946',
    mode: 'solo',
  },
  {
    id: 'popup',
    title: 'POP-UP',
    tagline: '5 levels • be quick',
    howTo: 'Targets pop up and shrink. Hit them before they vanish!\nFaster hits score more. Hit streaks multiply points.',
    accent: '#d4f53c',
    mode: 'solo',
  },
  {
    id: 'opencourt',
    title: 'OPEN COURT',
    tagline: '5 levels • beat the robot',
    howTo: 'Place your shot where the opponent can’t reach.\nThe farther from them, the more points. Drop shots into the kitchen earn a bonus!',
    accent: '#ff5a5f',
    mode: 'solo',
  },
  {
    id: 'bricks',
    title: 'BRICK BREAKER',
    tagline: '5 levels • smash the wall',
    howTo: 'Smash the whole wall before your balls run out.\nSilver bricks take 2 hits, gold take 3 — the number shows hits left.\nTNT blows up its neighbors!',
    accent: '#8338ec',
    mode: 'solo',
  },
  {
    id: 'zombies',
    title: 'ZOMBIE COURT',
    tagline: '5 waves • hold the net',
    howTo: 'Zombies are walking to the net. Hit them before they get there!\nEach one that reaches the net costs a life.',
    accent: '#7cff6b',
    mode: 'solo',
  },
  {
    id: 'gallery',
    title: 'FIRING RANGE',
    tagline: '5 levels • ring the steel',
    howTo: 'Hit the steel plates sliding across the range.\nGold bonus plates = 50 points. White NO-SHOOT plates cost points!',
    accent: '#ffb703',
    mode: 'solo',
  },
  {
    id: 'rally',
    title: 'RALLY SURVIVAL',
    tagline: '5 levels • feeder pace',
    howTo: 'Each ball, a zone lights up on the court. Land your shot in it!\nMiss the zone, or don’t hit in time, and you lose a life.',
    accent: '#06d6a0',
    mode: 'solo',
  },
  {
    id: 'tictactoe',
    title: 'TIC-TAC-TOE',
    tagline: '2 players • take turns',
    howTo: 'Take turns hitting a square to claim it.\nGet three in a row to win! Missing the board loses your turn.',
    accent: '#ff5a5f',
    mode: 'party',
    players: [2, 2],
  },
  {
    id: 'darts',
    title: 'PICKLE DARTS',
    tagline: '2–4 players • 301',
    howTo: 'Everyone starts at 301. Three balls per turn.\nFirst to exactly zero wins. Go below zero and your turn doesn’t count!',
    accent: '#d4f53c',
    mode: 'party',
    players: [2, 4],
  },
  {
    id: 'memory',
    title: 'MEMORY MATCH',
    tagline: '2 players • find pairs',
    howTo: 'Hit two tiles to flip them. Find a pair to score and go again.\nNo match? The other player goes.',
    accent: '#c77dff',
    mode: 'party',
    players: [2, 2],
  },
];

export function gameInfo(id: GameId): GameInfo {
  return GAMES.find((g) => g.id === id)!;
}

/** What a finished solo run hands to the game-over screen. */
export interface RoundResult {
  gameId: GameId;
  score: number;
  /** Highest level reached (1-5). */
  level: number;
  /** One line of stats under the score, e.g. "Reached level 3". */
  stats: string;
}
