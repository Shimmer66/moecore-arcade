export type Cue = 'jump' | 'death' | 'secret' | 'clear';
const NOTES: Record<Cue, number[]> = {
  jump: [330, 480],
  death: [180, 110, 65],
  secret: [660, 880, 1100],
  clear: [440, 550, 660, 880],
};

export class ArenaAudio {
  private context: AudioContext | undefined;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Gameplay remains available when audio is unavailable. */
    }
  }
  play(cue: Cue, volume: number) {
    const context = this.context;
    if (!context || context.state !== 'running' || volume <= 0) return;
    const amplitude = Math.min(1, volume) * 0.045;
    NOTES[cue].forEach((frequency, index) => {
      const start = context.currentTime + index * 0.065;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = cue === 'death' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(amplitude, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  suspend() {
    void this.context?.suspend().catch(() => {});
  }
  dispose() {
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}
