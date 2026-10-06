export type HeroId = 'jotaro' | 'kakyoin' | 'avdol' | 'polnareff';
export const ULTIMATE_COOLDOWN_MS = 20_000;
export const ULTIMATE_NAMES: Record<HeroId, string> = {
  jotaro: '白金之星 · 全力连打',
  kakyoin: '绿色法皇 · 绿宝石结界',
  avdol: '红色魔术师 · 焚天烈焰',
  polnareff: '银色战车 · 爆甲瞬狱刺',
};
export const ULTIMATE_TIMINGS = {
  jotaro: { startup: 480, interval: 100, hits: 50 },
  kakyoin: { startup: 800, interval: 60, hits: 16 },
  avdol: { startup: 650, interval: 120, hits: 12 },
  polnareff: { startup: 950, interval: 160, hits: 25 },
} as const;

export function isHero(id: string): id is HeroId {
  return Object.hasOwn(ULTIMATE_NAMES, id);
}

export interface UltimateState {
  hero: HeroId;
  phase: 'startup' | 'armed' | 'strike' | 'done';
  elapsedMs: number;
  carryMs: number;
  hits: number;
  damageLimit: number;
  damageDealt: number;
  originX: number;
  targetX: number;
  targetJumpMs: number;
  targetCrouch: boolean;
}

export interface UltimateFighter {
  id: string;
  energy: number;
  ultimateCooldownMs: number;
  down: boolean;
  stun: number;
  x: number;
}

export function canUseUltimate(fighter: UltimateFighter): boolean {
  return (
    isHero(fighter.id) &&
    fighter.energy >= 100 &&
    fighter.ultimateCooldownMs <= 0 &&
    !fighter.down &&
    fighter.stun <= 0
  );
}

export function beginUltimate(
  fighter: UltimateFighter,
  target: { x: number; jumpMs: number; crouch: boolean },
  damageLimit = Infinity,
): UltimateState | null {
  if (!canUseUltimate(fighter) || !isHero(fighter.id)) return null;
  fighter.energy = 0;
  fighter.ultimateCooldownMs = ULTIMATE_COOLDOWN_MS;
  return {
    hero: fighter.id,
    phase: 'startup',
    elapsedMs: 0,
    carryMs: 0,
    hits: 0,
    damageLimit,
    damageDealt: 0,
    originX: fighter.x,
    targetX: target.x,
    targetJumpMs: target.jumpMs,
    targetCrouch: target.crouch,
  };
}

/** Returns damage events; no timers or browser state are involved. */
export function advanceUltimate(
  state: UltimateState,
  target: { x: number; jumpMs: number; crouch: boolean; maxHp: number; hp: number },
  dt: number,
): number {
  if (state.phase === 'done') return 0;
  const timing = ULTIMATE_TIMINGS[state.hero];
  const elapsed = Math.max(0, dt);
  const before = state.elapsedMs;
  state.elapsedMs += elapsed;
  let strikeMs = elapsed;
  if (state.phase === 'startup') {
    if (state.elapsedMs < timing.startup) return 0;
    state.phase = state.hero === 'kakyoin' ? 'armed' : 'strike';
    strikeMs = state.elapsedMs - Math.max(before, timing.startup);
    state.targetX = target.x;
    state.targetJumpMs = target.jumpMs;
    state.targetCrouch = target.crouch;
  }
  if (state.phase === 'armed') {
    const moved =
      Math.abs(target.x - state.targetX) > 0.01 ||
      target.jumpMs !== state.targetJumpMs ||
      target.crouch !== state.targetCrouch;
    if (!moved) return 0;
    state.phase = 'strike';
    strikeMs = 0;
    // All emeralds acquire their target in the same simulation step.
    state.carryMs = timing.interval;
  }
  state.carryMs += strikeMs;
  const nextHits = Math.min(timing.hits, state.hits + Math.floor(state.carryMs / timing.interval));
  const withFinisher = state.hero === 'jotaro' || state.hero === 'polnareff';
  const regularHits = withFinisher ? timing.hits - 1 : timing.hits;
  const sequenceDamage = Math.min(target.maxHp, state.damageLimit);
  const regularDamage = withFinisher ? sequenceDamage * 0.7 : sequenceDamage;
  const damage =
    Math.ceil((regularDamage * Math.min(nextHits, regularHits)) / regularHits) -
    Math.ceil((regularDamage * Math.min(state.hits, regularHits)) / regularHits);
  state.carryMs %= timing.interval;
  state.hits = nextHits;
  if (state.hits === timing.hits) state.phase = 'done';
  // The finishing strike shares the same per-cast budget as all preceding hits.
  const requested = withFinisher
    ? state.phase === 'done'
      ? target.hp
      : Math.min(damage, Math.max(0, target.hp - 1))
    : damage;
  const dealt = Math.min(requested, Math.max(0, state.damageLimit - state.damageDealt));
  state.damageDealt += dealt;
  return dealt;
}
