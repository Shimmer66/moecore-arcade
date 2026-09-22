const loaders = import.meta.glob<string>('../whale-queue/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export const WHALE_QUEUE_ASSET_FILES = {
  boardBackground: 'backgrounds/bg_board_data_sea.png',
  boardFrame: 'backgrounds/frame_board_outer.png',
  outerReef: 'board/decor_outer_reef.png',
  queueWhale: 'board/queue_whale.png',
  inspirationStar: 'board/item_inspiration_star.png',
  summaryShell: 'board/item_summary_shell.png',
  noiseReef: 'board/obstacle_noise_reef.png',
  playerUp: 'character/player_up_idle_00.png',
  playerRight: 'character/player_right_idle_00.png',
  playerDown: 'character/player_down_idle_00.png',
  playerLeft: 'character/player_left_idle_00.png',
  portraitNeutral: 'character/portrait_whalegirl_neutral.png',
  portraitDelighted: 'character/portrait_whalegirl_delighted.png',
  portraitThinking: 'character/portrait_whalegirl_thinking.png',
  portraitDizzy: 'character/portrait_whalegirl_dizzy.png',
  portraitProud: 'character/portrait_whalegirl_proud.png',
  thinkIcon: 'ui/ui_icon_deep_think.png',
  inspirationIcon: 'ui/ui_icon_inspiration_score.png',
  queueIcon: 'ui/ui_icon_queue_length.png',
  pauseIcon: 'ui/ui_icon_pause.png',
  restartIcon: 'ui/ui_icon_restart.png',
  directionUpIcon: 'ui/ui_icon_direction_up.png',
  collectSparkle: 'vfx/vfx_collect_sparkle.png',
  thinkingRing: 'vfx/vfx_thinking_ring.png',
  finishConfetti: 'vfx/vfx_finish_confetti.png',
  bump: 'vfx/vfx_bump.png',
  summaryRipple: 'vfx/vfx_summary_ripple.png',
} as const;

export type WhaleQueueAssetId = keyof typeof WHALE_QUEUE_ASSET_FILES;

function urlFor(file: string): string {
  const url = loaders[`../whale-queue/${file}`];
  if (!url) throw new Error(`Missing whale queue asset: ${file}`);
  return url;
}

export const WHALE_QUEUE_ASSETS = Object.fromEntries(
  Object.entries(WHALE_QUEUE_ASSET_FILES).map(([id, file]) => [id, urlFor(file)]),
) as Readonly<Record<WhaleQueueAssetId, string>>;

export function getWhaleQueueAsset(id: WhaleQueueAssetId): string {
  return WHALE_QUEUE_ASSETS[id];
}
