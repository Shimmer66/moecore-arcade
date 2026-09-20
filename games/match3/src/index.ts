export { prototypeConfig } from './config/prototype';

export type {
  Board,
  BoardConfig,
  BoardCreation,
  BoardOptions,
  BoardStats,
  Cell,
  MatchRun,
  Orientation,
  Position,
  RandomSource,
  SwapCandidate,
} from './rules/index';

export {
  DEFAULT_MAX_RANDOM_ATTEMPTS,
  MINIMUM_RUN_LENGTH,
  createBoard,
  createRandomSource,
  enumerateValidSwaps,
  findMatchedCells,
  findRuns,
  hasImmediateMatch,
  hasValidSwap,
  isAdjacent,
  isEffectiveSwap,
  isInsideBoard,
  isMatchedCell,
  trySwap,
} from './rules/index';
