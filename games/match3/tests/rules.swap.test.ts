import { describe, expect, it } from 'vitest';
import {
  enumerateValidSwaps,
  hasValidSwap,
  isAdjacent,
  isEffectiveSwap,
  isInsideBoard,
  trySwap,
} from '../src/index';
import type { Board } from '../src/index';

const D = 'deepseek';
const G = 'glm';
const K = 'kimi';

// 该棋盘本身无匹配，且恰好有两个有效交换，两个都落在被交换的格子上：
//   (1, 0) K ↔ (1, 1) D  → 第一列 D D D
//   (2, 0) D ↔ (2, 1) G  → 第二列 D D D
const oneSwap: Board = [
  [D, D, G],
  [K, D, K],
  [D, G, G],
];

describe('match3 swaps', () => {
  it('accepts orthogonal neighbours only', () => {
    expect(isAdjacent({ row: 0, column: 0 }, { row: 0, column: 1 })).toBe(true);
    expect(isAdjacent({ row: 2, column: 1 }, { row: 1, column: 1 })).toBe(true);
    expect(isAdjacent({ row: 0, column: 0 }, { row: 1, column: 1 })).toBe(false);
    expect(isAdjacent({ row: 0, column: 0 }, { row: 0, column: 2 })).toBe(false);
    expect(isAdjacent({ row: 0, column: 0 }, { row: 0, column: 0 })).toBe(false);
    expect(isAdjacent({ row: 0.5, column: 0 }, { row: 0.5, column: 1 })).toBe(false);
    expect(isAdjacent({ row: 0, column: 0 }, { row: 0.5, column: 0.5 })).toBe(false);
  });

  it('returns a new board for a legal move and refuses the rest', () => {
    const swapped = trySwap(oneSwap, { row: 1, column: 0 }, { row: 2, column: 0 });
    expect(swapped?.[1]?.[0]).toBe(D);
    expect(swapped?.[2]?.[0]).toBe(K);

    expect(trySwap(oneSwap, { row: 0, column: 0 }, { row: 1, column: 1 })).toBeUndefined();
    expect(trySwap(oneSwap, { row: 0, column: 0 }, { row: 2, column: 0 })).toBeUndefined();
    expect(trySwap(oneSwap, { row: 0, column: 0 }, { row: 0, column: 3 })).toBeUndefined();
    expect(trySwap(oneSwap, { row: -1, column: 0 }, { row: 0, column: 0 })).toBeUndefined();
    expect(trySwap(oneSwap, { row: 0, column: 0 }, { row: 0, column: 0 })).toBeUndefined();
  });

  it('never mutates the board it was given', () => {
    const before = structuredClone(oneSwap);
    trySwap(oneSwap, { row: 1, column: 0 }, { row: 2, column: 0 });
    expect(oneSwap).toEqual(before);
  });

  it('counts a swap as effective only when it matches on a swapped cell', () => {
    expect(isEffectiveSwap(oneSwap, { row: 1, column: 0 }, { row: 1, column: 1 })).toBe(true);
    expect(isEffectiveSwap(oneSwap, { row: 1, column: 1 }, { row: 1, column: 0 })).toBe(true);
    expect(isEffectiveSwap(oneSwap, { row: 2, column: 0 }, { row: 2, column: 1 })).toBe(true);

    // 交换两个相同的棋子不改变棋盘，因此不构成有效交换。
    expect(isEffectiveSwap(oneSwap, { row: 0, column: 0 }, { row: 0, column: 1 })).toBe(false);
    expect(isEffectiveSwap(oneSwap, { row: 1, column: 0 }, { row: 2, column: 0 })).toBe(false);
    expect(isEffectiveSwap(oneSwap, { row: 0, column: 0 }, { row: 1, column: 1 })).toBe(false);
  });

  it('enumerates every neighbour pair once', () => {
    const candidates = enumerateValidSwaps(oneSwap);
    expect(candidates).toEqual([
      { from: { row: 1, column: 0 }, to: { row: 1, column: 1 } },
      { from: { row: 2, column: 0 }, to: { row: 2, column: 1 } },
    ]);

    for (const { from, to } of candidates) {
      const ordered = from.row < to.row || (from.row === to.row && from.column < to.column);
      expect(ordered).toBe(true);
      expect(isAdjacent(from, to)).toBe(true);
    }
  });

  it('reports no available move on a board that cannot match', () => {
    expect(enumerateValidSwaps([[D, G]])).toEqual([]);
    expect(hasValidSwap([[D, G]])).toBe(false);
    expect(hasValidSwap(oneSwap)).toBe(true);
  });

  it('rejects fractional and nonfinite coordinates at both endpoints', () => {
    for (const invalid of [
      { row: 0.5, column: 0.5 },
      { row: 0, column: 1.5 },
      { row: NaN, column: 0 },
      { row: 0, column: Infinity },
    ]) {
      const valid = { row: 0, column: 0 };
      expect(isInsideBoard(oneSwap, invalid)).toBe(false);
      expect(trySwap(oneSwap, valid, invalid)).toBeUndefined();
      expect(trySwap(oneSwap, invalid, valid)).toBeUndefined();
      expect(isEffectiveSwap(oneSwap, valid, invalid)).toBe(false);
    }
  });

  it('uses actual row bounds for ragged boards', () => {
    const shortRow: Board = [[D, G], [K]];
    expect(isInsideBoard(shortRow, { row: 1, column: 1 })).toBe(false);
    expect(trySwap(shortRow, { row: 1, column: 0 }, { row: 1, column: 1 })).toBeUndefined();
    expect(trySwap(shortRow, { row: 0, column: 1 }, { row: 1, column: 1 })).toBeUndefined();
    expect(shortRow).toEqual([[D, G], [K]]);

    const wideRow: Board = [[], [D, D, G, D]];
    expect(isInsideBoard(wideRow, { row: 1, column: 3 })).toBe(true);
    expect(enumerateValidSwaps(wideRow)).toEqual([
      { from: { row: 1, column: 2 }, to: { row: 1, column: 3 } },
    ]);
  });

  it('does not count existing matches, identical pieces or empty cells as effective swaps', () => {
    expect(isEffectiveSwap([[D, D, D]], { row: 0, column: 0 }, { row: 0, column: 1 })).toBe(false);
    expect(isEffectiveSwap([[D, D, D, G, K]], { row: 0, column: 3 }, { row: 0, column: 4 })).toBe(
      false,
    );
    expect(isEffectiveSwap([[D, D, null, D]], { row: 0, column: 2 }, { row: 0, column: 3 })).toBe(
      false,
    );
    expect(isEffectiveSwap([[D, D, D, G, D]], { row: 0, column: 3 }, { row: 0, column: 4 })).toBe(
      true,
    );
  });

  it('handles empty boards and enumerates single-column swaps once', () => {
    for (const board of [[], [[]], [[], []]]) {
      expect(enumerateValidSwaps(board)).toEqual([]);
      expect(trySwap(board, { row: 0, column: 0 }, { row: 0, column: 1 })).toBeUndefined();
    }
    expect(enumerateValidSwaps([[D], [D], [G], [D]])).toEqual([
      { from: { row: 2, column: 0 }, to: { row: 3, column: 0 } },
    ]);
  });
});
