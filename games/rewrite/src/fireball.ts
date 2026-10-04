/** Deterministic orbit offsets; rendering and collisions use the same projectile position. */
export const FIREBALL = {
  speed: 18,
  depthSpeed: 26,
  lifetime: 1.15,
  interval: 0.24,
  radius: 0.22,
  damage: 2,
} as const;
export function fireballOffset(age: number) {
  const angle = age * 17;
  return { forward: 0.48 * (Math.cos(angle) - 1), side: 0.48 * Math.sin(angle) };
}
export function fireballDelta(age: number, seconds: number) {
  const old = fireballOffset(age),
    next = fireballOffset(age + seconds);
  return { forward: next.forward - old.forward, side: next.side - old.side };
}
