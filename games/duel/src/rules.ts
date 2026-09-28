import { botInput, observe } from './ai';
import { isCrouched } from './stance';
import { DIFFICULTIES, moveFor, strike } from './moves';
import type {
  Action,
  Battle,
  BattleOptions,
  BattleEvent,
  Command,
  Fighter,
  FighterId,
  Input,
  MemeEffect,
  Slot,
  Strike,
} from './types';
export { IDS, ROSTER, FPS, ROUND_FRAMES } from './moves';
export type * from './types';
export const emptyInput = (): Input => ({ move: 0, guard: false, crouch: false, commands: [] });
export const other = (slot: Slot): Slot => (slot === 0 ? 1 : 0);
const free = (f: Fighter) => ['idle', 'walk', 'crouch', 'guard', 'jump'].includes(f.action);
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const priority: Command[] = [
  'burst',
  'super',
  'throw',
  'variant',
  'skill',
  'heavy',
  'kick',
  'light',
  'jump',
  'dash',
  'meme',
];
const speed = (b: Battle, f: Fighter) =>
  f.slot === 0 && b.options.playerPerks.includes('lightfoot') ? 1.12 : 1;
const cooling = (b: Battle, f: Fighter) =>
  f.slot === 0 && b.options.playerPerks.includes('cooling') ? 0.8 : 1;

function fighter(id: FighterId, slot: Slot): Fighter {
  return {
    id,
    slot,
    x: slot ? 680 : 280,
    y: 0,
    vy: 0,
    jumps: 0,
    airDashUsed: false,
    crouching: false,
    facing: slot ? -1 : 1,
    action: 'idle',
    age: 0,
    serial: 0,
    landed: [],
    hp: 1000,
    energy: 0,
    cooldown: 0,
    memeCooldown: 0,
    variantCooldown: 0,
    originX: slot ? 680 : 280,
    burstUsed: false,
    variants: 0,
    variantHits: 0,
    supers: 0,
    bursts: 0,
    stun: 0,
    invulnerable: 0,
    combo: 0,
    comboDamage: 0,
    contactTick: -100,
    contactHit: false,
    buffer: null,
    lastMove: 0,
    tapDirection: 0,
    tapTick: -100,
    dashDirection: 1,
    guardAwards: [],
    awardWindow: 0,
    awarded: 0,
    damage: 0,
    maxCombo: 0,
    counters: 0,
    throws: 0,
    whiffs: 0,
    cachedParries: [],
  };
}
export function createBattle(
  player: FighterId = 'deepseek',
  opponent: FighterId = 'gpt',
  seed = 20260926,
  options: Partial<BattleOptions> = {},
): Battle {
  const config: BattleOptions = {
    difficulty: 'normal',
    practice: false,
    dummy: 'idle',
    infiniteEnergy: false,
    roundLimit: 3,
    roundSeconds: 75,
    playerPerks: [],
    enemyStartingEnergy: 0,
    localVersus: false,
    ...options,
  };
  config.playerPerks = [...config.playerPerks];
  const b: Battle = {
    options: config,
    phase: 'countdown',
    phaseFrames: 180,
    round: 1,
    scores: [0, 0],
    roundWinner: null,
    outcome: null,
    timer: Math.round(config.roundSeconds * 60),
    tick: 0,
    elapsed: 0,
    fighters: [fighter(player, 0), fighter(opponent, 1)],
    projectiles: [],
    rice: null,
    nextId: 1,
    events: [],
    freeze: 0,
    cinematicOwner: null,
    grab: null,
    brain: {
      seed: seed >>> 0,
      decisionAt: 0,
      move: 0,
      guard: false,
      crouch: false,
      confirmed: -1,
      history: [],
    },
    memeAt: -1000,
  };
  b.fighters[0].energy =
    config.practice && config.infiniteEnergy
      ? 100
      : config.playerPerks.includes('battery')
        ? 25
        : 0;
  b.fighters[1].energy = config.enemyStartingEnergy;
  b.brain.history = Array.from({ length: DIFFICULTIES[config.difficulty].delay + 1 }, () =>
    observe(b),
  );
  return b;
}
function event(b: Battle, kind: BattleEvent['kind'], f: Fighter, text = '') {
  b.events.push({ id: b.nextId++, kind, actor: f.slot, x: f.x, y: f.y + 65, text });
}
function meme(b: Battle, f: Fighter, text: string) {
  if (b.tick - b.memeAt < 480) return;
  b.memeAt = b.tick;
  event(b, 'meme', f, text);
}
function interaction(b: Battle, f: Fighter, target: Fighter, effect: MemeEffect, text: string) {
  b.events.push({
    id: b.nextId++,
    kind: 'meme',
    actor: f.slot,
    target: target.slot,
    x: target.x,
    y: target.y,
    effect,
    text,
  });
}
function begin(b: Battle, f: Fighter, action: Action) {
  f.action = action;
  f.age = 0;
  f.serial = b.nextId++;
  f.originX = f.x;
  f.landed = [];
  f.contactTick = -100;
  f.contactHit = false;
  f.buffer = null;
  if (!['idle', 'guard', 'dash', 'jump'].includes(action)) f.invulnerable = 0;
}
function resetCombo(f: Fighter) {
  f.combo = 0;
  f.comboDamage = 0;
}
function knockdown(f: Fighter, launch = false) {
  f.action = 'down';
  f.age = 0;
  f.stun = 36;
  f.buffer = null;
  if (launch) f.vy = 450;
}
function prepare(b: Battle, f: Fighter) {
  if (f.memeCooldown > 0) f.memeCooldown--;
  if (f.cooldown > 0) f.cooldown--;
  if (f.variantCooldown > 0) f.variantCooldown--;
  if (f.invulnerable > 0) f.invulnerable--;
  if (['hurt', 'block', 'down'].includes(f.action)) {
    if (f.action !== 'down' || (f.y === 0 && f.vy <= 0)) f.stun--;
    if (f.stun <= 0) {
      if (f.action === 'down') f.invulnerable = 8;
      f.action = f.y > 0 ? 'jump' : 'idle';
      f.age = 0;
      resetCombo(f);
    }
  }
  const move = moveFor(f.id, f.action);
  if (move && f.age >= move.total) {
    if (f.id === 'gpt' && f.action === 'variant' && !f.contactHit)
      interaction(b, f, f, 'gpt-rollback', '刚才那一版，撤回。');
    if (!f.landed.length && ['light1', 'heavy', 'skill', 'variant', 'super'].includes(f.action)) {
      f.whiffs++;
      if (f.action === 'super') meme(b, f, '生成 0% 伤害');
      else if (f.whiffs >= 3) {
        meme(b, f, '空气：已读不回');
        f.whiffs = 0;
      }
    }
    f.action = f.y > 0 ? 'jump' : 'idle';
    f.age = 0;
  }
  if (f.buffer && f.buffer.until < b.tick) f.buffer = null;
}
function queue(b: Battle, f: Fighter, input: Input) {
  const command = priority.find((c) => input.commands.includes(c));
  if (command) {
    const context = input.contexts?.[command] ?? input;
    f.buffer = { command, until: b.tick + 10, move: context.move, crouch: context.crouch };
  }
}
function canCancel(b: Battle, f: Fighter, command: Command) {
  const ago = b.tick - f.contactTick;
  if (
    command === 'dash' &&
    f.y === 0 &&
    f.contactHit &&
    ago < 10 &&
    ['light1', 'light2'].includes(f.action)
  )
    return true;
  if (f.action === 'dash' && f.age >= 4 && ['light', 'heavy', 'jump'].includes(command))
    return true;
  if (f.contactHit && ago < 12) {
    if (command === 'kick' && ['light1', 'light2', 'low'].includes(f.action)) return true;
    if (
      command === 'jump' &&
      ['upper', 'heavy', 'variant'].includes(f.action) &&
      b.fighters[other(f.slot)].action === 'launched'
    )
      return true;
    if (command === 'heavy' && f.action === 'air') return true;
    if (command === 'heavy' && ['light1', 'light2'].includes(f.action)) return true;
  }
  if (
    f.id === 'gpt' &&
    command === 'variant' &&
    ['light1', 'light2', 'heavy'].includes(f.action) &&
    ago < 8
  )
    return true;
  if (f.id === 'gpt' && command === 'light' && f.action === 'variant' && f.contactHit && ago < 8)
    return true;
  if (command === 'light' && ['light1', 'light2'].includes(f.action) && ago < 10) return true;
  if (f.contactHit && ago < 8) {
    if (
      command === 'super' &&
      f.id === 'gpt' &&
      f.action === 'skill' &&
      b.fighters[other(f.slot)].action === 'hurt'
    )
      return true;
    if (command === 'heavy' && f.action === 'low') return true;
    if (['light1', 'light2'].includes(f.action)) {
      if (command === 'super') return true;
      if (command === 'skill' && f.id === 'gpt') return true;
    }
  }
  return false;
}
function perform(b: Battle, f: Fighter, command: Command, input: Input) {
  if (command === 'burst') {
    if (!['hurt', 'block', 'launched'].includes(f.action) || f.burstUsed || f.energy < 50 || b.grab)
      return false;
    f.energy -= 50;
    f.burstUsed = true;
    f.bursts++;
    f.buffer = null;
    f.stun = 0;
    f.action = f.y > 0 ? 'jump' : 'idle';
    f.invulnerable = 12;
    resetCombo(f);
    const foe = b.fighters[other(f.slot)];
    const direction = foe.x >= f.x ? 1 : -1;
    const mid = clamp((f.x + foe.x) / 2, 138, 822);
    f.x = mid - direction * 90;
    foe.x = mid + direction * 90;
    foe.action = 'hurt';
    foe.stun = 16;
    foe.age = 0;
    foe.buffer = null;
    b.projectiles = b.projectiles.filter((p) => p.owner === f.slot);
    event(b, 'burst', f, '上下文清空！重新聊！');
    return true;
  }
  if (!free(f) && !canCancel(b, f, command)) return false;
  if (command === 'meme') {
    if (f.y === 0 && b.rice?.holder === f.slot) {
      begin(b, f, 'eat');
      event(
        b,
        'meme',
        f,
        b.rice.owner === f.slot ? '饭抢回来了，趁热吃！' : '你的白饭，现在是我的了。',
      );
      return true;
    }
    if (f.y > 0 || f.memeCooldown > 0) return false;
    if (f.id === 'deepseek' && b.rice) return false;
    f.memeCooldown = 420;
    begin(b, f, 'meme');
    if (f.id === 'deepseek') b.rice = { owner: f.slot, holder: f.slot, life: 360 };
    event(
      b,
      'meme',
      f,
      f.id === 'deepseek'
        ? '我去吃白饭，打完告诉我。'
        : f.id === 'gpt'
          ? '不躲不藏，稳稳接住你。'
          : '唐包：已为你返回原问题。',
    );
    return true;
  }
  if (command === 'dash') {
    if (f.y > 0 && f.airDashUsed) return false;
    const cancel = !free(f);
    if (cancel && f.energy < 15) return false;
    if (cancel) f.energy -= 15;
    if (f.y > 0) {
      f.airDashUsed = true;
      f.vy = 0;
    }
    begin(b, f, 'dash');
    f.dashDirection = input.move || f.facing;
    event(b, 'dash', f, cancel ? '追击取消！' : '');
    return true;
  }
  if (command === 'variant') {
    if (f.y > 0 || f.energy < 25 || f.variantCooldown > 0) return false;
    f.energy -= 25;
    f.variantCooldown = Math.round(300 * cooling(b, f));
    f.variants++;
    begin(b, f, 'variant');
    event(
      b,
      'variant',
      f,
      f.id === 'deepseek' ? '答案回溯' : f.id === 'gpt' ? '再生成一版！' : '话题跳转！',
    );
    return true;
  }
  if (command === 'super') {
    if (f.y > 0 || f.energy < 100) return false;
    f.energy -= 100;
    begin(b, f, 'super');
    return true;
  }
  if (command === 'skill') {
    if (
      f.y > 0 ||
      f.cooldown > 0 ||
      (f.id === 'doubao' && b.projectiles.some((p) => p.owner === f.slot))
    )
      return false;
    f.cooldown = Math.round(
      (f.id === 'deepseek' ? 180 : f.id === 'gpt' ? 240 : 108) * cooling(b, f),
    );
    begin(b, f, 'skill');
    return true;
  }
  if (command === 'throw') {
    if (f.y > 0) return false;
    begin(b, f, 'throw');
    return true;
  }
  if (command === 'jump') {
    const chase =
      f.contactHit &&
      b.tick - f.contactTick < 12 &&
      b.fighters[other(f.slot)].action === 'launched';
    if (f.y > 0 && f.jumps >= 2) return false;
    f.jumps = f.y > 0 ? f.jumps + 1 : 1;
    f.vy = chase ? 780 : f.jumps === 2 ? 620 : 720;
    begin(b, f, 'jump');
    event(b, chase ? 'chase' : 'jump', f, chase ? '追上去！空中接招' : '');
    return true;
  }
  if (f.y > 0) {
    begin(b, f, command === 'heavy' ? 'airHeavy' : 'air');
    return true;
  }
  const action: Action =
    command === 'kick'
      ? input.crouch
        ? 'sweep'
        : 'kick'
      : command === 'heavy'
        ? input.crouch
          ? 'upper'
          : 'heavy'
        : f.action === 'light1'
          ? 'light2'
          : f.action === 'light2'
            ? 'light3'
            : input.crouch
              ? 'low'
              : 'light1';
  begin(b, f, action);
  return true;
}
function act(b: Battle, f: Fighter, input: Input) {
  if (free(f)) f.crouching = f.y === 0 && input.crouch;
  if (free(f) && f.y === 0 && f.action !== 'jump')
    f.facing = b.fighters[other(f.slot)].x < f.x ? -1 : 1;
  const commands = priority.filter((c) => input.commands.includes(c) || f.buffer?.command === c);
  let acted = false;
  for (const command of commands) {
    const buffered = f.buffer?.command === command ? f.buffer : undefined;
    const context = buffered
      ? { ...input, move: buffered.move ?? input.move, crouch: buffered.crouch ?? input.crouch }
      : input;
    if (perform(b, f, command, context)) {
      acted = true;
      break;
    }
  }
  if (free(f) && !acted) {
    if (f.y > 0) f.action = 'jump';
    else if (input.guard) f.action = 'guard';
    else if (input.crouch) f.action = 'crouch';
    else f.action = input.move ? 'walk' : 'idle';
    if (input.move && input.move !== f.lastMove && f.y === 0 && !input.guard && !input.crouch) {
      if (f.tapDirection === input.move && b.tick - f.tapTick <= 12) {
        begin(b, f, 'dash');
        f.dashDirection = input.move;
        f.tapTick = -100;
      } else {
        f.tapDirection = input.move;
        f.tapTick = b.tick;
      }
    }
  }
  f.lastMove = input.move;
  if (f.action === 'walk')
    f.x += (input.move * (input.move === f.facing ? 270 : 230) * speed(b, f)) / 60;
  if (f.y > 0 && ['jump', 'air', 'airHeavy'].includes(f.action))
    f.x += (input.move * 280 * speed(b, f)) / 60;
  if (f.action === 'variant') {
    if (f.id === 'deepseek' && f.age < 8) f.x -= f.facing * 10;
    if (f.id === 'gpt' && f.age < 6) f.x += f.facing * 10;
    if (f.id === 'doubao' && f.age === 5) f.vy = 420;
  }
  if (f.action === 'dash' && f.age < 10) f.x += f.dashDirection * 10;
  if (f.action === 'dash' && f.y > 0 && f.age < 10) f.vy = 30;
  if (
    f.id === 'gpt' &&
    ((f.action === 'skill' && f.age >= 4 && f.age < 12) ||
      (f.action === 'super' && f.age >= 4 && f.age < 14))
  )
    f.x += f.facing * (f.action === 'super' ? 18 : 15);
  if (f.action === 'skill' && f.id === 'doubao' && f.age === 18) {
    b.projectiles.push({
      id: b.nextId++,
      owner: f.slot,
      x: f.x + f.facing * 48,
      y: 52,
      direction: f.facing,
      life: 150,
    });
  }
  if (f.action === 'eat' || (f.action === 'meme' && f.id === 'deepseek')) {
    if (f.age === 36 && b.rice?.holder === f.slot) {
      f.hp = Math.min(1000, f.hp + 40);
      gain(f, 20);
      b.rice = null;
      event(b, 'meme', f, '白饭到账：生命 +40，能量 +20。');
    }
  }
  if (f.action === 'meme') {
    if (
      f.id === 'doubao' &&
      f.age === 18 &&
      !b.projectiles.some((p) => p.owner === f.slot && p.boomerang)
    ) {
      b.projectiles.push({
        id: b.nextId++,
        owner: f.slot,
        x: f.x + f.facing * 48,
        y: 52,
        direction: f.facing,
        life: 150,
        boomerang: true,
        returning: false,
      });
    }
  }
}
function physics(b: Battle, f: Fighter) {
  f.x = clamp(f.x, 48, 912);
  if (f.y > 0 || f.vy !== 0) {
    f.y += f.vy / 60;
    f.vy -= 1800 / 60;
    if (f.y <= 0) {
      f.y = 0;
      f.vy = 0;
      f.jumps = 0;
      f.airDashUsed = false;
      event(b, 'land', f);
      if (f.action === 'launched') knockdown(f);
      if (['air', 'airHeavy', 'jump'].includes(f.action)) {
        f.stun = f.action === 'jump' ? 4 : 10;
        f.action = 'hurt';
        f.age = 0;
      }
    }
  }
}
function separate(b: Battle, distance = 48) {
  const [a, c] = b.fighters;
  if (Math.abs(a.y - c.y) >= 96 || Math.abs(a.x - c.x) >= distance) return;
  const left = a.x <= c.x ? a : c,
    right = a.x <= c.x ? c : a;
  const middle = clamp((left.x + right.x) / 2, 48 + distance / 2, 912 - distance / 2);
  left.x = middle - distance / 2;
  right.x = middle + distance / 2;
}
interface Hit {
  actor: Slot;
  target: Slot;
  data: Strike;
  key: string;
  serial: number;
  action: Action | 'bubble' | 'return-bubble';
  projectile: number | null;
  delivered?: boolean;
  x: number;
}
function hittable(f: Fighter) {
  return f.invulnerable === 0 && !['down', 'grabbed', 'throwing'].includes(f.action);
}
function collect(b: Battle): Hit[] {
  const hits: Hit[] = [];
  for (const f of b.fighters) {
    const move = moveFor(f.id, f.action),
      target = b.fighters[other(f.slot)];
    if (!move || !hittable(target)) continue;
    move.strikes.forEach((s, index) => {
      const origin = f.action === 'variant' && f.id === 'deepseek' ? f.originX : f.x;
      const key = `${f.serial}:${index}`,
        delta = (target.x - origin) * f.facing;
      const low = f.y + (['air', 'airHeavy'].includes(f.action) ? -50 : 10);
      const high =
        f.y +
        (f.action === 'upper' || (f.action === 'variant' && f.id === 'doubao')
          ? 170
          : f.action === 'low' || f.action === 'sweep'
            ? 40
            : 96);
      const targetTop = target.y + (isCrouched(target) ? 64 : 96);
      if (
        f.age < s.start ||
        f.age >= s.start + s.active ||
        f.landed.includes(key) ||
        delta < -10 ||
        delta > s.reach ||
        low >= targetTop ||
        high <= target.y
      )
        return;
      f.landed.push(key);
      hits.push({
        actor: f.slot,
        target: target.slot,
        data: s,
        key,
        serial: f.serial,
        action: f.action,
        projectile: null,
        x: origin,
      });
    });
  }
  for (const p of b.projectiles) {
    const owner = b.fighters[p.owner];
    const target =
      p.returning && Math.abs(owner.x - p.x) < 46 && owner.y < p.y + 22
        ? owner
        : b.fighters[other(p.owner)];
    if (
      hittable(target) &&
      Math.abs(target.x - p.x) < 46 &&
      p.y + 22 > target.y &&
      p.y - 22 < target.y + (isCrouched(target) ? 64 : 96)
    ) {
      hits.push({
        actor: target.slot === p.owner ? other(p.owner) : p.owner,
        target: target.slot,
        data: strike(
          0,
          1,
          target.slot === p.owner ? 50 : (p.damage ?? (p.boomerang ? 80 : 100)),
          0,
          22,
          12,
          70,
        ),
        key: `p${p.id}`,
        serial: p.id,
        action: target.slot === p.owner ? 'return-bubble' : 'bubble',
        projectile: p.id,
        delivered: !!p.reflections && target.slot === p.originalOwner,
        x: p.x - p.direction,
      });
    }
  }
  return hits.sort((a, c) => a.serial - c.serial);
}
function gain(f: Fighter, amount: number) {
  f.energy = clamp(f.energy + amount, 0, 100);
}
function damage(b: Battle, f: Fighter, target: Fighter, amount: number, ultimate = false) {
  const scaling = [1, 0.85, 0.7, 0.55, 0.4][Math.min(target.combo, 4)]!;
  const actual = Math.min(
    target.hp,
    350 - target.comboDamage,
    Math.floor(amount * (ultimate ? Math.max(0.7, scaling) : scaling)),
  );
  target.hp -= actual;
  target.comboDamage += actual;
  target.combo++;
  f.damage += actual;
  f.maxCombo = Math.max(f.maxCombo, target.combo);
  f.whiffs = 0;
  if (!ultimate) {
    gain(f, actual * 0.12);
    gain(target, actual * 0.04);
  }
  event(b, 'hit', target);
}
function resolveHits(b: Battle, hits: Hit[]) {
  const snapshots = b.fighters.map((f) => ({
    action: f.action,
    age: f.age,
    id: f.id,
    facing: f.facing,
    x: f.x,
  }));
  const parried = new Set<Slot>();
  const outcomes = hits.map((hit) => {
    const t = snapshots[hit.target]!;
    const front = (hit.x - t.x) * t.facing >= 0;
    const parry =
      !parried.has(hit.target) &&
      t.id === 'deepseek' &&
      t.action === 'skill' &&
      t.age >= 4 &&
      t.age < 16 &&
      hit.action !== 'super' &&
      front;
    if (parry) parried.add(hit.target);
    return {
      hit,
      result: parry ? 'parry' : front && ['guard', 'block'].includes(t.action) ? 'block' : 'hit',
    };
  });
  const hurt = new Set(outcomes.filter((o) => o.result === 'hit').map((o) => o.hit.target));
  const used = new Set<number>();
  for (const { hit, result } of outcomes) {
    const f = b.fighters[hit.actor],
      target = b.fighters[hit.target];
    if (hit.projectile !== null) {
      used.add(hit.projectile);
      b.events.push({
        id: b.nextId++,
        kind: 'bubble-pop',
        actor: hit.actor,
        x: target.x,
        y: 52,
        text: '',
      });
    }
    if (hit.projectile === null && result !== 'parry') {
      f.contactTick = b.tick;
      f.contactHit = result === 'hit';
    }
    if (result === 'parry') {
      gain(target, 12);
      target.counters++;
      if (!hurt.has(target.slot)) begin(b, target, 'counter');
      event(b, 'parry', target, '想完了。现学现揍！');
      const cacheKey = `${f.id}:${hit.action}`;
      if (target.cachedParries.includes(cacheKey))
        interaction(b, target, target, 'cache-hit', '缓存命中：这题做过。');
      else target.cachedParries.push(cacheKey);
      b.freeze = Math.max(b.freeze, 6);
      continue;
    }
    if (result === 'block') {
      if (!hurt.has(target.slot)) resetCombo(target);
      if (!hurt.has(target.slot)) {
        target.action = 'block';
        target.stun = Math.max(target.stun, hit.data.block);
      }
      if (!target.guardAwards.includes(hit.serial)) {
        target.guardAwards = [...target.guardAwards.slice(-8), hit.serial];
        if (b.tick - target.awardWindow >= 60) {
          target.awardWindow = b.tick;
          target.awarded = 0;
        }
        if (target.awarded < 4) {
          target.awarded += 2;
          gain(target, 2);
        }
        const chip =
          hit.action === 'super'
            ? 10
            : ['skill', 'variant', 'counter', 'bubble'].includes(hit.action)
              ? 5
              : 0;
        if (target.hp > 0) target.hp = Math.max(1, target.hp - chip);
      }
      event(b, 'block', target);
      b.freeze = Math.max(b.freeze, 2);
      continue;
    }
    const healthBefore = target.hp;
    let riceFeedback: 'rice-reclaimed' | 'rice-spill' | undefined;
    if (b.rice?.holder === target.slot) {
      if (b.rice.owner === f.slot && f.slot !== target.slot) {
        b.rice.holder = f.slot;
        b.rice.life = 240;
        riceFeedback = 'rice-reclaimed';
      } else {
        b.rice = null;
        riceFeedback = 'rice-spill';
      }
    }
    if (hit.action === 'return-bubble')
      interaction(b, f, target, 'tangbao-return', '唐包：返回给我了？这题理解反了！');
    damage(b, f, target, hit.data.damage, hit.action === 'super');
    if (f.id === 'deepseek' && target.hp < healthBefore) {
      if (target.id === 'gpt' && ['light1', 'light2'].includes(hit.action))
        interaction(b, f, target, 'gpt-paper', '省流成功：疼。');
      if (target.id === 'doubao' && hit.action === 'light3')
        interaction(b, f, target, 'doubao-bun', '豆包：这回真成包了！');
    }
    if (
      f.id === 'doubao' &&
      target.id === 'deepseek' &&
      hit.action === 'bubble' &&
      target.hp < healthBefore
    )
      interaction(b, f, target, 'deepseek-bubbles', '思考没结果，先冒三个泡。');
    if (hit.action === 'variant') f.variantHits++;
    if (
      f.id === 'doubao' &&
      target.id === 'gpt' &&
      hit.action === 'bubble' &&
      target.hp < healthBefore
    )
      interaction(b, f, target, 'gpt-muffled', '嘴堵住了，耳朵还在输出。');
    if (hit.action === 'super') f.supers++;
    if (riceFeedback === 'rice-reclaimed')
      interaction(b, f, f, riceFeedback, '打我可以，别动饭！白饭已夺回。');
    if (riceFeedback === 'rice-spill')
      interaction(b, f, target, riceFeedback, '饭碗都给你打翻！白饭没吃上。');
    if (hit.delivered)
      interaction(b, f, target, 'parcel-delivered', '包邮到家：您购买的挨打已送达。');
    target.x = clamp(target.x + (target.x >= hit.x ? 1 : -1) * hit.data.push, 48, 912);
    target.buffer = null;
    if (target.combo >= 5 || target.comboDamage >= 350) knockdown(target);
    else if (hit.data.launch) {
      target.action = 'launched';
      target.age = 0;
      target.vy = 660;
      target.stun = 0;
      event(b, 'launch', target, '挑空！跳跃追击');
    } else if (hit.data.down) {
      knockdown(target, hit.data.launch);
      if (hit.action === 'airHeavy') target.vy = -720;
    } else {
      target.action = target.y > 0 ? 'launched' : 'hurt';
      if (target.y > 0) target.vy = Math.max(target.vy, 240);
      target.stun = hit.data.stun;
      target.age = 0;
    }
    b.freeze = Math.max(b.freeze, ['heavy', 'counter', 'upper'].includes(hit.action) ? 6 : 4);
    if (hit.action === 'super' && !hurt.has(f.slot)) {
      b.phase = 'cinematic';
      b.phaseFrames = 72;
      b.cinematicOwner = f.slot;
      b.freeze = 0;
      event(b, 'super', f, '');
    }
  }
  b.projectiles = b.projectiles.filter((p) => !used.has(p.id));
  return hurt;
}
function releaseGrab(b: Battle, tech: boolean) {
  const grab = b.grab;
  if (!grab) return;
  const a = b.fighters[grab.attacker],
    d = b.fighters[grab.defender];
  a.action = 'idle';
  a.buffer = null;
  d.buffer = null;
  if (tech) {
    d.action = 'idle';
    separate(b, 140);
    event(b, 'throw', d, '这招我拆了');
  } else {
    knockdown(d);
    d.x = clamp(d.x + a.facing * 100, 48, 912);
  }
  b.grab = null;
}
function catchAir(b: Battle) {
  if (b.grab) return;
  for (const f of b.fighters) {
    const d = b.fighters[other(f.slot)];
    if (f.id !== 'gpt' || f.action !== 'meme' || f.age < 6 || f.age > 28 || f.y > 0) continue;
    if (
      !hittable(d) ||
      d.y <= 18 ||
      d.y >= 150 ||
      d.vy > 0 ||
      !['jump', 'air', 'airHeavy', 'dash'].includes(d.action) ||
      Math.abs(d.x - f.x) > 86 ||
      (d.x - f.x) * f.facing < -10
    )
      continue;
    b.grab = { attacker: f.slot, defender: d.slot, age: 0, paid: false, catch: true };
    f.action = 'throwing';
    f.age = 0;
    f.buffer = null;
    d.action = 'grabbed';
    d.vy = 0;
    d.buffer = null;
    interaction(b, f, f, 'steady-catch', '稳稳接住你，然后送你落地。');
    break;
  }
}
function reflectBubbles(b: Battle) {
  for (const p of b.projectiles) {
    for (const f of b.fighters) {
      if (
        (p.owner === f.slot && !p.returning) ||
        !['heavy', 'upper', 'airHeavy'].includes(f.action)
      )
        continue;
      const hit = moveFor(f.id, f.action)?.strikes.find(
        (s) => f.age >= s.start && f.age < s.start + s.active,
      );
      const dx = (p.x - f.x) * f.facing;
      if (!hit || dx < 0 || dx > hit.reach + 20 || p.y < f.y - 40 || p.y > f.y + 130) continue;
      p.originalOwner ??= p.owner;
      p.damage ??= p.boomerang ? 80 : 100;
      p.owner = f.slot;
      p.direction = f.facing;
      p.returning = false;
      p.boomerang = false;
      p.reflections = (p.reflections ?? 0) + 1;
      p.x = f.x + f.facing * 54;
      interaction(b, f, f, 'parcel-reflect', '拒收！给你原路寄回。');
      b.freeze = Math.max(b.freeze, 3);
      break;
    }
  }
}
function overloadCatch(b: Battle) {
  if (!b.grab?.catch) return;
  const a = b.fighters[b.grab.attacker],
    d = b.fighters[b.grab.defender];
  const p = b.projectiles.find(
    (p) => p.owner !== a.slot && Math.abs(p.x - a.x) < 78 && p.y >= a.y && p.y <= a.y + 130,
  );
  if (!p && !b.rice) return;
  if (p) {
    b.projectiles = b.projectiles.filter((q) => q.id !== p.id);
    b.events.push({ id: b.nextId++, kind: 'bubble-pop', actor: p.owner, x: p.x, y: p.y, text: '' });
  }
  b.rice = null;
  b.grab = null;
  knockdown(a);
  knockdown(d);
  d.vy = 0;
  separate(b, 110);
  interaction(b, a, a, 'catch-overload', '接住过载！人、饭、包裹全掉了。');
  b.freeze = Math.max(b.freeze, 6);
}
function grabs(b: Battle, inputs: [Input, Input], hurt: Set<Slot>) {
  if (b.grab) {
    const grab = b.grab;
    if (grab.catch) {
      const a = b.fighters[grab.attacker],
        d = b.fighters[grab.defender];
      d.x = clamp(a.x + a.facing * 42, 48, 912);
      d.y = 52;
      d.vy = 0;
    }
    grab.age++;
    if (grab.age <= 8 && inputs[grab.defender].commands.includes('throw')) {
      releaseGrab(b, true);
      return;
    }
    if (grab.age === 9) {
      const a = b.fighters[grab.attacker],
        d = b.fighters[grab.defender];
      resetCombo(d);
      damage(b, a, d, grab.catch ? 120 : 100);
      a.throws++;
      grab.paid = true;
    }
    if (grab.age >= 24) releaseGrab(b, false);
    return;
  }
  const candidates = b.fighters.filter((f) => {
    const d = b.fighters[other(f.slot)];
    return (
      f.action === 'throw' &&
      f.age >= 7 &&
      f.age < 9 &&
      !hurt.has(f.slot) &&
      f.y === 0 &&
      d.y === 0 &&
      hittable(d) &&
      !['hurt', 'block'].includes(d.action) &&
      Math.abs(d.x - f.x) <= 64
    );
  });
  if (candidates.length === 2) {
    b.fighters.forEach((f) => {
      f.action = 'idle';
      f.buffer = null;
    });
    separate(b, 140);
    event(b, 'throw', b.fighters[0], '互相拆台');
  } else if (candidates.length === 1) {
    const a = candidates[0]!,
      d = b.fighters[other(a.slot)];
    if (b.rice?.holder === d.slot) {
      b.rice.holder = a.slot;
      b.rice.life = 360;
      a.action = 'idle';
      a.age = 0;
      a.buffer = null;
      d.action = 'hurt';
      d.stun = 12;
      d.age = 0;
      d.buffer = null;
      interaction(b, a, a, 'rice-stolen', '白饭抢过来了！整活键开吃。');
      return;
    }
    b.grab = { attacker: a.slot, defender: d.slot, age: 0, paid: false };
    a.action = 'throwing';
    d.action = 'grabbed';
    a.buffer = null;
    d.buffer = null;
    event(b, 'throw', a, '别光挡，出来聊聊');
  }
}
function finishRound(b: Battle) {
  if (b.fighters.every((f) => f.hp > 0) && b.timer > 0) return;
  const [a, d] = b.fighters;
  b.roundWinner = a.hp === d.hp ? null : a.hp > d.hp ? 0 : 1;
  if (b.roundWinner !== null && !b.options.practice) b.scores[b.roundWinner]++;
  b.phase = 'round-end';
  b.phaseFrames = b.options.practice ? 60 : 120;
  b.freeze = 0;
  b.projectiles = [];
  b.rice = null;
  b.grab = null;
  b.cinematicOwner = null;
  b.fighters.forEach((f) => {
    f.buffer = null;
  });
  event(
    b,
    'round',
    a,
    b.roundWinner === null
      ? '都别装了 · 平局'
      : b.roundWinner === 0
        ? '这回合，包的！'
        : '下一版会更好',
  );
  if (!b.options.practice && b.roundWinner !== null) {
    const loser = b.fighters[other(b.roundWinner)];
    interaction(b, loser, loser, 'sore-loser', '翻个面：战略性休息。');
  }
}
function nextRound(b: Battle) {
  if (!b.options.practice && (b.scores.some((s) => s >= 2) || b.round === b.options.roundLimit)) {
    b.phase = 'done';
    b.outcome = b.scores[0] === b.scores[1] ? 'draw' : b.scores[0] > b.scores[1] ? 'win' : 'lose';
    return;
  }
  if (!b.options.practice) b.round++;
  b.phase = b.options.practice ? 'fight' : 'countdown';
  b.phaseFrames = b.options.practice ? 0 : 180;
  b.timer = Math.round(b.options.roundSeconds * 60);
  b.fighters = b.fighters.map((f) => ({
    ...fighter(f.id, f.slot),
    damage: f.damage,
    maxCombo: f.maxCombo,
    counters: f.counters,
    throws: f.throws,
    variants: f.variants,
    variantHits: f.variantHits,
    supers: f.supers,
    bursts: f.bursts,
  })) as [Fighter, Fighter];
  b.fighters[0].energy =
    b.options.practice && b.options.infiniteEnergy
      ? 100
      : b.options.playerPerks.includes('battery')
        ? 25
        : 0;
  b.fighters[1].energy = b.options.enemyStartingEnergy;
  b.brain.history = Array.from({ length: DIFFICULTIES[b.options.difficulty].delay + 1 }, () =>
    observe(b),
  );
  b.brain.move = 0;
  b.brain.guard = false;
  b.brain.crouch = false;
  b.brain.decisionAt = 0;
}
/** Deterministic, fixed 60 Hz simulation. Mutates only the explicitly supplied battle. */
export function advance(b: Battle, player: Input = emptyInput(), second?: Input): Battle {
  b.events = [];
  if (b.phase === 'done') return b;
  if (b.phase !== 'fight') {
    b.phaseFrames--;
    if (b.phaseFrames <= 0) {
      if (b.phase === 'round-end') nextRound(b);
      else {
        if (b.phase === 'cinematic' && b.cinematicOwner !== null)
          b.fighters[b.cinematicOwner].action = 'idle';
        b.phase = 'fight';
        b.cinematicOwner = null;
        finishRound(b);
      }
    }
    return b;
  }
  queue(b, b.fighters[0], player);
  if (second) queue(b, b.fighters[1], second);
  if (b.freeze > 0) {
    b.freeze--;
    return b;
  }
  b.tick++;
  b.elapsed++;
  if (!b.options.practice) b.timer = Math.max(0, b.timer - 1);
  const dummy: Input | null =
    b.options.practice && b.options.dummy !== 'fight'
      ? {
          ...emptyInput(),
          guard: b.options.dummy === 'guard',
          commands: b.options.dummy === 'repeat-heavy' && b.tick % 90 === 0 ? ['heavy'] : [],
        }
      : null;
  const cpu = second ?? (b.options.localVersus ? emptyInput() : (dummy ?? botInput(b))),
    inputs: [Input, Input] = [player, cpu];
  queue(b, b.fighters[1], cpu);
  for (const f of b.fighters) prepare(b, f);
  if (b.rice && --b.rice.life <= 0) b.rice = null;
  if (b.options.practice && b.options.infiniteEnergy) b.fighters[0].energy = 100;
  for (const f of b.fighters) {
    act(b, f, inputs[f.slot]);
    physics(b, f);
  }
  separate(b);
  for (const p of b.projectiles) {
    p.x += p.direction * 6;
    p.life--;
    if (p.boomerang && !p.returning && (p.life <= 108 || p.x < 35 || p.x > 925)) {
      p.returning = true;
      p.direction *= -1;
      event(b, 'meme', b.fighters[p.owner], '答非所问：原路返回！');
    }
  }
  reflectBubbles(b);
  const collided = new Set<number>();
  for (const p of b.projectiles)
    for (const q of b.projectiles) {
      if (p.id !== q.id && p.owner !== q.owner && Math.abs(p.x - q.x) < 44) {
        collided.add(p.id);
        collided.add(q.id);
      }
    }
  b.projectiles = b.projectiles.filter((p) => {
    const alive = p.life > 0 && p.x > 0 && p.x < 960 && !collided.has(p.id);
    if (!alive)
      b.events.push({
        id: b.nextId++,
        kind: 'bubble-pop',
        actor: p.owner,
        x: p.x,
        y: p.y,
        text: '',
      });
    if (!alive && !collided.has(p.id)) meme(b, b.fighters[p.owner], '这次没包住');
    return alive;
  });
  catchAir(b);
  overloadCatch(b);
  const hurt = resolveHits(b, collect(b));
  grabs(b, inputs, hurt);
  b.fighters.forEach((f) => f.age++);
  b.brain.history.push(observe(b));
  if (b.brain.history.length > DIFFICULTIES[b.options.difficulty].delay + 1)
    b.brain.history.shift();
  if (b.phase === 'fight') finishRound(b);
  return b;
}
