import { describe, expect, it } from 'vitest';
import {
  JOYSTICK_CROUCH_THRESHOLD,
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_JUMP_THRESHOLD,
  JOYSTICK_MOVEMENT_CURVE,
  resolveJoystick,
} from '../src/touch-controls';

const bounds = { left: 100, top: 200, width: 120, height: 120 };

describe('mobile joystick rules', () => {
  it('keeps the neutral region still', () => {
    expect(resolveJoystick(160, 260, bounds)).toEqual({
      x: 0,
      y: 0,
      movement: 0,
      jump: false,
      crouch: false,
    });
    expect(resolveJoystick(160 + JOYSTICK_DEAD_ZONE * 60, 260, bounds).movement).toBe(0);
  });

  it('normalizes horizontal movement after the dead zone', () => {
    expect(resolveJoystick(220, 260, bounds)).toMatchObject({ x: 1, movement: 1 });
    expect(resolveJoystick(100, 260, bounds)).toMatchObject({ x: -1, movement: -1 });
    expect(resolveJoystick(190, 260, bounds).movement).toBeGreaterThan(0);
    expect(resolveJoystick(190, 260, bounds).movement).toBeLessThan(0.5);
    expect(JOYSTICK_MOVEMENT_CURVE).toBeGreaterThan(1);
  });

  it('clamps diagonal drags to the circular gate', () => {
    const vector = resolveJoystick(260, 360, bounds);
    expect(Math.hypot(vector.x, vector.y)).toBeCloseTo(1);
    expect(vector.x).toBeCloseTo(vector.y);
  });

  it('maps deliberate vertical pushes to jump and crouch without horizontal drift', () => {
    expect(resolveJoystick(160, 200, bounds)).toMatchObject({
      movement: 0,
      jump: true,
      crouch: false,
    });
    expect(resolveJoystick(160, 320, bounds)).toMatchObject({
      movement: 0,
      jump: false,
      crouch: true,
    });
    expect(JOYSTICK_JUMP_THRESHOLD).toBeLessThan(-JOYSTICK_DEAD_ZONE);
    expect(JOYSTICK_CROUCH_THRESHOLD).toBeGreaterThan(JOYSTICK_DEAD_ZONE);
  });
});
