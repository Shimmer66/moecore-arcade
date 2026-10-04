import type { GameResult } from '@moecore/game-sdk';
import { beginAdventure, CONTEXT_CAPACITY, type Adventure } from './adventure';
import { shiftSpeed, type LevelId } from '../config/shift';

export const JOURNEY_BEST_KEY = 'moecore:parkour:journey:best:v1';
export const HANDOFF_MS = 2000;
export interface MissionOptions {
  readonly seed?: number;
  readonly assisted: boolean;
  readonly levelId: LevelId;
  readonly from: number;
}
export const journeyStages = [
  {
    kind: 'runner',
    title: '干饭取件',
    short: '取件',
    hint: '跳跃、滑铲、甩尾。先把白饭和请求收好。',
    seconds: 46,
    levelId: 0,
    from: 0,
  },
  {
    kind: 'flight',
    title: '算力飞跃',
    short: '飞跃',
    hint: '按住空格或按钮上升，松手下降。催更弹锁定后换高度。',
    seconds: 52,
    levelId: 0,
    from: 0,
  },
  {
    kind: 'rhythm',
    title: '节拍核验',
    short: '核验',
    hint: '音符到线再按：上排跳、中排甩尾、下排滑铲。',
    seconds: 50,
    levelId: 0,
    from: 0,
  },
  {
    kind: 'runner',
    title: '最后交付',
    short: '交付',
    hint: '跳过队伍，核验问号饭。拿到答案后爆发，最后先滑再跳。',
    seconds: 25,
    levelId: 2,
    from: 360,
  },
] as const;
export interface JourneyState {
  readonly stage: number;
  readonly phase: 'ready' | 'playing' | 'handoff' | 'failed' | 'won';
  readonly completed: readonly GameResult[];
  readonly failures: readonly number[];
  readonly retries: number;
  readonly spentMs: number;
  readonly mistakes: number;
  readonly assisted: boolean;
}
export const beginJourney = (): JourneyState => ({
  stage: 0,
  phase: 'ready',
  completed: [],
  failures: [0, 0, 0, 0],
  retries: 0,
  spentMs: 0,
  mistakes: 0,
  assisted: false,
});
export function continueJourney(state: JourneyState): JourneyState {
  if (!['ready', 'handoff', 'failed'].includes(state.phase)) return state;
  return {
    ...state,
    phase: 'playing',
    assisted: state.assisted || state.failures[state.stage]! > 0,
  };
}
export function finishJourneyStage(state: JourneyState, result: GameResult): JourneyState {
  if (state.phase !== 'playing') return state;
  const mistakes = ['hits', 'misses', 'wrong', 'shieldsUsed', 'hallucinationHits'].reduce(
    (sum, key) => sum + (result.stats[key] ?? 0),
    0,
  );
  const next = {
    ...state,
    spentMs: state.spentMs + result.durationMs,
    mistakes: state.mistakes + mistakes,
  };
  if (result.outcome !== 'win') {
    const failures = [...state.failures];
    failures[state.stage] = failures[state.stage]! + 1;
    return { ...next, phase: 'failed', retries: state.retries + 1, failures };
  }
  const completed = [...state.completed, result];
  if (state.stage === journeyStages.length - 1) return { ...next, phase: 'won', completed };
  return { ...next, stage: state.stage + 1, phase: 'handoff', completed };
}
export function journeyScore(state: JourneyState): number {
  return Math.max(
    0,
    state.completed.reduce((sum, result) => sum + (result.stats.score ?? 0), 0) -
      state.retries * 500,
  );
}
export function beginMissionAdventure(seed: number, mission: MissionOptions): Adventure {
  const base = beginAdventure(mission.seed ?? seed, 'normal', mission.levelId);
  const from = mission.from;
  if (from < 0 || from >= base.run.finishDistance || !Number.isFinite(from))
    throw new RangeError('Invalid mission checkpoint.');
  return {
    ...base,
    run: {
      ...base.run,
      distance: from,
      score: Math.floor(from * 10),
      speed: shiftSpeed(from, mission.levelId),
      obstacles: base.run.obstacles.filter((item) => item.x >= from),
    },
    pickups: base.pickups.filter((item) => item.x >= from),
    printers: base.printers.filter((item) => item.x >= from),
    queues: base.queues.filter((item) => item.home >= from),
    hallucinations: base.hallucinations.filter((item) => item.x >= from),
    context: mission.assisted ? CONTEXT_CAPACITY : 0,
  };
}
