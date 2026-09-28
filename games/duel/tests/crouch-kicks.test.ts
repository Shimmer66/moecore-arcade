import { expect, it } from 'vitest';
import { createBattle, advance, emptyInput, type Command } from '../src/rules';
import { isCrouched } from '../src/stance';
import { combatPose } from '../src/combat-pose';
import { motionFrame } from '../src/motion-frame';
const press = (...commands: Command[]) => ({ ...emptyInput(), commands });
function setup() {
  const b = createBattle('deepseek', 'gpt', 1, { localVersus: true });
  b.phase = 'fight';
  b.fighters[0].x = 400;
  b.fighters[1].x = 455;
  return b;
}
it('crouch guard stays low through blockstun and returns upright on release', () => {
  const b = setup(),
    f = b.fighters[0];
  advance(b, { ...emptyInput(), crouch: true, guard: true }, emptyInput());
  expect(f.action).toBe('guard');
  expect(isCrouched(f)).toBe(true);
  b.projectiles.push({ id: 99, owner: 1, x: 409, y: 52, direction: -1, life: 40 });
  advance(b, { ...emptyInput(), crouch: true, guard: true }, emptyInput());
  expect(f.action).toBe('block');
  expect(isCrouched(f)).toBe(true);
  for (let i = 0; i < 20; i++) advance(b, emptyInput(), emptyInput());
  expect(f.action).toBe('idle');
  expect(isCrouched(f)).toBe(false);
});
it('low punch has a low hurtbox and never selects standing jab artwork', () => {
  const b = setup(),
    f = b.fighters[0];
  advance(b, { ...press('light'), crouch: true }, emptyInput());
  expect(f.action).toBe('low');
  expect(isCrouched(f)).toBe(true);
  expect(combatPose('deepseek', 'low', 0)).toBe('crouch');
  expect(combatPose('deepseek', 'low', 7)).toBe('low_hit');
  expect(combatPose('deepseek', 'low', 18)).toBe('crouch');
  b.projectiles.push({ id: 77, owner: 1, x: 409, y: 100, direction: -1, life: 40 });
  advance(b, emptyInput(), emptyInput());
  expect(f.hp).toBe(1000);
});
it('stand kick and crouch sweep are different attacks and sweep misses airborne targets', () => {
  const b = setup();
  advance(b, press('kick'), emptyInput());
  expect(b.fighters[0].action).toBe('kick');
  for (let i = 0; i < 14; i++) advance(b, emptyInput(), emptyInput());
  expect(b.fighters[1].hp).toBe(935);
  const c = setup();
  advance(c, { ...press('kick'), crouch: true }, emptyInput());
  expect(c.fighters[0].action).toBe('sweep');
  for (let i = 0; i < 16; i++) advance(c, emptyInput(), emptyInput());
  expect(c.fighters[1].hp).toBe(945);
  expect(c.fighters[1].action).toBe('down');
  const d = setup();
  advance(d, { ...press('kick'), crouch: true }, press('jump'));
  for (let i = 0; i < 16; i++) advance(d, emptyInput(), emptyInput());
  expect(d.fighters[1].hp).toBe(1000);
});
it('uppercut leaves its crouch on the active frame and animation follows move phases', () => {
  const b = setup(),
    f = b.fighters[0];
  f.action = 'upper';
  f.age = 11;
  expect(isCrouched(f)).toBe(true);
  f.age = 12;
  expect(isCrouched(f)).toBe(false);
  expect([0, 6, 9, 16].map((age) => motionFrame('deepseek', 'light1', age, 0))).toEqual([
    4, 5, 6, 7,
  ]);
  expect([0, 5, 10, 15].map((frame) => motionFrame('gpt', 'walk', 0, frame))).toEqual([0, 1, 2, 3]);
  expect(motionFrame('deepseek', 'dash', 0, -2)).toBe(3);
  expect(motionFrame('doubao', 'down', 40, 0, false, 10)).toBe(21);
  expect(motionFrame('doubao', 'down', 40, 0, true, 10)).toBe(23);
});
