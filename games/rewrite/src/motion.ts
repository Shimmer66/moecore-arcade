import type { PlayerState } from './rules';

export type ActorPose =
  | 'idle'
  | 'shoot'
  | 'run'
  | 'jump'
  | 'prone'
  | 'aim-up'
  | 'aim-up-diagonal'
  | 'aim-down'
  | 'aim-down-diagonal';
export interface MotionSelection {
  pose: ActorPose;
  frame: number;
  bank: 'legacy' | 'side' | 'aim' | 'depth';
}
/** Animation is presentation-only and uses the paused simulation clock. */
export function selectMotion(
  p: PlayerState,
  time: number,
  reduced: boolean,
  depth = false,
): MotionSelection {
  const row = { deepseek: 0, gpt: 1, claude: 2 }[p.persona] * 4;
  const tick = Math.floor(time * 10 + (p.playerId - 1) * 2);
  if (depth) {
    const pose = p.crouching
      ? 'prone'
      : !p.grounded
        ? 'jump'
        : p.moving
          ? 'run'
          : p.shotCooldown > 0
            ? 'shoot'
            : 'idle';
    const frame = p.crouching
      ? 3
      : !p.grounded
        ? 1
        : p.moving && !reduced
          ? [0, 1, 2, 1][tick % 4]!
          : 0;
    return { pose, frame: row + frame, bank: 'depth' };
  }
  if (p.crouching) return { pose: 'prone', frame: 5, bank: 'side' };
  if (p.aimY > 0.1)
    return Math.abs(p.aimX) < 0.1
      ? { pose: 'aim-up', frame: row + 1, bank: 'aim' }
      : { pose: 'aim-up-diagonal', frame: row, bank: 'aim' };
  if (p.aimY < -0.1)
    return Math.abs(p.aimX) < 0.1
      ? { pose: 'aim-down', frame: row + 3, bank: 'aim' }
      : { pose: 'aim-down-diagonal', frame: row + 2, bank: 'aim' };
  if (!p.grounded) return { pose: 'jump', frame: 4, bank: 'side' };
  if (p.moving)
    return { pose: 'run', frame: reduced ? 1 : [0, 1, 2, 1, 3, 1, 2, 1][tick % 8]!, bank: 'side' };
  return { pose: p.shotCooldown > 0 ? 'shoot' : 'idle', frame: -1, bank: 'legacy' };
}
