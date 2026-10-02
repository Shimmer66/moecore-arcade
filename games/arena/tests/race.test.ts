import { describe, expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RaceRunner } from '../src/race';
import { SECRET_ROUTES, type RouteDriver } from './routes';

const idle = { horizontal: 0, jump: false };
describe('shared trap race', () => {
  for (const [index, route] of SECRET_ROUTES.entries()) {
    it(`preserves the secret route in shared room ${index + 1}`, () => {
      const race = new RaceRunner(CAMPAIGN[index]!);
      const driver: RouteDriver = {
        get rect() {
          return race.runners[1].rect;
        },
        get phase() {
          return race.runners[1].phase;
        },
        get traps() {
          return race.runners[1].traps;
        },
        get grounded() {
          return race.runners[1].grounded;
        },
        step(horizontal, jump) {
          race.step([idle, { horizontal, jump }]);
        },
      };
      route(driver);
      expect({ winner: race.winner, secret: race.runners[1].secret }).toEqual({
        winner: 1,
        secret: true,
      });
      race.dispose();
    });
  }
  for (const index of [10, 21]) {
    it(`rearms expired temporary room ${index + 1} after a racer dies`, () => {
      const race = new RaceRunner(CAMPAIGN[index]!);
      const id = index === 10 ? 'up' : 'trial';
      while (race.runners[1].rect.x < 235) race.step([idle, { horizontal: 1, jump: false }]);
      const initial = race.scene.clocks[id]!.triggeredAt!;
      for (let i = 0; i < 200; i++) race.step([idle, idle]);
      let jumped = false;
      for (let i = 0; i < 650 && race.winner === null; i++) {
        const jump = index === 21 && race.deaths[1] > 0 && race.runners[1].rect.x >= 530 && !jumped;
        if (jump) jumped = true;
        race.step([idle, { horizontal: 1, jump }]);
      }
      expect(race.deaths[1]).toBeGreaterThan(0);
      expect(race.scene.clocks[id]!.triggeredAt).toBeGreaterThan(initial);
      expect(race.winner).toBe(1);
      race.dispose();
    });
  }
  it('lets either racer trigger the same world and only respawns the fallen racer', () => {
    const race = new RaceRunner(CAMPAIGN[0]!);
    const untouched = race.runners[0];
    for (let tick = 0; tick < 150; tick++) race.step([idle, { horizontal: 1, jump: false }]);
    expect(race.scene.clocks.bridge!.triggeredAt).not.toBeNull();
    expect(race.deaths[1]).toBeGreaterThan(0);
    expect(race.runners[0]).toBe(untouched);
    expect(race.runners[0].rect.x).toBe(50);
    expect(race.runners[0].scene).toBe(race.runners[1].scene);
    race.dispose();
  });
  it('awards the racer who reaches the exit and freezes the finished round', () => {
    const race = new RaceRunner(CAMPAIGN[0]!);
    let jumped = false;
    for (let tick = 0; tick < 400 && race.winner === null; tick++) {
      const jump = race.runners[1].rect.x >= 250 && !jumped;
      if (jump) jumped = true;
      race.step([idle, { horizontal: 1, jump }]);
    }
    expect(race.winner).toBe(1);
    const ticks = race.ticks;
    race.step([{ horizontal: 1, jump: true }, idle]);
    expect(race.ticks).toBe(ticks);
    race.dispose();
  });
  it('treats simultaneous finishes as a draw regardless of iteration order', () => {
    const race = new RaceRunner(CAMPAIGN[0]!);
    let jumped = false;
    for (let tick = 0; tick < 400 && race.winner === null; tick++) {
      const jump = race.runners[0].rect.x >= 250 && !jumped;
      if (jump) jumped = true;
      const input = { horizontal: 1, jump };
      race.step([input, input]);
    }
    expect(race.winner).toBe('draw');
    race.dispose();
  });
});
