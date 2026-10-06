import { metersToPosition } from './stand-control';

export const FIREBALL_DAMAGE = 12;
export const FIREBALL_RANGE_METERS = 20;
const SPEED_METERS_PER_SECOND = 20;

export function createFireball(x: number, facing: 1 | -1) {
  return { x, facing, remaining: metersToPosition(FIREBALL_RANGE_METERS) };
}

export function advanceFireball(ball: ReturnType<typeof createFireball>, dt: number) {
  const origin = ball.x;
  const reach = Math.min(
    ball.remaining,
    (metersToPosition(SPEED_METERS_PER_SECOND) * Math.max(0, dt)) / 1000,
  );
  ball.x += ball.facing * reach;
  ball.remaining -= reach;
  return { origin, reach };
}
