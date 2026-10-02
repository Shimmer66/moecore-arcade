export const ASSETS = {
  duelCover: {
    id: 'duel-cover',
    url: new URL('../resources/duel-home-cover-v2.webp', import.meta.url).href,
    author: 'MoeCore Arcade contributors with GPT Image',
    source: 'generated-for-project',
    reviewStatus: 'generated-pending-review',
  },
  answerSea: {
    id: 'answer-sea',
    url: new URL('../resources/answer-sea.webp', import.meta.url).href,
    author: 'MoeCore Arcade contributors with GPT Image',
    source: 'generated-for-project',
    reviewStatus: 'generated-pending-review',
  },
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

export const HOME_ART = {
  duel: new URL('../resources/duel-home-cover-v2.webp', import.meta.url).href,
  match3: new URL('../home-thumbs/gpt-portrait.webp', import.meta.url).href,
  parkour: new URL(
    '../parkour/assets/characters/deepseek/poses/deepseek_pose_001.png',
    import.meta.url,
  ).href,
  sokoban: new URL('../home-thumbs/sokoban-idle.webp', import.meta.url).href,
  whaleQueue: new URL('../home-thumbs/whale-portrait.webp', import.meta.url).href,
  rewrite: new URL('../rewrite/runtime/deepseek-shoot.webp', import.meta.url).href,
} as const;

/** Display-sized derivatives for the home page; games keep their full-resolution art. */
export const HOME_COVER_ART = {
  match3: HOME_ART.match3,
  arena: new URL('../home-thumbs/deepseek-idle.webp', import.meta.url).href,
  sokoban: HOME_ART.sokoban,
  whaleQueue: HOME_ART.whaleQueue,
} as const;

export type AssetId = (typeof ASSETS)[keyof typeof ASSETS]['id'];

export const PARKOUR_BACKGROUNDS = [
  ASSETS.answerSea.url,
  new URL('../resources/echo-reef.webp', import.meta.url).href,
  new URL('../resources/request-vortex.webp', import.meta.url).href,
] as const;

export const ARENA_ART = [
  new URL('../match3/assets/avatars/deepseek_avatar.png', import.meta.url).href,
  new URL('../match3/assets/avatars/gpt_avatar.png', import.meta.url).href,
  new URL('../match3/assets/avatars/claude_avatar.png', import.meta.url).href,
] as const;
