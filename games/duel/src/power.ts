import type { Fighter, FighterId } from './types';
export const ENERGY_CAP = 500;
export const MAX_COST = 200;
export const MAX_DURATION = 600;
export const QUICK_MAX_DURATION = 300;
export const EX_COST = 50;
export const EX_MAX_COST = 120;
export const MAX_SUPER_COST = 240;
export const EX_STYLE: Record<FighterId, { name: string; tip: string }> = {
  deepseek: { name: '这题我会了', tip: '反击窗口延长，成功后强化反击把人挑空。' },
  gpt: { name: '首先其次再补一拳', tip: '突进三连，末段留人，可接后续取消。' },
  doubao: { name: '一个包不够就两个', tip: '先后打出两颗气泡，各65伤害，都能被反弹。' },
  client: {
    name: '需求硬塞',
    tip: '巨拳压近，起手能硬扛一次普通打击，伤害减半。大招和投技能破解。',
  },
  prompt_sage: { name: '多写一条保险', tip: '打出强化飞符，同时在前面留下减速符阵。' },
  unplug_uncle: { name: '只断你的网', tip: '拉人并让对手断网1.5秒，大爷自己照常放招。' },
};
export function canEX(f: Fighter): boolean {
  return f.maxFrames > 0 ? f.maxFrames >= EX_MAX_COST : f.energy >= EX_COST;
}
export function payEX(f: Fighter): void {
  if (f.maxFrames > 0) f.maxFrames -= EX_MAX_COST;
  else f.energy -= EX_COST;
}
export function canSuper(f: Fighter): boolean {
  return f.energy >= 100 || f.maxFrames >= MAX_SUPER_COST;
}
export function paySuper(f: Fighter): void {
  if (f.maxFrames >= MAX_SUPER_COST) f.maxFrames -= MAX_SUPER_COST;
  else f.energy -= 100;
}
