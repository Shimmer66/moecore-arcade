import type { GameDefinition } from '@moecore/game-sdk';
import UncleGame from './UncleGame.vue';

export const game = {
  id: 'uncle',
  title: '舅舅的奇妙冒险',
  component: UncleGame,
} satisfies GameDefinition;
