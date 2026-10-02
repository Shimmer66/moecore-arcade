import { AIR_ATTACKS, moveFor } from './moves';
import type { Action, FighterId, SuperTier } from './types';
export function motionFrame(
  id: FighterId,
  action: Action,
  age: number,
  frame: number,
  grounded = true,
  stun = 36,
  enhanced = false,
  superTier: SuperTier = 1,
  landing = false,
): number | null {
  if (landing && action === 'hurt') return null;
  if (action === 'walk' || action === 'dash')
    // Opening dash afterimages sample earlier ticks, including negative ones.
    return ((Math.floor(frame / (action === 'dash' ? 3 : 5)) % 4) + 4) % 4;
  if (action === 'hurt' || action === 'launched' || action === 'guardBreak')
    return 20 + (age < 7 ? 0 : 1);
  if (action === 'grabbed') return grounded ? 20 : 21;
  if (action === 'down') return !grounded ? 21 : stun <= 10 ? 23 : 22;
  const row =
    action === 'light1'
      ? 1
      : action === 'light2' || action === 'closeHeavy' || action === 'guardCounter'
        ? 2
        : AIR_ATTACKS.includes(action) ||
            ['light3', 'kick', 'lightKick', 'blowback'].includes(action)
          ? 3
          : action === 'upper'
            ? 4
            : null;
  if (row === null) return null;
  const hit = moveFor(id, action, enhanced, superTier)?.strikes[0];
  if (!hit) return null;
  const stage =
    age < hit.start ? 0 : age < hit.start + 2 ? 1 : age < hit.start + hit.active + 4 ? 2 : 3;
  return row * 4 + stage;
}
