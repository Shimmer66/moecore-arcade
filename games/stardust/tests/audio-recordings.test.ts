import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioCue, SWORD_RECORDINGS } from '../src/audio/cues';
import { createStardustAudioEngine } from '../src/audio/engine';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
  const audio = {
    state: 'running',
    decodeAudioData: vi.fn().mockResolvedValue({ duration: 1 }),
    createBufferSource: () => {
      const node = { start: vi.fn(), stop: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
      sources.push(node);
      return node;
    },
    createGain: () => ({ gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() }),
    destination: {},
    suspend: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return audio;
    }),
  );
  const response = { ok: true, arrayBuffer: async () => new ArrayBuffer(2) };
  const fetcher = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetcher);
  return { sources, audio, fetcher, response, engine: createStardustAudioEngine() };
}

describe('recorded sword sound lifecycle', () => {
  it('preloads once and bounds overlap without changing recording pitch', async () => {
    const { engine, fetcher, sources } = setup();
    const cue = audioCue('light-swing', 'polnareff');
    await engine.preload([cue, cue]);
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(SWORD_RECORDINGS.light);
    for (let index = 0; index < 6; index++) engine.play(cue, 1);
    expect(sources).toHaveLength(6);
    expect(sources.every((source) => source.start.mock.calls.length === 1)).toBe(true);
    expect(sources.filter((source) => source.stop.mock.calls.length === 0)).toHaveLength(4);
    engine.stop();
    expect(sources.every((source) => source.stop.mock.calls.length >= 1)).toBe(true);
  });

  it('drops delayed hits when paused and plays cached sounds only after resuming', async () => {
    const { engine, fetcher, sources, response } = setup();
    let complete!: (response: unknown) => void;
    fetcher.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const cue = audioCue('heavy-swing', 'polnareff');
    engine.play(cue, 1);
    engine.suspend();
    complete(response);
    await engine.preload([cue]);
    expect(sources).toHaveLength(0);
    engine.play(cue, 1);
    expect(sources).toHaveLength(0);
    engine.resume();
    engine.play(cue, 1);
    expect(sources).toHaveLength(1);
  });

  it('stops the prior heavy sample for the finisher and ignores muted playback', async () => {
    const { engine, sources } = setup();
    const heavy = audioCue('heavy-swing', 'polnareff');
    await engine.preload([heavy]);
    engine.play(heavy, 0);
    expect(sources).toHaveLength(0);
    engine.play(heavy, 1);
    engine.play(audioCue('blade-finish', 'polnareff'), 1);
    expect(sources[0]!.stop).toHaveBeenCalledOnce();
    expect(sources[1]!.start).toHaveBeenCalledOnce();
    engine.close();
    expect(sources[1]!.stop).toHaveBeenCalledOnce();
  });

  it('handles unavailable audio during preload without failing gameplay', async () => {
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        throw new Error('No device');
      }),
    );
    const engine = createStardustAudioEngine();
    await expect(engine.preload([audioCue('light-swing', 'polnareff')])).resolves.toBeUndefined();
  });
});
