const actionAtlas = new URL('../generated-world/deepseek-actions/atlas.png', import.meta.url).href;
function actionFrame(
  x: number,
  y: number,
  width: number,
  height: number,
  anchorX: number,
  baseline: number,
) {
  return {
    url: actionAtlas,
    width,
    height,
    anchorX,
    baseline,
    visibleHeight: 665,
    sourceWidth: 1254,
    sourceHeight: 1254,
    crop: `${x} ${y} ${width} ${height}`,
  };
}
export const GENERATED_WORLD_ART = {
  deepseekJump: actionFrame(0, 0, 670, 695, 425, 678),
  deepseekFall: actionFrame(670, 0, 584, 695, 360, 652),
  deepseekLand: actionFrame(0, 695, 670, 559, 425, 535),
  deepseekDefeat: actionFrame(670, 695, 584, 559, 345, 535),
  parameterLab: new URL('../generated-world/parameter-lab/background.png', import.meta.url).href,
  serverArchive: new URL('../generated-world/server-archive/background.png', import.meta.url).href,
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
