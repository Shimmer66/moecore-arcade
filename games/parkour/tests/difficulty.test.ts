import { describe, expect, it } from 'vitest';
import {
  FINISH_DISTANCE,
  GRAVITY,
  GROUND_HEIGHT,
  INITIAL_SPEED,
  JUMP_SPEED,
  MAX_SPEED,
  MIN_OBSTACLE_GAP,
  MIN_RECOVERY_SECONDS,
  OBSTACLE_WIDTH,
  PLAYER_WIDTH,
  scoreAtDistance,
  speedAtDistance,
} from '../src/rules';

describe('distance score and bounded difficulty', () => {
  it('matches the declared score and speed curves', () => {
    const trace = [0, 0.09, 0.1, 10, 100, 200, 400, 800, FINISH_DISTANCE].map((distance) => [
      scoreAtDistance(distance),
      speedAtDistance(distance),
    ]);
    expect(trace).toEqual([
      [0, 6],
      [0, 6.00135],
      [1, 6.0015],
      [100, 6.15],
      [1000, 7.5],
      [2000, 9],
      [4000, 12],
      [8000, 12],
      [12000, 12],
    ]);
    expect(speedAtDistance(Number.MAX_VALUE)).toBe(MAX_SPEED);
  });

  it('leaves clearance and recovery margins across the entire speed range', () => {
    const flightSeconds = (2 * JUMP_SPEED) / GRAVITY;
    const clearanceSeconds =
      (2 * Math.sqrt(JUMP_SPEED ** 2 - 2 * GRAVITY * GROUND_HEIGHT)) / GRAVITY;
    expect((OBSTACLE_WIDTH + PLAYER_WIDTH) / INITIAL_SPEED).toBeLessThan(clearanceSeconds);
    expect((MIN_OBSTACLE_GAP - PLAYER_WIDTH) / MAX_SPEED).toBe(MIN_RECOVERY_SECONDS);
    expect(MIN_RECOVERY_SECONDS - flightSeconds).toBeGreaterThanOrEqual(0.25);
  });

  it.each([-1, NaN, Infinity])('rejects invalid distance %s', (distance) => {
    expect(() => speedAtDistance(distance)).toThrow(RangeError);
    expect(() => scoreAtDistance(distance)).toThrow(RangeError);
  });

  it('does not silently overflow the integer score', () => {
    expect(() => scoreAtDistance(Number.MAX_VALUE)).toThrow(RangeError);
  });
});
