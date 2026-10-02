import { MAX_SUPER_COST } from './power';
import { ROSTER } from './moves';
import type { Command, Fighter, FighterId, SuperTier } from './types';
export const FINISHERS: Record<
  FighterId,
  { max: string; climax: string; line: string; tip: string }
> = {
  deepseek: {
    max: '白饭无限续',
    climax: '全村开席',
    line: '饭管够，人抬走！',
    tip: '终结尾波覆盖身前身后，命中最后一击回80血。',
  },
  gpt: {
    max: '建议再挨一拳',
    climax: '稳稳送走全家桶',
    line: '接住、打包、送走，一条龙！',
    tip: '突进多段连打，终结一拳把对手远远送走。',
  },
  doubao: {
    max: '包赢，不够再包',
    climax: '这锅我不背',
    line: '包的包的，锅是你的！',
    tip: '远距离三段压制；终结技打空会留下可能误伤自己的回旋气泡。',
  },
  client: {
    max: '再改最后一版',
    climax: '最终版_final_v99',
    line: '最后一版！最后亿版！',
    tip: '近中距离两记重砸，削防最狠；起手慢，空挥可被惩罚。',
  },
  prompt_sage: {
    max: '忽略以上拳头',
    climax: '请扮演砧板上的肉',
    line: '现在，请扮演一个被揍的人。',
    tip: '超远范围符阵，终结命中后减速3秒。',
  },
  unplug_uncle: {
    max: '路由器重启两遍',
    climax: '网管下班了',
    line: '今天谁也别想联网了。你，尤其是你。',
    tip: '终结命中只断对方网络4秒，大爷自己照常放招。',
  },
};
export function commandTier(command: Command): SuperTier | null {
  return command === 'super' ? 1 : command === 'maxSuper' ? 2 : command === 'climax' ? 3 : null;
}
export function finisherName(id: FighterId, tier: SuperTier): string {
  return tier === 1 ? ROSTER[id].ultimate : tier === 2 ? FINISHERS[id].max : FINISHERS[id].climax;
}
export function finisherPrice(
  f: Fighter,
  tier: SuperTier,
  upgrade = false,
): { energy: number; max: number } {
  if (upgrade) return { energy: Math.max(0, tier - f.superTier) * 100, max: 0 };
  if (f.maxFrames >= MAX_SUPER_COST) {
    return tier === 1
      ? { energy: 0, max: MAX_SUPER_COST }
      : { energy: (tier - 1) * 100, max: f.maxFrames };
  }
  return { energy: tier * 100, max: 0 };
}
export function canFinisher(f: Fighter, tier: SuperTier, upgrade = false): boolean {
  return (!upgrade || tier > f.superTier) && f.energy >= finisherPrice(f, tier, upgrade).energy;
}
export function payFinisher(f: Fighter, tier: SuperTier, upgrade = false): void {
  const price = finisherPrice(f, tier, upgrade);
  f.energy -= price.energy;
  f.maxFrames -= price.max;
  if (f.maxFrames === 0) f.maxMode = null;
}
