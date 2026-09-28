import { describe, expect, it } from 'vitest';
import {
  USER,
  STEP,
  createLayout,
  placeProp,
  moveProp,
  removeProp,
  rotateProp,
  startScene,
  stepScene,
  cutBalloons,
  toggleMagnets,
  available,
  usedBudget,
  starsFor,
  validateProgress,
  isUnlocked,
  CHALLENGES,
  type Layout,
  type Scene,
} from '../src/rules';

function advance(layout: Layout, scene = startScene(layout), seconds = 14.1): Scene {
  for (let i = 0; i < Math.ceil(seconds / STEP) && scene.phase === 'running'; i++)
    scene = stepScene(scene, layout);
  return scene;
}
function trampoline() {
  const l = placeProp(createLayout(), 'pad', { x: 125, y: 310 });
  return rotateProp(l, 1, 30);
}
function skyRoute() {
  let l: Layout = { ...createLayout(), side: 'ceiling' };
  l = placeProp(l, 'pot', USER);
  l = placeProp(l, 'balloon', USER);
  l = placeProp(l, 'balloon', USER);
  return placeProp(l, 'magnet', { x: 500, y: 100 });
}

describe('promise workshop', () => {
  it('enforces chapter inventory, spending and fixed pots', () => {
    let l = createLayout('bounce');
    expect(available(l, 'magnet')).toBe(0);
    expect(placeProp(l, 'magnet', { x: 500, y: 100 })).toBe(l);
    l = placeProp(l, 'pad', { x: 125, y: 310 });
    expect(usedBudget(l)).toBe(2);
    expect(placeProp(l, 'pad', { x: 300, y: 250 })).toBe(l);
    const fixed = createLayout('all-pots');
    expect(moveProp(fixed, 1, { x: 100, y: 100 })).toBe(fixed);
    expect(removeProp(fixed, 1)).toBe(fixed);
    expect(usedBudget(fixed)).toBe(0);
    const bound = placeProp(fixed, 'balloon', { x: 372, y: 136 });
    expect(bound.props.at(-1)!.attach).toBe(1);
  });

  for (const chapter of CHALLENGES) {
    it(`has a physically playable solution for ${chapter.id}`, () => {
      let l = createLayout(chapter.id);
      if (chapter.id === 'bounce' || chapter.id === 'all-pots') {
        l = placeProp(l, 'pad', { x: 125, y: 310 });
        l = rotateProp(l, l.props.at(-1)!.id, 30);
      }
      if (chapter.id === 'magnetic' || chapter.id === 'sky') {
        l = placeProp(l, 'pot', USER);
        if (chapter.id === 'sky') l = placeProp(l, 'balloon', USER);
        l = placeProp(l, 'magnet', { x: 430, y: 100 });
      }
      if (chapter.id === 'let-go') l = placeProp(l, 'balloon', USER);
      if (chapter.id === 'all-pots') l = placeProp(l, 'magnet', { x: 470, y: 350 });
      let scene = startScene(l);
      for (let i = 0; i < 1700 && scene.phase === 'running'; i++) {
        if (chapter.id === 'let-go' && scene.time >= 1 && !scene.cut) scene = cutBalloons(scene);
        scene = stepScene(scene, l);
      }
      expect(scene.phase).toBe('success');
      expect(starsFor(l, scene)).toBe(3);
      if (chapter.id === 'all-pots') expect(scene.caughtPots).toBe(2);
      if (chapter.id === 'let-go') expect(scene.cut && scene.floated).toBe(true);
    });
  }

  it('validates saved progress and unlocks only the next completed prerequisite', () => {
    const valid = validateProgress({
      bounce: { stars: 3, time: 2.5, items: 1 },
      sky: { stars: 99, time: -1, items: 'x' },
      other: { stars: 3, time: 1, items: 1 },
    });
    expect(Object.keys(valid)).toEqual(['bounce']);
    expect(isUnlocked('magnetic', valid)).toBe(true);
    expect(isUnlocked('sky', valid)).toBe(false);
    expect(isUnlocked('free', {})).toBe(true);
    expect(isUnlocked('unknown', {})).toBe(false);
    expect(validateProgress(null)).toEqual({});
  });
  it('attaches pots and balloons deliberately, limits inventory, and removes dependent strings', () => {
    const empty = createLayout();
    expect(placeProp(empty, 'balloon', { x: 400, y: 300 })).toBe(empty);
    let l = placeProp(empty, 'pot', USER);
    expect(l.props[0]!.attach).toBe(0);
    expect(placeProp(l, 'pot', USER)).toBe(l);
    l = placeProp(l, 'balloon', USER);
    l = placeProp(l, 'balloon', USER);
    expect(placeProp(l, 'balloon', USER)).toBe(l);
    let loose = placeProp(empty, 'pot', { x: 400, y: 180 });
    loose = placeProp(loose, 'balloon', { x: 400, y: 180 });
    expect(loose.props[1]!.attach).toBe(1);
    expect(removeProp(loose, 1).props).toHaveLength(0);
  });

  it('clamps placement and rotation, allows a helmet to become a loose pot', () => {
    let l = placeProp(createLayout(), 'pot', USER);
    l = moveProp(l, 1, { x: 9999, y: 9999 });
    expect(l.props[0]).toMatchObject({ attach: null, x: 588, y: 513 });
    const pad = placeProp(l, 'pad', { x: 200, y: 300 });
    expect(rotateProp(pad, 2, 999).props[1]!.angle).toBe(55);
  });

  it('a tilted trampoline produces an actual successful trajectory without mutating the setup', () => {
    const l = trampoline();
    const original = JSON.stringify(l);
    const result = advance(l);
    expect(result.phase).toBe('success');
    expect(result.bounces).toBeGreaterThan(0);
    expect(result.bodies[0]!.caught).toBe(true);
    expect(JSON.stringify(l)).toBe(original);
    expect(result.trail.length).toBeGreaterThan(10);
  });

  it('the same geometry with a flat trampoline does not magically deliver the user', () => {
    const flat = placeProp(createLayout(), 'pad', { x: 125, y: 310 });
    expect(advance(flat).phase).toBe('failed');
  });

  it('balloons, a metal helmet and a magnet offer a different real ceiling rescue', () => {
    const result = advance(skyRoute());
    expect(result.phase).toBe('success');
    expect(result.floated).toBe(true);
    expect(result.magnetic).toBe(true);
    expect(result.bodies[0]!.y).toBeLessThan(110);
  });

  it('magnets attract metal, leave the bare user unaffected and can be switched off', () => {
    const magnet = placeProp(createLayout(), 'magnet', { x: 500, y: 100 });
    const bare = advance(magnet, startScene(magnet), 0.3);
    expect(bare.bodies[0]!.x).toBe(USER.x);
    const equipped = placeProp(magnet, 'pot', USER);
    const metal = advance(equipped, startScene(equipped), 0.3);
    expect(metal.bodies[0]!.x).toBeGreaterThan(USER.x + 4);
    const off = advance(equipped, toggleMagnets(startScene(equipped)), 0.3);
    expect(off.bodies[0]!.x).toBe(USER.x);
  });

  it('cutting strings removes lift while retaining momentum', () => {
    const l = placeProp(createLayout(), 'balloon', USER);
    const rising = advance(l, startScene(l), 0.2);
    expect(rising.bodies[0]!.vy).toBeLessThan(0);
    const cut = cutBalloons(rising);
    expect(cut.bodies[0]!.vy).toBe(rising.bodies[0]!.vy);
    const falling = advance(l, cut, 0.3);
    expect(falling.bodies[0]!.vy).toBeGreaterThan(0);
    expect(cutBalloons(cut)).toBe(cut);
  });

  it('requiring every loose pot changes the outcome rather than only changing the label', () => {
    const l = placeProp(trampoline(), 'pot', { x: 60, y: 450 });
    expect(advance(l).phase).toBe('success');
    expect(advance({ ...l, allPots: true }).phase).toBe('failed');
  });

  it('failed and successful scenes stop, and simulation snapshots stay immutable', () => {
    const l = createLayout();
    const initial = startScene(l);
    const original = JSON.stringify(initial);
    const result = advance(l, initial);
    expect(result.phase).toBe('failed');
    expect(JSON.stringify(initial)).toBe(original);
    expect(stepScene(result, l)).toBe(result);
    expect(stepScene(initial, l, 0)).toBe(initial);
    const success = advance(trampoline());
    expect(stepScene(success, trampoline())).toBe(success);
    expect(cutBalloons(success)).toBe(success);
  });
});
