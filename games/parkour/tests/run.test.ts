import { describe, expect, it } from 'vitest';
import {
  FINISH_DISTANCE,
  FIRST_OBSTACLE_DISTANCE,
  FIXED_DT,
  MAX_SPEED,
  PLAYER_WIDTH,
  restart,
  scoreAtDistance,
  start,
  step,
} from '../src/rules';
import type { ObstacleKind, PlayerInput, RunState } from '../src/rules';
import {
  CROUCH,
  IDLE,
  JUMP,
  MAX_TEST_TICKS,
  checkInvariants,
  freezeTree,
  pilotInput,
  play,
  withObstacles,
} from './helpers';

describe('run lifecycle', () => {
  it('matches the initial fixed input/output sequence', () => {
    let state = start(0);
    const trace = [IDLE, IDLE, JUMP].map((input) => {
      state = step(state, input, FIXED_DT);
      return [
        state.tick,
        Number(state.distance.toFixed(6)),
        state.score,
        Number(state.player.y.toFixed(6)),
        state.status,
      ];
    });
    expect(trace).toEqual([
      [1, 0.1, 1, 0, 'running'],
      [2, 0.200025, 2, 0, 'running'],
      [3, 0.300075, 3, 0.143333, 'running'],
    ]);
  });

  it.each<{ kind: ObstacleKind; expected: string; input: (tick: number) => PlayerInput }>([
    { kind: 'ground', expected: 'jumped', input: (tick) => (tick === 0 ? JUMP : IDLE) },
    { kind: 'air', expected: 'ducked', input: () => CROUCH },
  ])('clears $kind with a fixed input sequence', ({ kind, expected, input }) => {
    let state = withObstacles([{ id: 7, kind, x: 2.5 }]);
    const events = [];
    for (let tick = 0; tick < 60; tick += 1) {
      const distance = state.distance;
      state = step(state, input(tick));
      checkInvariants(state, distance);
      events.push(...state.events);
    }
    expect(state.status).toBe('running');
    expect(events).toEqual([{ obstacleId: 7, kind: expected }]);
    expect(state.obstacles).toEqual([]);
  });

  it.each<ObstacleKind>(['ground', 'air'])('ends on an unavoidable %s collision', (kind) => {
    const initial = withObstacles([{ id: 3, kind, x: PLAYER_WIDTH + 0.025 }]);
    const ended = step(initial, IDLE);
    expect(ended.status).toBe('ended');
    expect(ended.distance).toBeCloseTo(0.025, 12);
    expect(ended.distance).toBeLessThan(initial.speed * FIXED_DT);
    expect(ended.result).toEqual({
      distance: ended.distance,
      score: 0,
      reason: `${kind}-collision`,
    });
    expect(ended.events).toEqual([{ obstacleId: 3, kind: 'collision' }]);
    checkInvariants(ended, 0);
    expect(step(freezeTree(ended), JUMP)).toBe(ended);
  });

  it('chooses first physical contact even for an unsorted obstacle fixture', () => {
    const initial = withObstacles([
      { id: 0, kind: 'ground', x: PLAYER_WIDTH + 0.08 },
      { id: 1, kind: 'air', x: PLAYER_WIDTH + 0.02 },
    ]);
    const ended = step(initial, IDLE);
    expect(ended.result?.reason).toBe('air-collision');
    expect(ended.distance).toBeCloseTo(0.02, 12);
    expect(ended.events).toEqual([{ obstacleId: 1, kind: 'collision' }]);
  });

  it('standing up underneath an air obstacle collides immediately', () => {
    const initial = withObstacles([{ id: 0, kind: 'air', x: 0.2 }]);
    const crouched = step(initial, CROUCH);
    expect(crouched.status).toBe('running');
    const ended = step(crouched, IDLE);
    expect(ended.distance).toBe(crouched.distance);
    expect(ended.result?.reason).toBe('air-collision');
    expect(ended.player).toEqual(crouched.player);
    checkInvariants(ended, crouched.distance);
  });

  it('idle input on a naturally generated course ends at the first obstacle', () => {
    const { state } = play(0, () => IDLE);
    expect(state.result?.reason).toBe('ground-collision');
    expect(state.distance).toBeCloseTo(FIRST_OBSTACLE_DISTANCE - PLAYER_WIDTH, 12);
    expect(state.score).toBe(scoreAtDistance(state.distance));
    expect(state.tick).toBeLessThan(180);
  });

  it('replays an entire recorded input sequence frame-for-frame with the same seed', () => {
    const inputs: PlayerInput[] = [];
    let recorded = start(123);
    const frames: RunState[] = [];
    for (let tick = 0; tick < MAX_TEST_TICKS && recorded.status === 'running'; tick += 1) {
      const input = pilotInput(recorded);
      inputs.push(input);
      recorded = step(recorded, input);
      frames.push(recorded);
    }
    expect(recorded.result?.reason).toBe('distance-limit');
    let replayed = start(123);
    let unrelated = start(0xffff_ffff);
    for (const [index, input] of inputs.entries()) {
      unrelated = step(unrelated, JUMP);
      replayed = step(freezeTree(replayed), freezeTree(input));
      expect(replayed).toEqual(frames[index]);
    }
    expect(replayed).toEqual(recorded);
  });

  it('restarts running and ended runs without retaining input, RNG, score, events or obstacles', () => {
    const running = step(start(25), JUMP);
    const ended = play(25, () => IDLE).state;
    for (const old of [running, ended]) {
      const clean = restart(freezeTree(old));
      expect(clean).toEqual(start(25));
      expect(clean.player).not.toBe(old.player);
      expect(clean.obstacles).not.toBe(old.obstacles);
      expect(step(clean, JUMP)).toEqual(step(start(25), JUMP));
      expect(restart(old, 0)).toEqual(start(0));
    }
  });

  it('runs thousands of frames at the speed cap and finishes at exactly the distance limit', () => {
    const { state, jumped, ducked, cappedTicks } = play(7, pilotInput);
    expect(state.result).toEqual({
      distance: FINISH_DISTANCE,
      score: 12000,
      reason: 'distance-limit',
    });
    expect(state.speed).toBe(MAX_SPEED);
    expect(cappedTicks).toBeGreaterThan(3_900);
    expect(jumped).toBeGreaterThan(0);
    expect(ducked).toBeGreaterThan(0);
    expect(step(state, IDLE)).toBe(state);
  });

  it.each([0, -1, NaN, Infinity, 1 / 30, 1 / 120])('rejects non-fixed run dt %s', (dt) => {
    expect(() => step(start(), IDLE, dt)).toThrow(RangeError);
  });
});

describe('512-seed finite-run acceptance', () => {
  it.each(Array.from({ length: 512 }, (_, seed) => seed))(
    'seed %i: pilot finishes and scripted input ends without NaN or penetration',
    (seed) => {
      const piloted = play(seed, pilotInput);
      expect(piloted.state.result?.reason).toBe('distance-limit');
      expect(piloted.jumped).toBeGreaterThan(0);
      expect(piloted.ducked).toBeGreaterThan(0);
      const scripted = play(seed, (state) => {
        if (state.tick > 600) return IDLE;
        return {
          jump: (state.tick + seed) % 47 < 3,
          crouch: (state.tick + seed) % 73 < 20,
        };
      });
      expect(scripted.state.result?.reason).toMatch(/^(ground|air)-collision$/);
      expect(scripted.state.tick).toBeLessThan(900);
    },
  );
});
