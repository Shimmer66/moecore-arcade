import { describe, expect, it } from 'vitest';
import {
  advanceDetachedStand,
  adjustStandDistance,
  createStandControl,
  enforceStandRange,
  metersToPosition,
  moveDetachedStand,
  nearestTarget,
  ownerDamage,
  recallStand,
  standDistance,
  standOpacity,
  STAND_LIMIT_METERS,
  toggleStand,
  type StandRank,
} from '../src/stand-control';

describe('stand detachment', () => {
  it.each(['A', 'B'] as const)(
    '%s stays opaque through half range, then fades to the limit',
    (rank) => {
      const bodyX = 10;
      const stand = createStandControl(bodyX, 1);
      toggleStand(stand, bodyX, rank);
      for (const fraction of [0, 0.25, 0.5]) {
        stand.x = bodyX + metersToPosition(STAND_LIMIT_METERS[rank] * fraction);
        expect(standOpacity(stand, bodyX, rank)).toBe(1);
      }
      stand.x = bodyX + metersToPosition(STAND_LIMIT_METERS[rank] * 0.5001);
      expect(standOpacity(stand, bodyX, rank)).toBeLessThan(1);
      stand.x = bodyX + metersToPosition(STAND_LIMIT_METERS[rank] * 0.75);
      expect(standOpacity(stand, bodyX, rank)).toBeCloseTo(0.6);
      stand.x = bodyX + metersToPosition(STAND_LIMIT_METERS[rank]);
      expect(standOpacity(stand, bodyX, rank)).toBeCloseTo(0.2);
      stand.x += metersToPosition(0.01);
      expect(standOpacity(stand, bodyX, rank)).toBe(0);
      expect(enforceStandRange(stand, bodyX, rank)).toBe(true);
      expect(stand.mode).toBe('vanished');
    },
  );

  it.each(['C', 'D', 'E'] as const)('keeps the existing short-range %s fade curve', (rank) => {
    const stand = createStandControl(40, 1);
    stand.x += metersToPosition(STAND_LIMIT_METERS[rank] / 2);
    expect(standOpacity(stand, 40, rank)).toBeCloseTo(0.6);
  });

  it('uses the agreed A-E ranges and prevents independent movement for E', () => {
    expect(STAND_LIMIT_METERS).toEqual({ A: 30, B: 15, C: 2, D: 1.5, E: 1 });
    const stand = createStandControl(40, 1);
    expect(toggleStand(stand, 40, 'E')).toBe(false);
    advanceDetachedStand(stand, 40, 'E', 1000);
    moveDetachedStand(stand, 40, 'E', 1);
    expect(stand.mode).toBe('attached');
    expect(stand.x).toBe(40);
  });

  it.each(['A', 'B', 'C', 'D'] as StandRank[])(
    'clamps manual movement at the %s boundary',
    (rank) => {
      const stand = createStandControl(10, 1);
      toggleStand(stand, 10, rank);
      moveDetachedStand(stand, 10, rank, 100);
      expect(standDistance(10, stand)).toBeCloseTo(STAND_LIMIT_METERS[rank]);
      expect(standOpacity(stand, 10, rank)).toBeCloseTo(0.2);
      expect(stand.mode).toBe('detached');
    },
  );

  it('fades progressively and disappears immediately when its owner retreats beyond range', () => {
    const stand = createStandControl(40, 1);
    toggleStand(stand, 40, 'C');
    expect(standOpacity(stand, 40, 'C')).toBe(1);
    stand.x += metersToPosition(1);
    expect(standOpacity(stand, 40, 'C')).toBeCloseTo(0.6);
    stand.x += metersToPosition(1);
    expect(enforceStandRange(stand, 40, 'C')).toBe(false);
    advanceDetachedStand(stand, 39, 'C', 16);
    expect(stand.mode).toBe('vanished');
    expect(standOpacity(stand, 39, 'C')).toBe(0);
    expect(toggleStand(stand, 39, 'C')).toBe(true);
    expect(stand.mode).toBe('detached');
    expect(stand.x).toBe(39);
  });

  it('stays still without input and allows measured distance changes without crossing the owner', () => {
    const stand = createStandControl(10, 1);
    toggleStand(stand, 10, 'A');
    for (let frame = 0; frame < 100; frame++) advanceDetachedStand(stand, 10, 'A', 100);
    expect(stand).toMatchObject({ x: 10, attackMs: 0, movingMs: 0 });
    moveDetachedStand(stand, 10, 'A', 1);
    expect(standDistance(10, stand)).toBe(1);
    expect(stand.movingMs).toBeGreaterThan(0);
    adjustStandDistance(stand, 10, 'A', -0.5);
    expect(standDistance(10, stand)).toBe(0.5);
    expect(stand.facing).toBe(1);
    adjustStandDistance(stand, 10, 'A', -100);
    expect(stand.x).toBe(10);
    adjustStandDistance(stand, 10, 'A', 100);
    expect(standDistance(10, stand)).toBe(30);
    recallStand(stand, 10);
    moveDetachedStand(stand, 10, 'A', 1);
    expect(stand.x).toBe(10);
  });

  it('supports manual movement on either side and blocks movement while the stand is stunned', () => {
    const stand = createStandControl(50, -1);
    toggleStand(stand, 50, 'C');
    adjustStandDistance(stand, 50, 'C', 0.5);
    expect(stand.x).toBeLessThan(50);
    expect(standDistance(50, stand)).toBe(0.5);
    stand.stunMs = 100;
    const previous = stand.x;
    moveDetachedStand(stand, 50, 'C', -1);
    adjustStandDistance(stand, 50, 'C', 0.5);
    expect(stand.x).toBe(previous);
    advanceDetachedStand(stand, 50, 'C', 100);
    moveDetachedStand(stand, 50, 'C', 1);
    expect(stand.x).toBeGreaterThan(50);
  });

  it('targets the nearer exposed stand and reflects exactly half damage to the owner', () => {
    const owner = { x: 20, down: false, standControl: createStandControl(20, 1) };
    toggleStand(owner.standControl, 20, 'A');
    owner.standControl.x = 60;
    expect(nearestTarget(70, [owner])?.part).toBe('stand');
    expect(ownerDamage(7, 'stand', false)).toBe(3.5);
    expect(ownerDamage(7, 'stand', true)).toBe(3.5);
    expect(ownerDamage(7, 'body', false)).toBe(7);
    expect(ownerDamage(7, 'body', true)).toBe(1);
    owner.standControl.mode = 'vanished';
    expect(nearestTarget(70, [owner])?.part).toBe('body');
    owner.down = true;
    expect(nearestTarget(70, [owner])).toBeUndefined();
  });
});
