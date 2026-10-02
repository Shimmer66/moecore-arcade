import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RoomRunner } from '../src/runner';
import { SECRET_ROUTES, type RouteDriver } from './routes';

const index = CAMPAIGN.findIndex((room) => room.id === 'one-more-thing');
type Input = { horizontal: number; jump: boolean };
function routeInputs() {
  const run = new RoomRunner(CAMPAIGN[index]!);
  const inputs: Input[] = [];
  const driver: RouteDriver = {
    get rect() {
      return run.rect;
    },
    get traps() {
      return run.traps;
    },
    get phase() {
      return run.phase;
    },
    get grounded() {
      return run.grounded;
    },
    step(horizontal, jump) {
      if (run.phase !== 'playing') return;
      inputs.push({ horizontal, jump });
      run.step(horizontal, jump);
    },
  };
  SECRET_ROUTES[index]!(driver);
  expect(run.phase).toBe('clear');
  const result = { inputs, ticks: run.ticks };
  run.dispose();
  return result;
}

it('exercises every authored event before reaching the far exit', () => {
  const run = new RoomRunner(CAMPAIGN[index]!);
  SECRET_ROUTES[index]!(run);
  expect(run.phase).toBe('clear');
  expect(run.secret).toBe(true);
  for (const clock of Object.values(run.scene.clocks)) expect(clock.triggeredAt).not.toBeNull();
  run.dispose();
});

for (const [name, left, right, expected] of [
  ['first gap', 200, 300, 'pit'],
  ['autocomplete spikes', 500, 600, 'spikes'],
  ['patrolling saw', 1300, 1570, 'saw'],
  ['fake exit', 1700, 1800, 'decoy'],
  ['last gap', 1980, 2070, 'pit'],
] as const) {
  it(`makes skipping the ${name} jump fail at that obstacle`, () => {
    const run = new RoomRunner(CAMPAIGN[index]!);
    const { inputs } = routeInputs();
    let removed = false;
    for (const input of inputs) {
      const drop = input.jump && run.rect.x >= left && run.rect.x <= right;
      removed ||= drop;
      run.step(input.horizontal, input.jump && !drop);
      if (run.phase !== 'playing') break;
    }
    expect(removed).toBe(true);
    expect(run.phase).toBe('dead');
    expect(run.deathTrap).toBe(expected);
    run.dispose();
  });
}

it('requires timing the rate-limit gate instead of holding forward throughout it', () => {
  const run = new RoomRunner(CAMPAIGN[index]!);
  const { inputs } = routeInputs();
  let removed = false;
  for (const input of inputs) {
    const rush = input.horizontal === 0 && run.rect.x > 800 && run.rect.x < 900;
    removed ||= rush;
    run.step(rush ? 1 : input.horizontal, input.jump);
    if (run.phase !== 'playing') break;
  }
  expect(removed).toBe(true);
  expect(run.phase).toBe('dead');
  expect(run.deathTrap).toBe('gate');
  run.dispose();
});

it('offers at least seven consecutive viable takeoff frames for every jump', () => {
  const { inputs } = routeInputs();
  const jumps = inputs.flatMap((input, frame) => (input.jump ? [frame] : []));
  for (const frame of jumps) {
    let longest = 0;
    let consecutive = 0;
    const viable: number[] = [];
    for (let delta = -10; delta <= 10; delta++) {
      const run = new RoomRunner(CAMPAIGN[index]!);
      for (let tick = 0; tick < inputs.length; tick++) {
        const input = inputs[tick]!;
        const jump = tick === frame + delta || (input.jump && tick !== frame);
        run.step(input.horizontal, jump);
        if (run.phase !== 'playing') break;
      }
      if (run.phase === 'clear') {
        viable.push(delta);
        consecutive++;
        longest = Math.max(longest, consecutive);
      } else consecutive = 0;
      run.dispose();
    }
    expect(longest, `jump=${frame} viable offsets=${viable.join(',')}`).toBeGreaterThanOrEqual(7);
  }
});
