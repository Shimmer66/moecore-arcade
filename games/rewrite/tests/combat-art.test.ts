import { describe, expect, it } from 'vitest';
import { createRun, stepRun } from '../src/rules';

describe('combat art event metadata', () => {
  it('emits weapon-specific muzzle, hit and enemy defeat effects without changing damage rules', () => {
    let state = createRun('gpt');
    const runner = state.enemies.find((enemy) => enemy.kind === 'runner')!;
    state.enemies = [{ ...runner, x: 2, hp: 1, maxHp: 1, cooldown: 999 }];
    state.x = 1;
    state.weapon = 'pulse';
    state.arsenal = ['pulse'];
    state.supplies = [];
    state.carriers = [];

    state = stepRun(state, { horizontal: 0, jump: false, shoot: true });
    expect(state.effects).toContainEqual(
      expect.objectContaining({ kind: 'muzzle', weapon: 'pulse' }),
    );

    for (let frame = 0; frame < 5; frame++)
      state = stepRun(state, { horizontal: 0, jump: false, shoot: false });

    expect(state.enemies[0]!.hp).toBeLessThanOrEqual(0);
    expect(state.effects).toContainEqual(expect.objectContaining({ kind: 'hit', weapon: 'pulse' }));
    expect(state.effects).toContainEqual(
      expect.objectContaining({ kind: 'defeat', enemy: 'runner' }),
    );
  });
});
