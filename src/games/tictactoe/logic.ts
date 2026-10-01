// Tic-Tac-Toe for two players taking turns. Hitting a free square claims it;
// a ball that misses every free square loses the turn.

export type Mark = 0 | 1;
export type Cell = Mark | null;

export interface TicTacToeState {
  board: readonly Cell[];
  turn: Mark;
  winner: Mark | null;
  /** The three winning squares, for highlighting. */
  line: readonly number[] | null;
  draw: boolean;
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function createGame(first: Mark = 0): TicTacToeState {
  return { board: Array(9).fill(null), turn: first, winner: null, line: null, draw: false };
}

export function isOver(state: TicTacToeState): boolean {
  return state.winner !== null || state.draw;
}

export type MoveResult = 'claimed' | 'taken' | 'miss';

/**
 * Plays a shot that hit square `index` (0-8, row by row), or null for a miss.
 * Hitting an already-claimed square also loses the turn.
 */
export function play(state: TicTacToeState, index: number | null): { state: TicTacToeState; result: MoveResult } {
  if (isOver(state)) return { state, result: 'miss' };
  const other: Mark = state.turn === 0 ? 1 : 0;
  if (index === null) return { state: { ...state, turn: other }, result: 'miss' };
  if (state.board[index] !== null) return { state: { ...state, turn: other }, result: 'taken' };

  const board = state.board.slice();
  board[index] = state.turn;
  const line = LINES.find((l) => l.every((i) => board[i] === state.turn)) ?? null;
  const draw = !line && board.every((c) => c !== null);
  return {
    state: { board, turn: line || draw ? state.turn : other, winner: line ? state.turn : null, line, draw },
    result: 'claimed',
  };
}
