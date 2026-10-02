export interface HealthLagState {
  displayed: [number, number];
  observed: [number, number];
  delay: [number, number];
}

export const HEALTH_LAG_HOLD = 18;
export const HEALTH_LAG_STEP = 12;

export function createHealthLagState(hp: [number, number] = [1000, 1000]): HealthLagState {
  return { displayed: [...hp], observed: [...hp], delay: [0, 0] };
}

export function nextHealthLag(
  state: HealthLagState,
  hp: [number, number],
  reduced = false,
): HealthLagState {
  if (
    state.displayed[0] === hp[0] &&
    state.displayed[1] === hp[1] &&
    state.observed[0] === hp[0] &&
    state.observed[1] === hp[1] &&
    state.delay[0] === 0 &&
    state.delay[1] === 0
  )
    return state;
  const next: HealthLagState = {
    displayed: [...state.displayed],
    observed: [...state.observed],
    delay: [...state.delay],
  };
  for (const slot of [0, 1] as const) {
    if (reduced || hp[slot] > state.observed[slot] || hp[slot] > state.displayed[slot]) {
      next.displayed[slot] = hp[slot];
      next.delay[slot] = 0;
    } else if (hp[slot] < state.observed[slot]) next.delay[slot] = HEALTH_LAG_HOLD;
    else if (next.delay[slot] > 0) next.delay[slot]--;
    else if (next.displayed[slot] > hp[slot])
      next.displayed[slot] = Math.max(hp[slot], next.displayed[slot] - HEALTH_LAG_STEP);
    next.observed[slot] = hp[slot];
  }
  return next;
}
