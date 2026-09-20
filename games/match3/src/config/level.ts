import type { Level } from '../rules/session';
import { prototypeConfig } from './prototype';

export const firstLevel: Level = {
  rows: prototypeConfig.rows,
  columns: prototypeConfig.columns,
  characterIds: prototypeConfig.characterIds,
  moves: prototypeConfig.startingMoves,
  goals: [
    { character: 'deepseek', count: 12 },
    { character: 'gpt', count: 12 },
    { character: 'kimi', count: 12 },
  ],
};
