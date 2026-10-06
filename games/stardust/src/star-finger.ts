import { metersToPosition } from './stand-control';

export const STAR_FINGER_RANGE = metersToPosition(12);
export const STAR_FINGER_DURATION_MS = 450;

export function createStarFinger() {
  return { elapsedMs: 0, length: 0, hit: false };
}

export function advanceStarFinger(state: ReturnType<typeof createStarFinger>, dt: number) {
  const previous = state.elapsedMs;
  state.elapsedMs = Math.min(STAR_FINGER_DURATION_MS, state.elapsedMs + Math.max(0, dt));
  const extension = Math.max(0, Math.min(1, (state.elapsedMs - 90) / 180));
  const retraction = Math.max(0, (state.elapsedMs - 270) / 180);
  state.length = STAR_FINGER_RANGE * (extension - retraction);
  return state.elapsedMs > 90 && previous < 270 && !state.hit
    ? STAR_FINGER_RANGE * extension
    : undefined;
}
