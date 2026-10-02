import { expect, it } from 'vitest';
import { frameActors } from '../src/camera';

it('keeps both widely separated copies inside the frame in either order', () => {
  const actors = [
    { x: 50, width: 32, finished: false },
    { x: 1500, width: 32, finished: false },
  ];
  const view = frameActors(2500, 560, actors);
  expect(view.x).toBeLessThanOrEqual(50);
  expect(view.x + view.width).toBeGreaterThanOrEqual(1532);
  expect(frameActors(2500, 560, [...actors].reverse())).toEqual(view);
});
it('follows the trailing copy after the original reaches the exit', () => {
  const view = frameActors(2500, 560, [
    { x: 2420, width: 32, finished: true },
    { x: 600, width: 32, finished: false },
  ]);
  expect(view.width).toBe(560);
  expect(view.x).toBeLessThan(600);
  expect(view.x + view.width).toBeGreaterThan(632);
});
it('bounds the camera at either world edge and retains a final view when all arrive', () => {
  for (const x of [0, 2468]) {
    const view = frameActors(2500, 1000, [{ x, width: 32, finished: false }]);
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.x + view.width).toBeLessThanOrEqual(2500);
  }
  expect(frameActors(1000, 560, [{ x: 930, width: 32, finished: true }])).toEqual({
    x: 440,
    width: 560,
  });
});
