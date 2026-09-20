import { findMatchedCells } from './match';
import type { Board, Cell, Position } from './types';

export interface SwapCandidate {
  readonly from: Position;
  readonly to: Position;
}

/** Orthogonal neighbours only; diagonal and identical positions are not adjacent. */
export function isAdjacent(left: Position, right: Position): boolean {
  return (
    Number.isInteger(left.row) &&
    Number.isInteger(left.column) &&
    Number.isInteger(right.row) &&
    Number.isInteger(right.column) &&
    Math.abs(left.row - right.row) + Math.abs(left.column - right.column) === 1
  );
}

export function isInsideBoard(board: Board, position: Position): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.column) &&
    position.row >= 0 &&
    position.row < board.length &&
    position.column >= 0 &&
    board[position.row]?.[position.column] !== undefined
  );
}

/**
 * Exchanges two adjacent cells and returns a new board.
 * Illegal moves (non-adjacent, diagonal, outside the board) return `undefined`
 * instead of throwing, because callers stop a drag on user input all the time.
 * The input board is never modified.
 */
export function trySwap(board: Board, from: Position, to: Position): Board | undefined {
  if (!isInsideBoard(board, from) || !isInsideBoard(board, to) || !isAdjacent(from, to)) {
    return undefined;
  }
  const fromCell = board[from.row]?.[from.column] ?? null;
  const toCell = board[to.row]?.[to.column] ?? null;

  const replace = (cell: Cell, row: number, column: number): Cell => {
    if (row === from.row && column === from.column) return toCell;
    if (row === to.row && column === to.column) return fromCell;
    return cell;
  };

  return board.map((line, row) => line.map((cell, column) => replace(cell, row, column)));
}

/**
 * Two different, nonempty pieces must create a match on a swapped cell.
 * An unchanged match elsewhere on the board cannot make a swap effective.
 */
export function isEffectiveSwap(board: Board, from: Position, to: Position): boolean {
  const fromCell = board[from.row]?.[from.column] ?? null;
  const toCell = board[to.row]?.[to.column] ?? null;
  if (fromCell === null || toCell === null || fromCell === toCell) return false;
  const swapped = trySwap(board, from, to);
  if (!swapped) return false;
  return findMatchedCells(swapped).some(
    (cell) =>
      (cell.row === from.row && cell.column === from.column) ||
      (cell.row === to.row && cell.column === to.column),
  );
}

/**
 * Every effective swap currently available, scanning right and down so each
 * unordered pair of neighbours is reported once. An empty result means the board
 * must be reshuffled.
 */
export function enumerateValidSwaps(board: Board): ReadonlyArray<SwapCandidate> {
  const candidates: SwapCandidate[] = [];
  const rows = board.length;

  for (let row = 0; row < rows; row += 1) {
    const columns = board[row]?.length ?? 0;
    for (let column = 0; column < columns; column += 1) {
      const from: Position = { row, column };
      const right: Position = { row, column: column + 1 };
      if (column + 1 < columns && isEffectiveSwap(board, from, right)) {
        candidates.push({ from, to: right });
      }
      const below: Position = { row: row + 1, column };
      if (row + 1 < rows && isEffectiveSwap(board, from, below)) {
        candidates.push({ from, to: below });
      }
    }
  }

  return candidates;
}

export function hasValidSwap(board: Board): boolean {
  return enumerateValidSwaps(board).length > 0;
}
