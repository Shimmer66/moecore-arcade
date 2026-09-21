import { describe, expect, it } from 'vitest';
import {
  advanceAdventure,
  beginAdventure,
  ANSWER_DISTANCE,
  BURST_TICKS,
  CONTEXT_CAPACITY,
  SHIFT_DISTANCE,
  SLOW_TICKS,
  TAIL_COOLDOWN,
  TAIL_TICKS,
  seedForSession,
  type Adventure,
  type AdventureInput,
} from '../src/rules';
import { freezeTree } from './helpers';

const idle: AdventureInput = { jump: false, crouch: false, tail: false };
const jump = { ...idle, jump: true };
const tail = { ...idle, tail: true };
const crouch = { ...idle, crouch: true };
function fixture(overrides: Partial<Adventure> = {}): Adventure {
  const state = beginAdventure(0);
  return {
    ...state,
    run: { ...state.run, obstacles: [] },
    pickups: [],
    papers: [],
    printers: [],
    queues: [],
    hallucinations: [],
    ...overrides,
  };
}
function obstacle(state: Adventure, kind: 'ground' | 'air' = 'ground'): Adventure {
  return {
    ...state,
    run: { ...state.run, obstacles: [{ id: 100, kind, x: state.run.distance + 0.61 }] },
  };
}
function ticks(state: Adventure, count: number, input = idle) {
  for (let index = 0; index < count; index += 1) state = advanceAdventure(state, input);
  return state;
}
function incoming(x = 2.5): Adventure {
  return fixture({
    papers: [{ id: 1, x, y: 1.02, returned: false }],
    printers: [{ id: 1, x: 10, fireTick: 0, fired: true, jammed: false, receiptUntil: 0 }],
  });
}
function pilot(state: Adventure, food = true): AdventureInput {
  const distance = state.run.distance;
  const obstacles = [
    ...state.run.obstacles,
    ...state.queues.map((q) => ({ ...q, kind: 'ground' as const })),
  ]
    .filter((o) => o.x + 1.2 > distance)
    .sort((a, b) => a.x - b.x);
  const next = obstacles[0];
  const lead = next ? next.x - distance - 0.6 : Infinity;
  const paper = state.papers.find((p) => !p.returned && p.x + 0.45 > distance);
  const fake = state.hallucinations.find((p) => p.x + 0.35 > distance);
  const slap = Boolean(
    (paper && paper.x - distance < 3.1) ||
    (fake && fake.x - distance < 3.1) ||
    (state.energy === 100 && (lead < 6 || state.hasAnswer)),
  );
  const low = next?.kind === 'air' && lead < state.run.speed * 0.5;
  const foodAhead =
    food && state.pickups.some((p) => p.kind === 'rice' && p.x > distance && p.x - distance < 8);
  return {
    jump:
      !low &&
      ((next?.kind === 'ground' && state.run.player.grounded && lead < state.run.speed * 0.25) ||
        (foodAhead &&
          !state.run.player.grounded &&
          state.airJumps === 0 &&
          state.run.player.velocityY < 4)),
    crouch:
      low || Boolean(paper && paper.x - distance < 1 && !state.tailTicks && state.tailCooldown),
    tail: slap && !state.tailHeld && state.tailCooldown === 0,
  };
}

describe('short office shift', () => {
  it('starts a finite authored course, not the base 1200m generator', () => {
    const state = beginAdventure(42);
    expect(state.run.finishDistance).toBe(SHIFT_DISTANCE);
    expect(state.run.obstacles).toHaveLength(14);
    expect(state.printers).toHaveLength(3);
    expect(state.run.generator.nextDistance).toBeGreaterThan(SHIFT_DISTANCE);
  });
  it('supports a fresh second jump, not held jumps or a third jump', () => {
    let state = advanceAdventure(fixture(), jump);
    const first = state.run.player.velocityY;
    state = advanceAdventure(state, jump);
    expect(state.run.player.velocityY).toBeLessThan(first);
    state = advanceAdventure(advanceAdventure(state, idle), jump);
    expect(state.airJumps).toBe(1);
    expect(state.run.player.velocityY).toBeCloseTo(7.4);
    state = advanceAdventure(state, idle);
    const velocity = state.run.player.velocityY;
    state = advanceAdventure(state, jump);
    expect(state.run.player.velocityY).toBeLessThan(velocity);
    expect(ticks(state, 100).airJumps).toBe(0);
  });
  it('fast falls and crouches on landing', () => {
    let state = ticks(advanceAdventure(fixture(), jump), 7);
    state = advanceAdventure(state, crouch);
    expect(state.run.player.velocityY).toBeLessThan(-10);
    expect(ticks(state, 12, crouch).run.player.crouching).toBe(true);
  });
  it('ends on three real hits and freezes the exact terminal state', () => {
    let state = advanceAdventure(obstacle(fixture({ combo: 12 })), idle);
    expect(state.health).toBe(2);
    expect(state.combo).toBe(0);
    expect(state.quip).toBe('groundHit');
    expect(advanceAdventure(obstacle(state), idle).health).toBe(2);
    state = advanceAdventure(obstacle({ ...state, invulnerableTicks: 0 }, 'air'), idle);
    expect(state.health).toBe(1);
    expect(state.quip).toBe('beamHit');
    state = advanceAdventure(obstacle({ ...state, invulnerableTicks: 0 }), idle);
    expect(state.health).toBe(0);
    expect(state.run.status).toBe('ended');
    expect(advanceAdventure(state, jump)).toBe(state);
  });
  it('returns a paper to its actual printer, then awards one receipt', () => {
    let state = advanceAdventure(freezeTree(incoming()), tail);
    expect(state.health).toBe(3);
    expect(state.papers[0]?.returned).toBe(true);
    expect(state.parries).toBe(1);
    expect(state.returns).toBe(0);
    expect(state.slowTicks).toBe(SLOW_TICKS);
    state = ticks(state, 55);
    expect(state.returns).toBe(1);
    expect(state.printers[0]?.jammed).toBe(true);
    expect(state.energy).toBe(50);
    expect(state.papers).toHaveLength(0);
    expect(ticks(state, 100).returns).toBe(1);
  });
  it('does not credit two copies of a returned paper twice', () => {
    const state = incoming();
    const paper = { ...state.papers[0]!, x: 9.8, returned: true };
    const next = advanceAdventure({ ...state, papers: [paper, paper] }, idle);
    expect(next.returns).toBe(1);
  });
  it('has a limited slap window and cooldown; holding cannot spam it', () => {
    let state = advanceAdventure(fixture(), tail);
    expect(state.tailTicks).toBe(TAIL_TICKS);
    expect(state.tailCooldown).toBe(TAIL_COOLDOWN);
    state = ticks(state, TAIL_TICKS);
    expect(state.tailTicks).toBe(0);
    expect(advanceAdventure(state, tail).slaps).toBe(1);
    expect(ticks(state, 120, tail).slaps).toBe(1);
    state = ticks(state, 100);
    expect(advanceAdventure(state, tail).slaps).toBe(2);
  });
  it('cannot hit a distant paper or a low paper from a high jump', () => {
    expect(advanceAdventure(incoming(8), tail).parries).toBe(0);
    const state = incoming();
    const airborne = { ...state.run.player, grounded: false, y: 3, velocityY: 0 };
    expect(
      advanceAdventure({ ...state, run: { ...state.run, player: airborne } }, tail).parries,
    ).toBe(0);
  });
  it('allows paper avoidance without requiring a parry', () => {
    const initial = incoming(0.67);
    expect(advanceAdventure(initial, idle).health).toBe(2);
    expect(advanceAdventure(initial, crouch).health).toBe(3);
    expect(advanceAdventure({ ...initial, energy: 100 }, tail).health).toBe(3);
  });
  it('automatically slows the world after a return and retains short inputs', () => {
    let slow = fixture({ slowTicks: SLOW_TICKS });
    const queued = advanceAdventure(slow, { ...jump, tail: true });
    expect(queued.run.tick).toBe(0);
    expect(queued.jumpQueued).toBe(true);
    expect(queued.tailTicks).toBe(TAIL_TICKS);
    expect(advanceAdventure(queued, idle).run.player.grounded).toBe(false);
    slow = ticks(slow, SLOW_TICKS);
    expect(slow.run.tick).toBe(SLOW_TICKS / 2);
    expect(slow.realTick).toBe(SLOW_TICKS);
    expect(slow.energy).toBe(20);
  });
  it('uses the same button for a full-charge burst and never stacks speed', () => {
    expect(advanceAdventure(fixture({ energy: 99 }), tail).bursts).toBe(0);
    let state = advanceAdventure(obstacle(fixture({ energy: 100 })), tail);
    expect(state.health).toBe(3);
    expect(state.breaks).toBe(1);
    expect(state.energy).toBe(0);
    expect(state.dashTicks).toBe(BURST_TICKS);
    expect(state.run.speed).toBeLessThan(19);
    for (let index = 0; index < 180; index += 1)
      state = advanceAdventure({ ...state, energy: 100 }, tail);
    expect(state.bursts).toBe(1);
    expect(state.dashTicks).toBe(0);
  });
  it('blue tokens refill charge and build one consumable context shield', () => {
    let state = fixture({ health: 1 });
    for (let i = 0; i < CONTEXT_CAPACITY; i += 1) {
      state = advanceAdventure(
        {
          ...state,
          pickups: [{ id: `${i}`, kind: 'bubble', x: state.run.distance + 0.3, y: 0.6 }],
        },
        idle,
      );
    }
    expect(state.context).toBe(CONTEXT_CAPACITY);
    expect(state.health).toBe(1);
    expect(state.bubbles).toBe(6);
    expect(state.energy).toBe(50);
    state = advanceAdventure(obstacle(state), idle);
    expect(state.health).toBe(1);
    expect(state.context).toBe(0);
    expect(state.shieldsUsed).toBe(1);
    expect(state.run.status).toBe('running');
    expect(state.quip).toBe('shield');
  });
  it('high rice requires the optional double-jump route and grants charge once', () => {
    const base = fixture({
      pickups: [{ id: 'rice', kind: 'rice', x: 5.4, y: 4.1 }],
    });
    let single = base;
    let double = base;
    for (let i = 0; i < 70; i += 1) {
      single = advanceAdventure(single, i === 0 ? jump : idle);
      double = advanceAdventure(double, i === 0 || i === 17 ? jump : idle);
    }
    expect(single.rice).toBe(0);
    expect(single.health).toBe(3);
    expect(double.rice).toBe(1);
    expect(double.energy).toBe(55);
    expect(ticks(double, 70).rice).toBe(1);
  });
  it('warns before a single printer projectile and does not need a physical printer collision', () => {
    let state = fixture({
      printers: [{ id: 1, x: 19, fireTick: null, fired: false, jammed: false, receiptUntil: 0 }],
    });
    state = advanceAdventure(state, idle);
    expect(state.printers[0]?.fireTick).toBe(43);
    expect(state.papers).toHaveLength(0);
    state = ticks(state, 42, crouch);
    expect(state.papers).toHaveLength(1);
    const x = state.papers[0]!.x;
    expect(advanceAdventure(state, crouch).papers[0]!.x).toBeLessThan(x);
    state = ticks(state, 150, crouch);
    expect(state.health).toBe(3);
    expect(state.papers).toHaveLength(0);
  });
  it('queues really move, collide, and can be jumped or burst through', () => {
    const base = fixture({ queues: [{ id: 0, home: 10, x: 10 }] });
    expect(ticks(base, 10).queues[0]!.x).not.toBe(10);
    const close = fixture({ queues: [{ id: 0, home: 0.61, x: 0.61 }] });
    expect(advanceAdventure(close, idle).health).toBe(2);
    expect(advanceAdventure({ ...close, energy: 100 }, tail).breaks).toBe(1);
    const high = { ...close.run.player, y: 1.3, grounded: false, velocityY: 0 };
    expect(advanceAdventure({ ...close, run: { ...close.run, player: high } }, idle).health).toBe(
      3,
    );
  });
  it('suspicious food can be verified, ducked, or mistakenly consumed', () => {
    const base = fixture({ hallucinations: [{ id: 1, x: 0.7, y: 1.8 }], combo: 10, energy: 50 });
    const verified = advanceAdventure(freezeTree(base), tail);
    expect(verified.verified).toBe(1);
    expect(verified.energy).toBe(65);
    expect(verified.hallucinations).toHaveLength(0);
    expect(ticks(verified, 60).verified).toBe(1);
    expect(advanceAdventure(base, crouch).hallucinationHits).toBe(0);
    const mistaken = advanceAdventure(base, idle);
    expect(mistaken.hallucinationHits).toBe(1);
    expect(mistaken.energy).toBe(30);
    expect(mistaken.health).toBe(3);
    expect(mistaken.combo).toBe(0);
  });
  it('collects the answer and supplies final burst charge exactly once', () => {
    const base = fixture({ energy: 0 });
    let state = advanceAdventure(
      { ...base, run: { ...base.run, distance: ANSWER_DISTANCE - 0.01 } },
      idle,
    );
    expect(state.hasAnswer).toBe(true);
    expect(state.energy).toBe(100);
    expect(state.bonus).toBe(500);
    state = advanceAdventure(state, tail);
    expect(state.energy).toBe(0);
    expect(state.bonus).toBe(500);
  });
  it('clamps a burst at the real exit and never grants a late post-result award', () => {
    const base = fixture({ hasAnswer: true, energy: 100 });
    const final = advanceAdventure(
      {
        ...base,
        run: { ...base.run, distance: SHIFT_DISTANCE - 0.05 },
        pickups: [{ id: 'late', kind: 'rice', x: SHIFT_DISTANCE + 0.1, y: 0.6 }],
      },
      tail,
    );
    expect(final.run.distance).toBe(SHIFT_DISTANCE);
    expect(final.run.result?.reason).toBe('distance-limit');
    expect(final.rice).toBe(0);
    expect(advanceAdventure(final, idle)).toBe(final);
  });
  it('replays without mutating inputs, and starts every attempt fresh', () => {
    const seed = seedForSession('short-shift');
    let left = beginAdventure(seed);
    let right = beginAdventure(seed);
    for (let index = 0; index < 600; index += 1) {
      const input = pilot(left);
      left = advanceAdventure(left, input);
      right = advanceAdventure(freezeTree(right), input);
      expect(left).toEqual(right);
    }
    expect(beginAdventure(seed)).toEqual(beginAdventure(seed));
    expect(beginAdventure(seed).hasAnswer).toBe(false);
    expect(beginAdventure(seed).context).toBe(0);
  });
  it.each(Array.from({ length: 32 }, (_, index) => index))(
    'seed %i can deliver without reading stops in 45–60 seconds',
    (seed) => {
      let state = beginAdventure(seed);
      let firstReturnAt = Infinity;
      for (let index = 0; index < 5000 && state.run.status === 'running'; index += 1) {
        state = advanceAdventure(state, pilot(state));
        if (state.returns > 0 && firstReturnAt === Infinity) firstReturnAt = state.realTick / 60;
        expect(state.health).toBeGreaterThan(0);
        expect(state.run.speed).toBeLessThanOrEqual(18.9 + 1e-9);
        expect(state.feedback.length).toBeLessThan(30);
      }
      expect(state.run.result?.reason).toBe('distance-limit');
      expect(state.run.distance).toBe(SHIFT_DISTANCE);
      expect(state.hasAnswer).toBe(true);
      expect(state.realTick / 60).toBeGreaterThanOrEqual(45);
      expect(state.realTick / 60).toBeLessThanOrEqual(60);
      expect(state.rice).toBeGreaterThan(0);
      expect(state.returns).toBeGreaterThan(0);
      expect(firstReturnAt).toBeLessThan(15);
      expect(state.verified).toBeGreaterThan(0);
      expect(state.breaks).toBeGreaterThan(0);
    },
  );
  it('also allows a no-rice route and does not auto-complete without input', () => {
    let state = beginAdventure(42);
    for (let index = 0; index < 5000 && state.run.status === 'running'; index += 1)
      state = advanceAdventure(state, pilot(state, false));
    expect(state.run.result?.reason).toBe('distance-limit');
    expect(state.rice).toBe(0);
    expect(ticks(beginAdventure(42), 4000).run.result?.reason).not.toBe('distance-limit');
  });
});
