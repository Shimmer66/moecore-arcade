import { describe, expect, it } from 'vitest';
import { advanceFireball, createFireball } from '../src/fireball';
import { applyCombatHit, createCombatState } from '../src/rules';

describe('Avdol fireball', () => {
  it('travels forward over time and stops at its range', () => {
    const ball = createFireball(20, 1);
    expect(advanceFireball(ball, 0)).toEqual({ origin: 20, reach: 0 });
    expect(advanceFireball(ball, 500)).toEqual({ origin: 20, reach: 25 });
    expect(advanceFireball(ball, 2000)).toEqual({ origin: 45, reach: 25 });
    expect(ball).toMatchObject({ x: 70, remaining: 0 });
    const left = createFireball(80, -1);
    advanceFireball(left, 500);
    expect(left.x).toBe(55);
  });

  it('deals 12 on impact, adds burning, and leaves heavy attacks unchanged', () => {
    const avdol = { ...createCombatState('p1'), id: 'avdol' };
    const target = { ...createCombatState('p2'), id: 'jotaro' };
    expect(applyCombatHit(avdol, target, 'light', 'body').damage).toBe(12);
    expect(target.hp).toBe(488);
    expect(target.statusEffects[0]).toMatchObject({ kind: 'burn', part: 'body' });
    expect(applyCombatHit(avdol, target, 'heavy', 'body').damage).toBe(13);
  });

  it('respects guard and half damage reflection', () => {
    const avdol = { ...createCombatState('p1'), id: 'avdol' };
    const target = { ...createCombatState('p2'), id: 'jotaro', guard: true };
    expect(applyCombatHit(avdol, target, 'light', 'body').damage).toBe(2);
    expect(target.statusEffects).toEqual([]);
    expect(applyCombatHit(avdol, target, 'light', 'stand').damage).toBe(6);
    expect(target.statusEffects[0]).toMatchObject({ kind: 'burn', part: 'stand' });
  });
});
