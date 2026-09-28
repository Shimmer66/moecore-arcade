import { createBattle } from './rules';
import { IDS } from './moves';
import type { Battle, Difficulty, FighterId, UpgradeId } from './types';

export { DIFFICULTIES } from './moves';
export const UPGRADES = {
  battery: {
    name: '续杯 Token',
    text: '下一站起始能量 +25。提前获得变招和脱身选择。',
    icon: '＋25',
  },
  cooling: { name: '水冷大脑', text: '技与变招的冷却缩短 20%。能量消耗不变。', icon: '−20%' },
  lightfoot: {
    name: '轻量部署',
    text: '地面步行与空中移动速度 +12%。冲刺和攻击速度不变。',
    icon: '＋12%',
  },
} as const;
export const STATION_NAMES = ['热身：先别急着包', '进阶：这把动真格', '决赛：自己的缓存分身'];
export interface Campaign {
  player: FighterId;
  opponents: FighterId[];
  difficulty: Difficulty;
  seed: number;
  stage: number;
  perks: UpgradeId[];
  wins: number;
  elapsed: number;
  damage: number;
  maxCombo: number;
  phase: 'fighting' | 'upgrade' | 'complete' | 'lost';
}
export function createCampaign(player: FighterId, difficulty: Difficulty, seed: number): Campaign {
  return {
    player,
    difficulty,
    seed,
    opponents: [...IDS.filter((id) => id !== player), player],
    stage: 0,
    perks: [],
    wins: 0,
    elapsed: 0,
    damage: 0,
    maxCombo: 0,
    phase: 'fighting',
  };
}
export function campaignBattle(c: Campaign): Battle {
  return createBattle(c.player, c.opponents[c.stage]!, c.seed + c.stage, {
    difficulty: c.difficulty,
    roundLimit: 1,
    roundSeconds: 60,
    playerPerks: [...c.perks],
    enemyStartingEnergy: c.stage === 2 ? 25 : 0,
  });
}
export function settleStage(c: Campaign, b: Battle): void {
  if (
    c.phase !== 'fighting' ||
    b.phase !== 'done' ||
    b.fighters[0].id !== c.player ||
    b.fighters[1].id !== c.opponents[c.stage]
  )
    return;
  c.elapsed += b.elapsed;
  c.damage += b.fighters[0].damage;
  c.maxCombo = Math.max(c.maxCombo, b.fighters[0].maxCombo);
  if (b.outcome !== 'win') {
    c.phase = 'lost';
    return;
  }
  c.wins++;
  c.phase = c.stage === 2 ? 'complete' : 'upgrade';
}
export function takeUpgrade(c: Campaign, id: UpgradeId): boolean {
  if (c.phase !== 'upgrade' || c.perks.includes(id)) return false;
  c.perks.push(id);
  c.stage++;
  c.phase = 'fighting';
  return true;
}
