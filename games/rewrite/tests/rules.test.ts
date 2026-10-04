import { describe, expect, it } from 'vitest';
import { depthInput } from '../scripts/campaign-driver';
import {
  advanceLevel,
  bossAttack,
  bossIsOpen,
  createRun,
  hazardState,
  levels,
  retryLevel,
  stepRun,
  type RunState,
  type RunInput,
  type Weapon,
} from '../src/rules';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function ticks(s: RunState, count: number, input: RunInput = idle): RunState {
  for (let i = 0; i < count; i++) s = stepRun(s, input);
  return s;
}
function empty(): RunState {
  return { ...createRun(), enemies: [], supplies: [], invulnerable: 0 };
}

describe('run-and-gun combat contract', () => {
  it('keeps rules deterministic and input state immutable', () => {
    const s = createRun();
    const copy = JSON.stringify(s);
    expect(ticks(s, 30, { ...idle, shoot: true })).toEqual(ticks(s, 30, { ...idle, shoot: true }));
    expect(JSON.stringify(s)).toBe(copy);
    expect(stepRun(s, idle, NaN)).toBe(s);
    expect(stepRun(s, idle, 0)).toBe(s);
  });
  it('supports all eight normalized aim directions and fixed-position aim', () => {
    for (const horizontal of [-1, 0, 1] as const)
      for (const vertical of [-1, 0, 1] as const) {
        if (!horizontal && !vertical) continue;
        const s = stepRun(
          { ...empty(), y: 3, grounded: false, weapon: 'pulse' },
          { ...idle, horizontal, vertical, shoot: true, lockAim: true },
        );
        expect(Math.hypot(s.aimX, s.aimY)).toBeCloseTo(1);
        expect(s.x).toBe(2);
        expect(s.bullets[0]!.vy / 26).toBeCloseTo(s.aimY);
      }
  });
  it('jumps and lands without tunnelling through the ground', () => {
    let s = stepRun(empty(), { ...idle, jump: true });
    expect(s.y).toBeGreaterThan(0);
    s = ticks(s, 70);
    expect(s.y).toBe(0);
    expect(s.grounded).toBe(true);
  });
  it('buffers a jump just before landing and allows coyote time', () => {
    const falling = { ...empty(), y: 0.05, vy: -3, grounded: false, coyote: 0 };
    const landed = stepRun(falling, { ...idle, jump: true });
    expect(landed.grounded).toBe(true);
    expect(stepRun(landed, idle).vy).toBeGreaterThan(0);
    const edge = stepRun({ ...empty(), x: 24.99 }, { ...idle, horizontal: 1 });
    expect(edge.grounded).toBe(false);
    expect(stepRun(edge, { ...idle, jump: true }).vy).toBeGreaterThan(0);
  });
  it('allows prone evasion of high bullets but not floor bullets', () => {
    const shot = { x: 2.9, y: 0.9, vx: -12, vy: 0, ttl: 2, radius: 0.1 };
    const setup = { ...empty(), enemyBullets: [shot] };
    expect(ticks(setup, 8).health).toBe(2);
    expect(ticks(setup, 8, { ...idle, vertical: -1 }).health).toBe(3);
    expect(
      ticks({ ...setup, enemyBullets: [{ ...shot, y: 0.25 }] }, 8, { ...idle, vertical: -1 })
        .health,
    ).toBe(2);
  });
  it('makes each weapon functionally distinct', () => {
    const shoot = (weapon: Weapon) => stepRun({ ...empty(), weapon }, { ...idle, shoot: true });
    const spread = shoot('spread');
    expect(spread.bullets).toHaveLength(5);
    expect(new Set(spread.bullets.map((b) => b.vy)).size).toBe(5);
    expect(shoot('rapid').shotCooldown).toBeLessThan(shoot('pulse').shotCooldown);
    expect(shoot('flame').bullets[0]!.radius).toBeGreaterThan(shoot('pulse').bullets[0]!.radius);
    expect(shoot('laser').bullets[0]!.damage).toBeGreaterThan(shoot('pulse').bullets[0]!.damage);
  });
  it('pierces targets with laser and steers homing fire toward elevated enemies', () => {
    const target = createRun().enemies[0]!;
    const setup = {
      ...empty(),
      weapon: 'laser' as Weapon,
      enemies: [
        { ...target, id: 1, x: 4, kind: 'turret' as const, hp: 3, cooldown: 100 },
        { ...target, id: 2, x: 5, kind: 'turret' as const, hp: 3, cooldown: 100 },
      ],
    };
    let s = stepRun(setup, { ...idle, shoot: true });
    s = ticks(s, 12);
    expect(s.kills).toBe(2);
    const homing = stepRun(
      { ...setup, weapon: 'homing', enemies: [{ ...target, kind: 'turret', x: 6, y: 3 }] },
      { ...idle, shoot: true },
    );
    expect(homing.bullets[0]!.vy).toBeGreaterThan(0);
  });
  it('grenades clear a local bullet cloud and respect limited inventory', () => {
    const target = createRun().enemies[0]!;
    const s = stepRun(
      {
        ...empty(),
        enemies: [{ ...target, x: 4, hp: 10 }],
        thrown: [{ x: 4, y: 1, vx: 0, vy: 0, fuse: 0.001 }],
        enemyBullets: [{ x: 4, y: 1, vx: 0, vy: 0, ttl: 3, radius: 0.1 }],
      },
      idle,
    );
    expect(s.enemyBullets).toHaveLength(0);
    expect(s.kills).toBe(1);
    const thrown = stepRun(empty(), { ...idle, grenade: true });
    expect(thrown.grenades).toBe(2);
    expect(stepRun(thrown, { ...idle, grenade: true }).grenades).toBe(2);
    expect(stepRun({ ...empty(), grenades: 0 }, { ...idle, grenade: true }).thrown).toHaveLength(0);
  });
  it('respawns at a safe checkpoint, resets weapons, then offers only two continues', () => {
    let s = stepRun({ ...empty(), health: 1, y: -4, weapon: 'laser', checkpoint: 60 }, idle);
    expect(s.lives).toBe(2);
    expect(s.x).toBe(60);
    expect(s.weapon).toBe('pulse');
    expect(s.invulnerable).toBeGreaterThan(2);
    s = stepRun({ ...s, lives: 1, y: -4 }, idle);
    expect(s.phase).toBe('lost');
    expect(stepRun(s, idle)).toBe(s);
    s = retryLevel(s);
    expect(s.continues).toBe(1);
    expect(s.lives).toBe(3);
    s = retryLevel({ ...s, phase: 'lost' });
    expect(s.continues).toBe(0);
    const lost = { ...s, phase: 'lost' as const };
    expect(retryLevel(lost)).toBe(lost);
  });
  it('separates arcade, classic and hard loadout contracts', () => {
    expect(createRun('gpt').weapon).toBe('rapid');
    expect(createRun('deepseek').weapon).toBe('homing');
    expect(createRun('claude').shield).toBe(1);
    expect(createRun('gpt', 0, 'hard').health).toBe(1);
    const classic = createRun('deepseek', 0, 'classic', 'claude');
    expect(classic.health).toBe(1);
    expect(classic.weapon).toBe('pulse');
    expect(classic.arsenal).toEqual(['pulse']);
    expect(classic.shield).toBe(0);
    expect(classic.grenades).toBe(0);
    expect(classic.continues).toBe(3);
    expect(classic.partner!.weapon).toBe('pulse');
    expect(classic.partner!.shield).toBe(0);
    expect(classic.partner!.grenades).toBe(0);
    const normal = createRun('gpt');
    const hard = createRun('gpt', 0, 'hard');
    normal.enemies[0]!.cooldown = 0;
    classic.enemies[0]!.cooldown = 0;
    hard.enemies[0]!.cooldown = 0;
    expect(stepRun(classic, idle).enemies[0]!.cooldown).toBeCloseTo(
      stepRun(normal, idle).enemies[0]!.cooldown,
    );
    expect(stepRun(hard, idle).enemies[0]!.cooldown).toBeLessThan(
      stepRun(normal, idle).enemies[0]!.cooldown,
    );
  });
  it('offers three real continues in classic mode and resets the neutral loadout', () => {
    let s: RunState = { ...createRun('claude', 0, 'classic'), phase: 'lost', score: 9000 };
    for (const remaining of [2, 1, 0]) {
      s = retryLevel(s);
      expect(s.continues).toBe(remaining);
      expect(s.weapon).toBe('pulse');
      expect(s.shield).toBe(0);
      expect(s.grenades).toBe(0);
      s = { ...s, phase: 'lost' };
    }
    expect(retryLevel(s)).toBe(s);
  });
  it('requires defeating the boss in every stage and preserves campaign progress', () => {
    for (let i = 0; i < levels.length; i++) {
      const l = levels[i]!;
      const s = stepRun({ ...createRun('gpt', i), x: l.length - 1, y: l.arenaY }, idle);
      expect(s.phase).toBe('running');
      expect(s.arena).toBe(l.axis !== 'depth' && i !== 7);
      if (s.base) expect(s.base.targets.some((t) => t.kind === 'core' && t.hp > 0)).toBe(true);
    }
    const next = advanceLevel({
      ...createRun(),
      phase: 'level-complete',
      score: 1234,
      weapon: 'laser',
      grenades: 0,
    });
    expect(next.levelIndex).toBe(1);
    expect(next.score).toBe(1234);
    expect(next.weapon).toBe('laser');
    expect(next.grenades).toBe(2);
  });
  it('provides telegraphed hazards and vulnerable boss intervals', () => {
    expect(hazardState(0, 1)).toBe('safe');
    expect(hazardState(0, 3)).toBe('warning');
    expect(hazardState(0, 4)).toBe('active');
    const boss = createRun().enemies.find((e) => e.kind === 'boss')!;
    expect(bossIsOpen({ ...boss, age: 1 })).toBe(false);
    expect(bossIsOpen({ ...boss, age: 3 })).toBe(true);
  });
  it('uses distinct telegraphed boss patterns, alternating sweeps and reachable firewall gaps', () => {
    const signatures = levels.flatMap((level, i) => {
      if (level.axis === 'depth') return [];
      const s = createRun('gpt', i);
      s.x = levels[i]!.length - 16;
      s.y = levels[i]!.arenaY;
      s.arena = true;
      const e = s.enemies.find((e) => e.kind === 'boss')!;
      const attack = bossAttack(s, e);
      e.cooldown = 0;
      s.enemies = [e];
      const next = stepRun(s, idle);
      expect(next.enemyBullets).toHaveLength(attack.shots.length);
      attack.shots.forEach((b, j) => {
        expect(next.enemyBullets[j]!.vx).toBeCloseTo(Math.cos(b.angle) * b.speed);
        expect(next.enemyBullets[j]!.vy).toBeCloseTo(Math.sin(b.angle) * b.speed);
      });
      return [attack.label];
    });
    expect(new Set(signatures.slice(0, -1)).size).toBe(5);
    const sweep = createRun('gpt', 1);
    const boss = sweep.enemies.find((e) => e.kind === 'boss')!;
    expect(bossAttack(sweep, boss, 1).shots[0]!.y).toBeGreaterThan(0.8);
    expect(bossAttack(sweep, boss, 2).shots[0]!.y).toBeLessThan(0.3);
    const firewall = createRun('gpt', 6);
    for (let volley = 1; volley <= 3; volley++) {
      const rows = bossAttack(firewall, boss, volley).shots.map((b) => b.y);
      const canFit = [0, 1.4, 2.2].some((feet) =>
        rows.every((y) => y + 0.12 < feet || y - 0.12 > feet + 1.25),
      );
      expect(canFit).toBe(true);
    }
  });
  it('lets a full-height jump traverse every authored gap without falling', () => {
    levels.forEach((level, index) => {
      const floors = level.platforms.filter((p) => p.top === 0).sort((a, b) => a.from - b.from);
      for (let i = 0; i < floors.length - 1; i++) {
        const edge = floors[i]!.to,
          next = floors[i + 1]!;
        let s: RunState = {
          ...createRun('deepseek', index),
          x: edge - 0.5,
          enemies: [],
          supplies: [],
        };
        s = stepRun(s, { ...idle, jump: true, horizontal: 1 });
        for (let f = 0; f < 65 && s.x < next.from + 0.5; f++)
          s = stepRun(s, { ...idle, horizontal: 1 });
        expect(s.x, `stage ${index + 1} gap ${i}`).toBeGreaterThan(next.from);
        expect(s.lives).toBe(3);
        expect(s.y).toBeGreaterThanOrEqual(0);
      }
    });
  });
  it('exercises full boss health, all phases and end transitions across eight stages', () => {
    // Combat soak: invulnerability isolates boss reachability from human dodge skill.
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i]!;
      let s: RunState = {
        ...createRun('gpt', i, 'normal', undefined, true),
        x: level.length - 10,
        y: level.arenaY,
        arena: true,
        weapon: 'spread',
        invulnerable: 999,
      };
      s.enemies = s.enemies.filter((e) => e.kind === 'boss');
      const seen = new Set<number>();
      for (let t = 0; t < 9000 && s.phase === 'running'; t++) {
        s = stepRun(s, s.base ? depthInput(s, s) : { ...idle, shoot: true });
        seen.add(s.enemies[0]!.volley);
        expect(Number.isFinite(s.x + s.y + s.score)).toBe(true);
        expect(s.enemyBullets.length).toBeLessThanOrEqual(180);
      }
      expect(s.phase, `boss ${i + 1}`).toBe(i === 7 ? 'won' : 'level-complete');
      expect(seen.size).toBeGreaterThan(3);
    }
  });
  it('climbs every tower ledge using ordinary jump inputs and opens the arena only at the summit', () => {
    const level = levels[2]!;
    let s: RunState = { ...createRun('deepseek', 2), enemies: [], supplies: [] };
    expect(level.axis).toBe('vertical');
    expect(stepRun({ ...s, x: level.length - 1 }, idle).arena).toBe(false);
    const route = level.platforms
      .filter((p) => p.top > 0 && p.top <= level.arenaY && p.to - p.from > 3.7)
      .sort((a, b) => a.top - b.top);
    for (const platform of route) {
      const targetX = (platform.from + platform.to) / 2;
      for (let frame = 0; frame < 90; frame++) {
        const dx = targetX - s.x;
        s = stepRun(s, {
          ...idle,
          horizontal: Math.abs(dx) < 0.14 ? 0 : dx > 0 ? 1 : -1,
          jump: frame === 0,
        });
        if (s.grounded && s.y >= platform.top) break;
      }
      expect(s.y, `landing at ${platform.top}m`).toBeCloseTo(platform.top);
      expect(s.lives).toBe(3);
      if (platform.checkpoint) expect(s.checkpointY).toBe(platform.top);
    }
    expect(s.arena).toBe(true);
    expect(s.checkpointY).toBe(48);
    expect(s.phase).toBe('running');
  });
  it('restores both checkpoint coordinates after a tower fall and retains high-altitude bullets', () => {
    const tower = createRun('gpt', 2);
    const s = stepRun(
      { ...tower, x: 0.5, y: 16, grounded: false, checkpoint: 14, checkpointY: 24 },
      idle,
    );
    expect(s.lives).toBe(2);
    expect(s.x).toBe(14);
    expect(s.y).toBe(24);
    const fired = stepRun({ ...tower, x: 11, y: 48, arena: true }, { ...idle, shoot: true });
    expect(fired.bullets).toHaveLength(1);
    expect(fired.bullets[0]!.y).toBeGreaterThan(48);
    const boss = fired.enemies.find((e) => e.kind === 'boss')!;
    expect(bossAttack(fired, boss).shots.every((b) => b.y > 48)).toBe(true);
  });
});
