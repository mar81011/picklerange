import { describe, expect, it } from 'vitest';
import { createGame, isOver, play, type TicTacToeState } from './logic';

function moves(...indexes: (number | null)[]): TicTacToeState {
  return indexes.reduce<TicTacToeState>((s, i) => play(s, i).state, createGame());
}

describe('tic-tac-toe', () => {
  it('claims a free square and passes the turn', () => {
    const { state, result } = play(createGame(), 4);
    expect(result).toBe('claimed');
    expect(state.board[4]).toBe(0);
    expect(state.turn).toBe(1);
  });

  it('loses the turn on a miss or an already-claimed square', () => {
    expect(play(createGame(), null)).toMatchObject({ result: 'miss', state: { turn: 1 } });
    const s = moves(4);
    expect(play(s, 4)).toMatchObject({ result: 'taken', state: { turn: 0 } });
    expect(play(s, 4).state.board[4]).toBe(0);
  });

  it('detects a row, column and diagonal win', () => {
    expect(moves(0, 3, 1, 4, 2)).toMatchObject({ winner: 0, line: [0, 1, 2] });
    expect(moves(0, 1, 3, 2, 6)).toMatchObject({ winner: 0, line: [0, 3, 6] });
    expect(moves(1, 0, 2, 4, 3, 8)).toMatchObject({ winner: 1, line: [0, 4, 8] });
  });

  it('calls a full board with no line a draw', () => {
    const s = moves(0, 1, 2, 4, 3, 5, 7, 6, 8);
    expect(s.draw).toBe(true);
    expect(s.winner).toBeNull();
    expect(isOver(s)).toBe(true);
  });

  it('ignores shots after the game is over', () => {
    const won = moves(0, 3, 1, 4, 2);
    expect(play(won, 8).state).toBe(won);
  });
});
