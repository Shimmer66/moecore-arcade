import type { StardustActorId, StardustAudioCue, StardustAudioEvent, ToneLayer } from './types';

export const SWORD_RECORDINGS = {
  light: '/audio/stardust/mixkit-arrow-whoosh-1491.wav',
  heavy: '/audio/stardust/mixkit-dagger-woosh-1487.wav',
} as const;

const one = (
  type: ToneLayer['type'],
  from: number,
  to: number,
  duration: number,
  gain: number,
  delay = 0,
): ToneLayer => ({ type, from, to, duration, gain, delay });

function actorAccent(actor: StardustActorId | undefined): ToneLayer[] {
  if (actor === 'kakyoin') return [one('sine', 720, 380, 0.11, 0.016, 0.015)];
  if (actor === 'avdol') return [one('sawtooth', 210, 72, 0.16, 0.022, 0.01)];
  if (actor === 'polnareff') return [one('triangle', 980, 430, 0.09, 0.018, 0.008)];
  if (actor === 'holhorse') return [one('square', 190, 58, 0.12, 0.026)];
  if (actor === 'ice') return [one('sawtooth', 66, 24, 0.25, 0.028)];
  if (actor === 'dio') return [one('square', 82, 34, 0.18, 0.026)];
  if (actor === 'jotaro') return [one('triangle', 125, 54, 0.12, 0.022)];
  return [];
}

export function audioCue(event: StardustAudioEvent, actor?: StardustActorId): StardustAudioCue {
  if (actor === 'polnareff') {
    if (event === 'light-swing' || event === 'blade-swing') {
      return {
        category: 'sfx',
        layers: [],
        recording: {
          src: SWORD_RECORDINGS.light,
          gain: 0.45,
          maxVoices: 4,
        },
      };
    }
    if (['heavy-swing', 'special', 'blade-ultimate', 'blade-finish'].includes(event)) {
      return {
        category: 'sfx',
        layers: [],
        recording: {
          src: SWORD_RECORDINGS.heavy,
          gain: 0.6,
          maxVoices: 2,
          restart: event === 'blade-finish',
        },
      };
    }
    if (event === 'light-hit' || event === 'heavy-hit') return { category: 'sfx', layers: [] };
  }
  let layers: ToneLayer[];
  let category: StardustAudioCue['category'] = 'sfx';
  switch (event) {
    case 'select':
      layers = [one('sine', 420, 560, 0.055, 0.018)];
      break;
    case 'confirm':
      layers = [one('triangle', 260, 620, 0.12, 0.026)];
      break;
    case 'summon':
      layers = [one('sawtooth', 72, 180, 0.32, 0.035), one('sine', 440, 920, 0.24, 0.02, 0.06)];
      break;
    case 'panel':
      layers = [one('square', 210, 150, 0.07, 0.018), one('sine', 650, 820, 0.09, 0.014, 0.035)];
      break;
    case 'fight':
      layers = [one('square', 86, 38, 0.2, 0.05), one('triangle', 180, 72, 0.13, 0.028, 0.018)];
      break;
    case 'step':
      layers = [one('triangle', 105, 62, 0.045, 0.012)];
      break;
    case 'idle':
      category = 'ambience';
      layers = [one('sine', 92, 108, 0.42, 0.007)];
      break;
    case 'light-swing':
      layers = [one('sine', 340, 170, 0.055, 0.014)];
      break;
    case 'light-hit':
      layers = [one('square', 175, 72, 0.09, 0.032), ...actorAccent(actor)];
      break;
    case 'heavy-swing':
      layers = [one('sawtooth', 210, 78, 0.11, 0.021)];
      break;
    case 'heavy-hit':
      layers = [
        one('square', 92, 38, 0.17, 0.052),
        one('triangle', 66, 34, 0.14, 0.028, 0.018),
        ...actorAccent(actor),
      ];
      break;
    case 'blade-swing':
    case 'blade-ultimate':
      layers = [
        one('noise', 5400, 850, 0.12, 0.075),
        one('triangle', 3100, 1750, 0.09, 0.018, 0.008),
        one('sine', 1870, 940, 0.07, 0.014, 0.018),
      ];
      break;
    case 'blade-finish':
      layers = [
        one('noise', 6200, 450, 0.23, 0.09),
        one('triangle', 110, 38, 0.27, 0.045),
        one('sine', 2170, 1810, 0.4, 0.032, 0.018),
        one('triangle', 3260, 2700, 0.32, 0.02, 0.028),
      ];
      break;
    case 'barrage':
      layers = [one('square', actor === 'dio' ? 88 : 122, 46, 0.058, 0.025), ...actorAccent(actor)];
      break;
    case 'special':
      layers = [
        one('sawtooth', 420, 84, 0.28, 0.04),
        one('sine', 760, 180, 0.2, 0.022, 0.035),
        ...actorAccent(actor),
      ];
      break;
    case 'block':
      layers = [
        one('triangle', 390, 140, 0.085, 0.032),
        one('square', 720, 330, 0.05, 0.012, 0.01),
      ];
      break;
    case 'hurt':
      layers = [one('sawtooth', 118, 54, 0.11, 0.022)];
      break;
    case 'down':
      layers = [one('triangle', 82, 35, 0.19, 0.035)];
      break;
    case 'ko':
      layers = [
        one('square', 74, 28, 0.28, 0.06, 0.055),
        one('sawtooth', 320, 52, 0.24, 0.026, 0.08),
      ];
      break;
    case 'revive':
      layers = [one('sine', 180, 520, 0.24, 0.025), one('triangle', 350, 780, 0.18, 0.018, 0.08)];
      break;
    case 'next-fighter':
      layers = [one('triangle', 260, 520, 0.13, 0.025)];
      break;
    case 'team-clear':
      layers = [
        one('sine', 330, 520, 0.12, 0.022),
        one('sine', 520, 780, 0.13, 0.022, 0.12),
        one('sine', 780, 1040, 0.15, 0.025, 0.25),
      ];
      break;
    case 'time-stop':
      layers = [one('sawtooth', 72, 18, 0.42, 0.045), one('square', 260, 32, 0.18, 0.018, 0.04)];
      break;
    case 'time-resume':
      layers = [
        one('sawtooth', 36, 340, 0.18, 0.036),
        one('triangle', 90, 680, 0.12, 0.018, 0.025),
      ];
      break;
  }
  return { category, layers };
}
