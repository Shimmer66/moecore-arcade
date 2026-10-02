import type { Fighter, Input } from './types';

export const JUMP_LABEL = {
  normal: '普通跳',
  hop: '小跳',
  super: '大跳',
  hyper: '高速小跳',
  double: '二段跳',
  chase: '追击跳',
} as const;
export function startJump(f: Fighter, input: Input, chase: boolean) {
  const airborne = f.y > 0;
  const boosted = !airborne && (input.crouch || f.crouchRecent > 0 || f.action === 'dash');
  f.jumps = airborne ? f.jumps + 1 : 1;
  f.jumpKind = chase ? 'chase' : airborne ? 'double' : boosted ? 'super' : 'normal';
  f.jumpAge = 0;
  f.jumpVariable = !chase && !airborne && input.jumpHeld !== undefined;
  f.jumpDirection = input.move;
  f.vy = chase ? 780 : airborne ? 620 : boosted ? 900 : 720;
  f.crouchRecent = 0;
}
export function updateJump(f: Fighter, input: Input) {
  if (f.y === 0) return;
  if (f.jumpVariable && f.jumpAge < 6 && input.jumpHeld === false && f.vy > 0) {
    const boosted = f.jumpKind === 'super';
    f.jumpKind = boosted ? 'hyper' : 'hop';
    f.vy = Math.min(f.vy, boosted ? 400 : 360);
    f.jumpVariable = false;
  }
  f.jumpAge++;
}
export function airMove(f: Fighter, input: Input): number {
  if (f.jumpKind === 'super' || f.jumpKind === 'hyper') {
    // Preserve committed jump momentum, while allowing a smaller midair adjustment.
    return f.jumpDirection * 380 + input.move * 80;
  }
  return input.move * 280;
}
