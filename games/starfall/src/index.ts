import type { GameDefinition } from '@moecore/game-sdk';
import StarfallGame from './StarfallGame.vue';

export const game = {
  id: 'starfall',
  title: '荒星回响：第七码头',
  component: StarfallGame,
} satisfies GameDefinition;
