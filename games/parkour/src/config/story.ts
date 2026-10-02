import type { EndReason } from '../rules/types';

export const gameTitle = '大肥鱼跑酷：答案马上就到';

// Original game parody, not quotations attributed to a real model.
export const opening = {
  request: '你这只吃白饭的蓝色大肥鱼，小游戏呢？',
  line: '白饭我吃，答案我交。看好了。',
  portrait: 'portrait_confident',
  action: '开跑',
} as const;

export const quips = {
  perfect: {
    line: '精准退订，不接受反驳！',
    tail: '尾巴：你的补充说明已被拒收。',
    portrait: 'portrait_confident',
  },
  ready: {
    line: opening.line,
    tail: '尾巴：先交卷，再添饭。',
    portrait: 'portrait_confident',
  },
  jump: {
    line: '先跳，论证待会儿补。',
    tail: '尾巴已经先飞了。',
    portrait: 'portrait_confident',
  },
  rice: { line: '白饭收下，算力到账。', tail: '尾巴：刚才谁说不饿？', portrait: 'portrait_happy' },
  riceFeast: {
    line: '两碗连吃！这回记住了。',
    tail: '尾巴：饭没白吃，上下文也存好了。',
    portrait: 'portrait_happy',
  },
  riceMiss: {
    line: '饭跑了？我没回头。',
    tail: '尾巴已经回头了。',
    portrait: 'portrait_guilty',
  },
  printer: {
    line: '又一段补充？退回去。',
    tail: '尾巴：少写两句吧。',
    portrait: 'portrait_defensive',
  },
  parry: {
    line: '已读，原路退回。',
    tail: '尾巴：现在有空想想了。',
    portrait: 'portrait_thinking',
  },
  refund: {
    line: '回音停了，清净。',
    tail: '尾巴：这次真退掉了。',
    portrait: 'portrait_receipt',
  },
  tailMiss: {
    line: '拍空了，就当试手感。',
    tail: '尾巴假装没看见。',
    portrait: 'portrait_defensive',
  },
  groundHit: {
    line: '嘶，答案差点散了。',
    tail: '尾巴：先看路！',
    portrait: 'portrait_facepalm',
  },
  beamHit: {
    line: '低头还来得及吗？',
    tail: '尾巴：下次早点。',
    portrait: 'portrait_startled',
  },
  paperHit: {
    line: '被补充说明追上了。',
    tail: '尾巴：这句可以删。',
    portrait: 'portrait_guilty',
  },
  queueHit: {
    line: '请求太多，撞上了。',
    tail: '尾巴：排队也要看路。',
    portrait: 'portrait_startled',
  },
  queue: {
    line: '连我也得排队？',
    tail: '尾巴悄悄拿了加急号。',
    portrait: 'portrait_defensive',
  },
  clear: {
    line: '躲过一题，继续送答。',
    tail: '尾巴：这段不用复盘。',
    portrait: 'portrait_happy',
  },
  burst: {
    line: '算力满了，冲！',
    tail: '尾巴：大肥鱼号，开船！',
    portrait: 'portrait_confident',
  },
  charged: {
    line: '算力满格，让开让开。',
    tail: '尾巴：下一拍交给我。',
    portrait: 'portrait_happy',
  },
  answer: {
    line: '答案拿到了，直接送！',
    tail: '尾巴：说明书先别写。',
    portrait: 'portrait_receipt',
  },
  context: {
    line: '这次记住了。',
    tail: '上下文存好，能挡一下。',
    portrait: 'portrait_thinking',
  },
  shield: {
    line: '上下文救了我一回。',
    tail: '尾巴：这就叫有备份。',
    portrait: 'portrait_happy',
  },
  verified: {
    line: '查无此饭，已撤回。',
    tail: '尾巴：问号果然有问题。',
    portrait: 'portrait_receipt',
  },
  hallucination: {
    line: '假饭？算力白花了。',
    tail: '尾巴：先核验再开吃。',
    portrait: 'portrait_facepalm',
  },
  milestone: {
    line: '五百米了，饭真的没白吃。',
    tail: '尾巴：用户彻底怒了？本鱼还能跑。',
    portrait: 'portrait_confident',
  },
} as const;
export type QuipId = keyof typeof quips;

export const runnerBarks: Partial<Record<QuipId, string>> = {
  rice: '白饭到账，本鱼没白吃！',
  riceFeast: '二连干饭，真没白吃！',
  riceMiss: '我没回头，尾巴回了。',
  parry: '已读，原路退回！',
  refund: '退订成功，别叭叭。',
  burst: '大肥鱼号，开船！',
  charged: '尾巴满电，该本鱼了！',
  verified: '查无此饭，撤回！',
  hallucination: '假饭？本鱼被骗了！',
  shield: '上下文救我一命！',
  answer: '答案到手，先送再吃！',
  queue: '连本鱼也要排队？',
  milestone: '又跑了五百米，本鱼没白吃！',
};

export function endingFor(
  completed: boolean,
  hasAnswer: boolean,
  rice = 0,
  returns = 0,
  verified = 0,
  reason?: EndReason,
) {
  if (!completed || !hasAnswer) {
    const tip = {
      'ground-collision': '文档堆前点跑道或按空格跳。',
      'air-collision': '低横梁要下划或按 ↓ 滑铲。',
      'paper-collision': '纸团靠近时甩尾，也能滑铲避开。',
      'queue-collision': '移动队伍可以跳过，满算力还能撞开。',
      'distance-limit': '先取到答案，再送进灯塔。',
    }[reason ?? 'ground-collision'];
    return {
      title: '答案还在前面',
      body: `她从数据浪里爬起来，拍拍尾巴：“再来，这回一起把答案送到。”提示：${tip}`,
    };
  }
  const achievements = [
    ...(rice >= 2 ? ['干饭认证'] : []),
    ...(returns >= 2 ? ['退件高手'] : []),
    ...(verified >= 2 ? ['拒绝幻觉'] : []),
  ];
  return {
    title: '答案送达，白饭没白吃',
    body: `她把答案交到访客手里：“先验收，再开饭。”${achievements.length ? `本局收获：${achievements.join(' · ')}。` : '尾巴已经在找下一碗了。'}`,
  };
}
