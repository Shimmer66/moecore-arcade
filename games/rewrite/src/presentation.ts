export interface ImpactEffect {
  id: number;
  kind: 'hit' | 'boom' | 'shield' | 'pickup' | 'muzzle' | 'defeat';
  life: number;
}

export interface ImpactFeedback {
  x: number;
  y: number;
  flash: number;
  color: string;
}

export function impactFeedback(
  time: number,
  effects: readonly ImpactEffect[],
  reduceMotion: boolean,
): ImpactFeedback {
  if (reduceMotion) return { x: 0, y: 0, flash: 0, color: '#ffffff' };
  let amplitude = 0,
    flash = 0,
    seed = 0,
    color = '#ffd087';
  for (const effect of effects) {
    const strength =
      effect.kind === 'boom'
        ? Math.min(1, effect.life / 0.55) * 5
        : effect.kind === 'defeat'
          ? Math.min(1, effect.life / 0.55) * 3.5
          : effect.kind === 'hit'
            ? Math.min(1, effect.life / 0.24) * 3.2
            : 0;
    if (strength > amplitude) {
      amplitude = strength;
      seed = effect.id;
    }
    if (effect.kind === 'hit' && effect.life > 0) {
      flash = Math.max(flash, Math.min(0.16, effect.life * 0.65));
      color = '#ff7187';
    } else if ((effect.kind === 'boom' || effect.kind === 'defeat') && effect.life > 0) {
      flash = Math.max(flash, Math.min(0.08, effect.life * 0.18));
    }
  }
  return {
    x: Math.sin(time * 91 + seed * 1.7) * amplitude,
    y: Math.cos(time * 73 + seed * 2.1) * amplitude * 0.6,
    flash,
    color,
  };
}
