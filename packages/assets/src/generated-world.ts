export const GENERATED_WORLD_ART = {
  deepseekIdle: {
    url: new URL('../generated-world/first-batch/deepseek-idle.webp', import.meta.url).href,
    width: 1254,
    height: 1254,
    anchorX: 760,
    baseline: 1230,
    visibleHeight: 1205,
  },
  deepseekRun: {
    url: new URL('../generated-world/first-batch/deepseek-run.webp', import.meta.url).href,
    width: 1254,
    height: 1254,
    anchorX: 760,
    baseline: 1220,
    visibleHeight: 1173,
  },
  background: new URL('../generated-world/first-batch/bg-floating-islands.webp', import.meta.url)
    .href,
  platform: {
    url: new URL('../generated-world/first-batch/platform.webp', import.meta.url).href,
    width: 2172,
    height: 724,
    viewBox: '19 274 2135 271',
  },
  bridge: {
    url: new URL('../generated-world/first-batch/bridge.webp', import.meta.url).href,
    width: 2172,
    height: 724,
    viewBox: '25 297 2123 178',
  },
} as const;
