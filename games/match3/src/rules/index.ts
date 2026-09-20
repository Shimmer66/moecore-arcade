import type { CharacterId } from '@moecore/characters';

export interface Position {
  readonly row: number;
  readonly column: number;
}

export type Cell = CharacterId | null;
export type Board = ReadonlyArray<ReadonlyArray<Cell>>;
