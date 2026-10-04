import { expect, it } from 'vitest';
import {
  beginAdventure,
  advanceAdventure,
  type Adventure,
  type AdventureInput,
} from '../src/rules/adventure';
import { challengesFor } from '../src/config/challenges';
function pilot(state: Adventure, food = true): AdventureInput {
  const distance = state.run.distance;
  const obstacles = [
    ...state.run.obstacles,
    ...state.queues.map((q) => ({ ...q, kind: 'ground' as const })),
  ]
    .filter((o) => o.x + 1.2 > distance)
    .sort((a, b) => a.x - b.x);
  const next = obstacles[0];
  const lead = next ? next.x - distance - 0.6 : Infinity;
  const paper = state.papers.find((p) => !p.returned && p.x + 0.45 > distance);
  const fake = state.hallucinations.find((p) => p.x + 0.35 > distance);
  const slap = Boolean(
    (paper && paper.x - distance < 3.1) ||
    (fake && fake.x - distance < 3.1) ||
    (state.energy === 100 && state.hasAnswer),
  );
  const low = next?.kind === 'air' && lead < state.run.speed * 0.5;
  const foodAhead =
    food && state.pickups.some((p) => p.kind === 'rice' && p.x > distance && p.x - distance < 8);
  return {
    jump:
      !low &&
      ((next?.kind === 'ground' && state.run.player.grounded && lead < state.run.speed * 0.25) ||
        (foodAhead &&
          !state.run.player.grounded &&
          state.airJumps === 0 &&
          state.run.player.velocityY < 4)),
    crouch:
      low || Boolean(paper && paper.x - distance < 1 && !state.tailTicks && state.tailCooldown),
    tail: slap && !state.tailHeld && state.tailCooldown === 0,
  };
}

// This pilot uses only the three public actions. It keeps charge for delivery
// and chooses the low route on the return-focused course.
it.each([0, 1, 2] as const)('course %i supports all three medals with normal controls', (level) => {
  for (const mode of ['quick', 'normal', 'deep'] as const) {
    for (const seed of [0, 1, 2]) {
      let state = beginAdventure(seed, mode, level);
      for (let i = 0; i < 9000 && state.run.status === 'running'; i++)
        state = advanceAdventure(state, pilot(state, level !== 1));
      expect(state.run.result?.reason, `${mode} seed ${seed}`).toBe('distance-limit');
      expect(
        challengesFor(state)
          .filter((item) => item.earned)
          .map((item) => item.id),
        `${mode} seed ${seed}`,
      ).toHaveLength(3);
    }
  }
});

it.each(['quick', 'normal', 'deep'] as const)(
  'endless %s remains playable past the speed cap with bounded entities',
  (mode) => {
    for (const seed of [0, 1, 2]) {
      let state = beginAdventure(seed, mode, 3);
      let sawPrinter = false;
      for (
        let tick = 0;
        tick < 35000 && state.run.status === 'running' && state.run.distance < 4000;
        tick++
      ) {
        state = advanceAdventure(state, pilot(state, false));
        sawPrinter ||= state.printers.length > 0;
        expect(state.printers.length).toBeLessThan(6);
        expect(state.papers.length).toBeLessThan(8);
        expect(state.run.obstacles.length).toBeLessThan(12);
      }
      expect(state.run.distance, `${mode} seed ${seed}`).toBeGreaterThanOrEqual(4000);
      expect(sawPrinter).toBe(true);
      expect(state.returns).toBeGreaterThan(0);
      expect(state.verified).toBeGreaterThan(0);
    }
  },
);
