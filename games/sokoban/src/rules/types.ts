export type Direction = 'N' | 'E' | 'S' | 'W';
export type Difficulty = '简单' | '适中' | '困难';

export interface Level {
  readonly id: number;
  readonly title: string;
  readonly difficulty: Difficulty;
  readonly subtitle: string;
  readonly hint: string;
  readonly map: readonly string[];
  readonly solution: string;
}

export interface GameState {
  readonly player: number;
  readonly boxes: readonly number[];
  readonly facing: Direction;
  readonly moves: number;
  readonly pushes: number;
  readonly won: boolean;
}

export interface SokobanSnapshot extends GameState {
  readonly levelId: number | null;
  readonly width: number;
  readonly height: number;
  readonly walls: readonly number[];
  readonly goals: readonly number[];
  readonly historyLength: number;
}

export type MoveResult =
  | {
      readonly type: 'blocked' | 'walk';
      readonly from: number;
      readonly to: number;
      readonly onGoal: false;
      readonly becameWon: false;
    }
  | {
      readonly type: 'push';
      readonly from: number;
      readonly to: number;
      readonly boxFrom: number;
      readonly boxTo: number;
      readonly onGoal: boolean;
      readonly becameWon: boolean;
    };

export interface NavigationPlan {
  readonly type: 'invalid' | 'blocked' | 'walk' | 'push' | 'box-too-far';
  readonly directions: readonly Direction[];
  readonly target: number;
}
