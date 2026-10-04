import { describe, expect, it } from 'vitest';
import { createRun, stepRun, FIXED_DT, type RunInput, type RunState } from '../src/rules';
import { depthInput } from '../scripts/campaign-driver';
import { depthTargetOpen, DEPTH_EXIT_Z, DEPTH_FIELD_Z } from '../src/depth';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function frames(s: RunState, n: number, input: RunInput = idle) {
  for (let i = 0; i < n; i++) s = stepRun(s, input);
  return s;
}
function quiet() {
  const s = createRun('gpt', 1);
  s.supplies = [];
  s.base!.targets.forEach((t) => (t.cooldown = 999));
  return s;
}

describe('depth base combat', () => {
  it('blocks and shocks forward movement until the field is powered down, even with a force field', () => {
    const s = quiet();
    s.invulnerable = 0;
    const blocked = frames(s, 65, { ...idle, vertical: 1 });
    expect(blocked.depthZ).toBeCloseTo(DEPTH_FIELD_Z - 0.6);
    expect(blocked.health).toBeLessThan(s.health);
    expect(blocked.base!.room).toBe(0);
    const protectedPlayer = frames({ ...s, barrier: 6 }, 65, { ...idle, vertical: 1 });
    expect(protectedPlayer.depthZ).toBeCloseTo(DEPTH_FIELD_Z - 0.6);
    expect(protectedPlayer.health).toBe(s.health);
    const shot = stepRun(protectedPlayer, { ...idle, shoot: true }).base!.shots[0]!;
    expect(shot.z).toBeGreaterThan(protectedPlayer.depthZ);
    expect(shot.z).toBeLessThan(protectedPlayer.depthZ + 1);
  });
  it('waits for both live players to walk to the exit after clearing the cores', () => {
    let s = createRun('gpt', 1, 'normal', 'claude');
    s.supplies = [];
    s.base!.targets.forEach((t) => {
      t.cooldown = 999;
      if (t.kind === 'core') t.hp = 0;
    });
    s = stepRun(s, idle);
    s = frames(s, 180, { ...idle, vertical: 1 });
    expect(s.depthZ).toBe(DEPTH_EXIT_Z);
    expect(s.partner!.depthZ).toBe(0);
    expect(s.base!.transition).toBe(0);
    expect(s.score).toBe(600);
    for (let i = 0; i < 150; i++) s = stepRun(s, idle, FIXED_DT, { ...idle, vertical: 1 });
    expect(s.base!.transition).toBeGreaterThan(0);
    s = frames(s, 95);
    expect(s.base!.room).toBe(1);
    expect(s.depthZ + s.partner!.depthZ).toBe(0);
    expect(s.base!.gateOpen).toBe(false);
  });
  it('hits the nearest player depth plane once and catches forward crossings without tunnelling', () => {
    const s = createRun('gpt', 1, 'normal', 'gpt');
    s.supplies = [];
    Object.assign(s, { x: 8, depthZ: 1, invulnerable: 0 });
    Object.assign(s.partner!, { x: 8, depthZ: 1.15, invulnerable: 0 });
    s.base!.targets.forEach((t) => (t.cooldown = 999));
    s.base!.hostile = [{ x: 8, y: 0.9, z: 1.2, vx: 0, vy: 0, vz: -20 }];
    const hit = stepRun(s, idle);
    expect(hit.health).toBe(3);
    expect(hit.partner!.health).toBe(2);
    expect(hit.base!.hostile).toHaveLength(0);
    const forward = quiet();
    Object.assign(forward, { x: 8, depthZ: 1, invulnerable: 0 });
    forward.base!.hostile = [{ x: 8, y: 0.9, z: 1.1, vx: 0, vy: 0, vz: -3 }];
    expect(stepRun(forward, idle).health).toBe(3);
    expect(stepRun(forward, { ...idle, vertical: 1 }).health).toBe(2);
    const passed = quiet();
    Object.assign(passed, { x: 8, depthZ: 10, invulnerable: 0 });
    passed.base!.gateOpen = true;
    passed.base!.hostile = [{ x: 8, y: 0.9, z: 9.9, vx: 0, vy: 0, vz: 20 }];
    expect(stepRun(passed, idle).health).toBe(2);
    passed.base!.hostile = [{ x: 8, y: 0.9, z: 25.9, vx: 0, vy: 0, vz: 20 }];
    expect(stepRun(passed, idle).base!.hostile).toHaveLength(0);
  });
  it('protects the main core until all relays are destroyed, rather than leaking chip damage', () => {
    let s = createRun('gpt', 1, 'normal', undefined, true);
    s.x = 11;
    s.weapon = 'laser';
    s.invulnerable = 999;
    s.base!.targets.forEach((t) => (t.cooldown = 999));
    const hp = s.base!.targets[0]!.hp;
    s = frames(s, 120, { ...idle, shoot: true });
    expect(s.base!.targets[0]!.hp).toBe(hp);
    s.base!.targets.filter((t) => t.kind === 'relay').forEach((t) => (t.hp = 0));
    s = frames(s, 90, { ...idle, shoot: true });
    expect(s.base!.targets[0]!.hp).toBeLessThan(hp);
  });
  it('uses the same alignment window for head vulnerability and projectile damage', () => {
    let s = createRun('gpt', 5, 'normal', undefined, true);
    s.base!.targets.forEach((t) => (t.cooldown = 999));
    s.base!.age = 1.25;
    s = stepRun(s, idle);
    const head = s.base!.targets.find((t) => t.kind === 'head' && t.slot === 0)!;
    expect(depthTargetOpen(s.base!, head)).toBe(false);
    s.base!.shots = [
      {
        id: 500,
        owner: 1,
        x: head.x,
        y: head.y,
        z: 14.9,
        vx: 0,
        vy: 0,
        vz: 28,
        damage: 3,
        radius: 0.14,
        weapon: 'pulse',
        hits: [],
      },
    ];
    s = stepRun(s, idle);
    expect(s.base!.targets.find((t) => t.id === head.id)!.hp).toBe(head.hp);
    s.base!.age = Math.PI / 1.2 - FIXED_DT;
    s.base!.shots = [
      {
        id: 501,
        owner: 1,
        x: 6,
        y: head.y,
        z: 14.9,
        vx: 0,
        vy: 0,
        vz: 28,
        damage: 3,
        radius: 0.14,
        weapon: 'pulse',
        hits: [],
      },
    ];
    s = stepRun(s, idle);
    const hit = s.base!.targets.find((t) => t.id === head.id)!;
    expect(depthTargetOpen(s.base!, hit)).toBe(true);
    expect(hit.hp).toBe(head.hp - 3);
  });
  it('keeps its nested simulation immutable and cannot skip locked rooms by walking right', () => {
    const s = quiet(),
      snapshot = JSON.stringify(s);
    const n = frames(s, 120, { ...idle, horizontal: 1, shoot: true });
    expect(JSON.stringify(s)).toBe(snapshot);
    expect(n.base!.room).toBe(0);
    expect(n.arena).toBe(false);
    expect(n.base!.targets.some((t) => t.kind === 'core' && t.hp > 0)).toBe(true);
  });
  it('requires projectile flight through depth and jump fire to strike a high core', () => {
    const s = quiet();
    s.x = 18;
    s.weapon = 'pulse';
    const core = s.base!.targets.find((t) => t.kind === 'core' && t.x === 18)!;
    const after = stepRun(s, { ...idle, shoot: true });
    expect(after.base!.shots[0]!.z).toBeGreaterThan(0);
    expect(after.base!.targets.find((t) => t.id === core.id)!.hp).toBe(core.hp);
    expect(
      frames(s, 90, { ...idle, shoot: true }).base!.targets.find((t) => t.id === core.id)!.hp,
    ).toBe(core.hp);
    let jump = stepRun(s, { ...idle, jump: true, shoot: true });
    jump = frames(jump, 75, { ...idle, shoot: true });
    expect(jump.base!.targets.find((t) => t.id === core.id)!.hp).toBeLessThan(core.hp);
  });
  it('uses front-plane collisions so prone evades high rounds but not low ones', () => {
    const standing = quiet();
    standing.invulnerable = 0;
    standing.base!.hostile = [{ x: standing.x, y: 0.9, z: 0.2, vx: 0, vy: 0, vz: -20 }];
    expect(stepRun(standing, idle).health).toBe(2);
    expect(stepRun(standing, { ...idle, vertical: -1 }).health).toBe(3);
    standing.base!.hostile[0]!.y = 0.25;
    expect(stepRun(standing, { ...idle, vertical: -1 }).health).toBe(2);
  });
  it('advances only after all required cores are destroyed and populates a new encounter', () => {
    let s = quiet();
    s.base!.targets.filter((t) => t.kind === 'core').forEach((t) => (t.hp = 0));
    s = stepRun(s, idle);
    expect(s.base!.gateOpen).toBe(true);
    expect(s.base!.transition).toBe(0);
    expect(s.base!.room).toBe(0);
    s = frames(s, 95);
    expect(s.base!.room).toBe(0);
    s = frames(s, 235, { ...idle, vertical: 1 });
    expect(s.base!.room).toBe(1);
    expect(s.base!.targets.filter((t) => t.kind === 'core' && t.hp > 0)).toHaveLength(3);
    expect(s.arena).toBe(false);
    expect(s.base!.hostile).toHaveLength(0);
  });
  it('keeps both owners and inventories independent in the same depth world', () => {
    const s = createRun('gpt', 1, 'normal', 'deepseek');
    s.supplies = [];
    const n = stepRun(s, { ...idle, shoot: true }, FIXED_DT, {
      ...idle,
      shoot: true,
      grenade: true,
    });
    expect(n.base!.shots.map((b) => b.owner)).toEqual([1, 2]);
    expect(n.grenades).toBe(3);
    expect(n.partner!.grenades).toBe(2);
    expect(n.base!.grenades).toHaveLength(1);
    expect(n.elapsed).toBe(FIXED_DT);
  });
  it('spawns recursive agents in the sixth-stage depth boss and keeps projectiles bounded', () => {
    let s = createRun('gpt', 5, 'normal', undefined, true);
    s.invulnerable = 999;
    s = frames(s, 130);
    expect(s.base!.targets.some((t) => t.kind === 'drone')).toBe(true);
    expect(s.base!.hostile.length).toBeGreaterThan(0);
    expect(s.base!.hostile.length).toBeLessThanOrEqual(100);
  });
  it('lets homing correct depth height while laser pierces a front emplacement', () => {
    const s = quiet();
    s.x = 11;
    s.weapon = 'homing';
    s.base!.targets = s.base!.targets.filter((t) => t.kind === 'core' && t.y > 2);
    expect(stepRun(s, { ...idle, shoot: true }).base!.shots[0]!.vy).toBeGreaterThan(0);
    const laser = quiet();
    laser.weapon = 'laser';
    laser.x = 7;
    const front = laser.base!.targets.find((t) => t.kind === 'turret')!;
    front.x = 7;
    front.y = 0.8;
    front.hp = 3;
    const rear = laser.base!.targets.find((t) => t.kind === 'core')!;
    rear.x = 7;
    rear.y = 0.8;
    rear.hp = 1;
    laser.base!.age = 2;
    const result = frames(stepRun(laser, { ...idle, shoot: true }), 30);
    expect(result.base!.targets.find((t) => t.id === front.id)!.hp).toBeLessThanOrEqual(0);
    expect(result.base!.targets.find((t) => t.id === rear.id)!.hp).toBeLessThan(1);
  });
});

it.each([
  [1, false],
  [1, true],
  [5, false],
  [5, true],
] as const)(
  'completes depth stage %i with duo=%s using normal damage and player inputs',
  (stage, duo) => {
    let s = createRun('deepseek', stage, 'normal', duo ? 'deepseek' : undefined);
    const visited = new Set<number>();
    for (let frame = 0; frame < 18000 && s.phase === 'running'; frame++) {
      visited.add(s.base!.room);
      s = stepRun(s, depthInput(s, s), FIXED_DT, s.partner ? depthInput(s, s.partner) : idle);
    }
    expect(s.phase).toBe('level-complete');
    expect(visited.size).toBe(s.base!.roomCount);
    expect(s.lives + (s.partner?.lives ?? 0)).toBeGreaterThan(0);
    expect(s.enemies.find((e) => e.kind === 'boss')!.hp).toBeLessThanOrEqual(0);
  },
);
