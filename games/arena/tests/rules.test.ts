import { describe, it, expect } from 'vitest';
import {
  createState,
  start,
  step,
  undo,
  nextLevel,
  platforms,
  collected,
  FLOOR,
  type State,
} from '../src/rules';
function frames(s: State, n: number, h = 0, jump = false) {
  for (let i = 0; i < n; i++) s = step(s, { horizontal: h, jump: jump && i === 0 });
  return s;
}
describe('generated-world platform rules', () => {
  it('waits for an explicit start and refuses terminal-state movement', () => {
    const s = createState();
    expect(step(s, { horizontal: 1, jump: true })).toBe(s);
    expect(undo(s)).toBe(s);
    expect(nextLevel(s)).toBe(s);
  });
  it('moves, jumps and lands without falling through the starting floor', () => {
    let s = start(createState());
    s = frames(s, 1, 0, true);
    expect(s.player.y).toBeLessThan(FLOOR - 48);
    s = frames(s, 80);
    expect(s.player.grounded).toBe(true);
    expect(s.player.y).toBe(FLOOR - 48);
  });
  it('telegraphs the first event before removing the bridge', () => {
    let s = frames(start(createState()), 43, 1);
    expect(s.glitch).toBe('warning');
    expect(platforms(s).some((p) => p.kind === 'bridge')).toBe(true);
    s = frames(s, 60);
    expect(s.glitch).toBe('active');
    expect(platforms(s).some((p) => p.kind === 'bridge')).toBe(false);
    expect(s.accidents).toBe(1);
  });
  it('freezes a fall, repairs the bridge and preserves collected stars during rescue', () => {
    const s = frames(start(createState()), 180, 1);
    expect(s.phase).toBe('rescue');
    expect(frames(s, 120, 1)).toBe(s);
    const restored = undo(s);
    expect(restored.phase).toBe('playing');
    expect(restored.glitch).toBe('fixed');
    expect(restored.stars).toEqual(s.stars);
    expect(restored.player.y).toBeLessThan(354);
    expect(restored.rescues).toBe(1);
    expect(platforms(restored).some((p) => p.kind === 'bridge')).toBe(true);
  });
  it('uses inverted gravity for a bonus and safely restores normal gravity', () => {
    let s = { ...start(createState()), level: 1 };
    s = frames(s, 108, 1);
    s = frames(s, 90);
    expect(s.glitch).toBe('active');
    expect(s.player.y).toBeLessThan(100);
    expect(s.stars[1]).toBe(true);
    s = undo(s);
    s = frames(s, 90);
    expect(s.player.grounded).toBe(true);
    expect(s.player.y).toBe(FLOOR - 48);
  });
  it('restores the disappearing floor after a correction', () => {
    let s = { ...start(createState()), level: 2 };
    s = frames(s, 110, 1);
    s = frames(s, 100);
    expect(s.glitch).toBe('active');
    expect(platforms(s).filter((p) => p.kind === 'floor').length).toBeLessThan(10);
    s = undo(s);
    expect(platforms(s).filter((p) => p.kind === 'floor')).toHaveLength(10);
  });
  it('requires two stars for the exit', () => {
    const s = start(createState());
    const atExit = { ...s, player: { ...s.player, x: 940 }, glitch: 'fixed' as const };
    expect(step(atExit, { horizontal: 0, jump: false }).phase).toBe('playing');
    expect(
      step({ ...atExit, stars: [true, true, false] }, { horizontal: 0, jump: false }).phase,
    ).toBe('clear');
  });
  it('can clear all three rooms using only movement, jumps and corrections', () => {
    let s = start(createState());
    for (let room = 0; room < 3; room++) {
      for (let i = 0; i < 1500 && s.phase !== 'clear'; i++) {
        if (s.phase === 'rescue') s = undo(s);
        if (s.glitch === 'active' && (room !== 1 || s.stars[1])) s = undo(s);
        const waitForUpper =
          room === 1 && s.glitch === 'active' && s.player.x >= 510 && !s.stars[1];
        const jump =
          s.player.grounded &&
          ((room === 0 && s.player.x > 690 && s.player.x < 810) ||
            (room === 2 && s.player.x > 390 && s.player.x < 850));
        s = step(s, { horizontal: waitForUpper ? 0 : 1, jump });
      }
      expect(s.phase, `room ${room + 1}`).toBe('clear');
      expect(collected(s)).toBeGreaterThanOrEqual(2);
      s = nextLevel(s);
    }
    expect(s.phase).toBe('done');
    expect(s.bankedStars + collected(s)).toBeGreaterThanOrEqual(6);
  });
});
