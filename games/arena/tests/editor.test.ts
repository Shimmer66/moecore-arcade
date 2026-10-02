import { expect, it } from 'vitest';
import {
  createTrap,
  decodeRoom,
  editorProblem,
  encodeRoom,
  newDraft,
  normalizeRoom,
  EFFECT_NAMES,
} from '../src/editor';

it('round trips every supported trap without importing identity or executable fields', () => {
  for (const effect of Object.keys(EFFECT_NAMES) as (keyof typeof EFFECT_NAMES)[]) {
    const room = newDraft();
    room.traps = [createTrap(effect, 400, 260, 'one')];
    const imported = decodeRoom(encodeRoom(room));
    expect(imported.traps[0]?.effect).toBe(effect);
    expect(imported.id).toBe('custom-room');
    expect(editorProblem(imported)).toBe('');
  }
  const room = normalizeRoom({
    ...newDraft(),
    id: 'hallucination',
    script: 'bad',
    imageUrl: 'remote',
  });
  expect(room.id).toBe('custom-room');
  expect('script' in room).toBe(false);
  expect('imageUrl' in room).toBe(false);
});
it('rejects oversized malformed or cyclic content before runtime', () => {
  expect(() => decodeRoom('x'.repeat(64001))).toThrow();
  expect(() => decodeRoom('{"format":"other","version":1}')).toThrow();
  expect(() =>
    normalizeRoom({ ...newDraft(), floors: Array(81).fill({ x: 0, y: 0, w: 1, h: 1 }) }),
  ).toThrow();
  const room = newDraft();
  room.traps = [createTrap('pit', 400, 350, 'one')];
  room.traps[0]!.after = 'one';
  expect(editorProblem(room)).toContain('依赖');
  room.traps = [];
  room.spawn.y = 200;
  expect(editorProblem(room)).toContain('脚下');
});
it('validates timing numbers instead of allowing non-finite clocks', () => {
  const room = newDraft();
  room.traps = [createTrap('gate', 400, 100, 'one')];
  room.traps[0]!.delay = Infinity;
  expect(editorProblem(room)).not.toBe('');
});
it('retains landing triggers and hazards present before their movement is triggered', () => {
  const room = newDraft();
  room.traps = [
    { ...createTrap('spikes', 450, 324, 'moving'), triggerOn: 'land', initiallyActive: true },
  ];
  const restored = decodeRoom(encodeRoom(room));
  expect(restored.traps[0]).toMatchObject({ triggerOn: 'land', initiallyActive: true });
});
it('round trips supported clone spawns and rejects unbounded or unsupported copies', () => {
  const room = { ...newDraft(), cloneSpawns: [{ x: 150, y: 306 }] };
  expect(decodeRoom(encodeRoom(room)).cloneSpawns).toEqual(room.cloneSpawns);
  expect(editorProblem(room)).toBe('');
  expect(editorProblem({ ...room, cloneSpawns: [{ x: 150, y: 100 }] })).toContain('脚下');
  expect(() =>
    normalizeRoom({ ...room, cloneSpawns: Array(4).fill(room.cloneSpawns[0]) }),
  ).toThrow();
});
