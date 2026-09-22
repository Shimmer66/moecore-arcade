import { describe, expect, it } from 'vitest';
import { Game, levels, plan } from '../src/rules';

describe('sokoban rules', () => {
  it('loads five authored levels with escalating difficulty', () => {
    expect(levels).toHaveLength(5);
    expect(levels.map((level) => level.difficulty)).toEqual([
      '简单',
      '适中',
      '困难',
      '困难',
      '困难',
    ]);
    for (const level of levels) {
      const game = new Game(level);
      for (const direction of level.solution) game.move(direction as 'N' | 'E' | 'S' | 'W');
      expect(game.won, `solution for level ${level.id}`).toBe(true);
    }
  });

  it('moves and pushes the first level to its goal', () => {
    const game = new Game(levels[0]!);
    for (const direction of levels[0]!.solution) game.move(direction as 'N' | 'E' | 'S' | 'W');
    expect(game.won).toBe(true);
    expect(game.snapshot().pushes).toBe(2);
    expect(game.undo()).toBe(true);
    expect(game.won).toBe(false);
  });

  it('plans a walk and keeps remote box pushes explicit', () => {
    const game = new Game(levels[0]!);
    expect(plan(game, 10).type).toBe('walk');
    expect(plan(game, 10).directions.length).toBeGreaterThan(0);
    expect(plan(game, 17).type).toBe('box-too-far');
  });
});
