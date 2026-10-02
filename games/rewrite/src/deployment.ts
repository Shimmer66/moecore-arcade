import type { Difficulty, Persona, Weapon } from './rules';

export interface Deployment {
  persona: Persona;
  difficulty: Difficulty;
  coop: boolean;
  partnerPersona: Persona;
  practice: boolean;
  practiceStage: number;
  practiceFrom: 'entry' | 'boss';
  practiceWeapon: Weapon;
  sound: boolean;
  musicVolume: number;
  effectsVolume: number;
  attempt: number;
  active: boolean;
}

// GameHost mounts a new component for each session ID. Keep only the latest
// deployment choices in this window; progress and combat state are never saved.
let latest: Deployment | undefined;
export function rememberDeployment(value: Deployment) {
  latest = { ...value };
}
export function lastDeployment(): Deployment | undefined {
  return latest ? { ...latest } : undefined;
}
