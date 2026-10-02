import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  advanceLevel,
  createRun,
  FIXED_DT,
  retryLevel,
  shareLife,
  stepRun,
  weaponOrder,
  type Difficulty,
  type RunInput,
} from '../src/rules';

export function decodeInput(mask: number): RunInput {
  return {
    horizontal: mask & 1 ? -1 : mask & 2 ? 1 : 0,
    vertical: mask & 4 ? 1 : mask & 8 ? -1 : 0,
    shoot: !!(mask & 16),
    jump: !!(mask & 32),
    grenade: !!(mask & 64),
    lockAim: !!(mask & 128),
    equipWeapon: weaponOrder.find((_, i) => !!(mask & (256 << i))),
  };
}
describe('recorded eight-stage campaigns', () => {
  for (const difficulty of ['normal', 'classic', 'hard'] as Difficulty[])
    for (const duo of [false, true]) {
      it(`${difficulty} ${duo ? 'co-op' : 'solo'} reaches the real ending with finite lives and continues`, () => {
        const replay = JSON.parse(
          readFileSync(
            new URL(`./replays/${difficulty}-${duo ? 'duo' : 'solo'}.json`, import.meta.url),
            'utf8',
          ),
        );
        expect(replay.schema).toBe(2);
        let s = createRun('deepseek', 0, difficulty, duo ? 'deepseek' : undefined);
        const cleared: number[] = [];
        for (const [count, a, b] of replay.tape as [number, number, number][]) {
          if (a === -1) {
            expect(s.phase).toBe('level-complete');
            cleared.push(s.levelIndex);
            s = advanceLevel(s);
            continue;
          }
          if (a === -2) {
            expect(s.phase).toBe('lost');
            expect(s.continues).toBeGreaterThan(0);
            s = retryLevel(s);
            continue;
          }
          if (a === -3 || a === -4) {
            const next = shareLife(s, a === -3 ? 1 : 2);
            expect(next).not.toBe(s);
            s = next;
            continue;
          }
          expect(Number.isInteger(count) && count > 0).toBe(true);
          // Jump and grenade are press events, not keyboard auto-repeat.
          if (count > 1) expect((a | b) & (32 | 64)).toBe(0);
          const p1 = decodeInput(a),
            p2 = decodeInput(b);
          for (let tick = 0; tick < count; tick++) {
            expect(s.phase).toBe('running');
            s = stepRun(s, p1, FIXED_DT, p2);
          }
        }
        expect(cleared).toEqual([0, 1, 2, 3, 4, 5, 6]);
        expect(s.phase).toBe('won');
        expect(s.levelIndex).toBe(7);
        expect(Math.round(s.elapsed / FIXED_DT)).toBe(replay.expectation.ticks);
        expect(s.deaths).toBe(replay.expectation.deaths);
        expect(s.continues).toBe(replay.expectation.continuesRemaining);
        expect(s.lives + (s.partner?.lives ?? 0)).toBeGreaterThan(0);
      });
    }
});
