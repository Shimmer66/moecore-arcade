import type { GameDefinition } from '@moecore/game-sdk';
import Match3Game from './components/Match3Game.vue';

export const game = {
  id: 'match3',
  title: '幻觉消消乐',
  component: Match3Game,
} satisfies GameDefinition;
