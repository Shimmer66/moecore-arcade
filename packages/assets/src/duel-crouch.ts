/** Deep crouch and low-punch atlas; native pixels, calibrated foot anchors. */
export const DUEL_CROUCH_ART = new URL('../duel/runtime/crouch-atlas.webp', import.meta.url).href;
export const DUEL_CROUCH_GEOMETRY = {
  deepseek: {
    crouch: {
      x: -64.352,
      y: -99.927,
      width: 100.913,
      height: 100.913,
      viewBox: '0 0 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
    low_hit: {
      x: -55.088,
      y: -100.322,
      width: 100.913,
      height: 100.913,
      viewBox: '512 0 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
  },
  gpt: {
    crouch: {
      x: -64.259,
      y: -98.065,
      width: 98.065,
      height: 98.065,
      viewBox: '0 512 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
    low_hit: {
      x: -54.204,
      y: -98.065,
      width: 98.065,
      height: 98.065,
      viewBox: '512 512 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
  },
  doubao: {
    crouch: {
      x: -63.777,
      y: -95.0,
      width: 104.828,
      height: 104.828,
      viewBox: '0 1024 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
    low_hit: {
      x: -54.564,
      y: -95.205,
      width: 104.828,
      height: 104.828,
      viewBox: '512 1024 512 512',
      sourceWidth: 1024,
      sourceHeight: 1536,
    },
  },
} as const;

export const DUEL_SWEEP_ART = new URL('../duel/runtime/sweep-atlas.webp', import.meta.url).href;
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
