import type { Action, FighterId, Move, Strike } from './types';
export const ROSTER = {
  deepseek: {
    name: 'DeepSeek 娘',
    short: 'DeepSeek',
    role: '推演反击',
    color: '#70bdff',
    ink: '#193e8f',
    skill: '深度思考中',
    variant: '答案回溯',
    variantTip: '后撤留下一道延迟斩，惩罚追击。',
    ultimate: '答案收束 · 专家会诊',
    tip: '前两拳讲拳理，第三脚给结论。留一手深度思考反击。',
    keyTip: '连点「打」：两拳接飞踢',
    line: '想完了。这题我会。',
  },
  gpt: {
    name: 'GPT 娘',
    short: 'GPT',
    role: '贴身连段',
    color: '#85efca',
    ink: '#146454',
    skill: '灵感连击',
    variant: '再生成一版',
    variantTip: '命中或被挡后改稿突袭，打中可再接轻击。',
    ultimate: '无限联想 · 综上所述',
    tip: '首先靠近，其次连击，最后把她送走。',
    keyTip: '连点「打」，命中后接「技」',
    line: '再生成一版！',
  },
  doubao: {
    name: '豆包娘',
    short: '豆包',
    role: '气泡控场',
    color: '#ffaaa3',
    ink: '#893f43',
    skill: '包的 · 对话气泡',
    variant: '话题跳转',
    variantTip: '跃起上勾拳，把贴脸的对手送上去。',
    ultimate: '热聊时刻 · 省字不省拳',
    tip: '气泡先到，拳头随后。这局我真包了。',
    keyTip: '远处按「技」，蹲＋重对空',
    line: '我用最直白的话——揍。',
  },
} as const;
export const IDS: FighterId[] = ['deepseek', 'gpt', 'doubao'];
export const FPS = 60;
export const DIFFICULTIES = {
  easy: { label: '轻松', delay: 24, decision: 24, confirm: 0.2 },
  normal: { label: '标准', delay: 15, decision: 12, confirm: 0.5 },
  hard: { label: '挑战', delay: 9, decision: 8, confirm: 0.8 },
} as const;
export const ROUND_FRAMES = 75 * FPS;
export function strike(
  start: number,
  active: number,
  damage: number,
  reach: number,
  stun: number,
  block: number,
  push: number,
  down = false,
  launch = false,
): Strike {
  return { start, active, damage, reach, stun, block, push, down, launch };
}
const common: Partial<Record<Action, Move>> = {
  light1: { total: 20, strikes: [strike(6, 3, 40, 76, 18, 9, 8)] },
  light2: { total: 24, strikes: [strike(7, 3, 45, 84, 22, 10, 10)] },
  light3: { total: 38, strikes: [strike(10, 4, 65, 100, 0, 14, 120, true)] },
  low: { total: 23, strikes: [strike(7, 3, 40, 82, 18, 9, 8)] },
  upper: { total: 42, strikes: [strike(12, 4, 75, 88, 0, 14, 22, true, true)] },
  air: { total: 9999, strikes: [strike(8, 6, 60, 88, 18, 12, 20)] },
  airHeavy: { total: 9999, strikes: [strike(7, 7, 85, 104, 0, 15, 60, true)] },
  dash: { total: 16, strikes: [] },
  throw: { total: 36, strikes: [] },
  counter: { total: 30, strikes: [strike(5, 3, 140, 140, 0, 16, 130, true)] },
  meme: { total: 48, strikes: [] },
  eat: { total: 48, strikes: [] },
  kick: { total: 32, strikes: [strike(9, 4, 65, 110, 0, 12, 95, true)] },
  sweep: { total: 34, strikes: [strike(11, 4, 55, 102, 0, 14, 65, true)] },
};
function buildMove(id: FighterId, action: Action): Move | undefined {
  if (action === 'variant') {
    if (id === 'deepseek')
      return { total: 38, strikes: [strike(12, 5, 95, 128, 0, 15, 120, true)] };
    if (id === 'gpt') return { total: 29, strikes: [strike(8, 3, 75, 96, 22, 12, 8)] };
    return { total: 42, strikes: [strike(6, 6, 110, 100, 0, 15, 90, true, true)] };
  }
  if (action === 'heavy') {
    const [start, active, recovery, damage, reach] =
      id === 'deepseek'
        ? [14, 3, 25, 90, 120]
        : id === 'gpt'
          ? [11, 4, 27, 85, 78]
          : [16, 4, 22, 90, 100];
    return {
      total: start! + active! + recovery!,
      strikes: [
        strike(
          start!,
          active!,
          damage!,
          reach!,
          0,
          14,
          id === 'doubao' ? 150 : 90,
          true,
          id === 'gpt',
        ),
      ],
    };
  }
  if (action === 'skill') {
    if (id === 'deepseek') return { total: 40, strikes: [] };
    if (id === 'doubao') return { total: 41, strikes: [] };
    return {
      total: 50,
      strikes: [strike(12, 3, 65, 82, 24, 10, 4), strike(21, 3, 65, 96, 0, 14, 120, true)],
    };
  }
  if (action === 'super') {
    const start = id === 'gpt' ? 14 : 16;
    const active = id === 'gpt' ? 4 : 3;
    const recovery = id === 'gpt' ? 42 : id === 'deepseek' ? 40 : 38;
    return {
      total: start + active + recovery,
      strikes: [
        strike(
          start,
          active,
          280,
          id === 'gpt' ? 120 : id === 'deepseek' ? 170 : 180,
          0,
          18,
          130,
          true,
        ),
      ],
    };
  }
  return common[action];
}

const moves: Record<FighterId, Partial<Record<Action, Move>>> = {
  deepseek: { ...common },
  gpt: { ...common },
  doubao: { ...common },
};
for (const id of IDS) {
  for (const action of ['heavy', 'skill', 'variant', 'super'] as const) {
    const move = buildMove(id, action);
    if (move) moves[id][action] = move;
  }
}
/** Shared immutable-by-convention move data; no per-frame strike allocation. */
export function moveFor(id: FighterId, action: Action): Move | undefined {
  return moves[id][action];
}
