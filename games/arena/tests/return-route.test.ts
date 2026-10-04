import { expect, it } from 'vitest';
import { openRoom } from '../src/runner';
import { SECRET_ROUTES, type RouteDriver } from './routes';

for (const [index, returnTrap] of [
  [3, 'return'],
  [18, 'rollback-gap'],
  [34, 'agent-gap'],
] as const) {
  it(`does not award room ${index + 1} when the moving exit sweeps over a player`, () => {
    const run = openRoom(index);
    let sawMovingExit = false;
    for (let tick = 0; tick < 700 && run.phase === 'playing'; tick++) {
      run.step(1, false);
      if (!run.exitReady) sawMovingExit = true;
    }
    expect(sawMovingExit).toBe(true);
    expect(run.phase).not.toBe('clear');
    run.dispose();
  });
  it(`requires and preserves the authored return journey in room ${index + 1}`, () => {
    const run = openRoom(index);
    let farthest = 0;
    let leftSteps = 0;
    const driver: RouteDriver = {
      get rect() {
        return run.rect;
      },
      get phase() {
        return run.phase;
      },
      get traps() {
        return run.traps;
      },
      get grounded() {
        return run.grounded;
      },
      step(horizontal, jump) {
        if (run.phase !== 'playing') return;
        if (horizontal < 0) leftSteps++;
        run.step(horizontal, jump);
        farthest = Math.max(farthest, run.rect.x);
      },
    };
    SECRET_ROUTES[index]!(driver);
    expect(run.phase).toBe('clear');
    expect(run.secret).toBe(true);
    expect(run.exitReady).toBe(true);
    expect(farthest).toBeGreaterThan(780);
    expect(run.rect.x).toBeLessThan(270);
    expect(leftSteps).toBeGreaterThan(100);
    expect(run.scene.clocks[returnTrap]?.triggeredAt).not.toBeNull();
    run.dispose();
  });
}
