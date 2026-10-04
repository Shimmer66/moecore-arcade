import { moveFor } from './moves';
import type { Action, FighterId, SuperTier } from './types';

export function blockFrameAdvantage(
  id: FighterId,
  action: Action,
  ageAfterStep: number,
  enhanced = false,
  superTier: SuperTier = 1,
): number | null {
  const move = moveFor(id, action, enhanced, superTier);
  if (!move) return null;
  const hitAge = Math.max(0, ageAfterStep - 1);
  const strike = move.strikes.find(
    (candidate) => hitAge >= candidate.start && hitAge < candidate.start + candidate.active,
  );
  return strike ? strike.block - (move.total - hitAge) : null;
}
