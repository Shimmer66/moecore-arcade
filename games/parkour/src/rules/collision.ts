import { CROUCHING_HEIGHT, PLAYER_WIDTH, STANDING_HEIGHT } from '../config/constants';
import { obstacleBox } from './obstacles';
import type { Box, Obstacle, ObstacleOutcome, PlayerFrame } from './types';

export function playerBox(frame: PlayerFrame): Box {
  return {
    x: frame.distance,
    y: frame.player.y,
    width: PLAYER_WIDTH,
    height: frame.player.crouching ? CROUCHING_HEIGHT : STANDING_HEIGHT,
  };
}

export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function axisInterval(
  min: number,
  size: number,
  delta: number,
  obstacleMin: number,
  obstacleSize: number,
): readonly [number, number] | null {
  if (delta === 0) {
    return min < obstacleMin + obstacleSize && min + size > obstacleMin
      ? [-Infinity, Infinity]
      : null;
  }
  const first = (obstacleMin - min - size) / delta;
  const last = (obstacleMin + obstacleSize - min) / delta;
  return [Math.min(first, last), Math.max(first, last)];
}

export function classifyObstacle(
  from: PlayerFrame,
  to: PlayerFrame,
  obstacle: Obstacle,
): ObstacleOutcome {
  const end = playerBox(to);
  const start = { ...playerBox(from), height: end.height };
  const box = obstacleBox(obstacle);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const horizontal = axisInterval(start.x, start.width, dx, box.x, box.width);
  const vertical = axisInterval(start.y, start.height, dy, box.y, box.height);

  // Swept AABB on this tick's linear motion; the target posture applies at tick start.
  if (horizontal && vertical) {
    const enter = Math.max(0, horizontal[0], vertical[0]);
    const leave = Math.min(1, horizontal[1], vertical[1]);
    if (enter < leave) return { kind: 'collision', fraction: enter };
  }

  const trailingEdge = box.x + box.width;
  if (dx > 0 && from.distance < trailingEdge && to.distance >= trailingEdge) {
    return {
      kind: obstacle.kind === 'ground' ? 'jumped' : 'ducked',
      fraction: (trailingEdge - from.distance) / dx,
    };
  }
  return { kind: 'none' };
}
