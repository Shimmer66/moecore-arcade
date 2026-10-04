import type { Action, FighterId } from './types';
import { AIR_ATTACKS } from './moves';

export const GUARD_CAPACITY: Record<FighterId, number> = {
  deepseek: 100,
  gpt: 110,
  doubao: 90,
  client: 120,
  prompt_sage: 85,
  unplug_uncle: 115,
};
export type HitLevel = 'mid' | 'low' | 'overhead';
export function hitLevel(action: Action | 'bubble' | 'return-bubble'): HitLevel {
  if (action === 'low' || action === 'sweep' || action === 'crouchKick') return 'low';
  if (AIR_ATTACKS.includes(action as Action)) return 'overhead';
  return 'mid';
}
export function guardsLevel(crouched: boolean, level: HitLevel): boolean {
  return level === 'mid' || (level === 'low' ? crouched : !crouched);
}
export function guardPressure(action: Action | 'bubble' | 'return-bubble'): number {
  if (action === 'super') return 38;
  if (
    [
      'heavy',
      'closeHeavy',
      'kick',
      'upper',
      'airHeavy',
      'airKick',
      'variant',
      'counter',
      'blowback',
      'airBlowback',
      'guardCounter',
    ].includes(action)
  )
    return 22;
  if (['skill', 'meme', 'bubble', 'return-bubble'].includes(action)) return 14;
  return 9;
}
/** Strike invulnerability is separate from throw vulnerability. */
export function rollingPastStrikes(action: Action, age: number): boolean {
  return action === 'roll' && age >= 3 && age < 20;
}
