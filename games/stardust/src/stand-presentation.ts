import {
  nearestTarget,
  standDistance,
  STAND_LIMIT_METERS,
  type StandControl,
  type StandRank,
  type StandOwner,
} from './stand-control';

// Approximately 2 CSS cm. Physical size still depends on device scaling and browser zoom.
export const C_STAND_VISUAL_GAP_PX = 76;

export function visibleTargetInReach<T extends StandOwner>(
  origin: number,
  enemies: readonly T[],
  reach: number,
  standPosition: (owner: T) => number,
  facing?: 1 | -1,
) {
  const target = nearestTarget(origin, enemies, standPosition, facing);
  return target && Math.abs(origin - target.x) <= reach + 1e-6 ? target : undefined;
}

export function standDisplayX(
  stand: StandControl,
  bodyX: number,
  rank: StandRank,
  arenaWidth: number,
  spriteWidth: number,
): number {
  if (rank !== 'C' || stand.mode !== 'detached' || arenaWidth <= 0) return stand.x;
  const bodyPixels = (bodyX / 100) * arenaWidth;
  const standPixels = (stand.x / 100) * arenaWidth;
  const direction = Math.sign(standPixels - bodyPixels) || stand.facing;
  const fraction = Math.min(1, standDistance(bodyX, stand) / STAND_LIMIT_METERS[rank]);
  const separation = Math.max(
    Math.abs(standPixels - bodyPixels),
    fraction * (spriteWidth + C_STAND_VISUAL_GAP_PX),
  );
  const margin = Math.min(spriteWidth / 2, arenaWidth / 2);
  const pixels = Math.max(
    margin,
    Math.min(arenaWidth - margin, bodyPixels + direction * separation),
  );
  return (pixels / arenaWidth) * 100;
}
