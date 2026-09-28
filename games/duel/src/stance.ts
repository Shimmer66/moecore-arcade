import { moveFor } from './moves';
import type { Fighter } from './types';
/** Shared by collision geometry and the visible pose. */
export function isCrouched(f: Pick<Fighter, 'id' | 'action' | 'age' | 'y' | 'crouching'>): boolean {
  if (f.y > 0) return false;
  return (
    f.action === 'crouch' ||
    f.action === 'low' ||
    f.action === 'sweep' ||
    (f.action === 'upper' && f.age < (moveFor(f.id, 'upper')?.strikes[0]?.start ?? 12)) ||
    (['guard', 'block'].includes(f.action) && f.crouching)
  );
}
