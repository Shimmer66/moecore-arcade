import type { Action, FighterId } from './types';

/** Character-specific meme and command-grab phases layered over the shared action state. */
export function signatureFrame(
  id: FighterId,
  action: Action,
  age: number,
  parcelReturnDistance: number | null = null,
  commandGrabAge: number | null = null,
): number | null {
  if (id === 'deepseek' && (action === 'meme' || action === 'eat'))
    return age < 6
      ? action === 'meme'
        ? 0
        : 1
      : age < 13
        ? 1
        : age < 20
          ? 2
          : age < 27
            ? 3
            : age < 33
              ? 4
              : age < 37
                ? 5
                : age < 43
                  ? 6
                  : 7;
  if (id === 'doubao') {
    if (action === 'meme')
      return age < 6 ? 0 : age < 12 ? 1 : age < 18 ? 2 : age < 25 ? 3 : age < 38 ? 4 : 7;
    if (parcelReturnDistance !== null && ['idle', 'walk', 'guard'].includes(action))
      return parcelReturnDistance <= 220 ? 6 : 5;
  }
  if (id === 'client') {
    if (action === 'commandGrab') return age < 2 ? 0 : age < 5 ? 1 : 2;
    if (action === 'throwing' && commandGrabAge !== null)
      return commandGrabAge < 3
        ? 3
        : commandGrabAge < 7
          ? 4
          : commandGrabAge < 11
            ? 5
            : commandGrabAge < 19
              ? 6
              : 7;
  }
  if (id === 'prompt_sage') {
    if (action === 'skill') return age < 6 ? 0 : age < 13 ? 1 : age < 19 ? 2 : 3;
    if (action === 'meme') return age < 8 ? 4 : age < 18 ? 5 : age < 30 ? 6 : 7;
  }
  if (id === 'unplug_uncle') {
    if (action === 'skill') return age < 6 ? 0 : age < 13 ? 1 : age < 22 ? 2 : 3;
    if (action === 'meme') return age < 6 ? 4 : age < 14 ? 5 : age < 25 ? 6 : 7;
  }
  return null;
}
