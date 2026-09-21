import { describe, expect, it } from 'vitest';
import {
  advanceAdventure,
  beginAdventure,
  FINISH_DISTANCE,
  multiplierFor,
  seedForSession,
  type Adventure,
  type AdventureInput,
  type Pickup,
} from '../src/rules';
import { freezeTree, pilotInput } from './helpers';

const idle: AdventureInput = { jump: false, crouch: false, dash: false };
const jump: AdventureInput = { ...idle, jump: true };
const dash: AdventureInput = { ...idle, dash: true };

function fixture(overrides: Partial<Adventure> = {}): Adventure {
  const state = beginAdventure(0);
  return {
    ...state,
    run: { ...state.run, obstacles: [], generator: { ...state.run.generator, nextDistance: 1260 } },
    pickups: [],
    ...overrides,
  };
}
function nearObstacle(state: Adventure): Adventure {
  return {
    ...state,
    run: { ...state.run, obstacles: [{ id: 100, kind: 'ground', x: state.run.distance + 0.61 }] },
  };
}
function pickup(kind: Pickup['kind'], id = kind): Pickup {
  return { id, kind, x: 0.2, y: 0.9 };
}

describe('runner adventure decisions and rewards', () => {
  it('allows one new airborne jump but not unlimited flight or held-key repeats', () => {
    let state = advanceAdventure(fixture(), jump);
    expect(state.run.player.grounded).toBe(false);
    state = advanceAdventure(state, idle);
    state = advanceAdventure(state, jump);
    expect(state.airJumps).toBe(1);
    expect(state.run.player.velocityY).toBeCloseTo(7.4);
    state = advanceAdventure(state, idle);
    const velocity = state.run.player.velocityY;
    state = advanceAdventure(state, jump);
    expect(state.run.player.velocityY).toBeLessThan(velocity);
    for (let tick = 0; tick < 100; tick += 1) state = advanceAdventure(state, idle);
    expect(state.run.player.grounded).toBe(true);
    expect(state.airJumps).toBe(0);
  });

  it('fast-falls on slide input, then slides on the ground', () => {
    let airborne = advanceAdventure(fixture(), jump);
    for (let tick = 0; tick < 7; tick += 1) airborne = advanceAdventure(airborne, idle);
    const falling = advanceAdventure(airborne, { ...idle, crouch: true });
    expect(falling.run.player.velocityY).toBeLessThan(-10);
    let landed = falling;
    for (let tick = 0; tick < 10; tick += 1)
      landed = advanceAdventure(landed, { ...idle, crouch: true });
    expect(landed.run.player.crouching).toBe(true);
  });

  it('uses three hits, immunity after each hit, and a terminal result exactly once', () => {
    let state = advanceAdventure(nearObstacle(fixture({ combo: 10 })), idle);
    expect(state.health).toBe(2);
    expect(state.combo).toBe(0);
    expect(state.run.status).toBe('running');
    expect(state.invulnerableTicks).toBeGreaterThan(0);
    expect(advanceAdventure(nearObstacle(state), idle).health).toBe(2);
    state = advanceAdventure(nearObstacle({ ...state, invulnerableTicks: 0 }), idle);
    expect(state.health).toBe(1);
    state = advanceAdventure(nearObstacle({ ...state, invulnerableTicks: 0 }), idle);
    expect(state.health).toBe(0);
    expect(state.run.status).toBe('ended');
    expect(advanceAdventure(state, jump)).toBe(state);
  });

  it('consumes a shield before health and preserves the combo', () => {
    const state = advanceAdventure(nearObstacle(fixture({ shield: true, combo: 12 })), idle);
    expect(state.shield).toBe(false);
    expect(state.health).toBe(3);
    expect(state.combo).toBe(12);
  });

  it('requires energy and a fresh press, spends it once and breaks obstacles during a dash', () => {
    expect(advanceAdventure(fixture({ energy: 99 }), dash).dashes).toBe(0);
    let state = advanceAdventure(nearObstacle(fixture({ energy: 100 })), dash);
    expect(state.health).toBe(3);
    expect(state.dashes).toBe(1);
    expect(state.energy).toBe(0);
    expect(state.dodged).toBe(1);
    expect(state.run.obstacles).toHaveLength(0);
    for (let tick = 0; tick < 150; tick += 1)
      state = advanceAdventure({ ...state, energy: 100 }, dash);
    expect(state.dashes).toBe(1);
    expect(state.dashTicks).toBe(0);
  });

  it('collects coins and awards each mission only once', () => {
    const initial = fixture({
      coins: 29,
      combo: 24,
      bestCombo: 24,
      dodged: 10,
      pickups: [pickup('coin')],
    });
    const state = advanceAdventure(freezeTree(initial), idle);
    expect(state.coins).toBe(30);
    expect(state.combo).toBe(25);
    expect(state.missionAwards).toEqual([0, 1, 2]);
    expect(state.bonus).toBe(930);
    const later = advanceAdventure(state, idle);
    expect(later.coins).toBe(30);
    expect(later.bonus).toBe(state.bonus);
    expect(multiplierFor(1000)).toBe(5);
  });

  it('magnet reaches high items and healing never exceeds three hearts', () => {
    const attracted = advanceAdventure(
      fixture({
        magnetTicks: 120,
        pickups: [{ id: 'high', kind: 'star', x: 2.5, y: 3.4 }],
      }),
      idle,
    );
    expect(attracted.coins).toBe(5);
    expect(advanceAdventure(fixture({ health: 2, pickups: [pickup('heart')] }), idle).health).toBe(
      3,
    );
    expect(advanceAdventure(fixture({ health: 3, pickups: [pickup('heart')] }), idle).health).toBe(
      3,
    );
    expect(advanceAdventure(fixture({ pickups: [pickup('magnet')] }), idle).magnetTicks).toBe(420);
  });

  it('replays the same seed and input without shared mutable state', () => {
    const seed = seedForSession('deterministic-session');
    let left = beginAdventure(seed);
    let right = beginAdventure(seed);
    for (let tick = 0; tick < 300; tick += 1) {
      const input = { ...idle, jump: tick % 50 === 0 };
      left = advanceAdventure(left, input);
      right = advanceAdventure(right, input);
      expect(left).toEqual(right);
      expect(new Set(left.pickups.map((item) => item.id)).size).toBe(left.pickups.length);
    }
  });

  it('awards story checkpoints once and preserves a safe resume window', () => {
    const initial = fixture({ health: 1 });
    const approach = {
      ...initial,
      run: { ...initial.run, distance: 399.99, speed: 12 },
    };
    const chapterOne = advanceAdventure(approach, idle);
    expect(chapterOne.chapter).toBe(1);
    expect(chapterOne.health).toBe(2);
    expect(chapterOne.invulnerableTicks).toBe(60);
    expect(advanceAdventure(chapterOne, idle).health).toBe(2);
    const chapterTwo = advanceAdventure(
      {
        ...chapterOne,
        energy: 0,
        run: { ...chapterOne.run, distance: 799.99 },
      },
      idle,
    );
    expect(chapterTwo.chapter).toBe(2);
    expect(chapterTwo.energy).toBe(100);
    const spent = advanceAdventure(chapterTwo, dash);
    expect(spent.energy).toBe(0);
    expect(advanceAdventure(spent, idle).energy).toBe(0);
  });

  it.each([0, 1, 42, 256, 4096, 0xffff_ffff])(
    'seed %i finishes with bounded entities and legal input',
    (seed) => {
      let state = beginAdventure(seed);
      for (let tick = 0; tick < 8000 && state.run.status === 'running'; tick += 1) {
        state = advanceAdventure(state, { ...pilotInput(state.run), dash: false });
        expect(state.pickups.length).toBeLessThan(50);
        expect(state.health).toBeGreaterThan(0);
        expect(state.energy).toBeLessThanOrEqual(100);
        expect(Number.isFinite(state.run.score + state.bonus)).toBe(true);
      }
      expect(state.run.result?.reason).toBe('distance-limit');
      expect(state.run.distance).toBe(FINISH_DISTANCE);
      expect(state.dodged).toBeGreaterThan(20);
      expect(state.coins).toBeGreaterThan(30);
    },
  );
});
