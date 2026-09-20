import type { CharacterId } from '@moecore/characters';
import { createBoard, type BoardConfig } from './board';
import { findMatchedCells } from './match';
import type { RandomSource } from './random';
import { hasValidSwap, isEffectiveSwap, trySwap } from './swap';
import type { Board, Position } from './types';

export interface Level extends BoardConfig {
  readonly moves: number;
  readonly goals: ReadonlyArray<{ readonly character: CharacterId; readonly count: number }>;
}

export interface Match3State {
  readonly board: Board;
  readonly movesRemaining: number;
  readonly collected: Readonly<Partial<Record<CharacterId, number>>>;
  readonly cleared: number;
  readonly turns: number;
  readonly outcome: 'playing' | 'win' | 'lose';
}

export interface CascadeFrame {
  readonly board: Board;
  readonly matches: ReadonlyArray<Position>;
}

export interface MoveResult {
  readonly accepted: boolean;
  readonly state: Match3State;
  readonly frames: ReadonlyArray<CascadeFrame>;
  readonly rebuilt: boolean;
}

export const MAX_CASCADES = 32;

export function startSession(level: Level, random: RandomSource): Match3State {
  if (!Number.isSafeInteger(level.moves) || level.moves < 1 || level.goals.length === 0) {
    throw new RangeError('A level needs a positive move budget and collection goals.');
  }
  for (const goal of level.goals) {
    if (
      !level.characterIds.includes(goal.character) ||
      !Number.isSafeInteger(goal.count) ||
      goal.count < 1
    ) {
      throw new RangeError('Collection goals must use the character pool and positive counts.');
    }
  }
  return {
    board: createBoard(level, random, { maxRandomAttempts: 0 }).board,
    movesRemaining: level.moves,
    collected: {},
    cleared: 0,
    turns: 0,
    outcome: 'playing',
  };
}

export function collapseAndFill(
  board: Board,
  matches: ReadonlyArray<Position>,
  level: BoardConfig,
  random: RandomSource,
): Board {
  const removed = new Set(matches.map(({ row, column }) => `${row}:${column}`));
  const next = Array.from({ length: level.rows }, () => Array<CharacterId>(level.columns));
  for (let column = 0; column < level.columns; column += 1) {
    const remaining: CharacterId[] = [];
    for (let row = 0; row < level.rows; row += 1) {
      const cell = board[row]?.[column];
      if (cell && !removed.has(`${row}:${column}`)) remaining.push(cell);
    }
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const character =
        remaining.pop() ?? level.characterIds[random.nextInt(level.characterIds.length)];
      if (!character) throw new RangeError('Random source returned an invalid character index.');
      next[row]![column] = character;
    }
  }
  return next;
}

export function playMove(
  state: Match3State,
  from: Position,
  to: Position,
  level: Level,
  random: RandomSource,
): MoveResult {
  if (
    state.outcome !== 'playing' ||
    state.movesRemaining <= 0 ||
    !isEffectiveSwap(state.board, from, to)
  ) {
    return { accepted: false, state, frames: [], rebuilt: false };
  }

  let board = trySwap(state.board, from, to)!;
  const collected = { ...state.collected };
  const frames: CascadeFrame[] = [];
  let cleared = state.cleared;
  let rebuilt = false;

  // Resolve the whole turn independently of rendering, with bounded random cascades.
  for (let cascade = 0; cascade < MAX_CASCADES; cascade += 1) {
    const matches = findMatchedCells(board);
    if (matches.length === 0) break;
    frames.push({ board, matches });
    for (const { row, column } of matches) {
      const character = board[row]![column]!;
      collected[character] = (collected[character] ?? 0) + 1;
    }
    cleared += matches.length;
    board = collapseAndFill(board, matches, level, random);
  }

  const movesRemaining = state.movesRemaining - 1;
  const won = level.goals.every((goal) => (collected[goal.character] ?? 0) >= goal.count);
  const outcome = won ? 'win' : movesRemaining === 0 ? 'lose' : 'playing';
  if (findMatchedCells(board).length > 0 || (outcome === 'playing' && !hasValidSwap(board))) {
    board = createBoard(level, random, { maxRandomAttempts: 0 }).board;
    rebuilt = true;
  }

  return {
    accepted: true,
    state: { board, movesRemaining, collected, cleared, turns: state.turns + 1, outcome },
    frames,
    rebuilt,
  };
}
