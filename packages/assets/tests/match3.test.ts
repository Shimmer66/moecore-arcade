import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getMatch3Asset, MATCH3_ASSETS, MATCH3_ASSET_MANIFEST } from '../src/match3';

describe('match3 asset pack', () => {
  it('exposes all 60 generated assets with stable manifest metadata', () => {
    expect(MATCH3_ASSET_MANIFEST.assetCount).toBe(60);
    expect(Object.keys(MATCH3_ASSETS)).toHaveLength(60);
    expect(new Set(Object.keys(MATCH3_ASSETS)).size).toBe(60);
  });

  it('keeps every imported PNG present and unchanged', () => {
    for (const asset of Object.values(MATCH3_ASSETS)) {
      const file = new URL(`../match3/${asset.path}`, import.meta.url);
      expect(existsSync(file)).toBe(true);

      const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
      expect(hash).toBe(asset.sha256);
      expect(asset.url).toBeTruthy();
    }
  });

  it('keeps the two tile skins under the same six character IDs', () => {
    const portraitTiles = Object.values(MATCH3_ASSETS).filter(
      (asset) => asset.category === 'tiles' && asset.id.endsWith('_tile_portrait'),
    );
    const symbolTiles = Object.values(MATCH3_ASSETS).filter(
      (asset) => asset.category === 'tiles' && asset.id.endsWith('_tile_symbol'),
    );

    expect(portraitTiles).toHaveLength(6);
    expect(symbolTiles).toHaveLength(6);
    expect(portraitTiles.map((asset) => asset.characterId)).toEqual(
      symbolTiles.map((asset) => asset.characterId),
    );
    expect(getMatch3Asset('deepseek_tile_portrait').characterId).toBe('deepseek');
  });
});
