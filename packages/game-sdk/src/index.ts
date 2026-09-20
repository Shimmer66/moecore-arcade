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
  readonly summary: string;
  readonly stats: Readonly<Record<string, number>>;
}

export interface GameStorage {
  read(key: string): JsonValue | undefined;
  write(key: string, value: JsonValue): void;
}

export interface GameProps {
  readonly sessionId: string;
  readonly paused: boolean;
  readonly settings: Readonly<GameSettings>;
}

export type GameEvents = {
  finish: [result: GameResult];
  exit: [];
};

export interface GameDefinition {
  readonly id: string;
  readonly title: string;
  readonly component: Component;
}
import type { Component } from 'vue';
