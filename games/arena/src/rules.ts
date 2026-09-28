export const WORLD_WIDTH = 1000;
export const FLOOR = 354;
export const PLAYER_W = 32;
export const PLAYER_H = 48;
export const STEP_MS = 1000 / 60;
export type Glitch = 'waiting' | 'warning' | 'active' | 'fixed';
export type Phase = 'ready' | 'playing' | 'rescue' | 'clear' | 'done';
export interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'floor' | 'bridge' | 'step' | 'ceiling';
}
export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: number;
}
export interface Input {
  horizontal: number;
  jump: boolean;
}
export interface State {
  level: number;
  phase: Phase;
  player: Player;
  safe: { x: number; y: number };
  stars: boolean[];
  bankedStars: number;
  glitch: Glitch;
  warning: number;
  eventTicks: number;
  elapsedMs: number;
  corrections: number;
  rescues: number;
  accidents: number;
}
export const LEVELS = [
  {
    title: '这桥，包结实的',
    subtitle: 'AI 保证前方已经铺好了路。',
    warning: '前面没路？包的，我给你生成一座桥。',
    active: '检测结果：桥存在于我的想象中。',
    fixed: '好吧，实体桥确实更实用。',
    clear: '你把“想象中的桥”变成了一条能走的路。',
    stars: [
      { x: 190, y: 312 },
      { x: 440, y: 312 },
      { x: 800, y: 247 },
    ],
  },
  {
    title: '向上发展，物理意义上',
    subtitle: '她觉得走路太慢，决定帮你一把。',
    warning: '走路太慢。我替你优化一下重力。',
    active: '现在，所有事情都在向上发展。',
    fixed: '已撤回过度积极的发展方向。',
    clear: '你顺势捡到了灵感，也找回了脚踏实地的感觉。',
    stars: [
      { x: 175, y: 310 },
      { x: 540, y: 125 },
      { x: 825, y: 310 },
    ],
  },
  {
    title: '地板也是上下文吗',
    subtitle: '一边往前跑，一边保住脚下的世界。',
    warning: '上下文太长了。我压缩一下不重要的信息。',
    active: '地板……原来也是重要信息？',
    fixed: '地板已恢复。这次我记住了。',
    clear: '你保住了地板，也保住了她最后一点体面。',
    stars: [
      { x: 185, y: 308 },
      { x: 510, y: 238 },
      { x: 820, y: 276 },
    ],
  },
] as const;
export function createState(): State {
  return {
    level: 0,
    phase: 'ready',
    player: { x: 60, y: FLOOR - PLAYER_H, vx: 0, vy: 0, grounded: true, facing: 1 },
    safe: { x: 60, y: FLOOR - PLAYER_H },
    stars: [false, false, false],
    bankedStars: 0,
    glitch: 'waiting',
    warning: 0,
    eventTicks: 0,
    elapsedMs: 0,
    corrections: 0,
    rescues: 0,
    accidents: 0,
  };
}
export function start(s: State): State {
  return s.phase === 'ready' ? { ...s, phase: 'playing' } : s;
}
export function collected(s: State): number {
  return s.stars.filter(Boolean).length;
}
export function floorEdge(s: State): number {
  return s.level === 2 && s.glitch === 'active' ? Math.min(930, s.eventTicks * 2.7) : 0;
}
export function platforms(s: State): Platform[] {
  if (s.level === 0)
    return [
      { x: 0, y: FLOOR, w: 330, h: 86, kind: 'floor' },
      ...(s.glitch === 'active'
        ? []
        : [{ x: 330, y: FLOOR, w: 240, h: 24, kind: 'bridge' } as Platform]),
      { x: 570, y: FLOOR, w: 430, h: 86, kind: 'floor' },
      { x: 715, y: 290, w: 150, h: 18, kind: 'step' },
    ];
  if (s.level === 1)
    return [
      { x: 0, y: FLOOR, w: 1000, h: 86, kind: 'floor' },
      { x: 260, y: 65, w: 490, h: 22, kind: 'ceiling' },
    ];
  const edge = floorEdge(s);
  const tiles = Array.from({ length: 10 }, (_, i) => ({
    x: i * 100,
    y: FLOOR,
    w: 96,
    h: 86,
    kind: 'floor' as const,
  })).filter((p) => p.x + p.w > edge && !(s.glitch === 'active' && (p.x === 600 || p.x === 800)));
  return [
    ...tiles,
    { x: 415, y: 280, w: 180, h: 18, kind: 'step' },
    { x: 750, y: 320, w: 140, h: 16, kind: 'step' },
  ];
}
export function undo(s: State): State {
  if (s.phase !== 'playing' && s.phase !== 'rescue') return s;
  if (s.phase !== 'rescue' && s.glitch !== 'active') return s;
  const falling = s.phase === 'rescue' || s.player.y > FLOOR - PLAYER_H + 20;
  return {
    ...s,
    phase: 'playing',
    glitch: s.glitch === 'active' ? 'fixed' : s.glitch,
    warning: 0,
    corrections: s.corrections + Number(s.glitch === 'active'),
    rescues: s.rescues + Number(falling),
    player: falling
      ? { ...s.player, ...s.safe, vx: 0, vy: 0, grounded: true }
      : { ...s.player, vy: 0, grounded: false },
  };
}
export function nextLevel(s: State): State {
  if (s.phase !== 'clear') return s;
  if (s.level === 2) return { ...s, phase: 'done' };
  const fresh = createState();
  return {
    ...fresh,
    level: s.level + 1,
    phase: 'playing',
    bankedStars: s.bankedStars + collected(s),
    elapsedMs: s.elapsedMs,
    corrections: s.corrections,
    rescues: s.rescues,
    accidents: s.accidents,
  };
}
export function step(s: State, input: Input): State {
  if (s.phase !== 'playing') return s;
  const p = { ...s.player };
  let next: State = { ...s, player: p, elapsedMs: s.elapsedMs + STEP_MS };
  if (next.glitch === 'waiting' && p.x >= 245) next = { ...next, glitch: 'warning', warning: 55 };
  else if (next.glitch === 'warning') {
    next = { ...next, warning: next.warning - 1 };
    if (next.warning <= 0)
      next = { ...next, glitch: 'active', eventTicks: 0, accidents: next.accidents + 1 };
  }
  if (next.glitch === 'active') next = { ...next, eventTicks: next.eventTicks + 1 };
  const inverted = next.level === 1 && next.glitch === 'active';
  const g = inverted ? -1 : 1;
  const horizontal = Number.isFinite(input.horizontal)
    ? Math.max(-1, Math.min(1, input.horizontal))
    : 0;
  p.vx = horizontal * 4.5;
  if (horizontal) p.facing = Math.sign(horizontal);
  if (input.jump && p.grounded) {
    p.vy = -11.5 * g;
    p.grounded = false;
  }
  const oldY = p.y;
  p.vy = Math.max(-12, Math.min(12, p.vy + 0.48 * g));
  p.x = Math.max(0, Math.min(WORLD_WIDTH - PLAYER_W, p.x + p.vx));
  p.y += p.vy;
  p.grounded = false;
  for (const plat of platforms(next)) {
    if (p.x + PLAYER_W <= plat.x || p.x >= plat.x + plat.w) continue;
    if (p.vy >= 0 && oldY + PLAYER_H <= plat.y + 1 && p.y + PLAYER_H >= plat.y) {
      p.y = plat.y - PLAYER_H;
      p.vy = 0;
      p.grounded = !inverted;
    } else if (p.vy < 0 && oldY >= plat.y + plat.h - 1 && p.y <= plat.y + plat.h) {
      p.y = plat.y + plat.h;
      p.vy = 0;
      p.grounded = inverted;
    }
  }
  if (p.y < 15) {
    p.y = 15;
    p.vy = 0;
    p.grounded = inverted;
  }
  const stars = next.stars.map(
    (found, i) =>
      found ||
      Math.hypot(
        p.x + PLAYER_W / 2 - LEVELS[next.level]!.stars[i]!.x,
        p.y + PLAYER_H / 2 - LEVELS[next.level]!.stars[i]!.y,
      ) < 42,
  );
  next = { ...next, stars };
  if (p.grounded && !inverted && next.glitch !== 'active')
    next = { ...next, safe: { x: p.x, y: p.y } };
  if (p.y > 400) return { ...next, phase: 'rescue' };
  if (p.x > 915 && p.y > 260 && collected(next) >= 2)
    return { ...next, phase: 'clear', player: { ...p, vx: 0, vy: 0 } };
  return next;
}
