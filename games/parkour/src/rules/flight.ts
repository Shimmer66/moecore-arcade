export const FLIGHT_DT = 1 / 60;
export const FLIGHT_FINISH = 720;
export const FLIGHT_BEST_KEY = 'moecore:parkour:flight:best:v1';
export const FLIGHT_RADIUS = 0.45;
// Keep the full character and missile warning inside the smallest playfield.
const MIN_ALTITUDE = 1.2;
const MAX_ALTITUDE = 8.8;
export interface FlightGate {
  readonly id: number;
  readonly x: number;
  readonly center: number;
  readonly gap: number;
}
export interface FlightPickup {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly bonus: boolean;
}
export interface FlightMissile {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly fireTick: number;
}
export const flightGates: readonly FlightGate[] = [
  [60, 3],
  [108, 6.5],
  [156, 4],
  [204, 7],
  [252, 3],
  [300, 5],
  [344, 7],
  [388, 3],
  [432, 6],
  [476, 4],
  [520, 7],
  [560, 3],
  [600, 6],
  [640, 4],
  [680, 5],
].map(([x, center], id) => ({ id, x: x!, center: center!, gap: id < 5 ? 4 : id < 10 ? 3.5 : 3 }));
const launches = [113, 349, 565];
export interface FlightState {
  readonly tick: number;
  readonly distance: number;
  readonly y: number;
  readonly vy: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly heat: number;
  readonly overheatTicks: number;
  readonly invulnerableTicks: number;
  readonly thrusting: boolean;
  readonly hits: number;
  readonly overheats: number;
  readonly cleared: number;
  readonly tokens: number;
  readonly bonusTokens: number;
  readonly score: number;
  readonly resolved: readonly number[];
  readonly pickups: readonly FlightPickup[];
  readonly missiles: readonly FlightMissile[];
  readonly launched: number;
  readonly status: 'running' | 'won' | 'lost';
  readonly quip: string;
  readonly quipUntil: number;
}
export function beginFlight(assisted = false): FlightState {
  return {
    tick: 0,
    distance: 0,
    y: 3,
    vy: 0,
    health: assisted ? 4 : 3,
    maxHealth: assisted ? 4 : 3,
    heat: 0,
    overheatTicks: 0,
    invulnerableTicks: 0,
    thrusting: false,
    hits: 0,
    overheats: 0,
    cleared: 0,
    tokens: 0,
    bonusTokens: 0,
    score: 0,
    resolved: [],
    missiles: [],
    launched: 0,
    status: 'running',
    pickups: flightGates.flatMap((gate) => [
      ...[-7, -4, -1].map((offset, index) => ({
        id: gate.id * 4 + index,
        x: gate.x + offset,
        y: gate.center,
        bonus: false,
      })),
      {
        id: gate.id * 4 + 3,
        x: gate.x - 20,
        y: Math.max(1, Math.min(9, gate.center + (gate.center > 5 ? -2 : 2))),
        bonus: true,
      },
    ]),
    quip: '按住点火，松手散热。别把上下文烧了！',
    quipUntil: 180,
  };
}
export function flightSpeed(distance: number): number {
  return Math.min(15, 13 + distance * 0.0025);
}
export function advanceFlight(state: FlightState, held: boolean): FlightState {
  if (state.status !== 'running') return state;
  const tick = state.tick + 1;
  const overheatTicks = Math.max(0, state.overheatTicks - 1);
  const thrusting = held && overheatTicks === 0;
  let heat = Math.max(0, Math.min(100, state.heat + (thrusting ? 32 : -42) * FLIGHT_DT));
  const overheated = thrusting && heat >= 100;
  const thrust = thrusting && !overheated;
  const vy = Math.max(-5.4, Math.min(5.4, state.vy + (thrust ? 18 : -12) * FLIGHT_DT));
  const y = Math.max(MIN_ALTITUDE, Math.min(MAX_ALTITUDE, state.y + vy * FLIGHT_DT));
  const distance = Math.min(
    FLIGHT_FINISH,
    state.distance + flightSpeed(state.distance) * FLIGHT_DT,
  );
  const next = {
    ...state,
    tick,
    distance,
    y,
    vy: y === MIN_ALTITUDE || y === MAX_ALTITUDE ? 0 : vy,
    heat,
    thrusting: thrust,
    overheatTicks: overheated ? 90 : overheatTicks,
    invulnerableTicks: Math.max(0, state.invulnerableTicks - 1),
  };
  const say = (quip: string) => {
    next.quip = quip;
    next.quipUntil = tick + 100;
  };
  const hit = (quip: string) => {
    if (next.invulnerableTicks > 0 || next.status !== 'running') return;
    next.health--;
    next.hits++;
    next.invulnerableTicks = 72;
    say(quip);
    if (next.health === 0) next.status = 'lost';
  };
  if (overheated) {
    next.overheats++;
    say('上下文烧糊了！松手，等背包冷却。');
  }
  const resolved = [...state.resolved];
  for (const gate of flightGates) {
    if (resolved.includes(gate.id)) continue;
    if (
      distance + FLIGHT_RADIUS >= gate.x - 0.4 &&
      state.distance - FLIGHT_RADIUS <= gate.x + 0.4
    ) {
      if (
        y - FLIGHT_RADIUS < gate.center - gate.gap / 2 ||
        y + FLIGHT_RADIUS > gate.center + gate.gap / 2
      ) {
        hit('撞上限流墙！先对准缺口，再捡 Token。');
        resolved.push(gate.id);
      }
    }
    if (distance - FLIGHT_RADIUS > gate.x + 0.4 && !resolved.includes(gate.id)) {
      resolved.push(gate.id);
      next.cleared++;
      if (next.cleared % 5 === 0) say('限流也拦不住本鱼！');
    }
  }
  next.resolved = resolved;
  next.pickups = state.pickups.filter((pickup) => {
    if (next.status !== 'running') return true;
    if (
      state.distance - 0.6 <= pickup.x &&
      distance + 0.6 >= pickup.x &&
      Math.abs(y - pickup.y) < 0.7
    ) {
      if (pickup.bonus) {
        next.bonusTokens++;
        heat = Math.max(0, heat - 18);
        next.heat = heat;
        say('加急 Token 到账，还顺便散了热。');
      } else next.tokens++;
      return false;
    }
    return pickup.x >= distance - 1;
  });
  next.missiles = state.missiles.flatMap((missile) => {
    const moved = { ...missile, x: missile.x - (tick >= missile.fireTick ? 18 * FLIGHT_DT : 0) };
    if (
      tick >= missile.fireTick &&
      moved.x - 0.8 <= distance &&
      missile.x + 0.8 >= state.distance &&
      Math.abs(y - missile.y) < 0.75
    ) {
      hit('被催更弹追上了！锁定后换个高度。');
      return [];
    }
    return moved.x >= distance - 2 ? [moved] : [];
  });
  if (next.launched < launches.length && distance >= launches[next.launched]!) {
    next.missiles = [
      ...next.missiles,
      { id: next.launched, x: distance + 26, y, fireTick: tick + 66 },
    ];
    next.launched++;
    say('催更弹已锁定！换个高度，它不会再跟。');
  }
  next.score =
    Math.floor(distance * 10) + next.tokens * 40 + next.bonusTokens * 180 + next.cleared * 100;
  if (next.status === 'running' && distance >= FLIGHT_FINISH) {
    next.status = 'won';
    say('算力没烧，答案送到！');
  }
  return next;
}
