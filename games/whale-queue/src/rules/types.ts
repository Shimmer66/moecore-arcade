export type Direction = 'up' | 'right' | 'down' | 'left';

export interface Position {
  readonly row: number;
  readonly column: number;
}

export type Rock = Position;

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameState {
  readonly status: GameStatus;
  readonly direction: Direction;
  readonly pendingDirection: Direction | null;
  /** Ordered head first. Every item occupies one board cell. */
  readonly segments: ReadonlyArray<Position>;
  readonly rocks: ReadonlyArray<Position>;
  readonly star: Position | null;
  readonly shells: ReadonlyArray<Position>;
  readonly shellRequests: number;
  readonly shellsSpawned: number;
  readonly starsCollected: number;
  readonly score: number;
  readonly thinkingCharges: number;
  readonly thinkingMsRemaining: number;
  readonly stepAccumulatorMs: number;
  readonly spawnCursor: number;
  /** Internal deterministic random state used for item/map placement. */
  readonly randomSeed?: number;
}

/** Options for a reproducible session. Passing a seed also selects a map. */
export interface CreateGameStateOptions {
  readonly seed?: number | string;
  readonly rocks?: ReadonlyArray<Position>;
}

export type StepEvent =
  'waiting' | 'moved' | 'collected-star' | 'collected-shell' | 'collision' | 'won';

export interface TickResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<StepEvent>;
}
