import { describe, expect, it } from 'vitest';
import {
  createBattle,
  emptyInput,
  nextRound,
  ROUND_FRAMES,
  step,
  type Battle,
  type FighterInput,
} from '../src/rules';

function frames(
  battle: Battle,
  count: number,
  a: Partial<FighterInput> = {},
  b: Partial<FighterInput> = {},
) {
  for (let frame = 0; frame < count; frame += 1)
    battle = step(battle, [
      { ...emptyInput(), ...a },
      { ...emptyInput(), ...b },
    ]);
  return battle;
}

describe('uncle fighting rules', () => {
  it('moves, jumps and lands inside the arena', () => {
    let battle = frames(createBattle(), 20, { right: true });
    expect(battle.fighters[0].x).toBeGreaterThan(250);
    battle = step(battle, [{ ...emptyInput(), jump: true }, emptyInput()]);
    expect(battle.fighters[0].y).toBeGreaterThan(0);
    battle = frames(battle, 80);
    expect(battle.fighters[0].y).toBe(0);
  });

  it('deals damage once per attack and applies hitstun', () => {
    let battle = createBattle();
    battle.fighters[0].x = 400;
    battle.fighters[1].x = 470;
    battle = frames(battle, 8, { light: true });
    expect(battle.fighters[1].hp).toBe(92);
    expect(battle.fighters[1].hitstun).toBeGreaterThan(0);
    battle = frames(battle, 18, { light: true });
    expect(battle.fighters[1].hp).toBe(92);
  });

  it('reduces damage when guarding toward the attacker', () => {
    let battle = createBattle();
    battle.fighters[0].x = 400;
    battle.fighters[1].x = 470;
    let blocked = false;
    for (let frame = 0; frame < 8; frame += 1) {
      battle = step(battle, [
        { ...emptyInput(), light: true },
        { ...emptyInput(), guard: true },
      ]);
      blocked ||= battle.events.some((event) => event.type === 'block');
    }
    expect(battle.fighters[1].hp).toBe(98);
    expect(blocked).toBe(true);
  });

  it('puts specials on cooldown', () => {
    let battle = step(createBattle(), [{ ...emptyInput(), special: true }, emptyInput()]);
    expect(battle.fighters[0].action).toBe('special');
    expect(battle.fighters[0].specialCooldown).toBe(240);
    battle = frames(battle, 50, { special: true });
    expect(battle.fighters[0].action).not.toBe('special');
    expect(battle.fighters[0].specialCooldown).toBeGreaterThan(0);
  });

  it('settles timeouts and advances a best-of-three match', () => {
    let battle = createBattle();
    battle.fighters[1].hp = 80;
    battle = frames(battle, ROUND_FRAMES);
    expect(battle.phase).toBe('round-end');
    expect(battle.winner).toBe(0);
    expect(battle.scores).toEqual([1, 0]);
    battle = nextRound(battle);
    expect(battle.round).toBe(2);
    expect(battle.scores).toEqual([1, 0]);
    battle.fighters[1].hp = 0;
    battle = step(battle, [emptyInput(), emptyInput()]);
    expect(battle.phase).toBe('match-end');
    expect(battle.scores).toEqual([2, 0]);
  });
});
