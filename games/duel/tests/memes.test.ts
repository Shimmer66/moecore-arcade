import { describe, expect, it } from 'vitest';
import { advance, createBattle, emptyInput } from '../src/rules';
import type { Battle, BattleEvent, FighterId } from '../src/rules';
function fight(a: FighterId = 'deepseek', b: FighterId = 'gpt') {
  const state = createBattle(a, b);
  state.phase = 'fight';
  state.fighters[0].x = 400;
  state.fighters[1].x = 460;
  return state;
}
function frames(b: Battle, n: number, guard = false) {
  const events: BattleEvent[] = [];
  for (let i = 0; i < n; i++) {
    advance(b, emptyInput(), { ...emptyInput(), guard });
    events.push(...b.events);
  }
  return events;
}
function parry(b: Battle, action: 'light1' | 'heavy' = 'light1') {
  b.freeze = 0;
  Object.assign(b.fighters[0], {
    action: 'skill',
    age: 8,
    x: 400,
    stun: 0,
    invulnerable: 0,
    landed: [],
  });
  Object.assign(b.fighters[1], {
    action,
    age: action === 'light1' ? 6 : 11,
    x: 460,
    stun: 0,
    invulnerable: 0,
    serial: b.nextId++,
    landed: [],
  });
  advance(b, emptyInput(), emptyInput());
  return b.events;
}
describe('original meme event boundaries', () => {
  it('cache hit requires a previously parried move and remembers different moves independently', () => {
    const b = fight();
    expect(parry(b).some((e) => e.effect === 'cache-hit')).toBe(false);
    expect(parry(b).some((e) => e.effect === 'cache-hit' && e.target === 0)).toBe(true);
    expect(parry(b, 'heavy').some((e) => e.effect === 'cache-hit')).toBe(false);
    expect(parry(b, 'heavy').some((e) => e.effect === 'cache-hit')).toBe(true);
    expect(b.fighters[0].cachedParries).toEqual(['gpt:light1', 'gpt:heavy']);
  });
  it('resets parry memory with the next round', () => {
    const b = fight();
    parry(b);
    b.freeze = 0;
    b.fighters[1].hp = 0;
    frames(b, 1);
    frames(b, 120);
    expect(b.phase).toBe('countdown');
    expect(b.fighters[0].cachedParries).toEqual([]);
  });
  it('muffling requires real bubble damage to GPT, not a block', () => {
    for (const guard of [false, true]) {
      const b = fight('doubao', 'gpt');
      b.projectiles.push({ id: 999, owner: 0, x: 430, y: 52, direction: 1, life: 60 });
      advance(b, emptyInput(), { ...emptyInput(), guard });
      expect(b.events.some((e) => e.effect === 'gpt-muffled')).toBe(!guard);
      expect(b.fighters[1].hp).toBe(guard ? 995 : 900);
    }
  });
  it('rollback animates an expired whiff exactly once without reverting position, meter or cooldown', () => {
    const b = fight('gpt', 'doubao');
    b.fighters[0].energy = 100;
    b.fighters[1].x = 850;
    advance(b, { ...emptyInput(), commands: ['variant'] }, emptyInput());
    const events = frames(b, 45);
    expect(events.filter((e) => e.effect === 'gpt-rollback')).toHaveLength(1);
    expect(b.fighters[0].x).toBe(460);
    expect(b.fighters[0].energy).toBe(75);
    expect(b.fighters[0].variantCooldown).toBeGreaterThan(0);
    expect(b.fighters[1].hp).toBe(1000);
  });
  it('a blocked variant can produce rollback but a successful variant cannot', () => {
    for (const guard of [false, true]) {
      const b = fight('gpt', 'doubao');
      b.fighters[0].energy = 100;
      advance(b, { ...emptyInput(), commands: ['variant'] }, { ...emptyInput(), guard });
      const events = frames(b, 45, guard);
      expect(events.some((e) => e.effect === 'gpt-rollback')).toBe(guard);
    }
  });
  it('sore loser follows the actual round result and never turns a draw or practice KO into a loss', () => {
    const b = fight();
    b.fighters[1].hp = 0;
    advance(b, emptyInput(), emptyInput());
    expect(b.scores).toEqual([1, 0]);
    expect(b.events.find((e) => e.effect === 'sore-loser')?.target).toBe(1);
    const draw = fight();
    draw.fighters.forEach((f) => (f.hp = 0));
    advance(draw);
    expect(draw.events.some((e) => e.effect === 'sore-loser')).toBe(false);
    const practice = fight();
    practice.options.practice = true;
    practice.fighters[1].hp = 0;
    advance(practice);
    expect(practice.events.some((e) => e.effect === 'sore-loser')).toBe(false);
  });
  it('the repeat-heavy practice dummy uses legal timed inputs and does not strike before its startup', () => {
    const b = fight();
    b.options.practice = true;
    b.options.dummy = 'repeat-heavy';
    b.tick = 88;
    advance(b);
    expect(b.fighters[1].action).toBe('idle');
    advance(b);
    expect(b.fighters[1].action).toBe('closeHeavy');
    expect(b.fighters[0].hp).toBe(1000);
  });
});
