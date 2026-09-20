export const ASSETS = {
  arcadeMark: {
    id: 'arcade-mark',
    url: new URL('../resources/arcade-mark.svg', import.meta.url).href,
    author: 'MoeCore Arcade contributors',
    source: 'repository',
    reviewStatus: 'original-placeholder',
  },
} as const;

export type AssetId = (typeof ASSETS)[keyof typeof ASSETS]['id'];
