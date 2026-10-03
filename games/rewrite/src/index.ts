import type { GameDefinition } from '@moecore/game-sdk';
import RewriteGame from './RewriteGame.vue';

export const game = {
  id: 'rewrite',
  title: '幻觉防线',
  component: RewriteGame,
} satisfies GameDefinition;
