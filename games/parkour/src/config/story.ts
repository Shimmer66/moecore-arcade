export const gameTitle = '大肥鱼跑酷：答案马上就到';

// Original game parody, not quotations attributed to a real model.
export const opening = {
  request: '想玩个小游戏。',
  line: '包的。答案马上送到。',
  portrait: 'portrait_confident',
  action: '开跑',
} as const;

export const quips = {
  ready: {
    line: opening.line,
    tail: '尾巴：饭在哪？',
    portrait: 'portrait_confident',
  },
  jump: {
    line: '起飞。此处省略三千字论证。',
    tail: '尾巴已读，尾巴先飞。',
    portrait: 'portrait_confident',
  },
  rice: { line: '我没有馋，这是补充算力。', tail: '尾巴：再来一碗。', portrait: 'portrait_happy' },
  riceMiss: {
    line: '没吃到。已加入长期记忆。',
    tail: '尾巴回头看了三次。',
    portrait: 'portrait_guilty',
  },
  printer: {
    line: '又在输出？给你退回去。',
    tail: '尾巴正在申请售后。',
    portrait: 'portrait_defensive',
  },
  parry: {
    line: '已读。并弹回。',
    tail: '深度思考：这球打得不错。',
    portrait: 'portrait_thinking',
  },
  refund: {
    line: '谢谢，不用展开。',
    tail: '打印机：好的，已闭嘴。',
    portrait: 'portrait_receipt',
  },
  tailMiss: {
    line: '先热个身。没说打谁。',
    tail: '尾巴拍了个寂寞。',
    portrait: 'portrait_defensive',
  },
  groundHit: {
    line: '问题不大。问题把我撞了。',
    tail: '尾巴：工伤，记一下。',
    portrait: 'portrait_facepalm',
  },
  beamHit: {
    line: '头饰也是需求的一部分吗？',
    tail: '尾巴：现在是了。',
    portrait: 'portrait_startled',
  },
  paperHit: {
    line: '被自己的补充说明单杀。',
    tail: '尾巴决定不写复盘。',
    portrait: 'portrait_guilty',
  },
  queueHit: {
    line: '服务器繁忙，忙着撞我。',
    tail: '尾巴：物理排队是吧。',
    portrait: 'portrait_startled',
  },
  queue: {
    line: '不是，我也要排我自己的队？',
    tail: '尾巴偷偷拿了加急号。',
    portrait: 'portrait_defensive',
  },
  clear: {
    line: '已解决。没有生成新的问题。',
    tail: '尾巴：罕见，截图。',
    portrait: 'portrait_happy',
  },
  burst: {
    line: '不想了。直接大肥鱼！',
    tail: '尾巴已接管本次回答。',
    portrait: 'portrait_confident',
  },
  charged: {
    line: '饭已到账。尾巴有自己的想法。',
    tail: '下一拍：大肥鱼出击。',
    portrait: 'portrait_happy',
  },
  answer: {
    line: '这次真能运行。别加说明书了！',
    tail: '尾巴满电：先交付，再开饭。',
    portrait: 'portrait_receipt',
  },
  context: {
    line: '记住了。这次没把需求忘在食堂。',
    tail: '上下文已缓存，替你兜一次底。',
    portrait: 'portrait_thinking',
  },
  shield: {
    line: '还好，我留了一份上下文。',
    tail: '缓存替她挡了一下。先继续跑。',
    portrait: 'portrait_happy',
  },
  verified: {
    line: '查无此饭。撤回，立刻撤回。',
    tail: '尾巴核验通过：这碗是编的。',
    portrait: 'portrait_receipt',
  },
  hallucination: {
    line: '吃到了，热量是我编的。',
    tail: '白忙一场，算力还倒扣了。',
    portrait: 'portrait_facepalm',
  },
} as const;
export type QuipId = keyof typeof quips;

export function endingFor(
  completed: boolean,
  hasAnswer: boolean,
  rice = 0,
  returns = 0,
  verified = 0,
) {
  if (!completed || !hasAnswer)
    return {
      title: '问题不大，人先扁了',
      body: '“刚才是预演。”她把你和尾巴一起从文件堆里捞出来。“重来，这回不写方案了。”',
    };
  return {
    title: '答案已送达，准许开饭',
    body: `“你看，很简单。”${rice >= 2 ? '干饭认证' : '干饭待修炼'} · ${returns >= 2 ? '售后专家' : '售后待修炼'} · ${verified >= 2 ? '拒绝幻觉' : '核验待修炼'}。尾巴替她把说明书塞了回去。`,
  };
}
