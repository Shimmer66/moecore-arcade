import { describe, expect, it } from 'vitest';
import { advanceLevel, createRun, stepRun, type RunInput } from '../src/rules';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
describe('player-controlled loadouts', () => {
  it('stores pickups without replacing the equipped weapon or mutating the previous inventory', () => {
    const s = createRun();
    s.enemies = [];
    s.supplies = [{ kind: 'laser', x: s.x, y: 0.7, taken: false }];
    const next = stepRun(s, idle);
    expect(next.weapon).toBe('homing');
    expect(next.arsenal).toEqual(['pulse', 'homing', 'laser']);
    expect(next.latestWeapon).toBe('laser');
    expect(s.arsenal).toEqual(['pulse', 'homing']);
    const equipped = stepRun(
      { ...next, shotCooldown: 0.2 },
      { ...idle, equipWeapon: 'laser', shoot: true },
    );
    expect(equipped.weapon).toBe('laser');
    expect(equipped.latestWeapon).toBeNull();
    expect(equipped.bullets).toHaveLength(0);
    expect(stepRun(equipped, { ...idle, equipWeapon: 'flame' }).weapon).toBe('laser');
    expect(stepRun(equipped, { ...idle, cycleWeapon: 1 }).weapon).toBe('homing');
  });
  it('keeps full buffs and duplicate weapons for later and lets a teammate collect them', () => {
    const s = createRun('deepseek', 0, 'normal', 'claude');
    s.enemies = [];
    s.shield = 2;
    s.grenades = 5;
    s.partner!.x = s.x;
    s.supplies = ['health', 'shield', 'grenade', 'homing'].map((kind) => ({
      kind: kind as 'health' | 'shield' | 'grenade' | 'homing',
      x: s.x,
      y: 0.7,
      taken: false,
    }));
    const next = stepRun(s, idle);
    expect(next.supplies.map((p) => p.taken)).toEqual([false, true, true, true]);
    expect(next.partner!.weapon).toBe('pulse');
    expect(next.partner!.arsenal).toContain('homing');
    expect(next.partner!.shield).toBe(2);
    expect(next.partner!.grenades).toBe(5);
    expect(stepRun({ ...next, health: 1 }, idle).supplies[0]!.taken).toBe(true);
  });
  it('carries storage across levels and loses only the equipped upgrade on death', () => {
    const s = createRun();
    s.arsenal.push('laser');
    s.weapon = 'laser';
    s.phase = 'level-complete';
    const next = advanceLevel(s);
    expect(next.arsenal).toEqual(s.arsenal);
    expect(next.arsenal).not.toBe(s.arsenal);
    const dead = stepRun({ ...next, y: -8, base: undefined, enemies: [] }, idle);
    expect(dead.weapon).toBe('pulse');
    expect(dead.arsenal).toEqual(['pulse', 'homing']);
  });
});
