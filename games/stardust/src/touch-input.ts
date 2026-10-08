import type { Action } from './rules';

export const TOUCH_ACTION_BUFFER_MS = 180;

export interface TouchActionBuffer {
  action: Action | null;
  remainingMs: number;
}

export function createTouchActionBuffer(): TouchActionBuffer {
  return { action: null, remainingMs: 0 };
}

export function queueTouchAction(buffer: TouchActionBuffer, action: Action) {
  buffer.action = action;
  buffer.remainingMs = TOUCH_ACTION_BUFFER_MS;
}

export function clearTouchAction(buffer: TouchActionBuffer) {
  buffer.action = null;
  buffer.remainingMs = 0;
}

export function advanceTouchAction(
  buffer: TouchActionBuffer,
  dt: number,
  ready: boolean,
): Action | null {
  if (!buffer.action) return null;
  if (ready) {
    const action = buffer.action;
    clearTouchAction(buffer);
    return action;
  }
  buffer.remainingMs = Math.max(0, buffer.remainingMs - Math.max(0, dt));
  if (buffer.remainingMs === 0) clearTouchAction(buffer);
  return null;
}
