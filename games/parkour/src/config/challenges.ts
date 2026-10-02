import type { Adventure } from '../rules/adventure';
import { levelFor, type LevelId } from './shift';

export interface RunChallenge {
  id: string;
  label: string;
  hint: string;
  current: number;
  target: number;
  failed: boolean;
  earned: boolean;
}

export function challengesFor(state: Adventure): RunChallenge[] {
  if (state.levelId === 3) return [];
  const level = levelFor(state.levelId);
  const delivered =
    state.run.status === 'ended' &&
    state.run.result?.reason === 'distance-limit' &&
    state.hasAnswer;
  const make = (
    id: string,
    label: string,
    hint: string,
    current: number,
    target: number,
    failed = false,
  ): RunChallenge => ({
    id,
    label,
    hint,
    current,
    target,
    failed,
    earned: delivered && !failed && current >= target,
  });
  const specialty =
    state.levelId === 0
      ? make(
          'rice',
          '这饭非吃不可',
          '带着全部白饭完成交付',
          state.rice,
          level.obstacles.filter(([, kind]) => kind === 'ground').length,
        )
      : state.levelId === 1
        ? make(
            'returns',
            '停止补充！',
            '让每个补充喷口都收到退件，再完成交付',
            state.returns,
            level.printers.length,
          )
        : make(
            'verify',
            '查无此饭',
            '清除全部问号饭，不误吃，完成交付',
            state.verified,
            level.hallucinations.length,
            state.hallucinationHits > 0,
          );
  return [
    make('delivery', '说到做到', '把答案送到灯塔', state.hasAnswer ? 1 : 0, 1),
    specialty,
    make(
      'clean',
      '本鱼零失误',
      '不受伤、不消耗护盾、不误吃假饭，完成交付',
      1,
      1,
      state.hits > 0 || state.shieldsUsed > 0 || state.hallucinationHits > 0,
    ),
  ];
}

export const challengeStorageKey = (level: LevelId) => `moecore:parkour:badges:v1:${level}`;
export function mergeBadges(saved: unknown, challenges: readonly RunChallenge[]): string[] {
  const allowed = challenges.map((challenge) => challenge.id);
  const previous = Array.isArray(saved)
    ? saved.filter((id): id is string => typeof id === 'string' && allowed.includes(id))
    : [];
  return [
    ...new Set([
      ...previous,
      ...challenges.filter((challenge) => challenge.earned).map((challenge) => challenge.id),
    ]),
  ];
}
