import { type Room } from './campaign';
import { RoomRunner } from './runner';
import { createTrapScene, stepTraps } from './traps';

export interface RaceInput {
  horizontal: number;
  jump: boolean;
  sabotage?: boolean;
  thrust?: boolean;
}
export class RaceRunner {
  runners: [RoomRunner, RoomRunner];
  scene;
  deaths: [number, number] = [0, 0];
  winner: 0 | 1 | 'draw' | null = null;
  ticks = 0;
  sabotageUsed: [boolean, boolean] = [false, false];
  constructor(readonly room: Room) {
    this.room = { ...room, traps: [...room.traps] };
    this.runners = [new RoomRunner(this.room), new RoomRunner(this.room)];
    this.scene = createTrapScene(this.room.traps);
  }
  canSabotage(player: 0 | 1) {
    return (
      this.winner === null &&
      !this.sabotageUsed[player] &&
      this.runners.every((runner) => runner.phase === 'playing')
    );
  }
  step(inputs: readonly [RaceInput, RaceInput]) {
    if (this.winner !== null) return;
    for (const player of [0, 1] as const) {
      if (!inputs[player].sabotage || !this.canSabotage(player)) continue;
      const opponent = this.runners[player === 0 ? 1 : 0];
      const target =
        [opponent, ...opponent.clones].find((actor) => actor.phase === 'playing' && !actor.arrived)
          ?.rect ?? opponent.rect;
      const id = `race-injection-${player}`;
      this.room.traps.push({
        id,
        effect: 'falling',
        trigger: { x: 0, y: -100, w: this.room.width ?? 1000, h: 600 },
        body: {
          x: Math.max(0, Math.min((this.room.width ?? 1000) - 70, target.x - 19)),
          y: 20,
          w: 70,
          h: 50,
        },
        delay: 30,
        travel: { x: 0, y: 420, ticks: 28 },
        line: `P${player + 1}：只追加一个小需求。`,
      });
      this.scene = {
        ...this.scene,
        clocks: {
          ...this.scene.clocks,
          [id]: { triggeredAt: this.scene.tick },
        },
      };
      this.sabotageUsed[player] = true;
    }
    this.ticks++;
    this.scene = stepTraps(
      this.room.traps,
      this.scene,
      this.runners.flatMap((runner, index) =>
        runner.triggerActors(inputs[index]!.horizontal, inputs[index]!.jump, String(index)),
      ),
    );
    for (const index of [0, 1] as const) {
      let runner = this.runners[index];
      if (runner.phase === 'dead' && runner.deathTicks >= 22) {
        runner.dispose();
        runner = new RoomRunner(this.room);
        this.runners[index] = runner;
      }
      const before = runner.phase;
      runner.step(inputs[index].horizontal, inputs[index].jump, this.scene, inputs[index].thrust);
      if (before === 'playing' && runner.phase === 'dead') this.deaths[index]++;
    }
    const finishes = this.runners.map((runner) => runner.phase === 'clear');
    if (finishes[0] && finishes[1]) this.winner = 'draw';
    else if (finishes[0]) this.winner = 0;
    else if (finishes[1]) this.winner = 1;
  }
  dispose() {
    this.runners.forEach((runner) => runner.dispose());
  }
}
