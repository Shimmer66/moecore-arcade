import geometry from '../duel/advanced-motion/geometry.json';
export const DUEL_ADVANCED_GEOMETRY = geometry;
export const DUEL_ADVANCED_MOTION = {
  deepseek: new URL('../duel/advanced-motion/deepseek-v1.png', import.meta.url).href,
  gpt: new URL('../duel/advanced-motion/gpt-v1.png', import.meta.url).href,
  doubao: new URL('../duel/advanced-motion/doubao-v1.png', import.meta.url).href,
  client: new URL('../duel/advanced-motion/client-v1.png', import.meta.url).href,
  prompt_sage: new URL('../duel/advanced-motion/prompt_sage-v2.png', import.meta.url).href,
  unplug_uncle: new URL('../duel/advanced-motion/unplug_uncle-v1.png', import.meta.url).href,
} as const;
