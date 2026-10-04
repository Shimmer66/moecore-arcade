import { BEAT_MS, RHYTHM_END_MS, type RhythmJudgement } from './rules/rhythm';

// Original short pentatonic loop, synthesized locally. The game clock supplies
// timestamps; scheduled Web Audio notes never drive scoring or survive pause.
export function createRhythmMusic(volume: () => number) {
  let audio: AudioContext | undefined;
  let nextPulse = 0;
  let disposed = false;
  const voices = new Set<OscillatorNode>();
  function unlock() {
    if (disposed || volume() <= 0) return;
    try {
      audio ??= new AudioContext({ latencyHint: 'interactive' });
      if (audio.state === 'suspended') void audio.resume().catch(() => {});
    } catch {
      /* Silent play remains available. */
    }
  }
  function tone(
    frequency: number,
    at: number,
    duration: number,
    level: number,
    type: OscillatorType = 'sine',
  ) {
    if (!audio || audio.state !== 'running' || disposed || volume() <= 0) return;
    const node = audio.createOscillator();
    const gain = audio.createGain();
    node.type = type;
    node.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level * Math.min(1, Math.max(0, volume())), at + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    node.connect(gain);
    gain.connect(audio.destination);
    voices.add(node);
    node.onended = () => {
      voices.delete(node);
      node.disconnect();
      gain.disconnect();
    };
    node.start(at);
    node.stop(at + duration + 0.01);
  }
  function sync(elapsed: number) {
    if (!audio || audio.state !== 'running' || volume() <= 0) return;
    const interval = BEAT_MS / 2;
    nextPulse = Math.max(nextPulse, Math.ceil(elapsed / interval));
    while (nextPulse * interval <= elapsed + 100 && nextPulse * interval < RHYTHM_END_MS) {
      const pulse = nextPulse++;
      const at = audio.currentTime + Math.max(0, pulse * interval - elapsed) / 1000;
      const beat = Math.floor(pulse / 2);
      if (pulse % 2 === 0) {
        tone(beat % 4 === 0 ? 130 : 190, at, 0.08, 0.08, 'triangle');
        if (beat >= 4) {
          const melody = [523.25, 659.25, 783.99, 880, 783.99, 659.25, 587.33, 659.25];
          tone(melody[(beat - 4) % melody.length]!, at, 0.17, 0.035, 'triangle');
          if (beat % 4 === 0) tone(130.81, at, 0.3, 0.04);
        } else tone(beat === 3 ? 1046.5 : 523.25, at, 0.09, 0.07);
      } else if (beat >= 20) tone(1760, at, 0.025, 0.013);
    }
  }
  function hit(kind: RhythmJudgement) {
    if (!audio) return;
    tone(
      kind === 'perfect' ? 1320 : kind === 'good' ? 880 : 110,
      audio.currentTime,
      0.075,
      0.055,
      kind === 'perfect' ? 'sine' : 'triangle',
    );
  }
  function stop(elapsed = 0) {
    for (const node of voices) node.stop();
    voices.clear();
    nextPulse = Math.ceil(elapsed / (BEAT_MS / 2));
  }
  function dispose() {
    disposed = true;
    stop();
    if (audio) void audio.close().catch(() => {});
  }
  return { unlock, sync, hit, stop, dispose };
}
