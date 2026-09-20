import type { GameDefinition } from '@moecore/game-sdk';
import Match3Game from './components/Match3Game.vue';

export const game = {
  id: 'match3',
  title: 'AI 娘消消乐',
  component: Match3Game,
} satisfies GameDefinition;
