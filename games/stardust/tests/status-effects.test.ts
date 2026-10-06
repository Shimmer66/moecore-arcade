import { describe, expect, it } from 'vitest';
import {
  advanceStatuses,
  applyStatus,
  STATUS_DAMAGE,
  statusForActor,
  type StatusEffect,
} from '../src/status-effects';
import { ownerDamage } from '../src/stand-control';

describe('stand status damage', () => {
  it('maps all four fighters and deals two HP per tick', () => {
    expect(['jotaro', 'polnareff', 'kakyoin', 'avdol'].map(statusForActor)).toEqual([
      'bleed',
      'bleed',
      'emerald',
      'burn',
    ]);
    expect(statusForActor('dio')).toBeNull();
    expect(STATUS_DAMAGE).toBe(2);
    expect(ownerDamage(STATUS_DAMAGE, 'stand', false)).toBe(1);
  });

  it.each(['bleed', 'emerald', 'burn'] as const)(
    '%s ticks every second, including its final tick',
    (kind) => {
      const effects: StatusEffect[] = [];
      applyStatus(effects, kind, 'body');
      expect(advanceStatuses(effects, 999)).toHaveLength(0);
      expect(advanceStatuses(effects, 1)).toHaveLength(1);
      expect(advanceStatuses(effects, 2000)).toHaveLength(2);
      expect(advanceStatuses(effects, 1000)).toHaveLength(0);
      expect(effects[0]!.remainingMs).toBe(0);
    },
  );

  it('refreshes duration without stacking or starving ticks during barrage', () => {
    const effects: StatusEffect[] = [];
    applyStatus(effects, 'bleed', 'body');
    let ticks = 0;
    for (let frame = 0; frame < 100; frame++) {
      applyStatus(effects, 'bleed', 'body');
      ticks += advanceStatuses(effects, 100).length;
    }
    expect(effects).toHaveLength(1);
    expect(ticks).toBe(10);
  });
});
