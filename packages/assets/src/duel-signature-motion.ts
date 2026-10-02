import geometry from '../duel/signature-motion/geometry.json';

export const DUEL_SIGNATURE_GEOMETRY = geometry;
export const DUEL_SIGNATURE_MOTION = {
  deepseek: new URL('../duel/signature-motion/deepseek-v1.png', import.meta.url).href,
  doubao: new URL('../duel/signature-motion/doubao-v1.png', import.meta.url).href,
  client: new URL('../duel/signature-motion/client-v2.png', import.meta.url).href,
  prompt_sage: new URL('../duel/signature-motion/prompt_sage-v1.png', import.meta.url).href,
  unplug_uncle: new URL('../duel/signature-motion/unplug_uncle-v1.png', import.meta.url).href,
} as const;
