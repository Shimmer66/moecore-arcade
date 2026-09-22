import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOKOBAN_ASSETS, SOKOBAN_MANIFEST, getSokobanAsset } from '../src/sokoban';

describe('sokoban asset pack', () => {
  it('exposes the pending review runtime manifest', () => {
    expect(SOKOBAN_MANIFEST.assetCount).toBe(82);
    expect(SOKOBAN_MANIFEST.reviewStatus).toBe('generated-pending-review');
    expect(Object.keys(SOKOBAN_ASSETS)).toHaveLength(82);
  });

  it('keeps every declared asset present with its recorded hash', () => {
    for (const asset of Object.values(SOKOBAN_ASSETS)) {
      const file = new URL(`../sokoban/${asset.file}`, import.meta.url);
      expect(existsSync(file)).toBe(true);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(asset.sha256);
    }
    expect(getSokobanAsset('char_E_idle_01').url).toBeTruthy();
  });
});
