import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { MAIN_ROUTE, WORLDS, journeyPosition, nextJourneyRoom } from '../src/journey';

it('covers every authored room exactly once in three worlds with five-stage doors', () => {
  expect(WORLDS).toHaveLength(3);
  expect(MAIN_ROUTE).toHaveLength(CAMPAIGN.length);
  expect(new Set(MAIN_ROUTE).size).toBe(CAMPAIGN.length);
  for (const world of WORLDS) {
    expect(
      world.doors.filter((door) => !door.finale).every((door) => door.rooms.length === 5),
    ).toBe(true);
    const finale = world.doors.at(-1)!;
    expect(finale.finale).toBe(true);
    expect(CAMPAIGN[finale.rooms[0]!]!.width).toBeGreaterThan(2000);
  }
});

it('visits each world finale before the next world without changing existing room ids', () => {
  expect(CAMPAIGN[0]!.id).toBe('hallucination');
  const firstFinale = nextJourneyRoom(14)!;
  expect(CAMPAIGN[firstFinale]!.id).toBe('world-one-review');
  expect(nextJourneyRoom(firstFinale)).toBe(15);
  const secondFinale = nextJourneyRoom(29)!;
  expect(CAMPAIGN[secondFinale]!.id).toBe('world-two-review');
  expect(nextJourneyRoom(secondFinale)).toBe(30);
  expect(CAMPAIGN[nextJourneyRoom(44)!]!.id).toBe('ephemeral-answer');
  expect(nextJourneyRoom(CAMPAIGN.findIndex((room) => room.id === 'adaptive-trap'))).toBe(45);
  expect(nextJourneyRoom(45)).toBeNull();
  expect(journeyPosition(5)).toMatchObject({ worldIndex: 0, doorIndex: 1, stage: 0 });
});
