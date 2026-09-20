import { describe, expect, it } from 'vitest';
import { createGameStorageKey, SETTINGS_STORAGE_KEY } from '../src/index';

describe('storage namespaces', () => {
  it('separates game records and shared settings', () => {
    const match3 = createGameStorageKey('match3', 'progress');
    expect(match3).toBe('moecore:game:match3:v1:progress');
    expect(match3).not.toBe(createGameStorageKey('memory', 'progress'));
    expect(match3).not.toBe(SETTINGS_STORAGE_KEY);
  });

  it('escapes separators in both namespace components', () => {
    expect(createGameStorageKey('a:v1:b', 'c')).not.toBe(createGameStorageKey('a', 'b:v1:c'));
    expect(createGameStorageKey('match3', 'a:b')).toBe('moecore:game:match3:v1:a%3Ab');
    expect(createGameStorageKey('match3', 'a%3Ab')).not.toBe(createGameStorageKey('match3', 'a:b'));
  });

  it.each([
    ['', 'progress'],
    ['match3', ''],
    [' ', 'progress'],
    ['match3', ' '],
  ])('rejects empty components: %j / %j', (gameId, key) => {
    expect(() => createGameStorageKey(gameId, key)).toThrow();
  });
});
