/**
 * A draw source. Callers only need these two methods, so tests can substitute a
 * degenerate source and still exercise the board builder.
 */
export interface RandomSource {
  /** Returns a float in `[0, 1)`. */
  next(): number;
  /** Returns an integer in `[0, maxExclusive)`. */
  nextInt(maxExclusive: number): number;
}

const UINT32_SIZE = 4_294_967_296;
const FNV_OFFSET_BASIS = 2_166_136_261;
const FNV_PRIME = 16_777_619;
const MULBERRY_INCREMENT = 0x6d2b79f5;

function hashSeed(seed: number | string): number {
  const text = `seed:${seed}`;
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME);
  }
  return hash >>> 0;
}

/**
 * Deterministic pseudo random source (mulberry32 seeded through FNV-1a).
 *
 * The same seed and the same call order always produce the same sequence, so a
 * board, a test failure and a bug report can all be reproduced from one number.
 * Do not share one source between concurrent sessions; the order of calls is
 * part of the state.
 */
export function createRandomSource(seed: number | string): RandomSource {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_SIZE;
  };

  const nextInt = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError(`nextInt expects a positive integer, received ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };

  return { next, nextInt };
}
