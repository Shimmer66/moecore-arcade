import { describe, expect, it } from 'vitest';
import { createRun, stepRun, type RunInput, type RunState } from '../src/rules';

const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function tick(s: RunState, input: RunInput = idle) {
  return stepRun(s, input);
}

describe('bounded long-running combat state', () => {
  it('prunes defeated dynamically spawned larvae while the pod keeps operating', () => {
    let s = createRun('claude', 7);
    s.x = 100;
    s.invulnerable = 999;
    s.enemies = s.enemies.filter((enemy) => enemy.kind === 'pod' && enemy.x === 101);
    s.enemies[0]!.cooldown = 0;
    const authored = s.enemies.length;
    let spawned = 0,
      max = authored;
    for (let frame = 0; frame < 7200; frame++) {
      for (const enemy of s.enemies)
        if (enemy.kind === 'larva') {
          enemy.hp = 0;
          spawned++;
        }
      s = tick(s);
      max = Math.max(max, s.enemies.length);
    }
    expect(spawned).toBeGreaterThan(20);
    expect(max).toBeLessThanOrEqual(authored + 1);
    expect(s.enemies.filter((enemy) => enemy.kind === 'larva').length).toBeLessThanOrEqual(1);
  });

  it('prunes defeated recursive boss drones without removing authored boss objectives', () => {
    let s = createRun('claude', 5, 'normal', undefined, true);
    s.invulnerable = 999;
    s.base!.targets.forEach((target) => (target.cooldown = target.kind === 'boss' ? 0 : 999));
    const authored = s.base!.targets.length;
    let spawned = 0,
      max = authored;
    for (let frame = 0; frame < 9000; frame++) {
      for (const target of s.base!.targets)
        if (target.kind === 'drone') {
          target.hp = 0;
          spawned++;
        }
      s = tick(s);
      max = Math.max(max, s.base!.targets.length);
    }
    expect(spawned).toBeGreaterThan(10);
    expect(max).toBeLessThanOrEqual(authored + 1);
    expect(s.base!.targets.some((target) => target.kind === 'boss')).toBe(true);
    expect(s.base!.targets.filter((target) => target.kind === 'head')).toHaveLength(4);
  });

  it('keeps sustained rapid-fire projectile arrays finite over one hundred simulated seconds', () => {
    let s = createRun('gpt');
    s.enemies = [];
    s.supplies = [];
    s.carriers = [];
    let maxBullets = 0,
      maxEffects = 0;
    for (let frame = 0; frame < 6000; frame++) {
      s = tick(s, { ...idle, shoot: true });
      maxBullets = Math.max(maxBullets, s.bullets.length);
      maxEffects = Math.max(maxEffects, s.effects.length);
      expect(s.bullets.every((bullet) => Number.isFinite(bullet.x + bullet.y + bullet.ttl))).toBe(
        true,
      );
    }
    expect(maxBullets).toBeLessThanOrEqual(13);
    expect(maxEffects).toBe(0);
  });
});
