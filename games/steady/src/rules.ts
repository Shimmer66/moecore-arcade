export type Tool = 'pad' | 'magnet' | 'balloon' | 'pot';
export type Side = 'floor' | 'ceiling';
export interface Point {
  x: number;
  y: number;
}
export interface Prop extends Point {
  id: number;
  tool: Tool;
  angle: number;
  attach: number | null;
  fixed?: boolean;
}
export interface Layout {
  levelId: string;
  props: Prop[];
  side: Side;
  allPots: boolean;
  nextId: number;
}
export interface Body extends Point {
  id: number;
  type: 'user' | 'pot';
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  metal: boolean;
  balloons: number;
  caught: boolean;
  contact: number;
}
export interface Scene {
  phase: 'running' | 'success' | 'failed';
  time: number;
  bodies: Body[];
  cut: boolean;
  powered: boolean;
  bounces: number;
  magnetic: boolean;
  floated: boolean;
  message: string;
  trail: Point[];
  trailIn: number;
  caughtPots: number;
  actions: number;
}
export const WIDTH = 640;
export const HEIGHT = 610;
export const STEP = 1 / 120;
export const USER = { x: 125, y: 118 };
export const GOAL_X = 531;
export const SHELF = { x: 268, y: 332, width: 120 };
export const LIMITS: Record<Tool, number> = { pad: 2, magnet: 1, balloon: 2, pot: 3 };
export const TOOL_NAMES: Record<Tool, string> = {
  pad: '蹦床',
  magnet: '磁铁',
  balloon: '气球',
  pot: '锅',
};
export const TOOL_COST: Record<Tool, number> = { pad: 2, balloon: 1, pot: 1, magnet: 3 };
export interface Challenge {
  id: string;
  title: string;
  brief: string;
  tip: string;
  limits: Record<Tool, number>;
  budget: number;
  parItems: number;
  parActions: number;
  side: Side;
  allPots: boolean;
  wind: number;
  goalWidth: number;
  objective: 'catch' | 'magnetic' | 'float' | 'cut' | 'all-pots';
  fixtures: Prop[];
}
export const CHALLENGES: readonly Challenge[] = [
  {
    id: 'bounce',
    title: '先借你一张床',
    brief: '只用一张蹦床，把用户送到右边。',
    tip: '水平的床只会原地弹。试着转动床面，让反弹指向 GPT。',
    limits: { pad: 1, magnet: 0, balloon: 0, pot: 0 },
    budget: 2,
    parItems: 1,
    parActions: 0,
    side: 'floor',
    allPots: false,
    wind: 0,
    goalWidth: 70,
    objective: 'catch',
    fixtures: [],
  },
  {
    id: 'magnetic',
    title: '锅替你赶路',
    brief: '用磁铁拉着戴锅的用户，送到地面接应点。',
    tip: '磁铁不会吸人。先把锅放到用户头上，再调整磁铁的位置。必要时断电，让惯性接班。',
    limits: { pad: 0, magnet: 1, balloon: 0, pot: 1 },
    budget: 4,
    parItems: 2,
    parActions: 0,
    side: 'floor',
    allPots: false,
    wind: 0,
    goalWidth: 70,
    objective: 'magnetic',
    fixtures: [],
  },
  {
    id: 'sky',
    title: '你怎么往上掉',
    brief: '让气球参与救援，送到天花板上的 GPT 手里。',
    tip: '气球往上拉，磁铁拉锅。可以先稳妥地绑两只气球，再挑战减少一件道具。',
    limits: { pad: 0, magnet: 1, balloon: 2, pot: 1 },
    budget: 6,
    parItems: 3,
    parActions: 0,
    side: 'ceiling',
    allPots: false,
    wind: 0,
    goalWidth: 70,
    objective: 'float',
    fixtures: [],
  },
  {
    id: 'let-go',
    title: '画的饼该放下了',
    brief: '借气球和穿堂风越过桌子，再剪绳落进接应区。',
    tip: '风一直往右吹。别等到正上方才剪绳，身体还会继续向右走。',
    limits: { pad: 1, magnet: 0, balloon: 2, pot: 0 },
    budget: 3,
    parItems: 1,
    parActions: 1,
    side: 'floor',
    allPots: false,
    wind: 145,
    goalWidth: 78,
    objective: 'cut',
    fixtures: [],
  },
  {
    id: 'all-pots',
    title: '这两口锅也归你',
    brief: '用户和两口指定的锅，一个都不能漏。',
    tip: '磁铁同时吸两口锅。先让锅往接应区走，再为用户安排弹射路线。',
    limits: { pad: 2, magnet: 1, balloon: 2, pot: 0 },
    budget: 7,
    parItems: 2,
    parActions: 0,
    side: 'floor',
    allPots: true,
    wind: 0,
    goalWidth: 86,
    objective: 'all-pots',
    fixtures: [
      { id: 1, tool: 'pot', x: 372, y: 136, angle: 0, attach: null, fixed: true },
      { id: 2, tool: 'pot', x: 428, y: 174, angle: 0, attach: null, fixed: true },
    ],
  },
];
const FREE: Challenge = {
  id: 'free',
  title: '自由整活',
  brief: '自己摆、自己试，让承诺接受物理检验。',
  tip: '可以切换接应位置，也可以要求把所有松散的锅一起接住。',
  limits: LIMITS,
  budget: 99,
  parItems: 3,
  parActions: 1,
  side: 'floor',
  allPots: false,
  wind: 0,
  goalWidth: 70,
  objective: 'catch',
  fixtures: [],
};
export function challengeFor(layout: Layout): Challenge {
  return CHALLENGES.find((c) => c.id === layout.levelId) ?? FREE;
}
export function usedBudget(layout: Layout): number {
  return layout.props.reduce((sum, p) => sum + (p.fixed ? 0 : TOOL_COST[p.tool]), 0);
}
export function itemsUsed(layout: Layout): number {
  return layout.props.filter((p) => !p.fixed).length;
}
export function available(layout: Layout, tool: Tool): number {
  const c = challengeFor(layout);
  return Math.max(
    0,
    Math.min(
      c.limits[tool] - layout.props.filter((p) => p.tool === tool && !p.fixed).length,
      Math.floor((c.budget - usedBudget(layout)) / TOOL_COST[tool]),
    ),
  );
}
export interface RecordEntry {
  stars: number;
  time: number;
  items: number;
}
export type Progress = Record<string, RecordEntry>;
export function validateProgress(raw: unknown): Progress {
  const out: Progress = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of CHALLENGES) {
    const v = (raw as Record<string, unknown>)[c.id];
    if (!v || typeof v !== 'object') continue;
    const r = v as RecordEntry;
    if (
      Number.isInteger(r.stars) &&
      r.stars >= 1 &&
      r.stars <= 3 &&
      Number.isFinite(r.time) &&
      r.time > 0 &&
      r.time <= 15 &&
      Number.isInteger(r.items) &&
      r.items >= 0 &&
      r.items <= 8
    )
      out[c.id] = { stars: r.stars, time: r.time, items: r.items };
  }
  return out;
}
export function isUnlocked(id: string, progress: Progress): boolean {
  if (id === 'free') return true;
  const index = CHALLENGES.findIndex((c) => c.id === id);
  return index === 0 || (index > 0 && Boolean(progress[CHALLENGES[index - 1]!.id]));
}
export function starsFor(layout: Layout, scene: Scene): number {
  if (scene.phase !== 'success') return 0;
  const c = challengeFor(layout);
  return 1 + Number(itemsUsed(layout) <= c.parItems) + Number(scene.actions <= c.parActions);
}
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const goalY = (side: Side) => (side === 'floor' ? 515 : 78);

export function createLayout(levelId = 'free'): Layout {
  const c = CHALLENGES.find((c) => c.id === levelId) ?? FREE;
  return {
    levelId: c.id,
    props: c.fixtures.map((p) => ({ ...p })),
    side: c.side,
    allPots: c.allPots,
    nextId: c.fixtures.length + 1,
  };
}
export function anchorPoint(layout: Layout, attach: number | null): Point {
  if (attach === 0) return USER;
  return layout.props.find((p) => p.id === attach) ?? USER;
}
function attachment(layout: Layout, point: Point, tool: Tool): number | null {
  const candidates: Array<{ id: number; point: Point }> = [{ id: 0, point: USER }];
  if (tool === 'balloon') {
    for (const p of layout.props)
      if (p.tool === 'pot' && p.attach === null) candidates.push({ id: p.id, point: p });
  }
  let selected: number | null = null;
  let closest = tool === 'pot' ? 53 : 75;
  for (const candidate of candidates) {
    const d = Math.hypot(candidate.point.x - point.x, candidate.point.y - point.y);
    if (d < closest) {
      selected = candidate.id;
      closest = d;
    }
  }
  return selected;
}
function located(layout: Layout, prop: Prop, point: Point): Prop {
  const x = clamp(point.x, 52, WIDTH - 52);
  const y = clamp(point.y, 76, HEIGHT - 97);
  const attach =
    prop.tool === 'balloon' || prop.tool === 'pot' ? attachment(layout, { x, y }, prop.tool) : null;
  return { ...prop, x, y, attach };
}
export function placeProp(layout: Layout, tool: Tool, point: Point): Layout {
  if (available(layout, tool) <= 0) return layout;
  const prop = located(
    layout,
    { id: layout.nextId, tool, x: point.x, y: point.y, angle: 0, attach: null },
    point,
  );
  if (tool === 'balloon' && prop.attach === null) return layout;
  if (
    tool === 'pot' &&
    prop.attach === 0 &&
    layout.props.some((p) => p.tool === 'pot' && p.attach === 0)
  )
    return layout;
  return { ...layout, nextId: layout.nextId + 1, props: [...layout.props, prop] };
}
export function moveProp(layout: Layout, id: number, point: Point): Layout {
  const prop = layout.props.find((p) => p.id === id);
  if (!prop || prop.fixed) return layout;
  const others = { ...layout, props: layout.props.filter((p) => p.id !== id) };
  const moved = located(others, prop, point);
  if (moved.tool === 'balloon' && moved.attach === null) return layout;
  if (
    moved.tool === 'pot' &&
    moved.attach === 0 &&
    others.props.some((p) => p.tool === 'pot' && p.attach === 0)
  )
    return layout;
  return { ...layout, props: layout.props.map((p) => (p.id === id ? moved : p)) };
}
export function rotateProp(layout: Layout, id: number, delta: number): Layout {
  return {
    ...layout,
    props: layout.props.map((p) =>
      p.id === id && p.tool === 'pad' && !p.fixed
        ? { ...p, angle: clamp(p.angle + delta, -55, 55) }
        : p,
    ),
  };
}
export function removeProp(layout: Layout, id: number): Layout {
  if (layout.props.find((p) => p.id === id)?.fixed) return layout;
  return { ...layout, props: layout.props.filter((p) => p.id !== id && p.attach !== id) };
}
export function startScene(layout: Layout): Scene {
  const helmet = layout.props.some((p) => p.tool === 'pot' && p.attach === 0);
  const balloons = (id: number) =>
    layout.props.filter((p) => p.tool === 'balloon' && p.attach === id).length;
  const bodies: Body[] = [
    {
      id: 0,
      type: 'user',
      ...USER,
      vx: 0,
      vy: 0,
      radius: 19,
      mass: helmet ? 1.55 : 1,
      metal: helmet,
      balloons: balloons(0),
      caught: false,
      contact: 0,
    },
  ];
  for (const p of layout.props) {
    if (p.tool === 'pot' && p.attach === null)
      bodies.push({
        id: p.id,
        type: 'pot',
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        radius: 22,
        mass: 1.5,
        metal: true,
        balloons: balloons(p.id),
        caught: false,
        contact: 0,
      });
  }
  return {
    phase: 'running',
    time: 0,
    bodies,
    cut: false,
    powered: true,
    bounces: 0,
    magnetic: false,
    floated: false,
    message: '放心，我会稳稳地接住你。',
    trail: [{ ...USER }],
    trailIn: 0,
    caughtPots: 0,
    actions: 0,
  };
}
export function cutBalloons(scene: Scene): Scene {
  if (scene.phase !== 'running' || scene.cut || !scene.bodies.some((b) => b.balloons && !b.caught))
    return scene;
  return { ...scene, cut: true, actions: scene.actions + 1, message: '绳子剪了，重力接班。' };
}
export function toggleMagnets(scene: Scene): Scene {
  if (scene.phase !== 'running') return scene;
  return {
    ...scene,
    powered: !scene.powered,
    actions: scene.actions + 1,
    message: scene.powered ? '磁铁断电。锅还在惯性甩动。' : '磁铁通电，所有铁锅都听见了。',
  };
}
function hitPad(body: Body, old: Point, prop: Prop): boolean {
  if (body.contact > 0) return false;
  const angle = (prop.angle * Math.PI) / 180;
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: Math.sin(angle), y: -Math.cos(angle) };
  const distance = (p: Point) => (p.x - prop.x) * normal.x + (p.y - prop.y) * normal.y;
  const before = distance(old);
  const after = distance(body);
  const along = (body.x - prop.x) * tangent.x + (body.y - prop.y) * tangent.y;
  const incoming = body.vx * normal.x + body.vy * normal.y;
  if (
    before >= body.radius - 3 &&
    after <= body.radius &&
    Math.abs(along) < 77 + body.radius * 0.4 &&
    incoming < 0
  ) {
    body.x += normal.x * (body.radius - after + 1);
    body.y += normal.y * (body.radius - after + 1);
    const kick = -1.8 * incoming + 165;
    body.vx += kick * normal.x;
    body.vy += kick * normal.y;
    body.contact = 0.12;
    return true;
  }
  return false;
}
function collide(a: Body, b: Body): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const required = a.radius + b.radius;
  if (distance >= required || distance < 0.001 || a.caught || b.caught) return;
  const nx = dx / distance;
  const ny = dy / distance;
  const invA = 1 / a.mass;
  const invB = 1 / b.mass;
  const overlap = required - distance;
  a.x -= (nx * overlap * invA) / (invA + invB);
  a.y -= (ny * overlap * invA) / (invA + invB);
  b.x += (nx * overlap * invB) / (invA + invB);
  b.y += (ny * overlap * invB) / (invA + invB);
  const speed = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (speed >= 0) return;
  const impulse = (-1.4 * speed) / (invA + invB);
  a.vx -= impulse * nx * invA;
  a.vy -= impulse * ny * invA;
  b.vx += impulse * nx * invB;
  b.vy += impulse * ny * invB;
}

export function stepScene(scene: Scene, layout: Layout, dt = STEP): Scene {
  if (scene.phase !== 'running' || dt <= 0) return scene;
  const tick = Math.min(dt, 1 / 60);
  const next: Scene = {
    ...scene,
    time: scene.time + tick,
    bodies: scene.bodies.map((b) => ({ ...b })),
  };
  for (const body of next.bodies) {
    if (body.caught) continue;
    const old = { x: body.x, y: body.y };
    body.contact = Math.max(0, body.contact - tick);
    let ax = challengeFor(layout).wind;
    let ay = 500;
    if (!next.cut && body.balloons) {
      ay -= (body.balloons * 760) / body.mass;
      if (body.type === 'user') next.floated = true;
    }
    if (next.powered && body.metal)
      for (const p of layout.props) {
        if (p.tool !== 'magnet') continue;
        const dx = p.x - body.x;
        const dy = p.y - body.y;
        const d = Math.hypot(dx, dy);
        if (d > 12 && d < 680) {
          const force = (1400 * Math.max(0, 1 - d / 760)) / body.mass;
          ax += (dx / d) * force;
          ay += (dy / d) * force;
          if (body.type === 'user') next.magnetic = true;
        }
      }
    body.vx = (body.vx + ax * tick) * Math.exp(-0.16 * tick);
    body.vy = (body.vy + ay * tick) * Math.exp(-0.1 * tick);
    body.x += body.vx * tick;
    body.y += body.vy * tick;
    for (const p of layout.props) if (p.tool === 'pad' && hitPad(body, old, p)) next.bounces += 1;
    if (body.x < 24 + body.radius || body.x > WIDTH - 24 - body.radius) {
      body.x = clamp(body.x, 24 + body.radius, WIDTH - 24 - body.radius);
      body.vx *= -0.5;
    }
    const atGoal = Math.abs(body.x - GOAL_X) < challengeFor(layout).goalWidth;
    const crossedFloor =
      layout.side === 'floor' &&
      body.vy >= 0 &&
      old.y + body.radius <= goalY('floor') + 8 &&
      body.y + body.radius >= goalY('floor');
    const crossedCeiling =
      layout.side === 'ceiling' && body.vy <= 0 && body.y - body.radius <= goalY('ceiling');
    if (atGoal && (crossedFloor || crossedCeiling)) {
      body.caught = true;
      body.vx = 0;
      body.vy = 0;
      body.y = goalY(layout.side) + (layout.side === 'floor' ? -body.radius : body.radius);
      if (body.type === 'pot') next.caughtPots += 1;
      next.message = body.type === 'user' ? '接住了！连这条路线都没想到。' : '你还带锅来？我也接。';
      continue;
    }
    if (body.y - body.radius < 54) {
      body.y = 54 + body.radius;
      body.vy = Math.max(0, -body.vy * 0.25);
    }
    if (
      body.vy > 0 &&
      old.y + body.radius <= SHELF.y &&
      body.y + body.radius >= SHELF.y &&
      body.x > SHELF.x - body.radius &&
      body.x < SHELF.x + SHELF.width + body.radius
    ) {
      body.y = SHELF.y - body.radius;
      body.vy *= -0.28;
      if (Math.abs(body.vy) < 22) body.vy = 0;
      body.vx *= 0.92;
    }
    if (body.y > HEIGHT + 40) {
      if (body.type === 'user' || layout.allPots) {
        next.phase = 'failed';
        next.message =
          body.type === 'user'
            ? '接住你的心意到了，手没够到。改改布置？'
            : '指定的锅漏了。给锅也安排一条救援路线。';
      } else {
        body.caught = true;
        body.x = -100;
      }
    }
  }
  for (let i = 0; i < next.bodies.length; i++)
    for (let j = i + 1; j < next.bodies.length; j++) collide(next.bodies[i]!, next.bodies[j]!);
  next.trailIn += tick;
  if (next.trailIn >= 0.06) {
    const user = next.bodies[0]!;
    next.trail = [...scene.trail, { x: user.x, y: user.y }].slice(-260);
    next.trailIn = 0;
  }
  const user = next.bodies[0]!;
  if (
    next.phase === 'running' &&
    user.caught &&
    (!layout.allPots || next.bodies.every((b) => b.caught))
  ) {
    next.phase = 'success';
    next.message =
      layout.allPots && next.caughtPots > 0
        ? `人接住了，${next.caughtPots} 口锅也一口没落。`
        : next.cut && next.floated
          ? '气球负责起飞，剪刀负责下班。接住了。'
          : next.floated && next.magnetic
            ? '戴着锅，挂着气球。这次真的上天了。'
            : next.magnetic
              ? '磁铁拉锅，锅带着你。接住了！'
              : next.floated
                ? layout.side === 'ceiling'
                  ? '你往上掉，我在上面接。'
                  : '先飘起来，再稳稳落下。'
                : next.bounces > 1
                  ? '弹了不止一下，但承诺兑现了。'
                  : '这次，真的稳稳接住你。';
    const objective = challengeFor(layout).objective;
    if (
      (objective === 'magnetic' && !next.magnetic) ||
      (objective === 'float' && !next.floated) ||
      (objective === 'cut' && (!next.cut || !next.floated))
    ) {
      next.phase = 'failed';
      next.message =
        objective === 'cut'
          ? '人接住了，但这关要先借气球，再剪绳降落。'
          : '人接住了，再试着用本关指定的办法救援。';
    }
  }
  if (next.phase === 'running' && next.time >= 14) {
    next.phase = 'failed';
    next.message = user.caught
      ? '人到了，锅还没到。调整磁铁或蹦床再试。'
      : '还在绕圈。试着剪断气球，或给磁铁断电。';
  }
  return next;
}
