export type RhythmAction = 'jump' | 'tail' | 'slide';
export type RhythmJudgement = 'perfect' | 'good' | 'miss' | 'wrong';
export const BEAT_MS = 500;
export const LEAD_IN_MS = 2000;
export const HIT_WINDOW_MS = 125;
export const PERFECT_WINDOW_MS = 50;
export const RHYTHM_BEST_KEY = 'moecore:parkour:rhythm:best:v1';

export interface RhythmNote {
  readonly id: number;
  readonly at: number;
  readonly action: RhythmAction;
}
// Original 120 BPM chart. First teach each key, then alternate lanes,
// then add off-beats. Each phrase ends with room to recover.
const phrases: readonly (readonly [number, RhythmAction][])[] = [
  [
    [0, 'jump'],
    [2, 'jump'],
    [4, 'tail'],
    [6, 'tail'],
  ],
  [
    [0, 'slide'],
    [2, 'slide'],
    [4, 'jump'],
    [6, 'tail'],
  ],
  [
    [0, 'jump'],
    [1, 'tail'],
    [2, 'slide'],
    [4, 'tail'],
    [5, 'jump'],
    [6, 'slide'],
  ],
  [
    [0, 'tail'],
    [1, 'tail'],
    [2, 'jump'],
    [4, 'slide'],
    [5, 'tail'],
    [6, 'jump'],
  ],
  [
    [0, 'jump'],
    [1, 'slide'],
    [2, 'tail'],
    [3, 'jump'],
    [4, 'slide'],
    [6, 'tail'],
  ],
  [
    [0, 'tail'],
    [0.5, 'jump'],
    [2, 'slide'],
    [3, 'tail'],
    [4, 'jump'],
    [4.5, 'tail'],
    [6, 'slide'],
  ],
  [
    [0, 'jump'],
    [1, 'tail'],
    [1.5, 'slide'],
    [3, 'jump'],
    [4, 'tail'],
    [5, 'slide'],
    [6, 'tail'],
  ],
  [
    [0, 'slide'],
    [1, 'jump'],
    [2, 'tail'],
    [2.5, 'jump'],
    [4, 'slide'],
    [5, 'tail'],
    [6, 'jump'],
  ],
  [
    [0, 'tail'],
    [0.5, 'tail'],
    [2, 'jump'],
    [3, 'slide'],
    [4, 'tail'],
    [4.5, 'jump'],
    [6, 'slide'],
  ],
  [
    [0, 'jump'],
    [1, 'slide'],
    [2, 'tail'],
    [3, 'jump'],
    [4, 'slide'],
    [5, 'tail'],
    [6, 'jump'],
  ],
  [
    [0, 'tail'],
    [0.5, 'jump'],
    [1, 'slide'],
    [2, 'tail'],
    [3, 'jump'],
    [4, 'tail'],
    [5, 'slide'],
    [6, 'jump'],
  ],
  [
    [0, 'jump'],
    [1, 'tail'],
    [2, 'slide'],
    [3, 'tail'],
    [4, 'jump'],
    [5, 'slide'],
    [6, 'tail'],
  ],
];
export const rhythmChart: readonly RhythmNote[] = phrases.flatMap((phrase, index) =>
  phrase.map(([beat, action]) => ({
    id: index * 16 + beat * 2,
    at: LEAD_IN_MS + (index * 8 + beat) * BEAT_MS,
    action,
  })),
);
export const RHYTHM_END_MS = LEAD_IN_MS + phrases.length * 8 * BEAT_MS;
export interface RhythmState {
  readonly elapsed: number;
  readonly cursor: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly hitWindow: number;
  readonly score: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly perfect: number;
  readonly good: number;
  readonly misses: number;
  readonly wrong: number;
  readonly status: 'running' | 'won' | 'lost';
  readonly last: {
    readonly kind: RhythmJudgement;
    readonly at: number;
    readonly error: number;
  } | null;
}
export const beginRhythm = (assisted = false): RhythmState => ({
  elapsed: 0,
  cursor: 0,
  health: assisted ? 8 : 6,
  maxHealth: assisted ? 8 : 6,
  hitWindow: assisted ? 150 : HIT_WINDOW_MS,
  score: 0,
  combo: 0,
  bestCombo: 0,
  perfect: 0,
  good: 0,
  misses: 0,
  wrong: 0,
  status: 'running',
  last: null,
});
export function advanceRhythm(
  state: RhythmState,
  elapsed: number,
  action?: RhythmAction,
): RhythmState {
  if (state.status !== 'running') return state;
  if (!Number.isFinite(elapsed) || elapsed < state.elapsed)
    throw new RangeError('Rhythm time must move forward.');
  let next = { ...state, elapsed };
  while (rhythmChart[next.cursor] && rhythmChart[next.cursor]!.at + state.hitWindow < elapsed) {
    next = {
      ...next,
      cursor: next.cursor + 1,
      health: next.health - 1,
      combo: 0,
      misses: next.misses + 1,
      last: { kind: 'miss', at: elapsed, error: elapsed - rhythmChart[next.cursor]!.at },
    };
    if (next.health === 0) return { ...next, status: 'lost' };
  }
  // The musical count-in has no penalty; once the chart begins, mashing is costly.
  if (action && elapsed >= LEAD_IN_MS - state.hitWindow) {
    const note = rhythmChart[next.cursor];
    const error = note ? elapsed - note.at : Infinity;
    if (note && note.action === action && Math.abs(error) <= state.hitWindow) {
      const perfect = Math.abs(error) <= PERFECT_WINDOW_MS;
      const combo = next.combo + 1;
      next = {
        ...next,
        cursor: next.cursor + 1,
        combo,
        bestCombo: Math.max(next.bestCombo, combo),
        score: next.score + (perfect ? 100 : 60) + Math.min(100, combo * 2),
        perfect: next.perfect + Number(perfect),
        good: next.good + Number(!perfect),
        last: { kind: perfect ? 'perfect' : 'good', at: elapsed, error },
      };
    } else if (note) {
      next = {
        ...next,
        health: next.health - 1,
        combo: 0,
        wrong: next.wrong + 1,
        last: { kind: 'wrong', at: elapsed, error: Number.isFinite(error) ? error : 0 },
      };
      if (next.health === 0) return { ...next, status: 'lost' };
    }
  }
  return elapsed >= RHYTHM_END_MS ? { ...next, status: 'won' } : next;
}
export function rhythmGrade(state: RhythmState): string {
  if (state.status !== 'won') return '继续练拍';
  if (state.perfect === rhythmChart.length && !state.wrong) return '全精准';
  if (!state.misses && !state.wrong) return '全连';
  return '交付成功';
}
export function rhythmSection(elapsed: number): string {
  if (elapsed < LEAD_IN_MS) return '四拍准备';
  if (elapsed < 10000) return '提示词热身';
  if (elapsed < 22000) return 'Token 接龙';
  if (elapsed < 38000) return '上下文切换';
  return '停止废话 · 按拍交付';
}
