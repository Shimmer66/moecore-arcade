import { describe, expect, it } from 'vitest';
import {
  FINISH_DISTANCE,
  LOOKAHEAD_DISTANCE,
  MAX_SPEED,
  MIN_OBSTACLE_GAP,
  MIN_RECOVERY_SECONDS,
  OBSTACLE_WIDTH,
  PLAYER_WIDTH,
  createGenerator,
  createRandom,
  generateObstacles,
  nextRandom,
} from '../src/rules';
import { freezeTree } from './helpers';

describe('local seeded random source', () => {
  it('matches the unsigned 32-bit golden sequence including seed zero', () => {
    let random = createRandom(0);
    const trace = Array.from({ length: 6 }, () => {
      const next = nextRandom(random);
      random = next.state;
      expect(next.value).toBeGreaterThanOrEqual(0);
      expect(next.value).toBeLessThan(1);
      expect(next.value).toBe(random / 0x1_0000_0000);
      return random;
    });
    expect(trace).toEqual([
      1_013_904_223, 1_196_435_762, 3_519_870_697, 2_868_466_484, 1_649_599_747, 2_670_642_822,
    ]);
    expect(nextRandom(0xffff_ffff).state).toBe(1_012_239_698);
    expect(nextRandom(0)).not.toEqual(nextRandom(1));
  });

  it.each([-1, 0.5, NaN, Infinity, 0x1_0000_0000])('rejects invalid seed %s', (seed) => {
    expect(() => createRandom(seed)).toThrow(RangeError);
    expect(() => createGenerator(seed)).toThrow(RangeError);
  });
});

describe('distance-based obstacle generation', () => {
  it('matches a fixed obstacle sequence', () => {
    const initial = freezeTree(createGenerator(0));
    const generated = generateObstacles(initial, 60);
    expect(generated.obstacles.map(({ id, kind, x }) => [id, kind, Number(x.toFixed(6))])).toEqual([
      [0, 'ground', 18],
      [1, 'air', 32.273307],
      [2, 'ground', 47.838565],
    ]);
    expect(initial).toEqual(createGenerator(0));
  });

  it('produces the same sequence and final RNG state regardless of horizon batching', () => {
    const initial = createGenerator(123);
    const first = generateObstacles(initial, 18);
    const second = generateObstacles(first.generator, 36);
    const third = generateObstacles(second.generator, 120);
    const once = generateObstacles(initial, 120);
    expect([...first.obstacles, ...second.obstacles, ...third.obstacles]).toEqual(once.obstacles);
    expect(third.generator).toEqual(once.generator);
    expect(generateObstacles(third.generator, 120)).toEqual({
      generator: third.generator,
      obstacles: [],
    });
    expect(generateObstacles(initial, 17).obstacles).toEqual([]);
  });

  it('keeps recovery space for 512 seeded full courses, including future acceleration', () => {
    const kinds = new Set<string>();
    for (let seed = 0; seed < 512; seed += 1) {
      const { obstacles } = generateObstacles(createGenerator(seed), FINISH_DISTANCE);
      let previousEnd = 0;
      for (const [id, obstacle] of obstacles.entries()) {
        expect(obstacle.id).toBe(id);
        const gap = obstacle.x - previousEnd;
        expect(gap).toBeGreaterThanOrEqual(MIN_OBSTACLE_GAP - 1e-9);
        expect((gap - PLAYER_WIDTH) / MAX_SPEED).toBeGreaterThanOrEqual(
          MIN_RECOVERY_SECONDS - 1e-9,
        );
        previousEnd = obstacle.x + OBSTACLE_WIDTH;
        kinds.add(obstacle.kind);
      }
    }
    expect(kinds).toEqual(new Set(['ground', 'air']));
  });

  it.each([-1, NaN, Infinity, FINISH_DISTANCE + LOOKAHEAD_DISTANCE + 1])(
    'rejects unbounded or invalid generation horizon %s',
    (distance) => {
      expect(() => generateObstacles(createGenerator(0), distance)).toThrow(RangeError);
    },
  );
});
