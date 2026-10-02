import { describe, expect, it } from 'vitest';
import {
  bossProtected,
  createRun,
  finalHeartCount,
  finalPodCount,
  stepRun,
  type RunInput,
  type RunState,
} from '../src/rules';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function frames(s: RunState, count: number, input = idle) {
  for (let i = 0; i < count; i++) s = stepRun(s, input);
  return s;
}
function finalRun() {
  const s = createRun('gpt', 7);
  s.carriers = [];
  s.supplies = [];
  return s;
}
describe('final neural nest progression', () => {
  it('locks the arena until all authored incubation pods are destroyed', () => {
    let s = finalRun();
    expect(finalPodCount(s)).toBe(3);
    expect(finalHeartCount(s)).toBe(3);
    s = stepRun({ ...s, x: s.levelIndex ? 181 : s.x }, idle);
    expect(s.arena).toBe(false);
    s.enemies.filter((e) => e.kind === 'pod').forEach((e) => (e.hp = 0));
    s = stepRun({ ...s, x: 181 }, idle);
    expect(s.arena).toBe(true);
    expect(s.notice).toContain('三枚推理心核');
  });
  it('spawns bounded larvae from live pods and stops spawning after the pod dies', () => {
    let s = finalRun();
    s.x = 53;
    s.enemies.forEach((e) => (e.cooldown = e.kind === 'pod' ? 0 : 999));
    s = stepRun(s, idle);
    expect(s.enemies.filter((e) => e.kind === 'larva' && e.hp > 0)).toHaveLength(1);
    s = frames(s, 1500);
    expect(s.enemies.filter((e) => e.kind === 'larva' && e.hp > 0).length).toBeLessThanOrEqual(6);
    const pod = s.enemies.find((e) => e.kind === 'pod' && Math.abs(e.x - 54) < 1)!;
    pod.hp = 0;
    const count = s.enemies.filter((e) => e.kind === 'larva').length;
    s = frames(s, 300);
    expect(s.enemies.filter((e) => e.kind === 'larva').length).toBe(count);
  });
  it('keeps the boss immune to bullets, grenades and purge until all hearts are gone', () => {
    let s = createRun('gpt', 7, 'normal', undefined, true);
    s.x = 176;
    s.weapon = 'laser';
    s.arsenal.push('laser');
    s.invulnerable = 999;
    s.enemies
      .filter((e) => e.kind === 'heart')
      .forEach((e, i) => {
        e.x = 161 + i;
        e.y = 5;
        e.cooldown = 999;
      });
    const boss = s.enemies.find((e) => e.kind === 'boss')!;
    boss.cooldown = 999;
    const hp = boss.hp;
    expect(bossProtected(s, boss)).toBe(true);
    s = frames(stepRun(s, { ...idle, shoot: true }), 30);
    expect(s.enemies.find((e) => e.kind === 'boss')!.hp).toBe(hp);
    s.thrown = [{ x: boss.x, y: 1, vx: 0, vy: 0, fuse: 0 }];
    s = stepRun(s, idle);
    expect(s.enemies.find((e) => e.kind === 'boss')!.hp).toBe(hp);
    s.supplies = [{ x: s.x, y: 0.7, kind: 'purge', taken: false }];
    s = stepRun(s, idle);
    expect(s.enemies.find((e) => e.kind === 'boss')!.hp).toBe(hp);
    expect(finalHeartCount(s)).toBe(3);
  });
  it('opens the original armor cycle only after the third heart is destroyed', () => {
    let s = createRun('gpt', 7, 'normal', undefined, true);
    s.x = 176;
    s.weapon = 'laser';
    s.arsenal.push('laser');
    s.invulnerable = 999;
    const boss = s.enemies.find((e) => e.kind === 'boss')!;
    boss.cooldown = 999;
    boss.age = 3;
    s.enemies.filter((e) => e.kind === 'heart').forEach((e) => (e.hp = 0));
    expect(bossProtected(s, boss)).toBe(false);
    const hp = boss.hp;
    s = frames(stepRun(s, { ...idle, shoot: true }), 30);
    expect(s.enemies.find((e) => e.kind === 'boss')!.hp).toBeLessThan(hp);
  });
  it('does not activate or damage hearts before the team formally enters the arena', () => {
    let s = finalRun();
    s.enemies.filter((e) => e.kind === 'pod').forEach((e) => (e.hp = 0));
    s.enemies = s.enemies.filter((e) => e.kind === 'heart' || e.kind === 'boss');
    s.x = 159;
    s.weapon = 'laser';
    s.arsenal.push('laser');
    const hearts = s.enemies.filter((e) => e.kind === 'heart');
    hearts.forEach((e) => (e.cooldown = 0));
    const hp = hearts.map((e) => e.hp);
    s = frames(stepRun(s, { ...idle, shoot: true }), 90);
    expect(s.arena).toBe(false);
    expect(s.enemies.filter((e) => e.kind === 'heart').map((e) => e.hp)).toEqual(hp);
    expect(s.enemyBullets).toHaveLength(0);
  });
  it('retains all three hearts in boss practice and scales them for co-op', () => {
    const solo = createRun('gpt', 7, 'normal', undefined, true);
    const duo = createRun('gpt', 7, 'normal', 'claude', true);
    expect(solo.enemies.filter((e) => e.kind === 'heart')).toHaveLength(3);
    expect(solo.enemies.some((e) => e.kind === 'pod')).toBe(false);
    expect(duo.enemies.find((e) => e.kind === 'heart')!.hp).toBeGreaterThan(
      solo.enemies.find((e) => e.kind === 'heart')!.hp,
    );
  });
});
