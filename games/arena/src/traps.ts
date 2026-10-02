export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TrapEffect =
  | 'pit'
  | 'spikes'
  | 'falling'
  | 'exit'
  | 'reverse'
  | 'gravity'
  | 'saw'
  | 'gate'
  | 'platform'
  | 'decoy'
  | 'ice'
  | 'lowJump'
  | 'bounce'
  | 'wind'
  | 'wall'
  | 'airJump'
  | 'jetpack'
  | 'mine'
  | 'seeker';
export interface TriggerActor extends Rect {
  id?: string;
  jump?: boolean;
  landed?: boolean;
  horizontal?: number;
}
export interface Trap {
  id: string;
  effect: TrapEffect;
  trigger: Rect;
  body: Rect;
  delay: number;
  duration?: number;
  travel?: { x: number; y: number; ticks: number; loop?: boolean };
  cycle?: { active: number; rest: number };
  after?: string;
  line: string;
  triggerOn?: 'jump' | 'land' | 'left' | 'right';
  initiallyActive?: boolean;
  rearm?: boolean;
}
export interface TrapClock {
  triggeredAt: number | null;
  occupants?: string[];
  liveBody?: Rect;
}
export interface TrapScene {
  tick: number;
  clocks: Record<string, TrapClock>;
}
export interface ActiveTrap {
  trap: Trap;
  body: Rect;
  phase: 'warning' | 'active' | 'spent';
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createTrapScene(traps: readonly Trap[]): TrapScene {
  const ids = new Set(traps.map((trap) => trap.id));
  if (ids.size !== traps.length) throw new Error('Duplicate trap id');
  for (const trap of traps) {
    if (trap.delay < 0 || (trap.duration !== undefined && trap.duration <= 0))
      throw new Error(`Invalid trap timing: ${trap.id}`);
    if (trap.travel && trap.travel.ticks <= 0) throw new Error(`Invalid travel: ${trap.id}`);
    if (trap.cycle && (trap.cycle.active <= 0 || trap.cycle.rest <= 0))
      throw new Error(`Invalid cycle: ${trap.id}`);
    const seen = new Set([trap.id]);
    let parent = trap.after;
    while (parent) {
      if (seen.has(parent)) throw new Error(`Trap dependency cycle: ${trap.id}`);
      seen.add(parent);
      const dependency = traps.find((candidate) => candidate.id === parent);
      if (!dependency) throw new Error(`Missing trap dependency: ${parent}`);
      parent = dependency.after;
    }
  }
  return {
    tick: 0,
    clocks: Object.fromEntries(traps.map((trap) => [trap.id, { triggeredAt: null }])),
  };
}

export function trapView(trap: Trap, scene: TrapScene): ActiveTrap | null {
  const triggeredAt = scene.clocks[trap.id]?.triggeredAt;
  if (triggeredAt === null || triggeredAt === undefined)
    return trap.initiallyActive ? { trap, phase: 'active', body: { ...trap.body } } : null;
  const age = scene.tick - triggeredAt - trap.delay;
  let phase: ActiveTrap['phase'] =
    age < 0 ? 'warning' : trap.duration !== undefined && age >= trap.duration ? 'spent' : 'active';
  if (
    phase === 'active' &&
    trap.cycle &&
    age % (trap.cycle.active + trap.cycle.rest) >= trap.cycle.active
  )
    phase = 'spent';
  const travelTime = trap.travel ? Math.max(0, age / trap.travel.ticks) : 0;
  const progress = trap.travel?.loop ? 1 - Math.abs((travelTime % 2) - 1) : Math.min(1, travelTime);
  if (trap.effect === 'mine' && phase === 'active') {
    const radius = Math.min(80, (age + 1) * 10);
    return {
      trap,
      phase,
      body: {
        x: trap.body.x + (trap.travel?.x ?? 0) * progress + trap.body.w / 2 - radius,
        y: trap.body.y + (trap.travel?.y ?? 0) * progress + trap.body.h / 2 - radius,
        w: radius * 2,
        h: radius * 2,
      },
    };
  }
  return {
    trap,
    phase,
    body: scene.clocks[trap.id]?.liveBody ?? {
      ...trap.body,
      x: trap.body.x + (trap.travel?.x ?? 0) * progress,
      y: trap.body.y + (trap.travel?.y ?? 0) * progress,
    },
  };
}

/** Evaluate against the previous tick so authored order cannot accelerate a chain. */
export function stepTraps(
  traps: readonly Trap[],
  scene: TrapScene,
  players: readonly TriggerActor[],
): TrapScene {
  const next: TrapScene = { tick: scene.tick + 1, clocks: { ...scene.clocks } };
  for (const trap of traps) {
    const clock = scene.clocks[trap.id]!;
    const eligible = players.flatMap((player, index) =>
      overlaps(player, trap.trigger) &&
      (!trap.triggerOn ||
        (trap.triggerOn === 'jump' && player.jump) ||
        (trap.triggerOn === 'land' && player.landed) ||
        (trap.triggerOn === 'left' && (player.horizontal ?? 0) < 0) ||
        (trap.triggerOn === 'right' && (player.horizontal ?? 0) > 0))
        ? [player.id ?? String(index)]
        : [],
    );
    next.clocks[trap.id] = { ...clock, occupants: eligible };
    if (trap.effect === 'seeker' && trapView(trap, scene)?.phase === 'active' && players.length) {
      const body = clock.liveBody ?? trap.body;
      const centerX = body.x + body.w / 2,
        centerY = body.y + body.h / 2;
      const target = [...players].sort(
        (a, b) =>
          Math.hypot(a.x + a.w / 2 - centerX, a.y + a.h / 2 - centerY) -
            Math.hypot(b.x + b.w / 2 - centerX, b.y + b.h / 2 - centerY) ||
          a.x - b.x ||
          a.y - b.y,
      )[0]!;
      const dx = target.x + target.w / 2 - centerX,
        dy = target.y + target.h / 2 - centerY;
      const distance = Math.hypot(dx, dy);
      const factor = distance > 0 ? Math.min(2.4, distance) / distance : 0;
      next.clocks[trap.id]!.liveBody = {
        ...body,
        x: body.x + dx * factor,
        y: body.y + dy * factor,
      };
    }
    const freshEntry = eligible.some((id) => !clock.occupants?.includes(id));
    if (
      clock.triggeredAt !== null &&
      !(trap.rearm && trapView(trap, scene)?.phase === 'spent' && freshEntry)
    )
      continue;
    const dependency = trap.after && traps.find((candidate) => candidate.id === trap.after);
    if (dependency) {
      if (scene.clocks[dependency.id]?.triggeredAt == null) continue;
      const phase = trapView(dependency, scene)?.phase;
      if (phase !== 'active' && phase !== 'spent') continue;
    }
    if (eligible.length > 0) next.clocks[trap.id] = { triggeredAt: next.tick, occupants: eligible };
  }
  return next;
}

/** Split floor geometry; partial-width pits must leave both surviving ledges solid. */
export function cutFloor(floors: readonly Rect[], holes: readonly Rect[]): Rect[] {
  return holes.reduce<Rect[]>(
    (pieces, hole) =>
      pieces.flatMap((floor) => {
        if (!overlaps(floor, hole)) return [floor];
        const left = Math.max(floor.x, hole.x);
        const right = Math.min(floor.x + floor.w, hole.x + hole.w);
        return [
          ...(left > floor.x ? [{ ...floor, w: left - floor.x }] : []),
          ...(right < floor.x + floor.w
            ? [{ ...floor, x: right, w: floor.x + floor.w - right }]
            : []),
        ];
      }),
    floors.map((floor) => ({ ...floor })),
  );
}
