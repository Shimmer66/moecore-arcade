import { moveFor } from './moves';
import type { Action, FighterId } from './types';
export function motionFrame(
  id: FighterId,
  action: Action,
  age: number,
  frame: number,
  grounded = true,
  stun = 36,
): number | null {
  if (action === 'walk' || action === 'dash') {
    const step = Math.floor(frame / (action === 'dash' ? 3 : 5));
    return ((step % 4) + 4) % 4;
  }
  if (action === 'hurt' || action === 'launched') return 20 + (age < 7 ? 0 : 1);
  if (action === 'down') return !grounded ? 21 : stun <= 10 ? 23 : 22;
  const row =
    action === 'light1'
      ? 1
      : action === 'light2'
        ? 2
        : ['light3', 'kick', 'air', 'airHeavy'].includes(action)
          ? 3
          : action === 'upper'
            ? 4
            : null;
  if (row === null) return null;
  const hit = moveFor(id, action)?.strikes[0];
  if (!hit) return null;
  const stage =
    age < hit.start ? 0 : age < hit.start + 2 ? 1 : age < hit.start + hit.active + 4 ? 2 : 3;
  return row * 4 + stage;
}
