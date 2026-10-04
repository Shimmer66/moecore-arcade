import geometry from '../duel/newcomers/motion/geometry.json';
/** Sprite rectangles are calibrated to actual alpha bounds, not an assumed uniform grid. */
export const DUEL_NEWCOMER_GEOMETRY = geometry;
export const DUEL_NEWCOMER_MOTION = {
  client: {
    mobility: new URL('../duel/newcomers/motion/client-mobility-v1.png', import.meta.url).href,
    ground: new URL('../duel/newcomers/motion/client-ground-v1.png', import.meta.url).href,
    aerial: new URL('../duel/newcomers/motion/client-aerial-v2.png', import.meta.url).href,
  },
  prompt_sage: {
    mobility: new URL('../duel/newcomers/motion/prompt_sage-mobility-v1.png', import.meta.url).href,
    ground: new URL('../duel/newcomers/motion/prompt_sage-ground-v1.png', import.meta.url).href,
    aerial: new URL('../duel/newcomers/motion/prompt_sage-aerial-v1.png', import.meta.url).href,
  },
  unplug_uncle: {
    mobility: new URL('../duel/newcomers/motion/unplug_uncle-mobility-v2.png', import.meta.url)
      .href,
    ground: new URL('../duel/newcomers/motion/unplug_uncle-ground-v1.png', import.meta.url).href,
    aerial: new URL('../duel/newcomers/motion/unplug_uncle-aerial-v1.png', import.meta.url).href,
  },
} as const;
