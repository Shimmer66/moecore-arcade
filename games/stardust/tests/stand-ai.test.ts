import { describe, expect, it } from 'vitest';
import {
  advanceStandAI,
  AI_STAND_ACTIVE_MS,
  AI_STAND_RECALL_COOLDOWN_MS,
  createStandAIState,
  type StandAIScene,
} from '../src/stand-ai';

const scene = (patch: Partial<StandAIScene> = {}): StandAIScene => ({
  mode: 'attached',
  ownerX: 50,
  standX: 50,
  maximumStandX: 25,
  targetX: 25,
  bodyAttackReach: 5,
  ranged: false,
  busy: false,
  blocked: false,
  frozen: false,
  ...patch,
});

describe('computer-controlled stand deployment', () => {
  it('approaches until the target is within the actual projected stand reach, then deploys', () => {
    const state = createStandAIState();
    expect(
      advanceStandAI(state, scene({ ownerX: 75, standX: 75, maximumStandX: 50 }), 600),
    ).toMatchObject({ transition: null, bodyDirection: -1, canAttack: false });
    expect(advanceStandAI(state, scene(), 16).transition).toBe('deploy');
  });

  it('pursues with the stand while keeping the owner still and attacks only in range', () => {
    const state = createStandAIState();
    expect(advanceStandAI(state, scene({ mode: 'detached', standX: 40 }), 16)).toMatchObject({
      bodyDirection: 0,
      standDirection: -1,
      canAttack: false,
    });
    expect(advanceStandAI(state, scene({ mode: 'detached', standX: 27 }), 16)).toMatchObject({
      bodyDirection: 0,
      standDirection: 0,
      canAttack: true,
    });
  });

  it('allows a ranged partner to deploy and shoot without walking its body into melee', () => {
    const state = createStandAIState();
    const ranged = scene({ ranged: true, ownerX: 14, standX: 14, targetX: 90, maximumStandX: 89 });
    expect(advanceStandAI(state, ranged, 100)).toMatchObject({ bodyDirection: 0, canAttack: true });
    expect(advanceStandAI(state, ranged, 500).transition).toBe('deploy');
    expect(advanceStandAI(state, { ...ranged, mode: 'detached' }, 16)).toMatchObject({
      bodyDirection: 0,
      standDirection: 1,
      canAttack: true,
    });
  });

  it.each([{ targetX: 90 }, { targetX: 49 }, { targetX: null }])(
    'recalls when the target crosses the owner, reaches its body, or disappears: %j',
    (patch) => {
      const state = createStandAIState();
      const result = advanceStandAI(state, scene({ mode: 'detached', standX: 40, ...patch }), 16);
      expect(result).toMatchObject({ transition: 'recall', canAttack: false });
      expect(state.cooldownMs).toBe(AI_STAND_RECALL_COOLDOWN_MS);
    },
  );

  it('recalls out-of-range melee stands and avoids rapid redeploy/recall loops', () => {
    const state = createStandAIState();
    const shortRange = scene({
      mode: 'detached',
      standX: 46.25,
      maximumStandX: 46.25,
      targetX: 25,
    });
    expect(advanceStandAI(state, shortRange, 16).transition).toBe('recall');
    expect(advanceStandAI(state, scene(), 600).transition).toBeNull();
    expect(advanceStandAI(state, scene(), 600).transition).toBe('deploy');
  });

  it('does not deploy toward the wrong side when the sprite is clamped at a screen edge', () => {
    const state = createStandAIState();
    expect(
      advanceStandAI(state, scene({ ownerX: 10, standX: 10, maximumStandX: 23, targetX: 6 }), 600),
    ).toMatchObject({ transition: null, canAttack: true });
  });

  it('completes a running barrage before a routine recall', () => {
    const state = createStandAIState();
    const active = scene({ mode: 'detached', standX: 27, busy: true });
    expect(advanceStandAI(state, active, AI_STAND_ACTIVE_MS + 100).transition).toBeNull();
    expect(advanceStandAI(state, { ...active, busy: false }, 16).transition).toBe('recall');
  });

  it('freezes decision clocks in time stop and emits no controls while stunned or casting', () => {
    const state = createStandAIState();
    const before = { ...state };
    expect(advanceStandAI(state, scene({ frozen: true }), 5000)).toMatchObject({
      transition: null,
      bodyDirection: 0,
      standDirection: 0,
      canAttack: false,
    });
    expect(state).toEqual(before);
    expect(advanceStandAI(state, scene({ blocked: true }), 5000)).toMatchObject({
      transition: null,
      bodyDirection: 0,
      standDirection: 0,
      canAttack: false,
    });
  });
});
