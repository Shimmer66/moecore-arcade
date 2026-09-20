import type { CharacterId } from '@moecore/characters';

/** A board coordinate. Rows grow downwards, columns grow to the right. */
export interface Position {
  readonly row: number;
  readonly column: number;
}

/** `null` stays reserved for cells that are empty while pieces fall in later steps. */
export type Cell = CharacterId | null;
/** Missing cells in ragged rows are gaps, not swappable cells. */
export type Board = ReadonlyArray<ReadonlyArray<Cell>>;
