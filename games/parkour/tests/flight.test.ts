import { describe, expect, it } from 'vitest';
import {
  advanceFlight,
  beginFlight,
  flightGates,
  FLIGHT_FINISH,
  type FlightState,
} from '../src/rules/flight';

function pilot(state: FlightState, greedy = false): boolean {
  const gate = flightGates.find((gate) => gate.x > state.distance - 1);
  let target = gate?.center ?? 5;
  const bonus = state.pickups.find(
    (p) => p.bonus && p.x > state.distance && p.x - state.distance < 14,
  );
  if (greedy && bonus && (!gate || gate.x - state.distance > 14)) target = bonus.y;
  const missile = state.missiles.find((m) => m.x > state.distance - 1);
  if (missile && Math.abs(target - missile.y) < 1.4)
    target = Math.max(1, Math.min(9, missile.y + (missile.y > 5 ? -2 : 2)));
  return state.y + state.vy * 0.35 < target;
}

describe('compute jetpack flight', () => {
  it('holding rises and releasing falls, with bounded altitude', () => {
    let state = beginFlight();
    for (let tick = 0; tick < 30; tick++) state = advanceFlight(state, true);
    expect(state.y).toBeGreaterThan(4);
    const top = state.y;
    for (let tick = 0; tick < 100; tick++) state = advanceFlight(state, false);
    expect(state.y).toBeLessThan(top);
    expect(state.y).toBeGreaterThanOrEqual(0.45);
  });
  it('continuous thrust overheats, cuts the engine and recovers with release', () => {
    let state = beginFlight();
    for (let tick = 0; tick < 190; tick++) state = advanceFlight(state, true);
    expect(state.overheats).toBe(1);
    expect(state.overheatTicks).toBeGreaterThan(0);
    expect(state.thrusting).toBe(false);
    for (let tick = 0; tick < 91; tick++) state = advanceFlight(state, false);
    expect(state.overheatTicks).toBe(0);
    expect(state.heat).toBeLessThan(40);
    expect(advanceFlight(state, true).thrusting).toBe(true);
  });
  it.each([false, true])('supports a normal-input full route, greedy=%s', (greedy) => {
    let state = beginFlight();
    for (let tick = 0; tick < 4000 && state.status === 'running'; tick++)
      state = advanceFlight(state, pilot(state, greedy));
    expect(state.status).toBe('won');
    expect(state.distance).toBe(FLIGHT_FINISH);
    expect(state.hits).toBe(0);
    expect(state.cleared).toBe(flightGates.length);
    expect(state.tokens).toBeGreaterThan(15);
    expect(state.launched).toBe(3);
    if (greedy) expect(state.bonusTokens).toBeGreaterThan(5);
  });
  it('does not win without input and keeps the terminal result frozen', () => {
    let state = beginFlight();
    for (let tick = 0; tick < 4000 && state.status === 'running'; tick++)
      state = advanceFlight(state, false);
    expect(state.status).toBe('lost');
    expect(state.health).toBe(0);
    expect(advanceFlight(state, true)).toBe(state);
  });
  it('missiles warn before flight and keep their locked altitude', () => {
    let state = beginFlight();
    while (!state.missiles.length) state = advanceFlight(state, pilot(state));
    const missile = state.missiles[0]!;
    expect(missile.fireTick - state.tick).toBe(66);
    for (let tick = 0; tick < 30; tick++) state = advanceFlight(state, true);
    expect(state.missiles[0]!.y).toBe(missile.y);
    expect(state.missiles[0]!.x).toBe(missile.x);
    for (let tick = 0; tick < 40; tick++) state = advanceFlight(state, false);
    expect(state.missiles[0]!.x).toBeLessThan(missile.x);
  });
});
