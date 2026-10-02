import { describe, expect, it } from 'vitest';
import { createTrapScene, cutFloor, stepTraps, trapView, type Trap } from '../src/traps';

const first: Trap = {
  id: 'hallucination',
  effect: 'pit',
  trigger: { x: 100, y: 0, w: 80, h: 400 },
  body: { x: 180, y: 354, w: 110, h: 86 },
  delay: 2,
  line: '来源：我自己。',
};
const player = { x: 110, y: 306, w: 32, h: 48 };

describe('deterministic trap contract', () => {
  it('activates exactly after its warning and does not mutate earlier snapshots', () => {
    const initial = createTrapScene([first]);
    const triggered = stepTraps([first], initial, [player]);
    expect(initial.clocks[first.id]!.triggeredAt).toBeNull();
    expect(trapView(first, triggered)?.phase).toBe('warning');
    const waiting = stepTraps([first], triggered, []);
    expect(trapView(first, waiting)?.phase).toBe('warning');
    expect(trapView(first, stepTraps([first], waiting, []))?.phase).toBe('active');
  });

  it('keeps chain timing independent of authoring order and supports either racer', () => {
    const second: Trap = { ...first, id: 'followup', after: first.id, delay: 0 };
    const forward = [first, second];
    const backward = [second, first];
    let a = createTrapScene(forward);
    let b = createTrapScene(backward);
    for (let tick = 0; tick < 8; tick++) {
      a = stepTraps(forward, a, [
        { ...player, id: 'idle', x: 0 },
        { ...player, id: 'active' },
      ]);
      b = stepTraps(backward, b, [{ ...player, id: 'active' }]);
      expect(a.clocks).toEqual(b.clocks);
    }
    expect(a.clocks.followup!.triggeredAt).toBe(4);
    expect(createTrapScene(forward).clocks.followup!.triggeredAt).toBeNull();
  });

  it('clamps moving traps and expires temporary effects without rearming them', () => {
    const moving: Trap = {
      ...first,
      delay: 0,
      duration: 6,
      travel: { x: -80, y: 120, ticks: 4 },
    };
    let scene = createTrapScene([moving]);
    for (let tick = 0; tick < 10; tick++) scene = stepTraps([moving], scene, [player]);
    expect(trapView(moving, scene)).toMatchObject({
      phase: 'spent',
      body: { x: 100, y: 474 },
    });
    expect(scene.clocks[moving.id]!.triggeredAt).toBe(1);
  });

  it('cuts overlapping pits without deleting intact ledges or duplicating ground', () => {
    const floor = { x: 0, y: 354, w: 1000, h: 86 };
    expect(
      cutFloor(
        [floor],
        [
          { x: 200, y: 354, w: 150, h: 86 },
          { x: 300, y: 354, w: 150, h: 86 },
        ],
      ),
    ).toEqual([
      { ...floor, w: 200 },
      { ...floor, x: 450, w: 550 },
    ]);
    expect(floor.w).toBe(1000);
  });

  it('rejects content that can never trigger because its dependencies are invalid', () => {
    expect(() => createTrapScene([{ ...first, after: 'missing' }])).toThrow();
    expect(() => createTrapScene([{ ...first, after: first.id }])).toThrow();
    expect(() => createTrapScene([first, first])).toThrow();
  });
  it('does not count an initially active hazard as a triggered dependency', () => {
    const firstTrap: Trap = { ...first, initiallyActive: true, triggerOn: 'jump' };
    const dependent: Trap = { ...first, id: 'dependent', after: first.id };
    const traps = [firstTrap, dependent];
    let scene = createTrapScene(traps);
    scene = stepTraps(traps, scene, [player]);
    expect(scene.clocks[first.id]!.triggeredAt).toBeNull();
    expect(scene.clocks.dependent!.triggeredAt).toBeNull();
    scene = stepTraps(traps, scene, [{ ...player, jump: true }]);
    for (let i = 0; i < 4; i++) scene = stepTraps(traps, scene, [player]);
    expect(scene.clocks.dependent!.triggeredAt).not.toBeNull();
  });
});
