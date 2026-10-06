import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioCue, SWORD_RECORDINGS } from '../src/audio/cues';
import { createStardustAudioEngine } from '../src/audio/engine';
import type { StardustAudioEvent } from '../src/audio/types';

afterEach(() => vi.unstubAllGlobals());

describe('stardust audio cues', () => {
  const events: StardustAudioEvent[] = [
    'select',
    'confirm',
    'summon',
    'panel',
    'fight',
    'step',
    'idle',
    'light-swing',
    'light-hit',
    'heavy-swing',
    'heavy-hit',
    'blade-swing',
    'blade-ultimate',
    'blade-finish',
    'barrage',
    'special',
    'block',
    'hurt',
    'down',
    'ko',
    'revive',
    'next-fighter',
    'team-clear',
    'time-stop',
    'time-resume',
  ];

  it('maps every supported event to at least one playable layer', () => {
    for (const event of events) {
      const cue = audioCue(event, 'jotaro');
      expect(cue.layers.length, event).toBeGreaterThan(0);
      expect(
        cue.layers.every((layer) => layer.duration > 0 && layer.gain > 0),
        event,
      ).toBe(true);
    }
  });

  it('keeps idle feedback on the ambience bus', () => {
    expect(audioCue('idle', 'avdol').category).toBe('ambience');
    expect(audioCue('step', 'avdol').category).toBe('sfx');
  });

  it('gives signature characters distinct hit accents', () => {
    expect(audioCue('heavy-hit', 'kakyoin')).not.toEqual(audioCue('heavy-hit', 'avdol'));
    expect(audioCue('barrage', 'jotaro')).not.toEqual(audioCue('barrage', 'dio'));
  });

  it('uses selected recording #2 for light attacks and #5 for heavy and ultimate attacks', () => {
    for (const event of ['light-swing', 'blade-swing'] as const) {
      expect(audioCue(event, 'polnareff')).toMatchObject({
        category: 'sfx',
        layers: [],
        recording: { src: SWORD_RECORDINGS.light },
      });
    }
    for (const event of ['heavy-swing', 'special', 'blade-ultimate', 'blade-finish'] as const) {
      expect(audioCue(event, 'polnareff')).toMatchObject({
        category: 'sfx',
        layers: [],
        recording: { src: SWORD_RECORDINGS.heavy },
      });
    }
    expect(audioCue('blade-finish', 'polnareff').recording?.restart).toBe(true);
    expect(audioCue('light-hit', 'polnareff').layers).toEqual([]);
    expect(audioCue('light-swing', 'jotaro').recording).toBeUndefined();
  });
});

describe('stardust audio engine', () => {
  it('renders reusable noise and bounds rapid sword bursts even before onended callbacks run', () => {
    const param = () => ({
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const sources: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
    const buffers: Float32Array[] = [];
    const source = () => {
      const node = {
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        frequency: param(),
      };
      sources.push(node);
      return node;
    };
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running';
        currentTime = 0;
        sampleRate = 48000;
        destination = {};
        createOscillator = source;
        createBufferSource = source;
        createGain = () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() });
        createBiquadFilter = () => ({
          Q: { value: 0 },
          frequency: param(),
          connect: vi.fn(),
          disconnect: vi.fn(),
        });
        createBuffer(_channels: number, length: number) {
          const data = new Float32Array(length);
          buffers.push(data);
          return { getChannelData: () => data };
        }
        close = vi.fn().mockResolvedValue(undefined);
      },
    );
    const engine = createStardustAudioEngine();
    for (let hit = 0; hit < 25; hit++) engine.play(audioCue('blade-swing'), 1);
    expect(buffers).toHaveLength(1);
    expect(buffers[0]!.some((sample) => sample !== 0)).toBe(true);
    expect(sources).toHaveLength(75);
    expect(sources.every((node) => node.start.mock.calls.length === 1)).toBe(true);
    expect(
      sources.filter((node) => !node.stop.mock.calls.some((call) => call.length === 0)).length,
    ).toBeLessThanOrEqual(32);
    engine.close();
  });
  it('does not create an AudioContext while muted', () => {
    const context = vi.fn();
    vi.stubGlobal('AudioContext', context);
    const engine = createStardustAudioEngine();
    engine.play(audioCue('light-hit', 'jotaro'), 0);
    expect(context).not.toHaveBeenCalled();
    engine.close();
  });
});
