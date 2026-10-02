import { describe, expect, it } from 'vitest';
import { impactFeedback } from '../src/presentation';

describe('combat presentation feedback', () => {
  it('is deterministic and bounded for the same simulation time', () => {
    const effects = [
      { id: 3, kind: 'boom' as const, life: 0.4 },
      { id: 4, kind: 'hit' as const, life: 0.2 },
    ];
    const a = impactFeedback(12.5, effects, false);
    expect(a).toEqual(impactFeedback(12.5, effects, false));
    expect(Math.abs(a.x)).toBeLessThanOrEqual(5);
    expect(Math.abs(a.y)).toBeLessThanOrEqual(3);
    expect(a.flash).toBeGreaterThan(0);
    expect(a.flash).toBeLessThanOrEqual(0.16);
  });
  it('prefers hit flash color and lets stronger explosions drive shake', () => {
    const result = impactFeedback(
      2,
      [
        { id: 1, kind: 'hit', life: 0.1 },
        { id: 2, kind: 'boom', life: 0.55 },
      ],
      false,
    );
    expect(result.color).toBe('#ff7187');
    expect(Math.hypot(result.x, result.y)).toBeGreaterThan(0);
  });
  it('fully disables shake and flash for reduced motion', () => {
    expect(impactFeedback(2, [{ id: 1, kind: 'boom', life: 0.55 }], true)).toEqual({
      x: 0,
      y: 0,
      flash: 0,
      color: '#ffffff',
    });
  });
});
