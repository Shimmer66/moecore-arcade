import geometry from '../duel/normal-motion/geometry.json';
export const DUEL_NORMAL_GEOMETRY = geometry;
export const DUEL_NORMAL_MOTION = {
  deepseek: new URL('../duel/normal-motion/deepseek-v1.png', import.meta.url).href,
  gpt: new URL('../duel/normal-motion/gpt-v1.png', import.meta.url).href,
  doubao: new URL('../duel/normal-motion/doubao-v1.png', import.meta.url).href,
  client: new URL('../duel/normal-motion/client-v1.png', import.meta.url).href,
  prompt_sage: new URL('../duel/normal-motion/prompt_sage-v1.png', import.meta.url).href,
  unplug_uncle: new URL('../duel/normal-motion/unplug_uncle-v1.png', import.meta.url).href,
} as const;
