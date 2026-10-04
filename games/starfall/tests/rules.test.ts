import { describe, expect, it } from 'vitest';
import { createBattle, emptyInput, MAX_HP, step, type Battle, type Input } from '../src/rules';

const neutral = emptyInput();
const input = (value: Partial<Input>): Input => ({ ...emptyInput(), ...value });
const advance = (battle: Battle, frames: number, a = neutral, b = neutral) => {
  for (let frame = 0; frame < frames; frame++) step(battle, [a, b]);
};

describe('starfall battle rules', () => {
  it('counts down before accepting movement', () => {
    const battle = createBattle();
    advance(battle, 60, input({ move: 1 }));
    expect(battle.fighters[0].x).toBe(260);
    advance(battle, 30);
    step(battle, [input({ move: 1 }), neutral]);
    expect(battle.phase).toBe('fight');
    expect(battle.fighters[0].x).toBeGreaterThan(260);
  });

  it('supports jumping and landing', () => {
    const battle = createBattle();
    advance(battle, 90);
    step(battle, [input({ jump: true }), neutral]);
    expect(battle.fighters[0].y).toBeGreaterThan(0);
    advance(battle, 70);
    expect(battle.fighters[0].y).toBe(0);
  });

  it('deals damage, builds meter, and records combos', () => {
    const battle = createBattle();
    advance(battle, 90);
    battle.fighters[0].x = 500;
    battle.fighters[1].x = 570;
    step(battle, [input({ light: true }), neutral]);
    advance(battle, 8);
    expect(battle.fighters[1].hp).toBeLessThan(MAX_HP);
    expect(battle.fighters[0].meter).toBeGreaterThan(0);
    expect(battle.fighters[0].combo).toBe(1);
  });

  it('reduces guarded damage and lets dodges evade strikes', () => {
    const guarded = createBattle();
    advance(guarded, 90);
    guarded.fighters[0].x = 500;
    guarded.fighters[1].x = 570;
    step(guarded, [input({ heavy: true }), input({ guard: true })]);
    advance(guarded, 17, neutral, input({ guard: true }));
    expect(guarded.fighters[1].hp).toBeGreaterThan(950);

    const dodged = createBattle();
    advance(dodged, 90);
    dodged.fighters[0].x = 500;
    dodged.fighters[1].x = 570;
    step(dodged, [input({ heavy: true }), input({ dodge: true })]);
    advance(dodged, 17);
    expect(dodged.fighters[1].hp).toBe(MAX_HP);
  });

  it('turns a full meter special into a multi-hit finisher', () => {
    const battle = createBattle();
    advance(battle, 90);
    battle.fighters[0].x = 500;
    battle.fighters[1].x = 600;
    battle.fighters[0].meter = 100;
    step(battle, [input({ special: true }), neutral]);
    expect(battle.fighters[0].action).toBe('super');
    advance(battle, 56);
    expect(battle.fighters[0].meter).toBe(0);
    expect(battle.fighters[0].maxCombo).toBeGreaterThanOrEqual(3);
  });

  it('ends a best-of-three match after two round wins', () => {
    const battle = createBattle();
    for (let round = 0; round < 2; round++) {
      advance(battle, 90);
      battle.fighters[1].hp = 1;
      battle.fighters[0].x = 500;
      battle.fighters[1].x = 570;
      step(battle, [input({ light: true }), neutral]);
      advance(battle, 160);
    }
    expect(battle.phase).toBe('done');
    expect(battle.winner).toBe(0);
    expect(battle.scores).toEqual([2, 0]);
  });
});
