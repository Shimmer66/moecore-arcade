import { describe, expect, it } from 'vitest';
import { chapterStories, endingFor, openingLines } from '../src/config/story';
import { runners } from '../src/config/art';

describe('story progress', () => {
  it('gives all selectable characters an opening and valid chapter speakers', () => {
    for (const runner of runners) expect(openingLines[runner.id].length).toBeGreaterThan(0);
    expect(chapterStories).toHaveLength(2);
    for (const chapter of chapterStories)
      expect(runners.some((runner) => runner.id === chapter.speaker)).toBe(true);
  });

  it('chooses endings from actual completion and collected starlight', () => {
    expect(endingFor(false, 100).title).toBe('潮水里的约定');
    expect(endingFor(true, 29).title).toBe('第一盏灯');
    expect(endingFor(true, 30).title).toBe('归航之光');
    expect(endingFor(true, 59).title).toBe('归航之光');
    expect(endingFor(true, 60).title).toBe('星潮长明');
  });
});
