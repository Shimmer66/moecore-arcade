import { describe, expect, it } from 'vitest';
import {
  collapseAndFill,
  createRandomSource,
  findMatchedCells,
  hasValidSwap,
  MAX_CASCADES,
  playMove,
  startSession,
  type Level,
  type Match3State,
  type Board,
} from '../src/rules';

const level: Level = {
  rows: 3,
  columns: 3,
  characterIds: ['deepseek', 'gpt', 'kimi'],
  moves: 20,
  goals: [{ character: 'deepseek', count: 3 }],
};
const board: Board = [
  ['deepseek', 'gpt', 'deepseek'],
  ['gpt', 'deepseek', 'kimi'],
  ['kimi', 'gpt', 'kimi'],
];
const from = { row: 0, column: 1 };
const to = { row: 1, column: 1 };
function fixture(overrides: Partial<Match3State> = {}): Match3State {
  return {
    board,
    movesRemaining: 20,
    collected: {},
    cleared: 0,
    turns: 0,
    outcome: 'playing',
    ...overrides,
  };
}

describe('match3 turn lifecycle', () => {
  it('starts without matches and with a legal move', () => {
    const state = startSession(level, createRandomSource(1));
    expect(findMatchedCells(state.board)).toHaveLength(0);
    expect(hasValidSwap(state.board)).toBe(true);
    expect(state.movesRemaining).toBe(20);
  });

  it('rejects invalid level budgets and unreachable goals', () => {
    expect(() => startSession({ ...level, moves: 0 }, createRandomSource(1))).toThrow();
    expect(() =>
      startSession({ ...level, goals: [{ character: 'claude', count: 3 }] }, createRandomSource(1)),
    ).toThrow();
  });

  it('does not spend a move or consume randomness for a rejected exchange', () => {
    const state = fixture();
    const random = {
      next: () => {
        throw new Error('No random draw expected');
      },
      nextInt: () => {
        throw new Error('No random draw expected');
      },
    };
    const result = playMove(state, { row: 0, column: 0 }, { row: 2, column: 2 }, level, random);
    expect(result.accepted).toBe(false);
    expect(result.state).toBe(state);
    expect(result.frames).toHaveLength(0);
  });

  it('resolves a cascade as one move, without mutating the previous state', () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const result = playMove(state, from, to, level, createRandomSource(4));
    expect(result.accepted).toBe(true);
    expect(result.state.movesRemaining).toBe(19);
    expect(result.state.turns).toBe(1);
    expect(result.state.collected.deepseek).toBeGreaterThanOrEqual(3);
    expect(result.state.cleared).toBe(
      result.frames.reduce((total, frame) => total + frame.matches.length, 0),
    );
    expect(JSON.stringify(state)).toBe(before);
  });

  it('awards a win before checking the exhausted final move', () => {
    const result = playMove(fixture({ movesRemaining: 1 }), from, to, level, createRandomSource(4));
    expect(result.state.movesRemaining).toBe(0);
    expect(result.state.outcome).toBe('win');
  });

  it('loses when the final turn fails the collection target', () => {
    const hard = { ...level, goals: [{ character: 'deepseek' as const, count: 100_000 }] };
    const result = playMove(fixture({ movesRemaining: 1 }), from, to, hard, createRandomSource(4));
    expect(result.state.outcome).toBe('lose');
    expect(playMove(result.state, from, to, hard, createRandomSource(1)).accepted).toBe(false);
  });

  it('keeps surviving pieces in column order when filling holes', () => {
    const result = collapseAndFill(
      board,
      [
        { row: 0, column: 1 },
        { row: 1, column: 1 },
      ],
      level,
      {
        next: () => 0,
        nextInt: () => 0,
      },
    );
    expect(result.map((row) => row[1])).toEqual(['deepseek', 'deepseek', 'gpt']);
    expect(result.map((row) => row[0])).toEqual(board.map((row) => row[0]));
  });

  it('bounds repeated cascades and rebuilds without granting extra collection', () => {
    const hard: Level = { ...level, goals: [{ character: 'deepseek', count: 100_000 }] };
    const result = playMove(fixture(), from, to, hard, { next: () => 0, nextInt: () => 0 });
    expect(result.frames).toHaveLength(MAX_CASCADES);
    expect(result.rebuilt).toBe(true);
    expect(result.state.movesRemaining).toBe(19);
    expect(result.state.outcome).toBe('playing');
    expect(result.state.cleared).toBe(
      result.frames.reduce((total, frame) => total + frame.matches.length, 0),
    );
    expect(findMatchedCells(result.state.board)).toHaveLength(0);
    expect(hasValidSwap(result.state.board)).toBe(true);
  });

  it('counts crossing matched cells once in the first cascade', () => {
    const crossLevel: Level = { ...level, rows: 5, columns: 5 };
    const cross: Board = [
      ['gpt', 'kimi', 'deepseek', 'gpt', 'kimi'],
      ['kimi', 'gpt', 'deepseek', 'kimi', 'gpt'],
      ['deepseek', 'deepseek', 'gpt', 'deepseek', 'deepseek'],
      ['kimi', 'gpt', 'deepseek', 'kimi', 'gpt'],
      ['gpt', 'kimi', 'deepseek', 'gpt', 'kimi'],
    ];
    const result = playMove(
      fixture({ board: cross }),
      { row: 2, column: 2 },
      { row: 3, column: 2 },
      crossLevel,
      createRandomSource(1),
    );
    expect(result.frames[0]?.matches).toHaveLength(7);
  });
});
