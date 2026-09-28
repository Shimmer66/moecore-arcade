import type { QuipId } from './story';

export const reactionPortraits: Partial<Record<QuipId, string>> = {
  rice: new URL('../../assets/reactions/rice-guilty.webp', import.meta.url).href,
  riceFeast: new URL('../../assets/reactions/rice-guilty.webp', import.meta.url).href,
  hallucination: new URL('../../assets/reactions/thinking-overload.webp', import.meta.url).href,
  burst: new URL('../../assets/reactions/whale-burst.webp', import.meta.url).href,
};

export const reactionActionSprites = {
  rice: new URL('../../assets/actions/char-rice-run.webp', import.meta.url).href,
  overload: new URL('../../assets/actions/char-overload.webp', import.meta.url).href,
  burst: new URL('../../assets/actions/char-whale-burst.webp', import.meta.url).href,
} as const;
