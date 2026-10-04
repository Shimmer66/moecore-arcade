import { moveFor } from './moves';
import type { Action, FighterId } from './types';

/** These rows are dedicated art, not transforms of standing or crouching sprites. */
export function advancedFrame(
  id: FighterId,
  action: Action,
  age: number,
  reduced = false,
): number | null {
  if (action === 'roll') {
    if (reduced) return age < 20 ? 0 : 3;
    return age < 3 ? 0 : age < 11 ? 1 : age < 20 ? 2 : 3;
  }
  const row =
    action === 'blowback'
      ? 1
      : action === 'guardCounter'
        ? 2
        : action === 'airBlowback' || action === 'airKick'
          ? 3
          : null;
  if (row === null) return null;
  const strike = moveFor(id, action)!.strikes[0]!;
  const phase =
    age < strike.start
      ? 0
      : age < strike.start + Math.ceil(strike.active / 2)
        ? 1
        : age < strike.start + strike.active + 8
          ? 2
          : 3;
  return row * 4 + phase;
}
