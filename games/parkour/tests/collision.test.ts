import { describe, expect, it } from 'vitest';
import { GROUND_HEIGHT, classifyObstacle, createPlayer, intersects, playerBox } from '../src/rules';
import type { ObstacleKind, PlayerFrame } from '../src/rules';

function frame(distance: number, y = 0, crouching = false): PlayerFrame {
  return { distance, player: { ...createPlayer(), y, grounded: y === 0, crouching } };
}

describe('obstacle rules and swept collision', () => {
  it.each<{ obstacle: ObstacleKind; y: number; crouching: boolean; result: string }>([
    { obstacle: 'ground', y: 0, crouching: false, result: 'collision' },
    { obstacle: 'ground', y: 0, crouching: true, result: 'collision' },
    { obstacle: 'ground', y: 0.2, crouching: false, result: 'collision' },
    { obstacle: 'ground', y: 1.2, crouching: false, result: 'jumped' },
    { obstacle: 'ground', y: GROUND_HEIGHT, crouching: false, result: 'jumped' },
    { obstacle: 'air', y: 0, crouching: false, result: 'collision' },
    { obstacle: 'air', y: 0, crouching: true, result: 'ducked' },
    { obstacle: 'air', y: 0.7, crouching: false, result: 'collision' },
    { obstacle: 'air', y: 1.7, crouching: false, result: 'collision' },
  ])('$obstacle y=$y crouching=$crouching => $result', ({ obstacle, y, crouching, result }) => {
    expect(
      classifyObstacle(frame(0, y, crouching), frame(2, y, crouching), {
        id: 0,
        kind: obstacle,
        x: 1,
      }).kind,
    ).toBe(result);
  });

  it('does not count edge contact alone as positive-area intersection', () => {
    const box = playerBox(frame(0));
    expect(intersects(box, { ...box, x: box.width })).toBe(false);
    expect(intersects(box, { ...box, y: box.height })).toBe(false);
    expect(intersects(box, { ...box, x: box.width - 0.001 })).toBe(true);
    expect(classifyObstacle(frame(0), frame(0.4), { id: 0, kind: 'ground', x: 1 })).toEqual({
      kind: 'none',
    });
  });

  it('applies the target posture before sweeping when called with different endpoint poses', () => {
    const obstacle = { id: 0, kind: 'air', x: 1 } as const;
    expect(classifyObstacle(frame(0), frame(2, 0, true), obstacle).kind).toBe('ducked');
    expect(classifyObstacle(frame(0, 0, true), frame(2), obstacle).kind).toBe('collision');
  });

  it('detects an obstacle crossed entirely between frame endpoints', () => {
    const result = classifyObstacle(frame(0), frame(100), { id: 0, kind: 'ground', x: 1 });
    expect(result.kind).toBe('collision');
    if (result.kind === 'collision') expect(result.fraction).toBeCloseTo(0.004, 12);
  });

  it('detects descending onto an obstacle after clearing its leading edge', () => {
    expect(classifyObstacle(frame(0, 1.2), frame(2, 0), { id: 0, kind: 'ground', x: 1 })).toEqual({
      kind: 'collision',
      fraction: 0.5,
    });
  });

  it('rejects a late jump even if the ending box has cleared the obstacle', () => {
    const result = classifyObstacle(frame(0), frame(2, 1.2), { id: 0, kind: 'ground', x: 1 });
    expect(result.kind).toBe('collision');
    if (result.kind === 'collision') expect(result.fraction).toBeCloseTo(0.2, 12);
  });

  it('does not mistake a diagonal swept bounding envelope for actual contact', () => {
    expect(classifyObstacle(frame(0), frame(2, 4), { id: 0, kind: 'ground', x: 1 })).toEqual({
      kind: 'jumped',
      fraction: 0.9,
    });
  });

  it('reports success only on crossing the trailing edge, never for an old or future obstacle', () => {
    const obstacle = { id: 0, kind: 'ground', x: 1 } as const;
    expect(classifyObstacle(frame(0, 1), frame(0.2, 1), obstacle)).toEqual({ kind: 'none' });
    expect(classifyObstacle(frame(0.8, 1), frame(1.7, 1), obstacle)).toEqual({ kind: 'none' });
    expect(classifyObstacle(frame(1.7, 1), frame(1.9, 1), obstacle).kind).toBe('jumped');
    expect(classifyObstacle(frame(1.9, 1), frame(2, 1), obstacle)).toEqual({ kind: 'none' });
  });
});
