import { describe, expect, it } from 'vitest';
import { advanceStarFinger, createStarFinger, STAR_FINGER_RANGE } from '../src/star-finger';
import { applyCombatHit, attackSpecs, createCombatState } from '../src/rules';

describe('Star Finger', () => {
  it('winds up, extends, and retracts without striking again on the return', () => {
    const state = createStarFinger();
    expect(advanceStarFinger(state, 90)).toBeUndefined();
    expect(state.length).toBe(0);
    expect(advanceStarFinger(state, 90)).toBe(STAR_FINGER_RANGE / 2);
    expect(advanceStarFinger(state, 100)).toBe(STAR_FINGER_RANGE);
    expect(state.length).toBeLessThan(STAR_FINGER_RANGE);
    expect(advanceStarFinger(state, 100)).toBeUndefined();
    advanceStarFinger(state, 100);
    expect(state.length).toBe(0);
  });

  it('only allows one hit and does not advance when paused', () => {
    const state = createStarFinger();
    advanceStarFinger(state, 180);
    state.hit = true;
    const before = { ...state };
    expect(advanceStarFinger(state, 0)).toBeUndefined();
    expect(state).toEqual(before);
    expect(advanceStarFinger(state, 50)).toBeUndefined();
  });

  it('shares heavy damage, keeps guard and stand reflection, and applies bleeding', () => {
    const caster = { ...createCombatState('p1'), id: 'jotaro' };
    const target = { ...createCombatState('p2'), id: 'avdol' };
    expect(attackSpecs.finger.damage).toBe(attackSpecs.heavy.damage);
    expect(applyCombatHit(caster, target, 'finger', 'body').damage).toBe(attackSpecs.heavy.damage);
    expect(target.statusEffects[0]?.kind).toBe('bleed');
    expect(applyCombatHit(caster, target, 'finger', 'stand').damage).toBe(
      attackSpecs.heavy.damage / 2,
    );
    target.guard = true;
    expect(applyCombatHit(caster, target, 'finger', 'body').damage).toBe(
      Math.round(attackSpecs.heavy.damage * 0.2),
    );
  });
});
