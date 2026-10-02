import type { Adventure } from './rules/adventure';

type Cue = 'rice' | 'return' | 'perfect' | 'hurt' | 'burst' | 'win' | 'lose' | 'verify';
const notes: Record<Cue, number[]> = {
  rice: [660, 880],
  return: [330, 660],
  perfect: [660, 880, 1320],
  hurt: [180, 90],
  burst: [180, 360, 720, 1080],
  win: [523, 659, 784, 1047],
  lose: [294, 220, 147],
  verify: [880, 660, 990],
};

/** Short original synthesized arcade cues. No downloaded audio or background loops. */
export function createRunnerSound(volume: () => number) {
  let context: AudioContext | undefined;
  const voices = new Set<OscillatorNode>();
  let disposed = false;
  function unlock() {
    if (disposed || volume() <= 0) return;
    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') void context.resume().catch(() => {});
    } catch {
      // Sound availability must never prevent play.
    }
  }
  function stop() {
    for (const voice of voices) voice.stop();
    voices.clear();
  }
  function play(cue: Cue) {
    if (!context || context.state !== 'running' || volume() <= 0 || disposed) return;
    stop();
    const audio = context;
    notes[cue].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * 0.065;
      oscillator.type = cue === 'hurt' || cue === 'lose' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, volume())) * 0.1, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      voices.add(oscillator);
      oscillator.onended = () => {
        voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }
  function update(before: Adventure, after: Adventure) {
    if (after.run.status === 'ended' && before.run.status !== 'ended')
      play(after.hasAnswer && after.health > 0 ? 'win' : 'lose');
    else if (after.hits > before.hits) play('hurt');
    else if (after.bursts > before.bursts) play('burst');
    else if (after.perfectParries > before.perfectParries) play('perfect');
    else if (after.parries > before.parries) play('return');
    else if (after.verified > before.verified) play('verify');
    else if (after.rice > before.rice) play('rice');
  }
  function dispose() {
    disposed = true;
    stop();
    if (context) void context.close().catch(() => {});
  }
  return { unlock, stop, play, update, dispose };
}
