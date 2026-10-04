import { expect, it } from 'vitest';
import { openRoom } from '../src/runner';
import { move } from './routes';

it('arms a poisoned collectible before exploding and allows a moving player to escape', () => {
  const standing = openRoom(43);
  move(standing, 300);
  expect(standing.phase).toBe('playing');
  expect(standing.traps.find((view) => view.trap.effect === 'mine')?.phase).toBe('warning');
  for (let i = 0; i < 40; i++) standing.step(0, false);
  expect(standing.phase).toBe('dead');
  expect(standing.deathTrap).toBe('mine');
  standing.dispose();
  const escaping = openRoom(43);
  move(escaping, 460);
  expect(escaping.phase).toBe('playing');
  expect(escaping.traps.find((view) => view.trap.effect === 'mine')?.phase).toBe('spent');
  escaping.dispose();
});
it('homes toward a stationary player instead of following a fixed decorative path', () => {
  const run = openRoom(44);
  move(run, 300);
  for (let i = 0; i < 300 && run.phase === 'playing'; i++) run.step(0, false);
  expect(run.phase).toBe('dead');
  expect(run.deathTrap).toBe('seeker');
  run.dispose();
});
it('moves and grows the collectible used by the collision rule', () => {
  const run = openRoom(43);
  const first = run.secretPoint;
  for (let i = 0; i < 40; i++) run.step(0, false);
  expect(run.secretPoint.y).not.toBe(first.y);
  expect(run.secretPoint.radius).toBeGreaterThan(30);
  expect(run.secretPoint.radius).not.toBe(first.radius);
  run.dispose();
});
