import { describe, expect, it } from 'vitest';
import {
  createStandControl,
  metersToPosition,
  standDistance,
  toggleStand,
} from '../src/stand-control';
import { BARRAGE_RANGE_METERS } from '../src/barrage';
import {
  C_STAND_VISUAL_GAP_PX,
  standDisplayX,
  visibleTargetInReach,
} from '../src/stand-presentation';

describe('C-rank stand display spacing', () => {
  it('allows barrage hits at one meter inclusive and rejects targets beyond it', () => {
    const origin = 40;
    const reach = metersToPosition(BARRAGE_RANGE_METERS);
    const target = { x: origin + reach, down: false, standControl: createStandControl(70, -1) };
    expect(BARRAGE_RANGE_METERS).toBe(1);
    expect(
      visibleTargetInReach(origin, [target], reach, (owner) => owner.standControl.x, 1)?.part,
    ).toBe('body');
    target.x += 0.001;
    expect(
      visibleTargetInReach(origin, [target], reach, (owner) => owner.standControl.x, 1),
    ).toBeUndefined();
    target.standControl.mode = 'detached';
    expect(visibleTargetInReach(origin, [target], reach, () => origin + reach, 1)?.part).toBe(
      'stand',
    );
  });
  it('separates the artwork without mutating the two-meter game distance', () => {
    const stand = createStandControl(25, 1);
    toggleStand(stand, 25, 'C');
    stand.x = 30;
    const original = { ...stand };
    const display = standDisplayX(stand, 25, 'C', 1000, 150);
    expect((display - 25) * 10 - 150).toBeCloseTo(C_STAND_VISUAL_GAP_PX);
    expect(standDistance(25, stand)).toBe(2);
    expect(stand).toEqual(original);
  });

  it('mirrors spacing for the second player', () => {
    const stand = createStandControl(75, -1);
    toggleStand(stand, 75, 'C');
    stand.x = 70;
    expect((75 - standDisplayX(stand, 75, 'C', 1000, 150)) * 10 - 150).toBeCloseTo(76);
  });

  it('moves continuously between the owner and maximum display distance', () => {
    const stand = createStandControl(25, 1);
    toggleStand(stand, 25, 'C');
    expect(standDisplayX(stand, 25, 'C', 1000, 150)).toBe(25);
    stand.x = 27.5;
    const midpoint = standDisplayX(stand, 25, 'C', 1000, 150);
    stand.x = 30;
    const maximum = standDisplayX(stand, 25, 'C', 1000, 150);
    expect(midpoint).toBeCloseTo((25 + maximum) / 2);
  });

  it('rejects hidden-coordinate and rear hits, and accepts visible close contact', () => {
    const stand = createStandControl(25, 1);
    toggleStand(stand, 25, 'C');
    stand.x = 30;
    const origin = standDisplayX(stand, 25, 'C', 1000, 150);
    const target = { x: 31, down: false, standControl: createStandControl(31, -1) };
    const project = (owner: typeof target) => owner.standControl.x;
    expect(visibleTargetInReach(origin, [target], 2.5, project, 1)).toBeUndefined();
    target.x = origin + 1;
    expect(visibleTargetInReach(origin, [target], 2.5, project, 1)?.part).toBe('body');
    target.x = origin - 1;
    expect(visibleTargetInReach(origin, [target], 2.5, project, 1)).toBeUndefined();
    expect(visibleTargetInReach(origin, [target], 2.5, project, -1)?.part).toBe('body');
    target.standControl.mode = 'detached';
    target.x = 80;
    expect(visibleTargetInReach(origin, [target], 2.5, () => origin + 1, 1)?.part).toBe('stand');
    expect(visibleTargetInReach(origin, [target], 2.5, () => origin + 20, 1)).toBeUndefined();
  });
  it('keeps the sprite inside narrow screens and at arena edges', () => {
    const stand = createStandControl(25, 1);
    toggleStand(stand, 25, 'C');
    stand.x = 30;
    const pixels = (standDisplayX(stand, 25, 'C', 326, 112.5) / 100) * 326;
    expect(pixels + 112.5 / 2).toBeLessThanOrEqual(326);
    expect(pixels - (25 / 100) * 326 - 112.5).toBeGreaterThan(70);
    stand.x = 94;
    expect(standDisplayX(stand, 90, 'C', 326, 112.5)).toBeLessThan(100);
  });

  it('leaves other ranks, attached stands and unmeasured scenes unchanged', () => {
    const stand = createStandControl(25, 1);
    expect(standDisplayX(stand, 25, 'C', 1000, 150)).toBe(25);
    toggleStand(stand, 25, 'A');
    stand.x = 30;
    for (const rank of ['A', 'B', 'D', 'E'] as const)
      expect(standDisplayX(stand, 25, rank, 1000, 150)).toBe(30);
    expect(standDisplayX(stand, 25, 'C', 0, 150)).toBe(30);
  });
});
