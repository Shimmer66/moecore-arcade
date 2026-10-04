import {
  createRun,
  stepRun,
  advanceLevel,
  retryLevel,
  shareLife,
  levels,
  hazardState,
  FIXED_DT,
  weaponOrder,
  type PlayerState,
  type RunState,
  type RunInput,
  type Difficulty,
} from '../src/rules';
const idle: RunInput = { horizontal: 0, jump: false, shoot: false };
function loadout(p: PlayerState, input: RunInput): RunInput {
  const choice =
    p.latestWeapon ?? (p.weapon === 'pulse' ? p.arsenal.find((w) => w !== 'pulse') : undefined);
  return choice ? { ...input, equipWeapon: choice } : input;
}
const climbTargets = new Map<number, { x: number; top: number; stage: number }>();
export function depthInput(s: RunState, p: PlayerState): RunInput {
  if (p.lives <= 0) return idle;
  const base = s.base!;
  const danger = base.hostile.some((b) => {
    const t = (p.depthZ - b.z) / b.vz;
    const x = b.x + b.vx * t,
      y = b.y + b.vy * t;
    return t > 0 && t < 0.45 && Math.abs(x - p.x) < 0.85 && y > p.y - 0.2 && y < p.y + 1.5;
  });
  const objective = base.targets
    .filter((t) => ['core', 'relay', 'head'].includes(t.kind) && t.hp > 0)
    .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
  const dx = (objective?.x ?? (s.partner ? (p.playerId === 1 ? 10.2 : 11.8) : 11)) - p.x;
  return {
    horizontal:
      danger && !p.grounded ? (p.x < 11 ? -1 : 1) : Math.abs(dx) < 0.2 ? 0 : dx > 0 ? 1 : -1,
    vertical: base.gateOpen && !s.arena ? 1 : 0,
    jump: (danger || (!!objective && objective.y > 1.8)) && p.grounded,
    shoot: true,
    grenade: s.arena && p.grenades > 0 && p.grenadeCooldown <= 0,
  };
}
function drive(s: RunState, p: PlayerState): RunInput {
  if (p.lives <= 0) return idle;
  const level = levels[s.levelIndex]!;
  if (s.base) return depthInput(s, p);
  if (level.axis === 'vertical' && !s.arena) {
    if (p.y >= level.arenaY) return { ...idle, shoot: true };
    let mark = climbTargets.get(p.playerId);
    if (!mark || mark.stage !== s.levelIndex || p.grounded) {
      const next = level.platforms
        .filter((t) => t.to - t.from > 3.7 && t.top > p.y + 0.05 && t.top <= 48)
        .sort((a, b) => a.top - b.top)[0];
      mark = {
        x: next
          ? (next.from + next.to) / 2 + (s.partner ? (p.playerId === 1 ? -0.4 : 0.4) : 0)
          : 11,
        top: next?.top ?? 48,
        stage: s.levelIndex,
      };
      climbTargets.set(p.playerId, mark);
    }
    const dx = mark.x - p.x;
    return {
      horizontal: Math.abs(dx) < 0.14 ? 0 : dx > 0 ? 1 : -1,
      jump: p.grounded && (!s.partner || p.y - (p.playerId === 1 ? s.partner.y : s.y) <= 2.1),
      shoot: true,
    };
  }
  const boss = s.enemies.find((e) => e.kind === 'boss')!;
  const structure =
    s.levelIndex === 7
      ? s.enemies
          .filter(
            (e) => e.hp > 0 && ((!s.arena && e.kind === 'pod') || (s.arena && e.kind === 'heart')),
          )
          .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]
      : undefined;
  const anchor = structure
    ? structure.x - (p.playerId === 1 ? 3.8 : 2.8)
    : boss.x - (s.partner ? (p.playerId === 1 ? 6.7 : 4) : 5.7);
  let horizontal: -1 | 0 | 1 =
    s.arena || structure ? (Math.abs(anchor - p.x) < 0.2 ? 0 : anchor > p.x ? 1 : -1) : 1;
  let jump = level.platforms.some(
    (t) => t.top === 0 && t.to < level.length && t.to >= p.x && t.to - p.x < 1.2,
  );
  jump ||= level.hazards.some(
    (h, i) =>
      h.kind !== 'mirage' &&
      h.from - p.x < 1.5 &&
      h.to > p.x &&
      hazardState(i, s.stageTime) !== 'safe',
  );
  jump ||= s.enemies.some(
    (e) => e.hp > 0 && e.kind !== 'boss' && Math.abs(e.x - p.x) < 1.5 && e.y <= p.y + 0.7,
  );
  let duck = false;
  for (const b of s.enemyBullets) {
    const t = Math.abs(b.vx) > 1 ? (p.x - b.x) / b.vx : (p.y + 1.4 - b.y) / b.vy;
    if (t < 0 || t > 0.45 || Math.abs(b.x + b.vx * t - p.x) > 0.7) continue;
    const y = b.y + b.vy * t;
    if (y < p.y - 0.2 || y > p.y + 1.5) continue;
    if (Math.abs(b.vx) < 1) {
      horizontal = p.x < anchor ? 1 : -1;
    } else if (y > p.y + 0.72) duck = true;
    else jump = true;
  }
  if (duck && p.grounded && !jump)
    return {
      ...idle,
      vertical: -1,
      shoot: true,
      grenade: s.arena && p.grenades > 0 && p.grenadeCooldown <= 0 && Math.abs(boss.x - p.x) < 9,
    };
  if (s.arena && !horizontal && p.facing < 0)
    return { ...idle, horizontal: 1, lockAim: true, shoot: true };
  if (s.arena && p.y > boss.y + 3.5)
    return { ...idle, horizontal: 1, vertical: -1, lockAim: true, shoot: true };
  return {
    horizontal,
    jump: jump && p.grounded,
    shoot: true,
    grenade: s.arena && p.grenades > 0 && p.grenadeCooldown <= 0 && Math.abs(boss.x - p.x) < 9,
  };
}

function modeInput(s: RunState, p: PlayerState, mode: number, tick: number): RunInput {
  const base = drive(s, p);
  if (mode === 0) return base;
  if (p.lives <= 0) return idle;
  const grenade = base.grenade ?? false;
  if (mode === 1) return { horizontal: 1, lockAim: true, jump: false, shoot: true, grenade };
  if (mode === 2)
    return p.facing < 0
      ? { horizontal: 1, lockAim: true, jump: false, shoot: true }
      : { ...idle, vertical: -1, shoot: true, grenade };
  if (mode === 3) return { ...base, jump: tick === 0 && p.grounded };
  if (mode === 4)
    return { horizontal: 1, lockAim: true, jump: tick === 0 && p.grounded, shoot: true, grenade };
  const horizontal = mode === 5 || mode === 7 ? -1 : 1;
  return { horizontal, jump: mode >= 7 && tick === 0 && p.grounded, shoot: true, grenade };
}
function grade(before: RunState, after: RunState): number {
  if (after.phase === 'level-complete' || after.phase === 'won') return -10000;
  if (after.phase === 'lost') return 100000;
  let cost = (after.deaths - before.deaths) * 2000 - (after.kills - before.kills) * 3;
  if (before.base && after.base) {
    cost -= (after.base.room - before.base.room) * 500;
    for (const target of before.base.targets) {
      const next = after.base.targets.find((t) => t.id === target.id);
      if (next) cost -= Math.max(0, target.hp - Math.max(0, next.hp)) * 2;
    }
  }
  for (const target of before.enemies.filter((e) => ['pod', 'heart'].includes(e.kind))) {
    const next = after.enemies.find((e) => e.id === target.id);
    if (next) cost -= Math.max(0, target.hp - Math.max(0, next.hp)) * 16;
  }
  const b = [before, ...(before.partner ? [before.partner] : [])],
    a = [after, ...(after.partner ? [after.partner] : [])];
  for (let i = 0; i < b.length; i++) {
    const p = b[i]!,
      q = a[i]!;
    if (p.lives <= 0) continue;
    cost += Math.max(0, p.health - q.health) * 180 + Math.max(0, p.shield - q.shield) * 60;
    if (q.y < -0.2) cost += 150 + Math.abs(q.y) * 100;
    if (after.base) {
      const objective = after.base.targets
        .filter((t) => t.hp > 0 && ['core', 'relay', 'head'].includes(t.kind))
        .sort((a, b) => Math.abs(a.x - q.x) - Math.abs(b.x - q.x))[0];
      const goal = objective?.x ?? 11;
      cost += Math.abs(goal - q.x) * 2;
      if (after.base.gateOpen && !after.arena) cost -= q.depthZ * 8;
      continue;
    }
    const boss = after.enemies.find((e) => e.kind === 'boss')!;
    const structure =
      after.levelIndex === 7
        ? after.enemies
            .filter(
              (e) =>
                e.hp > 0 &&
                ((!after.arena && e.kind === 'pod') || (after.arena && e.kind === 'heart')),
            )
            .sort((x, y) => Math.abs(x.x - q.x) - Math.abs(y.x - q.x))[0]
        : undefined;
    const goal = structure
      ? structure.x - (q.playerId === 1 ? 3.8 : 2.8)
      : after.arena
        ? boss.x - (after.partner ? (q.playerId === 1 ? 6.7 : 4) : 5.7)
        : levels[after.levelIndex]!.length - 12;
    cost += Math.abs(goal - q.x) * 2;
  }
  return cost;
}
function plan(s: RunState): [RunInput, RunInput][] {
  const modes = [0, 0];
  let chosen: [RunInput, RunInput][] = [];
  for (let player = 0; player < (s.partner ? 2 : 1); player++) {
    let best = Infinity;
    for (let mode = 0; mode < 9; mode++) {
      let future = s;
      const inputs: [RunInput, RunInput][] = [];
      const candidate = [...modes];
      candidate[player] = mode;
      for (let tick = 0; tick < 60 && future.phase === 'running'; tick++) {
        const a = loadout(future, modeInput(future, future, candidate[0]!, tick)),
          b = future.partner
            ? loadout(future.partner, modeInput(future, future.partner, candidate[1]!, tick))
            : idle;
        if (tick < 10) inputs.push([a, b]);
        future = stepRun(future, a, FIXED_DT, b);
      }
      const score = grade(s, future) + (mode === 0 ? 0 : 0.1);
      if (score < best) {
        best = score;
        modes[player] = mode;
        chosen = inputs;
      }
    }
  }
  return chosen;
}
const bits = (i: RunInput) =>
  (i.horizontal < 0 ? 1 : i.horizontal > 0 ? 2 : 0) |
  (i.vertical === 1 ? 4 : i.vertical === -1 ? 8 : 0) |
  (i.shoot ? 16 : 0) |
  (i.jump ? 32 : 0) |
  (i.grenade ? 64 : 0) |
  (i.lockAim ? 128 : 0) |
  (i.equipWeapon ? 256 << weaponOrder.indexOf(i.equipWeapon) : 0);

/** Generates legal controller inputs; all candidate futures are copies, never injected into the run. */
export function recordCampaign(
  difficulty: Difficulty,
  duo: boolean,
  onStage?: (state: RunState) => void,
) {
  climbTargets.clear();
  let s = createRun('deepseek', 0, difficulty, duo ? 'deepseek' : undefined);
  const log: object[] = [];
  let planned: [RunInput, RunInput][] = [];
  const tape: [number, number, number][] = [];
  const record = (a: number, b: number) => {
    const last = tape.at(-1);
    if (last && last[1] === a && last[2] === b && a >= 0) last[0]++;
    else tape.push([1, a, b]);
  };
  for (let f = 0; f < 90000 && s.phase !== 'won'; f++) {
    if (s.stageTime > 300) break;
    if (s.phase === 'level-complete') {
      log.push({
        stage: s.levelIndex + 1,
        time: Math.round(s.stageTime),
        lives: s.lives,
        p2: s.partner?.lives,
        deaths: s.deaths,
      });
      onStage?.(s);
      s = advanceLevel(s);
      record(-1, 0);
      planned = [];
    }
    if (s.phase === 'lost') {
      if (!s.continues) break;
      s = retryLevel(s);
      record(-2, 0);
      planned = [];
    }
    if (s.partner) {
      const target = s.lives <= 0 ? 1 : 2,
        next = shareLife(s, target);
      if (next !== s) {
        s = next;
        record(-2 - target, 0);
        planned = [];
      }
    }
    if (!planned.length) {
      if (
        (levels[s.levelIndex]!.axis === 'horizontal' && (!duo || difficulty !== 'normal')) ||
        (s.base && s.arena && difficulty !== 'normal')
      )
        planned = plan(s);
      else
        planned = [
          [loadout(s, drive(s, s)), s.partner ? loadout(s.partner, drive(s, s.partner)) : idle],
        ];
    }
    const [a, b] = planned.shift() ?? [idle, idle];
    record(bits(a), bits(b));
    s = stepRun(s, a, FIXED_DT, b);
  }
  const result = {
    difficulty,
    duo,
    log,
    phase: s.phase,
    stage: s.levelIndex + 1,
    x: s.x,
    y: s.y,
    weapon: s.weapon,
    hp: s.health,
    lives: s.lives,
    p2: s.partner?.lives,
    p2x: s.partner?.x,
    p2y: s.partner?.y,
    deaths: s.deaths,
    continues: s.continues,
    boss: s.enemies.find((e) => e.kind === 'boss')?.hp,
    room: s.base?.room,
    objectives: s.base?.targets
      .filter((t) => t.hp > 0)
      .map((t) => ({ kind: t.kind, hp: t.hp, x: t.x, y: t.y })),
    elapsed: s.elapsed,
  };

  return { result, tape };
}
