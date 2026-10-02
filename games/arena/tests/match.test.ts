import { expect, it } from 'vitest';
import { advanceRound, createMatch, matchChampion, settleRound } from '../src/match';
import { RaceRunner } from '../src/race';
import { CAMPAIGN } from '../src/campaign';

it('ends a best-of-five when either player wins three, with draws replayed', () => {
  let match = createMatch(7);
  match = settleRound(match, 'draw');
  match = advanceRound(match);
  expect(match.round).toBe(1);
  for (const winner of [0, 1, 0, 1, 0] as const) {
    match = settleRound(match, winner);
    expect(settleRound(match, winner)).toBe(match);
    if (matchChampion(match) === null) match = advanceRound(match);
  }
  expect(matchChampion(match)).toBe(0);
  expect(match.round).toBe(5);
  expect(advanceRound(match)).toBe(match);
  expect(match.scores).toEqual([3, 2]);
});
it('ends a sweep after three rounds instead of forcing two dead rounds', () => {
  let match = createMatch(0);
  for (let i = 0; i < 3; i++) {
    match = settleRound(match, 1);
    match = advanceRound(match);
  }
  expect(matchChampion(match)).toBe(1);
  expect(match.round).toBe(3);
});
it('telegraphs a single sabotage per racer without mutating authored rooms', () => {
  const original = CAMPAIGN[0]!.traps.length;
  const race = new RaceRunner(CAMPAIGN[0]!);
  const idle = { horizontal: 0, jump: false };
  race.step([{ ...idle, sabotage: true }, idle]);
  const extra = race.runners[1].traps.find((view) => view.trap.id === 'race-injection-0')!;
  expect(extra.phase).toBe('warning');
  for (let i = 0; i < 70; i++) race.step([{ ...idle, sabotage: true }, idle]);
  expect(race.sabotageUsed).toEqual([true, false]);
  expect(race.room.traps).toHaveLength(original + 1);
  expect(CAMPAIGN[0]!.traps).toHaveLength(original);
  expect(race.deaths[1]).toBeGreaterThan(0);
  race.dispose();
});
