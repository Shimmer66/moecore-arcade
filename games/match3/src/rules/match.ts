import type { Board, Cell, Position } from './types';

export type Orientation = 'horizontal' | 'vertical';

/** A match needs three identical pieces in a row or column. */
export const MINIMUM_RUN_LENGTH = 3;

/** One maximal horizontal or vertical run of identical pieces. */
export interface MatchRun {
  readonly orientation: Orientation;
  readonly character: NonNullable<Cell>;
  readonly cells: ReadonlyArray<Position>;
}

function cellsOf(orientation: Orientation, row: number, column: number, length: number) {
  const cells: Position[] = [];
  for (let offset = 0; offset < length; offset += 1) {
    cells.push(
      orientation === 'horizontal'
        ? { row, column: column + offset }
        : { row: row + offset, column },
    );
  }
  return cells;
}

function collectRuns(
  board: Board,
  orientation: Orientation,
  lines: number,
  columns: number,
): MatchRun[] {
  const runs: MatchRun[] = [];
  for (let line = 0; line < lines; line += 1) {
    let start = 0;
    while (start < columns) {
      const at = (offset: number) =>
        orientation === 'horizontal'
          ? (board[line]?.[offset] ?? null)
          : (board[offset]?.[line] ?? null);
      const character = at(start);
      let end = start;
      while (end < columns && at(end) === character) end += 1;
      if (character !== null && end - start >= MINIMUM_RUN_LENGTH) {
        const row = orientation === 'horizontal' ? line : start;
        const column = orientation === 'horizontal' ? start : line;
        runs.push({
          orientation,
          character,
          cells: cellsOf(orientation, row, column, end - start),
        });
      }
      start = end;
    }
  }
  return runs;
}

/** Every horizontal and vertical run of at least three identical pieces. */
export function findRuns(board: Board): ReadonlyArray<MatchRun> {
  const rows = board.length;
  const columns = board.reduce((width, line) => Math.max(width, line.length), 0);
  return [
    ...collectRuns(board, 'horizontal', rows, columns),
    ...collectRuns(board, 'vertical', columns, rows),
  ];
}

/**
 * Cells removed by the current board state, sorted by row then column.
 * A cell shared by a horizontal and a vertical run appears exactly once.
 */
export function findMatchedCells(board: Board): ReadonlyArray<Position> {
  const seen = new Set<string>();
  const cells: Position[] = [];
  for (const run of findRuns(board)) {
    for (const cell of run.cells) {
      const key = `${cell.row}:${cell.column}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push(cell);
    }
  }
  return cells.sort((left, right) => left.row - right.row || left.column - right.column);
}

export function isMatchedCell(board: Board, position: Position): boolean {
  return findMatchedCells(board).some(
    (cell) => cell.row === position.row && cell.column === position.column,
  );
}

/** True when the board already holds a match, which a fresh board must never do. */
export function hasImmediateMatch(board: Board): boolean {
  return findMatchedCells(board).length > 0;
}
