import type { GameDefinition } from '@moecore/game-sdk';
import SteadyGame from './SteadyGame.vue';

export const game = {
  id: 'steady',
  title: '稳稳接住你',
  component: SteadyGame,
} satisfies GameDefinition;
