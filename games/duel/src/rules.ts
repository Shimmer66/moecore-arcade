import { botInput, botCinematicInput, observe } from './ai';
import { commandTier, canFinisher, payFinisher, finisherName } from './finishers';
import { isCrouched } from './stance';
import { motionInput } from './motion-input';
import { makeTeams, teamEnergyCap, teamOutcome, settleTeamBout, advanceTeamOrder } from './teams';
import { startJump, updateJump, airMove } from './jump';
import {
  ENERGY_CAP,
  MAX_COST,
  MAX_DURATION,
  QUICK_MAX_DURATION,
  EX_STYLE,
  canEX,
  payEX,
} from './power';
import {
  GUARD_CAPACITY,
  guardsLevel,
  hitLevel,
  guardPressure,
  rollingPastStrikes,
} from './defense';
import { AIR_ATTACKS, DIFFICULTIES, moveFor, strike, ROSTER } from './moves';
import { NORMAL_STYLE } from './normal-styles';
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
  TeamLineups,
  SuperTier,
} from './types';
export { IDS, ROSTER, FPS, ROUND_FRAMES } from './moves';
export type * from './types';
export const emptyInput = (): Input => ({ move: 0, guard: false, crouch: false, commands: [] });
export const other = (slot: Slot): Slot => (slot === 0 ? 1 : 0);
const free = (f: Fighter) => ['idle', 'walk', 'crouch', 'guard', 'jump'].includes(f.action);
const basicAttacks: readonly Command[] = ['light', 'heavy', 'lightKick', 'kick', 'blowback'];
const BASIC_BUFFER_FRAMES = 12;
// The press tick plus twelve following simulation frames remain actionable.
const COMMAND_BUFFER_FRAMES = 13;
const takeoffAttack: Partial<Record<Action, Command>> = {
  light1: 'light',
  low: 'light',
  lightKick: 'lightKick',
  crouchKick: 'lightKick',
  heavy: 'heavy',
  closeHeavy: 'heavy',
  upper: 'heavy',
  kick: 'kick',
  sweep: 'kick',
  blowback: 'blowback',
};
const normalSpecialCancelActions: readonly Action[] = [
  'light1',
  'light2',
  'low',
  'lightKick',
  'crouchKick',
  'closeHeavy',
];
const normalSpecialCancelCommands: readonly Command[] = [
  'skill',
  'exSkill',
  'variant',
  'exVariant',
  'uppercut',
  'super',
  'maxSuper',
  'climax',
];
const lowStance: Partial<Record<Action, Action>> = {
  light1: 'low',
  lightKick: 'crouchKick',
  kick: 'sweep',
  heavy: 'upper',
  closeHeavy: 'upper',
};
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));
const priority: Command[] = [
  'burst',
  'roll',
  'guardCounter',
  'max',
  'climax',
  'maxSuper',
  'super',
  'blowback',
  'commandGrab',
  'throw',
  'variant',
  'exVariant',
  'exSkill',
  'skill',
  'uppercut',
  'heavy',
  'kick',
  'lightKick',
  'light',
  'jump',
  'dash',
  'meme',
];
const speed = (b: Battle, f: Fighter) =>
  (f.slot === 0 && b.options.playerPerks.includes('lightfoot') ? 1.12 : 1) *
  (f.slowed > 0 ? 0.6 : 1);
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
    jumpKind: 'normal',
    jumpAge: 0,
    jumpVariable: false,
    jumpDirection: 0,
    crouchRecent: 0,
    airDashUsed: false,
    crouching: false,
    landing: false,
    guardIntent: false,
    guardGauge: GUARD_CAPACITY[id],
    guardRegenDelay: 0,
    facing: slot ? -1 : 1,
    action: 'idle',
    age: 0,
    serial: 0,
    landed: [],
    hp: 1000,
    energy: 0,
    energyCap: ENERGY_CAP,
    exActive: false,
    armor: 0,
    maxFrames: 0,
    maxMode: null,
    exUses: 0,
    maxUses: 0,
    cooldown: 0,
    memeCooldown: 0,
    silenced: 0,
    slowed: 0,
    variantCooldown: 0,
    originX: slot ? 680 : 280,
    burstUsed: false,
    variants: 0,
    variantHits: 0,
    supers: 0,
    superTier: 1,
    superLinked: false,
    superCounted: false,
    advancedCancels: 0,
    climaxHits: 0,
    bursts: 0,
    stun: 0,
    invulnerable: 0,
    combo: 0,
    comboDamage: 0,
    comboLimit: 350,
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
    commandThrows: 0,
    backCharge: 0,
    chargeReadyUntil: -1,
    whiffs: 0,
    cachedParries: [],
    motionFacing: slot ? -1 : 1,
    directions: [],
    inputLog: [],
    motionResult: null,
    motionCount: 0,
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
    inputFrame: 0,
    elapsed: 0,
    fighters: [fighter(player, 0), fighter(opponent, 1)],
    teams: null,
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
      ? ENERGY_CAP
      : config.playerPerks.includes('battery')
        ? 25
        : 0;
  b.fighters[1].energy = clamp(config.enemyStartingEnergy, 0, ENERGY_CAP);
  b.brain.history = Array.from({ length: DIFFICULTIES[config.difficulty].delay + 1 }, () =>
    observe(b),
  );
  return b;
}
export function createTeamBattle(
  lineups: TeamLineups,
  seed = 20260928,
  options: Pick<Partial<BattleOptions>, 'difficulty' | 'localVersus' | 'roundSeconds'> = {},
): Battle {
  const teams = makeTeams(lineups);
  const b = createBattle(lineups[0][0], lineups[1][0], seed, options);
  b.teams = teams;
  for (const f of b.fighters) f.energyCap = teamEnergyCap(teams[f.slot]);
  return b;
}
function event(b: Battle, kind: BattleEvent['kind'], f: Fighter, text = ''): BattleEvent {
  const feedback = { id: b.nextId++, kind, actor: f.slot, x: f.x, y: f.y + 65, text };
  b.events.push(feedback);
  return feedback;
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
  if (f.landing) f.stun = 0;
  f.superTier = 1;
  f.superLinked = false;
  f.superCounted = false;
  f.exActive = false;
  f.armor = 0;
  f.landing = false;
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
  f.comboLimit = 350;
}
function knockdown(f: Fighter, launch = false) {
  f.exActive = false;
  f.armor = 0;
  f.landing = false;
  f.action = 'down';
  f.age = 0;
  f.stun = 36;
  f.buffer = null;
  if (launch) f.vy = 450;
}
function prepare(b: Battle, f: Fighter) {
  if (f.maxFrames > 0) f.maxFrames--;
  if (f.maxFrames === 0) f.maxMode = null;
  if (f.crouchRecent > 0) f.crouchRecent--;
  if (f.guardRegenDelay > 0) f.guardRegenDelay--;
  else if (free(f)) f.guardGauge = Math.min(GUARD_CAPACITY[f.id], f.guardGauge + 0.35);
  if (f.silenced > 0) f.silenced--;
  if (f.slowed > 0) f.slowed--;
  if (f.memeCooldown > 0) f.memeCooldown--;
  if (f.cooldown > 0) f.cooldown--;
  if (f.variantCooldown > 0) f.variantCooldown--;
  if (f.invulnerable > 0) f.invulnerable--;
  if (['hurt', 'block', 'down', 'guardBreak'].includes(f.action)) {
    if (f.action !== 'down' || (f.y === 0 && f.vy <= 0)) f.stun--;
    if (f.stun <= 0) {
      if (f.action === 'guardBreak') f.guardGauge = GUARD_CAPACITY[f.id];
      f.landing = false;
      if (f.action === 'down') f.invulnerable = 8;
      f.action = f.y > 0 ? 'jump' : 'idle';
      f.age = 0;
      resetCombo(f);
    }
  }
  const move = moveFor(f.id, f.action, f.exActive, f.superTier);
  if (move && f.age >= move.total) {
    if (f.id === 'gpt' && f.action === 'variant' && !f.contactHit)
      interaction(b, f, f, 'gpt-rollback', '刚才那一版，撤回。');
    if (!f.landed.length && ['light1', 'heavy', 'skill', 'variant', 'super'].includes(f.action)) {
      f.whiffs++;
      if (f.action === 'super') meme(b, f, '满格大招，全喂空气。');
      else if (f.whiffs >= 3) {
        meme(b, f, '空气：已读不回');
        f.whiffs = 0;
      }
    }
    f.action = f.y > 0 ? 'jump' : 'idle';
    f.exActive = false;
    f.armor = 0;
    f.age = 0;
  }
  if (f.buffer && f.buffer.until < b.tick) f.buffer = null;
}
function queue(b: Battle, f: Fighter, input: Input) {
  const previous = f.buffer;
  // Complete a near-simultaneous crouch chord while its attack is still buffered.
  if (
    previous &&
    previous.until >= b.tick &&
    previous.queuedAt !== undefined &&
    b.tick - previous.queuedAt <= 2 &&
    basicAttacks.includes(previous.command) &&
    input.crouch
  )
    previous.crouch = true;
  let command = priority.find((c) => input.commands.includes(c));
  if (command === 'blowback' && f.action === 'block') command = 'guardCounter';
  if (command) {
    const recent =
      previous &&
      previous.until >= b.tick &&
      previous.queuedAt !== undefined &&
      b.tick - previous.queuedAt <= 2;
    const appendJump = command === 'jump' && recent && basicAttacks.includes(previous.command);
    const prependJump = basicAttacks.includes(command) && recent && previous.command === 'jump';
    const context = appendJump
      ? { move: previous.move ?? input.move, crouch: previous.crouch ?? input.crouch }
      : (input.contexts?.[command] ?? input);
    if (appendJump) command = previous.command;
    f.buffer = {
      command,
      until:
        b.tick + (basicAttacks.includes(command) ? BASIC_BUFFER_FRAMES : COMMAND_BUFFER_FRAMES),
      queuedAt: b.tick,
      move: context.move,
      crouch: context.crouch,
    };
    if (basicAttacks.includes(command) && (input.commands.includes('jump') || prependJump)) {
      const jump = prependJump
        ? { move: previous.move ?? input.move, crouch: previous.crouch ?? input.crouch }
        : (input.contexts?.jump ?? input);
      f.buffer.jump = { move: jump.move, crouch: jump.crouch };
    }
  }
}
function normalSpecialCancel(b: Battle, f: Fighter, command: Command) {
  if (
    ['deepseek', 'doubao'].includes(f.id) &&
    ['light1', 'light2', 'low'].includes(f.action) &&
    ['skill', 'exSkill'].includes(command)
  )
    return false;
  return (
    b.tick - f.contactTick < 10 &&
    f.contactTick >= 0 &&
    f.y === 0 &&
    normalSpecialCancelActions.includes(f.action) &&
    normalSpecialCancelCommands.includes(command)
  );
}
function canCancel(b: Battle, f: Fighter, command: Command) {
  if (f.landing && f.y === 0 && f.stun <= 2 && [...basicAttacks, 'jump', 'dash'].includes(command))
    return true;
  // A near-simultaneous jump may complete a normal attack chord before any hit is active.
  if (command === 'jump' && f.y === 0 && f.age <= 2 && takeoffAttack[f.action] && !f.landed.length)
    return true;
  if (command === 'exSkill') command = 'skill';
  if (command === 'exVariant') command = 'variant';
  const ago = b.tick - f.contactTick;
  const tier = commandTier(command);
  if (f.action === 'super')
    return (
      tier !== null &&
      tier > f.superTier &&
      f.contactTick >= 0 &&
      ago < 12 &&
      b.fighters[other(f.slot)].hp > 0
    );
  if (tier !== null) {
    if (['skill', 'variant', 'counter'].includes(f.action) && f.contactTick >= 0 && ago < 10)
      return true;
    command = 'super';
  }
  if (
    command === 'blowback' &&
    f.contactHit &&
    ago < 10 &&
    ['light1', 'light2', 'low', 'lightKick', 'crouchKick'].includes(f.action)
  )
    return true;
  if (
    f.maxFrames > 0 &&
    ago < 10 &&
    f.contactTick >= 0 &&
    ['skill', 'variant', 'counter'].includes(f.action) &&
    ['skill', 'variant', 'super'].includes(command) &&
    command !== f.action
  )
    return true;
  if (normalSpecialCancel(b, f, command)) return true;
  if (f.contactHit && ago < 10) {
    if (f.action === 'air' && command === 'lightKick') return true;
    if (['light1', 'light2', 'low'].includes(f.action) && command === 'lightKick') return true;
    if (['lightKick', 'crouchKick'].includes(f.action) && ['heavy', 'kick'].includes(command))
      return true;
    if (['air', 'airLightKick'].includes(f.action) && ['heavy', 'kick'].includes(command))
      return true;
  }
  if (
    command === 'dash' &&
    f.y === 0 &&
    f.contactHit &&
    ago < 10 &&
    ['light1', 'light2'].includes(f.action)
  )
    return true;
  if (
    f.action === 'dash' &&
    f.age >= 4 &&
    ['light', 'heavy', 'lightKick', 'kick', 'jump'].includes(command)
  )
    return true;
  if (f.contactHit && ago < 12) {
    if (command === 'kick' && ['light1', 'light2', 'low'].includes(f.action)) return true;
    if (
      command === 'jump' &&
      ['upper', 'heavy', 'variant', 'counter'].includes(f.action) &&
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
  const airborne = f.y > 0 || (f.action === 'jump' && f.vy > 0);
  const normalCancel = normalSpecialCancel(b, f, command);
  if (command === 'blowback' && f.action === 'block') command = 'guardCounter';
  if (command === 'guardCounter') {
    if (f.action !== 'block' || f.y > 0 || f.energy < 100 || b.grab) return false;
    f.energy -= 100;
    begin(b, f, 'guardCounter');
    f.stun = 0;
    f.invulnerable = 10;
    f.guardIntent = false;
    event(b, 'cancel', f, '挡完了，该我了！');
    return true;
  }
  if (command === 'max') {
    const quick =
      f.contactTick >= 0 &&
      b.tick - f.contactTick < 10 &&
      [
        'light1',
        'light2',
        'light3',
        'low',
        'lightKick',
        'crouchKick',
        'closeHeavy',
        'heavy',
        'kick',
        'sweep',
        'upper',
      ].includes(f.action);
    if (f.y > 0 || b.grab || f.maxFrames > 0 || f.energy < MAX_COST || (!free(f) && !quick))
      return false;
    f.energy -= MAX_COST;
    begin(b, f, quick ? 'idle' : 'powerUp');
    f.maxMode = quick ? 'quick' : 'normal';
    f.maxFrames = quick ? QUICK_MAX_DURATION : MAX_DURATION;
    f.maxUses++;
    if (quick) {
      const foe = b.fighters[other(f.slot)];
      const direction = foe.x >= f.x ? 1 : -1;
      f.x += direction * Math.min(70, Math.max(0, Math.abs(foe.x - f.x) - 54));
    }
    event(b, 'max', f, quick ? 'Quick MAX！话没说完，拳接着来。' : 'MAX！算力全开，饭量翻倍！');
    b.freeze = Math.max(b.freeze, 6);
    return true;
  }
  if (command === 'roll') {
    const cancel = f.action === 'block';
    if (f.y > 0 || b.grab || (!free(f) && !cancel) || (cancel && f.energy < 50)) return false;
    if (cancel) f.energy -= 50;
    begin(b, f, 'roll');
    f.stun = 0;
    f.guardIntent = false;
    f.dashDirection = input.move || f.facing;
    event(b, 'dash', f, cancel ? '花50能量，先溜为敬！' : '你打你的，我先溜了。');
    return true;
  }
  if (
    f.silenced > 0 &&
    ['skill', 'variant', 'exSkill', 'exVariant', 'super', 'maxSuper', 'climax', 'meme'].includes(
      command,
    ) &&
    !(f.action === 'super' && (commandTier(command) ?? 0) > f.superTier) &&
    !(command === 'meme' && b.rice?.holder === f.slot)
  )
    return false;
  if (command === 'burst') {
    if (!['hurt', 'block', 'launched'].includes(f.action) || f.burstUsed || f.energy < 50 || b.grab)
      return false;
    f.energy -= 50;
    f.burstUsed = true;
    f.bursts++;
    f.buffer = null;
    f.stun = 0;
    f.landing = false;
    f.action = f.y > 0 ? 'jump' : 'idle';
    f.invulnerable = 12;
    resetCombo(f);
    const foe = b.fighters[other(f.slot)];
    const direction = foe.x >= f.x ? 1 : -1;
    const mid = clamp((f.x + foe.x) / 2, 138, 822);
    f.x = mid - direction * 90;
    foe.x = mid + direction * 90;
    foe.action = 'hurt';
    foe.landing = false;
    foe.stun = 16;
    foe.age = 0;
    foe.buffer = null;
    b.projectiles = b.projectiles.filter((p) => p.owner === f.slot);
    event(b, 'burst', f, '别连了！给口喘气的！');
    return true;
  }
  if (!free(f) && !canCancel(b, f, command)) return false;
  if (command === 'blowback') {
    begin(b, f, airborne ? 'airBlowback' : 'blowback');
    return true;
  }
  const enhanced = command === 'exSkill' || command === 'exVariant';
  if (enhanced && !canEX(f)) return false;
  if (command === 'exSkill') command = 'skill';
  if (command === 'exVariant') command = 'variant';
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
          : f.id === 'doubao'
            ? '唐包：已为你返回原问题。'
            : f.id === 'client'
              ? '还是第一版好，退回重做！'
              : f.id === 'prompt_sage'
                ? '此地禁止快走，请按鸡速通行。'
                : '网给你拔了，咱俩用拳头聊。',
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
    if (f.y > 0 || (!enhanced && (f.energy < 25 || f.variantCooldown > 0))) return false;
    if (enhanced) payEX(f);
    else f.energy -= 25;
    f.variantCooldown = Math.round(300 * cooling(b, f));
    f.variants++;
    begin(b, f, 'variant');
    if (normalCancel) event(b, 'cancel', f);
    f.exActive = enhanced;
    if (enhanced) {
      f.exUses++;
      event(b, 'ex', f, 'EX！这次加量。');
    }
    event(
      b,
      'variant',
      f,
      f.id === 'deepseek'
        ? '饭碗一收，尾巴一甩！'
        : f.id === 'gpt'
          ? '重来，这次真懂了！'
          : ROSTER[f.id].variant,
    );
    return true;
  }
  const tier = commandTier(command);
  if (tier !== null) {
    const upgrade = f.action === 'super';
    const specialCancel = ['skill', 'variant', 'counter'].includes(f.action);
    if (f.y > 0 || !canFinisher(f, tier, upgrade)) return false;
    const target = b.fighters[other(f.slot)];
    if ((upgrade || specialCancel) && target.hp <= 0) return false;
    if (
      specialCancel &&
      f.contactHit &&
      target.action === 'down' &&
      (target.combo >= (target.comboLimit > 350 ? 8 : 5) || target.comboDamage >= target.comboLimit)
    )
      return false;
    payFinisher(f, tier, upgrade);
    const connected = f.contactHit;
    begin(b, f, 'super');
    f.superTier = tier;
    f.superLinked = upgrade || specialCancel || normalCancel;
    if (f.superLinked && connected && target.action === 'down') {
      target.action = 'hurt';
      target.stun = 45;
      target.invulnerable = 0;
      target.vy = 0;
      target.landing = false;
    }
    if (upgrade) {
      f.advancedCancels++;
      event(
        b,
        'cancel',
        f,
        tier === 3 ? 'CLIMAX CANCEL！这顿吃席！' : 'ADVANCED CANCEL！再加一菜！',
      );
    } else if (specialCancel || normalCancel) event(b, 'cancel', f, 'SUPER CANCEL！加个大菜！');
    else if (tier > 1) event(b, 'max', f, finisherName(f.id, tier));
    return true;
  }
  if (command === 'skill') {
    if (
      f.y > 0 ||
      (!enhanced && f.cooldown > 0) ||
      (['doubao', 'prompt_sage'].includes(f.id) &&
        b.projectiles.some((p) => p.owner === f.slot && p.kind !== 'trap'))
    )
      return false;
    if (enhanced) payEX(f);
    f.cooldown = Math.round(
      (f.id === 'deepseek' ? 180 : f.id === 'gpt' ? 240 : 108) * cooling(b, f),
    );
    begin(b, f, 'skill');
    if (normalCancel) event(b, 'cancel', f);
    f.exActive = enhanced;
    if (enhanced) {
      f.exUses++;
      if (f.id === 'client') f.armor = 1;
      event(b, 'ex', f, `EX · ${EX_STYLE[f.id].name}`);
    }
    return true;
  }
  if (command === 'throw') {
    if (f.y > 0) return false;
    begin(b, f, 'throw');
    return true;
  }
  if (command === 'commandGrab') {
    if (f.id !== 'client' || f.y > 0 || b.grab) return false;
    begin(b, f, 'commandGrab');
    event(b, 'meme', f, '合同签了，别跑！');
    return true;
  }
  if (command === 'uppercut') {
    if (f.y > 0) return false;
    begin(b, f, 'upper');
    if (normalCancel) event(b, 'cancel', f);
    return true;
  }
  if (command === 'jump') {
    const chase =
      f.contactHit &&
      b.tick - f.contactTick < 12 &&
      b.fighters[other(f.slot)].action === 'launched';
    if (f.y > 0 && f.jumps >= 2) return false;
    startJump(f, input, chase);
    begin(b, f, 'jump');
    event(b, chase ? 'chase' : 'jump', f, chase ? '追上去！空中接招' : '');
    return true;
  }
  if (airborne) {
    begin(
      b,
      f,
      command === 'heavy'
        ? 'airHeavy'
        : command === 'kick'
          ? 'airKick'
          : command === 'lightKick'
            ? 'airLightKick'
            : 'air',
    );
    return true;
  }
  const action: Action =
    command === 'lightKick'
      ? input.crouch
        ? 'crouchKick'
        : 'lightKick'
      : command === 'kick'
        ? input.crouch
          ? 'sweep'
          : 'kick'
        : command === 'heavy'
          ? input.crouch
            ? 'upper'
            : b.fighters[other(f.slot)].y === 0 &&
                Math.abs(f.x - b.fighters[other(f.slot)].x) <= NORMAL_STYLE[f.id].close[2]
              ? 'closeHeavy'
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
  const crouchedAction = lowStance[f.action];
  if (input.crouch && f.y === 0 && f.age <= 2 && !f.landed.length && crouchedAction) {
    f.action = crouchedAction;
    f.crouching = true;
  }
  if (f.y === 0 && input.crouch && free(f)) f.crouchRecent = 8;
  if (free(f) || f.action === 'block') f.crouching = f.y === 0 && input.crouch;
  if (free(f) && f.y === 0 && f.action !== 'jump')
    f.facing = b.fighters[other(f.slot)].x < f.x ? -1 : 1;
  f.guardIntent = f.y === 0 && (input.guard || input.move === -f.facing);
  const commands = priority.filter((c) => input.commands.includes(c) || f.buffer?.command === c);
  let acted = false;
  for (const command of commands) {
    const buffered = f.buffer?.command === command ? f.buffer : undefined;
    const context = buffered
      ? { ...input, move: buffered.move ?? input.move, crouch: buffered.crouch ?? input.crouch }
      : input;
    const jumpChord = basicAttacks.includes(command)
      ? (buffered?.jump ??
        (input.commands.includes('jump') ? (input.contexts?.jump ?? input) : undefined))
      : undefined;
    if (jumpChord) {
      const jumped = perform(b, f, 'jump', { ...input, ...jumpChord });
      if (!jumped && !(f.y > 0 && f.jumps >= 2)) continue;
      // Takeoff and its attack share a tick; physics still advances only once.
      if (perform(b, f, command, context) || jumped) {
        acted = true;
        break;
      }
      continue;
    }
    const lateAttack =
      command === 'jump' && f.y === 0 && f.age <= 2 && !f.landed.length
        ? takeoffAttack[f.action]
        : undefined;
    if (perform(b, f, command, context)) {
      if (lateAttack) perform(b, f, lateAttack, context);
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
  if (f.action === 'roll' && f.age >= 3 && f.age < 20) f.x += f.dashDirection * 9;
  if (f.action === 'walk')
    f.x += (input.move * (input.move === f.facing ? 270 : 230) * speed(b, f)) / 60;
  if (f.y > 0 && (f.action === 'jump' || AIR_ATTACKS.includes(f.action)))
    f.x += (airMove(f, input) * speed(b, f)) / 60;
  if (f.action === 'jump' || AIR_ATTACKS.includes(f.action)) updateJump(f, input);
  if (f.action === 'variant') {
    if (f.id === 'deepseek' && f.age < 8) f.x -= f.facing * 10;
    if (f.id === 'gpt' && f.age < 6) f.x += f.facing * 10;
    if (f.id === 'doubao' && f.age === 5) f.vy = 420;
    if (['client', 'unplug_uncle'].includes(f.id) && f.age < 8) f.x += f.facing * 7;
    if (f.id === 'prompt_sage' && f.age < 8) f.x -= f.facing * 6;
  }
  if (f.action === 'dash' && f.age < 10) f.x += f.dashDirection * 10 * (f.slowed > 0 ? 0.6 : 1);
  if (f.action === 'dash' && f.y > 0 && f.age < 10) f.vy = 30;
  if (
    f.id === 'gpt' &&
    ((f.action === 'skill' && f.age >= 4 && f.age < 12) ||
      (f.action === 'super' && !f.superLinked && f.age >= 4 && f.age < 14))
  )
    f.x += f.facing * (f.action === 'super' ? 18 : 15);
  if (f.action === 'super' && f.superLinked && f.age < 8) {
    const target = b.fighters[other(f.slot)];
    f.x += f.facing * Math.min(18, Math.max(0, (target.x - f.x) * f.facing - 75));
  }
  if (
    f.id === 'doubao' &&
    f.action === 'super' &&
    f.superTier === 3 &&
    f.age === 49 &&
    f.landed.length === 0 &&
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
      damage: 100,
      enhanced: true,
    });
    event(b, 'meme', f, '锅甩出去了……怎么又回来了？');
  }
  if (f.action === 'skill' && f.id === 'doubao' && (f.age === 18 || (f.exActive && f.age === 28))) {
    b.projectiles.push({
      id: b.nextId++,
      owner: f.slot,
      x: f.x + f.facing * 48,
      y: 52,
      direction: f.facing,
      life: 150,
      damage: f.exActive ? 65 : 100,
      enhanced: f.exActive,
    });
  }
  if (f.id === 'prompt_sage' && f.action === 'skill' && f.age === 16) {
    b.projectiles.push({
      id: b.nextId++,
      owner: f.slot,
      x: f.x + f.facing * 50,
      y: 60,
      direction: f.facing,
      life: 160,
      kind: 'talisman',
      damage: f.exActive ? 95 : 65,
      enhanced: f.exActive,
    });
  }
  if (
    f.id === 'prompt_sage' &&
    f.age === 22 &&
    (f.action === 'meme' || (f.action === 'skill' && f.exActive))
  ) {
    b.projectiles = b.projectiles.filter((p) => p.owner !== f.slot || p.kind !== 'trap');
    b.projectiles.push({
      id: b.nextId++,
      owner: f.slot,
      x: clamp(f.x + f.facing * 145, 48, 912),
      y: 24,
      direction: f.facing,
      life: 180,
      enhanced: f.exActive,
      kind: 'trap',
      damage: 45,
    });
  }
  if (f.action === 'eat' || (f.action === 'meme' && f.id === 'deepseek')) {
    if (f.age === 36 && b.rice?.holder === f.slot) {
      f.hp = Math.min(1000, f.hp + 40);
      gain(f, 20);
      b.rice = null;
      event(
        b,
        'meme',
        f,
        f.maxFrames > 0 ? '白饭到账：生命 +40。爆气中不攒能量。' : '白饭到账：生命 +40，能量 +20。',
      );
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
      f.jumpVariable = false;
      f.jumpDirection = 0;
      event(b, 'land', f);
      if (f.action === 'launched') knockdown(f);
      if (f.action === 'jump' || AIR_ATTACKS.includes(f.action)) {
        f.landing = true;
        f.stun = f.action === 'jump' ? 4 : 6;
        f.action = 'hurt';
        f.age = 0;
      }
    }
  }
}
function separate(b: Battle, distance = 48) {
  if (distance === 48 && b.grab?.command) return;
  const [a, c] = b.fighters;
  if (distance === 48 && [a, c].some((f) => rollingPastStrikes(f.action, f.age))) return;
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
  slow?: boolean;
  enhanced?: boolean;
  superTier?: SuperTier;
  final?: boolean;
  x: number;
}
function hittable(f: Fighter) {
  return f.invulnerable === 0 && !['down', 'grabbed', 'throwing'].includes(f.action);
}
function collect(b: Battle): Hit[] {
  const hits: Hit[] = [];
  for (const f of b.fighters) {
    const move = moveFor(f.id, f.action, f.exActive, f.superTier),
      target = b.fighters[other(f.slot)];
    if (!move || !hittable(target) || rollingPastStrikes(target.action, target.age)) continue;
    move.strikes.forEach((s, index) => {
      const origin = f.action === 'variant' && f.id === 'deepseek' ? f.originX : f.x;
      const key = `${f.serial}:${index}`,
        delta = (target.x - origin) * f.facing;
      const low = f.y + (AIR_ATTACKS.includes(f.action) ? -50 : 10);
      const high =
        f.y +
        (f.action === 'upper' || (f.action === 'variant' && f.id === 'doubao')
          ? 170
          : ['low', 'sweep', 'crouchKick'].includes(f.action)
            ? 40
            : 96);
      const targetTop = target.y + (isCrouched(target) ? 64 : 96);
      if (
        f.age < s.start ||
        f.age >= s.start + s.active ||
        f.landed.includes(key) ||
        (s.behind ? Math.abs(delta) > s.reach : delta < -10 || delta > s.reach) ||
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
        enhanced: f.exActive,
        superTier: f.superTier,
        final: index === move.strikes.length - 1,
      });
    });
  }
  for (const p of b.projectiles) {
    // Ground traps telegraph for six frames before becoming active.
    if (p.kind === 'trap' && p.life > 173) continue;
    const owner = b.fighters[p.owner];
    const target =
      p.returning && Math.abs(owner.x - p.x) < 46 && owner.y < p.y + 22
        ? owner
        : b.fighters[other(p.owner)];
    if (
      hittable(target) &&
      !rollingPastStrikes(target.action, target.age) &&
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
        slow: p.kind === 'trap',
        enhanced: !!p.enhanced,
        x: p.x - p.direction,
      });
    }
  }
  return hits.sort((a, c) => a.serial - c.serial);
}
function gain(f: Fighter, amount: number) {
  if (f.maxFrames > 0) return;
  f.energy = clamp(f.energy + amount, 0, f.energyCap);
}
function damage(
  b: Battle,
  f: Fighter,
  target: Fighter,
  amount: number,
  ultimate = false,
  enhanced = false,
  tier: SuperTier = 1,
  move: NonNullable<BattleEvent['move']> = f.action,
) {
  target.comboLimit = Math.max(
    target.comboLimit,
    ultimate && tier > 1 ? (tier === 3 ? 700 : 600) : f.maxFrames > 0 ? 500 : 350,
  );
  const scaling = [1, 0.85, 0.7, 0.55, 0.4][Math.min(target.combo, 4)]!;
  const actual = Math.min(
    target.hp,
    Math.max(0, target.comboLimit - target.comboDamage),
    Math.floor(
      amount *
        (ultimate ? Math.max(0.7, scaling) : scaling) *
        (f.maxMode === 'normal' && f.maxFrames > 0 ? 1.12 : 1),
    ),
  );
  target.hp -= actual;
  target.comboDamage += actual;
  target.combo++;
  f.damage += actual;
  f.maxCombo = Math.max(f.maxCombo, target.combo);
  f.whiffs = 0;
  if (!ultimate) {
    if (!enhanced) gain(f, actual * 0.12);
    gain(target, actual * 0.04);
  }
  const feedback = event(b, 'hit', target);
  feedback.source = f.slot;
  feedback.move = move;
  feedback.damage = actual;
}
function resolveHits(b: Battle, hits: Hit[]) {
  const snapshots = b.fighters.map((f) => ({
    action: f.action,
    age: f.age,
    id: f.id,
    facing: f.facing,
    x: f.x,
    crouched: isCrouched(f),
    guarding: f.guardIntent && (free(f) || f.action === 'block'),
    enhanced: f.exActive,
    armor: f.armor,
  }));
  const parried = new Set<Slot>();
  const armored = new Set<Slot>();
  const outcomes = hits.map((hit) => {
    const t = snapshots[hit.target]!;
    const front = (hit.x - t.x) * t.facing >= 0;
    const parry =
      !parried.has(hit.target) &&
      t.id === 'deepseek' &&
      t.action === 'skill' &&
      t.age >= (t.enhanced ? 2 : 4) &&
      t.age < (t.enhanced ? 24 : 16) &&
      hit.action !== 'super' &&
      front;
    if (parry) parried.add(hit.target);
    const armor =
      !armored.has(hit.target) &&
      t.id === 'client' &&
      t.action === 'skill' &&
      t.enhanced &&
      t.armor > 0 &&
      t.age >= 2 &&
      t.age < 15 &&
      hit.action !== 'super' &&
      front;
    if (armor) armored.add(hit.target);
    return {
      hit,
      result: parry
        ? 'parry'
        : front &&
            (t.guarding || ['guard', 'block'].includes(t.action)) &&
            guardsLevel(t.crouched, hitLevel(hit.action))
          ? 'block'
          : armor
            ? 'armor'
            : 'hit',
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
      f.contactHit = result === 'hit' || result === 'armor';
    }
    if (result === 'parry') {
      gain(target, 12);
      target.counters++;
      if (!hurt.has(target.slot)) {
        const enhanced = snapshots[hit.target]!.enhanced;
        begin(b, target, 'counter');
        target.exActive = enhanced;
      }
      event(b, 'parry', target, '想完了。现学现揍！');
      const cacheKey = `${f.id}:${hit.action}`;
      if (target.cachedParries.includes(cacheKey))
        interaction(b, target, target, 'cache-hit', '缓存命中：这题做过。');
      else target.cachedParries.push(cacheKey);
      b.freeze = Math.max(b.freeze, 6);
      continue;
    }
    if (result === 'block') {
      if (target.action === 'guardBreak') continue;
      target.guardGauge = Math.max(
        0,
        target.guardGauge -
          guardPressure(hit.action) *
            (hit.action === 'super'
              ? (hit.superTier ?? 1) === 3
                ? f.id === 'client'
                  ? 2.5
                  : 2
                : hit.superTier === 2
                  ? 1.4
                  : 1
              : hit.enhanced
                ? 1.4
                : 1),
      );
      target.guardRegenDelay = 90;
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
      if (target.guardGauge === 0 && !hurt.has(target.slot)) {
        begin(b, target, 'guardBreak');
        target.stun = 42;
        target.guardIntent = false;
        const feedback = event(b, 'guard-break', target, '防御到头了，嘴还硬着呢！');
        feedback.source = f.slot;
        feedback.move = hit.action;
        b.freeze = Math.max(b.freeze, 6);
      } else {
        const feedback = event(b, 'block', target);
        feedback.source = f.slot;
        feedback.move = hit.action;
      }
      b.freeze = Math.max(b.freeze, 2);
      continue;
    }
    if (result === 'armor') {
      target.armor--;
      damage(b, f, target, Math.floor(hit.data.damage / 2), false, !!hit.enhanced, 1, hit.action);
      resetCombo(target);
      if (target.hp <= 0) knockdown(target);
      event(b, 'ex', target, '需求硬塞：这一拳先记账！');
      b.freeze = Math.max(b.freeze, 4);
      continue;
    }
    const healthBefore = target.hp;
    target.exActive = false;
    target.armor = 0;
    if (target.guardGauge === 0) target.guardGauge = GUARD_CAPACITY[target.id];
    target.landing = false;
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
    damage(
      b,
      f,
      target,
      hit.data.damage,
      hit.action === 'super',
      !!hit.enhanced,
      hit.superTier ?? 1,
      hit.action,
    );
    if (hit.slow) {
      target.slowed = 90;
      event(b, 'meme', target, '你现在是一只慢鸡：移速 -40%，持续1.5秒。');
    }
    if (
      f.id === 'unplug_uncle' &&
      (hit.action === 'meme' || (hit.action === 'super' && hit.final))
    ) {
      f.silenced = hit.superTier === 3 ? 0 : 150;
      target.silenced = hit.superTier === 3 ? 240 : 150;
      b.projectiles = [];
      event(
        b,
        'meme',
        f,
        hit.superTier === 3 ? '你断网4秒，我提前下班。' : '双方断网2.5秒！拳脚、投技和脱身照常用。',
      );
    }
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
    if (hit.action === 'super') {
      if (!f.superCounted) {
        f.supers++;
        if (hit.superTier === 3) f.climaxHits++;
        f.superCounted = true;
      }
      if (hit.superTier === 3 && hit.final) {
        if (f.id === 'deepseek') {
          f.hp = Math.min(1000, f.hp + 80);
          event(b, 'meme', f, '全村开席，先给自己盛80血！');
        }
        if (f.id === 'prompt_sage') target.slowed = 180;
      }
    }
    if (riceFeedback === 'rice-reclaimed')
      interaction(b, f, f, riceFeedback, '打我可以，别动饭！白饭已夺回。');
    if (riceFeedback === 'rice-spill')
      interaction(b, f, target, riceFeedback, '饭碗都给你打翻！白饭没吃上。');
    if (hit.delivered)
      interaction(b, f, target, 'parcel-delivered', '包邮到家：您购买的挨打已送达。');
    target.x = clamp(target.x + (target.x >= hit.x ? 1 : -1) * hit.data.push, 48, 912);
    if (f.id === 'unplug_uncle' && hit.action === 'skill') {
      target.x = clamp(f.x + f.facing * 64, 48, 912);
      event(b, 'meme', f, '网费没交？过来聊聊。');
      if (hit.enhanced) {
        target.silenced = Math.max(target.silenced, 90);
        event(b, 'ex', f, '只断你的网，我这是VIP线路。');
      }
    }
    target.buffer = null;
    if (target.hp <= 0) {
      knockdown(target, hit.data.launch);
      if (['airHeavy', 'airKick', 'airBlowback'].includes(hit.action)) target.vy = -720;
    } else if (
      target.combo >= (target.comboLimit >= 600 ? 12 : target.comboLimit > 350 ? 8 : 5) ||
      (target.comboDamage >= target.comboLimit &&
        !(hit.action === 'super' && !hit.final && target.hp > 0))
    )
      knockdown(target);
    else if (hit.data.launch) {
      target.action = 'launched';
      target.age = 0;
      target.vy = 660;
      target.stun = 0;
      event(b, 'launch', target, '挑空！跳跃追击');
    } else if (hit.data.down) {
      knockdown(target, hit.data.launch);
      if (['airHeavy', 'airKick', 'airBlowback'].includes(hit.action)) target.vy = -720;
    } else {
      target.action = target.y > 0 ? 'launched' : 'hurt';
      if (target.y > 0) target.vy = Math.max(target.vy, 240);
      target.stun = hit.data.stun;
      target.age = 0;
    }
    b.freeze = Math.max(
      b.freeze,
      ['heavy', 'closeHeavy', 'kick', 'counter', 'upper'].includes(hit.action) ? 6 : 4,
    );
    if (hit.action === 'super' && hit.final && !hurt.has(f.slot)) {
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
    if (grab.command) {
      d.x = clamp(a.x + a.facing * 100, 48, 912);
      d.y = 0;
      d.vy = 0;
      event(b, 'throw', a, '合同生效，躺着返工！');
    } else
      d.x = grab.revision
        ? clamp(a.x - a.facing * 100, 48, 912)
        : clamp(d.x + a.facing * 100, 48, 912);
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
      !(AIR_ATTACKS.includes(d.action) || ['jump', 'dash'].includes(d.action)) ||
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
    if (p.kind === 'trap') continue;
    for (const f of b.fighters) {
      if (
        (p.owner === f.slot && !p.returning) ||
        !['heavy', 'closeHeavy', 'upper', 'airHeavy', 'airKick'].includes(f.action)
      )
        continue;
      const hit = moveFor(f.id, f.action, f.exActive)?.strikes.find(
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
    if (grab.command) {
      const a = b.fighters[grab.attacker],
        d = b.fighters[grab.defender];
      const lift = Math.max(0, Math.min(1, (grab.age - 3) / 5));
      const drop = Math.max(0, Math.min(1, (grab.age - 18) / 6));
      d.x = clamp(a.x + a.facing * (grab.age < 18 ? 44 - lift * 8 : 36 + drop * 64), 48, 912);
      d.y = grab.age < 18 ? 18 + lift * 44 : 62 * (1 - drop);
      d.vy = 0;
    }
    if (grab.catch || b.fighters[grab.attacker].id === 'gpt') {
      const a = b.fighters[grab.attacker],
        d = b.fighters[grab.defender];
      const poseAge = grab.age + 1;
      d.x = clamp(a.x + a.facing * 42, 48, 912);
      // Match the open-arm hold, overhead lift and frame-nine slam sprites.
      d.y = poseAge < 4 ? 52 : poseAge < 8 ? 52 + (poseAge - 4) * 11 : poseAge === 8 ? 42 : 0;
      d.vy = 0;
    }
    grab.age++;
    if (!grab.command && grab.age <= 8 && inputs[grab.defender].commands.includes('throw')) {
      releaseGrab(b, true);
      return;
    }
    if (grab.age === 9) {
      const a = b.fighters[grab.attacker],
        d = b.fighters[grab.defender];
      resetCombo(d);
      damage(b, a, d, grab.command ? 180 : grab.catch ? 120 : grab.revision ? 135 : 100);
      a.throws++;
      if (grab.command) a.commandThrows++;
      grab.paid = true;
    }
    if (grab.age >= 24) releaseGrab(b, false);
    return;
  }
  const candidates = b.fighters.filter((f) => {
    const d = b.fighters[other(f.slot)];
    return (
      ((f.action === 'throw' && f.age >= 7 && f.age < 9) ||
        (f.id === 'client' && f.action === 'commandGrab' && f.age >= 6 && f.age < 9) ||
        (f.id === 'client' && f.action === 'meme' && f.age >= 12 && f.age < 16)) &&
      !hurt.has(f.slot) &&
      f.y === 0 &&
      d.y === 0 &&
      hittable(d) &&
      !['hurt', 'block', 'guardBreak'].includes(d.action) &&
      Math.abs(d.x - f.x) <= (f.action === 'meme' ? 82 : f.action === 'commandGrab' ? 70 : 64) &&
      (!['meme', 'commandGrab'].includes(f.action) || (d.x - f.x) * f.facing >= 0)
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
    if (b.rice?.holder === d.slot && a.action !== 'commandGrab') {
      b.rice.holder = a.slot;
      b.rice.life = 360;
      a.action = 'idle';
      a.age = 0;
      a.buffer = null;
      d.action = 'hurt';
      d.landing = false;
      d.stun = 12;
      d.age = 0;
      d.buffer = null;
      interaction(b, a, a, 'rice-stolen', '白饭抢过来了！整活键开吃。');
      return;
    }
    b.grab = {
      attacker: a.slot,
      defender: d.slot,
      age: 0,
      paid: false,
      revision: a.id === 'client' && a.action === 'meme',
      command: a.action === 'commandGrab',
    };
    if (b.grab.command && b.rice?.holder === d.slot) {
      b.rice = null;
      interaction(b, a, d, 'rice-spill', '先别吃了，合同还没改完！');
    }
    a.action = 'throwing';
    d.action = 'grabbed';
    if (b.grab.command) {
      d.x = clamp(a.x + a.facing * 44, 48, 912);
      d.y = 18;
      d.vy = 0;
      d.age = 0;
    }
    a.buffer = null;
    d.buffer = null;
    event(
      b,
      'throw',
      a,
      b.grab.command
        ? '合同锁人！这次不能拆，只能提前躲。'
        : b.grab.revision
          ? '第一版也不要了，退回去！'
          : '别光挡，出来聊聊',
    );
  }
}
function finishRound(b: Battle) {
  if (b.grab?.command) return;
  if (b.fighters.every((f) => f.hp > 0) && b.timer > 0) return;
  const [a, d] = b.fighters;
  b.roundWinner = a.hp === d.hp ? null : a.hp > d.hp ? 0 : 1;
  if (b.roundWinner !== null && !b.options.practice) b.scores[b.roundWinner]++;
  settleTeamBout(b);
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
        ? '这回合赢了，饭钱你出！'
        : '嘴还硬，人先躺了。',
  );
  if (!b.options.practice && b.roundWinner !== null) {
    const loser = b.fighters[other(b.roundWinner)];
    interaction(b, loser, loser, 'sore-loser', '翻个面：战略性休息。');
  }
}
function nextRound(b: Battle) {
  if (b.teams) {
    const outcome = teamOutcome(b.teams);
    if (outcome !== null) {
      b.phase = 'done';
      b.outcome = outcome;
      return;
    }
    b.teams.forEach(advanceTeamOrder);
  } else if (
    !b.options.practice &&
    (b.scores.some((s) => s >= 2) || b.round === b.options.roundLimit)
  ) {
    b.phase = 'done';
    b.outcome = b.scores[0] === b.scores[1] ? 'draw' : b.scores[0] > b.scores[1] ? 'win' : 'lose';
    return;
  }
  if (!b.options.practice) b.round++;
  b.phase = b.options.practice ? 'fight' : 'countdown';
  b.phaseFrames = b.options.practice ? 0 : 180;
  b.timer = Math.round(b.options.roundSeconds * 60);
  b.fighters = b.fighters.map((f) => ({
    ...fighter(b.teams?.[f.slot].members[b.teams[f.slot].active]!.id ?? f.id, f.slot),
    damage: f.damage,
    maxCombo: f.maxCombo,
    counters: f.counters,
    throws: f.throws,
    commandThrows: f.commandThrows,
    variants: f.variants,
    variantHits: f.variantHits,
    supers: f.supers,
    advancedCancels: f.advancedCancels,
    climaxHits: f.climaxHits,
    bursts: f.bursts,
    motionCount: f.motionCount,
    exUses: f.exUses,
    maxUses: f.maxUses,
  })) as [Fighter, Fighter];
  if (b.teams) {
    for (const f of b.fighters) {
      const team = b.teams[f.slot];
      f.hp = team.members[team.active]!.hp;
      f.energyCap = teamEnergyCap(team);
      f.energy = clamp(team.energy, 0, f.energyCap);
    }
  } else {
    b.fighters[0].energy =
      b.options.practice && b.options.infiniteEnergy
        ? ENERGY_CAP
        : b.options.playerPerks.includes('battery')
          ? 25
          : 0;
    b.fighters[1].energy = clamp(b.options.enemyStartingEnergy, 0, ENERGY_CAP);
  }
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
    if (b.phase === 'cinematic' && b.cinematicOwner !== null && b.phaseFrames > 36) {
      const owner = b.fighters[b.cinematicOwner],
        target = b.fighters[other(owner.slot)];
      const controls =
        owner.slot === 0
          ? player
          : (second ?? (b.options.localVersus ? emptyInput() : botCinematicInput(b)));
      const upgrade = priority.find(
        (command) =>
          (commandTier(command) ?? 0) > owner.superTier && controls.commands.includes(command),
      );
      if (upgrade && owner.hp > 0 && target.hp > 0 && perform(b, owner, upgrade, controls)) {
        b.phase = 'fight';
        b.cinematicOwner = null;
        b.phaseFrames = 0;
        b.freeze = 6;
        return b;
      }
    }
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
  b.inputFrame++;
  const facingFor = (f: Fighter): -1 | 1 =>
    free(f) && f.y === 0 ? (b.fighters[other(f.slot)].x < f.x ? -1 : 1) : f.facing;
  player = motionInput(b.fighters[0], player, b.inputFrame, facingFor(b.fighters[0]));
  if (second) second = motionInput(b.fighters[1], second, b.inputFrame, facingFor(b.fighters[1]));
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
          guard: b.options.dummy === 'guard' || b.options.dummy === 'crouch-guard',
          crouch: b.options.dummy === 'crouch-guard',
          commands:
            b.tick % 90 === 0
              ? b.options.dummy === 'repeat-heavy'
                ? ['heavy']
                : b.options.dummy === 'repeat-jump'
                  ? ['jump']
                  : []
              : [],
        }
      : null;
  const cpu = second ?? (b.options.localVersus ? emptyInput() : (dummy ?? botInput(b))),
    inputs: [Input, Input] = [player, cpu];
  // Local P2 was already queued before hitstop. Queuing the same edge twice
  // would overwrite the jump part of a paired takeoff/attack input.
  if (!second) queue(b, b.fighters[1], cpu);
  for (const f of b.fighters) prepare(b, f);
  if (b.rice && --b.rice.life <= 0) b.rice = null;
  if (b.options.practice && b.options.infiniteEnergy) b.fighters[0].energy = ENERGY_CAP;
  for (const f of b.fighters) {
    act(b, f, inputs[f.slot]);
    physics(b, f);
  }
  separate(b);
  for (const p of b.projectiles) {
    p.x += p.direction * (p.kind === 'trap' ? 0 : p.kind === 'talisman' ? 4 : 6);
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
      if (
        p.id !== q.id &&
        p.owner !== q.owner &&
        Math.abs(p.x - q.x) < 44 &&
        Math.abs(p.y - q.y) < 30
      ) {
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
