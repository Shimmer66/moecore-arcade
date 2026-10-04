import type { Difficulty, FighterId, GameMode, TeamLineups } from './types';
import { cloneLineups, DEFAULT_TEAMS } from './teams';
// Only survives a host replay. A fresh visit (attempt=1) uses the selection screen.
export const replaySelection: {
  player: FighterId;
  opponent: FighterId;
  mode: GameMode;
  difficulty: Difficulty;
  teamLineups: TeamLineups;
  teamLocal: boolean;
} = {
  player: 'deepseek',
  opponent: 'gpt',
  mode: 'quick',
  difficulty: 'normal',
  teamLineups: cloneLineups(DEFAULT_TEAMS),
  teamLocal: false,
};
