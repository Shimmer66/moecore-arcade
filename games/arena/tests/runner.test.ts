import { describe, expect, it } from 'vitest';
import { openRoom } from '../src/runner';
import { CAMPAIGN } from '../src/campaign';

describe('campaign playable routes', () => {
  it('kills a player who walks into the first hallucination and resets on reopening', () => {
    const run = openRoom(0);
    for (let i = 0; i < 240; i++) run.step(1, false);
    expect(run.phase).toBe('dead');
    run.dispose();
    const retry = openRoom(0);
    expect(retry.rect.x).toBe(50);
    expect(retry.scene.tick).toBe(0);
    retry.dispose();
  });

  for (let index = 0; index < 8; index++) {
    it(`reaches ${CAMPAIGN[index]!.id} exit using movement and jumps`, () => {
      const run = openRoom(index);
      // Each jump is issued once at the authored takeoff point; no position/state edits.
      const takeoffs = [[250], [240, 410], [230, 495], [], [480], [], [610], [230, 425, 655]][
        index
      ]!;
      const used = new Set<number>();
      let returnJump = false;
      for (let tick = 0; tick < 900 && run.phase === 'playing'; tick++) {
        let direction = 1;
        let jump = false;
        if (
          index === 3 &&
          run.scene.clocks.door!.triggeredAt !== null &&
          run.scene.tick - run.scene.clocks.door!.triggeredAt > 40
        ) {
          direction = -1;
          if (run.rect.x < 660 && !returnJump) {
            jump = true;
            returnJump = true;
          }
        }
        if (
          index === 6 &&
          run.traps.some((view) => view.trap.effect === 'reverse' && view.phase === 'active')
        )
          direction = -1;
        if (
          (index === 1 || index === 7) &&
          run.rect.x >= 395 &&
          !used.has(takeoffs[1]!) &&
          !run.grounded
        )
          direction = 0;
        if (
          index === 5 &&
          ((run.rect.x >= 300 && run.rect.x < 340 && tick < 105) ||
            (run.rect.x >= 535 && run.rect.x < 575 && tick < 205))
        )
          direction = 0;
        for (const x of takeoffs) {
          if (run.rect.x >= x && !used.has(x)) {
            used.add(x);
            jump = true;
          }
        }
        run.step(direction, jump);
      }
      expect({ phase: run.phase, x: run.rect.x, y: run.rect.y }).toMatchObject({ phase: 'clear' });
      run.dispose();
    });
  }
  for (let index = 8; index < 16; index++) {
    it(`reaches ${CAMPAIGN[index]!.id} through its new mechanism`, () => {
      const run = openRoom(index);
      let jumpedPit = false;
      let boarded = false;
      let dismounted = false;
      let ceilingJump = false;
      for (let tick = 0; tick < 1500 && run.phase === 'playing'; tick++) {
        let direction = 1;
        let jump = false;
        for (const view of run.traps) {
          if (
            view.trap.effect === 'gate' &&
            view.phase === 'active' &&
            run.rect.x + 32 < view.body.x &&
            view.body.x - run.rect.x < 85
          )
            direction = 0;
          if (
            view.trap.effect === 'saw' &&
            view.phase === 'active' &&
            view.body.x > run.rect.x &&
            view.body.x - run.rect.x < 100 &&
            run.grounded
          )
            jump = true;
        }
        if (index === 12 && run.rect.x >= 220 && !jumpedPit) {
          jumpedPit = true;
          jump = true;
        }
        if (index === 14 && run.rect.x >= 425 && run.rect.y < 110 && !ceilingJump) {
          ceilingJump = true;
          jump = true;
        }
        if (index === 11) {
          const shuttle = run.traps.find((view) => view.trap.effect === 'platform')!;
          if (run.rect.x >= 200 && !jumpedPit) {
            jumpedPit = true;
            jump = true;
          }
          if (run.rect.x > 300 && run.grounded) boarded = true;
          if (boarded && !dismounted) {
            direction = 0;
            if (shuttle.body.x >= 580) {
              jump = true;
              direction = 1;
              dismounted = true;
            }
          }
        }
        run.step(direction, jump);
      }
      expect({ phase: run.phase, x: run.rect.x, y: run.rect.y }).toMatchObject({ phase: 'clear' });
      run.dispose();
    });
  }
  for (let index = 16; index < 24; index++) {
    it(`reaches ${CAMPAIGN[index]!.id} without bypassing its traps`, () => {
      const run = openRoom(index);
      const jumps = new Set<number>();
      let stage = 0;
      let returning = false;
      for (let tick = 0; tick < 1800 && run.phase === 'playing'; tick++) {
        let direction = 1;
        let jump = false;
        const takeoffs: Record<number, number[]> = {
          16: [410],
          17: [],
          18: [],
          19: [225],
          21: [530],
          23: [240],
        };
        for (const point of takeoffs[index] ?? []) {
          if (run.rect.x >= point && !jumps.has(point)) {
            jump = true;
            jumps.add(point);
          }
        }
        for (const view of run.traps) {
          if (view.trap.effect === 'reverse' && view.phase === 'active') direction = -1;
          if (
            view.trap.effect === 'gate' &&
            view.phase === 'active' &&
            view.body.x > run.rect.x + 32 &&
            view.body.x - run.rect.x < 85
          )
            direction = 0;
        }
        if (index === 18) {
          if (run.traps.some((view) => view.trap.effect === 'exit' && view.phase === 'active'))
            returning = true;
          if (returning) {
            direction = -1;
            if (run.rect.x < 675 && !jumps.has(1)) {
              jump = true;
              jumps.add(1);
            }
          }
        }
        if (index === 20) {
          const starts = [150, 280, 465, 685];
          const stops = [250, 435, 640, 900];
          if (stage < starts.length) {
            if (run.rect.x >= starts[stage]! && !jumps.has(stage)) {
              jump = true;
              jumps.add(stage);
            }
            if (run.rect.x >= stops[stage]!) {
              direction = 0;
              if (run.grounded) stage++;
            }
          }
        }
        if (index === 22) {
          if (stage === 0 && run.rect.x >= 320) {
            direction = 0;
            const platform = run.traps.find((view) => view.trap.effect === 'platform')!;
            if (platform.body.y > 290) {
              stage = 1;
              jump = true;
              direction = 1;
            }
          } else if (stage === 1 && run.rect.x >= 445) {
            direction = 0;
            if (run.grounded) stage = 2;
          } else if (stage === 2) {
            direction = 0;
            if (run.rect.y < 205) {
              stage = 3;
              jump = true;
              direction = 1;
            }
          }
        }
        run.step(direction, jump);
      }
      expect({ phase: run.phase, x: run.rect.x, y: run.rect.y }).toMatchObject({ phase: 'clear' });
      run.dispose();
    });
  }
});
