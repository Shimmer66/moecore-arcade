import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ASSETS } from '../src/index';

describe('asset manifest', () => {
  it('resolves every declared resource to an existing source file', () => {
    for (const asset of Object.values(ASSETS)) {
      expect(existsSync(new URL(asset.url))).toBe(true);
    }
  });

  it('contains only original scaffold artwork', () => {
    for (const asset of Object.values(ASSETS)) {
      expect(asset.reviewStatus).toBe('original-placeholder');
      expect(asset.source).toBe('repository');
    }
  });
});
