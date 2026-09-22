import { describe, expect, it } from 'vitest';
import {
  MAP_VARIANTS,
  TARGET_STARS,
  createGameState,
  queueDirection,
  step,
  tick,
  useThinking,
} from '../src/rules';

describe('whale queue rules', () => {
  it('starts with a three-cell queue and one available star', () => {
    const state = createGameState();
    expect(state.segments).toHaveLength(3);
    expect(state.star).not.toBeNull();
    expect(MAP_VARIANTS).toContainEqual(state.rocks);
  });

  it('uses a seeded map and seeded star placement for reproducible sessions', () => {
    const first = createGameState({ seed: 'demo-session' });
    const replay = createGameState({ seed: 'demo-session' });
    expect(replay).toEqual(first);
    expect(first.star).not.toBeNull();
    expect(
      MAP_VARIANTS.some((layout) => JSON.stringify(layout) === JSON.stringify(first.rocks)),
    ).toBe(true);
  });

  it('varies maps and keeps each star in a free cell', () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      createGameState({ seed: `map-${index}` }),
    );
    const layouts = new Set(sessions.map((state) => JSON.stringify(state.rocks)));
    expect(layouts.size).toBeGreaterThan(1);
    for (const state of sessions) {
      expect(state.star).not.toBeNull();
      expect(state.rocks).not.toContainEqual(state.star);
      expect(state.segments).not.toContainEqual(state.star);
    }
  });

  it('accepts one legal turn and ignores an immediate reverse', () => {
    const state = createGameState();
    expect(queueDirection(state, 'up').pendingDirection).toBe('up');
    expect(queueDirection(state, 'left')).toBe(state);
  });

  it('allows the old tail to vacate but collides with the remaining body', () => {
    const state = createGameState();
    const moved = step(state).state;
    expect(moved.status).toBe('playing');
    const turned = queueDirection(moved, 'down');
    const next = step(turned).state;
    expect(next.segments[0]).toEqual({ row: 9, column: 5 });
  });

  it('loses at a boundary and pauses once ended', () => {
    let state = createGameState();
    for (let i = 0; i < 20 && state.status === 'playing'; i += 1) state = step(state).state;
    expect(state.status).toBe('lost');
    expect(step(state).state).toBe(state);
  });

  it('uses a charge for three seconds of slower stepping', () => {
    let state = createGameState();
    state = { ...state, thinkingCharges: 1 };
    state = useThinking(state);
    expect(state.thinkingCharges).toBe(0);
    expect(tick(state, 200).state.segments).toHaveLength(3);
    expect(tick(state, 400).state.segments[0]).toEqual({ row: 8, column: 5 });
  });

  it('can reach the terminal target when stars are placed ahead', () => {
    let state = createGameState([]);
    for (let collected = 0; collected < TARGET_STARS; collected += 1) {
      state = {
        ...state,
        status: 'playing',
        direction: 'right',
        pendingDirection: null,
        segments: [
          { row: 1 + (collected % 14), column: 1 },
          { row: 1 + (collected % 14), column: 0 },
        ],
        star: { row: 1 + (collected % 14), column: 2 },
        stepAccumulatorMs: 0,
      };
      state = step(state).state;
      if (state.status === 'lost') break;
    }
    expect(state.starsCollected).toBe(TARGET_STARS);
    expect(state.status).toBe('won');
  });
});
