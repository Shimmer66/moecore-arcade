import type { GameDefinition } from '@moecore/game-sdk';

export interface GameEntry {
  readonly id: string;
  readonly title: string;
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
    tags: ['动作', '多人'],
    tone: 'peach',
    badge: '本地双人 · 新作',
    load: async () => (await import('@moecore/game-starfall')).game,
  },
  {
    id: 'match3',
    title: 'AI 娘消消乐',
    category: '益智 · 单人',
    icon: 'grid',
    description: '交换图块触发连击，在 20 步内完成收集目标。',
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
    description: '白饭照吃，答案照送。越过回音礁，把小游戏送到灯塔。',
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
  {
    id: 'whale-queue',
    title: '鲸鲸的灵感长队',
    category: '动作 · 单人',
    icon: 'whale',
    description: '带着小鲸队伍穿过数据海，收集 30 颗灵感星，整理出一份温柔答案。',
    tags: ['动作', '单人'],
    tone: 'sky',
    badge: '🌊 新作',
    load: async () => (await import('@moecore/game-whale-queue')).game,
  },
  {
    id: 'duel',
    title: 'DeepSeek 娘：推演对决',
    category: '格斗 · 单人',
    icon: 'runner',
    description: '三人梗斗，变招脱身。练熟连击，再带着强化补丁打通三站连战。',
    tags: ['动作', '单人'],
    tone: 'sky',
    badge: '连战 · 练招 · 1v1',
    load: async () => (await import('@moecore/game-duel')).game,
  },
  {
    id: 'steady',
    title: '稳稳接住你',
    category: '物理解谜 · 单人',
    icon: 'runner',
    description: '你摆气球、磁铁和蹦床，GPT 接住你。让承诺接受一次离谱的物理检验。',
    tags: ['益智', '单人'],
    tone: 'lav',
    badge: '承诺实验室',
    load: async () => (await import('@moecore/game-steady')).game,
  },
  {
    id: 'arena',
    title: 'AI 娘：别乱生成！',
    category: '动作 · 单人',
    icon: 'runner',
    description: '她负责整活，你负责救场。穿过假桥、反重力和被压缩的地板。',
    tags: ['动作', '单人'],
    tone: 'lav',
    badge: '三场生成事故',
    load: async () => (await import('@moecore/game-arena')).game,
  },
  {
    id: 'rewrite',
    title: 'AI 娘闯关',
    category: '动作 · 单人',
    icon: 'runner',
    description: '选一位 AI 看板娘，连过五关：跳跃、射击、收集护盾，最后挑战幻觉大王。',
    tags: ['动作', '单人'],
    tone: 'lav',
    badge: '五关闯关',
    load: async () => (await import('@moecore/game-rewrite')).game,
  },
];

export function findGame(id: string): GameEntry | undefined {
  return games.find((game) => game.id === id);
}
