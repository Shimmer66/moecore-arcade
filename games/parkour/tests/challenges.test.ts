import { describe, expect, it } from 'vitest';
import { challengesFor, mergeBadges } from '../src/config/challenges';
import { beginAdventure, type Adventure } from '../src/rules/adventure';

function delivered(state: Adventure): Adventure {
  return {
    ...state,
    hasAnswer: true,
    run: {
      ...state.run,
      status: 'ended',
      result: { reason: 'distance-limit', distance: state.run.finishDistance!, score: 0 },
    },
  };
}
describe('course challenges', () => {
  it('does not grant badges before delivery or on death', () => {
    const state = { ...beginAdventure(0), rice: 999 };
    expect(challengesFor(state).some((item) => item.earned)).toBe(false);
    const finished = delivered(state);
    expect(
      challengesFor({
        ...finished,
        run: {
          ...finished.run,
          status: 'ended',
          result: { reason: 'ground-collision', distance: 20, score: 0 },
        },
      }).some((item) => item.earned),
    ).toBe(false);
  });
  it('requires every rice bowl and rejects shield-assisted clean runs', () => {
    const state = delivered(beginAdventure(0));
    const target = challengesFor(state)[1]!.target;
    expect(challengesFor({ ...state, rice: target - 1 })[1]!.earned).toBe(false);
    expect(challengesFor({ ...state, rice: target })[1]!.earned).toBe(true);
    expect(challengesFor({ ...state, shieldsUsed: 1 })[2]!.earned).toBe(false);
  });
  it('rejects mistaken fake rice even if all other targets are met', () => {
    const state = delivered(beginAdventure(0, 'normal', 2));
    expect(challengesFor({ ...state, verified: 99, hallucinationHits: 1 })[1]!.earned).toBe(false);
  });
  it('merges past achievements without accepting unknown records', () => {
    const challenges = challengesFor(delivered(beginAdventure(0)));
    expect(mergeBadges(['rice', 'invalid', 'rice'], challenges)).toEqual([
      'rice',
      'delivery',
      'clean',
    ]);
    expect(mergeBadges({}, challenges)).toEqual(['delivery', 'clean']);
    expect(challengesFor(beginAdventure(0, 'normal', 3))).toEqual([]);
  });
});
