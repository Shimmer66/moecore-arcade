import { expect, it } from 'vitest';
import { CAMPAIGN, validateCampaign } from '../src/campaign';

it('accepts authored geometry, supported spawns and resolvable trap chains', () => {
  expect(() => validateCampaign(CAMPAIGN)).not.toThrow();
});

it('rejects malformed content before opening a room', () => {
  const room = CAMPAIGN[0]!;
  expect(() => validateCampaign([room, room])).toThrow('Duplicate room');
  expect(() => validateCampaign([{ ...room, spawn: { x: 50, y: 100 } }])).toThrow(
    'Unsupported spawn',
  );
  expect(() => validateCampaign([{ ...room, exit: { ...room.exit, w: NaN } }])).toThrow(
    'Invalid geometry',
  );
});
