import { CHARACTERS } from '@moecore/characters';
import { describe, expect, it } from 'vitest';
import { prototypeConfig } from '../src/index';

describe('match3 prototype configuration', () => {
  it('defines a finite board and move budget', () => {
    expect(prototypeConfig.rows).toBe(8);
    expect(prototypeConfig.columns).toBe(8);
    expect(prototypeConfig.startingMoves).toBe(20);
  });

  it('uses the six known characters without duplicates', () => {
    const ids = prototypeConfig.characterIds;
    expect(new Set(ids).size).toBe(6);
    expect(ids).toEqual(CHARACTERS.map((character) => character.id));
  });
});
