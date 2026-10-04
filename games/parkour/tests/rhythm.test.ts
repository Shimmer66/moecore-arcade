import { describe, expect, it } from 'vitest';
import {
  advanceRhythm,
  beginRhythm,
  rhythmChart,
  rhythmGrade,
  HIT_WINDOW_MS,
  PERFECT_WINDOW_MS,
  RHYTHM_END_MS,
} from '../src/rules/rhythm';

describe('original rhythm chart and timing', () => {
  it('supports full perfect play through the entire chart', () => {
    let state = beginRhythm();
    for (const note of rhythmChart) state = advanceRhythm(state, note.at, note.action);
    state = advanceRhythm(state, RHYTHM_END_MS);
    expect(state.status).toBe('won');
    expect(state.perfect).toBe(rhythmChart.length);
    expect(state.bestCombo).toBe(rhythmChart.length);
    expect(state.health).toBe(6);
    expect(rhythmGrade(state)).toBe('全精准');
    expect(new Set(rhythmChart.map((note) => note.id)).size).toBe(rhythmChart.length);
    for (let i = 1; i < rhythmChart.length; i++)
      expect(rhythmChart[i]!.at - rhythmChart[i - 1]!.at).toBeGreaterThanOrEqual(250);
  });
  it.each([-1, 1])('uses symmetric perfect and good windows (%i)', (direction) => {
    const first = rhythmChart[0]!;
    expect(
      advanceRhythm(beginRhythm(), first.at + direction * PERFECT_WINDOW_MS, first.action).perfect,
    ).toBe(1);
    const good = advanceRhythm(beginRhythm(), first.at + direction * HIT_WINDOW_MS, first.action);
    expect(good.good).toBe(1);
    expect(good.cursor).toBe(1);
    expect(good.perfect).toBe(0);
  });
  it('cannot mash or hold one action for a full clear', () => {
    let state = beginRhythm();
    const first = rhythmChart[0]!;
    for (let i = 0; i < 6; i++) state = advanceRhythm(state, first.at + i, 'tail');
    expect(state.status).toBe('lost');
    expect(state.wrong).toBe(6);
    expect(state.cursor).toBe(0);
    expect(state.score).toBe(0);
    expect(advanceRhythm(state, RHYTHM_END_MS, 'jump')).toBe(state);
  });
  it('expires missed notes across frame gaps and loses without input', () => {
    const state = advanceRhythm(beginRhythm(), RHYTHM_END_MS);
    expect(state.status).toBe('lost');
    expect(state.misses).toBe(6);
    expect(state.health).toBe(0);
  });
  it('count-in is free, repeated timestamps do not duplicate hits, and time cannot reverse', () => {
    let state = advanceRhythm(beginRhythm(), 500, 'tail');
    expect(state.health).toBe(6);
    state = advanceRhythm(state, rhythmChart[0]!.at, 'jump');
    const twice = advanceRhythm(state, rhythmChart[0]!.at, 'jump');
    expect(twice.perfect).toBe(1);
    expect(twice.wrong).toBe(1);
    expect(() => advanceRhythm(state, 0)).toThrow(RangeError);
    expect(() => advanceRhythm(state, NaN)).toThrow(RangeError);
  });
  it('good timing can full-combo the song without earning full-perfect', () => {
    let state = beginRhythm();
    for (const note of rhythmChart) state = advanceRhythm(state, note.at + 80, note.action);
    state = advanceRhythm(state, RHYTHM_END_MS);
    expect(state.good).toBe(rhythmChart.length);
    expect(rhythmGrade(state)).toBe('全连');
  });
});
