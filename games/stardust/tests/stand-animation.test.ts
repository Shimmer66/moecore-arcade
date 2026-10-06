import { describe, expect, it } from 'vitest';
import { createCombatState } from '../src/rules';
import { advanceDetachedStand, toggleStand } from '../src/stand-control';
import { BOSS_STAND_FRAMES, bossStandPose, isBossStandOwner } from '../src/stand-animation';

describe('Cream and The World animation sheets', () => {
  it('limits the new boss art mapping to the two requested owners', () => {
    expect(isBossStandOwner('dio')).toBe(true);
    expect(isBossStandOwner('ice')).toBe(true);
    expect(isBossStandOwner('holhorse')).toBe(false);
    expect(isBossStandOwner('jotaro')).toBe(false);
  });

  it('selects distinct idle, movement, light, heavy, barrage and guard frames', () => {
    const fighter = createCombatState('p1');
    const frame = () => BOSS_STAND_FRAMES[bossStandPose(fighter)];
    expect(frame()).toBe(0);
    fighter.visualMovingMs = 180;
    expect(frame()).toBe(1);
    fighter.visualMovingMs = 0;
    fighter.attack = 'light';
    expect(frame()).toBe(2);
    fighter.attack = 'heavy';
    expect(frame()).toBe(3);
    fighter.attack = 'stand';
    expect(frame()).toBe(4);
    fighter.guard = true;
    expect(frame()).toBe(5);
    fighter.standControl.stunMs = 100;
    expect(frame()).toBe(6);
    fighter.standControl.stunMs = 0;
    fighter.stun = 3;
    expect(frame()).toBe(6);
  });

  it('uses the stand movement clock independently of the stationary owner', () => {
    const fighter = createCombatState('p1');
    toggleStand(fighter.standControl, fighter.x, 'C');
    fighter.visualMovingMs = 180;
    expect(bossStandPose(fighter)).toBe('idle');
    fighter.standControl.movingMs = 100;
    expect(bossStandPose(fighter)).toBe('move');
  });

  it('plays a short recall pose then returns to idle on active updates only', () => {
    const fighter = createCombatState('p1');
    toggleStand(fighter.standControl, fighter.x, 'C');
    toggleStand(fighter.standControl, fighter.x, 'C');
    expect(BOSS_STAND_FRAMES[bossStandPose(fighter)]).toBe(7);
    advanceDetachedStand(fighter.standControl, fighter.x, 'C', 160);
    expect(bossStandPose(fighter)).toBe('recall');
    advanceDetachedStand(fighter.standControl, fighter.x, 'C', 32);
    expect(bossStandPose(fighter)).toBe('idle');
  });
});
