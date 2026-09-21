import {
  AIR_HEIGHT,
  FINISH_DISTANCE,
  FIXED_DT,
  GRAVITY,
  JUMP_SPEED,
  LOOKAHEAD_DISTANCE,
  MAX_SPEED,
  MIN_OBSTACLE_GAP,
  OBSTACLE_WIDTH,
  PLAYER_WIDTH,
  obstacleBox,
  playerBox,
  start,
  step,
} from '../src/rules';
import type { Obstacle, PlayerInput, RunState } from '../src/rules';

export const IDLE: PlayerInput = { jump: false, crouch: false };
export const JUMP: PlayerInput = { jump: true, crouch: false };
export const CROUCH: PlayerInput = { jump: false, crouch: true };
export const MAX_TEST_TICKS = 8_000;

export function withObstacles(obstacles: readonly Obstacle[]): RunState {
  const state = start(0);
  return {
    ...state,
    obstacles,
    generator: { ...state.generator, nextDistance: FINISH_DISTANCE + LOOKAHEAD_DISTANCE },
  };
}

export function pilotInput(state: RunState): PlayerInput {
  const obstacle = state.obstacles[0];
  if (!obstacle) return IDLE;
  const lead = obstacle.x - state.distance - PLAYER_WIDTH;
  return {
    jump: obstacle.kind === 'ground' && state.player.grounded && lead <= state.speed * 0.22,
    crouch: obstacle.kind === 'air' && lead <= state.speed * 0.5,
  };
}

export function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}

export function checkInvariants(state: RunState, previousDistance: number): void {
  const values = [
    state.tick,
    state.distance,
    state.score,
    state.speed,
    state.player.y,
    state.player.velocityY,
    state.generator.randomState,
    state.generator.nextDistance,
  ];
  const player = state.player;
  if (
    !values.every(Number.isFinite) ||
    state.distance < previousDistance ||
    state.distance > FINISH_DISTANCE ||
    state.speed > MAX_SPEED ||
    player.y < 0 ||
    player.y > JUMP_SPEED ** 2 / (2 * GRAVITY) ||
    (player.grounded && (player.y !== 0 || player.velocityY !== 0)) ||
    (player.crouching && !player.grounded) ||
    state.obstacles.length > Math.ceil(LOOKAHEAD_DISTANCE / MIN_OBSTACLE_GAP) + 1
  ) {
    throw new Error(`Invalid state for seed ${state.seed}, tick ${state.tick}.`);
  }

  const box = playerBox(state);
  let previous: Obstacle | undefined;
  for (const obstacle of state.obstacles) {
    const other = obstacleBox(obstacle);
    const overlapX = Math.min(box.x + box.width, other.x + other.width) - Math.max(box.x, other.x);
    const overlapY =
      Math.min(box.y + box.height, other.y + other.height) - Math.max(box.y, other.y);
    if (
      !Number.isFinite(obstacle.x) ||
      (overlapX > 1e-9 && overlapY > 1e-9) ||
      (previous && obstacle.x - previous.x - OBSTACLE_WIDTH < MIN_OBSTACLE_GAP - 1e-9)
    ) {
      throw new Error(
        `Penetration or invalid obstacle for seed ${state.seed}, tick ${state.tick}.`,
      );
    }
    previous = obstacle;
  }
  if (player.y >= AIR_HEIGHT) throw new Error('Player escaped the air obstacle ceiling.');
}

export function play(
  seed: number,
  inputAt: (state: RunState) => PlayerInput,
): { state: RunState; jumped: number; ducked: number; cappedTicks: number } {
  let state = start(seed);
  let jumped = 0;
  let ducked = 0;
  let cappedTicks = 0;
  for (let tick = 0; tick < MAX_TEST_TICKS && state.status === 'running'; tick += 1) {
    const previousDistance = state.distance;
    state = step(state, inputAt(state), FIXED_DT);
    checkInvariants(state, previousDistance);
    jumped += state.events.filter((event) => event.kind === 'jumped').length;
    ducked += state.events.filter((event) => event.kind === 'ducked').length;
    if (state.speed === MAX_SPEED) cappedTicks += 1;
  }
  if (state.status !== 'ended') throw new Error(`Seed ${seed} exceeded ${MAX_TEST_TICKS} ticks.`);
  return { state, jumped, ducked, cappedTicks };
}
