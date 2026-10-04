import { describe, expect, it } from 'vitest';
import { STARDUST_GAME_ID, STARDUST_GAME_TITLE } from '../src/meta';

describe('stardust game metadata', () => {
  it('keeps the registry identity stable', () => {
    expect(STARDUST_GAME_ID).toBe('stardust');
    expect(STARDUST_GAME_TITLE).toBe('星尘远征：替身决斗');
  });
});
