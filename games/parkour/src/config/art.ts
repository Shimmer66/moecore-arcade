export const runners = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    color: '#327aab',
    poses: { idle: 1, run: 5, jump: 12, slide: 16, dash: 18, hurt: 20 },
  },
  {
    id: 'glm',
    name: 'GLM',
    color: '#595478',
    poses: { idle: 1, run: 5, jump: 12, slide: 17, dash: 19, hurt: 21 },
  },
  {
    id: 'gpt',
    name: 'GPT',
    color: '#9069a9',
    poses: { idle: 1, run: 5, jump: 12, slide: 16, dash: 18, hurt: 20 },
  },
  {
    id: 'claude',
    name: 'Claude',
    color: '#bc6645',
    poses: { idle: 1, run: 9, jump: 11, slide: 17, dash: 19, hurt: 21 },
  },
] as const;

export type Runner = (typeof runners)[number];
export type Pose = keyof Runner['poses'];
export const poseId = (runner: Runner, pose: Pose): string =>
  `${runner.id}_pose_${String(runner.poses[pose]).padStart(3, '0')}`;

export const scenicIds = [
  'terrain_001',
  'terrain_002',
  'terrain_004',
  'terrain_029',
  'terrain_030',
  'terrain_031',
  'terrain_037',
  'terrain_039',
  'terrain_040',
  'obstacles_enemies_006',
  'obstacles_enemies_001',
  'obstacles_enemies_011',
  'obstacles_enemies_008',
  'obstacles_enemies_016',
  'items_001',
  'items_005',
  'items_020',
  'items_022',
  'items_023',
  'effects_009',
] as const;

export const pickupArt = {
  coin: 'items_001',
  star: 'items_005',
  magnet: 'items_022',
  shield: 'items_023',
  heart: 'items_020',
} as const;
