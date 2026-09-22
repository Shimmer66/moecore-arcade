import type { Direction, GameState, Level, MoveResult, SokobanSnapshot } from './types';

export const DIRECTIONS: Readonly<Record<Direction, readonly [number, number]>> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

function sorted(values: ReadonlySet<number>): number[] {
  return [...values].sort((a, b) => a - b);
}

export class Game {
  readonly level: Level;
  readonly width: number;
  readonly height: number;
  readonly walls = new Set<number>();
  readonly goals = new Set<number>();
  boxes = new Set<number>();
  player!: number;
  facing: Direction = 'S';
  moves = 0;
  pushes = 0;
  won: boolean;
  readonly history: GameState[] = [];
  private readonly initial: GameState;

  constructor(level: Level) {
    this.level = level;
    this.width = level.map[0]?.length ?? 0;
    this.height = level.map.length;
    let playerCount = 0;
    for (let y = 0; y < this.height; y += 1) {
      const row = level.map[y] ?? '';
      for (let x = 0; x < this.width; x += 1) {
        const cell = row[x];
        const index = y * this.width + x;
        if (cell === '#') this.walls.add(index);
        if (cell === '.' || cell === '+' || cell === '*') this.goals.add(index);
        if (cell === '$' || cell === '*') this.boxes.add(index);
        if (cell === '@' || cell === '+') {
          this.player = index;
          playerCount += 1;
        }
      }
    }
    if (playerCount !== 1 || this.boxes.size === 0 || this.boxes.size !== this.goals.size)
      throw new TypeError('Invalid Sokoban level');
    this.won = this.isWon();
    this.initial = this.state();
  }

  private state(): GameState {
    return {
      player: this.player,
      boxes: sorted(this.boxes),
      facing: this.facing,
      moves: this.moves,
      pushes: this.pushes,
      won: this.won,
    };
  }

  private restore(state: GameState): void {
    this.player = state.player;
    this.boxes = new Set(state.boxes);
    this.facing = state.facing;
    this.moves = state.moves;
    this.pushes = state.pushes;
    this.won = state.won;
  }

  private isWon(): boolean {
    return [...this.boxes].every((box) => this.goals.has(box));
  }

  neighbor(index: number, direction: Direction): number {
    const delta = DIRECTIONS[direction];
    const x = (index % this.width) + delta[0];
    const y = Math.floor(index / this.width) + delta[1];
    return x < 0 || x >= this.width || y < 0 || y >= this.height ? -1 : y * this.width + x;
  }

  move(direction: Direction): MoveResult {
    const from = this.player;
    const blocked: MoveResult = {
      type: 'blocked',
      from,
      to: from,
      onGoal: false,
      becameWon: false,
    };
    if (this.won) return blocked;
    const previous = this.state();
    this.facing = direction;
    const to = this.neighbor(from, direction);
    if (to < 0 || this.walls.has(to)) return blocked;
    const pushing = this.boxes.has(to);
    const boxTo = pushing ? this.neighbor(to, direction) : -1;
    if (pushing && (boxTo < 0 || this.walls.has(boxTo) || this.boxes.has(boxTo))) return blocked;
    this.history.push(previous);
    this.player = to;
    this.moves += 1;
    if (!pushing) return { type: 'walk', from, to, onGoal: false, becameWon: false };
    this.boxes.delete(to);
    this.boxes.add(boxTo);
    this.pushes += 1;
    const onGoal = !this.goals.has(to) && this.goals.has(boxTo);
    this.won = this.isWon();
    return { type: 'push', from, to, boxFrom: to, boxTo, onGoal, becameWon: this.won };
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.restore(previous);
    return true;
  }

  reset(): void {
    this.restore(this.initial);
    this.history.length = 0;
  }

  snapshot(): SokobanSnapshot {
    return {
      levelId: this.level.id,
      width: this.width,
      height: this.height,
      walls: sorted(this.walls),
      goals: sorted(this.goals),
      historyLength: this.history.length,
      ...this.state(),
    };
  }
}
