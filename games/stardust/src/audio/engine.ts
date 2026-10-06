import type { StardustAudioCue } from './types';

export interface StardustAudioEngine {
  play(cue: StardustAudioCue, volume: number, pan?: number): void;
  preload(cues: readonly StardustAudioCue[]): Promise<void>;
  resume(): void;
  suspend(): void;
  stop(): void;
  close(): void;
}

export function createStardustAudioEngine(): StardustAudioEngine {
  let context: AudioContext | null = null;
  const active = new Set<AudioScheduledSourceNode>();
  let noiseBuffer: AudioBuffer | null = null;
  const buffers = new Map<string, AudioBuffer>();
  const pending = new Map<string, Promise<AudioBuffer>>();
  const recordings = new Map<string, Set<AudioBufferSourceNode>>();
  let revision = 0;
  let suspended = false;
  const maximumNodes = 32;

  function ensureContext() {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
    return context;
  }

  function stopOldest() {
    const oldest = active.values().next().value;
    if (!oldest) return;
    // onended is asynchronous; remove immediately so rapid bursts cannot spin here.
    active.delete(oldest);
    try {
      oldest.stop();
    } catch {
      active.delete(oldest);
    }
  }

  function loadRecording(src: string): Promise<AudioBuffer> {
    const cached = buffers.get(src);
    if (cached) return Promise.resolve(cached);
    const existing = pending.get(src);
    if (existing) return existing;
    const audio = ensureContext();
    const request = fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(`Missing audio recording: ${src}`);
        return response.arrayBuffer();
      })
      .then((bytes) => audio.decodeAudioData(bytes))
      .then((buffer) => {
        if (context === audio) buffers.set(src, buffer);
        return buffer;
      })
      .finally(() => {
        if (pending.get(src) === request) pending.delete(src);
      });
    pending.set(src, request);
    return request;
  }

  function playRecording(
    recording: NonNullable<StardustAudioCue['recording']>,
    buffer: AudioBuffer,
    volume: number,
    pan: number,
  ) {
    const audio = ensureContext();
    const voices = recordings.get(recording.src) ?? new Set<AudioBufferSourceNode>();
    recordings.set(recording.src, voices);
    const limit = Math.max(1, recording.maxVoices);
    while (voices.size >= limit || (recording.restart && voices.size > 0)) {
      const oldest = voices.values().next().value!;
      voices.delete(oldest);
      active.delete(oldest);
      oldest.stop();
    }
    while (active.size >= maximumNodes) stopOldest();
    const source = audio.createBufferSource();
    source.buffer = buffer;
    const gain = audio.createGain();
    gain.gain.value = recording.gain * Math.min(1, volume);
    const panner = 'createStereoPanner' in audio ? audio.createStereoPanner() : undefined;
    source.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(audio.destination);
    } else {
      gain.connect(audio.destination);
    }
    voices.add(source);
    active.add(source);
    source.onended = () => {
      active.delete(source);
      voices.delete(source);
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    source.start();
  }

  return {
    async preload(cues) {
      await Promise.all(
        cues.map(async (cue) => {
          if (!cue.recording) return;
          try {
            await loadRecording(cue.recording.src);
          } catch {
            // Preloading is optional on browsers without an audio device.
          }
        }),
      );
    },
    play(cue, volume, pan = 0) {
      if (volume <= 0 || suspended) return;
      try {
        if (cue.recording) {
          const recording = cue.recording;
          const cached = buffers.get(recording.src);
          if (cached) playRecording(recording, cached, volume, pan);
          else {
            const requestedRevision = revision;
            void loadRecording(recording.src)
              .then((buffer) => {
                if (revision === requestedRevision && !suspended)
                  playRecording(recording, buffer, volume, pan);
              })
              .catch(() => {
                // Missing optional audio must not queue stale hits or block combat.
              });
          }
          return;
        }
        if (cue.layers.length === 0) return;
        const audio = ensureContext();
        while (active.size + cue.layers.length > maximumNodes) stopOldest();
        for (const layer of cue.layers) {
          let source: AudioScheduledSourceNode;
          let filter: BiquadFilterNode | undefined;
          const gain = audio.createGain();
          const panner = 'createStereoPanner' in audio ? audio.createStereoPanner() : undefined;
          const start = audio.currentTime + (layer.delay ?? 0);
          const end = start + layer.duration;
          if (layer.type === 'noise') {
            if (!noiseBuffer) {
              noiseBuffer = audio.createBuffer(
                1,
                Math.ceil(audio.sampleRate * 0.5),
                audio.sampleRate,
              );
              const samples = noiseBuffer.getChannelData(0);
              for (let index = 0; index < samples.length; index++)
                samples[index] = Math.random() * 2 - 1;
            }
            const noise = audio.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;
            source = noise;
            filter = audio.createBiquadFilter();
            filter.type = 'bandpass';
            filter.Q.value = 0.7;
            filter.frequency.setValueAtTime(layer.from, start);
            filter.frequency.exponentialRampToValueAtTime(layer.to, end);
            source.connect(filter);
            filter.connect(gain);
          } else {
            const oscillator = audio.createOscillator();
            oscillator.type = layer.type;
            oscillator.frequency.setValueAtTime(Math.max(1, layer.from), start);
            oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, layer.to), end);
            source = oscillator;
            source.connect(gain);
          }
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.linearRampToValueAtTime(
            Math.max(0.0001, layer.gain * Math.min(1, volume)),
            start + Math.min(0.006, layer.duration / 4),
          );
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
          if (panner) {
            panner.pan.value = Math.max(-1, Math.min(1, pan));
            gain.connect(panner).connect(audio.destination);
          } else {
            gain.connect(audio.destination);
          }
          active.add(source);
          source.onended = () => {
            active.delete(source);
            source.disconnect();
            filter?.disconnect();
            gain.disconnect();
            panner?.disconnect();
          };
          source.start(start);
          source.stop(end + 0.01);
        }
      } catch {
        // Audio is optional; gameplay must remain available without an output device.
      }
    },
    resume() {
      suspended = false;
      if (context?.state === 'suspended') void context.resume().catch(() => {});
    },
    suspend() {
      suspended = true;
      revision += 1;
      if (context?.state === 'running') void context.suspend().catch(() => {});
    },
    stop() {
      revision += 1;
      for (const oscillator of active) {
        try {
          oscillator.stop();
        } catch {
          // The node may already have ended.
        }
      }
      active.clear();
      recordings.clear();
    },
    close() {
      this.stop();
      if (context) void context.close().catch(() => {});
      context = null;
      noiseBuffer = null;
      buffers.clear();
      pending.clear();
      suspended = true;
    },
  };
}
