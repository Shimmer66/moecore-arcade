import type { GameDefinition } from '@moecore/game-sdk';
import WhaleQueueGame from './components/WhaleQueueGame.vue';

export const game = {
  id: 'whale-queue',
  title: '鲸鲸的灵感长队',
  component: WhaleQueueGame,
} satisfies GameDefinition;

export * from './rules';
