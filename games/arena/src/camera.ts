export interface CameraActor {
  x: number;
  width: number;
  finished: boolean;
}

export function frameActors(
  worldWidth: number,
  viewportWidth: number,
  actors: readonly CameraActor[],
) {
  const active = actors.filter((actor) => !actor.finished);
  const targets = active.length ? active : actors.slice(0, 1);
  const minimum = Math.min(worldWidth, viewportWidth);
  if (!targets.length) return { x: 0, width: minimum };
  if (targets.length === 1) {
    const actor = targets[0]!;
    return {
      x: Math.max(0, Math.min(worldWidth - minimum, actor.x - minimum * 0.35)),
      width: minimum,
    };
  }
  const left = Math.min(...targets.map((actor) => actor.x));
  const right = Math.max(...targets.map((actor) => actor.x + actor.width));
  const width = Math.min(worldWidth, Math.max(minimum, right - left + 240));
  return {
    x: Math.max(0, Math.min(worldWidth - width, (left + right - width) / 2)),
    width,
  };
}
