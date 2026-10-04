export const STARDUST_ART = {
  crusadersLineup: new URL('../stardust/concept/stardust-crusaders-lineup-v6.png', import.meta.url)
    .href,
  fighters: {
    jotaro: new URL('../stardust/fighters/jotaro-star-platinum-v1.png', import.meta.url).href,
    kakyoin: new URL('../stardust/fighters/kakyoin-hierophant-green-v1.png', import.meta.url).href,
    avdol: new URL('../stardust/fighters/avdol-magicians-red-v1.png', import.meta.url).href,
    polnareff: new URL('../stardust/fighters/polnareff-silver-chariot-v1.png', import.meta.url)
      .href,
  },
} as const;
