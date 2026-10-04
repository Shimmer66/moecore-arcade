import { describe, expect, it } from 'vitest';
import { createRun, stepRun, FIXED_DT, type RunState, type RunInput } from '../src/rules';
import { FIREBALL, fireballOffset } from '../src/fireball';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function quiet(stage = 0): RunState {
  const s = createRun('gpt', stage);
  s.weapon = 'flame';
  s.arsenal.push('flame');
  s.carriers = [];
  s.supplies = [];
  if (s.base) s.base.targets.forEach((t) => (t.cooldown = 999));
  else s.enemies = [];
  return s;
}
function frames(s: RunState, count: number, input = idle) {
  for (let i = 0; i < count; i++) s = stepRun(s, input);
  return s;
}
describe('rotating fireballs', () => {
  it('rotates its physical trajectory around all eight firing directions without mutating past state', () => {
    for (const horizontal of [-1, 0, 1] as const)
      for (const vertical of [-1, 0, 1] as const) {
        if (!horizontal && !vertical) continue;
        let s = stepRun(
          { ...quiet(), x: 30, y: 5, grounded: false },
          { ...idle, horizontal, vertical, shoot: true, lockAim: true },
        );
        const source = s,
          snapshot = JSON.stringify(s),
          initial = s.bullets[0]!;
        s = frames(s, 23);
        expect(JSON.stringify(source)).toBe(snapshot);
        const b = s.bullets[0]!;
        expect(b).toBeDefined();
        const old = fireballOffset(initial.age!),
          next = fireballOffset(b.age!);
        const x = initial.vx / FIREBALL.speed,
          y = initial.vy / FIREBALL.speed;
        const forward = FIREBALL.speed * 23 * FIXED_DT + next.forward - old.forward;
        const side = next.side - old.side;
        expect(b.x - initial.x).toBeCloseTo(forward * x - side * y);
        expect(b.y - initial.y).toBeCloseTo(forward * y + side * x);
      }
  });
  it('survives beyond the former short flame range and remains finite under sustained boosted fire', () => {
    let s = stepRun(quiet(), { ...idle, shoot: true });
    s = frames(s, 30);
    expect(s.bullets).toHaveLength(1);
    expect(s.bullets[0]!.x).toBeGreaterThan(10);
    s = frames(s, 45);
    expect(s.bullets).toHaveLength(0);
    s = quiet();
    s.overclock = 12;
    for (let i = 0; i < 900; i++) {
      s = stepRun(s, { ...idle, shoot: true });
      expect(s.bullets.length).toBeLessThanOrEqual(8);
      expect(s.bullets.every((b) => Number.isFinite(b.x + b.y))).toBe(true);
    }
  });
  it('can hit a target above the straight firing line, but damages each target at most once per projectile', () => {
    const template = createRun().enemies[0]!;
    const setup = quiet();
    setup.enemies = [
      { ...template, kind: 'turret', x: 4, y: 1.4, hp: 20, maxHp: 20, cooldown: 999 },
    ];
    const flame = frames(stepRun(setup, { ...idle, shoot: true }), 45);
    expect(flame.enemies[0]!.hp).toBe(20 - FIREBALL.damage);
    const pulse = frames(stepRun({ ...setup, weapon: 'pulse' }, { ...idle, shoot: true }), 45);
    expect(pulse.enemies[0]!.hp).toBe(20);
  });
  it('uses the same interval with overclock and cannot bypass it by switching away and back', () => {
    const s = stepRun({ ...quiet(), overclock: 12 }, { ...idle, shoot: true });
    expect(s.shotCooldown).toBeCloseTo(FIREBALL.interval * 0.65);
    const other = stepRun(s, { ...idle, equipWeapon: 'pulse', shoot: true });
    const back = stepRun(other, { ...idle, equipWeapon: 'flame', shoot: true });
    expect(back.bullets).toHaveLength(1);
    expect(back.weapon).toBe('flame');
  });
  it('spirals in x/y while travelling forward from the player depth and can damage a core', () => {
    const s = quiet(1);
    s.x = 4.5;
    s.depthZ = 1;
    s.base!.targets = s.base!.targets.filter((t) => t.kind === 'core' && t.x === 4);
    const source = JSON.stringify(s);
    let n = stepRun(s, { ...idle, shoot: true });
    expect(JSON.stringify(s)).toBe(source);
    const first = n.base!.shots[0]!;
    n = frames(n, 18);
    const b = n.base!.shots[0]!;
    expect(b.z).toBeCloseTo(1 + 19 * FIXED_DT * FIREBALL.depthSpeed);
    expect(Math.abs(b.x - first.x)).toBeGreaterThan(0.1);
    expect(Math.abs(b.y - first.y)).toBeGreaterThan(0.1);
    n = frames(n, 30);
    expect(n.base!.targets[0]!.hp).toBeLessThan(s.base!.targets[0]!.hp);
    n = frames(n, 35);
    expect(n.base!.shots).toHaveLength(0);
  });
});
