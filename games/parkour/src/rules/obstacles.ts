import {
  AIR_BOTTOM,
  AIR_HEIGHT,
  FINISH_DISTANCE,
  FIRST_OBSTACLE_DISTANCE,
  GROUND_HEIGHT,
  LOOKAHEAD_DISTANCE,
  MIN_OBSTACLE_GAP,
  OBSTACLE_WIDTH,
  PLAYER_WIDTH,
} from '../config/constants';
import { speedAtDistance } from './difficulty';
import { createRandom, nextRandom } from './random';
import type { Box, GeneratorState, Obstacle } from './types';
import { assertDistance } from './validation';

export function createGenerator(seed: number): GeneratorState {
  return { randomState: createRandom(seed), nextId: 0, nextDistance: FIRST_OBSTACLE_DISTANCE };
}

export function obstacleBox(obstacle: Obstacle): Box {
  return {
    x: obstacle.x,
    y: obstacle.kind === 'ground' ? 0 : AIR_BOTTOM,
    width: OBSTACLE_WIDTH,
    height: obstacle.kind === 'ground' ? GROUND_HEIGHT : AIR_HEIGHT,
  };
}

export function generateObstacles(
  state: GeneratorState,
  throughDistance: number,
): { readonly generator: GeneratorState; readonly obstacles: readonly Obstacle[] } {
  assertDistance(throughDistance);
  assertDistance(state.nextDistance);
  if (throughDistance > FINISH_DISTANCE + LOOKAHEAD_DISTANCE) {
    throw new RangeError('Obstacle horizon exceeds the finite prototype course.');
  }
  let generator = state;
  const obstacles: Obstacle[] = [];
  while (generator.nextDistance <= throughDistance) {
    const kind = nextRandom(generator.randomState);
    const spacing = nextRandom(kind.state);
    // Use the obstacle's world distance, so generation is independent of batching.
    const speed = speedAtDistance(generator.nextDistance);
    const gap =
      Math.max(MIN_OBSTACLE_GAP, speed * 1.25 + PLAYER_WIDTH) + spacing.value * speed * 0.5;
    obstacles.push({
      id: generator.nextId,
      kind: kind.value < 0.5 ? 'ground' : 'air',
      x: generator.nextDistance,
    });
    generator = {
      randomState: spacing.state,
      nextId: generator.nextId + 1,
      nextDistance: generator.nextDistance + OBSTACLE_WIDTH + gap,
    };
  }
  return { generator, obstacles };
}
