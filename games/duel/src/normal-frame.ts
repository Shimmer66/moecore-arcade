import { moveFor } from './moves';
import type { Action, FighterId } from './types';

/** Wind-up, extension, contact and return. Contact art begins on the hitbox frame. */
export function normalFrame(id: FighterId, action: Action, age: number): number | null {
  const row =
    action === 'lightKick'
      ? 0
      : action === 'crouchKick'
        ? 1
        : action === 'air'
          ? 2
          : action === 'airHeavy'
            ? 3
            : null;
  if (row === null) return null;
  const strike = moveFor(id, action)!.strikes[0]!;
  const phase =
    age < Math.ceil(strike.start / 2)
      ? 0
      : age < strike.start
        ? 1
        : age < strike.start + strike.active
          ? 2
          : 3;
  return row * 4 + phase;
}
