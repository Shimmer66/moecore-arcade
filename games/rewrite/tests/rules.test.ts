import { describe, expect, it } from 'vitest';
import {
  advanceLevel,
  chooseUpgrade,
  createRun,
  levels,
  retryLevel,
  stepRun,
  type RunState,
} from '../src/rules';

const idle = { horizontal: 0 as const, jump: false, shoot: false };

describe('rewrite run', () => {
  it('gives each fictional persona a distinct starting style', () => {
    expect(createRun('claude').shield).toBe(1);
    const deepseek = stepRun({ ...createRun('deepseek'), x: 6 }, { ...idle, shoot: true }, 1 / 60);
    const gpt = stepRun({ ...createRun('gpt'), x: 6 }, { ...idle, shoot: true }, 1 / 60);
    expect(gpt.shotCooldown).toBeLessThan(deepseek.shotCooldown);
  });

  it('jumps, falls and lands on the starting platform', () => {
    let state = stepRun(createRun(), { ...idle, jump: true }, 1 / 60);
    expect(state.y).toBeGreaterThan(0);
    for (let i = 0; i < 90; i += 1) state = stepRun(state, idle, 1 / 60);
    expect(state.y).toBe(0);
    expect(state.phase).toBe('running');
  });

  it('fires forward and clears a target', () => {
    let state = { ...createRun(), x: 6, y: 0 };
    for (let i = 0; i < 20; i += 1) state = stepRun(state, { ...idle, shoot: i === 0 }, 1 / 60);
    expect(state.defeated).toBe(1);
    expect(state.enemies[0]?.alive).toBe(false);
  });

  it('stops for a meaningful ability choice and applies only the offered option', () => {
    const arrived = stepRun({ ...createRun(), x: 11.39 }, { ...idle, horizontal: 1 }, 1 / 60);
    expect(arrived.phase).toBe('upgrade');
    expect(chooseUpgrade(arrived, 'rapid')).toBe(arrived);
    const selected = chooseUpgrade(arrived, 'shield');
    expect(selected.phase).toBe('running');
    expect(selected.shield).toBe(1);
    expect(selected.upgrades).toEqual(['shield']);
  });

  it('keeps the finish closed until the large enemy is defeated', () => {
    const atExit = { ...createRun('deepseek', 4), x: 32.59 };
    const blocked = stepRun(atExit, { ...idle, horizontal: 1 }, 1 / 60);
    expect(blocked.phase).toBe('running');
    const cleared = {
      ...atExit,
      enemies: atExit.enemies.map((enemy) =>
        enemy.kind === 'boss' ? { ...enemy, hp: 0, alive: false } : enemy,
      ),
    };
    const won = stepRun(cleared, { ...idle, horizontal: 1 }, 1 / 60);
    expect(won.phase).toBe('won');
  });

  it('makes staying still near a shooter unsafe', () => {
    let state: RunState = {
      ...createRun('deepseek', 4),
      x: 13,
      enemies: createRun('deepseek', 4).enemies.map((enemy) =>
        enemy.kind === 'turret' && enemy.x === 15 ? { ...enemy, shotCooldown: 0 } : enemy,
      ),
    };
    for (let i = 0; i < 400 && state.phase === 'running'; i += 1)
      state = stepRun(state, idle, 1 / 60);
    expect(state.phase).toBe('lost');
  });

  it('lets a jump reach the raised shield pickup', () => {
    let state = { ...createRun(), x: 4.5 };
    for (let i = 0; i < 45 && state.collected === 0; i += 1)
      state = stepRun(state, { ...idle, horizontal: 1, jump: i === 0 }, 1 / 60);
    expect(state.collected).toBe(1);
    expect(state.shield).toBe(1);
  });

  it('lets spread shot break a replying turret in one volley', () => {
    const setup = {
      ...createRun('deepseek', 1),
      x: 11.5,
      enemies: createRun('deepseek', 1).enemies.map((enemy) =>
        enemy.kind === 'turret' && enemy.x === 13
          ? { ...enemy, shotCooldown: 100, shotsFired: 1 }
          : { ...enemy, hp: 0, alive: false },
      ),
    };
    let plain: RunState = setup;
    let spread: RunState = { ...setup, upgrades: ['spread'] };
    for (let i = 0; i < 12; i += 1) {
      plain = stepRun(plain, { ...idle, shoot: true }, 1 / 60);
      spread = stepRun(spread, { ...idle, shoot: true }, 1 / 60);
    }
    expect(spread.enemies[1]!.hp).toBeLessThan(plain.enemies[1]!.hp);
  });

  it('allows only one boss hit per reply window', () => {
    const initial = createRun('deepseek', 4);
    let state: RunState = {
      ...initial,
      x: 28.5,
      upgrades: ['spread', 'rapid'],
      enemies: initial.enemies.map((enemy) =>
        enemy.kind === 'boss'
          ? { ...enemy, shotCooldown: 100, shotsFired: 1 }
          : { ...enemy, hp: 0, alive: false },
      ),
    };
    for (let i = 0; i < 60; i += 1) state = stepRun(state, { ...idle, shoot: true }, 1 / 60);
    expect(state.enemies[4]!.hp).toBe(state.enemies[4]!.maxHp - 1);
  });

  it('lets a player who reads the low and high boss replies win the duel', () => {
    const initial = createRun('deepseek', 4);
    let state: RunState = {
      ...initial,
      x: 28.5,
      enemies: initial.enemies.map((enemy) =>
        enemy.kind === 'boss' ? enemy : { ...enemy, alive: false },
      ),
    };
    let jumpNext = false;
    for (let i = 0; i < 1200 && state.enemies[4]!.alive && state.phase === 'running'; i += 1) {
      const shotsBefore = state.enemies[4]!.shotsFired;
      state = stepRun(state, { horizontal: 0, jump: jumpNext, shoot: true }, 1 / 60);
      jumpNext =
        state.enemies[4]!.shotsFired > shotsBefore && state.enemies[4]!.shotsFired % 2 === 1;
    }
    expect(state.enemies[4]!.alive).toBe(false);
    expect(state.health).toBeGreaterThan(0);
  });

  it('opens the large enemy only after its first attack', () => {
    const initial = createRun('deepseek', 4);
    const setup: RunState = {
      ...initial,
      x: 28.5,
      enemies: initial.enemies.map((enemy) =>
        enemy.kind === 'boss' ? { ...enemy, shotCooldown: 100 } : { ...enemy, hp: 0, alive: false },
      ),
    };
    let guarded = setup;
    let exposed: RunState = {
      ...setup,
      enemies: setup.enemies.map((enemy) =>
        enemy.kind === 'boss' ? { ...enemy, shotsFired: 1 } : enemy,
      ),
    };
    for (let i = 0; i < 60; i += 1) {
      guarded = stepRun(guarded, { ...idle, shoot: true }, 1 / 60);
      exposed = stepRun(exposed, { ...idle, shoot: true }, 1 / 60);
    }
    expect(guarded.enemies[4]!.hp).toBe(guarded.enemies[4]!.maxHp);
    expect(exposed.enemies[4]!.hp).toBeLessThan(exposed.enemies[4]!.maxHp);
  });

  it('makes a guarded read-receipt turret vulnerable only after its reply', () => {
    const initial = createRun('gpt', 1);
    const target = initial.enemies[1]!;
    const setup: RunState = {
      ...initial,
      x: 11.5,
      enemies: initial.enemies.map((enemy, index) =>
        index === 1 ? { ...enemy, shotCooldown: 100 } : { ...enemy, hp: 0, alive: false },
      ),
    };
    let guarded = setup;
    let replying: RunState = {
      ...setup,
      enemies: setup.enemies.map((enemy, index) =>
        index === 1 ? { ...enemy, shotsFired: 1 } : enemy,
      ),
    };
    for (let i = 0; i < 12; i += 1) {
      guarded = stepRun(guarded, { ...idle, shoot: true }, 1 / 60);
      replying = stepRun(replying, { ...idle, shoot: true }, 1 / 60);
    }
    expect(guarded.enemies[1]!.hp).toBe(target.maxHp);
    expect(replying.enemies[1]!.hp).toBeLessThan(target.maxHp);
  });

  it('makes the high route avoid context loss', () => {
    const initial = createRun('claude', 2);
    const low = stepRun({ ...initial, x: 10.96, shield: 2 }, { ...idle, horizontal: 1 }, 1 / 30);
    const high = stepRun(
      { ...initial, x: 10.96, y: 2.1, shield: 2 },
      { ...idle, horizontal: 1 },
      1 / 30,
    );
    expect(low.traps[0]?.triggered).toBe(true);
    expect(low.shield).toBe(0);
    expect(high.traps[0]?.triggered).toBe(false);
    expect(high.shield).toBe(3);
  });

  it('lets a shot verify a false bridge before the player reaches it', () => {
    let state: RunState = {
      ...createRun('deepseek', 4),
      x: 8.5,
      enemies: createRun('deepseek', 4).enemies.map((enemy) => ({ ...enemy, alive: false })),
    };
    for (let i = 0; i < 30 && !state.traps[0]?.verified; i += 1)
      state = stepRun(state, { ...idle, shoot: true }, 1 / 60);
    expect(state.traps[0]?.verified).toBe(true);
    const fall = stepRun({ ...createRun('deepseek', 4), x: 10.5, y: -0.14, vy: -2 }, idle, 1 / 60);
    expect(fall.traps[0]?.triggered).toBe(true);
  });

  it('alternates low and high overtime replies', () => {
    const initial = createRun('deepseek', 3);
    const setup: RunState = {
      ...initial,
      x: 4.8,
      enemies: initial.enemies.map((enemy) =>
        enemy.kind === 'turret' && enemy.x === 6
          ? { ...enemy, shotCooldown: 0 }
          : { ...enemy, alive: false },
      ),
    };
    const low = stepRun(setup, idle, 1 / 60);
    const high = stepRun(
      {
        ...setup,
        enemies: setup.enemies.map((enemy) =>
          enemy.kind === 'turret' && enemy.x === 6 ? { ...enemy, shotsFired: 1 } : enemy,
        ),
      },
      idle,
      1 / 60,
    );
    expect(low.enemyBullets[0]?.y).toBe(0.7);
    expect(high.enemyBullets[0]?.y).toBe(1.7);
  });

  it('connects five distinct, traversable stages into one run', () => {
    expect(levels).toHaveLength(5);
    expect(new Set(levels.map((level) => level.title)).size).toBe(5);
    let state: RunState = createRun('claude');
    for (let levelIndex = 0; levelIndex < levels.length; levelIndex += 1) {
      state = {
        ...state,
        enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0, alive: false })),
      };
      for (
        let i = 0;
        i < 2000 && (state.phase === 'running' || state.phase === 'upgrade');
        i += 1
      ) {
        if (state.phase === 'upgrade') {
          state = chooseUpgrade(state, state.checkpoint === 1 ? 'spread' : 'rapid');
          continue;
        }
        const floor = levels[levelIndex]!.platforms.find(
          (platform) => platform.top === 0 && state.x >= platform.from && state.x <= platform.to,
        );
        state = stepRun(
          state,
          {
            horizontal: 1,
            jump: Boolean(floor && floor.to < 34 && state.y === 0 && state.x >= floor.to - 0.8),
            shoot: false,
          },
          1 / 60,
        );
      }
      expect(state.phase).toBe(levelIndex === levels.length - 1 ? 'won' : 'level-complete');
      if (state.phase === 'level-complete') state = advanceLevel(state);
    }
    expect(state.levelIndex).toBe(4);
    expect(state.upgrades).toEqual(['spread', 'rapid']);
  });

  it('does not let hold-right-and-fire clear all five stages without reacting', () => {
    let state: RunState = createRun('claude');
    for (
      let levelIndex = 0;
      levelIndex < levels.length && state.phase !== 'lost';
      levelIndex += 1
    ) {
      for (
        let i = 0;
        i < 2000 && (state.phase === 'running' || state.phase === 'upgrade');
        i += 1
      ) {
        if (state.phase === 'upgrade') {
          state = chooseUpgrade(state, state.checkpoint === 1 ? 'spread' : 'rapid');
          continue;
        }
        const floor = levels[levelIndex]!.platforms.find(
          (platform) => platform.top === 0 && state.x >= platform.from && state.x <= platform.to,
        );
        state = stepRun(
          state,
          {
            horizontal: 1,
            jump: Boolean(floor && floor.to < 34 && state.y === 0 && state.x >= floor.to - 0.8),
            shoot: true,
          },
          1 / 60,
        );
      }
      if (state.phase === 'level-complete') state = advanceLevel(state);
    }
    expect(state.phase).toBe('lost');
    expect(state.levelIndex).toBeGreaterThan(0);
  });

  it('retries only the current stage and keeps earned abilities', () => {
    const failed: RunState = {
      ...createRun('gpt', 3),
      phase: 'lost',
      health: 0,
      upgrades: ['spread', 'rapid'],
      totalCollected: 6,
      totalDefeated: 9,
    };
    const retry = retryLevel(failed);
    expect(retry.levelIndex).toBe(3);
    expect(retry.phase).toBe('running');
    expect(retry.health).toBe(3);
    expect(retry.upgrades).toEqual(['spread', 'rapid']);
    expect(retry.totalCollected).toBe(6);
    expect(retry.totalDefeated).toBe(9);
    expect(retry.enemies.every((enemy) => enemy.alive)).toBe(true);
  });
});
