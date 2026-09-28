import type { Difficulty, FighterId, GameMode } from './types';
// Only survives a host replay. A fresh visit (attempt=1) uses the selection screen.
export const replaySelection: {
  player: FighterId;
  opponent: FighterId;
  mode: GameMode;
  difficulty: Difficulty;
} = {
  player: 'deepseek',
  opponent: 'gpt',
  mode: 'quick',
  difficulty: 'normal',
};
