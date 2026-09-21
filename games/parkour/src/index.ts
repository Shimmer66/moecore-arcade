import type { GameDefinition } from '@moecore/game-sdk';
import ParkourGame from './components/ParkourGame.vue';

export const game = {
  id: 'parkour',
  title: 'AI 娘星潮跑酷',
  component: ParkourGame,
} satisfies GameDefinition;
