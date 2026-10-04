import type { Action, FighterId } from './types';

/** GPT catches on meme frames 6–28; a captured throw pays damage on grab frame 9. */
export function grappleFrame(id: FighterId, action: Action, age: number): number | null {
  if (id !== 'gpt') return null;
  if (action === 'meme') return age < 3 ? 0 : age < 6 ? 1 : age <= 28 ? 2 : 7;
  if (action === 'throw') return age < 3 ? 0 : age < 7 ? 1 : age < 9 ? 2 : 7;
  if (action === 'throwing') return age < 2 ? 3 : age < 4 ? 4 : age < 9 ? 5 : age < 17 ? 6 : 7;
  return null;
}
