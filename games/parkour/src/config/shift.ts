import type { Obstacle } from '../rules/types';

export const SHIFT_DISTANCE = 480;
export const ANSWER_DISTANCE = 406;
export const shiftSpeed = (distance: number) => Math.min(10.2, 7.4 + distance * 0.007);

export const departments = [
  { from: 0, name: '食堂分部', sign: '正在思考……中午吃什么' },
  { from: 78, name: '补充说明科', sign: '废话包邮 · 支持原路退回' },
  { from: 250, name: '服务器排队区', sign: '服务器繁忙，队伍本人来了' },
  { from: ANSWER_DISTANCE, name: '交付出口', sign: '先把能玩的给你' },
] as const;

export function departmentAt(distance: number) {
  for (let index = departments.length - 1; index >= 0; index -= 1) {
    const department = departments[index]!;
    if (distance >= department.from) return department;
  }
  return departments[0];
}

export function shiftObstacles(seed: number): Obstacle[] {
  // Seeded offsets preserve the recovery gaps and authored printer encounters.
  const offset = (seed % 3) - 1;
  const ordinary: readonly [number, 'ground' | 'air'][] = [
    [22, 'ground'],
    [44, 'air'],
    [64, 'ground'],
    [118, 'ground'],
    [139, 'air'],
    [188, 'ground'],
    [212, 'air'],
    [316, 'ground'],
    [340, 'air'],
  ];
  return [
    ...ordinary.map(([x, kind], id) => ({ id, kind, x: x + offset })),
    ...[422, 426, 430, 434, 438].map((x, index) => ({
      id: 100 + index,
      x,
      kind: 'ground' as const,
    })),
  ];
}
