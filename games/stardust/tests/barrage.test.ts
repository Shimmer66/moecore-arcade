import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceBarrage,
  advanceBarrageHit,
  BARRAGE_DURATION_MS,
  BARRAGE_HIT_INTERVAL_MS,
  BARRAGE_VOICE_INTERVAL_MS,
  BARRAGE_VOICE_VOLUME,
  BARRAGE_VOICE_SOURCES,
  createBarrageVoicePlayer,
} from '../src/barrage';

afterEach(() => vi.unstubAllGlobals());

describe('barrage cadence', () => {
  it('schedules 16 follow-up hits independently of voice playback and stops at expiry', () => {
    const clock = {
      barrageMs: BARRAGE_DURATION_MS,
      barrageVoiceMs: 20_000,
      barrageHitMs: BARRAGE_HIT_INTERVAL_MS,
    };
    const hits: number[] = [];
    for (let elapsed = 10; elapsed <= 10_000; elapsed += 10) {
      expect(advanceBarrage(clock, 10)).toBe(false);
      if (advanceBarrageHit(clock, 10)) hits.push(elapsed);
    }
    expect(hits).toEqual(Array.from({ length: 16 }, (_, index) => (index + 1) * 600));
    expect(advanceBarrageHit(clock, 300)).toBe(false);
  });

  it('keeps the 10-second game clock and its 300ms scheduling pulses', () => {
    const clock = {
      barrageMs: BARRAGE_DURATION_MS,
      barrageVoiceMs: BARRAGE_VOICE_INTERVAL_MS,
    };
    const triggers = [0];
    for (let elapsed = 10; elapsed <= 10_000; elapsed += 10) {
      if (advanceBarrage(clock, 10)) triggers.push(elapsed);
    }
    expect(triggers).toEqual(Array.from({ length: 34 }, (_, index) => index * 300));
    expect(clock.barrageMs).toBe(0);
  });
});

describe('barrage voice', () => {
  function speech() {
    const synthesis = { cancel: vi.fn(), speak: vi.fn() };
    vi.stubGlobal('window', { speechSynthesis: synthesis });
    vi.stubGlobal(
      'SpeechSynthesisUtterance',
      class {
        constructor(public text: string) {}
      },
    );
    return synthesis;
  }

  it('lets fallback phrases finish without interrupting or queueing them', () => {
    const synthesis = speech();
    const player = createBarrageVoicePlayer({ jotaro: null, dio: null });
    player.play('jotaro', 0.7);
    player.play('dio', 0.7);
    player.play('jotaro', 0.7);
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    synthesis.speak.mock.calls[0]![0].onend();
    player.play('dio', 0.7);
    expect(synthesis.speak.mock.calls.map(([utterance]) => utterance.text)).toEqual([
      '欧拉欧拉欧拉',
      '木大木大木大',
    ]);
    expect(synthesis.cancel).not.toHaveBeenCalled();
    player.play('dio', 0);
    expect(synthesis.speak).toHaveBeenCalledTimes(2);
    player.stop();
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
  });

  it('plays whole phrases without resetting and stops each actor independently', async () => {
    const synthesis = speech();
    const clips: FakeAudio[] = [];
    class FakeAudio {
      currentTime = 12;
      volume = 1;
      paused = false;
      onended: (() => void) | null = null;
      pause = vi.fn(() => {
        this.paused = true;
      });
      play = vi.fn().mockResolvedValue(undefined);
      constructor(public src: string) {
        clips.push(this);
      }
    }
    vi.stubGlobal('Audio', FakeAudio);
    const player = createBarrageVoicePlayer();
    player.play('jotaro', 0.6);
    player.play('dio', 0.4);
    clips[0]!.currentTime = 0.9;
    player.play('jotaro', 0.6);
    expect(clips.map((clip) => clip.src)).toEqual([
      BARRAGE_VOICE_SOURCES.jotaro,
      BARRAGE_VOICE_SOURCES.dio,
    ]);
    expect(clips[0]!.play).toHaveBeenCalledTimes(1);
    expect(clips[1]!.play).toHaveBeenCalledTimes(1);
    expect(clips[0]!.currentTime).toBe(0.9);
    expect(clips[0]!.volume).toBe(0.6 * BARRAGE_VOICE_VOLUME);
    expect(synthesis.speak).not.toHaveBeenCalled();
    clips[0]!.onended?.();
    player.play('jotaro', 0.6);
    expect(clips[0]!.play).toHaveBeenCalledTimes(2);
    expect(clips[0]!.currentTime).toBe(0);
    player.stop('jotaro');
    expect(clips[0]!.pause).toHaveBeenCalledTimes(1);
    expect(clips[1]!.pause).not.toHaveBeenCalled();
    clips[0]!.play.mockRejectedValueOnce(new Error('missing'));
    player.play('jotaro', 0.6);
    await Promise.resolve();
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    player.stop();
    expect(synthesis.cancel).toHaveBeenCalledTimes(1);
    clips[0]!.play.mockRejectedValueOnce(new Error('late rejection'));
    player.play('jotaro', 0.6);
    player.stop();
    await Promise.resolve();
    expect(synthesis.speak).toHaveBeenCalledTimes(1);
    expect(clips.every((clip) => clip.currentTime === 0)).toBe(true);
  });
});
