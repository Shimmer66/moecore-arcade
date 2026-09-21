import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadWhaleRunnerAssets, WHALE_RUNNER_MANIFEST } from '../src/whale-runner';
import sourceManifest from '../whale-runner/asset-manifest.json';

describe('whale runner asset pack', () => {
  it('has 72 generated assets with matching PNG metadata and hashes', () => {
    expect(WHALE_RUNNER_MANIFEST.count).toBe(72);
    expect(WHALE_RUNNER_MANIFEST.assets).toHaveLength(72);
    expect(new Set(WHALE_RUNNER_MANIFEST.assets.map((asset) => asset.id)).size).toBe(72);

    for (const asset of sourceManifest.assets) {
      const bytes = readFileSync(new URL(`../whale-runner/${asset.file}`, import.meta.url));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(asset.actual_size[0]);
      expect(bytes.readUInt32BE(20)).toBe(asset.actual_size[1]);
      expect(bytes[25]).toBe(asset.mode === 'RGB' ? 2 : 6);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('keeps runtime derivatives traceable to the original PNGs', () => {
    for (const asset of WHALE_RUNNER_MANIFEST.assets) {
      const bytes = readFileSync(new URL(`../whale-runner/${asset.file}`, import.meta.url));
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
      expect(sourceManifest.assets.find((source) => source.id === asset.id)?.sha256).toBe(
        asset.sourceSha256,
      );
    }
  });

  it('loads only requested office assets', async () => {
    const urls = await loadWhaleRunnerAssets([
      'char_idle_01',
      'obstacle_docs_large',
      'pickup_bubble',
      'keyart_menu',
      'pickup_bubble',
    ]);
    expect(Object.keys(urls)).toEqual([
      'char_idle_01',
      'obstacle_docs_large',
      'pickup_bubble',
      'keyart_menu',
    ]);
    expect(urls.char_idle_01).toContain('char_idle_01.webp');
    await expect(loadWhaleRunnerAssets(['not-a-real-asset'])).rejects.toThrow(
      'Unknown whale runner asset',
    );
  });
});
