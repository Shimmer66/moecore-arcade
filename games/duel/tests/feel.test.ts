import { expect, it } from 'vitest';
import {
  advance,
  createBattle,
  emptyInput,
  type Battle,
  type Command,
  type Input,
} from '../src/rules';
const press = (...commands: Command[]): Input => ({ ...emptyInput(), commands });
function setup(id: 'deepseek' | 'gpt' = 'deepseek') {
  const b = createBattle(id, 'doubao');
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 455;
  return b;
}
function frames(b: Battle, n: number, input = emptyInput(), foe = emptyInput()) {
  for (let i = 0; i < n; i++) advance(b, input, foe);
}
function until(b: Battle, fn: () => boolean) {
  for (let i = 0; i < 100 && !fn(); i++) advance(b, emptyInput(), emptyInput());
  expect(fn()).toBe(true);
}
it('retains crouch and dash direction from the press across hitstop', () => {
  const b = setup();
  b.freeze = 4;
  advance(
    b,
    { ...press('heavy'), crouch: false, contexts: { heavy: { crouch: true, move: 0 } } },
    emptyInput(),
  );
  frames(b, 5);
  expect(b.fighters[0].action).toBe('upper');
  const c = setup();
  c.freeze = 4;
  advance(c, { ...press('dash'), contexts: { dash: { crouch: false, move: -1 } } }, emptyInput());
  frames(c, 5);
  expect(c.fighters[0].dashDirection).toBe(-1);
  expect(c.fighters[0].x).toBeLessThan(400);
});
it('accepts an early second light within ten simulation frames without auto repeating held attacks', () => {
  const b = setup();
  advance(b, press('light'), emptyInput());
  advance(b, press('light'), emptyInput());
  until(b, () => b.fighters[0].action === 'light2');
  until(b, () => b.fighters[1].combo === 2);
  frames(b, 70);
  expect(b.fighters[0].maxCombo).toBe(2);
  expect(b.fighters[0].action).toBe('idle');
});
it('expires a command before a long recovery ends', () => {
  const b = setup();
  b.fighters[1].x = 800;
  advance(b, press('heavy'), emptyInput());
  advance(b, press('light'), emptyInput());
  frames(b, 60);
  expect(b.fighters[0].action).toBe('idle');
  expect(b.fighters[0].buffer).toBeNull();
});
it('hit-confirmed dash costs 15, links another strike and does not cancel a whiff or block', () => {
  const b = setup();
  b.fighters[0].energy = 30;
  advance(b, press('light'), emptyInput());
  until(b, () => b.fighters[0].contactHit);
  frames(b, b.freeze);
  const energy = b.fighters[0].energy;
  advance(b, press('dash'), emptyInput());
  expect(b.fighters[0].action).toBe('dash');
  expect(b.fighters[0].energy).toBeCloseTo(energy - 15);
  frames(b, 3);
  advance(b, press('light'), emptyInput());
  until(b, () => b.fighters[1].combo === 2);
  for (const guard of [true, false]) {
    const c = setup();
    c.fighters[0].energy = 30;
    if (!guard) c.fighters[1].x = 800;
    advance(c, press('light'), { ...emptyInput(), guard });
    frames(c, 8, emptyInput(), { ...emptyInput(), guard });
    advance(c, press('dash'), { ...emptyInput(), guard });
    frames(c, 2);
    expect(c.fighters[0].action).not.toBe('dash');
    expect(c.fighters[0].energy).toBe(30);
  }
});
it('rejects a paid dash cancel without meter and permits GPT skill into super on first hit', () => {
  const b = setup();
  advance(b, press('light'), emptyInput());
  until(b, () => b.fighters[0].contactHit);
  frames(b, b.freeze);
  advance(b, press('dash'), emptyInput());
  expect(b.fighters[0].action).toBe('light1');
  const c = setup('gpt');
  c.fighters[0].energy = 100;
  advance(c, press('skill'), emptyInput());
  until(c, () => c.fighters[0].contactHit);
  const beforeSuper = c.fighters[0].energy;
  advance(c, press('super'), emptyInput());
  until(c, () => c.phase === 'cinematic');
  expect(c.fighters[0].energy).toBeCloseTo(beforeSuper - 100);
  expect(c.fighters[0].maxCombo).toBe(2);
});
