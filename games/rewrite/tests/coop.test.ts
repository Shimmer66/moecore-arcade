import { describe, expect, it } from 'vitest';
import {
  advanceLevel,
  createRun,
  FIXED_DT,
  levels,
  retryLevel,
  shareLife,
  stepRun,
  type RunInput,
  type RunState,
} from '../src/rules';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function setup(): RunState {
  const s = createRun('gpt', 0, 'normal', 'claude');
  s.enemies = [];
  s.supplies = [];
  return s;
}

describe('local cooperative campaign', () => {
  it('advances the shared world once while independently moving, aiming, jumping and firing', () => {
    const s = setup(),
      snapshot = JSON.stringify(s);
    const n = stepRun(s, { ...idle, horizontal: 1, shoot: true }, FIXED_DT, {
      ...idle,
      horizontal: -1,
      vertical: 1,
      jump: true,
      shoot: true,
    });
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(n.x).toBeGreaterThan(s.x);
    expect(n.partner!.x).toBeLessThan(s.partner!.x);
    expect(n.y).toBe(0);
    expect(n.partner!.y).toBeGreaterThan(0);
    expect(n.partner!.aimY).toBeCloseTo(Math.SQRT1_2);
    expect(n.bullets.map((b) => b.owner)).toEqual([1, 2]);
    expect(n.elapsed).toBe(FIXED_DT);
    const active = createRun('gpt', 0, 'normal', 'claude');
    const aged = stepRun(active, idle, FIXED_DT, idle);
    expect(aged.enemies[0]!.age).toBe(FIXED_DT);
  });
  it('applies enemy damage to the player actually hit and waits for both players to be out', () => {
    let s = setup();
    s.invulnerable = 0;
    s.health = 1;
    s.lives = 1;
    s.partner!.invulnerable = 0;
    s.partner!.shield = 0;
    s.enemyBullets = [{ x: s.x, y: 0.3, vx: 0, vy: 0, ttl: 2, radius: 0.1 }];
    s = stepRun(s, idle);
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('running');
    expect(s.partner!.health).toBe(3);
    const px = s.partner!.x;
    s = stepRun(s, { ...idle, shoot: true }, FIXED_DT, { ...idle, horizontal: 1, shoot: true });
    expect(s.partner!.x).toBeGreaterThan(px);
    expect(s.bullets.every((b) => b.owner === 2)).toBe(true);
    s.partner!.health = 1;
    s.partner!.lives = 1;
    s.enemyBullets = [{ x: s.partner!.x, y: 0.3, vx: 0, vy: 0, ttl: 2, radius: 0.1 }];
    expect(stepRun(s, idle).phase).toBe('lost');
  });
  it('lets the touching player collect a weapon and keeps grenade inventories independent', () => {
    const s = setup();
    s.supplies = [{ x: s.partner!.x, y: 0.8, kind: 'laser', taken: false }];
    const n = stepRun(s, idle, FIXED_DT, { ...idle, grenade: true });
    expect(n.weapon).toBe('rapid');
    expect(n.partner!.weapon).toBe(s.partner!.weapon);
    expect(n.partner!.arsenal).toContain('laser');
    expect(n.grenades).toBe(3);
    expect(n.partner!.grenades).toBe(2);
    expect(n.thrown).toHaveLength(1);
    expect(n.supplies[0]!.taken).toBe(true);
  });
  it('transfers one life without mutating the source and refuses to spend the last surviving life', () => {
    const s = setup();
    s.lives = 0;
    s.health = 0;
    s.weapon = 'flame';
    const n = shareLife(s, 1);
    expect(s.lives).toBe(0);
    expect(s.partner!.lives).toBe(3);
    expect(n.lives).toBe(1);
    expect(n.health).toBe(3);
    expect(n.weapon).toBe('pulse');
    expect(n.partner!.lives).toBe(2);
    expect(n.invulnerable).toBe(2.5);
    expect(Math.abs(n.x - n.partner!.x)).toBeLessThan(1);
    const exhausted = { ...s, partner: { ...s.partner!, lives: 1 } };
    expect(shareLife(exhausted, 1)).toBe(exhausted);
  });
  it('requires both live players at the arena gate and bounds horizontal separation', () => {
    let s = setup();
    const gate = levels[0]!.length - 22;
    s.x = gate;
    s.partner!.x = gate - 5;
    s = stepRun(s, { ...idle, horizontal: 1 });
    expect(s.arena).toBe(false);
    s.partner!.x = gate;
    expect(stepRun(s, idle).arena).toBe(true);
    s = setup();
    for (let i = 0; i < 180; i++) s = stepRun(s, { ...idle, horizontal: 1 });
    expect(Math.abs(s.x - s.partner!.x)).toBeLessThanOrEqual(8.5);
  });
  it('preserves the party across stages and a shared continue and scales boss health', () => {
    const s = setup();
    s.lives = 0;
    s.partner!.weapon = 'laser';
    s.phase = 'level-complete';
    const n = advanceLevel(s);
    expect(n.lives).toBe(1);
    expect(n.partner!.persona).toBe('claude');
    expect(n.partner!.weapon).toBe('laser');
    const retried = retryLevel({ ...n, phase: 'lost' });
    expect(retried.continues).toBe(1);
    expect(retried.lives).toBe(3);
    expect(retried.partner!.lives).toBe(3);
    const solo = createRun().enemies.find((e) => e.kind === 'boss')!;
    const duo = createRun('gpt', 0, 'normal', 'claude').enemies.find((e) => e.kind === 'boss')!;
    expect(duo.maxHp).toBe(Math.ceil(solo.maxHp * 1.6));
  });
  it('holds a leading tower player on a reachable ledge until the partner catches up', () => {
    const s = createRun('gpt', 2, 'normal', 'claude');
    s.enemies = [];
    s.supplies = [];
    s.x = 11;
    s.y = 6;
    s.partner!.x = 4;
    s.partner!.y = 2;
    const waiting = stepRun(s, { ...idle, jump: true });
    expect(waiting.y).toBe(6);
    expect(waiting.vy).toBe(0);
    waiting.partner!.y = 4;
    waiting.partner!.x = 7.5;
    expect(stepRun(waiting, { ...idle, jump: true }).vy).toBeGreaterThan(0);
  });
  it('climbs the complete tower as a party with normal damage and authored enemies intact', () => {
    let s = createRun('deepseek', 2, 'normal', 'deepseek');
    const route = levels[2]!.platforms
      .filter((p) => p.top > 0 && p.top <= 48 && p.to - p.from > 3.7)
      .sort((a, b) => a.top - b.top);
    for (const platform of route) {
      const center = (platform.from + platform.to) / 2;
      for (let frame = 0; frame < 90; frame++) {
        const input = (x: number, target: number): RunInput => ({
          horizontal: Math.abs(x - target) < 0.14 ? 0 : x < target ? 1 : -1,
          jump: frame === 0,
          shoot: true,
        });
        s = stepRun(s, input(s.x, center - 0.4), FIXED_DT, input(s.partner!.x, center + 0.4));
        if (
          s.grounded &&
          s.partner!.grounded &&
          s.y >= platform.top &&
          s.partner!.y >= platform.top
        )
          break;
      }
      expect(s.y, `P1 at ${platform.top}m`).toBeCloseTo(platform.top);
      expect(s.partner!.y, `P2 at ${platform.top}m`).toBeCloseTo(platform.top);
    }
    expect(s.arena).toBe(true);
    expect(s.lives).toBeGreaterThan(0);
    expect(s.partner!.lives).toBeGreaterThan(0);
    expect(s.kills).toBeGreaterThan(0);
  });
});
