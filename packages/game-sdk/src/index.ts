export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface GameSettings {
  readonly masterVolume: number;
  readonly reduceMotion: boolean;
}

export interface GameResult {
  readonly gameId: string;
  readonly sessionId: string;
  readonly outcome: 'win' | 'lose' | 'draw' | 'completed' | 'aborted';
  readonly durationMs: number;
  readonly stats: Readonly<Record<string, number>>;
}

export interface GameStorage {
  read(key: string): JsonValue | undefined;
  write(key: string, value: JsonValue): void;
}

export interface GameContext {
  readonly sessionId: string;
  readonly signal: AbortSignal;
  readonly settings: Readonly<GameSettings>;
  readonly storage: GameStorage;
  onFinish(result: GameResult): void;
  onExit(): void;
}

export interface GameInstance {
  pause(): void;
  resume(): void;
  resize(width: number, height: number): void;
  updateSettings(settings: Readonly<GameSettings>): void;
  destroy(): void;
}

export interface GameModule {
  readonly id: string;
  readonly title: string;
  mount(container: HTMLElement, context: GameContext): Promise<GameInstance>;
}
