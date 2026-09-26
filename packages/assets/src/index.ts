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

// Only the four catalogue portraits are eager; game asset packs remain lazy.
export const ARCADE_PORTRAITS: Readonly<Record<string, string>> = {
  match3: new URL('../match3/assets/characters/gpt_pose_01.png', import.meta.url).href,
  parkour: new URL('../whale-runner/runtime/portrait_happy.webp', import.meta.url).href,
  sokoban: new URL('../sokoban/runtime/portrait_confused.png', import.meta.url).href,
  'whale-queue': new URL(
    '../whale-queue/character/portrait_whalegirl_delighted.png',
    import.meta.url,
  ).href,
};
