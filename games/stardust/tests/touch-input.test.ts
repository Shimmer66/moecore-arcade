import { describe, expect, it } from 'vitest';
import {
  advanceTouchAction,
  clearTouchAction,
  createTouchActionBuffer,
  queueTouchAction,
  TOUCH_ACTION_BUFFER_MS,
} from '../src/touch-input';

describe('mobile action buffering', () => {
  it('plays a queued action as soon as recovery becomes ready', () => {
    const buffer = createTouchActionBuffer();
    queueTouchAction(buffer, 'heavy');
    expect(advanceTouchAction(buffer, 80, false)).toBeNull();
    expect(buffer.remainingMs).toBe(TOUCH_ACTION_BUFFER_MS - 80);
    expect(advanceTouchAction(buffer, 16, true)).toBe('heavy');
    expect(buffer).toEqual({ action: null, remainingMs: 0 });
  });

  it('keeps only the latest intent and expires it deterministically', () => {
    const buffer = createTouchActionBuffer();
    queueTouchAction(buffer, 'light');
    queueTouchAction(buffer, 'stand');
    expect(advanceTouchAction(buffer, TOUCH_ACTION_BUFFER_MS, false)).toBeNull();
    expect(buffer).toEqual({ action: null, remainingMs: 0 });
  });

  it('clears buffered input on pause, reset or loss of focus', () => {
    const buffer = createTouchActionBuffer();
    queueTouchAction(buffer, 'special');
    clearTouchAction(buffer);
    expect(advanceTouchAction(buffer, 0, true)).toBeNull();
  });
});
