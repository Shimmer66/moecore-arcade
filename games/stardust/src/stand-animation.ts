import type { createCombatState } from './rules';

export const BOSS_STAND_FRAMES = {
  idle: 0,
  move: 1,
  light: 2,
  heavy: 3,
  barrage: 4,
  guard: 5,
  hurt: 6,
  recall: 7,
} as const;

export function isBossStandOwner(id: string): id is 'dio' | 'ice' {
  return id === 'dio' || id === 'ice';
}

type AnimationState = Pick<
  ReturnType<typeof createCombatState>,
  'attack' | 'guard' | 'stun' | 'visualMovingMs' | 'standControl'
>;

export function bossStandPose(fighter: AnimationState): keyof typeof BOSS_STAND_FRAMES {
  const stand = fighter.standControl;
  if (stand.stunMs > 0 || fighter.stun > 0) return 'hurt';
  if (stand.recallMs > 0) return 'recall';
  if (fighter.guard) return 'guard';
  if (fighter.attack === 'stand') return 'barrage';
  if (fighter.attack === 'heavy' || fighter.attack === 'special') return 'heavy';
  if (fighter.attack === 'light' || stand.attackMs > 0) return 'light';
  if (stand.movingMs > 0 || (stand.mode === 'attached' && fighter.visualMovingMs > 0))
    return 'move';
  return 'idle';
}
