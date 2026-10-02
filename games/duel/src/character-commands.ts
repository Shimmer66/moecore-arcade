import type { Command, FighterId } from './types';
export interface MotionPattern {
  directions: number[];
  command: Command;
  label: string;
  window: number;
  button?: 'punch' | 'kick';
}
export const CHARGE_FRAMES = 40;
export const CHARGE_RELEASE_WINDOW = 8;
export const CHARACTER_COMMANDS: Record<FighterId, { input: string; name: string; tip: string }> = {
  deepseek: {
    input: '→↘↓↙←＋脚',
    name: '饭别凉了',
    tip: '半圈后接腿，发动后撤尾巴斩。消耗25能量，与V共用冷却。',
  },
  gpt: {
    input: '←↙↓↘→＋拳',
    name: '稳稳接住你',
    tip: '半圈前接拳，准备接住下落的对手。与F共用冷却，抓住后仍可拆投。',
  },
  doubao: {
    input: '按后蓄40帧 → 前＋拳',
    name: '憋个包，再发出去',
    tip: '按后或蹲后蓄力后向前出拳，发气泡；两拳同时按为EX双气泡，花50能量。',
  },
  client: {
    input: '→↘↓↙←＋拳 / Y',
    name: '合同签了，别跑',
    tip: '6帧起手、70距离、180伤害。抓住后不能按投技拆开；起跳、后撤和惩罚空抓能应对。',
  },
  prompt_sage: {
    input: '→↘↓↙←＋拳',
    name: '先画个圈圈你',
    tip: '半圈后接拳，放下减速符阵。与F共用冷却，可跳过或防住。',
  },
  unplug_uncle: {
    input: '按后蓄40帧 → 前＋脚',
    name: '网线蓄满了',
    tip: '向后蓄力后前＋脚，甩网线拉人；两脚同时按为EX，只断对手的网，花50能量。',
  },
};
export function characterPatterns(id: FighterId): MotionPattern[] {
  if (id === 'deepseek')
    return [
      {
        directions: [6, 3, 2, 1, 4],
        command: 'variant',
        label: '半圈后脚 · 饭别凉了',
        window: 34,
        button: 'kick',
      },
    ];
  if (id === 'gpt')
    return [
      { directions: [4, 1, 2, 3, 6], command: 'meme', label: '半圈前拳 · 稳稳接住', window: 34 },
    ];
  if (id === 'client')
    return [
      {
        directions: [6, 3, 2, 1, 4],
        command: 'commandGrab',
        label: '指令投 · 合同签了，别跑',
        window: 34,
      },
    ];
  if (id === 'prompt_sage')
    return [
      { directions: [6, 3, 2, 1, 4], command: 'meme', label: '半圈后拳 · 圈住你', window: 34 },
    ];
  return [];
}
