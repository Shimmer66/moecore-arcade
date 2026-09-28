import { describe, expect, it } from 'vitest';
import {
  advance,
  createBattle,
  emptyInput,
  type Battle,
  type Command,
  type Input,
} from '../src/rules';
const press = (...commands: Command[]): Input => ({ ...emptyInput(), commands });
function setup() {
  const b = createBattle('deepseek', 'gpt');
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 455;
  return b;
}
function frames(b: Battle, n: number, input = emptyInput(), foe = emptyInput()) {
  for (let i = 0; i < n; i++) advance(b, input, foe);
}
function until(b: Battle, predicate: () => boolean, max = 120) {
  for (let i = 0; i < max && !predicate(); i++) advance(b, emptyInput(), emptyInput());
  expect(predicate()).toBe(true);
}
describe('anime fighter mobility and aerial combo contracts', () => {
  it('dashes in the selected direction and cancels into an attack after startup', () => {
    const b = setup();
    advance(b, { ...press('dash'), move: -1 }, emptyInput());
    expect(b.fighters[0].x).toBe(390);
    expect(b.fighters[0].invulnerable).toBe(0);
    frames(b, 4);
    advance(b, press('light'), emptyInput());
    expect(b.fighters[0].action).toBe('light1');
  });
  it('allows one aerial dash per airtime and resets it on landing', () => {
    const b = setup();
    advance(b, press('jump'), emptyInput());
    frames(b, 8);
    advance(b, { ...press('dash'), move: -1 }, emptyInput());
    expect(b.fighters[0].airDashUsed).toBe(true);
    frames(b, 17);
    advance(b, press('dash'), emptyInput());
    expect(b.fighters[0].action).not.toBe('dash');
    until(b, () => b.fighters[0].y === 0);
    expect(b.fighters[0].airDashUsed).toBe(false);
  });
  it('connects launcher, jump chase, aerial light and knockdown finisher through real inputs', () => {
    const b = setup();
    advance(b, { ...press('heavy'), crouch: true }, emptyInput());
    until(b, () => b.fighters[1].action === 'launched');
    expect(b.fighters[1].hp).toBe(925);
    advance(b, press('jump'), emptyInput());
    until(b, () => b.fighters[0].action === 'jump');
    expect(b.events.some((e) => e.kind === 'chase')).toBe(true);
    advance(b, press('light'), emptyInput());
    until(b, () => b.fighters[1].combo === 2);
    expect(b.fighters[1].y).toBeGreaterThan(0);
    advance(b, press('heavy'), emptyInput());
    until(b, () => b.fighters[1].action === 'down');
    expect(b.fighters[1].combo).toBe(3);
    expect(b.fighters[1].hp).toBe(815);
    expect(b.fighters[1].vy).toBe(-720);
    until(b, () => b.fighters[1].y === 0);
    expect(b.fighters[1].action).toBe('down');
  });
  it('does not allow a whiff or blocked launcher to jump cancel', () => {
    for (const blocked of [false, true]) {
      const b = setup();
      if (!blocked) b.fighters[1].x = 800;
      advance(b, { ...press('heavy'), crouch: true }, { ...emptyInput(), guard: blocked });
      frames(b, 15, emptyInput(), { ...emptyInput(), guard: blocked });
      advance(b, press('jump'), { ...emptyInput(), guard: blocked });
      expect(b.fighters[0].action).toBe('upper');
      expect(b.fighters[1].hp).toBe(1000);
    }
  });
  it('preserves combo protection and allows paid burst out of a launch', () => {
    const b = setup();
    b.fighters[1].energy = 60;
    advance(b, { ...press('heavy'), crouch: true }, emptyInput());
    until(b, () => b.fighters[1].action === 'launched');
    frames(b, b.freeze);
    advance(b, emptyInput(), press('burst'));
    expect(b.fighters[1].burstUsed).toBe(true);
    expect(b.fighters[1].combo).toBe(0);
    expect(b.fighters[1].energy).toBe(13);
    const c = setup();
    c.fighters[1].combo = 4;
    c.fighters[1].comboDamage = 340;
    advance(c, { ...press('heavy'), crouch: true }, emptyInput());
    until(c, () => c.fighters[1].action === 'down');
    expect(c.fighters[1].hp).toBe(990);
  });
});
