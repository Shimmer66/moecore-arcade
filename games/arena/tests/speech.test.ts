import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RoomRunner } from '../src/runner';
import { move } from './routes';

it('announces newly triggered gravity rather than the earlier fake door in a later array slot', () => {
  const room = CAMPAIGN.find((entry) => entry.id === 'ceiling-review')!;
  const run = new RoomRunner(room);
  run.step(0, false);
  expect(run.speech).toBe(room.traps.find((trap) => trap.id === 'review-ground')!.line);
  move(run, 240);
  expect(run.traps.find((view) => view.trap.id === 'review-gravity')?.phase).toBe('active');
  expect(run.speech).toBe(room.traps.find((trap) => trap.id === 'review-gravity')!.line);
  run.dispose();
});

it('resolves sequential event feedback by trigger time rather than authoring order', () => {
  const room = CAMPAIGN.find((entry) => entry.id === 'thinking')!;
  const a = new RoomRunner(room);
  const b = new RoomRunner({ ...room, traps: [...room.traps].reverse() });
  for (const run of [a, b]) {
    move(run, 300);
    for (let i = 0; i < 70; i++) run.step(0, false);
    move(run, 480);
  }
  expect(a.phase).toBe('playing');
  expect(a.speech).toBe(room.traps[1]!.line);
  expect(b.speech).toBe(a.speech);
  a.dispose();
  b.dispose();
});
