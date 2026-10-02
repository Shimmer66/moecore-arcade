import { createBattle } from './rules';
import { IDS } from './moves';
import type { Battle, Difficulty, FighterId, UpgradeId } from './types';

export { DIFFICULTIES } from './moves';
export const UPGRADES = {
  battery: {
    name: '开打前扒两口',
    text: '下一场多带 25 能量。先垫两口，拳头才有劲。',
    icon: '＋25',
  },
  cooling: {
    name: '少废话，多出拳',
    text: '技能和变招的等待时间缩短 20%。嘴还没停，拳又好了。',
    icon: '−20%',
  },
  lightfoot: {
    name: '食堂百米冠军',
    text: '走路和空中移动快 12%。冲刺不变，抢饭更快。',
    icon: '＋12%',
  },
} as const;
export const STATION_NAMES = ['第一场：谁动我饭？', '第二场：都说自己包赢', '最后一场：自己人也揍'];
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
    opponents: [
      ...IDS.filter((id) => id !== player)
        .sort((a, b) => {
          const rank = (id: FighterId) =>
            Math.imul((seed >>> 0) ^ (IDS.indexOf(id) + 1), 1664525) >>> 0;
          return rank(a) - rank(b);
        })
        .slice(0, 2),
      player,
    ],
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
