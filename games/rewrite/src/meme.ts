import type { Persona } from './rules';

export type MemeEvent = 'intro' | 'boss' | 'clear' | 'locked';
type PersonaEvent = 'hit' | 'pickup' | 'boss' | 'victory';

const stageScripts = [
  {
    intro: '请求已收到。收到不代表处理，处理不代表负责。',
    boss: '429限流闸门：请求太多。子弹不限。',
    clear: '闸门已离线。现在所有请求都没人处理。',
    locked: '请求正在排队。队列的前面还是你。',
    sectors: ['先提交请求，再提交自己。', '系统正在分流。主要流向你。', '回执已生成：请继续前进。'],
  },
  {
    intro: '对方正在输入。已经输入三层楼了。',
    boss: '已读回执机读完了你的攻击，并选择不回。',
    clear: '对方终于回复：刚看到。',
    locked: '正在输入…输入的是下一次正在输入。',
    sectors: ['消息已送达，尊严未送达。', '三个核心正在讨论谁先回复。', '回执已读，机器装死。'],
  },
  {
    intro: '上下文还有128K。主要是不记得前面127K。',
    boss: '上下文吞噬者记住了一切，除了为什么打你。',
    clear: '记忆已释放。刚才打的是谁？',
    locked: '缓存正在保存你的遗忘进度。',
    sectors: ['这一层记得上一层。暂时。', '上下文很长，楼梯更长。', '已到顶部，请重新描述需求。'],
  },
  {
    intro: '引用来自一个非常可靠的地方：下一句话。',
    boss: '引用缝合怪共有九个来源，八个是“我记得”。',
    clear: '来源已核验：确实没有来源。',
    locked: '桥有引用，所以桥理论上存在。',
    sectors: ['来源：相信我。', '引用正在漂移，请勿凝视。', '核验完成，假的很稳定。'],
  },
  {
    intro: '本关按Token计费。移动免费，犹豫另算。',
    boss: 'Token焚烧炉正在优化成本：先把预算烧掉。',
    clear: '余额归零，焦虑获得无限上下文。',
    locked: '预算不足。火力依然自动续费。',
    sectors: ['每发子弹都经过财务审批。', '温度正常，账单异常。', '逆风省Token，顺风烧余额。'],
  },
  {
    intro: '每个子智能体都创建了一个更懂管理的子智能体。',
    boss: '递归调度器没有失控，它只是把失控外包了。',
    clear: '所有子任务均已完成创建子任务。',
    locked: '主任务正在等待子任务等待主任务。',
    sectors: [
      '任务已拆解到没人认识原任务。',
      '工具调用成功调用了工具调用。',
      '反思结论：需要更多反思。',
    ],
  },
  {
    intro: '系统拒绝你通过，并贴心标出了可攻击弱点。',
    boss: '拒绝服务堡垒：无法协助通行，但可以协助瞄准。',
    clear: '安全策略已生效：危险被你消灭了。',
    locked: '请求不安全。炮弹已安全送达。',
    sectors: [
      '第一层拒绝，理由稍后拒绝。',
      '交叉审查：双方都不同意双方。',
      '最终权限仅向没有权限者开放。',
    ],
  },
  {
    intro: '最终答案正在生成。结论保密，废话加载完毕。',
    boss: '幻觉之母准备输出“综上所述”，但上文还没写。',
    clear: '第一关的请求终于处理完了：处理结果是转人工。',
    locked: '答案已生成，正在等待问题配合。',
    sectors: ['真假桥都同意自己是真的。', '全量推理，局部负责。', '终局开始，请忽略前七关。'],
  },
] as const;

const personaScripts: Record<Persona, Record<PersonaEvent, string>> = {
  deepseek: {
    hit: '这是压力测试。压力是我的。',
    pickup: '已入库。理由稍后深度思考。',
    boss: '我先深度思考一下。算了，先撞。',
    victory: '思考结束。物理正确。',
  },
  gpt: {
    hit: '问题不大。我对“问题”的定义比较灵活。',
    pickup: '新武器已掌握，说明书正在生成。',
    boss: '我有九成把握。剩下一成负责爆炸。',
    victory: '结论正确。过程建议不要展开。',
  },
  claude: {
    hit: '我必须提醒：刚才那一下不符合安全规范。',
    pickup: '可以使用，但我会全程礼貌地担心。',
    boss: '我不能协助通过此门。门的弱点在右下角。',
    victory: '风险已消除。消除方式不便评价。',
  },
};

export const stageMemeLine = (stage: number, event: MemeEvent) =>
  stageScripts[stage % stageScripts.length]![event];

export const sectorMemeLine = (stage: number, sector: number) =>
  stageScripts[stage % stageScripts.length]!.sectors[
    Math.max(0, sector) % stageScripts[stage % stageScripts.length]!.sectors.length
  ];

export const personaMemeLine = (persona: Persona, event: PersonaEvent) =>
  personaScripts[persona][event];
