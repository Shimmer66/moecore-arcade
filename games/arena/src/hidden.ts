import type { Room } from './campaign';
import type { RoomRunner } from './runner';

export const hiddenReplay = { pending: false };

export const DISCOVERIES = [
  { id: 'return-context', name: '回溯密钥', hint: '带着灵感，看看刚才消失的路。' },
  { id: 'beyond-context', name: '越界密钥', hint: '向上发展时，边界之外是什么？' },
  { id: 'false-confidence', name: '置信密钥', hint: '拿到证据之后，再检验那个自信的出口。' },
] as const;
export type DiscoveryId = (typeof DISCOVERIES)[number]['id'];
export function discoveryFor(run: RoomRunner): DiscoveryId | null {
  if (run.phase !== 'dead') return null;
  if (run.room.id === 'hallucination' && run.secret && run.deathTrap === 'pit')
    return 'return-context';
  if (run.room.id === 'upward' && run.rect.y < -100) return 'beyond-context';
  if (run.room.id === 'confident-link' && run.secret && run.deathTrap === 'decoy')
    return 'false-confidence';
  return null;
}
export function hiddenUnlocked(keys: readonly string[]): boolean {
  return DISCOVERIES.every((key) => keys.includes(key.id));
}
export const HIDDEN_ROOM: Room = {
  id: 'hidden-protocol',
  chapter: '隐藏协议',
  title: '双重确认',
  promise: '这次需要两个我都同意。',
  spawn: { x: 50, y: 306 },
  cloneSpawns: [{ x: 140, y: 306 }],
  exit: { x: 920, y: 292, w: 64, h: 62 },
  secret: { x: 500, y: 220 },
  floors: [{ x: 0, y: 354, w: 1000, h: 86 }],
  traps: [
    {
      id: 'consensus-gap',
      effect: 'pit',
      trigger: { x: 160, y: 0, w: 120, h: 440 },
      body: { x: 360, y: 354, w: 80, h: 86 },
      delay: 12,
      line: '一个答案通过，不代表所有副本通过。',
    },
    {
      id: 'consensus-gate',
      effect: 'gate',
      trigger: { x: 650, y: 0, w: 130, h: 440 },
      body: { x: 840, y: 100, w: 26, h: 254 },
      delay: 0,
      cycle: { active: 80, rest: 80 },
      line: '请让每一个副本完成确认。',
    },
  ],
};
