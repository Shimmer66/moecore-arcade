import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RoomRunner } from '../src/runner';
import { RaceRunner } from '../src/race';
import { decodeRoom, encodeRoom, editorProblem, normalizeRoom } from '../src/editor';

const room = CAMPAIGN.find((entry) => entry.id === 'one-more-thing')!;
it('keeps long-room geometry intact through editor serialization', () => {
  const imported = decodeRoom(encodeRoom(room));
  expect(imported.width).toBe(2500);
  expect(imported.exit.x).toBe(2410);
  expect(imported.traps.at(-1)?.body.x).toBe(2070);
  expect(editorProblem(imported)).toBe('');
  expect(() => normalizeRoom({ ...room, width: 99999 })).toThrow();
});
it('clamps the character to the authored boundary rather than the old first-screen boundary', () => {
  const run = new RoomRunner({ ...room, traps: [], exit: { ...room.exit, y: 20 } });
  for (let tick = 0; tick < 900; tick++) run.step(1, false);
  expect(run.phase).toBe('playing');
  expect(run.rect.x).toBe(2468);
  run.dispose();
});
it('targets the opponent with a sabotage even beyond the first screen', () => {
  const race = new RaceRunner({ ...room, traps: [] });
  const idle = { horizontal: 0, jump: false };
  for (let tick = 0; tick < 330; tick++) race.step([idle, { horizontal: 1, jump: false }]);
  expect(race.runners[1].rect.x).toBeGreaterThan(1400);
  race.step([{ ...idle, sabotage: true }, idle]);
  const injected = race.room.traps.find((trap) => trap.id === 'race-injection-0')!;
  expect(injected.body.x).toBeGreaterThan(1400);
  for (let tick = 0; tick < 80; tick++) race.step([idle, idle]);
  expect(race.deaths[1]).toBe(1);
  expect(race.deaths[0]).toBe(0);
  race.dispose();
});
