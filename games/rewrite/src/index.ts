import type { GameDefinition } from '@moecore/game-sdk';
import RewriteGame from './RewriteGame.vue';

export const game = {
  id: 'rewrite',
  title: 'AI 娘闯关',
  component: RewriteGame,
} satisfies GameDefinition;
