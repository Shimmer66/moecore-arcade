import type { GameDefinition } from '@moecore/game-sdk';
import DuelGame from './DuelGame.vue';
export const game = {
  id: 'duel',
  title: 'DeepSeek 娘：推演对决',
  component: DuelGame,
} satisfies GameDefinition;
