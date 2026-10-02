import type { BattleEvent } from './types';

const scaling = [100, 85, 70, 55, 40] as const;

export function comboScalePercent(hits: number, move: BattleEvent['move'] | undefined): number {
  const base = scaling[Math.min(Math.max(hits - 1, 0), scaling.length - 1)]!;
  return move === 'super' ? Math.max(70, base) : base;
}
