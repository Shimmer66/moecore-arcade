import { expect, it } from 'vitest';
import { openRoom } from '../src/runner';
import { SECRET_ROUTES, move } from './routes';
import { CAMPAIGN } from '../src/campaign';

it('has a normal-input secret route for every authored room', () => {
  expect(SECRET_ROUTES).toHaveLength(CAMPAIGN.length);
});

for (const [index, route] of SECRET_ROUTES.entries()) {
  it(`collects room ${index + 1} secret and carries it to the exit using normal inputs`, () => {
    const run = openRoom(index);
    route(run);
    expect(
      { phase: run.phase, secret: run.secret, x: run.rect.x },
      `room=${run.room.id} x=${run.rect.x} y=${run.rect.y} cause=${run.deathReason}`,
    ).toMatchObject({
      phase: 'clear',
      secret: true,
    });
    run.dispose();
  });
}
it('punishes entering the confident fake door instead of awarding a clear', () => {
  const run = openRoom(16);
  move(run, 950);
  expect(run.phase).toBe('dead');
  run.dispose();
});
it('only adds the overhead trap when the player jumps in the overthinking zone', () => {
  const walking = openRoom(17);
  move(walking, 950);
  expect(walking.phase).toBe('clear');
  expect(walking.scene.clocks['jump-punish']!.triggeredAt).toBeNull();
  walking.dispose();
  const jumping = openRoom(17);
  move(jumping, 245);
  move(jumping, 950, true);
  expect(jumping.phase).toBe('dead');
  expect(jumping.scene.clocks['jump-punish']!.triggeredAt).not.toBeNull();
  jumping.dispose();
});
