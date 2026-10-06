import type { HitPart } from './stand-control';

export type StatusKind = 'bleed' | 'emerald' | 'burn';
export interface StatusEffect {
  kind: StatusKind;
  part: HitPart;
  remainingMs: number;
  tickMs: number;
}
export const STATUS_DAMAGE = 2;
export const STATUS_DURATION_MS = 3_000;
export const STATUS_INTERVAL_MS = 1_000;

export function statusForActor(actor: string): StatusKind | null {
  if (actor === 'jotaro' || actor === 'polnareff') return 'bleed';
  if (actor === 'kakyoin') return 'emerald';
  if (actor === 'avdol') return 'burn';
  return null;
}

export function applyStatus(effects: StatusEffect[], kind: StatusKind, part: HitPart): void {
  const existing = effects.find((effect) => effect.kind === kind && effect.part === part);
  if (existing) {
    // Preserve the next tick when rapid hits refresh duration.
    existing.remainingMs = STATUS_DURATION_MS;
  } else {
    effects.push({ kind, part, remainingMs: STATUS_DURATION_MS, tickMs: STATUS_INTERVAL_MS });
  }
}

export function advanceStatuses(effects: StatusEffect[], dt: number): StatusEffect[] {
  const ticks: StatusEffect[] = [];
  for (const effect of effects) {
    const elapsed = Math.min(dt, effect.remainingMs);
    effect.remainingMs -= elapsed;
    effect.tickMs -= elapsed;
    while (effect.tickMs <= 0) {
      ticks.push({ ...effect });
      effect.tickMs += STATUS_INTERVAL_MS;
    }
  }
  return ticks;
}
