const sprite = (url: string, width: number, height: number) => ({
  url,
  width,
  height,
});

export const REWRITE_ART = {
  characters: {
    deepseek: {
      idle: sprite(
        new URL('../rewrite/runtime/deepseek-idle.webp', import.meta.url).href,
        377,
        512,
      ),
      run: sprite(new URL('../rewrite/runtime/deepseek-run.webp', import.meta.url).href, 473, 512),
      shoot: sprite(
        new URL('../rewrite/runtime/deepseek-shoot.webp', import.meta.url).href,
        509,
        512,
      ),
    },
    gpt: {
      idle: sprite(new URL('../rewrite/runtime/gpt-idle.webp', import.meta.url).href, 415, 512),
      run: sprite(new URL('../rewrite/runtime/gpt-run.webp', import.meta.url).href, 501, 512),
      shoot: sprite(new URL('../rewrite/runtime/gpt-shoot.webp', import.meta.url).href, 512, 504),
    },
    claude: {
      idle: sprite(new URL('../rewrite/runtime/claude-idle.webp', import.meta.url).href, 405, 512),
      run: sprite(new URL('../rewrite/runtime/claude-run.webp', import.meta.url).href, 474, 512),
      shoot: sprite(
        new URL('../rewrite/runtime/claude-shoot.webp', import.meta.url).href,
        483,
        512,
      ),
    },
  },
  enemies: {
    walker: sprite(
      new URL('../rewrite/runtime/receipt-walker.webp', import.meta.url).href,
      512,
      481,
    ),
    turret: sprite(new URL('../rewrite/runtime/turret.webp', import.meta.url).href, 512, 372),
    bossShielded: sprite(
      new URL('../rewrite/runtime/boss-shielded.webp', import.meta.url).href,
      468,
      512,
    ),
    bossOpen: sprite(new URL('../rewrite/runtime/boss-open.webp', import.meta.url).href, 499, 512),
  },
  platform: sprite(new URL('../rewrite/runtime/platform.webp', import.meta.url).href, 512, 80),
  backgrounds: [
    new URL('../rewrite/runtime/level-1-background.webp', import.meta.url).href,
    new URL('../rewrite/runtime/level-2-background.webp', import.meta.url).href,
    new URL('../rewrite/runtime/level-3-background.webp', import.meta.url).href,
    new URL('../rewrite/runtime/level-4-background.webp', import.meta.url).href,
    new URL('../rewrite/runtime/level-5-background.webp', import.meta.url).href,
  ],
} as const;
