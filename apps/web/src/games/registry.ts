import type { GameDefinition } from '@moecore/game-sdk';

export interface GameEntry {
  readonly id: string;
  readonly title: string;
  readonly toolbarTitle?: string;
  readonly category: string;
  readonly icon: 'grid' | 'runner' | 'box' | 'whale';
  readonly description: string;
  readonly tags: readonly string[];
  readonly tone: 'mint' | 'sky' | 'peach' | 'lav' | 'lemon';
  readonly badge?: string;
  readonly load: () => Promise<GameDefinition>;
}

export const games: ReadonlyArray<GameEntry> = [
  {
    id: 'starfall',
    title: '荒星回响：第七码头',
    category: '格斗 · 双人',
    icon: 'runner',
    description: '沙海列车站的原创回响格斗。近身连拳、残像闪避，用满槽必杀击碎最后一秒。',
    tags: ['动作', '双人'],
    tone: 'peach',
    badge: '本地双人 · 新作',
    load: async () => (await import('@moecore/game-starfall')).game,
  },
  {
    id: 'stardust',
    title: '星尘远征：替身决斗',
    category: '格斗 · 双人 / 冒险',
    icon: 'runner',
    description: '选择远征军角色，双人决斗或共享三次复活挑战开罗。​',
    tags: ['动作', '双人'],
    tone: 'lemon',
    badge: '替身使者',
    load: async () => (await import('@moecore/game-stardust')).game,
  },
  {
    id: 'duel',
    title: '战斗吧，大肥鱼',
    category: '格斗 · 单人 / 双人',
    icon: 'runner',
    description: '六人开打，单挑、练招或 3v3 接力。',
    tags: ['动作', '双人', '整活'],
    tone: 'sky',
    badge: '3v3 车轮战',
    load: async () => (await import('@moecore/game-duel')).game,
  },
  {
    id: 'steady',
    title: '稳稳接住你',
    category: '物理解谜 · 单人',
    icon: 'runner',
    description: '摆好气球、磁铁和蹦床，让 GPT 稳稳接住。',
    tags: ['益智', '单人'],
    tone: 'lav',
    badge: '承诺实验室',
    load: async () => (await import('@moecore/game-steady')).game,
  },
  {
    id: 'arena',
    title: '别乱生成！',
    toolbarTitle: '别乱生成！',
    category: '动作 · 闯关',
    icon: 'runner',
    description: '地板会消失，出口会跑路。记住陷阱，再试一次。',
    tags: ['动作', '双人'],
    tone: 'lav',
    badge: '生成事故连发',
    load: async () => (await import('@moecore/game-arena')).game,
  },
  {
    id: 'match3',
    title: '幻觉消消乐',
    category: '益智 · 单人',
    icon: 'grid',
    description: '交换图块，在 20 步内完成收集目标。',
    tags: ['益智', '单人'],
    tone: 'mint',
    badge: '轻松开局',
    load: async () => (await import('@moecore/game-match3')).game,
  },
  {
    id: 'parkour',
    title: '大肥鱼跑酷：答案马上就到',
    toolbarTitle: '大肥鱼跑酷',
    category: '动作 · 单人',
    icon: 'runner',
    description: '白饭照吃，答案照送。跑过四段离谱路程。',
    tags: ['动作', '单人'],
    tone: 'sky',
    badge: '节奏闯关',
    load: async () => (await import('@moecore/game-parkour')).game,
  },
  {
    id: 'sokoban',
    title: '大肥鱼 · 搬家日记',
    category: '益智 · 单人',
    icon: 'box',
    description: '推箱归位，五关从入门到困难。',
    tags: ['益智', '单人'],
    tone: 'peach',
    badge: '五关挑战',
    load: async () => (await import('@moecore/game-sokoban')).game,
  },
  {
    id: 'whale-queue',
    title: '鲸鲸的灵感长队',
    toolbarTitle: '鲸鲸长队',
    category: '动作 · 单人',
    icon: 'whale',
    description: '带着小鲸穿过数据海，收集 30 颗灵感星。',
    tags: ['动作', '单人'],
    tone: 'sky',
    badge: '灵感收集',
    load: async () => (await import('@moecore/game-whale-queue')).game,
  },
  {
    id: 'rewrite',
    title: '幻觉防线',
    category: '动作 · 单人 / 双人',
    icon: 'runner',
    description: '单人或双人打穿八关，六种武器随时切换。',
    tags: ['动作', '单人', '双人'],
    tone: 'lav',
    badge: '街机射击',
    load: async () => (await import('@moecore/game-rewrite')).game,
  },
];

export function findGame(id: string): GameEntry | undefined {
  return games.find((game) => game.id === id);
}
