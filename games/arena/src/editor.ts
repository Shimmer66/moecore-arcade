import { validateCampaign, type Room } from './campaign';
import type { Rect, Trap, TrapEffect } from './traps';

export const EDITOR_KEY = 'arena-editor-v1';
export const EFFECT_NAMES: Record<TrapEffect, string> = {
  pit: '地洞',
  spikes: '尖刺',
  falling: '落块',
  exit: '移动出口',
  reverse: '反向控制',
  gravity: '反重力',
  saw: '巡逻锯',
  gate: '限流闸门',
  platform: '移动平台',
  decoy: '假出口',
  ice: '惯性地面',
  lowJump: '低跳',
  bounce: '弹射板',
  wind: '逆风',
  wall: '移动墙',
  airJump: '空中连跳',
  jetpack: '喷射推进',
  mine: '爆炸灵感',
  seeker: '追踪弹',
};
export function newDraft(): Room {
  return {
    id: 'custom-room',
    chapter: '玩家工坊',
    title: '我的生成事故',
    promise: '这次由我来设计。',
    spawn: { x: 50, y: 306 },
    exit: { x: 920, y: 292, w: 64, h: 62 },
    secret: { x: 500, y: 220 },
    floors: [{ x: 0, y: 354, w: 1000, h: 86 }],
    traps: [],
  };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('关卡数据格式不正确。');
  return value as Record<string, unknown>;
}
function num(value: unknown, low: number, high: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high)
    throw new Error(`数值必须在 ${low}–${high} 之间。`);
  return value;
}
function text(value: unknown, limit: number): string {
  if (typeof value !== 'string' || value.length > limit)
    throw new Error('关卡文字格式或长度不正确。');
  return value;
}
function rect(value: unknown, width = 1000): Rect {
  const raw = object(value);
  return {
    x: num(raw.x, -100, width + 100),
    y: num(raw.y, -100, 500),
    w: num(raw.w, 4, width + 200),
    h: num(raw.h, 4, 600),
  };
}
export function normalizeRoom(value: unknown): Room {
  const raw = object(value);
  const width = raw.width === undefined ? 1000 : num(raw.width, 1000, 5000);
  if (
    !Array.isArray(raw.floors) ||
    raw.floors.length > 80 ||
    !Array.isArray(raw.traps) ||
    raw.traps.length > 40
  )
    throw new Error('最多放置80块地形和40个机关。');
  const spawn = object(raw.spawn),
    secret = object(raw.secret);
  if (
    raw.cloneSpawns !== undefined &&
    (!Array.isArray(raw.cloneSpawns) || raw.cloneSpawns.length > 3)
  )
    throw new Error('最多放置3个分身。');
  const cloneSpawns = ((raw.cloneSpawns ?? []) as unknown[]).map((value) => {
    const position = object(value);
    return { x: num(position.x, 0, width - 32), y: num(position.y, -48, 392) };
  });
  let secretTravel: Room['secretTravel'];
  if (raw.secretTravel !== undefined) {
    const motion = object(raw.secretTravel);
    secretTravel = {
      x: num(motion.x, -500, 500),
      y: num(motion.y, -300, 300),
      ticks: num(motion.ticks, 1, 3600),
      loop: motion.loop === true,
    };
  }
  const traps: Trap[] = raw.traps.map((value) => {
    const item = object(value);
    const effect = text(item.effect, 20) as TrapEffect;
    if (!Object.prototype.hasOwnProperty.call(EFFECT_NAMES, effect))
      throw new Error('未知机关类型。');
    const trap: Trap = {
      id: text(item.id, 60),
      effect,
      body: rect(item.body, width),
      trigger: rect(item.trigger, width),
      delay: num(item.delay, 0, 3600),
      line: text(item.line, 120),
    };
    if (item.duration !== undefined) trap.duration = num(item.duration, 1, 3600);
    if (item.after !== undefined) trap.after = text(item.after, 60);
    if (item.rearm !== undefined) trap.rearm = item.rearm === true;
    if (item.initiallyActive !== undefined) trap.initiallyActive = item.initiallyActive === true;
    if (item.triggerOn !== undefined) {
      if (!['jump', 'land', 'left', 'right'].includes(String(item.triggerOn)))
        throw new Error('触发动作不正确。');
      trap.triggerOn = item.triggerOn as 'jump' | 'land' | 'left' | 'right';
    }
    if (item.travel !== undefined) {
      const motion = object(item.travel);
      trap.travel = {
        x: num(motion.x, -width, width),
        y: num(motion.y, -500, 500),
        ticks: num(motion.ticks, 1, 3600),
        loop: motion.loop === true,
      };
    }
    if (item.cycle !== undefined) {
      const cycle = object(item.cycle);
      trap.cycle = { active: num(cycle.active, 1, 3600), rest: num(cycle.rest, 1, 3600) };
    }
    return trap;
  });
  return {
    id: 'custom-room',
    chapter: '玩家工坊',
    title: text(raw.title, 40),
    promise: text(raw.promise, 120),
    ...(width !== 1000 ? { width } : {}),
    spawn: { x: num(spawn.x, 0, width - 32), y: num(spawn.y, -48, 392) },
    exit: rect(raw.exit, width),
    secret: { x: num(secret.x, 0, width), y: num(secret.y, 0, 440) },
    floors: raw.floors.map((floor) => rect(floor, width)),
    traps,
    ...(cloneSpawns.length ? { cloneSpawns } : {}),
    ...(secretTravel ? { secretTravel } : {}),
    ...(raw.secretGrowth !== undefined ? { secretGrowth: num(raw.secretGrowth, 0, 30) } : {}),
  };
}
export function editorProblem(room: Room): string {
  try {
    const normalized = normalizeRoom(room);
    validateCampaign([normalized]);
    if (
      normalized.exit.x < 0 ||
      normalized.exit.x + normalized.exit.w > (normalized.width ?? 1000) ||
      normalized.exit.y < 0 ||
      normalized.exit.y + normalized.exit.h > 440
    )
      return '出口需要完整放在画面内。';
    if (!normalized.title.trim()) return '请填写关卡名称。';
    return '';
  } catch (error) {
    const message = error instanceof Error ? error.message : '关卡数据无效。';
    if (message.includes('Unsupported spawn')) return '起点脚下需要有地形。';
    if (/dependency|Duplicate trap/.test(message)) return '机关编号或触发依赖不正确。';
    return message;
  }
}
export function encodeRoom(room: Room): string {
  return JSON.stringify({ format: 'moecore-arena-room', version: 1, room: normalizeRoom(room) });
}
export function decodeRoom(code: string): Room {
  if (code.length > 64000) throw new Error('关卡代码过长。');
  let raw: Record<string, unknown>;
  try {
    raw = object(JSON.parse(code));
  } catch {
    throw new Error('无法读取关卡代码。');
  }
  if (raw.format !== 'moecore-arena-room' || raw.version !== 1)
    throw new Error('不支持这个关卡版本。');
  return normalizeRoom(raw.room);
}
export function saveDraft(room: Room, verified = false): boolean {
  try {
    const code = encodeRoom(room);
    const old = loadDraft();
    localStorage.setItem(
      EDITOR_KEY,
      JSON.stringify({
        code,
        verified: verified || old.verified === code ? code : null,
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function loadDraft(): { room: Room; verified: string | null } {
  try {
    const saved = object(JSON.parse(localStorage.getItem(EDITOR_KEY) ?? 'null'));
    const code = text(saved.code, 64000);
    return { room: decodeRoom(code), verified: saved.verified === code ? code : null };
  } catch {
    return { room: newDraft(), verified: null };
  }
}
export function createTrap(
  effect: TrapEffect,
  x: number,
  y: number,
  id: string,
  width = 1000,
): Trap {
  const trap: Trap = {
    id,
    effect,
    body: { x, y, w: 60, h: 30 },
    trigger: { x: Math.max(0, x - 130), y: 0, w: 120, h: 440 },
    delay: 12,
    line: '我只加了一点小改动。',
  };
  if (effect === 'mine') {
    trap.body = { x, y: Math.min(390, y), w: 24, h: 24 };
    trap.trigger = { ...trap.body };
    trap.delay = 20;
    trap.duration = 12;
  } else if (effect === 'seeker') {
    trap.body = { x, y, w: 24, h: 24 };
    trap.delay = 30;
    trap.duration = 240;
  } else if (effect === 'pit') trap.body = { x, y: 354, w: 100, h: 86 };
  else if (effect === 'spikes') trap.body.y = 324;
  else if (effect === 'gate') {
    trap.body = { x, y: 100, w: 26, h: 254 };
    trap.cycle = { active: 90, rest: 70 };
  } else if (effect === 'saw') {
    trap.body = { x, y: 310, w: 44, h: 44 };
    trap.travel = { x: 80, y: 0, ticks: 80, loop: true };
  } else if (effect === 'falling') {
    trap.body = { x, y: 70, w: 80, h: 50 };
    trap.travel = { x: 0, y: 320, ticks: 30 };
  } else if (effect === 'wall') {
    trap.body = { x, y: 174, w: 40, h: 180 };
    trap.travel = { x: -80, y: 0, ticks: 100, loop: true };
  } else if (effect === 'platform') {
    trap.body = { x, y, w: 140, h: 20 };
    trap.travel = { x: 180, y: 0, ticks: 120, loop: true };
  } else if (effect === 'decoy' || effect === 'exit') {
    trap.body = { x, y: 292, w: 64, h: 62 };
    if (effect === 'exit') trap.travel = { x: -Math.min(600, x), y: 0, ticks: 40 };
  } else if (effect === 'bounce') trap.body = { x, y: 346, w: 80, h: 10 };
  else {
    trap.body = { x, y: 0, w: Math.min(300, width - x), h: 440 };
    if (effect === 'gravity' || effect === 'reverse') {
      trap.duration = 120;
      trap.rearm = true;
    }
  }
  return trap;
}
