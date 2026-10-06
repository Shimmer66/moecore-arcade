export type DamageSource =
  | 'light'
  | 'heavy'
  | 'stand'
  | 'special'
  | 'guard'
  | 'bleed'
  | 'emerald'
  | 'burn'
  | 'fireball'
  | 'finger';

const labels: Record<DamageSource, string> = {
  light: '普通攻击',
  heavy: '重击',
  stand: '连打',
  special: '必杀',
  guard: '防御',
  bleed: '流血',
  emerald: '绿宝石流血',
  burn: '燃烧',
  fireball: '火焰弹',
  finger: '流星指刺',
};

export function damageLabel(source: DamageSource, reflected: boolean, guarded = false) {
  const label = labels[source];
  if (reflected) return `替身返还50% · ${label}`;
  return guarded ? `防御减伤 · ${label}` : label;
}
