import type { BattleEvent } from './types';

export interface ToneLayer {
  type: OscillatorType;
  from: number;
  to: number;
  duration: number;
  gain: number;
  delay?: number;
}

const impactMoves = new Set([
  'heavy',
  'closeHeavy',
  'kick',
  'sweep',
  'upper',
  'airHeavy',
  'airKick',
  'blowback',
  'airBlowback',
  'guardCounter',
  'throwing',
]);

export function isImpactEvent(event: BattleEvent) {
  return (
    ['parry', 'launch', 'guard-break', 'throw', 'burst'].includes(event.kind) ||
    (event.kind === 'hit' &&
      ((event.damage ?? 0) >= 75 || (event.move ? impactMoves.has(event.move) : false)))
  );
}

export function soundCue(event: BattleEvent): ToneLayer[] {
  if (event.kind === 'round')
    return [{ type: 'sawtooth', from: 78, to: 36, duration: 0.24, gain: 0.05 }];
  if (event.kind === 'super')
    return [{ type: 'sawtooth', from: 440, to: 90, duration: 0.22, gain: 0.045 }];
  if (event.kind === 'parry')
    return [
      { type: 'square', from: 760, to: 320, duration: 0.13, gain: 0.035 },
      { type: 'sine', from: 980, to: 620, duration: 0.09, gain: 0.02, delay: 0.025 },
    ];
  if (event.kind === 'block')
    return [{ type: 'triangle', from: 320, to: 145, duration: 0.09, gain: 0.03 }];
  if (event.kind === 'cancel')
    return [{ type: 'sine', from: 480, to: 880, duration: 0.11, gain: 0.026 }];
  if (event.kind === 'ex' || event.kind === 'max')
    return [{ type: 'sine', from: 310, to: 680, duration: 0.14, gain: 0.032 }];
  if (event.kind === 'bubble-pop')
    return [{ type: 'sine', from: 280, to: 110, duration: 0.08, gain: 0.025 }];
  if (event.kind === 'jump' || event.kind === 'chase')
    return [{ type: 'sine', from: 180, to: 300, duration: 0.07, gain: 0.018 }];
  if (event.kind === 'land')
    return [{ type: 'triangle', from: 95, to: 55, duration: 0.07, gain: 0.022 }];
  if (isImpactEvent(event))
    return [
      { type: 'square', from: 92, to: 42, duration: 0.17, gain: 0.052 },
      { type: 'triangle', from: 68, to: 38, duration: 0.13, gain: 0.03, delay: 0.018 },
    ];
  if (event.kind === 'hit' || event.kind === 'variant')
    return [{ type: 'square', from: 165, to: 68, duration: 0.1, gain: 0.032 }];
  return [];
}

export function timerCue(seconds: number): ToneLayer[] {
  const critical = seconds <= 3;
  return [
    {
      type: critical ? 'square' : 'sine',
      from: critical ? 620 + (3 - seconds) * 90 : 360 + (10 - seconds) * 18,
      to: critical ? 760 + (3 - seconds) * 100 : 440 + (10 - seconds) * 20,
      duration: critical ? 0.1 : 0.075,
      gain: critical ? 0.035 : 0.022,
    },
  ];
}
