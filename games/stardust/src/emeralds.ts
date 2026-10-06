import { attackSpecs, BARRAGE_DAMAGE_LIMIT, type Action, type createCombatState } from './rules';
import { BARRAGE_DURATION_MS, BARRAGE_HIT_INTERVAL_MS } from './barrage';
import { ownerDamage, type HitPart } from './stand-control';
import { applyStatus } from './status-effects';

export type EmeraldAction = Extract<Action, 'light' | 'heavy' | 'stand'>;
type CombatState = ReturnType<typeof createCombatState>;
export const EMERALD_SPEED = 0.08;
export const EMERALD_LIFETIME_MS = 1600;
export const EMERALD_BARRAGE_VOLLEYS = 20;
export const EMERALD_BARRAGE_INTERVAL_MS = BARRAGE_DURATION_MS / EMERALD_BARRAGE_VOLLEYS;
const BARRAGE_ENERGY =
  attackSpecs.stand.energy + Math.ceil(BARRAGE_DURATION_MS / BARRAGE_HIT_INTERVAL_MS) - 1;
const HIT_RADIUS = 1.5;

function share(total: number, index: number, count: number) {
  return Math.ceil((total * (index + 1)) / count) - Math.ceil((total * index) / count);
}

export interface EmeraldProjectile {
  id: number;
  action: EmeraldAction;
  x: number;
  facing: 1 | -1;
  lane: number;
  lifeMs: number;
  damage: number;
  guardDamage: number;
  energy: number;
  knockback: number;
  sustained: boolean;
  detached: boolean;
}

export interface EmeraldTarget<T> {
  owner: T;
  x: number;
  part: HitPart;
}

/** Reserve damage at launch so late arrivals cannot spend the next barrage's budget. */
export function launchEmeralds(
  caster: Pick<CombatState, 'barrageDamageLeft' | 'standControl'>,
  action: EmeraldAction,
  x: number,
  facing: 1 | -1,
  firstId: number,
  sustained = false,
): EmeraldProjectile[] {
  const count = action === 'light' ? 1 : 3;
  const volley = Math.floor(
    (BARRAGE_DAMAGE_LIMIT - caster.barrageDamageLeft) /
      (BARRAGE_DAMAGE_LIMIT / EMERALD_BARRAGE_VOLLEYS),
  );
  const damage =
    action === 'stand'
      ? Math.min(
          share(BARRAGE_DAMAGE_LIMIT, volley, EMERALD_BARRAGE_VOLLEYS),
          caster.barrageDamageLeft,
        )
      : attackSpecs[action].damage;
  if (damage <= 0) return [];
  if (action === 'stand') caster.barrageDamageLeft -= damage;
  const energy =
    action === 'stand'
      ? share(BARRAGE_ENERGY, volley, EMERALD_BARRAGE_VOLLEYS)
      : attackSpecs[action].energy;
  const guardDamage = ownerDamage(damage, 'body', true);
  return Array.from({ length: count }, (_, index) => ({
    id: firstId + index,
    action,
    x,
    facing,
    lane: count === 3 ? index - 1 : 0,
    lifeMs: EMERALD_LIFETIME_MS,
    damage: share(damage, index, count),
    guardDamage: share(guardDamage, index, count),
    energy: share(energy, index, count),
    knockback: action === 'light' ? 2 : action === 'heavy' && index === count - 1 ? 5 : 0,
    sustained,
    detached: caster.standControl.mode === 'detached',
  }));
}

/** Sweep the traveled segment rather than checking only the final position. */
export function advanceEmerald<T>(
  projectile: EmeraldProjectile,
  targets: readonly EmeraldTarget<T>[],
  dt: number,
  frozen = false,
): EmeraldTarget<T> | undefined {
  if (frozen || projectile.lifeMs <= 0 || dt <= 0) return;
  const elapsed = Math.min(dt, projectile.lifeMs);
  const start = projectile.x;
  const end = start + projectile.facing * EMERALD_SPEED * elapsed;
  projectile.lifeMs -= elapsed;
  const hit = targets
    .filter((target) => {
      const distance = (target.x - start) * projectile.facing;
      return distance >= -HIT_RADIUS && distance <= Math.abs(end - start) + HIT_RADIUS;
    })
    .sort((first, second) => Math.abs(first.x - start) - Math.abs(second.x - start))[0];
  projectile.x = hit?.x ?? end;
  if (hit || end < -4 || end > 104) projectile.lifeMs = 0;
  return hit;
}

export function applyEmeraldHit(
  caster: Pick<CombatState, 'energy' | 'combo'>,
  target: Pick<CombatState, 'hp' | 'x' | 'guard' | 'stun' | 'standControl' | 'statusEffects'>,
  projectile: EmeraldProjectile,
  part: HitPart,
) {
  const guarded = part === 'body' && target.guard;
  const damage = Math.min(
    target.hp,
    guarded ? projectile.guardDamage : ownerDamage(projectile.damage, part, false),
  );
  target.hp = Math.max(0, target.hp - damage);
  if (projectile.detached && projectile.action !== 'stand' && !guarded && target.hp > 0)
    applyStatus(target.statusEffects, 'emerald', part);
  if (part === 'stand') target.standControl.stunMs = 100;
  else {
    target.stun = Math.max(target.stun, guarded ? 6 : projectile.sustained ? 3 : 13);
    target.x = Math.max(6, Math.min(94, target.x + projectile.facing * projectile.knockback));
  }
  caster.energy = Math.min(100, caster.energy + projectile.energy);
  caster.combo += 1;
  return { damage, guarded };
}
