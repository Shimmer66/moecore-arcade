export type TimeStopOwner = 'p1' | 'p2' | 'enemy';
export type PlayerSide = 'p1' | 'p2';

export const TIME_STOP_DURATION_MS = {
  jotaro: 1_000,
  dio: 5_000,
} as const;

export function isPlayerFrozen(owner: TimeStopOwner | null, side: PlayerSide): boolean {
  if (!owner) return false;
  if (owner === 'enemy') return true;
  return owner !== side;
}
