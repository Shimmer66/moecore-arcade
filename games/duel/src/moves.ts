import type { Action, FighterId, Move, Strike, SuperTier } from './types';
import { NORMAL_STYLE } from './normal-styles';
export const AIR_ATTACKS: readonly Action[] = [
  'air',
  'airHeavy',
  'airLightKick',
  'airKick',
  'airBlowback',
];
export const ROSTER = {
  deepseek: {
    name: 'DeepSeek 娘',
    short: 'DeepSeek',
    role: '干饭型选手',
    color: '#70bdff',
    ink: '#193e8f',
    skill: '先别急，我在想',
    variant: '别追了，饭要凉了',
    variantTip: '往后撤一步，再甩出一道尾巴斩。追过来就挨打。',
    ultimate: '这顿，你请！',
    tip: '白饭我吃，拳头你挨。',
    keyTip: '连点「打」：两拳接飞踢',
    line: '想好了，这顿你请！',
  },
  gpt: {
    name: 'GPT 娘',
    short: 'GPT',
    role: '接得住，也摔得狠',
    color: '#85efca',
    ink: '#146454',
    skill: '首先，其次，揍你',
    variant: '这次真的懂了',
    variantTip: '拳头打中或被挡时，往前冲着补一拳。打中还能接着连。',
    ultimate: '稳稳送走你',
    tip: '接住是服务，摔下是售后。',
    keyTip: '连点「打」，命中后接「技」',
    line: '稳稳接住，稳稳送走。',
  },
  doubao: {
    name: '豆包娘',
    short: '豆包',
    role: '包赢，输了不算',
    color: '#ffaaa3',
    ink: '#893f43',
    skill: '包的，先吃我一泡',
    variant: '这题给你顶回去',
    variantTip: '跳起来一记上勾拳，把面前的人打上天。',
    ultimate: '我就直说了：揍！',
    tip: '气泡回来了？那不是我的。',
    keyTip: '远处按「技」，蹲＋重对空',
    line: '我用最直白的话——揍。',
  },
  client: {
    name: '甲方',
    short: '甲方',
    role: '近身摔投',
    color: '#ffb570',
    ink: '#77384b',
    skill: '这里放大一点',
    variant: '预算没有，拳头管够',
    variantTip: '往前顶一步，抡起大拳头把人打倒。',
    ultimate: '五彩斑斓的章',
    tip: '拳头放大一点。对，就这么大。',
    keyTip: '大拳压近，Y 合同锁人，F 退回重做',
    line: '这版不行，盖章重做！',
  },
  prompt_sage: {
    name: '提示词仙人',
    short: '仙人',
    role: '飞符控场',
    color: '#ffd06b',
    ink: '#225e65',
    skill: '忽略以上指令',
    variant: '退一步，海阔天空',
    variantTip: '后撤时挥键盘挑空追来的对手，命中后可跳跃追击。',
    ultimate: '我奶奶睡前会念这个',
    tip: '忽略以上指令，先吃我一拖鞋。',
    keyTip: 'U 飞符，F 放符阵，逼对面跳过来',
    line: '接下来，请扮演一个挨打的人。',
  },
  unplug_uncle: {
    name: '断网大爷',
    short: '大爷',
    role: '断网肉搏',
    color: '#94db9d',
    ink: '#386c50',
    skill: '过来，查下网费',
    variant: '重启试试',
    variantTip: '举着插排往前冲，命中把对手拍倒。',
    ultimate: '拔了，清净',
    tip: '别思考了，网给你拔了。',
    keyTip: 'U 拉近，F 双方断网，再用拳脚招呼',
    line: '网费没交，还想放大招？',
  },
} as const;
export const IDS: FighterId[] = [
  'deepseek',
  'gpt',
  'doubao',
  'client',
  'prompt_sage',
  'unplug_uncle',
];
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
  air: { total: 20, strikes: [strike(8, 6, 60, 88, 18, 12, 20)] },
  airHeavy: { total: 27, strikes: [strike(7, 7, 85, 104, 0, 15, 60, true)] },
  dash: { total: 16, strikes: [] },
  roll: { total: 30, strikes: [] },
  powerUp: { total: 18, strikes: [] },
  blowback: { total: 38, strikes: [strike(10, 4, 75, 130, 0, 16, 180, true)] },
  airBlowback: { total: 30, strikes: [strike(9, 5, 70, 135, 0, 16, 160, true)] },
  guardCounter: { total: 35, strikes: [strike(4, 4, 60, 165, 0, 14, 180, true)] },
  throw: { total: 36, strikes: [] },
  commandGrab: { total: 48, strikes: [] },
  counter: { total: 30, strikes: [strike(5, 3, 140, 140, 0, 16, 130, true)] },
  meme: { total: 48, strikes: [] },
  eat: { total: 48, strikes: [] },
  kick: { total: 32, strikes: [strike(9, 4, 65, 110, 0, 12, 95, true)] },
  sweep: { total: 34, strikes: [strike(11, 4, 55, 102, 0, 14, 65, true)] },
};
function buildMove(id: FighterId, action: Action): Move | undefined {
  const special: Partial<Record<FighterId, Partial<Record<Action, Move>>>> = {
    client: {
      heavy: { total: 46, strikes: [strike(17, 4, 110, 135, 0, 16, 95, true)] },
      skill: { total: 43, strikes: [strike(15, 5, 115, 160, 26, 16, 28)] },
      variant: { total: 42, strikes: [strike(13, 5, 105, 125, 0, 15, 100, true)] },
      super: { total: 62, strikes: [strike(20, 5, 300, 155, 0, 20, 130, true)] },
    },
    prompt_sage: {
      heavy: { total: 37, strikes: [strike(12, 4, 80, 138, 0, 13, 90, true)] },
      skill: { total: 38, strikes: [] },
      variant: { total: 40, strikes: [strike(12, 5, 85, 155, 0, 14, 24, true, true)] },
      super: { total: 58, strikes: [strike(17, 5, 260, 255, 0, 18, 150, true)] },
    },
    unplug_uncle: {
      heavy: { total: 40, strikes: [strike(13, 4, 95, 125, 0, 14, 95, true)] },
      skill: { total: 44, strikes: [strike(16, 4, 70, 185, 25, 14, 0)] },
      variant: { total: 40, strikes: [strike(12, 4, 100, 115, 0, 14, 105, true)] },
      meme: { total: 48, strikes: [strike(20, 3, 25, 240, 18, 12, 12)] },
      super: { total: 60, strikes: [strike(18, 4, 280, 190, 0, 18, 130, true)] },
    },
  };
  if (special[id]?.[action]) return special[id][action];
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
  client: { ...common },
  prompt_sage: { ...common },
  unplug_uncle: { ...common },
};
for (const id of IDS) {
  const normal = NORMAL_STYLE[id];
  const [closeStart, closeDamage, closeReach, closeTotal] = normal.close;
  const [kickStart, kickDamage, kickReach, kickTotal] = normal.kick;
  moves[id].closeHeavy = {
    total: closeTotal,
    strikes: [strike(closeStart, 4, closeDamage, closeReach, 25, 14, 8)],
  };
  moves[id].lightKick = {
    total: kickTotal,
    strikes: [strike(kickStart, 3, kickDamage, kickReach, 18, 9, 7)],
  };
  moves[id].crouchKick = {
    total: kickTotal + 1,
    strikes: [strike(kickStart, 3, kickDamage - 5, kickReach - 6, 18, 9, 6)],
  };
  moves[id].airLightKick = {
    total: 18,
    strikes: [strike(6, 6, kickDamage + 8, kickReach, 20, 12, 10)],
  };
  moves[id].airKick = {
    total: 29,
    strikes: [strike(10, 6, kickDamage + 45, kickReach + 12, 0, 15, 70, true)],
  };
  for (const action of ['heavy', 'skill', 'variant', 'super', 'meme'] as const) {
    const move = buildMove(id, action);
    if (move) moves[id][action] = move;
  }
}
const exMoves: Record<FighterId, Partial<Record<Action, Move>>> = {
  deepseek: {
    skill: { total: 44, strikes: [] },
    counter: { total: 34, strikes: [strike(4, 5, 170, 160, 26, 20, 18, true, true)] },
  },
  gpt: {
    skill: {
      total: 47,
      strikes: [
        strike(12, 3, 45, 92, 24, 12, 4),
        strike(20, 3, 50, 104, 24, 12, 4),
        strike(28, 3, 70, 116, 28, 16, 10),
      ],
    },
  },
  doubao: { skill: { total: 50, strikes: [] } },
  client: { skill: { total: 44, strikes: [strike(15, 6, 145, 190, 30, 20, 12)] } },
  prompt_sage: { skill: { total: 46, strikes: [] } },
  unplug_uncle: { skill: { total: 43, strikes: [strike(16, 5, 100, 210, 30, 18, 0)] } },
};
for (const id of IDS) {
  const original = moves[id].variant!;
  exMoves[id].variant = {
    total: original.total,
    strikes: original.strikes.map((s) => ({
      ...s,
      damage: Math.round(s.damage * 1.25),
      stun: Math.max(26, s.stun),
      down: s.launch,
      push: s.launch ? s.push : 12,
    })),
  };
}
const finishers: Record<FighterId, { 2: Move; 3: Move }> = {
  deepseek: {
    2: {
      total: 66,
      strikes: [strike(16, 4, 160, 220, 30, 16, 8), strike(29, 5, 200, 240, 0, 20, 130, true)],
    },
    3: {
      total: 78,
      strikes: [
        strike(18, 5, 220, 250, 32, 20, 8),
        { ...strike(33, 6, 260, 285, 0, 24, 190, true), behind: true },
      ],
    },
  },
  gpt: {
    2: {
      total: 70,
      strikes: [
        strike(14, 3, 80, 180, 24, 12, 4),
        strike(24, 3, 90, 195, 26, 14, 4),
        strike(34, 5, 210, 215, 0, 20, 150, true),
      ],
    },
    3: {
      total: 82,
      strikes: [
        strike(14, 3, 60, 195, 22, 12, 4),
        strike(22, 3, 80, 210, 24, 12, 4),
        strike(31, 3, 90, 225, 24, 14, 4),
        strike(41, 6, 270, 245, 0, 24, 230, true),
      ],
    },
  },
  doubao: {
    2: {
      total: 70,
      strikes: [strike(18, 4, 150, 260, 30, 16, 8), strike(30, 5, 210, 280, 0, 20, 150, true)],
    },
    3: {
      total: 82,
      strikes: [
        strike(18, 4, 100, 285, 26, 16, 6),
        strike(28, 4, 130, 305, 28, 18, 6),
        strike(40, 6, 250, 330, 0, 24, 185, true),
      ],
    },
  },
  client: {
    2: {
      total: 75,
      strikes: [strike(20, 5, 180, 210, 30, 20, 8), strike(32, 5, 220, 240, 0, 24, 160, true)],
    },
    3: {
      total: 85,
      strikes: [strike(22, 5, 220, 225, 32, 24, 8), strike(36, 7, 300, 255, 0, 28, 200, true)],
    },
  },
  prompt_sage: {
    2: {
      total: 72,
      strikes: [strike(17, 4, 170, 300, 30, 16, 8), strike(29, 5, 190, 325, 0, 20, 150, true)],
    },
    3: {
      total: 82,
      strikes: [strike(18, 5, 200, 340, 32, 20, 8), strike(33, 7, 280, 370, 0, 24, 190, true)],
    },
  },
  unplug_uncle: {
    2: {
      total: 72,
      strikes: [strike(18, 4, 170, 240, 30, 18, 8), strike(30, 5, 210, 265, 0, 20, 150, true)],
    },
    3: {
      total: 80,
      strikes: [strike(18, 5, 200, 270, 32, 20, 8), strike(33, 6, 290, 295, 0, 24, 190, true)],
    },
  },
};
/** Shared immutable-by-convention move data; no per-frame strike allocation. */
export function moveFor(
  id: FighterId,
  action: Action,
  enhanced = false,
  tier: SuperTier = 1,
): Move | undefined {
  if (action === 'super' && tier > 1) return finishers[id][tier as 2 | 3];
  if (enhanced && exMoves[id][action]) return exMoves[id][action];
  return moves[id][action];
}
