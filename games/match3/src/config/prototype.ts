import { CHARACTERS } from '@moecore/characters';

// Starting values for the single prototype level, not balanced difficulty targets.
export const prototypeConfig = {
  id: 'match3',
  rows: 8,
  columns: 8,
  startingMoves: 20,
  characterIds: CHARACTERS.map((character) => character.id),
} as const;
