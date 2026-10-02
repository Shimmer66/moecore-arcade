import { expect, it } from 'vitest';
import { createEndless, clearEndless, nextEndless, generateEndlessRoom } from '../src/endless';
import { RoomRunner } from '../src/runner';

it('keeps retries deterministic, advances only cleared stages and never ends by stage count', () => {
  const run = createEndless(1989);
  expect(nextEndless(run)).toBe(run);
  const clear = clearEndless(run, 240, true);
  expect(clearEndless(clear, 240, true)).toBe(clear);
  expect(nextEndless(clear).stage).toBe(1);
  expect(generateEndlessRoom(1989, 5000)).toEqual(generateEndlessRoom(1989, 5000));
  expect(generateEndlessRoom(1989, 5000)).not.toEqual(generateEndlessRoom(1989, 5001));
});

it('crosses varied generated rooms with ordinary movement, waiting and jumping', () => {
  const layouts = new Set<string>();
  for (let sample = 0; sample < 160; sample++) {
    const room = generateEndlessRoom(sample * 9173, sample % 40);
    layouts.add(JSON.stringify(room.traps.map((trap) => [trap.effect, trap.body, trap.travel])));
    const run = new RoomRunner(room);
    const jumped = new Set<string>();
    for (let tick = 0; tick < 1400 && run.phase === 'playing'; tick++) {
      let horizontal = 1,
        jump = false;
      for (const hazard of run.traps) {
        const gap = hazard.body.x - run.rect.x;
        if (hazard.trap.effect === 'gate' && hazard.phase === 'active' && gap > 32 && gap < 90)
          horizontal = 0;
        if (
          ['pit', 'spikes'].includes(hazard.trap.effect) &&
          gap < 65 &&
          gap > 0 &&
          run.grounded &&
          !jumped.has(hazard.trap.id)
        ) {
          jump = true;
          jumped.add(hazard.trap.id);
        }
        if (hazard.trap.effect === 'saw' && gap < 100 && gap > 0 && run.grounded) jump = true;
      }
      run.step(horizontal, jump);
    }
    expect(run.phase, `seed=${sample * 9173} stage=${sample % 40} x=${run.rect.x}`).toBe('clear');
    run.dispose();
  }
  expect(layouts.size).toBeGreaterThan(150);
});
