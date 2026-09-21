import type { GameDefinition } from '@moecore/game-sdk';
import ParkourGame from './components/ParkourGame.vue';
import { gameTitle } from './config/story';

export const game = {
  id: 'parkour',
  title: gameTitle,
  component: ParkourGame,
} satisfies GameDefinition;
