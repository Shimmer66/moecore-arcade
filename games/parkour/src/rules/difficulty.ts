import { INITIAL_SPEED, MAX_SPEED, SCORE_PER_METER, SPEED_PER_METER } from '../config/constants';
import { assertDistance } from './validation';

export function speedAtDistance(distance: number): number {
  assertDistance(distance);
  return Math.min(MAX_SPEED, INITIAL_SPEED + distance * SPEED_PER_METER);
}

export function scoreAtDistance(distance: number): number {
  assertDistance(distance);
  const score = Math.floor(distance * SCORE_PER_METER);
  if (!Number.isSafeInteger(score)) {
    throw new RangeError('Distance exceeds the supported score range.');
  }
  return score;
}
