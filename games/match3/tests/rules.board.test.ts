import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MAX_RANDOM_ATTEMPTS,
  createBoard,
  createRandomSource,
  hasImmediateMatch,
  hasValidSwap,
} from '../src/index';
import { prototypeConfig } from '../src/index';
import type { Board, BoardConfig, RandomSource } from '../src/index';

const config: BoardConfig = {
  rows: prototypeConfig.rows,
  columns: prototypeConfig.columns,
  characterIds: prototypeConfig.characterIds,
};

function expectPlayable(board: Board, expected: BoardConfig = config): void {
  expect(board).toHaveLength(expected.rows);
  for (const line of board) {
    expect(line).toHaveLength(expected.columns);
    for (const cell of line) expect(expected.characterIds).toContain(cell);
  }
  expect(hasImmediateMatch(board)).toBe(false);
  expect(hasValidSwap(board)).toBe(true);
}

describe('match3 board creation', () => {
  it('keeps 1000 default seeds match-free and playable', () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const { board, stats } = createBoard(config, createRandomSource(seed));
      expect(stats.randomAttempts).toBeGreaterThan(0);
      expect(stats.randomAttempts).toBeLessThanOrEqual(DEFAULT_MAX_RANDOM_ATTEMPTS);
      expectPlayable(board);
    }
  });

  it('keeps 1000 forced-construction seeds match-free and playable', () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const { board, stats } = createBoard(config, createRandomSource(seed), {
        maxRandomAttempts: 0,
      });
      expect(stats.randomAttempts).toBe(0);
      expect(stats.usedConstruction).toBe(true);
      expectPlayable(board);
    }
  });

  it('is reproducible for one seed and differs for another', () => {
    const first = createBoard(config, createRandomSource('level-1')).board;
    const second = createBoard(config, createRandomSource('level-1')).board;
    const other = createBoard(config, createRandomSource('level-2')).board;
    expect(first).toEqual(second);
    expect(first).not.toEqual(other);
  });

  it('only places declared characters', () => {
    const allowed = new Set(prototypeConfig.characterIds);
    for (const line of createBoard(config, createRandomSource('chars')).board) {
      for (const cell of line) {
        expect(cell === null ? false : allowed.has(cell)).toBe(true);
      }
    }
  });

  it('rejects configurations that cannot produce a playable board', () => {
    expect(() =>
      createBoard(
        { rows: 8, columns: 8, characterIds: ['deepseek', 'glm'] },
        createRandomSource(1),
      ),
    ).toThrow(RangeError);
    expect(() =>
      createBoard(
        { rows: 8, columns: 8, characterIds: ['deepseek', 'deepseek', 'glm'] },
        createRandomSource(1),
      ),
    ).toThrow(RangeError);
    expect(() => createBoard({ ...config, rows: 0 }, createRandomSource(1))).toThrow(RangeError);
    expect(() => createBoard({ ...config, columns: 2.5 }, createRandomSource(1))).toThrow(
      RangeError,
    );
  });

  it.each([
    [1, 1],
    [1, 2],
    [1, 3],
    [2, 1],
    [2, 2],
    [3, 1],
  ])('rejects impossible dimensions %ix%i', (rows, columns) => {
    expect(() => createBoard({ ...config, rows, columns }, createRandomSource(1))).toThrow(
      RangeError,
    );
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid random-attempt limits: %s',
    (maxRandomAttempts) => {
      expect(() => createBoard(config, createRandomSource(1), { maxRandomAttempts })).toThrow(
        RangeError,
      );
    },
  );

  it('bounds random retries even when the source always draws zero', () => {
    const random: RandomSource = { next: () => 0, nextInt: () => 0 };
    const { board, stats } = createBoard(config, random);
    expect(stats.randomAttempts).toBe(DEFAULT_MAX_RANDOM_ATTEMPTS);
    expect(stats.usedConstruction).toBe(true);
    expectPlayable(board);
  });

  it.each([
    [2, 3],
    [3, 2],
    [1, 4],
    [4, 1],
    [1, 8],
    [8, 1],
    [8, 8],
  ])('guarantees a playable motif on %ix%i when repair makes no progress', (rows, columns) => {
    const smallPool: BoardConfig = {
      rows,
      columns,
      characterIds: ['deepseek', 'glm', 'kimi'],
    };
    const deadBoard = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: columns }, (_, column) => smallPool.characterIds[(row + column) % 3]!),
    );
    expect(hasImmediateMatch(deadBoard)).toBe(false);
    expect(hasValidSwap(deadBoard)).toBe(false);

    // Fill a cyclic dead board, then select the bottom-right cell for every repair.
    let draws = 0;
    const random: RandomSource = {
      next: () => 0,
      nextInt: (maxExclusive) => {
        const index = draws++;
        if (index >= rows * columns) return maxExclusive - 1;
        return (Math.floor(index / columns) + (index % columns)) % 3;
      },
    };
    const { board, stats } = createBoard(smallPool, random, { maxRandomAttempts: 0 });
    expect(stats).toEqual({ randomAttempts: 0, usedConstruction: true, usedMotif: true });
    expectPlayable(board, smallPool);
  });

  it.each([
    [1, 4],
    [4, 1],
    [2, 3],
    [3, 2],
    [2, 8],
    [8, 2],
    [3, 3],
  ])('supports narrow boards %ix%i on both generation paths', (rows, columns) => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const narrow = { ...config, rows, columns, characterIds: config.characterIds.slice(0, 3) };
      for (const maxRandomAttempts of [0, DEFAULT_MAX_RANDOM_ATTEMPTS]) {
        const { board } = createBoard(narrow, createRandomSource(seed), { maxRandomAttempts });
        expectPlayable(board, narrow);
      }
    }
  });
});
