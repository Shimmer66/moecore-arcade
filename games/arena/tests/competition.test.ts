import { expect, it } from 'vitest';
import { CAMPAIGN } from '../src/campaign';
import { RaceRunner, type RaceInput } from '../src/race';
import { openRoom } from '../src/runner';
import { SECRET_ROUTES, type RouteDriver } from './routes';

function recordInputs(index: number): RaceInput[] {
  const run = openRoom(index);
  const inputs: RaceInput[] = [];
  const driver: RouteDriver = {
    get rect() {
      return run.rect;
    },
    get traps() {
      return run.traps;
    },
    get grounded() {
      return run.grounded;
    },
    get phase() {
      return run.phase;
    },
    step(horizontal, jump) {
      if (run.phase !== 'playing') return;
      inputs.push({ horizontal, jump });
      run.step(horizontal, jump);
    },
  };
  SECRET_ROUTES[index]!(driver);
  run.dispose();
  return inputs;
}
const idle: RaceInput = { horizontal: 0, jump: false };
function compete(index: number, script: RaceInput[], delay: number, swap: boolean) {
  const race = new RaceRunner(CAMPAIGN[index]!);
  const offsets = [0, 0];
  const ready = swap ? [delay, 0] : [0, delay];
  const previous = [...race.runners];
  for (let frame = 0; frame < 2400 && race.winner === null; frame++) {
    const input = [idle, idle] as [RaceInput, RaceInput];
    for (const player of [0, 1] as const) {
      if (race.runners[player] !== previous[player]) {
        offsets[player] = 0;
        previous[player] = race.runners[player];
      }
      if (frame >= ready[player]! && race.runners[player].phase === 'playing') {
        input[player] = script[offsets[player]!] ?? idle;
        offsets[player]!++;
      }
    }
    race.step(input);
  }
  const result = { winner: race.winner, deaths: [...race.deaths], ticks: race.ticks };
  race.dispose();
  return result;
}

for (const [index, room] of CAMPAIGN.entries()) {
  it(`finishes competing inputs in ${room.id} without player-order advantage`, () => {
    const script = recordInputs(index);
    for (const delay of [17, 61]) {
      const original = compete(index, script, delay, false);
      const mirrored = compete(index, script, delay, true);
      expect(original.winner, `${room.id} delay=${delay} deaths=${original.deaths}`).not.toBeNull();
      expect(mirrored.winner).toBe(
        original.winner === 'draw' ? 'draw' : 1 - Number(original.winner),
      );
      expect(mirrored.deaths).toEqual([...original.deaths].reverse());
      expect(mirrored.ticks).toBe(original.ticks);
    }
  });
}
