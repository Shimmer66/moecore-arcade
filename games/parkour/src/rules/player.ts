import { FIXED_DT, GRAVITY, JUMP_SPEED } from '../config/constants';
import type { PlayerInput, PlayerState } from './types';
import { assertFixedStep } from './validation';

export function createPlayer(): PlayerState {
  return { y: 0, velocityY: 0, grounded: true, crouching: false, jumpHeld: false };
}

export function applyPlayerInput(state: PlayerState, input: PlayerInput): PlayerState {
  const crouching = state.grounded && input.crouch;
  const jumping = state.grounded && !crouching && input.jump && !state.jumpHeld;
  return {
    ...state,
    velocityY: jumping ? JUMP_SPEED : state.velocityY,
    grounded: state.grounded && !jumping,
    crouching,
    jumpHeld: input.jump,
  };
}

export function advancePlayer(state: PlayerState, dt: number): PlayerState {
  if (state.grounded) return state;
  const velocityY = state.velocityY - GRAVITY * dt;
  const y = Math.max(0, state.y + velocityY * dt);
  return { ...state, y, velocityY: y === 0 ? 0 : velocityY, grounded: y === 0 };
}

export function stepPlayer(
  state: PlayerState,
  input: PlayerInput,
  dt: number = FIXED_DT,
): PlayerState {
  assertFixedStep(dt);
  return advancePlayer(applyPlayerInput(state, input), dt);
}
