import { describe, expect, it } from 'vitest';
import { advanceLevel, createRun, stepRun, type RunInput, type RunState } from '../src/rules';
import { levels } from '../src/levels';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function frames(s: RunState, count: number, input = idle) {
  for (let i = 0; i < count; i++) s = stepRun(s, input);
  return s;
}
function quiet(stage = 0) {
  const s = createRun('gpt', stage);
  s.enemies = [];
  s.supplies = [];
  s.carriers = [];
  return s;
}
describe('shootable supplies and independent power-ups', () => {
  it('moves a capsule along its route and releases its contents when intercepted by a laser', () => {
    let s = quiet();
    s.carriers = [createRun().carriers.find((c) => c.kind === 'capsule')!];
    Object.assign(s, { x: 12, y: 2.2, grounded: false, support: null, weapon: 'laser' });
    s.arsenal.push('laser');
    const initialX = s.carriers[0]!.x;
    s = stepRun(s, { ...idle, shoot: true });
    expect(s.carriers[0]!.x).not.toBe(initialX);
    s = frames(s, 25);
    expect(s.carriers[0]!.hp).toBe(0);
    expect(s.supplies[0]!.kind).toBe('barrier');
    expect(s.supplies[0]!.falling).toBe(true);
  });
  it('opens a cache once through real shots, settles its loot, and collects without changing guns', () => {
    let s = quiet();
    s.carriers = [createRun().carriers[0]!];
    s.x = 4;
    const source = s,
      before = JSON.stringify(s);
    s = frames(s, 100, { ...idle, shoot: true });
    expect(JSON.stringify(source)).toBe(before);
    expect(s.carriers[0]!.hp).toBe(0);
    expect(s.supplies).toHaveLength(1);
    expect(s.supplies[0]!.kind).toBe('overclock');
    expect(s.supplies[0]!.y).toBeCloseTo(0.7);
    expect(s.score).toBe(75);
    s = frames(s, 32, { ...idle, horizontal: 1 });
    expect(s.overclock).toBeGreaterThan(11);
    expect(s.weapon).toBe('rapid');
    expect(s.arsenal).toEqual(['pulse', 'rapid']);
  });
  it('lets a grenade release carrier loot without awarding an enemy kill', () => {
    let s = quiet();
    s.carriers = [createRun().carriers[0]!];
    s = stepRun(s, { ...idle, grenade: true });
    s = frames(s, 60);
    expect(s.carriers[0]!.hp).toBe(0);
    expect(s.supplies).toHaveLength(1);
    expect(s.kills).toBe(0);
  });
  it('bounces grenades against an elevator at its current height', () => {
    const s = quiet(6);
    s.stageTime = 1.25;
    s.thrown = [{ x: 18, y: 3.5, vx: 0, vy: -9, fuse: 0.8 }];
    expect(stepRun(s, idle).thrown[0]!.vy).toBeGreaterThan(0);
  });
  it('applies faster fire only to the collector and retains the buff across weapon switches', () => {
    const s = createRun('gpt', 0, 'normal', 'claude');
    s.enemies = [];
    s.carriers = [];
    s.partner!.arsenal.push('laser');
    s.supplies = [{ x: s.partner!.x, y: 0.7, kind: 'overclock', taken: false }];
    const picked = stepRun(s, idle);
    expect(picked.overclock).toBe(0);
    expect(picked.partner!.overclock).toBe(12);
    const fired = stepRun(picked, { ...idle, shoot: true }, 1 / 60, {
      ...idle,
      equipWeapon: 'laser',
      shoot: true,
    });
    expect(fired.shotCooldown).toBeCloseTo(0.085);
    expect(fired.partner!.shotCooldown).toBeCloseTo(0.23 * 0.65);
    expect(fired.partner!.overclock).toBeGreaterThan(11.9);
    expect(s.partner!.overclock).toBe(0);
  });
  it('preserves duplicates until half duration remains, then refreshes without stacking', () => {
    const s = quiet();
    s.supplies = [0, 1].map(() => ({ x: s.x, y: 0.7, kind: 'overclock' as const, taken: false }));
    let n = stepRun(s, idle);
    expect(n.supplies.map((d) => d.taken)).toEqual([true, false]);
    n = frames(n, 300);
    expect(n.supplies[1]!.taken).toBe(false);
    n = frames(n, 65);
    expect(n.supplies[1]!.taken).toBe(true);
    expect(n.overclock).toBeGreaterThan(11.8);
    expect(n.overclock).toBeLessThanOrEqual(12);
    expect(stepRun({ ...n, phase: 'level-complete' }, idle).overclock).toBe(n.overclock);
    expect(advanceLevel({ ...n, phase: 'level-complete' }).overclock).toBe(n.overclock);
  });
  it('lets force fields expire normally and does not use shield charges while active', () => {
    const s = quiet();
    s.invulnerable = 0;
    s.shield = 1;
    s.barrier = 0.03;
    const shot = { x: s.x, y: 0.7, vx: 0, vy: 0, ttl: 1, radius: 0.1 };
    const protectedPlayer = stepRun({ ...s, enemyBullets: [shot] }, idle);
    expect(protectedPlayer.shield).toBe(1);
    const expired = stepRun({ ...protectedPlayer, enemyBullets: [shot] }, idle);
    expect(expired.barrier).toBe(0);
    expect(expired.shield).toBe(0);
    const fallen = stepRun({ ...s, y: -5, barrier: 6, overclock: 12 }, idle);
    expect(fallen.lives).toBe(2);
    expect(fallen.barrier).toBe(0);
    expect(fallen.overclock).toBe(0);
  });
  it('clears local enemies and bullets, leaves distant threats, and can finish an exposed battle', () => {
    const s = createRun('gpt');
    const enemy = s.enemies.find((e) => e.kind === 'runner')!;
    s.carriers = [];
    s.enemies = [
      { ...enemy, x: 4 },
      { ...enemy, id: 999, x: 40 },
    ];
    s.enemyBullets = [5, 20].map((x) => ({ x, y: 4, vx: 0, vy: 0, ttl: 2, radius: 0.1 }));
    s.supplies = [{ x: s.x, y: 0.7, kind: 'purge', taken: false }];
    const cleared = stepRun(s, idle);
    expect(cleared.enemies[0]!.hp).toBe(0);
    expect(cleared.enemies[1]!.hp).toBeGreaterThan(0);
    expect(cleared.enemyBullets.map((b) => b.x)).toEqual([20]);
    const arena = createRun('gpt', 0, 'normal', undefined, true);
    arena.x = 100;
    arena.enemies[0]!.hp = 10;
    arena.supplies = [{ x: arena.x, y: 0.7, kind: 'purge', taken: false }];
    expect(stepRun(arena, idle).phase).toBe('level-complete');
  });
  it('releases a depth cache through real projectile flight and leaves mandatory cores intact on purge', () => {
    let s = createRun('gpt', 1);
    s.x = 8;
    s.weapon = 'pulse';
    s.supplies = [];
    s.base!.targets.forEach((t) => (t.cooldown = 999));
    s = frames(s, 100, { ...idle, shoot: true });
    expect(s.base!.targets.find((t) => t.kind === 'cache')!.hp).toBeLessThanOrEqual(0);
    expect(s.overclock).toBeGreaterThan(0);
    const cores = s.base!.targets.filter((t) => t.kind === 'core').map((t) => t.hp);
    s.supplies = [{ x: s.x, y: 0.7, kind: 'purge', taken: false }];
    const cleared = stepRun(s, idle);
    expect(cleared.base!.targets.filter((t) => t.kind === 'core').map((t) => t.hp)).toEqual(cores);
    expect(cleared.base!.targets.filter((t) => t.kind === 'turret').every((t) => t.hp <= 0)).toBe(
      true,
    );
    expect(cleared.base!.transition).toBe(0);
    const arena = createRun('gpt', 1, 'normal', undefined, true);
    arena.base!.targets[0]!.hp = 10;
    arena.supplies = [{ x: arena.x, y: 0.7, kind: 'purge', taken: false }];
    expect(stepRun(arena, idle).phase).toBe('running');
    arena.base!.targets.filter((t) => t.kind === 'relay').forEach((t) => (t.hp = 0));
    expect(stepRun(arena, idle).phase).toBe('level-complete');
  });
});

describe('down plus jump', () => {
  it('does not reattach to a moving support after dropping through it', () => {
    for (const stage of [3, 6]) {
      let s = quiet(stage);
      const index = levels[stage]!.platforms.findIndex((p) => p.motion);
      const platform = levels[stage]!.platforms[index]!;
      Object.assign(s, { x: platform.from + 2, y: platform.top, support: index });
      s = stepRun(s, { ...idle, vertical: -1, jump: true });
      s = frames(s, 25);
      expect(s.support).not.toBe(index);
      expect(s.y).toBeLessThan(platform.top - 0.5);
      expect(s.lives).toBe(3);
    }
  });
  it('passes through a ledge and lands on the real floor instead of jumping upward', () => {
    let s = quiet();
    Object.assign(s, { x: 10, y: 2, support: 4 });
    // Locate the support from authored geometry, so a new route cannot silently invalidate this fixture.
    s.support = levels[s.levelIndex]!.platforms.findIndex(
      (p) => p.top === 2 && p.from <= 10 && p.to >= 10,
    );
    s = stepRun(s, { ...idle, vertical: -1, jump: true });
    expect(s.y).toBeLessThan(2);
    expect(s.vy).toBeLessThan(0);
    expect(s.dropThrough).toBeGreaterThan(0);
    s = frames(s, 40);
    expect(s.y).toBe(0);
    expect(s.lives).toBe(3);
  });
  it('preserves ordinary jumping on ground and in depth rooms', () => {
    for (const stage of [0, 1]) {
      const s = stepRun(createRun('gpt', stage), { ...idle, vertical: -1, jump: true });
      expect(s.y).toBeGreaterThan(0);
      expect(s.dropThrough).toBe(0);
    }
    const summit = stepRun(createRun('gpt', 2, 'normal', undefined, true), idle);
    const jump = stepRun(summit, { ...idle, vertical: -1, jump: true });
    expect(jump.y).toBeGreaterThan(48);
    expect(jump.dropThrough).toBe(0);
  });
});
