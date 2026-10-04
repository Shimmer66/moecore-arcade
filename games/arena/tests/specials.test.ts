import { expect, it } from 'vitest';
import { openRoom, RoomRunner } from '../src/runner';
import { CAMPAIGN } from '../src/campaign';

it('blocks walking through the moving wall rather than drawing a decorative obstacle', () => {
  const run = openRoom(40);
  for (let i = 0; i < 600; i++) run.step(1, false);
  expect(run.rect.x).toBeLessThan(500);
  expect(run.phase).not.toBe('clear');
  run.dispose();
});
it('requires more than an ordinary jump to cross the recursion gap', () => {
  const run = new RoomRunner({ ...CAMPAIGN[41]!, traps: [] });
  let jumped = false;
  for (let i = 0; i < 500; i++) {
    const jump = run.rect.x >= 200 && !jumped;
    if (jump) jumped = true;
    run.step(1, jump);
  }
  expect(run.phase).toBe('dead');
  run.dispose();
});
it('uses finite fuel while thrusting and refills only on landing', () => {
  const run = openRoom(42);
  run.step(0, false);
  for (let i = 0; i < 60; i++) run.step(0, true);
  expect(run.fuel).toBe(0);
  expect(run.rect.y).toBeLessThan(306);
  for (let i = 0; i < 160; i++) run.step(0, false);
  expect(run.phase).toBe('playing');
  expect(run.grounded).toBe(true);
  expect(run.fuel).toBe(60);
  run.dispose();
});
