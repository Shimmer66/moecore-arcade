import { CAMPAIGN } from './campaign';

export interface CampaignDoor {
  id: string;
  title: string;
  rooms: number[];
  finale: boolean;
}
export interface CampaignWorld {
  id: string;
  title: string;
  doors: CampaignDoor[];
}
function roomIndex(id: string): number {
  const index = CAMPAIGN.findIndex((room) => room.id === id);
  if (index < 0) throw new Error(`Missing campaign finale: ${id}`);
  return index;
}
function world(
  id: string,
  title: string,
  start: number,
  titles: string[],
  finaleId: string,
  extraDoor?: { title: string; ids: string[] },
): CampaignWorld {
  return {
    id,
    title,
    doors: [
      ...titles.map((title, door) => ({
        id: `${id}-${door + 1}`,
        title,
        rooms: Array.from({ length: 5 }, (_, stage) => start + door * 5 + stage),
        finale: false,
      })),
      ...(extraDoor
        ? [
            {
              id: `${id}-extra`,
              title: extraDoor.title,
              rooms: extraDoor.ids.map(roomIndex),
              finale: false,
            },
          ]
        : []),
      { id: `${id}-finale`, title: '世界组合评测', rooms: [roomIndex(finaleId)], finale: true },
    ],
  };
}
export const WORLDS = [
  world('hallucination', '幻觉世界', 0, ['幻觉入门', '上下文危机', '推理加速'], 'world-one-review'),
  world('parameters', '参数世界', 15, ['对齐现场', '垂直领域', '参数实验室'], 'world-two-review'),
  world('protocols', '协议世界', 30, ['工具链', '发布验收', '特殊协议'], 'one-more-thing', {
    title: '落点预测',
    ids: [
      'ephemeral-answer',
      'landing-prediction',
      'landing-invoice',
      'two-contexts',
      'adaptive-trap',
    ],
  }),
];
export const MAIN_ROUTE = WORLDS.flatMap((world) => world.doors.flatMap((door) => door.rooms));
export function journeyPosition(index: number) {
  for (const [worldIndex, world] of WORLDS.entries()) {
    for (const [doorIndex, door] of world.doors.entries()) {
      const stage = door.rooms.indexOf(index);
      if (stage >= 0)
        return { world, worldIndex, door, doorIndex, stage, overall: MAIN_ROUTE.indexOf(index) };
    }
  }
  throw new Error(`Room is outside the main journey: ${index}`);
}
export function nextJourneyRoom(index: number): number | null {
  const position = MAIN_ROUTE.indexOf(index);
  return position >= 0 ? (MAIN_ROUTE[position + 1] ?? null) : null;
}
