import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadParkourAssets, PARKOUR_MANIFEST } from '../src/parkour';

describe('parkour asset pack', () => {
  it('has 400 unique RGBA PNGs with matching sizes and hashes', () => {
    expect(PARKOUR_MANIFEST.asset_count).toBe(400);
    expect(PARKOUR_MANIFEST.assets).toHaveLength(400);
    expect(new Set(PARKOUR_MANIFEST.assets.map((asset) => asset.id)).size).toBe(400);
    for (const asset of PARKOUR_MANIFEST.assets) {
      const bytes = readFileSync(new URL(`../parkour/${asset.file}`, import.meta.url));
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(bytes.readUInt32BE(16)).toBe(asset.width);
      expect(bytes.readUInt32BE(20)).toBe(asset.height);
      expect(bytes[25]).toBe(6);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
    }
  });

  it('resolves requested files and rejects missing asset IDs', async () => {
    const urls = await loadParkourAssets(['deepseek_pose_005', 'items_001', 'items_001']);
    expect(Object.keys(urls)).toEqual(['deepseek_pose_005', 'items_001']);
    expect(urls.deepseek_pose_005).toContain('deepseek_pose_005.png');
    await expect(loadParkourAssets(['not-present'])).rejects.toThrow('Unknown parkour asset');
    await expect(loadParkourAssets(['__proto__'])).rejects.toThrow('Unknown parkour asset');
  });
});
