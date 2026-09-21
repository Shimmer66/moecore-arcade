import { describe, expect, it } from 'vitest';
import { FIXED_DT, GRAVITY, createPlayer, stepPlayer } from '../src/rules';
import { CROUCH, IDLE, JUMP, freezeTree } from './helpers';

describe('fixed-step player', () => {
  it('matches a fixed jump input/output sequence', () => {
    let player = createPlayer();
    const trace = [JUMP, IDLE, IDLE, IDLE, IDLE].map((input) => {
      player = stepPlayer(player, input, FIXED_DT);
      return [Number(player.y.toFixed(6)), Number(player.velocityY.toFixed(6)), player.grounded];
    });
    expect(trace).toEqual([
      [0.143333, 8.6, false],
      [0.28, 8.2, false],
      [0.41, 7.8, false],
      [0.533333, 7.4, false],
      [0.65, 7, false],
    ]);
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(player, IDLE);
      expect(player.y).toBeGreaterThanOrEqual(0);
    }
    expect(player).toEqual(createPlayer());
  });

  it('does not auto-jump when jump stays held across landing', () => {
    let player = createPlayer();
    let takeoffs = 0;
    for (let tick = 0; tick < 120; tick += 1) {
      const previous = player;
      player = stepPlayer(player, JUMP);
      if (previous.grounded && !player.grounded) takeoffs += 1;
    }
    expect(takeoffs).toBe(1);
    expect(player.grounded).toBe(true);
    player = stepPlayer(player, IDLE);
    expect(stepPlayer(player, JUMP).grounded).toBe(false);
  });

  it('prioritizes crouch and consumes a simultaneous jump press', () => {
    let player = stepPlayer(createPlayer(), { jump: true, crouch: true });
    expect(player).toEqual({
      y: 0,
      velocityY: 0,
      grounded: true,
      crouching: true,
      jumpHeld: true,
    });
    player = stepPlayer(player, JUMP);
    expect(player.grounded).toBe(true);
    expect(player.crouching).toBe(false);
    expect(stepPlayer(stepPlayer(player, IDLE), JUMP).grounded).toBe(false);
  });

  it('ignores airborne crouch and extra jump presses, then crouches after landing', () => {
    let player = stepPlayer(createPlayer(), JUMP);
    player = stepPlayer(player, CROUCH);
    expect(player.crouching).toBe(false);
    const velocity = player.velocityY;
    player = stepPlayer(player, { jump: true, crouch: true });
    expect(player.velocityY).toBeCloseTo(velocity - GRAVITY * FIXED_DT, 12);
    for (let tick = 0; tick < 60; tick += 1) player = stepPlayer(player, CROUCH);
    expect(player).toEqual({ ...createPlayer(), crouching: true });
    expect(stepPlayer(player, IDLE)).toEqual(createPlayer());
  });

  it('does not mutate frozen state or input', () => {
    const player = freezeTree(createPlayer());
    const input = freezeTree({ ...JUMP });
    expect(stepPlayer(player, input).y).toBeGreaterThan(0);
    expect(player).toEqual(createPlayer());
    expect(input).toEqual(JUMP);
  });

  it.each([0, -1, NaN, Infinity, 1 / 30, 1 / 120])('rejects non-fixed dt %s', (dt) => {
    expect(() => stepPlayer(createPlayer(), JUMP, dt)).toThrow(RangeError);
  });
});
