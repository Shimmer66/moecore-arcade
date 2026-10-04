import type { PlayerState, RunState } from './rules';
import type { Weapon, SupplyKind } from './levels';
import { FIREBALL, fireballDelta } from './fireball';

export interface DepthTarget {
  id: number;
  kind: 'core' | 'turret' | 'drone' | 'boss' | 'cache' | 'relay' | 'head';
  slot?: number;
  drop?: SupplyKind;
  x: number;
  y: number;
  z: number;
  originX: number;
  hp: number;
  maxHp: number;
  age: number;
  cooldown: number;
  volley: number;
  flash: number;
  aim?: { x: number; y: number; z: number } | undefined;
}
export interface DepthShot {
  age?: number;
  id: number;
  owner: 1 | 2;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  radius: number;
  weapon: Weapon;
  hits: number[];
}
export interface DepthHostile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}
export interface DepthState {
  room: number;
  roomCount: number;
  age: number;
  transition: number;
  gateOpen: boolean;
  fieldPulse: number;
  nextId: number;
  targets: DepthTarget[];
  shots: DepthShot[];
  hostile: DepthHostile[];
  grenades: { x: number; y: number; z: number; fuse: number; originZ: number; originY: number }[];
  effects: {
    x: number;
    y: number;
    z: number;
    life: number;
    boom: boolean;
    kind?: 'hit' | 'muzzle';
    weapon?: Weapon;
    defeat?: boolean;
  }[];
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const players = (s: RunState) => (s.partner ? [s, s.partner] : [s]).filter((p) => p.lives > 0);
export const DEPTH_FIELD_Z = 3;
export const DEPTH_EXIT_Z = 11;
export const depthGuards = (base: DepthState) =>
  base.targets.filter((t) => (t.kind === 'relay' || t.kind === 'head') && t.hp > 0);
export const depthBossProtected = (base: DepthState) => depthGuards(base).length > 0;
export const depthIsBossRoom = (base: DepthState) => base.room === base.roomCount - 1;
export function depthTargetOpen(base: DepthState, target: DepthTarget): boolean {
  if (target.kind === 'boss')
    return !depthBossProtected(base) && (target.hp < target.maxHp * 0.3 || target.age % 5 > 2.2);
  if (target.kind === 'head') {
    const mate = base.targets.find(
      (t) =>
        t.kind === 'head' &&
        t.hp > 0 &&
        t.id !== target.id &&
        Math.floor((t.slot ?? 0) / 2) === Math.floor((target.slot ?? 0) / 2),
    );
    return !mate || Math.abs(mate.x - target.x) < 0.8;
  }
  return target.kind !== 'core' || (base.age + target.id * 0.3) % 4 > 1.2;
}
export function depthRoomTitle(s: RunState): string {
  const base = s.base!;
  if (depthIsBossRoom(base)) return '最终回执 · 核心机房';
  const names =
    s.levelIndex === 1
      ? ['输入缓存', '已读回执', '正在输入…']
      : ['任务分发', '工具调用', '自我反思', '递归栈溢出'];
  return names[base.room] ?? '推理机房';
}
function makeTarget(
  id: number,
  kind: DepthTarget['kind'],
  x: number,
  y: number,
  hp: number,
  z = 18,
): DepthTarget {
  return {
    id,
    kind,
    x,
    y,
    z,
    originX: x,
    hp,
    maxHp: hp,
    age: 0,
    cooldown: 1.2 + (id % 3) * 0.4,
    volley: 0,
    flash: 0,
  };
}
function populate(base: DepthState, bossHp: number, levelIndex: number, duo: boolean) {
  base.gateOpen = depthIsBossRoom(base);
  base.fieldPulse = 0;
  if (depthIsBossRoom(base)) {
    base.targets = [makeTarget(base.nextId++, 'boss', 11, 1.7, bossHp)];
    if (levelIndex === 1) {
      for (let slot = 0; slot < 2; slot++)
        base.targets.push({
          ...makeTarget(base.nextId++, 'relay', slot ? 16 : 6, slot ? 3 : 1.1, duo ? 14 : 9, 15),
          slot,
        });
    } else {
      for (let slot = 0; slot < 4; slot++)
        base.targets.push({
          ...makeTarget(
            base.nextId++,
            'head',
            slot < 2 ? 6 : 16,
            slot < 2 ? 1.1 : 3,
            duo ? 16 : 10,
            15,
          ),
          slot,
        });
    }
    return;
  }
  const hp = Math.ceil((6 + base.room * 2) * (duo ? 1.4 : 1));
  base.targets = [
    makeTarget(base.nextId++, 'core', 4, 0.8, hp),
    makeTarget(base.nextId++, 'core', 11, base.room % 2 ? 3 : 0.8, hp),
    makeTarget(base.nextId++, 'core', 18, 3, hp),
    makeTarget(base.nextId++, 'turret', 4, 1.4, 6, 13),
    makeTarget(base.nextId++, 'turret', 16, 1.3, 6, 13),
    {
      ...makeTarget(base.nextId++, 'cache', base.room % 2 ? 13 : 8, 0.8, 3, 11),
      drop: (['overclock', 'barrier', 'purge', 'laser'] as const)[base.room % 4]!,
    },
  ];
  if (levelIndex === 5) base.targets.push(makeTarget(base.nextId++, 'drone', 11, 3.5, 4, 9));
}
export function createDepth(
  levelIndex: number,
  bossHp: number,
  duo: boolean,
  bossOnly = false,
): DepthState {
  const roomCount = levelIndex === 1 ? 4 : 5;
  const base: DepthState = {
    room: bossOnly ? roomCount - 1 : 0,
    roomCount,
    age: 0,
    transition: 0,
    gateOpen: bossOnly,
    fieldPulse: 0,
    nextId: 0,
    targets: [],
    shots: [],
    hostile: [],
    grenades: [],
    effects: [],
  };
  populate(base, bossHp, levelIndex, duo);
  return base;
}
export function cloneDepth(base: DepthState): DepthState {
  return {
    ...base,
    targets: base.targets.map((t) => ({ ...t, aim: t.aim ? { ...t.aim } : undefined })),
    shots: base.shots.map((b) => ({ ...b, hits: [...b.hits] })),
    hostile: base.hostile.map((b) => ({ ...b })),
    grenades: base.grenades.map((g) => ({ ...g })),
    effects: base.effects.map((e) => ({ ...e })),
  };
}
export function fireDepth(base: DepthState, p: PlayerState, firstId: number): number {
  const offsets = p.weapon === 'spread' ? [-2, -1, 0, 1, 2] : [0];
  offsets.forEach((offset, i) =>
    base.shots.push({
      id: firstId + i,
      owner: p.playerId,
      age: 0,
      x: p.x,
      y: p.y + (p.crouching ? 0.3 : 0.8),
      z: p.depthZ,
      vx: offset * 2.2,
      vy: 0,
      vz: p.weapon === 'laser' ? 45 : p.weapon === 'flame' ? FIREBALL.depthSpeed : 28,
      damage: p.weapon === 'laser' ? 3 : p.weapon === 'flame' ? FIREBALL.damage : 1,
      radius: p.weapon === 'flame' ? FIREBALL.radius : 0.14,
      weapon: p.weapon,
      hits: [],
    }),
  );
  base.effects.push({
    x: p.x,
    y: p.y + (p.crouching ? 0.3 : 0.8),
    z: p.depthZ + 0.5,
    life: 0.14,
    boom: false,
    kind: 'muzzle',
    weapon: p.weapon,
  });
  return offsets.length;
}
export function grenadeDepth(base: DepthState, p: PlayerState) {
  base.grenades.push({
    x: p.x,
    y: p.y + 1,
    z: p.depthZ,
    fuse: 0.85,
    originZ: p.depthZ,
    originY: p.y + 1,
  });
}
/** Clears active combatants, preserving mandatory core objectives. */
export function purgeDepth(s: RunState): boolean {
  const base = s.base!;
  base.hostile = [];
  let bossDefeated = false;
  for (const t of base.targets) {
    if (
      t.hp <= 0 ||
      t.kind === 'core' ||
      t.kind === 'cache' ||
      t.kind === 'relay' ||
      t.kind === 'head' ||
      (t.kind === 'boss' && depthBossProtected(base))
    )
      continue;
    t.hp = t.kind === 'boss' ? Math.max(0, t.hp - 20) : 0;
    t.flash = 0.2;
    effect(base, t.x, t.y, t.z, true);
    if (t.kind === 'boss') {
      s.enemies.find((e) => e.kind === 'boss')!.hp = t.hp;
      bossDefeated = t.hp <= 0;
    } else {
      s.kills++;
      s.combo++;
      s.comboTime = 3;
      s.score += 100 * Math.min(5, 1 + Math.floor(s.combo / 5));
    }
  }
  return bossDefeated;
}
function effect(
  base: DepthState,
  x: number,
  y: number,
  z: number,
  boom = false,
  weapon?: Weapon,
  defeat = false,
) {
  base.effects.push({
    x,
    y,
    z,
    life: boom ? 0.55 : 0.2,
    boom,
    ...(defeat ? { defeat: true } : {}),
    ...(!boom ? { kind: 'hit' as const } : {}),
    ...(weapon ? { weapon } : {}),
  });
}
function shootAt(base: DepthState, t: DepthTarget, x: number, y: number, speed: number, z = 0) {
  if (base.hostile.length >= 100) return;
  const distance = Math.hypot(x - t.x, y - t.y, z - t.z);
  base.hostile.push({
    x: t.x,
    y: t.y,
    z: t.z,
    vx: ((x - t.x) / distance) * speed,
    vy: ((y - t.y) / distance) * speed,
    vz: ((z - t.z) / distance) * speed,
  });
}
interface DepthHooks {
  hurt: (p: PlayerState) => void;
  bossDefeated: () => void;
  note: (text: string) => void;
  previous: Map<number, { x: number; y: number; depthZ: number }>;
}
/** All projectiles use world-space depth; the SVG projection never determines a hit. */
export function stepDepth(s: RunState, dt: number, hooks: DepthHooks) {
  const base = s.base!;
  const boss = s.enemies.find((e) => e.kind === 'boss')!;
  base.age += dt;
  base.fieldPulse = Math.max(0, base.fieldPulse - dt);
  base.effects = base.effects.filter((e) => (e.life -= dt) > 0);
  if (base.transition > 0) {
    base.transition = Math.max(0, base.transition - dt);
    if (!base.transition) {
      base.room++;
      base.age = 0;
      populate(base, boss.maxHp, s.levelIndex, !!s.partner);
      s.arena = depthIsBossRoom(base);
      s.supplies = [
        { x: 5, y: 0.8, kind: base.room % 2 ? 'laser' : 'homing', taken: false },
        { x: 17, y: 0.8, kind: 'health', taken: false },
      ];
      for (const p of players(s)) {
        p.grenades = Math.min(5, p.grenades + 1);
        p.depthZ = 0;
        p.y = 0;
        p.vy = 0;
        p.grounded = true;
        p.support = 0;
      }
      hooks.note(
        s.arena
          ? '先拆除外围节点，再攻击主核心；对齐节点只在重合时暴露。'
          : `${depthRoomTitle(s)} · 屏障通电，先拆核心再按上前进`,
      );
    }
    return;
  }
  for (const t of base.targets)
    if (t.kind === 'head') {
      const slot = t.slot ?? 0;
      t.x =
        t.originX +
        Math.sin(base.age * 1.2 + (Math.floor(slot / 2) * Math.PI) / 2) * (slot % 2 ? 1 : -1) * 1.8;
    }
  const damageTarget = (t: DepthTarget, damage: number, weapon?: Weapon) => {
    if (t.hp <= 0) return;
    if (
      (t.kind === 'boss' && depthBossProtected(base)) ||
      (t.kind === 'head' && !depthTargetOpen(base, t))
    ) {
      effect(base, t.x, t.y, t.z, false, weapon);
      return;
    }
    t.hp -= damage * (depthTargetOpen(base, t) ? 1 : 0.35);
    t.flash = 0.08;
    effect(base, t.x, t.y, t.z, false, weapon);
    if (t.kind === 'boss') boss.hp = t.hp;
    if (t.hp > 0) return;
    effect(base, t.x, t.y, t.z, true, weapon, t.kind === 'boss');
    if (t.kind === 'boss') {
      hooks.bossDefeated();
      return;
    }
    if (t.kind === 'cache') {
      s.score += 75;
      s.supplies.push({ x: t.x, y: 0.8, kind: t.drop ?? 'overclock', taken: false });
      hooks.note('补给回执已解锁 · 横移领取前方道具');
      return;
    }
    s.kills++;
    s.combo++;
    s.comboTime = 3;
    s.score += (t.kind === 'core' ? 350 : 100) * Math.min(5, 1 + Math.floor(s.combo / 5));
  };
  for (const b of base.shots) {
    if (b.weapon === 'homing') {
      const target = base.targets
        .filter(
          (t) =>
            t.hp > 0 &&
            t.kind !== 'cache' &&
            !(t.kind === 'boss' && depthBossProtected(base)) &&
            t.z > b.z,
        )
        .sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
      if (target) {
        b.vx = clamp((target.x - b.x) * 7, -20, 20);
        b.vy = clamp((target.y - b.y) * 7, -12, 12);
      }
    }
    let nx = b.x + b.vx * dt,
      ny = b.y + b.vy * dt;
    const nz = b.z + b.vz * dt;
    if (b.weapon === 'flame') {
      const orbit = fireballDelta(b.age ?? 0, dt);
      nx += orbit.forward;
      ny += orbit.side;
    }
    b.age = (b.age ?? 0) + dt;
    for (const t of base.targets) {
      if (t.hp <= 0 || b.hits.includes(t.id) || b.z > t.z || nz < t.z) continue;
      const f = (t.z - b.z) / (nz - b.z),
        x = b.x + (nx - b.x) * f,
        y = b.y + (ny - b.y) * f;
      const half = t.kind === 'boss' ? 2.4 : t.kind === 'core' ? 0.9 : 0.65;
      if (
        Math.abs(x - t.x) > half + b.radius ||
        Math.abs(y - t.y) > (t.kind === 'boss' ? 1.8 : 0.65) + b.radius
      )
        continue;
      damageTarget(t, b.damage, b.weapon);
      b.hits.push(t.id);
      if (b.weapon !== 'laser' && b.weapon !== 'flame') {
        b.z = 99;
        break;
      }
    }
    if (b.z !== 99) {
      b.x = nx;
      b.y = ny;
      b.z = nz;
    }
  }
  base.shots = base.shots.filter(
    (b) =>
      b.z < 24 &&
      b.x > -2 &&
      b.x < 24 &&
      b.y > -1 &&
      b.y < 9 &&
      (b.weapon !== 'flame' || (b.age ?? 0) < FIREBALL.lifetime),
  );
  for (const g of base.grenades) {
    g.z += 22 * dt;
    g.y = g.originY + Math.sin(Math.min(1, (g.z - g.originZ) / 19) * Math.PI) * 3;
    g.fuse -= dt;
    if (g.fuse > 0) continue;
    effect(base, g.x, g.y, g.z, true);
    base.hostile = base.hostile.filter((b) => Math.hypot(b.x - g.x, b.y - g.y, b.z - g.z) > 5);
    for (const t of base.targets)
      if (t.hp > 0 && Math.hypot(t.x - g.x, t.y - g.y, t.z - g.z) < 5) damageTarget(t, 14);
  }
  base.grenades = base.grenades.filter((g) => g.fuse > 0);
  if (s.phase !== 'running') {
    base.hostile = [];
    return;
  }
  if (
    !depthIsBossRoom(base) &&
    !base.gateOpen &&
    base.targets.filter((t) => t.kind === 'core').every((t) => t.hp <= 0)
  ) {
    base.gateOpen = true;
    s.score += 600;
    hooks.note('屏障已断电 · 按 W / 上方向键前进；双人需一起抵达出口');
  }
  if (
    !depthIsBossRoom(base) &&
    base.gateOpen &&
    players(s).length &&
    players(s).every((p) => p.depthZ >= DEPTH_EXIT_Z)
  ) {
    base.transition = 1.5;
    base.hostile = [];
    base.shots = [];
    base.grenades = [];
    hooks.note('全员抵达出口 · 正在进入下一机房');
    return;
  }
  for (const t of base.targets) {
    if (t.hp <= 0 || t.kind === 'cache') continue;
    t.age += dt;
    t.flash = Math.max(0, t.flash - dt);
    t.cooldown -= dt;
    if (t.kind === 'drone') {
      t.x = t.originX + Math.sin(t.age * 1.3) * 3;
      t.z = 9 + Math.sin(t.age) * 2;
    }
    const live = players(s),
      target = live[(t.id + t.volley) % live.length];
    if (!target) continue;
    if (t.cooldown <= 0.65 && !t.aim)
      t.aim = { x: target.x, y: target.y + (target.crouching ? 0.28 : 0.7), z: target.depthZ };
    if (t.cooldown > 0) continue;
    const aim = t.aim ?? { x: target.x, y: target.y + 0.7, z: target.depthZ };
    t.volley++;
    const phase = t.hp / t.maxHp > 0.65 ? 1 : t.hp / t.maxHp > 0.3 ? 2 : 3;
    const speed = (t.kind === 'boss' ? 10 + phase : 8.5) * (s.difficulty === 'hard' ? 1.2 : 1);
    if (t.kind === 'boss' && t.volley % 3 === 0) {
      const safe = t.volley % 7;
      for (let lane = 0; lane < 7; lane++)
        if (lane !== safe) shootAt(base, t, 2 + lane * 3, t.volley % 2 ? 1 : 0.25, speed, aim.z);
    } else {
      const fan = t.kind === 'boss' ? phase : 0;
      for (let i = -fan; i <= fan; i++) shootAt(base, t, aim.x + i * 2.2, aim.y, speed, aim.z);
    }
    t.aim = undefined;
    t.cooldown =
      (t.kind === 'boss' ? 1.9 - phase * 0.2 : t.kind === 'core' ? 3.8 : 2.5) *
      (s.difficulty === 'hard' ? 0.8 : 1);
    if (t.kind === 'boss') {
      boss.age = t.age;
      boss.volley = t.volley;
      boss.cooldown = t.cooldown;
    }
    if (
      s.levelIndex === 5 &&
      t.kind === 'boss' &&
      t.volley % 3 === 1 &&
      base.targets.filter((n) => n.kind === 'drone' && n.hp > 0).length < 3
    )
      base.targets.push(makeTarget(base.nextId++, 'drone', 4 + (t.volley % 5) * 3, 3.4, 4, 9));
  }
  for (const b of base.hostile) {
    const nx = b.x + b.vx * dt,
      ny = b.y + b.vy * dt,
      nz = b.z + b.vz * dt;
    const crossings = players(s)
      .flatMap((p) => {
        const old = hooks.previous.get(p.playerId) ?? p;
        const from = b.z - old.depthZ,
          to = nz - p.depthZ;
        if (from * to > 0 || from === to) return [];
        const f = from / (from - to);
        const x = b.x + (nx - b.x) * f,
          y = b.y + (ny - b.y) * f;
        const px = old.x + (p.x - old.x) * f,
          py = old.y + (p.y - old.y) * f;
        return Math.abs(x - px) < 0.5 &&
          y > py - 0.18 &&
          y < py + (p.crouching ? 0.48 : 1.25) + 0.18
          ? [{ p, f }]
          : [];
      })
      .sort((a, b) => a.f - b.f);
    if (crossings[0]) {
      hooks.hurt(crossings[0].p);
      b.z = -99;
      continue;
    }
    b.x = nx;
    b.y = ny;
    b.z = nz;
  }
  base.hostile = base.hostile.filter(
    (b) => b.z > -0.5 && b.z < 26 && b.x > -4 && b.x < 26 && b.y > -3 && b.y < 12,
  );
  if (depthIsBossRoom(base))
    base.targets = base.targets.filter((target) => target.kind !== 'drone' || target.hp > 0);
}
