export function createRandom(seed: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('Seed must be an unsigned 32-bit integer.');
  }
  return seed;
}

// Local 32-bit LCG. State is a value, not a shared mutable closure; zero is a valid seed.
export function nextRandom(state: number): { readonly state: number; readonly value: number } {
  const next = (Math.imul(createRandom(state), 1_664_525) + 1_013_904_223) >>> 0;
  return { state: next, value: next / 0x1_0000_0000 };
}
