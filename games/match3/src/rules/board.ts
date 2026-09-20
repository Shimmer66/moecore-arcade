import type { CharacterId } from '@moecore/characters';
import { MINIMUM_RUN_LENGTH, hasImmediateMatch } from './match';
import type { RandomSource } from './random';
import { hasValidSwap, trySwap } from './swap';
import type { Board, Cell, Position } from './types';

export interface BoardConfig {
  readonly rows: number;
  readonly columns: number;
  readonly characterIds: ReadonlyArray<CharacterId>;
}

export interface BoardOptions {
  /**
   * How many fully random boards to try before switching to the constructive
   * builder. `0` forces the constructive path, which tests rely on.
   */
  readonly maxRandomAttempts?: number;
}

export interface BoardStats {
  readonly randomAttempts: number;
  readonly usedConstruction: boolean;
  readonly usedMotif: boolean;
}

export interface BoardCreation {
  readonly board: Board;
  readonly stats: BoardStats;
}

export const DEFAULT_MAX_RANDOM_ATTEMPTS = 32;

const MAX_REPAIR_SWAPS = 64;

function assertConfig(config: BoardConfig): void {
  if (!Number.isSafeInteger(config.rows) || config.rows < 1) {
    throw new RangeError(`rows must be a positive integer, received ${config.rows}`);
  }
  if (!Number.isSafeInteger(config.columns) || config.columns < 1) {
    throw new RangeError(`columns must be a positive integer, received ${config.columns}`);
  }
  if (new Set(config.characterIds).size !== config.characterIds.length) {
    throw new RangeError('characterIds must not contain duplicates');
  }
  if (config.characterIds.length < MINIMUM_RUN_LENGTH) {
    throw new RangeError(
      `characterIds needs at least ${MINIMUM_RUN_LENGTH} entries to avoid forced matches`,
    );
  }
  const longSide = Math.max(config.rows, config.columns);
  const shortSide = Math.min(config.rows, config.columns);
  if (longSide < MINIMUM_RUN_LENGTH || (shortSide === 1 && longSide < 4)) {
    throw new RangeError('board needs at least 2x3, 3x2, 1x4 or 4x1 cells for an effective swap');
  }
}

function pick(characterIds: ReadonlyArray<CharacterId>, random: RandomSource): CharacterId {
  const character = characterIds[random.nextInt(characterIds.length)];
  if (character === undefined) {
    throw new RangeError('characterIds must not be empty');
  }
  return character;
}

function fillRandomly(config: BoardConfig, random: RandomSource): Board {
  return Array.from({ length: config.rows }, () =>
    Array.from({ length: config.columns }, () => pick(config.characterIds, random)),
  );
}

/**
 * Fills cell by cell and never completes a run of three, so the result has no
 * immediate match regardless of the random source. At most two characters are
 * blocked at a cell, and the validated pool contains at least three.
 */
function fillConstructively(config: BoardConfig, random: RandomSource): Board {
  const grid: Cell[][] = Array.from({ length: config.rows }, () =>
    Array.from({ length: config.columns }, () => null as Cell),
  );

  for (const [row, line] of grid.entries()) {
    for (let column = 0; column < config.columns; column += 1) {
      const blocked = new Set<CharacterId>();
      const left = line[column - 1];
      if (left && column >= 2 && line[column - 2] === left) blocked.add(left);
      const above = grid[row - 1]?.[column];
      if (above && row >= 2 && grid[row - 2]?.[column] === above) blocked.add(above);

      const allowed = config.characterIds.filter((character) => !blocked.has(character));
      line[column] = pick(allowed, random);
    }
  }

  return grid;
}

function writeCells(board: Board, writes: ReadonlyArray<readonly [Position, Cell]>): Board {
  return board.map((line, row) =>
    line.map((cell, column) => {
      const write = writes.find(([position]) => position.row === row && position.column === column);
      return write ? write[1] : cell;
    }),
  );
}

/**
 * A three-character cyclic board has no matches. Replacing its top-left corner
 * with `A A B` over `B C A` keeps it match-free and guarantees a vertical swap.
 * A single row uses `A A B A` instead; narrow boards transpose these motifs.
 * assertConfig guarantees the required space and three distinct characters.
 */
function placeGuaranteedSwap(config: BoardConfig): Board {
  const board: Board = Array.from({ length: config.rows }, (_, row) =>
    Array.from({ length: config.columns }, (_, column) => config.characterIds[(row + column) % 3]!),
  );
  const primary = config.characterIds[0]!;
  const secondary = config.characterIds[1]!;
  const horizontal = config.columns >= MINIMUM_RUN_LENGTH;
  const shortSide = horizontal ? config.rows : config.columns;
  const position = (row: number, column: number): Position =>
    horizontal ? { row, column } : { row: column, column: row };

  return writeCells(board, [
    [position(0, 0), primary],
    [position(0, 1), primary],
    [position(0, 2), secondary],
    [shortSide > 1 ? position(1, 2) : position(0, 3), primary],
  ]);
}

function repairSwap(board: Board, config: BoardConfig, random: RandomSource): Board | undefined {
  const from: Position = {
    row: random.nextInt(config.rows),
    column: random.nextInt(config.columns),
  };
  const to: Position =
    random.nextInt(2) === 0
      ? { row: from.row, column: from.column + 1 }
      : { row: from.row + 1, column: from.column };
  const swapped = trySwap(board, from, to);
  if (!swapped || hasImmediateMatch(swapped)) return undefined;
  return swapped;
}

/**
 * Builds a starting board with the two properties the rules depend on: no match
 * is already on the board, and at least one effective swap exists.
 *
 * Random boards rarely satisfy both at once, and retrying forever would hang the
 * game, so attempts are bounded; the fallback builds a compliant board directly
 * and repairs it, which is why `stats` reports how the board was produced.
 */
export function createBoard(
  config: BoardConfig,
  random: RandomSource,
  options?: BoardOptions,
): BoardCreation {
  assertConfig(config);
  const maxRandomAttempts = options?.maxRandomAttempts ?? DEFAULT_MAX_RANDOM_ATTEMPTS;
  if (!Number.isSafeInteger(maxRandomAttempts) || maxRandomAttempts < 0) {
    throw new RangeError('maxRandomAttempts must be a nonnegative safe integer');
  }

  let randomAttempts = 0;
  for (let attempt = 0; attempt < maxRandomAttempts; attempt += 1) {
    randomAttempts += 1;
    const candidate = fillRandomly(config, random);
    if (!hasImmediateMatch(candidate) && hasValidSwap(candidate)) {
      return {
        board: candidate,
        stats: { randomAttempts, usedConstruction: false, usedMotif: false },
      };
    }
  }

  let board = fillConstructively(config, random);
  for (let attempt = 0; attempt < MAX_REPAIR_SWAPS && !hasValidSwap(board); attempt += 1) {
    board = repairSwap(board, config, random) ?? board;
  }

  const usedMotif = !hasValidSwap(board);
  if (usedMotif) board = placeGuaranteedSwap(config);

  return { board, stats: { randomAttempts, usedConstruction: true, usedMotif } };
}
