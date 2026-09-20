import { CHARACTERS } from '@moecore/characters';

// Prototype inputs, not a playable level or a generated board.
export const prototypeConfig = {
  id: 'match3',
  rows: 8,
  columns: 8,
  startingMoves: 20,
  characterIds: CHARACTERS.map((character) => character.id),
} as const;
