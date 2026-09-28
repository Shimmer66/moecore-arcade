import { moveFor } from './moves';
import type { Action, FighterId } from './types';

export type CombatPose =
  | 'ready'
  | 'crouch'
  | 'low_hit'
  | 'sweep_hit'
  | 'dash'
  | 'jump'
  | 'jab_start'
  | 'jab_hit'
  | 'cross_hit'
  | 'kick_hit'
  | 'upper_hit'
  | 'skill_cast'
  | 'guard'
  | 'hurt'
  | 'down';
export function combatPose(
  id: FighterId,
  action: Action,
  age: number,
  crouched = false,
): CombatPose {
  if (['down', 'grabbed'].includes(action)) return 'down';
  if (['hurt', 'launched'].includes(action)) return 'hurt';
  if (action === 'crouch' || (crouched && ['guard', 'block'].includes(action))) return 'crouch';
  if (action === 'low') {
    const strike = moveFor(id, action)!.strikes[0]!;
    return age >= strike.start && age < strike.start + strike.active + 4 ? 'low_hit' : 'crouch';
  }
  if (action === 'sweep') {
    const strike = moveFor(id, action)!.strikes[0]!;
    return age >= strike.start && age < strike.start + strike.active + 5 ? 'sweep_hit' : 'crouch';
  }
  if (action === 'upper' && age < moveFor(id, action)!.strikes[0]!.start) return 'crouch';
  if (['guard', 'block'].includes(action)) return 'guard';
  if (['walk', 'dash'].includes(action)) return 'dash';
  if (action === 'jump') return 'jump';
  if (action === 'eat') return 'ready';
  if (action === 'meme') return id === 'deepseek' ? 'ready' : 'skill_cast';
  if (id === 'deepseek' && action === 'variant') return age < 8 ? 'dash' : 'skill_cast';
  if (action === 'throwing') return 'cross_hit';
  const move = moveFor(id, action);
  const first = move?.strikes[0];
  const last = move?.strikes.at(-1);
  if (first && age < first.start) return 'jab_start';
  if (last && age > last.start + last.active + 6 && !['air', 'airHeavy'].includes(action))
    return 'ready';
  if (action === 'light1') return 'jab_hit';
  if (action === 'light2' || action === 'heavy') return 'cross_hit';
  if (['light3', 'air', 'airHeavy', 'kick'].includes(action)) return 'kick_hit';
  if (action === 'upper' || (id === 'doubao' && action === 'variant')) return 'upper_hit';
  if (['skill', 'counter', 'super', 'variant', 'throw'].includes(action)) return 'skill_cast';
  return 'ready';
}
