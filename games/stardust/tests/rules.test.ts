import { describe, expect, it } from 'vitest';
import {
  advanceVersusMatch,
  applyCombatHit,
  createCombatState,
  DIO_BOSS_HP,
  createVersusMatch,
  ROUND_BREAK_MS,
  ROUND_SECONDS,
  settleRound,
} from '../src/rules';

describe('local versus match rules', () => {
  it('supports 1000 HP for boss DIO while selectable fighters retain 500 HP', () => {
    for (const side of ['p1', 'p2'] as const) {
      expect(createCombatState(side)).toMatchObject({ hp: 500, maxHp: 500 });
    }
    const boss = createCombatState('p2', DIO_BOSS_HP);
    expect(boss).toMatchObject({ hp: 1000, maxHp: 1000 });
    boss.hp = 200;
    expect(createCombatState('p2', DIO_BOSS_HP)).toMatchObject({ hp: 1000, maxHp: 1000 });
  });
  it('resolves damage, guard, energy and combos without browser dependencies', () => {
    const attacker = { ...createCombatState('p1'), id: 'jotaro' };
    const defender = { ...createCombatState('p2'), id: 'kakyoin' };
    expect(applyCombatHit(attacker, defender, 'heavy', 'body')).toEqual({
      damage: 13,
      guarded: false,
    });
    expect(defender).toMatchObject({ hp: 487, x: 80, stun: 13 });
    expect(attacker).toMatchObject({ hp: 500, energy: 42, combo: 1 });
    defender.guard = true;
    const hit = applyCombatHit(attacker, defender, 'stand', 'body');
    expect(hit.guarded).toBe(true);
    expect(hit.damage).toBeLessThan(10);
    expect(defender.statusEffects).toEqual([]);
  });

  it('reflects remote stand hits without body knockback and clamps HP and energy', () => {
    const attacker = { ...createCombatState('p1'), id: 'jotaro', energy: 99 };
    const defender = { ...createCombatState('p2'), id: 'kakyoin', guard: true };
    expect(applyCombatHit(attacker, defender, 'stand', 'stand')).toEqual({
      damage: 7.5,
      guarded: false,
    });
    expect(defender).toMatchObject({ hp: 492.5, x: 75, stun: 0, standControl: { stunMs: 100 } });
    expect(defender.statusEffects).toEqual([]);
    expect(attacker.energy).toBe(100);
    defender.hp = 1;
    applyCombatHit(attacker, defender, 'stand', 'body', true);
    expect(defender.hp).toBe(0);
  });

  it('requires two wins, awards each round once, and locks the final result', () => {
    const first = settleRound(createVersusMatch(), 45, 0);
    expect(first).toMatchObject({ phase: 'break', wins: { p1: 1, p2: 0 }, winner: null });
    expect(settleRound(first, 45, 0)).toBe(first);
    const second = advanceVersusMatch(first, ROUND_BREAK_MS, 45, 0);
    expect(second).toMatchObject({ round: 2, phase: 'fight', remainingMs: 75000 });
    const result = settleRound(second, 100, 0);
    expect(result).toMatchObject({ phase: 'complete', wins: { p1: 2, p2: 0 }, winner: 'p1' });
    expect(advanceVersusMatch(result, 100000, 0, 100)).toBe(result);
  });

  it('supports a 1-1 decider and a P2 match win', () => {
    let match = settleRound(createVersusMatch(), 100, 0);
    match = advanceVersusMatch(match, ROUND_BREAK_MS, 100, 0);
    match = settleRound(match, 0, 100);
    expect(match.wins).toEqual({ p1: 1, p2: 1 });
    match = advanceVersusMatch(match, ROUND_BREAK_MS, 0, 100);
    expect(match.round).toBe(3);
    expect(settleRound(match, 0, 60)).toMatchObject({
      phase: 'complete',
      winner: 'p2',
      wins: { p1: 1, p2: 2 },
    });
  });

  it('uses remaining HP at timeout without giving ties to P1', () => {
    const initial = createVersusMatch();
    expect(advanceVersusMatch(initial, 74999, 90, 100).phase).toBe('fight');
    expect(advanceVersusMatch(initial, 75000, 90, 100)).toMatchObject({
      phase: 'break',
      roundWinner: 'p2',
      reason: 'timeout',
    });
    const draw = advanceVersusMatch(initial, 75000, 100, 100);
    expect(draw).toMatchObject({ phase: 'break', wins: { p1: 0, p2: 0 }, roundWinner: null });
    expect(advanceVersusMatch(draw, ROUND_BREAK_MS, 100, 100)).toMatchObject({
      round: 2,
      wins: { p1: 0, p2: 0 },
      remainingMs: ROUND_SECONDS * 1000,
    });
    expect(settleRound(initial, 0, 0)).toMatchObject({ reason: 'ko', roundWinner: null });
  });

  it('freezes active and inter-round clocks and discards overshoot on reset', () => {
    const initial = createVersusMatch();
    expect(advanceVersusMatch(initial, 90000, 100, 100, true)).toBe(initial);
    const ended = settleRound(initial, 100, 0);
    expect(advanceVersusMatch(ended, 90000, 100, 0, true)).toBe(ended);
    const waiting = advanceVersusMatch(ended, ROUND_BREAK_MS - 1, 100, 0);
    expect(waiting.phase).toBe('break');
    expect(advanceVersusMatch(waiting, 5000, 100, 0).remainingMs).toBe(75000);
    expect(initial.wins).toEqual({ p1: 0, p2: 0 });
  });

  it('creates independent clean combat state for every round and replay', () => {
    const previous = createCombatState('p1');
    previous.hp = 1;
    previous.energy = 100;
    previous.standControl.mode = 'detached';
    previous.statusEffects.push({ kind: 'burn', part: 'body', remainingMs: 3000, tickMs: 1000 });
    const fresh = createCombatState('p1');
    expect(fresh).toMatchObject({
      hp: 500,
      energy: 30,
      x: 25,
      facing: 1,
      down: false,
      attack: null,
      barrageMs: 0,
      stun: 0,
      combo: 0,
      timeStopsUsed: 0,
      guard: false,
      crouch: false,
      jumpMs: 0,
      statusEffects: [],
      standControl: { mode: 'attached', x: 25, cooldownMs: 0 },
    });
    expect(createCombatState('p2')).toMatchObject({ hp: 500, energy: 20, x: 75, facing: -1 });
    expect(createVersusMatch()).toMatchObject({ round: 1, wins: { p1: 0, p2: 0 } });
  });
});
