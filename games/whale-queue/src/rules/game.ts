import type {
  CreateGameStateOptions,
  Direction,
  GameState,
  Position,
  StepEvent,
  TickResult,
} from './types';

export const BOARD_SIZE = 16;
export const TARGET_STARS = 30;
export const STAR_SCORE = 10;
export const INITIAL_QUEUE_LENGTH = 3;
export const MIN_QUEUE_LENGTH = 3;
export const NORMAL_STEP_MS = 200;
export const THINKING_STEP_MS = 400;
export const THINKING_DURATION_MS = 3_000;

/** Fixed obstacles leave a clear opening for the initial three-cell queue. */
export const DEFAULT_ROCKS: ReadonlyArray<Position> = [
  { row: 3, column: 5 },
  { row: 5, column: 11 },
  { row: 10, column: 4 },
  { row: 11, column: 11 },
];

/**
 * A small pool of handcrafted layouts. Every layout keeps the opening lane
 * clear for the initial queue, while putting the rest of the rocks in a
 * different pattern so a fresh session feels a little less predictable.
 */
export const MAP_VARIANTS: ReadonlyArray<ReadonlyArray<Position>> = [
  DEFAULT_ROCKS,
  [
    { row: 3, column: 3 },
    { row: 3, column: 12 },
    { row: 6, column: 8 },
    { row: 11, column: 4 },
    { row: 12, column: 12 },
  ],
  [
    { row: 2, column: 8 },
    { row: 5, column: 3 },
    { row: 6, column: 12 },
    { row: 10, column: 7 },
    { row: 13, column: 4 },
    { row: 13, column: 12 },
  ],
  [
    { row: 3, column: 6 },
    { row: 3, column: 9 },
    { row: 7, column: 2 },
    { row: 7, column: 13 },
    { row: 11, column: 6 },
    { row: 11, column: 9 },
  ],
];

const DIRECTIONS: Readonly<Record<Direction, Position>> = {
  up: { row: -1, column: 0 },
  right: { row: 0, column: 1 },
  down: { row: 1, column: 0 },
  left: { row: 0, column: -1 },
};

const OPPOSITE: Readonly<Record<Direction, Direction>> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.column === b.column;
}

function positionAt(index: number): Position {
  return { row: Math.floor(index / BOARD_SIZE), column: index % BOARD_SIZE };
}

function inside(position: Position): boolean {
  return (
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.column >= 0 &&
    position.column < BOARD_SIZE
  );
}

function hasPosition(positions: ReadonlyArray<Position>, position: Position): boolean {
  return positions.some((candidate) => samePosition(candidate, position));
}

const UINT32_SIZE = 4_294_967_296;
const RANDOM_FALLBACK = 0x6d2b79f5;

function hashSeed(seed: number | string): number {
  const text = `whale-queue:${seed}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
  }
  return hash >>> 0;
}

function initialSeed(seed: number | string | undefined): number {
  if (seed !== undefined) return hashSeed(seed) || RANDOM_FALLBACK;
  return Math.floor(Math.random() * UINT32_SIZE) >>> 0 || RANDOM_FALLBACK;
}

function nextRandom(seed: number): { readonly value: number; readonly seed: number } {
  // Mulberry32 keeps the game deterministic from a session seed while storing
  // only one uint32 in GameState (no mutable RNG object in the render loop).
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let value = Math.imul(nextSeed ^ (nextSeed >>> 15), nextSeed | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return {
    value: ((value ^ (value >>> 14)) >>> 0) / UINT32_SIZE,
    seed: nextSeed,
  };
}

function spawn(
  state: Pick<GameState, 'segments' | 'rocks' | 'star' | 'shells' | 'spawnCursor' | 'randomSeed'>,
): {
  readonly position: Position | null;
  readonly cursor: number;
  readonly randomSeed: number;
} {
  const occupied = [...state.segments, ...state.rocks];
  if (state.star) occupied.push(state.star);
  occupied.push(...state.shells);
  const available: Position[] = [];
  for (let cursor = 0; cursor < BOARD_SIZE * BOARD_SIZE; cursor += 1) {
    const position = positionAt(cursor);
    if (!hasPosition(occupied, position)) available.push(position);
  }
  const random = nextRandom(state.randomSeed ?? state.spawnCursor ?? RANDOM_FALLBACK);
  if (available.length === 0) {
    return { position: null, cursor: state.spawnCursor, randomSeed: random.seed };
  }
  const index = Math.min(available.length - 1, Math.floor(random.value * available.length));
  return {
    position: available[index]!,
    cursor: (state.spawnCursor + 1) % (BOARD_SIZE * BOARD_SIZE),
    randomSeed: random.seed,
  };
}

function fillItems(state: GameState): GameState {
  let next = state;
  if (!next.star && next.status === 'playing') {
    const star = spawn(next);
    if (star.position) {
      next = {
        ...next,
        star: star.position,
        spawnCursor: star.cursor,
        randomSeed: star.randomSeed,
      };
    } else {
      next = { ...next, randomSeed: star.randomSeed };
    }
  }
  while (next.shellRequests > 0 && next.shellsSpawned < 2) {
    const shell = spawn(next);
    if (!shell.position) break;
    next = {
      ...next,
      shells: [...next.shells, shell.position],
      shellRequests: next.shellRequests - 1,
      shellsSpawned: next.shellsSpawned + 1,
      spawnCursor: shell.cursor,
      randomSeed: shell.randomSeed,
    };
  }
  return next;
}

function moveOne(state: GameState): { readonly state: GameState; readonly event: StepEvent } {
  if (state.status !== 'playing') return { state, event: 'waiting' };

  const direction = state.pendingDirection ?? state.direction;
  const delta = DIRECTIONS[direction];
  const head = state.segments[0]!;
  const nextHead = { row: head.row + delta.row, column: head.column + delta.column };
  const foundStar = state.star !== null && samePosition(nextHead, state.star);
  const foundShell = state.shells.some((shell) => samePosition(nextHead, shell));
  const tailVacates = !foundStar;
  const bodyToCheck = tailVacates ? state.segments.slice(0, -1) : state.segments;

  if (
    !inside(nextHead) ||
    hasPosition(state.rocks, nextHead) ||
    hasPosition(bodyToCheck, nextHead)
  ) {
    return { state: { ...state, status: 'lost', pendingDirection: null }, event: 'collision' };
  }

  const moved = [nextHead, ...state.segments];
  let segments = foundStar ? moved : moved.slice(0, -1);
  let starsCollected = state.starsCollected;
  let score = state.score;
  let thinkingCharges = state.thinkingCharges;
  let shellRequests = state.shellRequests;
  let shells = state.shells;
  let star = state.star;
  let event: StepEvent = 'moved';

  if (foundStar) {
    starsCollected += 1;
    score += STAR_SCORE;
    star = null;
    if (starsCollected % 5 === 0 && thinkingCharges === 0) thinkingCharges = 1;
    if (starsCollected === 10 || starsCollected === 20) shellRequests += 1;
    event = 'collected-star';
  }
  if (foundShell) {
    shells = shells.filter((shell) => !samePosition(shell, nextHead));
    segments = segments.slice(0, Math.max(MIN_QUEUE_LENGTH, segments.length - 3));
    event = 'collected-shell';
  }

  let next: GameState = {
    ...state,
    direction,
    pendingDirection: null,
    segments,
    shells,
    shellsSpawned: state.shellsSpawned,
    shellRequests,
    star,
    starsCollected,
    score,
    thinkingCharges,
  };
  if (starsCollected >= TARGET_STARS) {
    next = { ...next, status: 'won', star: null, shellRequests: 0 };
    return { state: next, event: 'won' };
  }
  next = fillItems(next);
  return { state: next, event };
}

export function createGameState(
  rocksOrOptions?: ReadonlyArray<Position> | CreateGameStateOptions,
  legacySeed?: number | string,
): GameState {
  const options = Array.isArray(rocksOrOptions)
    ? undefined
    : (rocksOrOptions as CreateGameStateOptions);
  const seed = legacySeed ?? options?.seed;
  let randomSeed = initialSeed(seed);
  let rocks: ReadonlyArray<Position>;
  if (Array.isArray(rocksOrOptions)) {
    rocks = rocksOrOptions;
  } else if (options?.rocks) {
    rocks = options.rocks;
  } else {
    const mapRoll = nextRandom(randomSeed);
    randomSeed = mapRoll.seed;
    rocks = MAP_VARIANTS[Math.floor(mapRoll.value * MAP_VARIANTS.length)] ?? DEFAULT_ROCKS;
  }
  const initial: GameState = {
    status: 'playing',
    direction: 'right',
    pendingDirection: null,
    segments: [
      { row: 8, column: 4 },
      { row: 8, column: 3 },
      { row: 8, column: 2 },
    ],
    rocks: rocks.map(({ row, column }) => ({ row, column })),
    star: null,
    shells: [],
    shellRequests: 0,
    shellsSpawned: 0,
    starsCollected: 0,
    score: 0,
    thinkingCharges: 0,
    thinkingMsRemaining: 0,
    stepAccumulatorMs: 0,
    // Kept for save compatibility; randomSeed now chooses a free cell instead
    // of walking a fixed cursor through the board.
    spawnCursor: 0,
    randomSeed,
  };
  return fillItems(initial);
}

export function queueDirection(state: GameState, direction: Direction): GameState {
  if (state.status !== 'playing' || direction === OPPOSITE[state.direction]) return state;
  return { ...state, pendingDirection: direction };
}

export function useThinking(state: GameState): GameState {
  if (state.status !== 'playing' || state.thinkingCharges < 1 || state.thinkingMsRemaining > 0)
    return state;
  return {
    ...state,
    thinkingCharges: state.thinkingCharges - 1,
    thinkingMsRemaining: THINKING_DURATION_MS,
  };
}

/** Advance elapsed real time; pause by skipping this call while the host is paused. */
export function tick(state: GameState, elapsedMs: number): TickResult {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new RangeError('elapsedMs must be >= 0');
  if (state.status !== 'playing' || elapsedMs === 0) return { state, events: [] };

  let next = state;
  let remaining = elapsedMs;
  let events: StepEvent[] = [];
  while (remaining > 0 && next.status === 'playing') {
    const interval = next.thinkingMsRemaining > 0 ? THINKING_STEP_MS : NORMAL_STEP_MS;
    const untilStep = interval - next.stepAccumulatorMs;
    const slice = Math.min(remaining, untilStep);
    next = {
      ...next,
      stepAccumulatorMs: next.stepAccumulatorMs + slice,
      thinkingMsRemaining: Math.max(0, next.thinkingMsRemaining - slice),
    };
    remaining -= slice;
    if (next.stepAccumulatorMs >= interval) {
      next = { ...next, stepAccumulatorMs: next.stepAccumulatorMs - interval };
      const moved = moveOne(next);
      next = moved.state;
      events = [...events, moved.event];
    }
  }
  return { state: next, events };
}

export function step(state: GameState): TickResult {
  return tick(state, state.thinkingMsRemaining > 0 ? THINKING_STEP_MS : NORMAL_STEP_MS);
}
