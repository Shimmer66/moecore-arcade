import {
  levels,
  platformAt,
  platformsAt,
  type EnemyKind,
  type Weapon,
  type Supply,
  type SupplyCarrier,
} from './levels';
import {
  cloneDepth,
  createDepth,
  fireDepth,
  grenadeDepth,
  purgeDepth,
  depthIsBossRoom,
  DEPTH_FIELD_Z,
  DEPTH_EXIT_Z,
  stepDepth,
  type DepthState,
} from './depth';
import { FIREBALL, fireballDelta } from './fireball';
export { levels } from './levels';
export type { Weapon } from './levels';
export type Persona = 'deepseek' | 'gpt' | 'claude';
export type Difficulty = 'normal' | 'classic' | 'hard';
export type Phase = 'running' | 'level-complete' | 'won' | 'lost';
export const FIXED_DT = 1 / 60;
export const buffs = {
  overclock: {
    name: '算力超频',
    seconds: 12,
    color: '#ffbe6d',
    description: '12 秒射速提升 · 换枪保留',
  },
  barrier: {
    name: '沙盒力场',
    seconds: 6,
    color: '#ddaaff',
    description: '6 秒免疫攻击 · 无法抵挡坠落',
  },
  purge: {
    name: '全量清理',
    seconds: 0,
    color: '#9bf9ff',
    description: '清除附近杂兵与弹幕 · 对 Boss 造成 20 伤害',
  },
} as const;
export const weaponOrder: Weapon[] = ['pulse', 'spread', 'rapid', 'laser', 'flame', 'homing'];
export const difficultyNames: Record<Difficulty, string> = {
  normal: '街机',
  classic: '经典',
  hard: '硬核',
};
export const initialContinues = (difficulty: Difficulty) => (difficulty === 'classic' ? 3 : 2);
export const personas = {
  deepseek: { name: 'DeepSeek 娘', style: '深度推演', perk: '追踪弹开局 · 不语，只是一味地推演' },
  gpt: { name: 'GPT 娘', style: '火力生成', perk: '速射开局 · 一秒生成八百个 Token' },
  claude: { name: 'Claude 娘', style: '安全护航', perk: '护盾开局 · 礼貌，但火力充足' },
} as const;
export const weapons: Record<
  Weapon,
  { name: string; letter: string; color: string; description: string }
> = {
  pulse: { name: '提示词步枪', letter: 'P', color: '#fff1a1', description: '稳定、无限弹药' },
  spread: { name: '发散思维', letter: 'S', color: '#ffbd6e', description: '五向散射 · 覆盖扇面' },
  rapid: { name: 'Token 洪流', letter: 'M', color: '#77eece', description: '高速连射 · 持续压制' },
  laser: { name: '思维链激光', letter: 'L', color: '#80ceff', description: '贯穿多个目标' },
  flame: {
    name: '温度拉满',
    letter: 'F',
    color: '#ff9276',
    description: '旋转火球 · 波动覆盖与穿透',
  },
  homing: { name: '深度推演', letter: 'H', color: '#d3acff', description: '自动修正弹道' },
};
export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  originX: number;
  originY: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  age: number;
  volley: number;
  flash: number;
}
export interface Bullet {
  age?: number;
  owner?: 1 | 2;
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  damage: number;
  radius: number;
  weapon: Weapon;
  hits: number[];
}
export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  radius: number;
}
export interface Grenade {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
}
export interface Effect {
  id: number;
  x: number;
  y: number;
  kind: 'hit' | 'boom' | 'shield' | 'pickup';
  life: number;
}
export interface PlayerState {
  playerId: 1 | 2;
  persona: Persona;
  x: number;
  y: number;
  vy: number;
  depthZ: number;
  facing: -1 | 1;
  crouching: boolean;
  grounded: boolean;
  support: number | null;
  dropThrough: number;
  dropHeight: number;
  dropSupport: number | null;
  aimX: number;
  aimY: number;
  coyote: number;
  jumpBuffer: number;
  health: number;
  lives: number;
  shield: number;
  invulnerable: number;
  overclock: number;
  barrier: number;
  weapon: Weapon;
  arsenal: Weapon[];
  latestWeapon: Weapon | null;
  grenades: number;
  grenadeCooldown: number;
  shotCooldown: number;
  checkpoint: number;
  checkpointY: number;
  moving: boolean;
}
export interface RunState extends PlayerState {
  base?: DepthState | undefined;
  difficulty: Difficulty;
  levelIndex: number;
  phase: Phase;
  partner?: PlayerState | undefined;
  bullets: Bullet[];
  enemyBullets: EnemyBullet[];
  thrown: Grenade[];
  enemies: Enemy[];
  supplies: (Supply & {
    taken: boolean;
    falling?: boolean;
    vy?: number;
    support?: number | null;
  })[];
  carriers: (SupplyCarrier & {
    id: number;
    originX: number;
    originY: number;
    hp: number;
    flash: number;
  })[];
  effects: Effect[];
  verified: number[];
  elapsed: number;
  stageTime: number;
  score: number;
  kills: number;
  combo: number;
  comboTime: number;
  arena: boolean;
  continues: number;
  notice: string;
  noticeTime: number;
  nextId: number;
  deaths: number;
  sector: number;
}
export interface RunInput {
  horizontal: -1 | 0 | 1;
  jump: boolean;
  shoot: boolean;
  vertical?: -1 | 0 | 1;
  grenade?: boolean;
  lockAim?: boolean;
  equipWeapon?: Weapon | undefined;
  cycleWeapon?: -1 | 1 | undefined;
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const maxHealth = (difficulty: Difficulty) => (difficulty === 'normal' ? 3 : 1);
const initialWeapon = (persona: Persona, difficulty: Difficulty): Weapon =>
  difficulty === 'classic'
    ? 'pulse'
    : persona === 'deepseek'
      ? 'homing'
      : persona === 'gpt'
        ? 'rapid'
        : 'pulse';
export const teamPlayers = (s: RunState): PlayerState[] => (s.partner ? [s, s.partner] : [s]);
function newPlayer(persona: Persona, difficulty: Difficulty, playerId: 1 | 2): PlayerState {
  return {
    playerId,
    persona,
    x: playerId === 1 ? 2 : 3.2,
    y: 0,
    vy: 0,
    depthZ: 0,
    facing: 1,
    crouching: false,
    grounded: true,
    support: 0,
    dropThrough: 0,
    dropHeight: 0,
    dropSupport: null,
    aimX: 1,
    aimY: 0,
    coyote: 0.1,
    jumpBuffer: 0,
    health: maxHealth(difficulty),
    lives: 3,
    shield: difficulty !== 'classic' && persona === 'claude' ? 1 : 0,
    invulnerable: 1.5,
    overclock: 0,
    barrier: 0,
    weapon: initialWeapon(persona, difficulty),
    arsenal: [...new Set<Weapon>(['pulse', initialWeapon(persona, difficulty)])],
    latestWeapon: null,
    grenades: difficulty === 'classic' ? 0 : 3,
    grenadeCooldown: 0,
    shotCooldown: 0,
    checkpoint: 2,
    checkpointY: 0,
    moving: false,
  };
}
export function createRun(
  persona: Persona = 'deepseek',
  levelIndex = 0,
  difficulty: Difficulty = 'normal',
  partnerPersona?: Persona,
  bossOnly = false,
): RunState {
  const level = levels[levelIndex];
  if (!level) throw new Error(`Unknown level ${levelIndex}`);
  const bossHp = Math.ceil((85 + levelIndex * 19) * (partnerPersona ? 1.6 : 1));
  const run: RunState = {
    ...newPlayer(persona, difficulty, 1),
    partner: partnerPersona ? newPlayer(partnerPersona, difficulty, 2) : undefined,
    difficulty,
    levelIndex,
    phase: 'running',
    base:
      level.axis === 'depth'
        ? createDepth(levelIndex, bossHp, !!partnerPersona, bossOnly)
        : undefined,
    bullets: [],
    enemyBullets: [],
    thrown: [],
    effects: [],
    verified: [],
    enemies: level.enemies.map((e, id) => {
      const hp =
        e.kind === 'boss'
          ? bossHp
          : e.kind === 'heart'
            ? Math.ceil(12 * (partnerPersona ? 1.4 : 1))
            : e.kind === 'pod'
              ? 8
              : e.kind === 'turret'
                ? 7
                : e.kind === 'sniper'
                  ? 5
                  : e.kind === 'larva'
                    ? 2
                    : 3;
      return {
        ...e,
        id,
        originX: e.x,
        originY: e.y,
        hp,
        maxHp: hp,
        cooldown: 1.1 + (id % 4) * 0.24,
        age: 0,
        volley: 0,
        flash: 0,
      };
    }),
    supplies: level.supplies.map((s) => ({ ...s, taken: false })),
    carriers: level.carriers.map((c, i) => ({
      ...c,
      originX: c.x,
      originY: c.y,
      id: -1000 - i,
      hp: 3,
      flash: 0,
    })),
    elapsed: 0,
    stageTime: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTime: 0,
    arena: bossOnly,
    continues: initialContinues(difficulty),
    notice: level.hint,
    noticeTime: 5,
    nextId: 0,
    deaths: 0,
    sector: -1,
  };
  if (bossOnly) {
    for (const p of teamPlayers(run)) {
      p.x = level.length - 20 + (p.playerId - 1) * 1.2;
      p.y = level.arenaY;
      p.checkpoint = p.x;
      p.checkpointY = p.y;
    }
    run.enemies = run.enemies.filter((e) => e.kind === 'boss' || e.kind === 'heart');
    run.carriers = [];
  }
  return run;
}
export function advanceLevel(s: RunState): RunState {
  if (s.phase !== 'level-complete') return s;
  const n = createRun(s.persona, s.levelIndex + 1, s.difficulty, s.partner?.persona);
  if (n.partner && s.partner) {
    n.partner.weapon = s.partner.weapon;
    n.partner.arsenal = [...s.partner.arsenal];
    n.partner.overclock = s.partner.overclock;
    n.partner.barrier = s.partner.barrier;
    n.partner.lives = Math.min(5, s.partner.lives + 1);
    n.partner.shield = s.partner.shield;
    n.partner.grenades = Math.min(5, s.partner.grenades + 2);
  }
  return {
    ...n,
    weapon: s.weapon,
    arsenal: [...s.arsenal],
    overclock: s.overclock,
    barrier: s.barrier,
    lives: Math.min(5, s.lives + 1),
    shield: s.shield,
    grenades: Math.min(5, s.grenades + 2),
    elapsed: s.elapsed,
    score: s.score,
    kills: s.kills,
    continues: s.continues,
    deaths: s.deaths,
  };
}
export function retryLevel(s: RunState): RunState {
  if (s.phase !== 'lost' || s.continues <= 0) return s;
  return {
    ...createRun(s.persona, s.levelIndex, s.difficulty, s.partner?.persona),
    continues: s.continues - 1,
    score: Math.max(0, s.score - 2000),
    kills: s.kills,
    elapsed: s.elapsed,
    deaths: s.deaths,
  };
}
export function bossPhase(e: Enemy): number {
  return e.hp / e.maxHp > 0.65 ? 1 : e.hp / e.maxHp > 0.3 ? 2 : 3;
}
export function bossIsOpen(e: Enemy): boolean {
  return e.kind === 'boss' && (e.age % 5 > 2.2 || e.hp < e.maxHp * 0.3);
}
export const finalHeartCount = (s: RunState) =>
  s.levelIndex === 7 ? s.enemies.filter((e) => e.kind === 'heart' && e.hp > 0).length : 0;
export const finalPodCount = (s: RunState) =>
  s.levelIndex === 7 ? s.enemies.filter((e) => e.kind === 'pod' && e.hp > 0).length : 0;
export const bossProtected = (s: RunState, e: Enemy) =>
  e.kind === 'boss' && s.levelIndex === 7 && finalHeartCount(s) > 0;
export const bossVulnerable = (s: RunState, e: Enemy) => !bossProtected(s, e) && bossIsOpen(e);
export function hazardState(index: number, time: number): 'safe' | 'warning' | 'active' {
  const cycle = (time + index * 0.8) % 4.8;
  return cycle < 2.5 ? 'safe' : cycle < 3.5 ? 'warning' : 'active';
}
function note(s: RunState, text: string) {
  s.notice = text;
  s.noticeTime = 2.8;
}
function fx(s: RunState, x: number, y: number, kind: Effect['kind']) {
  s.effects.push({ id: s.nextId++, x, y, kind, life: kind === 'boom' ? 0.55 : 0.24 });
}
function reconnect(s: RunState, p: PlayerState) {
  const other = teamPlayers(s).find((n) => n.playerId !== p.playerId && n.lives > 0);
  const floor =
    other &&
    levels[s.levelIndex]!.platforms.filter(
      (t) =>
        !t.motion &&
        !t.conveyor &&
        other.x >= t.from + 0.3 &&
        other.x <= t.to - 0.3 &&
        t.top <= other.y &&
        other.y - t.top < 3,
    ).sort((a, b) => b.top - a.top)[0];
  p.x =
    other && floor
      ? clamp(other.x + (p.playerId === 1 ? -0.6 : 0.6), floor.from + 0.3, floor.to - 0.3)
      : p.checkpoint;
  p.y = floor?.top ?? p.checkpointY;
  p.vy = 0;
  p.depthZ = 0;
  p.grounded = true;
  p.support = null;
  p.dropThrough = 0;
  p.dropSupport = null;
  p.overclock = 0;
  p.barrier = 0;
  p.health = maxHealth(s.difficulty);
  p.invulnerable = 2.5;
  p.weapon = 'pulse';
  p.shield = 0;
  p.grenades = Math.max(2, p.grenades);
}
export function shareLife(state: RunState, recipient: 1 | 2): RunState {
  if (!state.partner || state.phase !== 'running') return state;
  const s = {
    ...state,
    arsenal: [...state.arsenal],
    partner: { ...state.partner, arsenal: [...state.partner.arsenal] },
  };
  const target = recipient === 1 ? s : s.partner;
  const donor = recipient === 1 ? s.partner : s;
  if (target.lives > 0 || donor.lives < 2) return state;
  donor.lives--;
  target.lives = 1;
  reconnect(s, target);
  note(s, `协作请求通过 · P${recipient} 借命重新连接`);
  return s;
}
function hurt(s: RunState, p: PlayerState, fell = false) {
  if (p.lives <= 0 || ((p.invulnerable > 0 || p.barrier > 0) && !fell)) return;
  if (p.shield > 0 && !fell) {
    p.shield--;
    p.invulnerable = 1;
    fx(s, p.x, p.y + 0.7, 'shield');
    return;
  }
  p.health = fell ? 0 : p.health - 1;
  p.invulnerable = 1.3;
  s.combo = 0;
  fx(s, p.x, p.y + 0.7, 'hit');
  if (p.health > 0) return;
  p.arsenal = p.arsenal.filter((w) => w === 'pulse' || w !== p.weapon);
  p.latestWeapon = null;
  p.weapon = 'pulse';
  p.overclock = 0;
  p.barrier = 0;
  p.shield = 0;
  p.lives--;
  s.deaths++;
  if (p.lives <= 0) {
    if (teamPlayers(s).every((n) => n.lives <= 0)) s.phase = 'lost';
    note(
      s,
      s.phase === 'lost'
        ? '全员连接已断开。'
        : `P${p.playerId} 离线 · 队友可分享一命，或坚持到下一关`,
    );
    return;
  }
  reconnect(s, p);
  if (!s.partner) {
    s.enemyBullets = [];
    s.thrown = [];
  }
  note(s, `P${p.playerId} 重新连接！武器重置，2.5 秒保护。`);
}
function kill(s: RunState, e: Enemy) {
  s.kills++;
  s.combo++;
  s.comboTime = 3;
  s.score += (e.kind === 'boss' ? 4000 : 100) * Math.min(5, 1 + Math.floor(s.combo / 5));
  fx(s, e.x, e.y + 0.7, 'boom');
  if (e.kind === 'boss') {
    s.enemyBullets = [];
    s.score += Math.max(0, 1500 - Math.floor(s.stageTime * 5));
    s.phase = s.levelIndex === levels.length - 1 ? 'won' : 'level-complete';
    note(s, '核验通过。出口已解锁！');
  } else if (e.kind === 'heart') {
    const remaining = finalHeartCount(s);
    note(
      s,
      remaining ? `推理心核已破坏 · 还剩 ${remaining} 个` : '三枚心核全部失效 · 幻觉之母本体暴露',
    );
  } else if (e.kind === 'pod') {
    note(s, `孵化节点已关闭 · 还剩 ${finalPodCount(s)} 个`);
  } else if (e.id % 7 === 4) {
    s.supplies.push({ x: e.x, y: e.y + 0.7, kind: 'grenade', taken: false });
  }
}
function enemyShot(s: RunState, x: number, y: number, angle: number, speed = 8, radius = 0.13) {
  if (s.enemyBullets.length >= 180) return;
  s.enemyBullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    ttl: 5,
    radius,
  });
}
export interface BossAttack {
  label: string;
  shots: { x: number; y: number; angle: number; speed: number; radius: number }[];
  summon: boolean;
}
export function attackTarget(s: RunState, e: Enemy, volley = e.volley + 1): PlayerState {
  const live = teamPlayers(s).filter((p) => p.lives > 0);
  return live[(e.id + volley) % live.length] ?? s;
}
/** The renderer and simulation use the same next-volley description for honest telegraphs. */
export function bossAttack(s: RunState, e: Enemy, volley = e.volley + 1): BossAttack {
  const target = attackTarget(s, e, volley);
  const phase = bossPhase(e);
  const left = levels[s.levelIndex]!.length - 22;
  const attack: BossAttack = { label: '', shots: [], summon: false };
  const shot = (x: number, y: number, angle: number, speed = 8, radius = 0.14) =>
    attack.shots.push({ x, y: e.y + y, angle, speed, radius });
  const aimed = (x: number, y: number, count: number) => {
    const angle = Math.atan2(target.y + (target.crouching ? 0.28 : 0.7) - e.y - y, target.x - x);
    for (let i = -count; i <= count; i++) shot(x, y, angle + i * 0.16, 8 + phase);
  };
  // Final inference combines earlier mechanics instead of merely increasing bullet health.
  const mode = s.levelIndex === 7 ? (volley + phase) % 7 : s.levelIndex;
  if (mode === 0) {
    attack.label = '429 限流：批量请求 · 从扇形间隙穿过';
    const count = 3 + phase * 2;
    const aim = Math.atan2(target.y + 0.7 - e.y - 1.5, target.x - e.x);
    for (let i = 0; i < count; i++) shot(e.x, 1.5, aim + (i - (count - 1) / 2) * 0.13, 6 + phase);
  } else if (mode === 1) {
    const high = volley % 2 === 1;
    attack.label = high ? '回执送达：高位扫描 · 卧倒' : '消息撤回：低位扫描 · 跳跃';
    for (let i = 0; i < 3 + phase; i++)
      shot(e.x + i * 1.15, high ? 0.98 : 0.22, Math.PI, 9 + phase);
  } else if (mode === 2) {
    attack.label = '上下文过期：记忆碎片下落 · 进入空列';
    const safeColumn = volley % 6;
    for (let i = 0; i < 7; i++)
      if (Math.abs(i - safeColumn) > 0)
        shot(left + 1.4 + i * 2.7, 9, -Math.PI / 2, 4.8 + phase * 0.5, 0.2);
  } else if (mode === 3) {
    attack.label = '引用缝合：左右交叉引用 · 留意身后';
    aimed(e.x - 0.8, 2.5, phase - 1);
    shot(left + 0.2, volley % 2 ? 0.98 : 0.2, 0, 6.5);
  } else if (mode === 4) {
    attack.label = 'Token 燃烧：炉口喷发 · 跨越低弹';
    for (let i = 0; i < 2 + phase; i++) shot(e.x + i * 1.3, 0.22, Math.PI, 8.5);
    // A fixed, announced column moves each volley; no projectile appears on the player.
    shot(left + 3 + (volley % 4) * 3.5, 8, -Math.PI / 2, 5, 0.3);
  } else if (mode === 5) {
    attack.label = '递归调用：生成子智能体 · 清除无人机';
    attack.summon = volley % 2 === 1;
    aimed(e.x - 0.8, 1.6, phase - 1);
  } else {
    attack.label = '安全拒绝：防火墙推进 · 寻找通行窗口';
    const gap = [0, 2, 3][volley % 3]!;
    for (let row = 0; row < 7; row++) {
      const y = 0.25 + row * 0.8;
      // The opening fits the player's whole body at a reachable jump height.
      if (row < gap || row > gap + 2) shot(e.x - 0.8, y, Math.PI, 6.5 + phase * 0.3, 0.12);
    }
  }
  return attack;
}
function updateEnemies(s: RunState, dt: number) {
  const level = levels[s.levelIndex]!;
  for (const e of s.enemies) {
    if (
      e.hp <= 0 ||
      !teamPlayers(s).some(
        (p) => p.lives > 0 && Math.abs(e.x - p.x) <= 24 && Math.abs(e.y - p.y) <= 11,
      ) ||
      ((e.kind === 'boss' || e.kind === 'heart') && !s.arena)
    )
      continue;
    e.age += dt;
    e.flash = Math.max(0, e.flash - dt);
    e.cooldown -= dt;
    const target = attackTarget(s, e);
    const dir = target.x < e.x ? -1 : 1;
    if (e.kind === 'runner' || e.kind === 'hopper' || e.kind === 'larva') {
      const nextX = e.x + dir * (e.kind === 'larva' ? 3.6 : e.kind === 'hopper' ? 2.1 : 2.7) * dt;
      if (
        level.platforms.some(
          (p) => p.top === e.originY && nextX > p.from + 0.3 && nextX < p.to - 0.3,
        )
      )
        e.x = nextX;
      e.y =
        e.originY +
        (e.kind === 'hopper'
          ? Math.max(0, Math.sin(e.age * 3)) * 2.3
          : e.kind === 'larva'
            ? Math.max(0, Math.sin(e.age * 5)) * 0.45
            : 0);
    } else if (e.kind === 'drone') {
      e.x = e.originX + Math.sin(e.age * 0.9) * 2.3;
      e.y = e.originY + Math.sin(e.age * 2.2) * 0.65;
    }
    if (e.cooldown > 0) continue;
    if (e.kind === 'pod') {
      if (s.enemies.filter((n) => n.kind === 'larva' && n.hp > 0).length < 6) {
        const id = s.nextId++ + 2000;
        s.enemies.push({
          id,
          kind: 'larva',
          x: e.x - 0.8,
          y: e.y,
          originX: e.x - 0.8,
          originY: e.y,
          hp: 2,
          maxHp: 2,
          cooldown: 1.2,
          age: 0,
          volley: 0,
          flash: 0,
        });
      }
      e.cooldown = s.difficulty === 'hard' ? 2.3 : 3.2;
      note(s, '幻觉孵化：新的噪声幼体已生成');
      continue;
    }
    e.volley++;
    const sy = e.y + (e.kind === 'boss' ? 1.5 : 0.7);
    const aim = Math.atan2(target.y + (target.crouching ? 0.28 : 0.7) - sy, target.x - e.x);
    if (e.kind === 'boss') {
      const phase = bossPhase(e);
      const attack = bossAttack(s, e, e.volley);
      for (const b of attack.shots) enemyShot(s, b.x, b.y, b.angle, b.speed, b.radius);
      if (attack.summon && s.enemies.filter((n) => n.kind === 'drone' && n.hp > 0).length < 3) {
        const id = s.nextId++ + 1000;
        s.enemies.push({
          id,
          kind: 'drone',
          x: e.x - 5,
          y: e.y + 5,
          originX: e.x - 5,
          originY: e.y + 5,
          hp: 3,
          maxHp: 3,
          cooldown: 1.5,
          age: 0,
          volley: 0,
          flash: 0,
        });
      }
      e.cooldown =
        (1.8 - phase * 0.22 - s.levelIndex * 0.025) * (s.difficulty === 'hard' ? 0.8 : 1);
      note(s, attack.label);
    } else {
      if (e.kind === 'heart') {
        enemyShot(s, e.x, sy, aim, 9.2, 0.17);
        if (s.difficulty === 'hard') enemyShot(s, e.x, sy, aim + 0.18, 8.4, 0.14);
      } else if (e.kind === 'turret') {
        enemyShot(s, e.x, sy, dir < 0 ? Math.PI : 0, 8.5);
        if (s.levelIndex > 3) enemyShot(s, e.x, sy + 0.8, dir < 0 ? Math.PI : 0, 7);
      } else enemyShot(s, e.x, sy, aim, e.kind === 'sniper' ? 14 : 7.2);
      e.cooldown =
        (e.kind === 'larva'
          ? 1.9
          : e.kind === 'heart'
            ? 2.4
            : e.kind === 'runner'
              ? 2.7
              : e.kind === 'sniper'
                ? 2.2
                : 1.8) * (s.difficulty === 'hard' ? 0.72 : 1);
    }
  }
}
// Segment/AABB test prevents fast rounds from tunnelling through a target.
function segmentHit(
  x: number,
  y: number,
  nx: number,
  ny: number,
  left: number,
  bottom: number,
  right: number,
  top: number,
): boolean {
  let lo = 0,
    hi = 1;
  for (const [p, d, a, b] of [
    [x, nx - x, left, right],
    [y, ny - y, bottom, top],
  ]) {
    if (Math.abs(d!) < 1e-9) {
      if (p! < a! || p! > b!) return false;
    } else {
      const t1 = (a! - p!) / d!,
        t2 = (b! - p!) / d!;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
    }
  }
  return hi >= lo;
}
export function canCollect(p: PlayerState, kind: Supply['kind'], difficulty: Difficulty) {
  if (p.lives <= 0) return false;
  if (kind === 'health') return p.health < maxHealth(difficulty);
  if (kind === 'shield') return p.shield < 2;
  if (kind === 'grenade') return p.grenades < 5;
  if (kind === 'overclock') return p.overclock <= buffs.overclock.seconds / 2;
  if (kind === 'barrier') return p.barrier <= buffs.barrier.seconds / 2;
  if (kind === 'purge') return true;
  return !p.arsenal.includes(kind);
}
function hitCarrier(s: RunState, c: RunState['carriers'][number], damage: number) {
  if (c.hp <= 0) return;
  c.hp = Math.max(0, c.hp - damage);
  c.flash = 0.1;
  if (c.hp) return;
  s.score += 75;
  fx(s, c.x, c.y, 'boom');
  s.supplies.push({
    x: c.x,
    y: c.y,
    kind: c.drop,
    taken: false,
    falling: true,
    vy: 2,
    support: null,
  });
  note(s, '补给已释放 · 接住落下的道具');
}
function moveReleasedSupplies(s: RunState, dt: number) {
  const level = levels[s.levelIndex]!;
  const surfaces = platformsAt(level, s.stageTime);
  for (const drop of s.supplies) {
    if (drop.taken || !drop.falling) continue;
    if (drop.support !== null && drop.support !== undefined) {
      const before = platformAt(level.platforms[drop.support]!, Math.max(0, s.stageTime - dt));
      const after = surfaces[drop.support]!;
      drop.x += after.from - before.from + (after.conveyor ?? 0) * dt;
      drop.y += after.top - before.top;
    }
    const oldY = drop.y;
    drop.vy = (drop.vy ?? 0) - 13 * dt;
    drop.y += drop.vy * dt;
    drop.support = null;
    if (drop.vy <= 0) {
      const landing = surfaces
        .map((p, id) => ({ ...p, id }))
        .filter(
          (p) =>
            drop.x >= p.from && drop.x <= p.to && oldY >= p.top + 0.65 && drop.y <= p.top + 0.7,
        )
        .sort((a, b) => b.top - a.top)[0];
      if (landing) {
        drop.y = landing.top + 0.7;
        drop.vy = 0;
        drop.support = landing.id;
      }
    }
    if (drop.y < -5) drop.taken = true;
  }
}
function purge(s: RunState, p: PlayerState) {
  fx(s, p.x, p.y + 0.8, 'boom');
  if (s.base) {
    if (purgeDepth(s))
      kill(
        s,
        s.enemies.find((e) => e.kind === 'boss')!,
      );
    return;
  }
  s.enemyBullets = s.enemyBullets.filter((b) => Math.hypot(b.x - p.x, b.y - p.y) > 16);
  for (const e of s.enemies) {
    if (
      e.hp <= 0 ||
      e.kind === 'pod' ||
      e.kind === 'heart' ||
      (e.kind === 'boss' && (!s.arena || bossProtected(s, e))) ||
      Math.abs(e.x - p.x) > 14 ||
      Math.abs(e.y - p.y) > 9
    )
      continue;
    e.hp = e.kind === 'boss' ? Math.max(0, e.hp - 20) : 0;
    e.flash = 0.2;
    if (e.hp <= 0) kill(s, e);
  }
}
function collectSupplies(s: RunState, p: PlayerState) {
  if (s.base && p.depthZ > 1.2) return;
  for (const drop of s.supplies) {
    if (
      drop.taken ||
      !canCollect(p, drop.kind, s.difficulty) ||
      Math.abs(drop.x - p.x) > 0.7 ||
      Math.abs(drop.y - (p.y + 0.7)) > 0.9
    )
      continue;
    drop.taken = true;
    s.score += 50;
    fx(s, drop.x, drop.y, 'pickup');
    if (drop.kind === 'shield') {
      p.shield = Math.min(2, p.shield + 1);
      note(s, `P${p.playerId} 上下文已缓存 · 护盾 +1`);
    } else if (drop.kind === 'health') {
      p.health = maxHealth(s.difficulty);
      note(s, `P${p.playerId} 服务恢复 · 生命补满`);
    } else if (drop.kind === 'grenade') {
      p.grenades = Math.min(5, p.grenades + 2);
      note(s, `P${p.playerId} 清空上下文 · 手雷 +2`);
    } else if (drop.kind === 'overclock' || drop.kind === 'barrier') {
      p[drop.kind] = buffs[drop.kind].seconds;
      note(s, `P${p.playerId} ${buffs[drop.kind].name} · ${buffs[drop.kind].description}`);
    } else if (drop.kind === 'purge') {
      purge(s, p);
      if (s.phase === 'running') note(s, `P${p.playerId} 全量清理 · 噪声与弹幕已清除`);
    } else {
      p.arsenal.push(drop.kind);
      p.latestWeapon = drop.kind;
      note(
        s,
        `P${p.playerId} ${weapons[drop.kind].name} 已收纳 · 点击武器栏或${p.playerId === 1 ? ' Q / E' : ' [ / ]'} 切换`,
      );
    }
  }
}
function movePlayer(s: RunState, p: PlayerState, input: RunInput, seconds: number) {
  if (p.lives <= 0) return;
  if (input.equipWeapon && p.arsenal.includes(input.equipWeapon)) p.weapon = input.equipWeapon;
  else if (input.cycleWeapon) {
    const owned = weaponOrder.filter((w) => p.arsenal.includes(w));
    const index = owned.indexOf(p.weapon);
    p.weapon = owned[(index + input.cycleWeapon + owned.length) % owned.length]!;
  }
  if (p.latestWeapon === p.weapon) p.latestWeapon = null;
  const level = levels[s.levelIndex]!;
  const surfaces = platformsAt(level, s.stageTime);
  const previousTime = Math.max(0, s.stageTime - seconds);
  const supportDefinition = p.support === null ? undefined : level.platforms[p.support];
  if (p.grounded && supportDefinition) {
    const before = platformAt(supportDefinition, previousTime);
    const after = surfaces[p.support!]!;
    if (Math.abs(p.y - before.top) < 0.06 && p.x >= before.from && p.x <= before.to) {
      p.x += after.from - before.from;
      p.y += after.top - before.top;
      if (!input.jump) p.x += (after.conveyor ?? 0) * seconds;
    }
  }
  const other = teamPlayers(s).find((n) => n.playerId !== p.playerId && n.lives > 0);
  for (const key of [
    'invulnerable',
    'shotCooldown',
    'grenadeCooldown',
    'overclock',
    'barrier',
    'dropThrough',
  ] as const)
    p[key] = Math.max(0, p[key] - seconds);
  p.coyote = p.grounded ? 0.1 : Math.max(0, p.coyote - seconds);
  p.jumpBuffer = input.jump ? 0.12 : Math.max(0, p.jumpBuffer - seconds);
  const down = input.vertical === -1;
  if (
    down &&
    input.jump &&
    p.grounded &&
    supportDefinition &&
    supportDefinition.top > 0 &&
    !supportDefinition.solid &&
    !s.base
  ) {
    p.dropThrough = 0.4;
    p.dropHeight = p.y;
    p.dropSupport = p.support;
    p.support = null;
    p.grounded = false;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.vy = -2;
    p.y -= 0.06;
  }
  p.crouching = down && p.grounded && !input.horizontal;
  if (input.horizontal) p.facing = input.horizontal;
  p.aimX = input.vertical ? input.horizontal : p.facing;
  p.aimY = input.vertical ?? 0;
  if (p.crouching) {
    p.aimX = p.facing;
    p.aimY = 0;
  }
  if (p.aimX && p.aimY) {
    p.aimX *= Math.SQRT1_2;
    p.aimY *= Math.SQRT1_2;
  }
  const oldY = p.y;
  p.x = clamp(
    p.x + (input.lockAim || p.crouching ? 0 : input.horizontal * 7.4 * seconds),
    s.arena && !s.base ? level.length - 22 : 0.4,
    other && !s.arena && level.axis === 'horizontal' ? level.length - 21 : level.length - 1,
  );
  if (other && level.axis !== 'depth')
    p.x = clamp(p.x, Math.max(0.4, other.x - 8.5), Math.min(level.length - 1, other.x + 8.5));
  p.moving = !!input.horizontal && !input.lockAim && !p.crouching;
  if (
    p.jumpBuffer > 0 &&
    p.coyote > 0 &&
    level.axis === 'vertical' &&
    other &&
    p.y - other.y > 2.1
  ) {
    p.jumpBuffer = 0;
    note(s, '协作同步：先等队友登上下一层');
  }
  if (p.jumpBuffer > 0 && p.coyote > 0) {
    p.vy = 12.3;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.crouching = false;
  }
  p.vy -= 28 * seconds;
  p.y += p.vy * seconds;
  p.grounded = false;
  p.support = null;
  if (p.vy <= 0) {
    const landing = surfaces
      .map((platform, id) => ({ ...platform, id }))
      .filter(
        (platform) =>
          (p.dropThrough <= 0 ||
            (platform.id !== p.dropSupport && platform.top < p.dropHeight - 0.1)) &&
          p.x >= platform.from &&
          p.x <= platform.to &&
          oldY >=
            Math.min(platform.top, platformAt(level.platforms[platform.id]!, previousTime).top) -
              0.03 &&
          p.y <= platform.top,
      )
      .sort((a, b) => b.top - a.top)[0];
    if (landing) {
      p.y = landing.top;
      p.vy = 0;
      p.grounded = true;
      p.support = landing.id;
      if (landing.checkpoint && (landing.top > p.checkpointY || landing.from > p.checkpoint)) {
        p.checkpoint = clamp(p.x, landing.from + 0.6, landing.to - 0.6);
        p.checkpointY = landing.top;
        note(
          s,
          level.axis === 'vertical'
            ? `上下文已缓存 · 高度 ${landing.top} · 坠落后从这里重新连接`
            : '战地缓存已保存 · 阵亡后从这段安全地面重新连接',
        );
      }
    }
  }
  if (
    level.axis === 'horizontal' &&
    !s.arena &&
    p.x > level.length * 0.5 &&
    p.grounded &&
    p.y === 0 &&
    p.support !== null &&
    !surfaces[p.support]?.motion &&
    !surfaces[p.support]?.conveyor
  ) {
    const safeFloor = surfaces[p.support]!;
    p.checkpoint = Math.max(
      p.checkpoint,
      clamp(p.x - 0.4, safeFloor.from + 0.6, safeFloor.to - 0.6),
    );
  }
  if (s.base && !s.base.transition && !depthIsBossRoom(s.base) && input.vertical === 1) {
    const beforeZ = p.depthZ;
    const nextZ = beforeZ + 4.8 * seconds;
    p.depthZ = Math.min(s.base.gateOpen ? DEPTH_EXIT_Z : DEPTH_FIELD_Z - 0.6, nextZ);
    p.moving ||= p.depthZ > beforeZ;
    if (!s.base.gateOpen && nextZ > DEPTH_FIELD_Z - 0.6) {
      if (s.base.fieldPulse <= 0) note(s, '能源屏障仍通电 · 先射击后方核心，再向前推进');
      s.base.fieldPulse = 0.4;
      hurt(s, p);
      if (p.lives <= 0 || s.phase !== 'running') return;
    }
  }
  if (input.shoot && p.shotCooldown <= 0 && !s.base?.transition) {
    const angles = p.weapon === 'spread' ? [-0.28, -0.14, 0, 0.14, 0.28] : [0];
    const angle = Math.atan2(p.aimY, p.aimX);
    if (s.base) s.nextId += fireDepth(s.base, p, s.nextId);
    else
      for (const offset of angles) {
        const speed = p.weapon === 'laser' ? 42 : p.weapon === 'flame' ? FIREBALL.speed : 26;
        s.bullets.push({
          id: s.nextId++,
          owner: p.playerId,
          x: p.x + p.aimX * 0.4,
          y: p.y + (p.crouching ? 0.3 : 0.8),
          vx: Math.cos(angle + offset) * speed,
          vy: Math.sin(angle + offset) * speed,
          age: 0,
          ttl: p.weapon === 'flame' ? FIREBALL.lifetime : 0.95,
          damage: p.weapon === 'laser' ? 3 : p.weapon === 'flame' ? FIREBALL.damage : 1,
          radius: p.weapon === 'flame' ? FIREBALL.radius : 0.1,
          weapon: p.weapon,
          hits: [],
        });
      }
    p.shotCooldown =
      (p.overclock > 0 ? 0.65 : 1) *
      (p.weapon === 'rapid'
        ? 0.085
        : p.weapon === 'flame'
          ? FIREBALL.interval
          : p.weapon === 'laser'
            ? 0.23
            : 0.18);
  }
  if (input.grenade && p.grenades > 0 && p.grenadeCooldown <= 0 && !s.base?.transition) {
    p.grenades--;
    p.grenadeCooldown = 0.5;
    if (s.base) grenadeDepth(s.base, p);
    else s.thrown.push({ x: p.x, y: p.y + 1, vx: p.facing * 9, vy: 8, fuse: 0.8 });
  }
}
export function stepRun(
  state: RunState,
  input: RunInput,
  dt = FIXED_DT,
  partnerInput: RunInput = { horizontal: 0, jump: false, shoot: false },
): RunState {
  if (state.phase !== 'running') return state;
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const seconds = Math.min(dt, FIXED_DT);
  const s: RunState = {
    ...state,
    arsenal: [...state.arsenal],
    partner: state.partner ? { ...state.partner, arsenal: [...state.partner.arsenal] } : undefined,
    base: state.base ? cloneDepth(state.base) : undefined,
    bullets: state.bullets.map((b) => ({ ...b, hits: [...b.hits] })),
    enemyBullets: state.enemyBullets.map((b) => ({ ...b })),
    enemies: state.enemies.map((e) => ({ ...e })),
    supplies: state.supplies.map((p) => ({ ...p })),
    carriers: state.carriers.map((c) => ({ ...c })),
    effects: state.effects.map((e) => ({ ...e })),
    thrown: state.thrown.map((g) => ({ ...g })),
    verified: [...state.verified],
  };
  const level = levels[s.levelIndex]!;
  s.elapsed += seconds;
  s.stageTime += seconds;
  for (const key of ['noticeTime', 'comboTime'] as const) s[key] = Math.max(0, s[key] - seconds);
  if (!s.comboTime) s.combo = 0;
  s.effects = s.effects.filter((e) => (e.life -= seconds) > 0);
  for (const c of s.carriers) {
    c.flash = Math.max(0, c.flash - seconds);
    if (c.hp > 0 && c.kind === 'capsule') {
      c.x = c.originX + Math.sin(s.stageTime * 1.25) * 2.2;
      c.y = c.originY + Math.sin(s.stageTime * 2) * 0.4;
    }
  }
  const oldPositions = new Map(
    teamPlayers(s).map((p) => [p.playerId, { x: p.x, y: p.y, depthZ: p.depthZ }]),
  );
  movePlayer(s, s, input, seconds);
  if (s.partner) movePlayer(s, s.partner, partnerInput, seconds);
  if (s.base) {
    stepDepth(s, seconds, {
      previous: oldPositions,
      hurt: (p) => hurt(s, p),
      bossDefeated: () =>
        kill(
          s,
          s.enemies.find((e) => e.kind === 'boss')!,
        ),
      note: (text) => note(s, text),
    });
    for (const p of teamPlayers(s)) if (p.lives > 0) collectSupplies(s, p);
    return s;
  }
  const active = teamPlayers(s).filter((p) => p.lives > 0);
  if (!s.arena && active.length && level.sectors.length) {
    const front = Math.max(...active.map((p) => p.x));
    const nextSector = level.sectors.reduce(
      (last, sector, index) => (front >= sector.from ? index : last),
      -1,
    );
    if (nextSector > s.sector) {
      s.sector = nextSector;
      const sector = level.sectors[nextSector]!;
      note(s, `${sector.title} · ${sector.hint}`);
    }
  }
  if (
    !s.arena &&
    active.length &&
    active.every((p) =>
      level.axis === 'vertical' ? p.grounded && p.y >= level.arenaY : p.x >= level.length - 22,
    ) &&
    finalPodCount(s) === 0
  ) {
    s.arena = true;
    for (const p of active) {
      p.checkpoint = level.length - 21;
      p.checkpointY = level.arenaY;
    }
    s.enemyBullets = [];
    note(
      s,
      finalHeartCount(s)
        ? `${level.boss} · 三枚推理心核仍在保护本体`
        : `${level.boss} · 全员进入战区`,
    );
  }
  if (
    !s.arena &&
    finalPodCount(s) > 0 &&
    active.length &&
    active.every((p) => p.x >= level.length - 22) &&
    s.noticeTime <= 0
  )
    note(s, `终战入口被孵化网络锁定 · 还剩 ${finalPodCount(s)} 个节点`);
  updateEnemies(s, seconds);
  for (const b of s.bullets) {
    if (b.weapon === 'homing') {
      const target = s.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            (!['boss', 'heart'].includes(e.kind) || s.arena) &&
            Math.abs(e.x - b.x) < 12,
        )
        .sort(
          (a, c) => Math.hypot(a.x - b.x, a.y + 0.8 - b.y) - Math.hypot(c.x - b.x, c.y + 0.8 - b.y),
        )[0];
      if (target) {
        const a = Math.atan2(target.y + 0.8 - b.y, target.x - b.x);
        b.vx += (Math.cos(a) * 26 - b.vx) * 0.12;
        b.vy += (Math.sin(a) * 26 - b.vy) * 0.12;
      }
    }
    let nx = b.x + b.vx * seconds,
      ny = b.y + b.vy * seconds;
    if (b.weapon === 'flame') {
      const orbit = fireballDelta(b.age ?? 0, seconds);
      const axisX = b.vx / FIREBALL.speed,
        axisY = b.vy / FIREBALL.speed;
      nx += orbit.forward * axisX - orbit.side * axisY;
      ny += orbit.forward * axisY + orbit.side * axisX;
    }
    b.age = (b.age ?? 0) + seconds;
    for (const c of s.carriers) {
      if (
        c.hp <= 0 ||
        b.ttl <= 0 ||
        b.hits.includes(c.id) ||
        !segmentHit(
          b.x,
          b.y,
          nx,
          ny,
          c.x - 0.65 - b.radius,
          c.y - 0.55 - b.radius,
          c.x + 0.65 + b.radius,
          c.y + 0.55 + b.radius,
        )
      )
        continue;
      hitCarrier(s, c, b.damage);
      b.hits.push(c.id);
      if (b.weapon !== 'laser' && b.weapon !== 'flame') b.ttl = 0;
    }
    for (const e of s.enemies) {
      if (
        b.ttl <= 0 ||
        e.hp <= 0 ||
        b.hits.includes(e.id) ||
        ((e.kind === 'boss' || e.kind === 'heart') && !s.arena)
      )
        continue;
      const width =
          e.kind === 'boss' ? 1.3 : e.kind === 'heart' ? 0.85 : e.kind === 'pod' ? 0.7 : 0.48,
        height = e.kind === 'boss' ? 3.4 : e.kind === 'heart' ? 1.7 : e.kind === 'pod' ? 1.5 : 1.25;
      if (
        !segmentHit(
          b.x,
          b.y,
          nx,
          ny,
          e.x - width - b.radius,
          e.y - b.radius,
          e.x + width + b.radius,
          e.y + height + b.radius,
        )
      )
        continue;
      const guarded = bossProtected(s, e);
      e.hp -= guarded ? 0 : b.damage * (e.kind === 'boss' && !bossIsOpen(e) ? 0.35 : 1);
      e.flash = 0.08;
      b.hits.push(e.id);
      fx(s, nx, ny, 'hit');
      if (e.hp <= 0) kill(s, e);
      if (b.weapon !== 'laser' && b.weapon !== 'flame') {
        b.ttl = 0;
        break;
      }
    }
    level.hazards.forEach((h, i) => {
      if (
        h.kind === 'mirage' &&
        !s.verified.includes(i) &&
        segmentHit(b.x, b.y, nx, ny, h.from, (h.y ?? 0) - 0.1, h.to, (h.y ?? 0) + 0.9)
      ) {
        s.verified.push(i);
        note(s, '引用核验：查无此桥！跳过去。');
      }
    });
    b.x = nx;
    b.y = ny;
    b.ttl -= seconds;
  }
  s.bullets = s.bullets.filter((b) => b.ttl > 0 && b.y > -2 && b.y < level.height);
  for (const g of s.thrown) {
    g.vy -= 20 * seconds;
    g.x += g.vx * seconds;
    g.y += g.vy * seconds;
    g.fuse -= seconds;
    if (
      platformsAt(level, s.stageTime).some(
        (p) => g.x > p.from && g.x < p.to && g.y < p.top && g.y > p.top - 0.5,
      ) &&
      g.vy < 0
    ) {
      g.vy = 4;
      g.vx *= 0.6;
    }
    if (g.fuse > 0) continue;
    fx(s, g.x, Math.max(0.3, g.y), 'boom');
    s.enemyBullets = s.enemyBullets.filter((b) => Math.hypot(b.x - g.x, b.y - g.y) > 4);
    for (const c of s.carriers) if (Math.hypot(c.x - g.x, c.y - g.y) < 4.5) hitCarrier(s, c, 14);
    for (const e of s.enemies) {
      if (
        e.hp <= 0 ||
        e.kind === 'pod' ||
        e.kind === 'heart' ||
        (e.kind === 'boss' && (!s.arena || bossProtected(s, e))) ||
        Math.hypot(e.x - g.x, e.y + 1 - g.y) > 4.5
      )
        continue;
      e.hp -= 14;
      e.flash = 0.2;
      if (e.hp <= 0) kill(s, e);
    }
  }
  s.thrown = s.thrown.filter((g) => g.fuse > 0);
  moveReleasedSupplies(s, seconds);
  if (s.phase !== 'running') return s;
  for (const b of s.enemyBullets) {
    const nx = b.x + b.vx * seconds,
      ny = b.y + b.vy * seconds;
    for (const p of teamPlayers(s)) {
      if (p.lives <= 0) continue;
      const old = oldPositions.get(p.playerId)!;
      if (
        segmentHit(
          b.x - old.x,
          b.y - old.y,
          nx - p.x,
          ny - p.y,
          -0.24 - b.radius,
          -b.radius,
          0.24 + b.radius,
          (p.crouching ? 0.48 : 1.25) + b.radius,
        )
      ) {
        hurt(s, p);
        b.ttl = 0;
        break;
      }
    }
    b.x = nx;
    b.y = ny;
    b.ttl -= seconds;
  }
  s.enemyBullets = s.enemyBullets.filter(
    (b) =>
      b.ttl > 0 &&
      b.y > -1 &&
      b.y < level.height &&
      teamPlayers(s).some((p) => p.lives > 0 && Math.abs(b.x - p.x) < 30),
  );
  for (const p of teamPlayers(s)) {
    if (p.lives <= 0) continue;
    const bodyHeight = p.crouching ? 0.48 : 1.25;
    for (const e of s.enemies)
      if (
        e.hp > 0 &&
        Math.abs(e.x - p.x) <
          (e.kind === 'boss' ? 1.1 : e.kind === 'heart' || e.kind === 'pod' ? 0.8 : 0.55) &&
        p.y <
          e.y +
            (e.kind === 'boss' ? 3.2 : e.kind === 'heart' ? 1.7 : e.kind === 'pod' ? 1.5 : 1.2) &&
        p.y + bodyHeight > e.y
      )
        hurt(s, p);
    level.hazards.forEach((h, i) => {
      if (
        h.kind !== 'mirage' &&
        hazardState(i, s.stageTime) === 'active' &&
        p.x > h.from &&
        p.x < h.to &&
        p.y >= (h.y ?? 0) - bodyHeight &&
        p.y < (h.y ?? 0) + (h.kind === 'firewall' ? 1.7 : 0.5)
      )
        hurt(s, p);
    });
    const teammate = teamPlayers(s).find((n) => n.playerId !== p.playerId && n.lives > 0);
    if (
      p.y < (level.axis === 'vertical' ? Math.max(-3, p.checkpointY - 7) : -3) ||
      (level.axis === 'vertical' && teammate && teammate.y - p.y > 7 && p.vy < 0)
    )
      hurt(s, p, true);
    if (p.lives <= 0) continue;
    collectSupplies(s, p);
  }
  s.enemies = s.enemies.filter((enemy) => enemy.id < 1000 || enemy.hp > 0);
  return s;
}
