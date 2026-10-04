import { describe, expect, it } from 'vitest';
import { createRun, stepRun, levels, type RunInput } from '../src/rules';
import { platformAt } from '../src/levels';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
describe('authored terrain and moving supports', () => {
  it('carries both players by the same platform delta without changing the source state', () => {
    let s = createRun('gpt', 3, 'normal', 'claude');
    const index = levels[3]!.platforms.findIndex((p) => p.motion?.x);
    const platform = levels[3]!.platforms[index]!;
    s.enemies = [];
    s.supplies = [];
    s.x = platform.from + 2;
    s.y = platform.top;
    s.support = index;
    Object.assign(s.partner!, { x: s.x + 1, y: s.y, support: index });
    const original = JSON.stringify(s);
    const source = s;
    for (let i = 0; i < 150; i++) {
      s = stepRun(s, idle);
      const moving = platformAt(platform, s.stageTime);
      expect(s.x - moving.from).toBeCloseTo(2);
      expect(s.partner!.x - s.x).toBeCloseTo(1);
      expect(s.y).toBeCloseTo(moving.top);
      expect(s.grounded && s.partner!.grounded).toBe(true);
    }
    expect(JSON.stringify(source)).toBe(original);
  });
  it('rides an elevator through a full cycle and releases horizontal transport on jumping', () => {
    let s = createRun('gpt', 6);
    s.enemies = [];
    s.supplies = [];
    const index = levels[6]!.platforms.findIndex((p) => p.motion?.y);
    const lift = levels[6]!.platforms[index]!;
    Object.assign(s, { x: lift.from + 2, y: lift.top, support: index });
    for (let i = 0; i < 310; i++) {
      s = stepRun(s, idle);
      expect(s.y).toBeCloseTo(platformAt(lift, s.stageTime).top);
      expect(s.grounded).toBe(true);
    }
    let ferry = createRun('gpt', 3);
    ferry.enemies = [];
    ferry.supplies = [];
    const support = levels[3]!.platforms.findIndex((p) => p.motion?.x);
    const deck = levels[3]!.platforms[support]!;
    Object.assign(ferry, { x: deck.from + 2, y: deck.top, support });
    ferry = stepRun(ferry, { ...idle, jump: true });
    const launchX = ferry.x;
    for (let i = 0; i < 20; i++) ferry = stepRun(ferry, idle);
    expect(ferry.x).toBeCloseTo(launchX);
    expect(ferry.support).toBeNull();
    expect(ferry.y).toBeGreaterThan(deck.top);
  });
  it('lands on a moving surface through relative crossing and never snaps up from below', () => {
    let s = createRun('gpt', 3);
    s.enemies = [];
    s.supplies = [];
    const index = levels[3]!.platforms.findIndex((p) => p.motion?.x);
    const deck = levels[3]!.platforms[index]!;
    Object.assign(s, {
      x: deck.from + 2,
      y: deck.top + 0.05,
      vy: -5,
      grounded: false,
      support: null,
    });
    s = stepRun(s, idle);
    expect(s.support).toBe(index);
    expect(s.grounded).toBe(true);
    const below = stepRun({ ...s, y: deck.top - 1, vy: -1, grounded: false, support: null }, idle);
    expect(below.y).toBeLessThan(deck.top - 1);
  });
  it('moves grounded and prone riders on a conveyor but does not move airborne players', () => {
    let s = createRun('gpt', 4);
    s.enemies = [];
    s.supplies = [];
    const index = levels[4]!.platforms.findIndex((p) => p.conveyor);
    Object.assign(s, { x: 24, support: index });
    for (let i = 0; i < 30; i++) s = stepRun(s, { ...idle, vertical: -1 });
    expect(s.x).toBeCloseTo(22.8);
    expect(s.crouching).toBe(true);
    s = stepRun(s, { ...idle, jump: true });
    const airborneX = s.x;
    for (let i = 0; i < 10; i++) s = stepRun(s, idle);
    expect(s.x).toBeCloseTo(airborneX);
    expect(s.grounded).toBe(false);
  });
  it('keeps the five side routes distinct and exposes monotonic sector progress', () => {
    const side = levels.filter((l) => l.axis === 'horizontal');
    expect(new Set(side.map((l) => JSON.stringify(l.platforms))).size).toBe(5);
    expect(side.every((l) => l.sectors.length === 3)).toBe(true);
    expect(levels[3]!.platforms.filter((p) => p.motion)).toHaveLength(3);
    expect(levels[4]!.platforms.filter((p) => p.conveyor)).toHaveLength(3);
    let s = createRun('gpt');
    s = stepRun({ ...s, x: 30, enemies: [], supplies: [] }, idle);
    expect(s.sector).toBe(1);
    expect(stepRun({ ...s, x: 20 }, idle).sector).toBe(1);
  });
  it('places a checkpoint safely inside a new floor instead of in the pit behind its edge', () => {
    const s = createRun('gpt', 4);
    const n = stepRun(
      {
        ...s,
        x: 122.55,
        y: 0.01,
        vy: -1,
        grounded: false,
        support: null,
        enemies: [],
        supplies: [],
        checkpoint: 104,
      },
      idle,
    );
    expect(n.grounded).toBe(true);
    expect(n.checkpoint).toBeGreaterThanOrEqual(123.1);
    const respawn = stepRun({ ...n, y: -5, grounded: false, support: null }, idle);
    expect(respawn.x).toBeGreaterThanOrEqual(123.1);
    expect(respawn.y).toBe(0);
  });
});
