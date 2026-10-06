import { describe, expect, it } from 'vitest';
import { isPlayerFrozen, TIME_STOP_DURATION_MS } from '../src/time-stop';

describe('time stop rules', () => {
  it('gives DIO a five-second time stop', () => {
    expect(TIME_STOP_DURATION_MS.dio).toBe(5_000);
    expect(TIME_STOP_DURATION_MS.jotaro).toBe(1_000);
  });

  it('freezes every player-controlled character during DIO time stop', () => {
    expect(isPlayerFrozen('enemy', 'p1')).toBe(true);
    expect(isPlayerFrozen('enemy', 'p2')).toBe(true);
  });

  it('only lets the owning player move during a player time stop', () => {
    expect(isPlayerFrozen('p1', 'p1')).toBe(false);
    expect(isPlayerFrozen('p1', 'p2')).toBe(true);
    expect(isPlayerFrozen('p2', 'p1')).toBe(true);
    expect(isPlayerFrozen('p2', 'p2')).toBe(false);
  });
});
