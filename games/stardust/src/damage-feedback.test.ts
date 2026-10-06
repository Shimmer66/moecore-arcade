import { describe, expect, it } from 'vitest';
import { damageLabel } from './damage-feedback';

describe('damage feedback', () => {
  it('distinguishes direct hits and persistent effects', () => {
    expect(damageLabel('light', false)).toBe('普通攻击');
    expect(damageLabel('stand', false)).toBe('连打');
    expect(damageLabel('bleed', false)).toBe('流血');
    expect(damageLabel('emerald', false)).toBe('绿宝石流血');
    expect(damageLabel('burn', false)).toBe('燃烧');
    expect(damageLabel('special', false)).toBe('必杀');
  });

  it('keeps the source when showing reflection or guarded damage', () => {
    expect(damageLabel('burn', true)).toBe('替身返还50% · 燃烧');
    expect(damageLabel('light', true)).toBe('替身返还50% · 普通攻击');
    expect(damageLabel('heavy', false, true)).toBe('防御减伤 · 重击');
  });
});
