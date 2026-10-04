import type { GameDefinition } from '@moecore/game-sdk';
import RewriteGame from './RewriteGame.vue';

export const game = {
  id: 'rewrite',
  title: '模型战争',
  component: RewriteGame,
} satisfies GameDefinition;
