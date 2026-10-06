import { metersToPosition, STAND_HIT_REACH_METERS, type StandMode } from './stand-control';

export const AI_STAND_DEPLOY_DELAY_MS = 600;
export const AI_STAND_RECALL_COOLDOWN_MS = 1200;
export const AI_STAND_ACTIVE_MS = 6500;
const CLOSE_TO_OWNER = 3;
const HIT_REACH = metersToPosition(STAND_HIT_REACH_METERS);

export interface StandAIState {
  cooldownMs: number;
  deployedMs: number;
}

export interface StandAIScene {
  mode: StandMode;
  ownerX: number;
  standX: number;
  maximumStandX: number;
  targetX: number | null;
  bodyAttackReach: number;
  ranged: boolean;
  busy: boolean;
  blocked: boolean;
  frozen: boolean;
}

export function createStandAIState(): StandAIState {
  return { cooldownMs: AI_STAND_DEPLOY_DELAY_MS, deployedMs: 0 };
}

/** Plans only CPU control. The caller retains ownership of movement, combat and rendering. */
export function advanceStandAI(state: StandAIState, scene: StandAIScene, dt: number) {
  const plan = {
    transition: null as 'deploy' | 'recall' | null,
    bodyDirection: 0,
    standDirection: 0,
    bodySpacing: 0,
    canAttack: false,
  };
  if (scene.frozen) return plan;
  const elapsed = Math.max(0, dt);
  state.cooldownMs = Math.max(0, state.cooldownMs - elapsed);
  if (scene.mode === 'detached') state.deployedMs += elapsed;
  else if (state.deployedMs > 0) {
    state.deployedMs = 0;
    state.cooldownMs = AI_STAND_RECALL_COOLDOWN_MS;
  }
  if (scene.blocked) return plan;

  const recall = () => {
    state.cooldownMs = AI_STAND_RECALL_COOLDOWN_MS;
    state.deployedMs = 0;
    plan.transition = 'recall';
    return plan;
  };
  if (scene.targetX === null) return scene.mode === 'detached' ? recall() : plan;
  const bodyGap = Math.abs(scene.targetX - scene.ownerX);
  const towardTarget = Math.sign(scene.targetX - scene.ownerX) || 1;
  const maximumReach = Math.max(0, (scene.maximumStandX - scene.ownerX) * towardTarget) + HIT_REACH;
  const reachable = scene.ranged || bodyGap <= maximumReach;

  if (scene.mode !== 'detached') {
    if (state.cooldownMs === 0 && bodyGap >= CLOSE_TO_OWNER && reachable) {
      state.deployedMs = 0;
      plan.transition = 'deploy';
      return plan;
    }
    plan.bodySpacing = Math.max(CLOSE_TO_OWNER + 0.5, Math.min(14, maximumReach * 0.75));
    if (!scene.ranged && bodyGap > plan.bodySpacing)
      plan.bodyDirection = Math.sign(scene.targetX - scene.ownerX);
    plan.canAttack = scene.ranged || bodyGap <= scene.bodyAttackReach;
    return plan;
  }

  const crossedOwner = (scene.standX - scene.ownerX) * (scene.targetX - scene.ownerX) < 0;
  if (
    bodyGap < CLOSE_TO_OWNER ||
    crossedOwner ||
    (!scene.busy && (!reachable || state.deployedMs >= AI_STAND_ACTIVE_MS))
  )
    return recall();
  const gap = Math.abs(scene.targetX - scene.standX);
  if (gap > (scene.ranged ? 12 : HIT_REACH))
    plan.standDirection = Math.sign(scene.targetX - scene.standX);
  plan.canAttack = scene.ranged || gap <= HIT_REACH;
  return plan;
}
