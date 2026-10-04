import type { GameDefinition } from '@moecore/game-sdk';
import DuelGame from './DuelGame.vue';
export const game = {
  id: 'duel',
  title: '战斗吧，大肥鱼',
  component: DuelGame,
} satisfies GameDefinition;
