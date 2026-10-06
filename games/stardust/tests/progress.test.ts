import { describe, expect, it } from 'vitest';
import {
  challengeVictory,
  defeatedEnemy,
  enemyUnlocked,
  ENEMY_UNLOCK_KILLS,
  sanitizeEnemyProgress,
} from '../src/progress';

const ids = ['gray-fly', 'dio'] as const;

describe('enemy unlock progress', () => {
  it('unlocks only the specific enemy on its thirtieth defeat', () => {
    const original = { 'gray-fly': 29, dio: 29 };
    expect(enemyUnlocked(original, 'gray-fly')).toBe(false);
    expect(enemyUnlocked(original, 'dio')).toBe(false);
    const next = defeatedEnemy(original, 'gray-fly');
    expect(enemyUnlocked(next, 'gray-fly')).toBe(true);
    expect(enemyUnlocked(next, 'dio')).toBe(false);
    expect(next).toEqual({ 'gray-fly': 30, dio: 29 });
    expect(original).toEqual({ 'gray-fly': 29, dio: 29 });
  });

  it('handles missing, malformed and negative saved counts safely', () => {
    expect(sanitizeEnemyProgress(null, ids)).toEqual({});
    expect(sanitizeEnemyProgress([], ids)).toEqual({});
    expect(sanitizeEnemyProgress({ 'gray-fly': -4, dio: Number.NaN }, ids)).toEqual({
      'gray-fly': 0,
    });
    expect(enemyUnlocked({}, 'dio')).toBe(false);
  });
  it('sanitizes persisted values and ignores unknown enemies', () => {
    expect(
      sanitizeEnemyProgress({ 'gray-fly': 12.8, dio: 99, unknown: 30, broken: '30' }, ids),
    ).toEqual({ 'gray-fly': 12, dio: 30 });
  });

  it('increments defeats up to the unlock threshold', () => {
    let progress = {};
    for (let count = 0; count < 40; count += 1) progress = defeatedEnemy(progress, 'dio');
    expect(progress).toEqual({ dio: ENEMY_UNLOCK_KILLS });
    expect(enemyUnlocked(progress, 'dio')).toBe(true);
    expect(enemyUnlocked(progress, 'gray-fly')).toBe(false);
  });

  it('counts a challenge victory and reports the thirtieth-defeat unlock', () => {
    const victory = challengeVictory({ 'gray-fly': 29 }, 'gray-fly', '格雷·弗莱');
    expect(victory).toMatchObject({
      progress: { 'gray-fly': 30 },
      kills: 30,
      unlocked: true,
    });
    expect(victory.summary).toContain('已解锁为可操作角色');
  });
});
