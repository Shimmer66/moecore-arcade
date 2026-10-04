/** Dedicated crouch art: no standing-pose squash and no atlas bleed. */
export const DUEL_CROUCH_ART = {
  deepseek: {
    crouch: new URL('../duel/combat/crouch/deepseek-crouch.png', import.meta.url).href,
    low_hit: new URL('../duel/combat/crouch/deepseek-low_hit.png', import.meta.url).href,
  },
  gpt: {
    crouch: new URL('../duel/combat/crouch/gpt-crouch.png', import.meta.url).href,
    low_hit: new URL('../duel/combat/crouch/gpt-low_hit.png', import.meta.url).href,
  },
  doubao: {
    crouch: new URL('../duel/combat/crouch/doubao-crouch.png', import.meta.url).href,
    low_hit: new URL('../duel/combat/crouch/doubao-low_hit.png', import.meta.url).href,
  },
} as const;
export const DUEL_CROUCH_GEOMETRY = {
  deepseek: {
    crouch: {
      x: -81.203,
      y: -125.987,
      width: 132.762,
      height: 132.762,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
    low_hit: {
      x: -80.402,
      y: -129.023,
      width: 140.326,
      height: 140.326,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
  },
  gpt: {
    crouch: {
      x: -73.966,
      y: -113.034,
      width: 118.914,
      height: 118.914,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
    low_hit: {
      x: -78.935,
      y: -116.682,
      width: 125.059,
      height: 125.059,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
  },
  doubao: {
    crouch: {
      x: -77.41,
      y: -137.47,
      width: 151.084,
      height: 151.084,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
    low_hit: {
      x: -76.644,
      y: -138.696,
      width: 153.779,
      height: 153.779,
      viewBox: '0 0 1254 1254',
      sourceWidth: 1254,
      sourceHeight: 1254,
    },
  },
} as const;
export const DUEL_SWEEP_ART = new URL('../duel/combat/crouch/sweep-atlas.png', import.meta.url)
  .href;
export const DUEL_SWEEP_GEOMETRY = {
  deepseek: {
    x: -47.895,
    y: -106.204,
    width: 118.355,
    height: 114.252,
    viewBox: '0 0 750 724',
    sourceWidth: 2172,
    sourceHeight: 724,
  },
  gpt: {
    x: -47.341,
    y: -107.752,
    width: 117.953,
    height: 115.403,
    viewBox: '750 0 740 724',
    sourceWidth: 2172,
    sourceHeight: 724,
  },
  doubao: {
    x: -36.868,
    y: -115.749,
    width: 116.949,
    height: 124.152,
    viewBox: '1490 0 682 724',
    sourceWidth: 2172,
    sourceHeight: 724,
  },
} as const;
