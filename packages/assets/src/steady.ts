// Runtime WebP derivatives; see steady/manifest.json for original PNG provenance.
export const STEADY_ART = {
  gptReady: new URL('../steady/characters/steady_gpt_ready.webp', import.meta.url).href,
  gptStrain: new URL('../steady/characters/steady_gpt_strain.webp', import.meta.url).href,
  user: new URL('../steady/characters/steady_user_base.webp', import.meta.url).href,
  room: new URL('../steady/backgrounds/steady_room_v2.webp', import.meta.url).href,
} as const;

export const STEADY_PROPS = {
  pot: {
    url: new URL('../steady/props/steady_pot_v2.webp', import.meta.url).href,
    width: 1254,
    height: 1254,
    viewBox: '39 284 1176 761',
  },
  balloon: {
    url: new URL('../steady/props/steady_balloon_v2.webp', import.meta.url).href,
    width: 1254,
    height: 1254,
    viewBox: '177 92 901 1078',
  },
  magnet: {
    url: new URL('../steady/props/steady_magnet_v2.webp', import.meta.url).href,
    width: 1254,
    height: 1254,
    viewBox: '119 124 1016 995',
  },
  pad: {
    url: new URL('../steady/props/steady_pad_v2.webp', import.meta.url).href,
    width: 1536,
    height: 1024,
    viewBox: '44 366 1449 318',
  },
  shelf: {
    url: new URL('../steady/props/steady_shelf_v2.webp', import.meta.url).href,
    width: 1536,
    height: 1024,
    viewBox: '61 429 1414 203',
  },
} as const;
