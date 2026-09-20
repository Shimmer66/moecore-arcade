import { FINISH_DISTANCE, FIXED_DT, LOOKAHEAD_DISTANCE, OBSTACLE_WIDTH } from '../config/constants';
import { classifyObstacle } from './collision';
import { scoreAtDistance, speedAtDistance } from './difficulty';
import { createGenerator, generateObstacles } from './obstacles';
import { advancePlayer, applyPlayerInput, createPlayer } from './player';
import type { EndReason, Obstacle, PlayerInput, PlayerState, RunEvent, RunState } from './types';
import { assertFixedStep } from './validation';

export function start(seed: number = 1): RunState {
  const generated = generateObstacles(createGenerator(seed), LOOKAHEAD_DISTANCE);
  return {
    seed,
    tick: 0,
    status: 'running',
    result: null,
    distance: 0,
    speed: speedAtDistance(0),
    score: 0,
    player: createPlayer(),
    generator: generated.generator,
    obstacles: generated.obstacles,
    events: [],
  };
}

export function restart(state: RunState, seed: number = state.seed): RunState {
  return start(seed);
}

function playerAtFraction(from: PlayerState, to: PlayerState, fraction: number): PlayerState {
  if (fraction === 1) return to;
  const y = Math.max(0, from.y + (to.y - from.y) * fraction);
  const velocityY = from.velocityY + (to.velocityY - from.velocityY) * fraction;
  return {
    ...from,
    y,
    velocityY: y === 0 && velocityY < 0 ? 0 : velocityY,
    grounded: y === 0 && velocityY <= 0,
  };
}

export function step(state: RunState, input: PlayerInput, dt: number = FIXED_DT): RunState {
  assertFixedStep(dt);
  if (state.status === 'ended') return state;

  const fromPlayer = applyPlayerInput(state.player, input);
  const toPlayer = advancePlayer(fromPlayer, dt);
  const travel = state.speed * dt;
  const fullDistance = state.distance + travel;
  let fraction = Math.min(1, (FINISH_DISTANCE - state.distance) / travel);
  let reason: EndReason | null = fullDistance >= FINISH_DISTANCE ? 'distance-limit' : null;
  let hit: Obstacle | null = null;
  const passed: { event: RunEvent; fraction: number }[] = [];

  for (const obstacle of state.obstacles) {
    const outcome = classifyObstacle(
      { distance: state.distance, player: fromPlayer },
      { distance: fullDistance, player: toPlayer },
      obstacle,
    );
    if (outcome.kind === 'collision' && outcome.fraction <= fraction) {
      if (!hit || outcome.fraction < fraction) {
        fraction = outcome.fraction;
        reason = obstacle.kind === 'ground' ? 'ground-collision' : 'air-collision';
        hit = obstacle;
      }
    } else if (outcome.kind === 'jumped' || outcome.kind === 'ducked') {
      passed.push({
        event: { obstacleId: obstacle.id, kind: outcome.kind },
        fraction: outcome.fraction,
      });
    }
  }

  const distance =
    reason === 'distance-limit' ? FINISH_DISTANCE : state.distance + travel * fraction;
  const score = scoreAtDistance(distance);
  const events: RunEvent[] = passed
    .filter((pass) => pass.fraction <= fraction)
    .map((pass) => pass.event);
  if (hit) events.push({ obstacleId: hit.id, kind: 'collision' });

  const generated = reason
    ? { generator: state.generator, obstacles: [] }
    : generateObstacles(state.generator, Math.min(FINISH_DISTANCE, distance + LOOKAHEAD_DISTANCE));
  const next = {
    seed: state.seed,
    tick: state.tick + 1,
    distance,
    score,
    speed: speedAtDistance(distance),
    // A blocked instantaneous stand-up must not embed the terminal box in the ceiling.
    player: hit && fraction === 0 ? state.player : playerAtFraction(fromPlayer, toPlayer, fraction),
    generator: generated.generator,
    obstacles: [
      ...state.obstacles.filter((obstacle) => obstacle.x + OBSTACLE_WIDTH > distance),
      ...generated.obstacles,
    ],
    events,
  };
  return reason
    ? { ...next, status: 'ended', result: { distance, score, reason } }
    : { ...next, status: 'running', result: null };
}
