import type { Obstacle, ObstacleKind } from '../rules/types';

type Placement = readonly [number, ObstacleKind];
type Segment = { readonly from: number; readonly name: string; readonly sign: string };

export type LevelId = 0 | 1 | 2 | 3;
export interface LevelConfig {
  readonly name: string;
  readonly subtitle: string;
  readonly finishDistance: number;
  readonly answerDistance: number;
  readonly baseSpeed: number;
  readonly maxSpeed: number;
  readonly speedGain: number;
  readonly obstacles: readonly Placement[];
  readonly finalObstacles: readonly Placement[];
  readonly printers: readonly number[];
  readonly doubleShotPrinters: readonly number[];
  readonly queues: readonly number[];
  readonly queueAmplitude: number;
  readonly queueFrequency: number;
  readonly hallucinations: readonly number[];
  readonly segments: readonly Segment[];
}

export const levels: readonly LevelConfig[] = [
  {
    name: '白饭航线',
    subtitle: '饭要吃，答案也要送到',
    finishDistance: 600,
    answerDistance: 526,
    baseSpeed: 9.8,
    maxSpeed: 13.2,
    speedGain: 0.006,
    obstacles: [
      [32, 'ground'],
      [55, 'air'],
      [75, 'ground'],
      [118, 'ground'],
      [139, 'air'],
      [188, 'ground'],
      [212, 'air'],
      [316, 'ground'],
      [330, 'air'],
      [382, 'ground'],
      [397, 'air'],
      [462, 'ground'],
      [477, 'air'],
    ],
    finalObstacles: [
      [542, 'ground'],
      [546, 'ground'],
      [550, 'ground'],
      [554, 'ground'],
      [558, 'ground'],
    ],
    printers: [106, 166, 238, 430],
    doubleShotPrinters: [],
    queues: [266, 292, 366, 442],
    queueAmplitude: 1.4,
    queueFrequency: 1.7,
    hallucinations: [180, 306, 354, 478],
    segments: [
      { from: 0, name: '白饭补给海湾', sign: '先吃两口，再证明没白吃' },
      { from: 180, name: '回音礁入口', sign: '补充说明，支持原路退回' },
      { from: 360, name: '请求浅滩', sign: '队伍来了，别只顾着吃饭' },
      { from: 526, name: '答案灯塔', sign: '先交付，再开饭' },
    ],
  },
  {
    name: '回音礁',
    subtitle: '把废话打回原处',
    finishDistance: 650,
    answerDistance: 566,
    baseSpeed: 11.2,
    maxSpeed: 14.8,
    speedGain: 0.006,
    obstacles: [
      [34, 'ground'],
      [61, 'air'],
      [88, 'ground'],
      [132, 'air'],
      [158, 'ground'],
      [208, 'air'],
      [243, 'ground'],
      [288, 'air'],
      [328, 'ground'],
      [368, 'air'],
      [421, 'ground'],
      [461, 'air'],
      [514, 'ground'],
    ],
    finalObstacles: [
      [582, 'ground'],
      [586, 'ground'],
      [590, 'ground'],
      [594, 'ground'],
      [598, 'ground'],
      [629, 'air'],
      [642, 'ground'],
    ],
    printers: [104, 185, 269, 392, 489],
    doubleShotPrinters: [1, 3],
    queues: [311, 443],
    queueAmplitude: 1.4,
    queueFrequency: 1.7,
    hallucinations: [220, 347, 508],
    segments: [
      { from: 0, name: '回音礁', sign: '打印一页，就退回一页' },
      { from: 200, name: '纸团长廊', sign: '看准时机，尾巴回信' },
      { from: 400, name: '退订风暴', sign: '补充说明真的太多了' },
      { from: 566, name: '回音出口', sign: '停止补充，直接交付' },
      { from: 615, name: '交付验收门', sign: '先滑后跳，拒绝最后一次返工' },
    ],
  },
  {
    name: '请求漩涡',
    subtitle: '真假饭与移动队伍',
    finishDistance: 740,
    answerDistance: 650,
    baseSpeed: 12.2,
    maxSpeed: 16.2,
    speedGain: 0.006,
    obstacles: [
      [38, 'ground'],
      [66, 'air'],
      [94, 'ground'],
      [141, 'air'],
      [180, 'ground'],
      [219, 'air'],
      [257, 'ground'],
      [310, 'air'],
      [352, 'ground'],
      [391, 'air'],
      [437, 'ground'],
      [482, 'air'],
      [538, 'ground'],
      [585, 'air'],
    ],
    finalObstacles: [
      [666, 'ground'],
      [670, 'ground'],
      [674, 'ground'],
      [678, 'ground'],
      [682, 'ground'],
      [724, 'air'],
      [735, 'ground'],
    ],
    printers: [115, 281, 517],
    doubleShotPrinters: [],
    queues: [161, 235, 299, 371, 426, 496, 559],
    queueAmplitude: 2.3,
    queueFrequency: 2.2,
    hallucinations: [196, 336, 466, 603],
    segments: [
      { from: 0, name: '请求漩涡', sign: '队伍往返，别被卷进去' },
      { from: 220, name: '假饭迷流', sign: '问号饭先核验' },
      { from: 460, name: '排队深水', sign: '答案快到了，还得排队？' },
      { from: 650, name: '终点灯塔', sign: '满算力，冲出去' },
      { from: 706, name: '最终验收', sign: '交付不等于躺赢：滑过去，再跳起来' },
    ],
  },
  {
    name: '无限航线',
    subtitle: '没有终点，跑到撑不住',
    finishDistance: Number.MAX_SAFE_INTEGER,
    answerDistance: Number.MAX_SAFE_INTEGER,
    baseSpeed: 10.4,
    maxSpeed: 18,
    speedGain: 0.003,
    obstacles: [],
    finalObstacles: [],
    printers: [],
    doubleShotPrinters: [],
    queues: [],
    queueAmplitude: 1.7,
    queueFrequency: 2,
    hallucinations: [],
    segments: [
      { from: 0, name: '无限航线', sign: '跑得越远，分数越高' },
      { from: 600, name: '远洋区', sign: '速度还在涨，别分心' },
      { from: 1200, name: '深水区', sign: '尾巴满电就冲出去' },
    ],
  },
];

export const levelFor = (id: LevelId): LevelConfig => levels[id]!;
export const SHIFT_DISTANCE = levels[0]!.finishDistance;
export const ANSWER_DISTANCE = levels[0]!.answerDistance;

export function shiftSpeed(distance: number, levelId: LevelId = 0): number {
  const level = levelFor(levelId);
  return Math.min(level.maxSpeed, level.baseSpeed + distance * level.speedGain);
}

export function departmentAt(distance: number, levelId: LevelId = 0): Segment {
  const segments = levelFor(levelId).segments;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (distance >= segments[index]!.from) return segments[index]!;
  }
  return segments[0]!;
}

export function shiftObstacles(seed: number, levelId: LevelId = 0): Obstacle[] {
  const level = levelFor(levelId);
  const offset = (seed % 3) - 1;
  return [
    ...level.obstacles.map(([x, kind], id) => ({ id, kind, x: x + offset })),
    ...level.finalObstacles.map(([x, kind], index) => ({ id: 100 + index, x, kind })),
  ];
}
