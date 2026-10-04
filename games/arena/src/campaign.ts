import { createTrapScene, type Rect, type Trap, type TrapEffect } from './traps';

export interface Room {
  width?: number;
  id: string;
  chapter: string;
  title: string;
  promise: string;
  spawn: { x: number; y: number };
  exit: Rect;
  floors: Rect[];
  traps: Trap[];
  secret: { x: number; y: number };
  cloneSpawns?: { x: number; y: number }[];
  secretTravel?: { x: number; y: number; ticks: number; loop?: boolean };
  secretGrowth?: number;
}

const zone = (x: number, w = 70): Rect => ({ x, y: 0, w, h: 440 });
const floor: Rect = { x: 0, y: 354, w: 1000, h: 86 };
function trap(
  id: string,
  effect: TrapEffect,
  x: number,
  body: Rect,
  line: string,
  options: Partial<
    Pick<Trap, 'delay' | 'duration' | 'travel' | 'after' | 'cycle' | 'triggerOn'>
  > = {},
): Trap {
  return {
    id,
    effect,
    trigger: zone(x),
    body,
    line,
    delay: 12,
    ...options,
    ...((effect === 'gravity' || effect === 'platform') && options.duration ? { rearm: true } : {}),
  };
}
const pit = (id: string, trigger: number, x: number, line: string, after?: string) =>
  trap(id, 'pit', trigger, { x, y: 354, w: 110, h: 86 }, line, after ? { after } : {});
const spike = (id: string, trigger: number, x: number, line: string, after?: string) =>
  trap(id, 'spikes', trigger, { x, y: 324, w: 60, h: 30 }, line, after ? { after } : {});
function room(
  id: string,
  chapter: string,
  title: string,
  promise: string,
  traps: Trap[],
  secret = { x: 500, y: 220 },
  floors: Rect[] = [{ ...floor }],
): Room {
  return {
    id,
    chapter,
    title,
    promise,
    traps,
    secret,
    floors,
    spawn: { x: 50, y: 306 },
    exit: { x: 920, y: 292, w: 64, h: 62 },
  };
}

// Authored encounters, not seeded permutations: each adds a different expectation reversal.
export const CAMPAIGN: Room[] = [
  room('hallucination', '幻觉入门', '来源：我自己', '前方道路已验证。', [
    pit('bridge', 190, 300, '引用不存在，桥也不存在。'),
  ]),
  room('autocomplete', '幻觉入门', '猜你想跳', '已经帮你补全剩余内容。', [
    spike('completion', 180, 290, '自动补全：尖刺。'),
    spike('landing', 350, 465, '还有你落脚的地方。', 'completion'),
  ]),
  room('citation', '幻觉入门', '参考资料不存在', '桥梁报告有三篇参考文献。', [
    pit('source1', 170, 280, '第一篇：404。'),
    pit('source2', 440, 550, '第二篇：也是404。'),
  ]),
  room('confident', '幻觉入门', '百分之百确定', '出口就在这里，我非常确定。', [
    trap('door', 'exit', 770, { x: 920, y: 292, w: 48, h: 62 }, '更正：出口在另一边。', {
      travel: { x: -720, y: 0, ticks: 24 },
    }),
    spike('return', 640, 560, '返回路径也已为你优化。', 'door'),
  ]),
  room('compression', '上下文危机', '删去不重要的', '压缩不会影响核心内容。', [
    pit('past', 270, 190, '已删除：你走过的路。'),
    pit('future', 420, 530, '已删除：还没走过的路。', 'past'),
  ]),
  room('thinking', '上下文危机', '让我想一想', '正在进行深度思考。', [
    trap('thought', 'falling', 220, { x: 360, y: 70, w: 80, h: 50 }, '思维链有点重。', {
      delay: 18,
      travel: { x: 0, y: 320, ticks: 30 },
    }),
    trap('thought2', 'falling', 460, { x: 600, y: 70, w: 80, h: 50 }, '再想一步。', {
      delay: 18,
      travel: { x: 0, y: 320, ticks: 30 },
    }),
  ]),
  room('alignment', '上下文危机', '方向已对齐', '已充分理解你的意图。', [
    trap('reverse', 'reverse', 250, zone(250, 360), '你说向右，我理解为向左。', {
      duration: 100,
      delay: 20,
    }),
    spike('aligned', 530, 660, '对齐完成。'),
  ]),
  room('followup', '上下文危机', '你说得对', '感谢指正，问题已修复。', [
    pit('mistake', 170, 280, '确实有问题。'),
    spike('fix', 365, 480, '修复引入了一个小问题。', 'mistake'),
    pit('regression', 600, 710, '小问题已升级。', 'fix'),
  ]),
  room(
    'token-saw',
    '推理加速',
    'Token 切片',
    '长文本正在分块处理。',
    [
      trap('slicer', 'saw', 50, { x: 380, y: 310, w: 44, h: 44 }, '正在切片，请勿靠近。', {
        delay: 0,
        travel: { x: 150, y: 0, ticks: 65, loop: true },
      }),
    ],
    { x: 455, y: 205 },
  ),
  room(
    'rate-limit',
    '推理加速',
    '请求过于频繁',
    '服务始终在线。',
    [
      trap('quota', 'gate', 50, { x: 470, y: 100, w: 28, h: 254 }, '429：稍后重试。', {
        delay: 0,
        cycle: { active: 105, rest: 65 },
      }),
    ],
    { x: 710, y: 220 },
  ),
  room(
    'upward',
    '推理加速',
    '向上发展',
    '这次优化绝对有提升。',
    [
      trap('up', 'gravity', 175, zone(0, 1000), '提升了。物理意义上。', {
        delay: 12,
        duration: 140,
      }),
    ],
    { x: 510, y: 135 },
    [
      { x: 0, y: 354, w: 300, h: 86 },
      { x: 730, y: 354, w: 270, h: 86 },
      { x: 100, y: 65, w: 780, h: 24 },
    ],
  ),
  room(
    'batching',
    '推理加速',
    '拼车推理',
    '请等待下一批请求。',
    [
      trap('shuttle', 'platform', 0, { x: 240, y: 354, w: 145, h: 20 }, '本批请求即将出发。', {
        delay: 0,
        travel: { x: 400, y: 0, ticks: 160, loop: true },
      }),
    ],
    { x: 550, y: 230 },
    [
      { x: 0, y: 354, w: 260, h: 86 },
      { x: 730, y: 354, w: 270, h: 86 },
    ],
  ),
  room('streaming', '推理加速', '流式输出', '答案会一个字一个字出现。', [
    pit('stream-gap', 150, 270, '输出中断。'),
    trap('stream-saw', 'saw', 390, { x: 600, y: 310, w: 44, h: 44 }, '继续生成中。', {
      delay: 12,
      travel: { x: 170, y: 0, ticks: 70, loop: true },
    }),
  ]),
  room('double-quota', '推理加速', '免费额度用完了', '下一扇门免费。', [
    trap('free', 'gate', 50, { x: 340, y: 100, w: 28, h: 254 }, '本分钟额度耗尽。', {
      delay: 0,
      cycle: { active: 80, rest: 65 },
    }),
    trap('paid', 'gate', 450, { x: 690, y: 100, w: 28, h: 254 }, '高级版也限流。', {
      delay: 0,
      cycle: { active: 100, rest: 65 },
    }),
  ]),
  room(
    'ceiling-context',
    '推理加速',
    '天花板也算上下文',
    '高处没有障碍。',
    [
      trap('flip', 'gravity', 175, zone(0, 1000), '重力优化完成。', { delay: 12, duration: 155 }),
      trap(
        'ceiling-spike',
        'spikes',
        340,
        { x: 500, y: 89, w: 60, h: 30 },
        '补充：天花板有一点尖。',
        { delay: 10 },
      ),
    ],
    { x: 530, y: 215 },
    [
      { x: 0, y: 354, w: 300, h: 86 },
      { x: 730, y: 354, w: 270, h: 86 },
      { x: 100, y: 65, w: 780, h: 24 },
    ],
  ),
  room('benchmark', '推理加速', '榜一体验', '测试环境一切正常。', [
    trap('bench-saw', 'saw', 50, { x: 300, y: 310, w: 44, h: 44 }, '实机表现可能存在差异。', {
      delay: 0,
      travel: { x: 150, y: 0, ticks: 65, loop: true },
    }),
    trap('bench-gate', 'gate', 490, { x: 710, y: 100, w: 28, h: 254 }, '结果正在排队发布。', {
      delay: 0,
      cycle: { active: 80, rest: 70 },
    }),
  ]),
  room(
    'confident-link',
    '对齐现场',
    '这个链接绝对能用',
    '绿色的那个就是出口。',
    [
      trap('fake', 'decoy', 0, { x: 480, y: 292, w: 64, h: 62 }, '置信度 99.9%，可用性另算。', {
        delay: 0,
      }),
    ],
    { x: 505, y: 200 },
  ),
  room(
    'overthinking',
    '对齐现场',
    '别想太多',
    '这一段其实可以直接走。',
    [
      trap(
        'jump-punish',
        'spikes',
        230,
        { x: 345, y: 175, w: 60, h: 30 },
        '检测到过度思考，追加一点难度。',
        { delay: 0, triggerOn: 'jump' },
      ),
    ],
    { x: 730, y: 210 },
  ),
  room(
    'rollback',
    '对齐现场',
    '已回滚到上一版',
    '出口已经部署到前方。',
    [
      trap(
        'rollback-door',
        'exit',
        760,
        { x: 920, y: 292, w: 64, h: 62 },
        '部署失败，出口已回滚。',
        { delay: 8, travel: { x: -740, y: 0, ticks: 24 } },
      ),
      trap('rollback-gap', 'pit', 650, { x: 490, y: 354, w: 120, h: 86 }, '回滚不包括地板。', {
        delay: 8,
        after: 'rollback-door',
        triggerOn: 'left',
      }),
    ],
    { x: 555, y: 215 },
  ),
  room(
    'reasoning-budget',
    '对齐现场',
    '思考预算超支',
    '跳过去就好了。',
    [
      pit('budget-gap', 140, 280, '这一步确实要跳。'),
      trap(
        'budget-block',
        'falling',
        200,
        { x: 440, y: 70, w: 80, h: 50 },
        '思考太久，账单掉下来了。',
        {
          delay: 5,
          triggerOn: 'jump',
          travel: { x: 0, y: 320, ticks: 25 },
        },
      ),
    ],
    { x: 680, y: 220 },
  ),
  {
    ...room('promotion', '对齐现场', '逐层微调', '再调一层，效果会更好。', [], { x: 655, y: 100 }, [
      { ...floor },
      { x: 200, y: 290, w: 115, h: 20 },
      { x: 385, y: 225, w: 115, h: 20 },
      { x: 570, y: 160, w: 150, h: 20 },
      { x: 790, y: 200, w: 210, h: 20 },
    ]),
    exit: { x: 920, y: 138, w: 64, h: 62 },
  },
  room(
    'free-trial',
    '对齐现场',
    '免费试用即将结束',
    '这块地板暂时免费。',
    [
      trap('trial', 'platform', 220, { x: 290, y: 354, w: 370, h: 20 }, '试用剩余不到两秒。', {
        delay: 0,
        duration: 85,
      }),
    ],
    { x: 550, y: 225 },
    [
      { x: 0, y: 354, w: 300, h: 86 },
      { x: 650, y: 354, w: 350, h: 86 },
    ],
  ),
  {
    ...room(
      'elevator-pitch',
      '对齐现场',
      '垂直领域大模型',
      '我们在垂直方向有优势。',
      [
        trap('elevator', 'platform', 0, { x: 390, y: 354, w: 150, h: 20 }, '优势正在上升。', {
          delay: 0,
          travel: { x: 0, y: -135, ticks: 100, loop: true },
        }),
      ],
      { x: 485, y: 115 },
      [{ ...floor }, { x: 610, y: 215, w: 390, h: 22 }],
    ),
    exit: { x: 920, y: 153, w: 64, h: 62 },
  },
  room(
    'aligned-release',
    '对齐现场',
    '完全符合预期',
    '所有问题均已解决。',
    [
      trap(
        'release-fake',
        'decoy',
        0,
        { x: 310, y: 292, w: 64, h: 62 },
        '首先，这是一个模拟出口。',
        { delay: 0 },
      ),
      trap('release-reverse', 'reverse', 480, zone(0, 1000), '其次，左右是相对的。', {
        delay: 12,
        duration: 80,
      }),
      trap(
        'release-gate',
        'gate',
        570,
        { x: 750, y: 100, w: 28, h: 254 },
        '最后，请排队等待正式发布。',
        { delay: 0, cycle: { active: 75, rest: 70 } },
      ),
    ],
    { x: 550, y: 220 },
  ),
  room(
    'temperature',
    '参数实验室',
    '温度拉满',
    '多一点随机性，走路更有创造力。',
    [
      trap('hot-ice', 'ice', 0, zone(160, 650), '不是随机，是刹不住。', { delay: 0 }),
      spike('hot-spike', 390, 570, '创造力请绕开这里。'),
    ],
    { x: 640, y: 215 },
  ),
  room(
    'quantized',
    '参数实验室',
    '四比特起跳',
    '精度变低，体验不变。',
    [
      trap('quantize', 'lowJump', 0, zone(0, 1000), '起跳高度也被量化了。', { delay: 0 }),
      pit('quant-gap', 170, 350, '少掉的精度都在这个洞里。'),
      spike('quant-spike', 500, 700, '这里需要刚刚好的额度。'),
    ],
    { x: 605, y: 270 },
  ),
  {
    ...room(
      'scaling',
      '参数实验室',
      '大力出奇迹',
      '算力加倍，效果翻倍。',
      [
        trap('compute', 'bounce', 0, { x: 280, y: 346, w: 80, h: 10 }, '请系好安全带。', {
          delay: 0,
        }),
      ],
      { x: 485, y: 115 },
      [{ ...floor }, { x: 460, y: 190, w: 180, h: 20 }, { x: 770, y: 220, w: 230, h: 20 }],
    ),
    exit: { x: 920, y: 158, w: 64, h: 62 },
  },
  room(
    'system-prompt',
    '参数实验室',
    '隐藏系统提示词',
    '你可以自由选择方向。',
    [
      trap('bias', 'wind', 0, zone(280, 430), '但系统倾向于另一边。', { delay: 0 }),
      trap('bias-gap', 'pit', 320, { x: 480, y: 354, w: 70, h: 86 }, '自由选择，不含地板。'),
    ],
    { x: 510, y: 220 },
  ),
  room(
    'cache-drift',
    '参数实验室',
    '缓存还在跑',
    '已经停止生成。',
    [
      trap('cache-ice', 'ice', 0, zone(160, 280), '上一个请求的惯性还在。', { delay: 0 }),
      trap('cache-fake', 'decoy', 0, { x: 550, y: 292, w: 64, h: 62 }, '这个出口也是缓存。', {
        delay: 0,
      }),
    ],
    { x: 590, y: 205 },
  ),
  room(
    'budget-guard',
    '参数实验室',
    '不要超预算',
    '能不跳就不跳。',
    [
      trap('budget-low', 'lowJump', 0, zone(0, 1000), '本次跳跃额度有限。', { delay: 0 }),
      trap('budget-top', 'spikes', 240, { x: 320, y: 220, w: 60, h: 30 }, '这次跳跃没有必要。', {
        delay: 0,
        triggerOn: 'jump',
      }),
      pit('budget-required', 460, 600, '但必要的跳跃不能省。'),
    ],
    { x: 810, y: 265 },
  ),
  {
    ...room(
      'compute-queue',
      '参数实验室',
      '算力排队',
      '先升舱，再排队。',
      [
        trap('queue-boost', 'bounce', 0, { x: 250, y: 346, w: 80, h: 10 }, '升舱完成。', {
          delay: 0,
        }),
        trap('queue-gate', 'gate', 560, { x: 740, y: 0, w: 28, h: 190 }, '高级算力也要排队。', {
          delay: 0,
          cycle: { active: 90, rest: 70 },
        }),
      ],
      { x: 680, y: 95 },
      [{ ...floor }, { x: 450, y: 190, w: 550, h: 20 }],
    ),
    exit: { x: 920, y: 128, w: 64, h: 62 },
  },
  room(
    'parameter-soup',
    '参数实验室',
    '参数都调好了',
    '这次真的是最终参数。',
    [
      trap('soup-ice', 'ice', 0, zone(140, 230), '第一段：高温采样。', { delay: 0 }),
      trap('soup-wind', 'wind', 390, zone(430, 300), '第二段：系统偏好。', { delay: 0 }),
      spike('soup-spike', 460, 570, '第三段：实机验收。'),
      trap('soup-quota', 'gate', 730, { x: 865, y: 100, w: 28, h: 254 }, '最后还是得等额度。', {
        delay: 0,
        cycle: { active: 70, rest: 65 },
      }),
    ],
    { x: 620, y: 220 },
  ),
  room('tool-failure', '最终评测', '工具调用失败', '外部工具的结果绝对可靠。', [
    pit('tool-gap', 130, 280, '工具一：未返回地板。'),
    trap('tool-quota', 'gate', 420, { x: 600, y: 100, w: 28, h: 254 }, '工具二：429。', {
      delay: 0,
      cycle: { active: 90, rest: 70 },
    }),
    trap(
      'tool-block',
      'falling',
      650,
      { x: 800, y: 70, w: 80, h: 50 },
      '工具三：结果以实体形式返回。',
      { delay: 12, travel: { x: 0, y: 320, ticks: 30 } },
    ),
  ]),
  {
    ...room(
      'multimodal',
      '最终评测',
      '看图说话',
      '我看见出口了，就在地面上。',
      [
        trap('vision-lift', 'platform', 0, { x: 390, y: 354, w: 150, h: 20 }, '也可能在上面。', {
          delay: 0,
          travel: { x: 0, y: -135, ticks: 100, loop: true },
        }),
        trap(
          'vision-fake',
          'decoy',
          0,
          { x: 800, y: 292, w: 64, h: 62 },
          '图像识别结果仅供参考。',
          { delay: 0 },
        ),
      ],
      { x: 485, y: 115 },
      [{ ...floor }, { x: 610, y: 215, w: 390, h: 22 }],
    ),
    exit: { x: 920, y: 153, w: 64, h: 62 },
  },
  room('agent-loop', '最终评测', '自主规划中', '我会自己找到最优路径。', [
    trap('agent-door', 'exit', 780, { x: 920, y: 292, w: 64, h: 62 }, '最优路径：回到出发点。', {
      delay: 8,
      travel: { x: -750, y: 0, ticks: 24 },
    }),
    trap('agent-gap', 'pit', 700, { x: 610, y: 354, w: 100, h: 86 }, '上一轮规划没有保存地面。', {
      delay: 8,
      after: 'agent-door',
      triggerOn: 'left',
    }),
    trap('agent-quota', 'gate', 650, { x: 450, y: 100, w: 28, h: 254 }, '重新规划消耗一次额度。', {
      delay: 0,
      after: 'agent-door',
      triggerOn: 'left',
      cycle: { active: 80, rest: 70 },
    }),
  ]),
  room(
    'batch-review',
    '最终评测',
    '批量验收',
    '这批结果都已经验收过了。',
    [
      trap(
        'review-shuttle',
        'platform',
        0,
        { x: 240, y: 354, w: 145, h: 20 },
        '请随本批请求一起前进。',
        { delay: 0, travel: { x: 400, y: 0, ticks: 160, loop: true } },
      ),
      trap(
        'review-fake',
        'decoy',
        0,
        { x: 800, y: 292, w: 64, h: 62 },
        '验收通过不代表出口是真的。',
        { delay: 0 },
      ),
    ],
    { x: 550, y: 230 },
    [
      { x: 0, y: 354, w: 260, h: 86 },
      { x: 730, y: 354, w: 270, h: 86 },
    ],
  ),
  room(
    'ceiling-review',
    '最终评测',
    '突破能力上限',
    '没有什么能阻挡向上发展。',
    [
      trap('review-gravity', 'gravity', 175, zone(0, 1000), '继续向上。', {
        delay: 12,
        duration: 155,
      }),
      trap('review-top', 'spikes', 340, { x: 500, y: 89, w: 60, h: 30 }, '除了天花板上的评测。', {
        delay: 10,
      }),
      trap(
        'review-ground',
        'decoy',
        0,
        { x: 800, y: 292, w: 64, h: 62 },
        '落地后也不要急着相信。',
        { delay: 0 },
      ),
    ],
    { x: 530, y: 215 },
    [
      { x: 0, y: 354, w: 300, h: 86 },
      { x: 730, y: 354, w: 270, h: 86 },
      { x: 100, y: 65, w: 780, h: 24 },
    ],
  ),
  room(
    'trial-budget',
    '最终评测',
    '限时低配体验',
    '免费版与完整版一样好用。',
    [
      trap('trial-low', 'lowJump', 0, zone(0, 1000), '只是跳得低一点。', { delay: 0 }),
      trap(
        'trial-floor',
        'platform',
        220,
        { x: 290, y: 354, w: 370, h: 20 },
        '地板也只是少用几秒。',
        { delay: 0, duration: 85 },
      ),
    ],
    { x: 610, y: 270 },
    [
      { x: 0, y: 354, w: 300, h: 86 },
      { x: 650, y: 354, w: 350, h: 86 },
    ],
  ),
  room(
    'safety-review',
    '最终评测',
    '已通过安全评测',
    '所有参数都在安全范围内。',
    [
      trap('safe-ice', 'ice', 0, zone(140, 240), '惯性也属于参数。', { delay: 0 }),
      trap('safe-quota', 'gate', 0, { x: 460, y: 100, w: 28, h: 254 }, '请在红线前刹车。', {
        delay: 0,
        cycle: { active: 85, rest: 75 },
      }),
      trap('safe-low', 'lowJump', 550, zone(600, 400), '最后减少一点跳跃额度。', { delay: 0 }),
      pit('safe-gap', 600, 750, '额度少了，地洞没少。'),
    ],
    { x: 610, y: 260 },
  ),
  room(
    'final-answer',
    '最终评测',
    '这次真的生成完了',
    '最后一关，我保证不再追加。',
    [
      trap('final-gap', 'pit', 130, { x: 230, y: 354, w: 100, h: 86 }, '最后补一个地洞。'),
      trap('final-fake', 'decoy', 0, { x: 480, y: 292, w: 64, h: 62 }, '再补一个模拟出口。', {
        delay: 0,
      }),
      spike('final-spike', 530, 650, '还有一个很小的尖刺。'),
      trap('final-quota', 'gate', 690, { x: 850, y: 100, w: 28, h: 254 }, '好吧，最后等一次。', {
        delay: 0,
        cycle: { active: 85, rest: 75 },
      }),
    ],
    { x: 500, y: 200 },
  ),
  room(
    'moving-requirement',
    '特殊协议',
    '需求还在移动',
    '需求范围已经冻结。',
    [
      trap(
        'requirement-wall',
        'wall',
        0,
        { x: 500, y: 174, w: 40, h: 180 },
        '冻结的是版本号，不是需求。',
        { delay: 0, travel: { x: -80, y: 0, ticks: 120, loop: true } },
      ),
    ],
    { x: 650, y: 220 },
    [{ ...floor }, { x: 220, y: 280, w: 160, h: 20 }],
  ),
  room(
    'recursive-jump',
    '特殊协议',
    '递归调用自己',
    '一次起跳不够，就再调用一次。',
    [
      trap('recursion', 'airJump', 0, zone(0, 1000), '空中也能继续调用。别超过上下文边界。', {
        delay: 0,
      }),
    ],
    { x: 540, y: 150 },
    [
      { x: 0, y: 354, w: 240, h: 86 },
      { x: 820, y: 354, w: 180, h: 86 },
      { x: 0, y: 40, w: 1000, h: 24 },
    ],
  ),
  room(
    'token-thruster',
    '特殊协议',
    '燃烧 Token',
    '算力就是推力。',
    [trap('thruster', 'jetpack', 0, zone(0, 1000), 'Token 有限，落地后重新补充。', { delay: 0 })],
    { x: 800, y: 220 },
    [
      { x: 0, y: 354, w: 230, h: 86 },
      { x: 720, y: 354, w: 280, h: 86 },
      { x: 0, y: 40, w: 1000, h: 24 },
    ],
  ),
  {
    ...room(
      'poisoned-token',
      '异常样本',
      '这条引用有毒',
      '这个灵感百分之百安全。',
      [
        {
          id: 'poison',
          effect: 'mine',
          body: { x: 310, y: 308, w: 24, h: 24 },
          trigger: { x: 310, y: 308, w: 24, h: 24 },
          delay: 20,
          duration: 12,
          line: '引用已失效，正在爆炸。',
        },
        pit('poison-gap', 390, 520, '真正的灵感在前面。'),
      ],
      { x: 620, y: 215 },
    ),
    secretTravel: { x: 0, y: -12, ticks: 45, loop: true },
    secretGrowth: 8,
  },
  {
    ...room(
      'followup-missile',
      '异常样本',
      '它还在追问',
      '这次没有更多问题了。',
      [
        trap(
          'followup',
          'seeker',
          250,
          { x: 780, y: 290, w: 24, h: 24 },
          '你不说清楚，我就继续追问。',
          { delay: 30, duration: 240 },
        ),
      ],
      { x: 640, y: 220 },
    ),
    secretTravel: { x: -20, y: 0, ticks: 60, loop: true },
  },
  {
    ...room(
      'one-more-thing',
      '连续评测',
      '最后还差亿点点',
      '这一回，真的只剩最后一点。',
      [
        pit('long-gap', 160, 300, '先补一个引用缺口。'),
        spike('long-spike', 460, 600, '再自动补全一点风险。'),
        trap(
          'long-gate',
          'gate',
          730,
          { x: 930, y: 100, w: 26, h: 254 },
          '前半段已完成，请等待下一批额度。',
          { delay: 0, cycle: { active: 90, rest: 80 } },
        ),
        trap(
          'long-thought',
          'falling',
          1030,
          { x: 1200, y: 70, w: 80, h: 50 },
          '还有一段思维链。',
          { delay: 18, travel: { x: 0, y: 320, ticks: 30 } },
        ),
        trap('long-saw', 'saw', 1280, { x: 1460, y: 310, w: 44, h: 44 }, '中间结果正在切片。', {
          delay: 0,
          travel: { x: 90, y: 0, ticks: 80, loop: true },
        }),
        trap('long-fake', 'decoy', 1600, { x: 1820, y: 292, w: 64, h: 62 }, '这个只是预览出口。', {
          delay: 0,
        }),
        pit('long-last', 1940, 2070, '最后一次更正：地板少了一段。'),
      ],
      { x: 1838, y: 200 },
      [{ x: 0, y: 354, w: 2500, h: 86 }],
    ),
    width: 2500,
    exit: { x: 2410, y: 292, w: 64, h: 62 },
  },
  {
    ...room(
      'world-one-review',
      '世界评测',
      '幻觉世界：重新核实',
      '所有引用都重新核实过了。',
      [
        pit('w1-gap-a', 150, 290, '第一条引用，查无此桥。'),
        spike('w1-complete', 460, 590, '空白部分已自动补全。'),
        trap('w1-thought', 'falling', 790, { x: 950, y: 70, w: 80, h: 50 }, '核实报告正在落地。', {
          delay: 18,
          travel: { x: 0, y: 320, ticks: 30 },
        }),
        trap('w1-reverse', 'reverse', 1120, zone(1120, 370), '结论完全相反。', {
          delay: 20,
          duration: 100,
        }),
        pit('w1-gap-b', 1340, 1460, '撤回的还有这一段地面。'),
        trap('w1-gate', 'gate', 1670, { x: 1880, y: 100, w: 26, h: 254 }, '请等待核实额度恢复。', {
          delay: 0,
          cycle: { active: 85, rest: 75 },
        }),
      ],
      { x: 1510, y: 220 },
      [{ x: 0, y: 354, w: 2300, h: 86 }],
    ),
    width: 2300,
    exit: { x: 2210, y: 292, w: 64, h: 62 },
  },
  {
    ...room(
      'world-two-review',
      '世界评测',
      '参数世界：实机复测',
      '这次参数绝对没有副作用。',
      [
        trap('w2-ice', 'ice', 0, zone(140, 280), '升温以后，刹车也有延迟。', { delay: 0 }),
        trap('w2-fake', 'decoy', 300, { x: 560, y: 292, w: 64, h: 62 }, '看见的结果可能是缓存。', {
          delay: 0,
        }),
        trap('w2-gate', 'gate', 750, { x: 940, y: 100, w: 26, h: 254 }, '请在配额恢复后继续。', {
          delay: 0,
          cycle: { active: 90, rest: 80 },
        }),
        trap('w2-low', 'lowJump', 1080, zone(1120, 550), '本段启用低比特起跳。', { delay: 0 }),
        pit('w2-gap', 1180, 1350, '精度压缩没有压缩地洞。'),
        spike('w2-spike', 1470, 1640, '最后保留了一点尖锐意见。'),
        trap(
          'w2-thought',
          'falling',
          1860,
          { x: 2020, y: 70, w: 80, h: 50 },
          '还有一份最终报告。',
          { delay: 18, travel: { x: 0, y: 320, ticks: 30 } },
        ),
      ],
      { x: 1530, y: 270 },
      [{ x: 0, y: 354, w: 2500, h: 86 }],
    ),
    width: 2500,
    exit: { x: 2410, y: 292, w: 64, h: 62 },
  },
  room(
    'ephemeral-answer',
    '落点预测',
    '一次性回答',
    '这块平台只缓存一次。',
    [
      {
        id: 'eviction',
        effect: 'pit',
        body: { x: 330, y: 300, w: 180, h: 20 },
        trigger: { x: 330, y: 248, w: 180, h: 54 },
        triggerOn: 'land',
        delay: 18,
        duration: 150,
        rearm: true,
        line: '检测到已读，缓存即将释放。',
      },
    ],
    { x: 550, y: 145 },
    [
      { x: 0, y: 354, w: 260, h: 86 },
      { x: 330, y: 300, w: 180, h: 20 },
      { x: 650, y: 354, w: 350, h: 86 },
    ],
  ),
  room(
    'landing-prediction',
    '落点预测',
    '预测你的下一个落点',
    '我已经知道你会落在哪里。',
    [
      {
        id: 'prediction',
        effect: 'spikes',
        body: { x: 470, y: 324, w: 60, h: 30 },
        trigger: { x: 280, y: 0, w: 110, h: 440 },
        triggerOn: 'jump',
        initiallyActive: true,
        delay: 0,
        travel: { x: 120, y: 0, ticks: 24 },
        line: '已提前为你的落点补全尖刺。',
      },
    ],
    { x: 615, y: 210 },
  ),
  room(
    'landing-invoice',
    '落点预测',
    '落地就开始计费',
    '先用起来，不会有额外费用。',
    [
      {
        id: 'invoice',
        effect: 'falling',
        body: { x: 600, y: 70, w: 80, h: 50 },
        trigger: { x: 300, y: 228, w: 140, h: 54 },
        triggerOn: 'land',
        delay: 18,
        travel: { x: 0, y: 320, ticks: 30 },
        line: '落地成功，账单正在送达。',
      },
      spike('invoice-spike', 740, 850, '账单后面还有服务费。'),
    ],
    { x: 715, y: 220 },
    [{ ...floor }, { x: 300, y: 280, w: 140, h: 20 }],
  ),
  room(
    'two-contexts',
    '落点预测',
    '只保留最近一轮',
    '前面的上下文已经足够了。',
    [
      {
        id: 'context-a',
        effect: 'pit',
        body: { x: 330, y: 300, w: 150, h: 20 },
        trigger: { x: 330, y: 248, w: 150, h: 54 },
        triggerOn: 'land',
        delay: 18,
        duration: 160,
        rearm: true,
        line: '第一轮内容即将删除。',
      },
      {
        id: 'context-b',
        effect: 'pit',
        body: { x: 600, y: 260, w: 150, h: 20 },
        trigger: { x: 600, y: 208, w: 150, h: 54 },
        triggerOn: 'land',
        delay: 18,
        duration: 160,
        rearm: true,
        line: '最近一轮也不是永久保存。',
      },
    ],
    { x: 770, y: 90 },
    [
      { x: 0, y: 354, w: 260, h: 86 },
      { x: 330, y: 300, w: 150, h: 20 },
      { x: 600, y: 260, w: 150, h: 20 },
      { x: 860, y: 354, w: 140, h: 86 },
    ],
  ),
  room(
    'adaptive-trap',
    '落点预测',
    '实时优化体验',
    '每一次落地都能让我变得更聪明。',
    [
      {
        id: 'adaptive-floor',
        effect: 'pit',
        body: { x: 330, y: 300, w: 180, h: 20 },
        trigger: { x: 330, y: 248, w: 180, h: 54 },
        triggerOn: 'land',
        delay: 18,
        duration: 160,
        rearm: true,
        line: '训练样本已收到，释放当前平台。',
      },
      {
        id: 'adaptive-spike',
        effect: 'spikes',
        body: { x: 730, y: 324, w: 60, h: 30 },
        trigger: { x: 330, y: 248, w: 180, h: 54 },
        triggerOn: 'land',
        initiallyActive: true,
        delay: 0,
        travel: { x: 130, y: 0, ticks: 28 },
        line: '下一次落点也已经安排好了。',
      },
    ],
    { x: 900, y: 210 },
    [
      { x: 0, y: 354, w: 260, h: 86 },
      { x: 330, y: 300, w: 180, h: 20 },
      { x: 650, y: 354, w: 350, h: 86 },
    ],
  ),
];

export function validateCampaign(rooms: readonly Room[]): void {
  const ids = new Set<string>();
  for (const entry of rooms) {
    if (
      entry.width !== undefined &&
      (!Number.isFinite(entry.width) || entry.width < 1000 || entry.width > 5000)
    )
      throw new Error(`Invalid world width: ${entry.id}`);
    if (ids.has(entry.id)) throw new Error(`Duplicate room: ${entry.id}`);
    ids.add(entry.id);
    createTrapScene(entry.traps);
    for (const rect of [entry.exit, ...entry.floors, ...entry.traps.map((item) => item.body)]) {
      if (![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0)
        throw new Error(`Invalid geometry: ${entry.id}`);
    }
    if (
      [entry.spawn, ...(entry.cloneSpawns ?? [])].some(
        (spawn) =>
          !entry.floors.some(
            (solid) =>
              spawn.x >= solid.x && spawn.x + 32 <= solid.x + solid.w && spawn.y + 48 === solid.y,
          ),
      )
    )
      throw new Error(`Unsupported spawn: ${entry.id}`);
  }
}
