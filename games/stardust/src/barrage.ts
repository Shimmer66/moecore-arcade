export const BARRAGE_DURATION_MS = 10_000;
export const BARRAGE_VOICE_INTERVAL_MS = 300;
export const BARRAGE_VOICE_VOLUME = 0.75;
export const BARRAGE_HIT_INTERVAL_MS = 600;
export const BARRAGE_TICK_DAMAGE = 15;
export const BARRAGE_RANGE_METERS = 1;

export function advanceBarrageHit(
  clock: { barrageMs: number; barrageHitMs: number },
  dt: number,
  interval = BARRAGE_HIT_INTERVAL_MS,
): boolean {
  if (clock.barrageMs <= 0) return false;
  clock.barrageHitMs -= dt;
  if (clock.barrageHitMs > 0) return false;
  clock.barrageHitMs += interval;
  return true;
}

export interface BarrageClock {
  barrageMs: number;
  barrageVoiceMs: number;
}

export function advanceBarrage(clock: BarrageClock, dt: number): boolean {
  clock.barrageMs = Math.max(0, clock.barrageMs - dt);
  clock.barrageVoiceMs -= dt;
  if (clock.barrageVoiceMs <= 0 && clock.barrageMs > 0) {
    clock.barrageVoiceMs += BARRAGE_VOICE_INTERVAL_MS;
    return true;
  }
  return false;
}

export type BarrageVoiceId = 'jotaro' | 'dio';

// User-authorized video excerpts; source and authorization status are documented in
// docs/games/stardust-audio.md. These are not verified official asset releases.
export const BARRAGE_VOICE_SOURCES: Record<BarrageVoiceId, string | null> = {
  jotaro: '/audio/stardust/jotaro-ora.wav?v=phrase',
  dio: '/audio/stardust/dio-muda.wav?v=dio-recut-20261006',
};

export function createBarrageVoicePlayer(
  sources: Readonly<Record<BarrageVoiceId, string | null>> = BARRAGE_VOICE_SOURCES,
) {
  const clips = new Map<BarrageVoiceId, HTMLAudioElement>();
  const playing = new Map<BarrageVoiceId, symbol>();
  let speaking: { id: BarrageVoiceId; utterance: SpeechSynthesisUtterance } | null = null;

  function fallback(id: BarrageVoiceId, volume: number) {
    if (!('speechSynthesis' in window) || speaking) return;
    const utterance = new SpeechSynthesisUtterance(
      id === 'jotaro' ? '欧拉欧拉欧拉' : '木大木大木大',
    );
    utterance.lang = 'zh-CN';
    utterance.rate = 1.2;
    utterance.pitch = id === 'jotaro' ? 0.72 : 0.58;
    utterance.volume = volume;
    speaking = { id, utterance };
    utterance.onend = utterance.onerror = () => {
      if (speaking?.utterance === utterance) speaking = null;
    };
    window.speechSynthesis.speak(utterance);
  }

  return {
    play(id: BarrageVoiceId, volume: number) {
      if (volume <= 0) return;
      volume = Math.min(1, volume) * BARRAGE_VOICE_VOLUME;
      const source = sources[id];
      if (!source) {
        fallback(id, volume);
        return;
      }
      let clip = clips.get(id);
      if (!clip) {
        clip = new Audio(source);
        clips.set(id, clip);
      }
      clip.volume = volume;
      // The 300ms game pulse must not chop or overlap a multi-syllable recording.
      if (playing.has(id)) return;
      const token = Symbol(id);
      playing.set(id, token);
      clip.currentTime = 0;
      clip.onended = () => {
        if (playing.get(id) === token) playing.delete(id);
      };
      void clip.play().catch(() => {
        if (playing.get(id) !== token) return;
        playing.delete(id);
        fallback(id, volume);
      });
    },
    stop(id?: BarrageVoiceId) {
      for (const [actor, clip] of clips) {
        if (id && actor !== id) continue;
        playing.delete(actor);
        clip.onended = null;
        if (!clip.paused) clip.pause();
        if (clip.currentTime !== 0) clip.currentTime = 0;
      }
      if (speaking && (!id || speaking.id === id)) {
        speaking = null;
        window.speechSynthesis?.cancel();
      }
    },
  };
}
