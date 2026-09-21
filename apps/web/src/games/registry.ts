import type { GameDefinition } from '@moecore/game-sdk';

export interface GameEntry {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly icon: 'grid' | 'runner';
  readonly load: () => Promise<GameDefinition>;
}

export const games: ReadonlyArray<GameEntry> = [
  {
    id: 'match3',
    title: 'AI 娘消消乐',
    category: '益智 · 单人',
    icon: 'grid',
    load: async () => (await import('@moecore/game-match3')).game,
  },
  {
    id: 'parkour',
    title: '大肥鱼跑酷：答案马上就到',
    category: '动作 · 单人',
    icon: 'runner',
    load: async () => (await import('@moecore/game-parkour')).game,
  },
];

export function findGame(id: string): GameEntry | undefined {
  return games.find((game) => game.id === id);
}
