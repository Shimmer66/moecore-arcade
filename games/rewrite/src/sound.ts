import type { Weapon } from './levels';

export interface ToneSpec {
  start: number;
  end: number;
  duration: number;
  volume: number;
  type: OscillatorType;
  delay?: number;
}

interface Theme {
  bpm: number;
  lead: readonly number[];
  bass: readonly number[];
  type: OscillatorType;
}

const themes: readonly Theme[] = [
  { bpm: 132, lead: [72, 76, 79, 83, 79, 76], bass: [36, 43, 41, 43], type: 'square' },
  { bpm: 116, lead: [62, 65, 69, 70, 69, 65], bass: [31, 38, 36, 38], type: 'triangle' },
  { bpm: 140, lead: [74, 77, 81, 84, 81, 77], bass: [38, 45, 43, 45], type: 'triangle' },
  { bpm: 126, lead: [68, 71, 75, 78, 75, 71], bass: [32, 39, 37, 39], type: 'sine' },
  { bpm: 148, lead: [64, 67, 71, 76, 71, 67], bass: [28, 35, 33, 35], type: 'sawtooth' },
  { bpm: 134, lead: [69, 72, 76, 79, 76, 72], bass: [33, 40, 38, 40], type: 'square' },
  { bpm: 152, lead: [66, 70, 73, 78, 73, 70], bass: [30, 37, 35, 37], type: 'sawtooth' },
  { bpm: 142, lead: [63, 68, 71, 75, 71, 68], bass: [27, 34, 32, 34], type: 'triangle' },
];

export const midiFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
export const musicBpm = (stage: number, arena: boolean) =>
  themes[stage % themes.length]!.bpm + (arena ? 18 : 0);

export function musicTones(stage: number, beat: number, arena: boolean, room = 0): ToneSpec[] {
  const theme = themes[stage % themes.length]!;
  const shift = room % 3;
  const lead = theme.lead[(beat + shift) % theme.lead.length]!;
  const bass = theme.bass[Math.floor(beat / 2 + shift) % theme.bass.length]!;
  const tones: ToneSpec[] = [
    {
      start: midiFrequency(bass),
      end: midiFrequency(bass),
      duration: arena ? 0.22 : 0.16,
      volume: arena ? 0.012 : 0.008,
      type: 'triangle',
    },
  ];
  if (beat % 2 === 0 || arena)
    tones.push({
      start: midiFrequency(lead + (arena && beat % 4 === 3 ? 12 : 0)),
      end: midiFrequency(lead),
      duration: arena ? 0.18 : 0.12,
      volume: arena ? 0.01 : 0.006,
      type: theme.type,
    });
  if (arena && beat % 4 === 0)
    tones.push({
      start: midiFrequency(bass - 12),
      end: midiFrequency(bass - 12),
      duration: 0.3,
      volume: 0.009,
      type: 'sine',
    });
  return tones;
}

const shotPatches: Record<Weapon, readonly ToneSpec[]> = {
  pulse: [{ start: 760, end: 250, duration: 0.055, volume: 0.034, type: 'square' }],
  spread: [
    { start: 480, end: 105, duration: 0.09, volume: 0.026, type: 'sawtooth' },
    { start: 620, end: 140, duration: 0.07, volume: 0.018, type: 'square' },
  ],
  rapid: [{ start: 980, end: 520, duration: 0.025, volume: 0.022, type: 'square' }],
  laser: [
    { start: 1250, end: 220, duration: 0.14, volume: 0.026, type: 'sawtooth' },
    { start: 620, end: 920, duration: 0.12, volume: 0.014, type: 'sine' },
  ],
  flame: [
    { start: 180, end: 70, duration: 0.16, volume: 0.03, type: 'sawtooth' },
    { start: 420, end: 190, duration: 0.12, volume: 0.016, type: 'triangle' },
  ],
  homing: [
    { start: 520, end: 960, duration: 0.11, volume: 0.026, type: 'sine' },
    { start: 860, end: 430, duration: 0.09, volume: 0.012, type: 'triangle' },
  ],
};

export function effectTones(
  kind: 'shoot' | 'jump' | 'hit' | 'boom' | 'pickup' | 'clear',
  weapon: Weapon = 'pulse',
): readonly ToneSpec[] {
  if (kind === 'shoot') return shotPatches[weapon];
  const patches: Record<Exclude<typeof kind, 'shoot'>, readonly ToneSpec[]> = {
    jump: [{ start: 240, end: 600, duration: 0.12, volume: 0.034, type: 'square' }],
    hit: [{ start: 130, end: 45, duration: 0.13, volume: 0.04, type: 'sawtooth' }],
    boom: [{ start: 95, end: 25, duration: 0.28, volume: 0.045, type: 'sawtooth' }],
    pickup: [{ start: 550, end: 1100, duration: 0.16, volume: 0.032, type: 'square' }],
    clear: [
      { start: 400, end: 800, duration: 0.35, volume: 0.03, type: 'square' },
      { start: 600, end: 1400, duration: 0.55, volume: 0.02, type: 'sine', delay: 0.08 },
    ],
  };
  return patches[kind];
}
