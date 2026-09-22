import type { GameDefinition } from '@moecore/game-sdk';
import SokobanGame from './components/SokobanGame.vue';

export const game = {
  id: 'sokoban',
  title: '大肥鱼推箱子',
  component: SokobanGame,
} satisfies GameDefinition;

export { levels } from './rules/levels';
export type { Level } from './rules/types';
