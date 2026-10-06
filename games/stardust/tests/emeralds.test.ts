import { describe, expect, it } from 'vitest';
import {
  advanceEmerald,
  applyEmeraldHit,
  launchEmeralds,
  EMERALD_BARRAGE_INTERVAL_MS,
} from '../src/emeralds';
import { createCombatState } from '../src/rules';
import { advanceBarrage, advanceBarrageHit, BARRAGE_DURATION_MS } from '../src/barrage';

describe('Hierophant Green ranged emeralds', () => {
  it('fires one light gem or three heavy gems without multiplying volley damage or energy', () => {
    const caster = createCombatState('p1');
    const light = launchEmeralds(caster, 'light', 25, 1, 0);
    const heavy = launchEmeralds(caster, 'heavy', 25, 1, 1);
    expect(light).toHaveLength(1);
    expect(light[0]).toMatchObject({ damage: 7, energy: 8, lane: 0 });
    expect(heavy.map((shot) => shot.id)).toEqual([1, 2, 3]);
    expect(heavy.map((shot) => shot.lane)).toEqual([-1, 0, 1]);
    expect(heavy.map((shot) => shot.damage)).toEqual([5, 4, 4]);
    expect(heavy.reduce((sum, shot) => sum + shot.energy, 0)).toBe(12);
  });

  it.each([1, -1] as const)(
    'travels before hitting and uses swept collision in direction %s',
    (facing) => {
      const caster = createCombatState('p1');
      const shot = launchEmeralds(caster, 'light', facing === 1 ? 25 : 75, facing, 0)[0]!;
      const target = { owner: 'enemy', x: facing === 1 ? 75 : 25, part: 'body' as const };
      expect(advanceEmerald(shot, [target], 200)).toBeUndefined();
      expect(shot.lifeMs).toBeGreaterThan(0);
      expect(advanceEmerald(shot, [target], 700)).toBe(target);
      expect(shot.lifeMs).toBe(0);
      expect(advanceEmerald(shot, [target], 700)).toBeUndefined();
    },
  );

  it('hits the first visible detached stand, not the body behind it', () => {
    const shot = launchEmeralds(createCombatState('p1'), 'light', 25, 1, 0)[0]!;
    const body = { owner: 'enemy', x: 75, part: 'body' as const };
    const stand = { owner: 'enemy', x: 60, part: 'stand' as const };
    expect(advanceEmerald(shot, [body, stand], 1000)).toBe(stand);
  });

  it('freezes both flight and lifetime and does not turn back toward an enemy', () => {
    const shot = launchEmeralds(createCombatState('p1'), 'light', 25, -1, 0)[0]!;
    const initial = { ...shot };
    const target = { owner: 'enemy', x: 75, part: 'body' as const };
    expect(advanceEmerald(shot, [target], 2000, true)).toBeUndefined();
    expect(shot).toEqual(initial);
    expect(advanceEmerald(shot, [target], 2000)).toBeUndefined();
    expect(shot.lifeMs).toBe(0);
  });

  it('reserves a total of 250 barrage damage at emission, including delayed projectiles', () => {
    const caster = createCombatState('p1');
    const shots = Array.from({ length: 20 }, (_, index) =>
      launchEmeralds(caster, 'stand', 25, 1, index * 3, index > 0),
    ).flat();
    expect(shots).toHaveLength(60);
    expect(shots.at(-1)?.damage).toBe(4);
    expect(shots.reduce((sum, shot) => sum + shot.damage, 0)).toBe(250);
    expect(shots.reduce((sum, shot) => sum + shot.guardDamage, 0)).toBe(50);
    expect(shots.reduce((sum, shot) => sum + shot.energy, 0)).toBe(26);
    expect(caster.barrageDamageLeft).toBe(0);
    caster.barrageDamageLeft = 250;
    const target = createCombatState('p2');
    for (const shot of shots) applyEmeraldHit(caster, target, shot, 'body');
    expect(target.hp).toBe(250);
    expect(caster.barrageDamageLeft).toBe(250);
    expect(target.statusEffects).toEqual([]);
  });

  it('emits twenty rapid triple volleys over the unchanged ten-second barrage', () => {
    const caster = createCombatState('p1');
    caster.barrageMs = BARRAGE_DURATION_MS;
    caster.barrageHitMs = EMERALD_BARRAGE_INTERVAL_MS;
    const shots = launchEmeralds(caster, 'stand', 25, 1, 0);
    let volleys = 1;
    for (let time = 10; time <= BARRAGE_DURATION_MS; time += 10) {
      advanceBarrage(caster, 10);
      if (advanceBarrageHit(caster, 10, EMERALD_BARRAGE_INTERVAL_MS)) {
        const volley = launchEmeralds(caster, 'stand', 25, 1, shots.length, true);
        expect(volley).toHaveLength(3);
        shots.push(...volley);
        volleys++;
      }
    }
    expect(volleys).toBe(20);
    expect(shots).toHaveLength(60);
    expect(caster.barrageDamageLeft).toBe(0);
    expect(launchEmeralds(caster, 'stand', 25, 1, 60, true)).toEqual([]);
    const guarded = { ...createCombatState('p2'), guard: true };
    for (const shot of shots) applyEmeraldHit(caster, guarded, shot, 'body');
    expect(guarded.hp).toBe(450);
  });

  it('keeps guard, reflected damage, energy cap and detached status effects', () => {
    const caster = createCombatState('p1');
    const target = createCombatState('p2');
    const light = launchEmeralds(caster, 'light', 25, 1, 0)[0]!;
    target.guard = true;
    expect(applyEmeraldHit(caster, target, light, 'body')).toEqual({ damage: 1, guarded: true });
    expect(applyEmeraldHit(caster, target, light, 'stand')).toEqual({
      damage: 3.5,
      guarded: false,
    });
    caster.standControl.mode = 'detached';
    const remote = launchEmeralds(caster, 'light', 40, 1, 1)[0]!;
    caster.standControl.mode = 'attached';
    target.guard = false;
    caster.energy = 99;
    applyEmeraldHit(caster, target, remote, 'body');
    expect(caster.energy).toBe(100);
    expect(target.statusEffects).toHaveLength(1);
    expect(target.statusEffects[0]?.kind).toBe('emerald');
    expect(target.x).toBe(79);
  });
});
