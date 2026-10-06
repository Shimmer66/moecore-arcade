export type StandRank = 'A' | 'B' | 'C' | 'D' | 'E';
export type StandMode = 'attached' | 'detached' | 'vanished';
export type HitPart = 'body' | 'stand';

export const ARENA_METERS = 40;
export const STAND_LIMIT_METERS: Readonly<Record<StandRank, number>> = {
  A: 30,
  B: 15,
  C: 2,
  D: 1.5,
  E: 1,
};
export const STAND_HIT_REACH_METERS = 1;
export const STAND_MOVE_SPEED_METERS = 4;
export const STAND_DISTANCE_STEP_METERS = 0.5;
export const FIGHTER_STAND_RANK = {
  jotaro: 'C',
  kakyoin: 'A',
  avdol: 'C',
  polnareff: 'C',
} as const satisfies Record<string, StandRank>;

export interface StandControl {
  mode: StandMode;
  x: number;
  facing: 1 | -1;
  cooldownMs: number;
  attackMs: number;
  stunMs: number;
  movingMs: number;
  recallMs: number;
}

export interface StandOwner {
  x: number;
  down: boolean;
  standControl: StandControl;
}

export function metersToPosition(meters: number): number {
  return (meters / ARENA_METERS) * 100;
}

export function standDistance(bodyX: number, stand: StandControl): number {
  return (Math.abs(stand.x - bodyX) / 100) * ARENA_METERS;
}

export function createStandControl(x: number, facing: 1 | -1): StandControl {
  return {
    mode: 'attached',
    x,
    facing,
    cooldownMs: 0,
    attackMs: 0,
    stunMs: 0,
    movingMs: 0,
    recallMs: 0,
  };
}

export function recallStand(stand: StandControl, bodyX: number, vanished = false): void {
  stand.mode = vanished ? 'vanished' : 'attached';
  stand.x = bodyX;
  stand.cooldownMs = 0;
  stand.attackMs = 0;
  stand.stunMs = 0;
  stand.movingMs = 0;
  stand.recallMs = 0;
}

export function toggleStand(stand: StandControl, bodyX: number, rank: StandRank): boolean {
  if (rank === 'E') return false;
  if (stand.mode === 'detached') {
    recallStand(stand, bodyX);
    stand.recallMs = 180;
  } else {
    recallStand(stand, bodyX);
    stand.mode = 'detached';
  }
  return true;
}

export function enforceStandRange(stand: StandControl, bodyX: number, rank: StandRank): boolean {
  if (stand.mode !== 'detached') {
    stand.x = bodyX;
    return false;
  }
  if (rank === 'E' || standDistance(bodyX, stand) > STAND_LIMIT_METERS[rank] + 1e-6) {
    recallStand(stand, bodyX, true);
    return true;
  }
  return false;
}

export function standOpacity(stand: StandControl, bodyX: number, rank: StandRank): number {
  if (stand.mode === 'vanished') return 0;
  const fraction = standDistance(bodyX, stand) / STAND_LIMIT_METERS[rank];
  if (fraction > 1 + 1e-6) return 0;
  const fadeStart = rank === 'A' || rank === 'B' ? 0.5 : 0;
  const fade = Math.max(0, Math.min(1, (fraction - fadeStart) / (1 - fadeStart)));
  return 1 - fade * 0.8;
}

export function advanceDetachedStand(
  stand: StandControl,
  bodyX: number,
  rank: StandRank,
  dt: number,
): void {
  stand.recallMs = Math.max(0, stand.recallMs - dt);
  if (enforceStandRange(stand, bodyX, rank) || stand.mode !== 'detached') return;
  stand.attackMs = Math.max(0, stand.attackMs - dt);
  stand.stunMs = Math.max(0, stand.stunMs - dt);
  stand.cooldownMs = Math.max(0, stand.cooldownMs - dt);
  stand.movingMs = Math.max(0, stand.movingMs - dt);
}

export function moveDetachedStand(
  stand: StandControl,
  bodyX: number,
  rank: StandRank,
  deltaMeters: number,
): void {
  if (
    stand.mode !== 'detached' ||
    rank === 'E' ||
    stand.stunMs > 0 ||
    standDistance(bodyX, stand) > STAND_LIMIT_METERS[rank] + 1e-6 ||
    deltaMeters === 0
  )
    return;
  const previous = stand.x;
  const limit = metersToPosition(STAND_LIMIT_METERS[rank]);
  stand.x = Math.max(
    Math.max(6, bodyX - limit),
    Math.min(Math.min(94, bodyX + limit), stand.x + metersToPosition(deltaMeters)),
  );
  stand.facing = deltaMeters > 0 ? 1 : -1;
  if (stand.x !== previous) stand.movingMs = 100;
}

export function adjustStandDistance(
  stand: StandControl,
  bodyX: number,
  rank: StandRank,
  deltaMeters: number,
): void {
  if (stand.mode !== 'detached' || rank === 'E' || stand.stunMs > 0) return;
  const side = Math.sign(stand.x - bodyX) || stand.facing;
  const distance = standDistance(bodyX, stand);
  const desired = Math.max(0, Math.min(STAND_LIMIT_METERS[rank], distance + deltaMeters));
  moveDetachedStand(stand, bodyX, rank, side * (desired - distance));
  if (stand.mode === 'detached') stand.facing = side as 1 | -1;
}

export function nearestTarget<T extends StandOwner>(
  origin: number,
  enemies: readonly T[],
  standPosition: (owner: T) => number = (owner) => owner.standControl.x,
  facing?: 1 | -1,
): { owner: T; part: HitPart; x: number } | undefined {
  const targets = enemies.flatMap((owner) => {
    if (owner.down) return [];
    const body = { owner, part: 'body' as const, x: owner.x };
    return owner.standControl.mode === 'detached'
      ? [body, { owner, part: 'stand' as const, x: standPosition(owner) }]
      : [body];
  });
  return targets
    .filter((target) => facing === undefined || (target.x - origin) * facing >= -1e-6)
    .sort((a, b) => Math.abs(a.x - origin) - Math.abs(b.x - origin))[0];
}

export function ownerDamage(damage: number, part: HitPart, guarding: boolean): number {
  if (part === 'stand') return damage * 0.5;
  return guarding ? Math.max(1, Math.round(damage * 0.2)) : damage;
}
