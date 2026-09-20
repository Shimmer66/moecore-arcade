export * from './config/constants';
export { classifyObstacle, intersects, playerBox } from './rules/collision';
export { scoreAtDistance, speedAtDistance } from './rules/difficulty';
export { createGenerator, generateObstacles, obstacleBox } from './rules/obstacles';
export { createPlayer, stepPlayer } from './rules/player';
export { createRandom, nextRandom } from './rules/random';
export { restart, start, step } from './rules/run';
export type {
  Box,
  EndReason,
  GeneratorState,
  Obstacle,
  ObstacleKind,
  ObstacleOutcome,
  PlayerFrame,
  PlayerInput,
  PlayerState,
  RunEvent,
  RunResult,
  RunState,
} from './rules/types';
