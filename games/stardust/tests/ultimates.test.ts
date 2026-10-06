import { describe, expect, it } from 'vitest';
import { applyCombatHit, BARRAGE_DAMAGE_LIMIT, createCombatState } from '../src/rules';
import {
  advanceUltimate,
  beginUltimate,
  canUseUltimate,
  ULTIMATE_COOLDOWN_MS,
  ULTIMATE_TIMINGS,
  type HeroId,
} from '../src/ultimates';

describe('hero balance and ultimates', () => {
  it.each(['jotaro', 'kakyoin', 'avdol', 'polnareff'] as HeroId[])(
    '%s caps each boss-DIO cast at 500 including its finishing hit',
    (id) => {
      const caster = { ...createCombatState('p1'), id, energy: 100 };
      const target = createCombatState('p2', 1000);
      for (let cast = 0; cast < 2; cast++) {
        caster.energy = 100;
        caster.ultimateCooldownMs = 0;
        const state = beginUltimate(caster, target, target.maxHp / 2)!;
        advanceUltimate(state, target, ULTIMATE_TIMINGS[id].startup);
        if (id === 'kakyoin') target.x += 1;
        let total = 0;
        for (let frame = 0; frame < 400; frame++) {
          const damage = advanceUltimate(state, target, 16);
          total += damage;
          target.hp = Math.max(0, target.hp - damage);
        }
        expect(total).toBe(500);
        expect(target.hp).toBe(cast === 0 ? 500 : 0);
        expect(state.phase).toBe('done');
        expect(advanceUltimate(state, target, 1000)).toBe(0);
      }
    },
  );

  it.each(['jotaro', 'kakyoin', 'avdol', 'polnareff'] as HeroId[])(
    '%s has 500 HP and a capped 15-damage barrage',
    (id) => {
      const caster = { ...createCombatState('p1'), id, attack: 'stand' as const };
      const target = { ...createCombatState('p2'), id: 'dio' };
      expect(target.hp).toBe(500);
      for (let n = 0; n < 16; n++)
        expect(applyCombatHit(caster, target, 'stand', 'body', n > 0).damage).toBe(15);
      expect(applyCombatHit(caster, target, 'stand', 'body', true).damage).toBe(10);
      expect(target.hp).toBe(250);
      expect(target.statusEffects).toEqual([]);
      expect(applyCombatHit(caster, target, 'stand', 'body', true).damage).toBe(0);
      expect(caster.barrageDamageLeft).toBe(0);
      caster.barrageDamageLeft = BARRAGE_DAMAGE_LIMIT;
      expect(applyCombatHit(caster, target, 'stand', 'body').damage).toBe(15);
    },
  );

  it('guard and remote reflection reduce damage without extending the barrage budget', () => {
    const caster = { ...createCombatState('p1'), id: 'jotaro', attack: 'stand' as const };
    const target = { ...createCombatState('p2'), id: 'dio', guard: true };
    for (let n = 0; n < 30; n++) applyCombatHit(caster, target, 'stand', 'body', n > 0);
    expect(target.hp).toBe(450);
    expect(caster.barrageDamageLeft).toBe(0);
  });

  it('requires exactly full energy and ready cooldown, then consumes both readiness conditions', () => {
    const caster = { ...createCombatState('p1'), id: 'jotaro', energy: 99 };
    const target = createCombatState('p2');
    expect(beginUltimate(caster, target)).toBeNull();
    caster.energy = 100;
    caster.ultimateCooldownMs = 1;
    expect(canUseUltimate(caster)).toBe(false);
    caster.ultimateCooldownMs = 0;
    expect(beginUltimate(caster, target)).not.toBeNull();
    expect(caster.energy).toBe(0);
    expect(caster.ultimateCooldownMs).toBe(ULTIMATE_COOLDOWN_MS);
    caster.energy = 100;
    expect(beginUltimate(caster, target)).toBeNull();
    caster.ultimateCooldownMs = 0;
    caster.down = true;
    expect(beginUltimate(caster, target)).toBeNull();
  });

  it.each(['jotaro', 'kakyoin', 'avdol', 'polnareff'] as HeroId[])(
    '%s delivers exactly one lethal sequence with no trailing damage',
    (id) => {
      const caster = { ...createCombatState('p1'), id, energy: 100 };
      const target = createCombatState('p2');
      const state = beginUltimate(caster, target)!;
      expect(advanceUltimate(state, target, ULTIMATE_TIMINGS[id].startup)).toBe(0);
      let damage = 0;
      if (id === 'kakyoin') {
        expect(state.phase).toBe('armed');
        expect(advanceUltimate(state, target, 10000)).toBe(0);
        target.x += 0.1;
        damage += advanceUltimate(state, target, 16);
        expect(state.phase).toBe('strike');
      }
      for (let n = 0; n < 400; n++) {
        const hit = advanceUltimate(state, target, 16);
        damage += hit;
        target.hp = Math.max(0, target.hp - hit);
      }
      expect(damage).toBe(500);
      expect(state.phase).toBe('done');
      expect(advanceUltimate(state, target, 1000)).toBe(0);
    },
  );

  it('Jotaro barrages for five active seconds and saves the knockout for the last punch', () => {
    const caster = { ...createCombatState('p1'), id: 'jotaro', energy: 100 };
    const target = { ...createCombatState('p2'), hp: 30 };
    const state = beginUltimate(caster, target)!;
    advanceUltimate(state, target, 480);
    const damage = advanceUltimate(state, target, 4999);
    target.hp -= damage;
    expect(state.phase).toBe('strike');
    expect(state.hits).toBe(49);
    expect(target.hp).toBe(1);
    expect(advanceUltimate(state, target, 1)).toBe(1);
    expect(state.phase).toBe('done');
  });

  it('the final Jotaro punch is heavier than every preceding punch', () => {
    const caster = { ...createCombatState('p1'), id: 'jotaro', energy: 100 };
    const target = createCombatState('p2');
    const state = beginUltimate(caster, target)!;
    advanceUltimate(state, target, 480);
    for (let hit = 0; hit < 49; hit++) {
      const damage = advanceUltimate(state, target, 100);
      expect(damage).toBeLessThanOrEqual(8);
      target.hp -= damage;
    }
    expect(target.hp).toBe(150);
    expect(advanceUltimate(state, target, 100)).toBe(150);
  });

  it('Silver Chariot pierces for four seconds and ends with a lethal heavy thrust', () => {
    const caster = { ...createCombatState('p1'), id: 'polnareff', energy: 100 };
    const target = createCombatState('p2');
    const state = beginUltimate(caster, target)!;
    advanceUltimate(state, target, 950);
    target.hp -= advanceUltimate(state, target, 3999);
    expect(state.phase).toBe('strike');
    expect(state.hits).toBe(24);
    expect(target.hp).toBe(150);
    expect(advanceUltimate(state, target, 1)).toBe(150);
    expect(state.phase).toBe('done');
  });

  it.each(['jump', 'crouch'])('the emerald trap also detects %s movement', (movement) => {
    const caster = { ...createCombatState('p1'), id: 'kakyoin', energy: 100 };
    const target = createCombatState('p2');
    const state = beginUltimate(caster, target)!;
    advanceUltimate(state, target, 800);
    if (movement === 'jump') target.jumpMs = 520;
    else target.crouch = true;
    expect(advanceUltimate(state, target, 16)).toBeGreaterThan(0);
  });
});
