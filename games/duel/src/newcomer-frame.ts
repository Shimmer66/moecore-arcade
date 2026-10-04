import { AIR_ATTACKS, moveFor } from './moves';
import type { Action, NewcomerId, SuperTier } from './types';

export type NewcomerSheet = 'mobility' | 'ground' | 'aerial';
export interface NewcomerFrame {
  sheet: NewcomerSheet;
  index: number;
}
const cell = (sheet: NewcomerSheet, row: number, stage: number): NewcomerFrame => ({
  sheet,
  index: row * 4 + stage,
});
/** Physical state selects locomotion/reaction poses; strike timing selects attack phases. */
export function newcomerFrame(
  id: NewcomerId,
  action: Action,
  age: number,
  frame: number,
  grounded = true,
  stun = 36,
  vy = 0,
  crouched = false,
  reduced = false,
  landing = false,
  enhanced = false,
  superTier: SuperTier = 1,
): NewcomerFrame {
  if (landing && action === 'hurt') return cell('mobility', 1, 3);
  if (action === 'down') return cell('mobility', 3, !grounded ? 1 : stun <= 10 ? 3 : 2);
  if (action === 'hurt' || action === 'launched' || action === 'grabbed' || action === 'guardBreak')
    return cell('mobility', 3, grounded ? 0 : 1);
  if (action === 'crouch' || action === 'roll') return cell('mobility', 2, 0);
  if (action === 'guard' || action === 'block')
    return crouched ? cell('mobility', 2, 1) : cell('aerial', 3, action === 'block' ? 3 : 2);
  if (action === 'walk' || action === 'dash')
    return cell('mobility', 0, ((Math.floor(frame / (action === 'dash' ? 3 : 5)) % 4) + 4) % 4);
  if (action === 'jump') return cell('mobility', 1, grounded ? 0 : vy > 0 ? 1 : 2);
  if (action === 'idle') return cell('aerial', 3, reduced ? 0 : Math.floor(frame / 20) % 2);
  if (action === 'throw' || action === 'commandGrab' || action === 'throwing')
    return cell('aerial', 2, action !== 'throwing' ? 0 : age < 14 ? 1 : age < 25 ? 2 : 3);
  if (action === 'eat') return cell('mobility', 2, 0);
  if (action === 'powerUp') return cell('ground', 3, age < 8 ? 0 : 1);
  const move = moveFor(id, action, enhanced, superTier);
  const strike = move?.strikes.find((s) => age < s.start + s.active + 5) ?? move?.strikes.at(-1);
  const start =
    strike?.start ??
    (action === 'meme' ? (id === 'client' ? 12 : id === 'prompt_sage' ? 22 : 20) : 16);
  const active = strike?.active ?? 6;
  const phase = age < start ? 0 : age < start + 2 ? 1 : age < start + active + 5 ? 2 : 3;
  if (action === 'low' || action === 'sweep' || action === 'crouchKick')
    return cell('mobility', 2, phase === 1 || phase === 2 ? (action === 'low' ? 2 : 3) : 0);
  if (action === 'upper' || (action === 'variant' && id === 'prompt_sage'))
    return cell('aerial', 0, phase);
  if (AIR_ATTACKS.includes(action)) return cell('aerial', 1, phase);
  if (action === 'kick' || action === 'lightKick' || action === 'light3' || action === 'blowback')
    return cell('ground', 2, phase);
  if (action === 'light1' || action === 'light2') return cell('ground', 0, phase);
  if (
    action === 'heavy' ||
    action === 'closeHeavy' ||
    action === 'guardCounter' ||
    action === 'counter' ||
    action === 'variant' ||
    (action === 'skill' && id === 'client')
  )
    return cell('ground', 1, phase);
  if (action === 'meme' && id === 'client') return cell('aerial', 2, age < 12 ? 0 : 1);
  return cell('ground', 3, phase);
}
