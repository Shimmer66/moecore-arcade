import { expect, it } from 'vitest';
import { HIDDEN_ROOM, discoveryFor, hiddenUnlocked } from '../src/hidden';
import { RoomRunner, openRoom } from '../src/runner';
import { parseProgress, recordDiscovery } from '../src/progress';
import { move } from './routes';

function wait(run: RoomRunner, n: number) {
  for (let i = 0; i < n; i++) run.step(0, false);
}
it('discovers the return key by collecting evidence before returning into the pit', () => {
  const run = openRoom(0);
  move(run, 250);
  move(run, 480, true);
  wait(run, 60);
  run.step(0, true);
  wait(run, 65);
  expect(run.secret).toBe(true);
  move(run, 350);
  wait(run, 90);
  expect(discoveryFor(run)).toBe('return-context');
  run.dispose();
});
it('discovers the upper boundary key only in the inverted room', () => {
  const run = openRoom(10);
  move(run, 200);
  move(run, 0);
  wait(run, 100);
  expect(discoveryFor(run)).toBe('beyond-context');
  run.dispose();
});
it('discovers the confidence key after reaching the star above the fake door', () => {
  const run = openRoom(16);
  move(run, 410);
  move(run, 485, true);
  wait(run, 90);
  expect(run.secret).toBe(true);
  expect(discoveryFor(run)).toBe('false-confidence');
  run.dispose();
});
it('persists discoveries, deduplicates them and requires all keys', () => {
  let progress = parseProgress(null);
  expect(hiddenUnlocked(progress.discoveries)).toBe(false);
  for (const key of ['return-context', 'beyond-context', 'false-confidence'] as const)
    progress = recordDiscovery(progress, key);
  expect(recordDiscovery(progress, 'return-context')).toBe(progress);
  expect(hiddenUnlocked(parseProgress(JSON.stringify(progress)).discoveries)).toBe(true);
  expect(parseProgress('{"version":2,"rooms":{},"secretEnding":true}').secretEnding).toBe(false);
});
it('requires all independently colliding copies to reach the hidden door', () => {
  const run = new RoomRunner(HIDDEN_ROOM);
  expect(run.clones).toHaveLength(1);
  move(run, 230);
  move(run, 480, true);
  wait(run, 60);
  run.step(0, true);
  wait(run, 65);
  move(run, 650);
  for (let i = 0; i < 300; i++) {
    if (run.traps.find((view) => view.trap.id === 'consensus-gate')?.phase === 'spent') break;
    run.step(0, false);
  }
  let cloneArrivedFirst = false;
  for (let i = 0; i < 200 && run.phase === 'playing'; i++) {
    run.step(1, false);
    if (run.clones[0]!.phase === 'clear' && run.phase === 'playing') cloneArrivedFirst = true;
  }
  expect(cloneArrivedFirst).toBe(true);
  expect(run.phase).toBe('clear');
  expect(run.secret).toBe(true);
  run.dispose();
});
it('fails the shared attempt when a copy falls even if the original is safe', () => {
  const run = new RoomRunner(HIDDEN_ROOM);
  move(run, 310);
  wait(run, 120);
  expect(run.phase).toBe('dead');
  expect(run.deathReason).toContain('分身');
  expect(run.rect.y).toBeLessThan(400);
  run.dispose();
});
it('parks the original at the exit while the trailing copy continues responding', () => {
  const run = new RoomRunner({
    ...HIDDEN_ROOM,
    spawn: { x: 150, y: 306 },
    cloneSpawns: [{ x: 50, y: 306 }],
    traps: [],
  });
  let waited = false;
  for (let i = 0; i < 400 && run.phase === 'playing'; i++) {
    run.step(1, false);
    if (run.arrived && run.clones[0]!.phase !== 'clear') waited = true;
  }
  expect(waited).toBe(true);
  expect(run.phase).toBe('clear');
  expect(run.clones[0]!.phase).toBe('clear');
  run.dispose();
});
