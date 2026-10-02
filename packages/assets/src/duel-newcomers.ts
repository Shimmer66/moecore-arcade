/** Six key poses per character, 3 × 2 atlas. Original RGBA is preserved. */
export const DUEL_NEWCOMER_ART = {
  client: new URL('../duel/newcomers/client-poses-v2.png', import.meta.url).href,
  prompt_sage: new URL('../duel/newcomers/prompt_sage-poses-v2.png', import.meta.url).href,
  unplug_uncle: new URL('../duel/newcomers/unplug_uncle-poses-v2.png', import.meta.url).href,
} as const;
/** Per-pose foot pivot in its 512 px cell; one scale per character. */
export const DUEL_NEWCOMER_PIVOTS = {
  client: [
    [270, 450],
    [225, 450],
    [236, 450],
    [230, 405],
    [268, 408],
    [220, 408],
  ],
  prompt_sage: [
    [246, 469],
    [222, 467],
    [202, 475],
    [252, 437],
    [274, 437],
    [238, 430],
  ],
  unplug_uncle: [
    [239, 437],
    [217, 436],
    [249, 433],
    [231, 420],
    [254, 415],
    [259, 420],
  ],
} as const;
