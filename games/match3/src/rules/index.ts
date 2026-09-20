export type { Board, Cell, Position } from './types';

export type { BoardConfig, BoardCreation, BoardOptions, BoardStats } from './board';
export { DEFAULT_MAX_RANDOM_ATTEMPTS, createBoard } from './board';

export type { MatchRun, Orientation } from './match';
export {
  MINIMUM_RUN_LENGTH,
  findMatchedCells,
  findRuns,
  hasImmediateMatch,
  isMatchedCell,
} from './match';

export type { RandomSource } from './random';
export { createRandomSource } from './random';

export type { SwapCandidate } from './swap';
export {
  enumerateValidSwaps,
  hasValidSwap,
  isAdjacent,
  isEffectiveSwap,
  isInsideBoard,
  trySwap,
} from './swap';
