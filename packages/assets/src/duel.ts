export { DUEL_COMBAT_ART, DUEL_COMBAT_FX, DUEL_COMBAT_GEOMETRY } from './duel-combat';
export {
  DUEL_CROUCH_ART,
  DUEL_CROUCH_GEOMETRY,
  DUEL_SWEEP_ART,
  DUEL_SWEEP_GEOMETRY,
} from './duel-crouch';
/** Character portraits and event illustrations. */
export { DUEL_MOTION_ART, DUEL_MOTION_GEOMETRY } from './duel-motion';
export const DUEL_ART = {
  deepseek: {
    base: new URL('../duel/first-batch/duel_ds_base.webp', import.meta.url).href,
    good: new URL('../duel/first-batch/duel_ds_thinking.webp', import.meta.url).href,
    bad: new URL('../duel/first-batch/duel_ds_busted.webp', import.meta.url).href,
    ultimate: new URL('../duel/first-batch/duel_ds_ultimate_key.webp', import.meta.url).href,
  },
  gpt: {
    base: new URL('../duel/first-batch/duel_gpt_base.webp', import.meta.url).href,
    good: new URL('../duel/first-batch/duel_gpt_confident.webp', import.meta.url).href,
    bad: new URL('../duel/first-batch/duel_gpt_revision.webp', import.meta.url).href,
    ultimate: new URL('../duel/first-batch/duel_gpt_ultimate_key.webp', import.meta.url).href,
  },
  doubao: {
    base: new URL('../duel/first-batch/duel_doubao_base_v3.webp', import.meta.url).href,
    good: new URL('../duel/first-batch/duel_doubao_guarantee.webp', import.meta.url).href,
    bad: new URL('../duel/first-batch/duel_doubao_oops.webp', import.meta.url).href,
    ultimate: new URL('../duel/first-batch/duel_doubao_ultimate_key.webp', import.meta.url).href,
  },
} as const;

export const DUEL_MEME_ART = {
  'cache-hit': new URL('../duel/memes/duel_ds_cache_hit.webp', import.meta.url).href,
  'gpt-muffled': new URL('../duel/memes/duel_gpt_muffled.webp', import.meta.url).href,
  'gpt-rollback': new URL('../duel/memes/duel_gpt_rollback.webp', import.meta.url).href,
} as const;
export const DUEL_SORE_LOSER_ART = {
  deepseek: new URL('../duel/memes/duel_ds_sore_loser.webp', import.meta.url).href,
  gpt: new URL('../duel/memes/duel_gpt_sore_loser.webp', import.meta.url).href,
  doubao: new URL('../duel/memes/duel_doubao_sore_loser.webp', import.meta.url).href,
} as const;
