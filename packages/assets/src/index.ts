export const ASSETS = {
  riceBowl: {
    id: 'rice-bowl',
    url: new URL('../resources/rice-bowl.svg', import.meta.url).href,
    author: 'MoeCore Arcade contributors',
    source: 'repository',
    reviewStatus: 'original-placeholder',
  },
  canteen: {
    id: 'canteen',
    url: new URL('../resources/canteen.svg', import.meta.url).href,
    author: 'MoeCore Arcade contributors',
    source: 'repository',
    reviewStatus: 'original-placeholder',
  },
  arcadeMark: {
    id: 'arcade-mark',
    url: new URL('../resources/arcade-mark.svg', import.meta.url).href,
    author: 'MoeCore Arcade contributors',
    source: 'repository',
    reviewStatus: 'original-placeholder',
  },
} as const;

export type AssetId = (typeof ASSETS)[keyof typeof ASSETS]['id'];
