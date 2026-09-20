import { describe, expect, it } from 'vitest';
import { findMatchedCells, findRuns, hasImmediateMatch, isMatchedCell } from '../src/index';
import type { Board } from '../src/index';

const D = 'deepseek';
const G = 'glm';
const K = 'kimi';

// 交叉棋形：第一行的横向三连与第二列的纵向三连共用 (0, 1)。
const crossing: Board = [
  [D, D, D, G],
  [G, D, G, G],
  [K, D, K, K],
];

describe('match3 match detection', () => {
  it('finds the horizontal and vertical runs of a crossing match', () => {
    const runs = findRuns(crossing);
    expect(runs.map((run) => run.orientation).sort()).toEqual(['horizontal', 'vertical']);

    const horizontal = runs.find((run) => run.orientation === 'horizontal');
    expect(horizontal?.character).toBe(D);
    expect(horizontal?.cells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
    ]);
  });

  it('counts a crossing cell exactly once', () => {
    const cells = findMatchedCells(crossing);
    expect(cells).toHaveLength(5);
    expect(new Set(cells.map((cell) => `${cell.row}:${cell.column}`)).size).toBe(5);
    expect(cells).toEqual([
      { row: 0, column: 0 },
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 1 },
      { row: 2, column: 1 },
    ]);
  });

  it('reports single cells rather than whole runs for removal checks', () => {
    expect(isMatchedCell(crossing, { row: 0, column: 1 })).toBe(true);
    expect(isMatchedCell(crossing, { row: 2, column: 1 })).toBe(true);
    expect(isMatchedCell(crossing, { row: 0, column: 3 })).toBe(false);
    expect(isMatchedCell(crossing, { row: 2, column: 0 })).toBe(false);
  });

  it('ignores pairs and reports a run of four as one run', () => {
    const quiet: Board[] = [
      [
        [D, D, G, G],
        [D, G, K, K],
      ],
      [
        [D, D],
        [D, G],
      ],
    ];
    for (const board of quiet) {
      expect(hasImmediateMatch(board)).toBe(false);
    }

    const four: Board = [[D, D, D, D]];
    const runs = findRuns(four);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.cells).toHaveLength(4);
    expect(findMatchedCells(four)).toHaveLength(4);
  });

  it('treats an empty board as match free', () => {
    expect(hasImmediateMatch([])).toBe(false);
    expect(findRuns([])).toEqual([]);
    expect(findMatchedCells([[], []])).toEqual([]);
  });

  it('finds runs beyond the width of the first row on a ragged board', () => {
    const board: Board = [[], [D, D, D], [G, D], [K, D]];
    expect(findRuns(board)).toHaveLength(2);
    expect(findMatchedCells(board)).toEqual([
      { row: 1, column: 0 },
      { row: 1, column: 1 },
      { row: 1, column: 2 },
      { row: 2, column: 1 },
      { row: 3, column: 1 },
    ]);
  });

  it('does not match through empty cells or missing cells', () => {
    for (const board of [
      [[D, D, null, D]],
      [[D], [], [D], [D]],
      [[D], [null], [D], [D]],
      [[null, null, null]],
    ] satisfies Board[]) {
      expect(findRuns(board)).toEqual([]);
    }
  });

  it('reports a long run in a single column as one maximal run', () => {
    const runs = findRuns([[D], [D], [D], [D], [D]]);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.orientation).toBe('vertical');
    expect(runs[0]?.cells).toHaveLength(5);
  });

  it('rejects invalid positions in membership queries', () => {
    for (const position of [
      { row: -1, column: 1 },
      { row: 0, column: 4 },
      { row: 0.5, column: 1 },
      { row: 0, column: NaN },
      { row: Infinity, column: 1 },
    ]) {
      expect(isMatchedCell(crossing, position)).toBe(false);
    }
  });
});
