import type { GameDefinition } from '@moecore/game-sdk';

export interface GameEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly icon: 'grid' | 'runner' | 'box';
  readonly description: string;
  readonly tags: readonly string[];
  readonly tone: 'mint' | 'sky' | 'peach' | 'lav' | 'lemon';
  readonly badge?: string;
  readonly load: () => Promise<GameDefinition>;
}

export const games: ReadonlyArray<GameEntry> = [
  {
    id: 'match3',
    title: 'AI 娘消消乐',
    category: '益智 · 单人',
    icon: 'grid',
    description: '三消玩法 × 大模型角色收集，连击触发角色专属反馈。',
    tags: ['益智', '单人'],
    tone: 'mint',
    badge: '🔥 热门',
    load: async () => (await import('@moecore/game-match3')).game,
  },
  {
    id: 'parkour',
    title: '大肥鱼跑酷：答案马上就到',
    category: '动作 · 单人',
    icon: 'runner',
    description: '一边跑酷一边等 AI 回答，答案生成完毕前别摔跤！',
    tags: ['动作', '单人'],
    tone: 'sky',
    badge: '🆕 新作',
    load: async () => (await import('@moecore/game-parkour')).game,
  },
  {
    id: 'sokoban',
    title: '大肥鱼 · 搬家日记',
    category: '益智 · 单人',
    icon: 'box',
    description: '让大肥鱼亲自推箱子回到鲸鱼标记，五关从入门到困难。',
    tags: ['益智', '单人'],
    tone: 'peach',
    badge: '✨ Vue 3 新作',
    load: async () => (await import('@moecore/game-sokoban')).game,
  },
];

export function findGame(id: string): GameEntry | undefined {
  return games.find((game) => game.id === id);
}
