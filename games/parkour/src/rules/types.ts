export interface PlayerInput {
  readonly jump: boolean;
  readonly crouch: boolean;
}

export interface PlayerState {
  readonly y: number;
  readonly velocityY: number;
  readonly grounded: boolean;
  readonly crouching: boolean;
  readonly jumpHeld: boolean;
}

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ObstacleKind = 'ground' | 'air';

export interface Obstacle {
  readonly id: number;
  readonly kind: ObstacleKind;
  readonly x: number;
}

export interface GeneratorState {
  readonly randomState: number;
  readonly nextId: number;
  readonly nextDistance: number;
}

export interface PlayerFrame {
  readonly distance: number;
  readonly player: PlayerState;
}

export type ObstacleOutcome =
  | { readonly kind: 'none' }
  | { readonly kind: 'jumped' | 'ducked'; readonly fraction: number }
  | { readonly kind: 'collision'; readonly fraction: number };

export interface RunEvent {
  readonly obstacleId: number;
  readonly kind: 'jumped' | 'ducked' | 'collision';
}

export type EndReason =
  'ground-collision' | 'air-collision' | 'paper-collision' | 'queue-collision' | 'distance-limit';

export interface RunResult {
  readonly distance: number;
  readonly score: number;
  readonly reason: EndReason;
}

interface RunBase extends PlayerFrame {
  readonly seed: number;
  readonly tick: number;
  readonly finishDistance: number;
  readonly speed: number;
  readonly score: number;
  readonly generator: GeneratorState;
  readonly obstacles: readonly Obstacle[];
  readonly events: readonly RunEvent[];
}

export type RunState =
  | (RunBase & { readonly status: 'running'; readonly result: null })
  | (RunBase & { readonly status: 'ended'; readonly result: RunResult });
