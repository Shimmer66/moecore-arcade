export const STEP_MS = 1000 / 60;
export const WORLD_WIDTH = 960;
export const ROUND_FRAMES = 60 * 60;
export const MAX_HP = 100;

export type Slot = 0 | 1;
export type UncleId = 'wok' | 'thermos';
export type Action = 'idle' | 'walk' | 'jump' | 'guard' | 'light' | 'heavy' | 'special' | 'hit';
export type Phase = 'fight' | 'round-end' | 'match-end';

export interface FighterInput {
  left: boolean;
  right: boolean;
  guard: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
}

export interface Fighter {
  id: UncleId;
  x: number;
  y: number;
  vy: number;
  facing: -1 | 1;
  hp: number;
  action: Action;
  actionFrame: number;
  hitTarget: boolean;
  hitstun: number;
  specialCooldown: number;
}

export interface BattleEvent {
  type: 'hit' | 'block' | 'special' | 'round';
  actor?: Slot;
  target?: Slot;
  amount?: number;
}

export interface Battle {
  phase: Phase;
  round: number;
  scores: [number, number];
  timerFrames: number;
  fighters: [Fighter, Fighter];
  winner: Slot | 'draw' | null;
  events: BattleEvent[];
  elapsedFrames: number;
}

interface Attack {
  activeFrom: number;
  activeTo: number;
  duration: number;
  range: number;
  damage: number;
  knockback: number;
  stun: number;
}

const ATTACKS: Record<'light' | 'heavy' | 'special', Attack> = {
  light: {
    activeFrom: 5,
    activeTo: 8,
    duration: 20,
    range: 104,
    damage: 8,
    knockback: 18,
    stun: 11,
  },
  heavy: {
    activeFrom: 12,
    activeTo: 16,
    duration: 34,
    range: 112,
    damage: 15,
    knockback: 42,
    stun: 20,
  },
  special: {
    activeFrom: 16,
    activeTo: 22,
    duration: 46,
    range: 168,
    damage: 20,
    knockback: 70,
    stun: 26,
  },
};

export function emptyInput(): FighterInput {
  return {
    left: false,
    right: false,
    guard: false,
    jump: false,
    light: false,
    heavy: false,
    special: false,
  };
}

function freshFighter(id: UncleId, x: number, facing: -1 | 1): Fighter {
  return {
    id,
    x,
    y: 0,
    vy: 0,
    facing,
    hp: MAX_HP,
    action: 'idle',
    actionFrame: 0,
    hitTarget: false,
    hitstun: 0,
    specialCooldown: 0,
  };
}

export function createBattle(): Battle {
  return {
    phase: 'fight',
    round: 1,
    scores: [0, 0],
    timerFrames: ROUND_FRAMES,
    fighters: [freshFighter('wok', 250, 1), freshFighter('thermos', 710, -1)],
    winner: null,
    events: [],
    elapsedFrames: 0,
  };
}

export function nextRound(battle: Battle): Battle {
  if (battle.phase !== 'round-end') return battle;
  return {
    ...createBattle(),
    round: battle.round + 1,
    scores: [...battle.scores],
    elapsedFrames: battle.elapsedFrames,
  };
}

function canAct(fighter: Fighter): boolean {
  return fighter.hitstun === 0 && ['idle', 'walk', 'jump', 'guard'].includes(fighter.action);
}

function setAction(fighter: Fighter, action: Action) {
  fighter.action = action;
  fighter.actionFrame = 0;
  fighter.hitTarget = false;
}

function updateFighter(fighter: Fighter, input: FighterInput) {
  fighter.specialCooldown = Math.max(0, fighter.specialCooldown - 1);
  if (fighter.hitstun > 0) {
    fighter.hitstun -= 1;
    setAction(fighter, fighter.hitstun === 0 ? (fighter.y > 0 ? 'jump' : 'idle') : 'hit');
  } else if (
    fighter.action === 'light' ||
    fighter.action === 'heavy' ||
    fighter.action === 'special'
  ) {
    fighter.actionFrame += 1;
    if (fighter.actionFrame >= ATTACKS[fighter.action].duration)
      setAction(fighter, fighter.y > 0 ? 'jump' : 'idle');
  } else if (canAct(fighter)) {
    if (input.light) setAction(fighter, 'light');
    else if (input.heavy) setAction(fighter, 'heavy');
    else if (input.special && fighter.specialCooldown === 0) {
      setAction(fighter, 'special');
      fighter.specialCooldown = 240;
    } else if (input.jump && fighter.y === 0) {
      fighter.vy = 10.8;
      setAction(fighter, 'jump');
    } else if (input.guard && fighter.y === 0) {
      setAction(fighter, 'guard');
    } else {
      const direction = Number(input.right) - Number(input.left);
      if (direction !== 0) {
        fighter.x += direction * 4.4;
        fighter.facing = direction as -1 | 1;
        setAction(fighter, fighter.y > 0 ? 'jump' : 'walk');
      } else {
        setAction(fighter, fighter.y > 0 ? 'jump' : 'idle');
      }
    }
  }

  if (fighter.y > 0 || fighter.vy > 0) {
    fighter.y += fighter.vy;
    fighter.vy -= 0.62;
    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
      if (fighter.action === 'jump') setAction(fighter, 'idle');
    }
  }
  fighter.x = Math.max(70, Math.min(WORLD_WIDTH - 70, fighter.x));
}

function isBlocking(target: Fighter, attacker: Fighter): boolean {
  const facingAttacker = Math.sign(attacker.x - target.x) === target.facing;
  return target.action === 'guard' && target.y === 0 && facingAttacker;
}

function resolveAttack(fighters: [Fighter, Fighter], actorSlot: Slot, events: BattleEvent[]) {
  const targetSlot = (actorSlot === 0 ? 1 : 0) as Slot;
  const actor = fighters[actorSlot];
  const target = fighters[targetSlot];
  if (!['light', 'heavy', 'special'].includes(actor.action) || actor.hitTarget) return;
  const attack = ATTACKS[actor.action as 'light' | 'heavy' | 'special'];
  if (actor.actionFrame < attack.activeFrom || actor.actionFrame > attack.activeTo) return;
  const forward = (target.x - actor.x) * actor.facing;
  if (forward < 0 || forward > attack.range || Math.abs(target.y - actor.y) > 92) return;

  actor.hitTarget = true;
  const blocked = isBlocking(target, actor);
  const damage = blocked ? Math.max(1, Math.round(attack.damage * 0.2)) : attack.damage;
  target.hp = Math.max(0, target.hp - damage);
  target.x += actor.facing * (blocked ? attack.knockback * 0.28 : attack.knockback);
  if (!blocked) {
    target.hitstun = attack.stun;
    setAction(target, 'hit');
  }
  events.push({
    type: blocked ? 'block' : 'hit',
    actor: actorSlot,
    target: targetSlot,
    amount: damage,
  });
  if (actor.action === 'special') events.push({ type: 'special', actor: actorSlot });
}

function settleRound(battle: Battle) {
  const [a, b] = battle.fighters;
  if (a.hp > 0 && b.hp > 0 && battle.timerFrames > 0) return;
  let winner: Slot | 'draw' = 'draw';
  if (a.hp !== b.hp) winner = a.hp > b.hp ? 0 : 1;
  const scores: [number, number] = [...battle.scores];
  if (winner !== 'draw') scores[winner] += 1;
  battle.winner = winner;
  battle.scores = scores;
  battle.phase = scores[0] >= 2 || scores[1] >= 2 ? 'match-end' : 'round-end';
  battle.events.push(winner === 'draw' ? { type: 'round' } : { type: 'round', actor: winner });
}

export function step(current: Battle, inputs: readonly [FighterInput, FighterInput]): Battle {
  if (current.phase !== 'fight') return current;
  const battle: Battle = {
    ...current,
    fighters: current.fighters.map((fighter) => ({ ...fighter })) as [Fighter, Fighter],
    scores: [...current.scores],
    events: [],
    elapsedFrames: current.elapsedFrames + 1,
    timerFrames: Math.max(0, current.timerFrames - 1),
  };
  updateFighter(battle.fighters[0], inputs[0]);
  updateFighter(battle.fighters[1], inputs[1]);

  const [a, b] = battle.fighters;
  const overlap = 92 - Math.abs(a.x - b.x);
  if (overlap > 0 && Math.abs(a.y - b.y) < 70) {
    const push = overlap / 2;
    if (a.x <= b.x) {
      a.x -= push;
      b.x += push;
    } else {
      a.x += push;
      b.x -= push;
    }
  }
  if (a.action !== 'hit') a.facing = a.x <= b.x ? 1 : -1;
  if (b.action !== 'hit') b.facing = b.x <= a.x ? 1 : -1;

  resolveAttack(battle.fighters, 0, battle.events);
  resolveAttack(battle.fighters, 1, battle.events);
  settleRound(battle);
  return battle;
}
