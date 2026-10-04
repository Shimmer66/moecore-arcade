import { describe, expect, it } from 'vitest';
import { personaMemeLine, sectorMemeLine, stageMemeLine } from '../src/meme';

describe('absurd AI meme scripts', () => {
  it('gives every stage a distinct setup, boss punchline and payoff', () => {
    for (const event of ['intro', 'boss', 'clear'] as const) {
      const lines = Array.from({ length: 8 }, (_, stage) => stageMemeLine(stage, event));
      expect(new Set(lines).size).toBe(8);
      expect(lines.every((line) => line.includes('。') || line.includes('！'))).toBe(true);
    }
    expect(stageMemeLine(7, 'clear')).toContain('第一关');
  });

  it('uses three escalating sector beats per stage', () => {
    for (let stage = 0; stage < 8; stage++) {
      const lines = [0, 1, 2].map((sector) => sectorMemeLine(stage, sector));
      expect(new Set(lines).size).toBe(3);
    }
  });

  it('keeps DeepSeek, GPT and Claude character comedy distinct', () => {
    for (const event of ['hit', 'pickup', 'boss', 'victory'] as const) {
      const lines = (['deepseek', 'gpt', 'claude'] as const).map((persona) =>
        personaMemeLine(persona, event),
      );
      expect(new Set(lines).size).toBe(3);
    }
    expect(personaMemeLine('deepseek', 'boss')).toContain('先撞');
    expect(personaMemeLine('claude', 'boss')).toContain('不能协助');
  });
});
