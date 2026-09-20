import { describe, expect, it } from 'vitest';
import { createRandomSource } from '../src/index';

describe('match3 random source', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = createRandomSource('board-01');
    const second = createRandomSource('board-01');
    expect(Array.from({ length: 24 }, () => first.next())).toEqual(
      Array.from({ length: 24 }, () => second.next()),
    );
  });

  it('produces a different sequence for a different seed', () => {
    const first = createRandomSource(1);
    const second = createRandomSource(2);
    expect(Array.from({ length: 24 }, () => first.next())).not.toEqual(
      Array.from({ length: 24 }, () => second.next()),
    );
  });

  it('keeps floats in [0, 1) and integers inside the requested bound', () => {
    const random = createRandomSource('range');
    for (let index = 0; index < 200; index += 1) {
      const value = random.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);

      const integer = random.nextInt(6);
      expect(Number.isInteger(integer)).toBe(true);
      expect(integer).toBeGreaterThanOrEqual(0);
      expect(integer).toBeLessThan(6);
    }
  });

  it('rejects a bound that is not a positive integer', () => {
    const random = createRandomSource('invalid');
    expect(() => random.nextInt(0)).toThrow(RangeError);
    expect(() => random.nextInt(-1)).toThrow(RangeError);
    expect(() => random.nextInt(1.5)).toThrow(RangeError);
  });
});
