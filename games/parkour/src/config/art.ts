export const character = { name: 'DeepSeek 娘', color: '#3887ae' } as const;

export const runFrames = [
  'char_run_01',
  'char_run_02',
  'char_run_03',
  'char_run_04',
  'char_run_05',
  'char_run_06',
  'char_run_07',
  'char_run_08',
] as const;

export const officeAssetIds = [
  'char_idle_01',
  ...runFrames,
  'char_jump_takeoff',
  'char_jump_apex',
  'char_jump_fall',
  'char_slide_enter',
  'char_slide_hold',
  'char_hit_01',
  'char_hit_02',
  'char_fail_02',
  'char_win_03',
  'portrait_neutral',
  'portrait_confident',
  'portrait_defensive',
  'portrait_guilty',
  'portrait_startled',
  'portrait_thinking',
  'portrait_facepalm',
  'portrait_happy',
  'portrait_receipt',
  'bg_far',
  'bg_mid',
  'decor_desk',
  'decor_plant',
  'decor_water',
  'tile_ground_mid',
  'exit_closed',
  'exit_open',
  'obstacle_docs_small',
  'obstacle_docs_large',
  'obstacle_beam',
  'obstacle_docs_broken',
  'printer_idle',
  'printer_warning',
  'printer_fire',
  'projectile_paper',
  'pickup_bubble',
  'fx_whale_loop',
  'fx_think_aura',
  'fx_collect_pop',
  'fx_hit_star',
  'particle_paper',
] as const;

export type Pose = 'idle' | 'run' | 'jump' | 'slide' | 'dash' | 'hurt' | 'fail' | 'win';
export function poseId(pose: Pose, tick: number, velocity: number, reduceMotion: boolean): string {
  if (pose === 'run' || pose === 'dash')
    return runFrames[reduceMotion ? 0 : Math.floor(tick / 6) % runFrames.length]!;
  if (pose === 'jump')
    return velocity > 2 ? 'char_jump_takeoff' : velocity < -2 ? 'char_jump_fall' : 'char_jump_apex';
  return {
    idle: 'char_idle_01',
    slide: 'char_slide_hold',
    hurt: 'char_hit_01',
    fail: 'char_fail_02',
    win: 'char_win_03',
  }[pose];
}
