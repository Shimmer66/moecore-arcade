import type { GameDefinition } from '@moecore/game-sdk';
import StardustGame from './StardustGame.vue';
import { STARDUST_GAME_ID, STARDUST_GAME_TITLE } from './meta';

export const game = {
  id: STARDUST_GAME_ID,
  title: STARDUST_GAME_TITLE,
  component: StardustGame,
} satisfies GameDefinition;
