import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../src/index';

describe('character catalogue', () => {
  it('uses unique stable identifiers', () => {
    const ids = CHARACTERS.map((character) => character.id);
    expect(ids).toEqual(['deepseek', 'glm', 'gpt', 'claude', 'gemini', 'kimi']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not present candidate artwork as approved', () => {
    for (const character of CHARACTERS) {
      expect(character.displayName.length).toBeGreaterThan(0);
      expect(character.artworkStatus).toBe('pending-review');
    }
  });
});
