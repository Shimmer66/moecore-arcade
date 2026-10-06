import { createStandControl, ownerDamage, type HitPart } from './stand-control';
import { applyStatus, statusForActor, type StatusEffect } from './status-effects';
import { BARRAGE_TICK_DAMAGE } from './barrage';
import { FIREBALL_DAMAGE } from './fireball';

export type Side = 'p1' | 'p2';
export type Action = 'light' | 'heavy' | 'stand' | 'guard' | 'special' | 'finger';
export const ROUND_SECONDS = 75;
export const ROUND_BREAK_MS = 1800;
export const WINS_REQUIRED = 2;
export const FIGHTER_HP = 500;
export const DIO_BOSS_HP = 1000;
export const BARRAGE_DAMAGE_LIMIT = FIGHTER_HP / 2;

export function createCombatState(side: Side, maxHp = FIGHTER_HP) {
  const x = side === 'p1' ? 25 : 75;
  const facing: 1 | -1 = side === 'p1' ? 1 : -1;
  return {
    hp: maxHp,
    maxHp,
    energy: side === 'p1' ? 30 : 20,
    x,
    facing,
    guard: false,
    stun: 0,
    attack: null as Action | null,
    attackFrames: 0,
    barrageMs: 0,
    barrageVoiceMs: 0,
    barrageHitMs: 0,
    barrageDamageLeft: BARRAGE_DAMAGE_LIMIT,
    ultimateCooldownMs: 0,
    timeStopsUsed: 0,
    lastAudioX: x,
    lastVisualX: x,
    visualMovingMs: 0,
    jumpMs: 0,
    crouch: false,
    idleAudioMs: 4000,
    combo: 0,
    down: false,
    standControl: createStandControl(x, facing),
    statusEffects: [] as StatusEffect[],
  };
}

const HEAVY_DAMAGE = 13;
export const attackSpecs = {
  light: { range: 13, damage: 7, frames: 15, energy: 8, word: '砰' },
  heavy: { range: 17, damage: HEAVY_DAMAGE, frames: 25, energy: 12, word: '轰' },
  finger: { range: 30, damage: HEAVY_DAMAGE, frames: 30, energy: 12, word: '流星指刺' },
  stand: { range: 24, damage: 15, frames: 1, energy: 10, word: '连打' },
  special: { range: 32, damage: 28, frames: 38, energy: 0, word: '决胜' },
  guard: { range: 0, damage: 0, frames: 0, energy: 0, word: '' },
};

type CombatState = ReturnType<typeof createCombatState> & { id: string };

/** Applies a confirmed hit. Target selection, audio and presentation stay with the caller. */
export function applyCombatHit(
  attacker: CombatState,
  defender: CombatState,
  action: Action,
  part: HitPart,
  sustained = false,
) {
  const specs = attackSpecs[action];
  const guarded = part === 'body' && defender.guard;
  const barrage = action === 'stand' && (!sustained || attacker.attack === 'stand');
  const base = barrage
    ? Math.min(attacker.barrageDamageLeft, BARRAGE_TICK_DAMAGE)
    : sustained
      ? 3
      : attacker.id === 'avdol' && action === 'light'
        ? FIREBALL_DAMAGE
        : specs.damage;
  if (barrage) attacker.barrageDamageLeft -= base;
  const damage = ownerDamage(base, part, guarded);
  if (base <= 0) return { damage: 0, guarded };
  defender.hp = Math.max(0, defender.hp - damage);
  const remote = attacker.standControl.mode === 'detached';
  const standAttack =
    remote ||
    action === 'stand' ||
    action === 'special' ||
    action === 'finger' ||
    (attacker.id === 'avdol' && action === 'light');
  const status = standAttack && !barrage && !guarded ? statusForActor(attacker.id) : null;
  if (status && defender.hp > 0) applyStatus(defender.statusEffects, status, part);
  if (part === 'stand') {
    defender.standControl.stunMs = 100;
  } else {
    defender.stun = Math.max(
      defender.stun,
      sustained ? 3 : guarded ? 6 : action === 'special' ? 30 : 13,
    );
  }
  if (part === 'body' && action !== 'stand') {
    defender.x = Math.min(
      94,
      Math.max(
        6,
        defender.x +
          (remote ? attacker.standControl.facing : attacker.facing) * (action === 'heavy' ? 5 : 2),
      ),
    );
  }
  attacker.energy = Math.min(100, attacker.energy + (sustained ? 1 : specs.energy));
  attacker.combo += 1;
  if (standAttack && attacker.standControl.mode === 'detached')
    attacker.standControl.attackMs = 150;
  return { damage, guarded };
}

export interface VersusMatch {
  round: number;
  wins: Record<Side, number>;
  phase: 'fight' | 'break' | 'complete';
  winner: Side | null;
  roundWinner: Side | null;
  reason: 'ko' | 'timeout' | null;
  remainingMs: number;
  breakMs: number;
}

export function createVersusMatch(): VersusMatch {
  return {
    round: 1,
    wins: { p1: 0, p2: 0 },
    phase: 'fight',
    winner: null,
    roundWinner: null,
    reason: null,
    remainingMs: ROUND_SECONDS * 1000,
    breakMs: 0,
  };
}

/** KO takes priority over the clock; equal HP (including double KO) is a replay. */
export function settleRound(match: VersusMatch, p1Hp: number, p2Hp: number): VersusMatch {
  if (match.phase !== 'fight') return match;
  const ko = p1Hp <= 0 || p2Hp <= 0;
  if (!ko && match.remainingMs > 0) return match;
  const winner: Side | null = p1Hp === p2Hp ? null : p1Hp > p2Hp ? 'p1' : 'p2';
  const wins = { ...match.wins };
  if (winner) wins[winner] += 1;
  const complete = winner !== null && wins[winner] >= WINS_REQUIRED;
  return {
    ...match,
    wins,
    roundWinner: winner,
    reason: ko ? 'ko' : 'timeout',
    winner: complete ? winner : null,
    phase: complete ? 'complete' : 'break',
    breakMs: complete ? 0 : ROUND_BREAK_MS,
  };
}

export function advanceVersusMatch(
  match: VersusMatch,
  dt: number,
  p1Hp: number,
  p2Hp: number,
  frozen = false,
): VersusMatch {
  if (frozen || match.phase === 'complete') return match;
  const elapsed = Math.max(0, dt);
  if (match.phase === 'break') {
    const breakMs = Math.max(0, match.breakMs - elapsed);
    return breakMs > 0
      ? { ...match, breakMs }
      : {
          ...createVersusMatch(),
          round: match.round + 1,
          wins: { ...match.wins },
        };
  }
  return settleRound(
    { ...match, remainingMs: Math.max(0, match.remainingMs - elapsed) },
    p1Hp,
    p2Hp,
  );
}
