import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS, PARKOUR_BACKGROUNDS } from '../src/index';

describe('asset manifest', () => {
  it('resolves every declared resource to an existing source file', () => {
    for (const asset of Object.values(ASSETS)) {
      expect(existsSync(new URL(asset.url))).toBe(true);
    }
  });
  it('provides a distinct source image for each parkour level', () => {
    expect(PARKOUR_BACKGROUNDS).toHaveLength(3);
    for (const url of PARKOUR_BACKGROUNDS) expect(existsSync(new URL(url))).toBe(true);
    expect(new Set(PARKOUR_BACKGROUNDS).size).toBe(3);
  });

  it('keeps scaffold artwork separate from generated scene art', () => {
    for (const asset of Object.values(ASSETS)) {
      if (asset.source === 'generated-for-project') {
        expect(asset.reviewStatus).toBe('generated-pending-review');
      } else {
        expect(asset.reviewStatus).toBe('original-placeholder');
        expect(asset.source).toBe('repository');
      }
    }
  });
});
