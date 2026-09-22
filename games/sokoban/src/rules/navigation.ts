import type { Direction, NavigationPlan } from './types';
import type { Game } from './engine';

const STEPS: readonly { direction: Direction; x: number; y: number }[] = [
  { direction: 'N', x: 0, y: -1 },
  { direction: 'E', x: 1, y: 0 },
  { direction: 'S', x: 0, y: 1 },
  { direction: 'W', x: -1, y: 0 },
];

export function plan(game: Game, targetCell: number): NavigationPlan {
  const size = game.width * game.height;
  const result = (
    type: NavigationPlan['type'],
    directions: readonly Direction[] = [],
  ): NavigationPlan => ({
    type,
    directions,
    target: targetCell,
  });
  const neighbor = (cell: number, step: (typeof STEPS)[number]): number => {
    const x = (cell % game.width) + step.x;
    const y = Math.floor(cell / game.width) + step.y;
    return x < 0 || x >= game.width || y < 0 || y >= game.height ? -1 : y * game.width + x;
  };
  const open = (cell: number): boolean =>
    cell >= 0 && !game.walls.has(cell) && !game.boxes.has(cell);
  if (!Number.isInteger(targetCell) || targetCell < 0 || targetCell >= size)
    return result('invalid');
  if (game.walls.has(targetCell)) return result('blocked');
  if (game.boxes.has(targetCell)) {
    for (const step of STEPS) {
      if (neighbor(game.player, step) === targetCell)
        return open(neighbor(targetCell, step))
          ? result('push', [step.direction])
          : result('blocked');
    }
    return result('box-too-far');
  }
  if (targetCell === game.player) return result('walk');
  const previous = new Int32Array(size).fill(-1);
  const directions: Array<Direction | undefined> = new Array(size);
  const queue = new Int32Array(size);
  let head = 0;
  let tail = 1;
  queue[0] = game.player;
  previous[game.player] = game.player;
  while (head < tail) {
    const cell = queue[head++] ?? -1;
    for (const step of STEPS) {
      const next = neighbor(cell, step);
      if (!open(next) || previous[next] !== -1) continue;
      previous[next] = cell;
      directions[next] = step.direction;
      if (next === targetCell) {
        const path: Direction[] = [];
        for (
          let cursor = targetCell;
          cursor !== game.player;
          cursor = previous[cursor] ?? game.player
        ) {
          const direction = directions[cursor];
          if (direction) path.push(direction);
        }
        path.reverse();
        return result('walk', path);
      }
      queue[tail++] = next;
    }
  }
  return result('blocked');
}
