import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RoomRunner } from '../src/runner';
import { move } from './routes';

it('keeps the platform solid during approach and in flight, then collapses after landing', () => {
  const run = new RoomRunner(CAMPAIGN.find((room) => room.id === 'ephemeral-answer')!);
  move(run, 200);
  run.step(1, true);
  for (let tick = 0; tick < 30; tick++) run.step(1, false);
  expect(run.grounded).toBe(false);
  expect(run.scene.clocks.eviction!.triggeredAt).toBeNull();
  move(run, 410);
  for (let tick = 0; tick < 100 && run.scene.clocks.eviction!.triggeredAt === null; tick++)
    run.step(0, false);
  expect(run.phase).toBe('playing');
  expect(run.traps.find((view) => view.trap.id === 'eviction')?.phase).toBe('warning');
  expect(run.floors.some((floor) => floor.x === 330 && floor.y === 300)).toBe(true);
  for (let tick = 0; tick < 100 && run.phase === 'playing'; tick++) run.step(0, false);
  expect(run.phase).toBe('dead');
  expect(run.deathTrap).toBe('pit');
  run.dispose();
});

it('starts spikes solid, moves them on the jump, and defeats a blindly committed landing', () => {
  const room = CAMPAIGN.find((entry) => entry.id === 'landing-prediction')!;
  const walk = new RoomRunner(room);
  expect(walk.traps[0]!.body.x).toBe(470);
  move(walk, 950);
  expect(walk.phase).toBe('dead');
  expect(walk.scene.clocks.prediction!.triggeredAt).toBeNull();
  walk.dispose();
  const jump = new RoomRunner(room);
  move(jump, 330);
  move(jump, 950, true);
  expect(jump.scene.clocks.prediction!.triggeredAt).not.toBeNull();
  expect(jump.traps[0]!.body.x).toBeGreaterThan(470);
  expect(jump.phase).toBe('dead');
  expect(jump.deathTrap).toBe('spikes');
  jump.dispose();
});
