import { expect, it } from 'vitest';
import {
  parseProgress,
  recordClear,
  recordDeath,
  recordDiscovery,
  mergeProgress,
} from '../src/progress';

it('migrates clears without inventing times or secrets, and rejects corrupt records', () => {
  expect(parseProgress(null, '["hallucination"]').rooms.hallucination).toEqual({
    clears: 1,
    bestTicks: null,
    deaths: 0,
    secret: false,
  });
  expect(parseProgress('broken').rooms.hallucination?.clears).toBe(0);
  const corrupted = parseProgress(
    JSON.stringify({
      version: 2,
      rooms: { hallucination: { clears: -2, bestTicks: 5, deaths: '8', secret: 'yes' } },
    }),
  );
  expect(corrupted.rooms.hallucination).toEqual({
    clears: 0,
    bestTicks: null,
    deaths: 0,
    secret: false,
  });
});
it('preserves achievements and fastest times when a stale page saves another room', () => {
  let first = recordClear(parseProgress(null), 'hallucination', 200, true);
  first = recordDiscovery(first, 'return-context');
  const stale = recordClear(parseProgress(null), 'autocomplete', 250, false);
  const merged = mergeProgress(first, stale);
  expect(merged.rooms.hallucination?.bestTicks).toBe(200);
  expect(merged.rooms.hallucination?.secret).toBe(true);
  expect(merged.rooms.autocomplete?.clears).toBe(1);
  expect(merged.discoveries).toEqual(['return-context']);
  expect(
    mergeProgress(merged, recordClear(parseProgress(null), 'hallucination', 300, false)).rooms
      .hallucination?.bestTicks,
  ).toBe(200);
});

it('retains fastest runs and secrets through slower replays and storage round trips', () => {
  const original = parseProgress(null);
  let progress = recordDeath(original, 'hallucination');
  progress = recordClear(progress, 'hallucination', 240, true);
  progress = recordClear(progress, 'hallucination', 300, false);
  expect(parseProgress(JSON.stringify(progress)).rooms.hallucination).toEqual({
    clears: 2,
    bestTicks: 240,
    deaths: 1,
    secret: true,
  });
  expect(original.rooms.hallucination?.clears).toBe(0);
});
