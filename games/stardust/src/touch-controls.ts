export const JOYSTICK_DEAD_ZONE = 0.12;
export const JOYSTICK_JUMP_THRESHOLD = -0.68;
export const JOYSTICK_JUMP_RELEASE = -0.42;
export const JOYSTICK_CROUCH_THRESHOLD = 0.56;
export const JOYSTICK_CROUCH_RELEASE = 0.32;
export const JOYSTICK_MOVEMENT_CURVE = 1.35;

export interface JoystickVector {
  x: number;
  y: number;
  movement: number;
  jump: boolean;
  crouch: boolean;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function applyDeadZone(value: number) {
  const magnitude = Math.abs(value);
  if (magnitude <= JOYSTICK_DEAD_ZONE + Number.EPSILON * 8) return 0;
  const normalized = (magnitude - JOYSTICK_DEAD_ZONE) / (1 - JOYSTICK_DEAD_ZONE);
  if (normalized >= 0.92) return Math.sign(value);
  return Math.sign(value) * normalized ** JOYSTICK_MOVEMENT_CURVE;
}

export function resolveJoystick(
  clientX: number,
  clientY: number,
  bounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): JoystickVector {
  const radius = Math.max(1, Math.min(bounds.width, bounds.height) / 2);
  let x = (clientX - (bounds.left + bounds.width / 2)) / radius;
  let y = (clientY - (bounds.top + bounds.height / 2)) / radius;
  const distance = Math.hypot(x, y);
  if (distance > 1) {
    x /= distance;
    y /= distance;
  }
  x = clamp(x, -1, 1);
  y = clamp(y, -1, 1);
  return {
    x,
    y,
    movement: applyDeadZone(x),
    jump: y <= JOYSTICK_JUMP_THRESHOLD,
    crouch: y >= JOYSTICK_CROUCH_THRESHOLD,
  };
}
