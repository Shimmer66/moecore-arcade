import type { GameDefinition } from '@moecore/game-sdk';
import ParkourExperience from './components/ParkourExperience.vue';
import { gameTitle } from './config/story';

export const game = {
  id: 'parkour',
  title: gameTitle,
  component: ParkourExperience,
} satisfies GameDefinition;
