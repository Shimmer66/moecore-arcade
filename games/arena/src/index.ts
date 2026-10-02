import type { GameDefinition } from '@moecore/game-sdk';
import ArenaGame from './CampaignGame.vue';
export const game = {
  id: 'arena',
  title: 'AI 娘：别乱生成！',
  component: ArenaGame,
} satisfies GameDefinition;
