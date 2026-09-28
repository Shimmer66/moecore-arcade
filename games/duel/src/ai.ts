import type { Battle, Input, Observation } from './types';
import { DIFFICULTIES } from './moves';
export function observe(b: Battle): Observation {
  return {
    fighters: b.fighters.map((f) => ({ x: f.x, y: f.y, action: f.action, facing: f.facing })),
    projectiles: b.projectiles.map((p) => ({ owner: p.owner, x: p.x })),
  };
}
function random(b: Battle) {
  b.brain.seed = (Math.imul(b.brain.seed, 1664525) + 1013904223) >>> 0;
  return b.brain.seed / 4294967296;
}
export function botInput(b: Battle): Input {
  const brain = b.brain,
    self = b.fighters[1];
  const level = DIFFICULTIES[b.options.difficulty];
  const input: Input = { move: brain.move, guard: brain.guard, crouch: brain.crouch, commands: [] };
  // Own hit feedback is distinct from delayed observation of the opponent.
  if (self.contactHit && b.tick - self.contactTick === 4 && brain.confirmed !== self.serial) {
    brain.confirmed = self.serial;
    if (['upper', 'heavy', 'variant'].includes(self.action) && random(b) < level.confirm)
      input.commands.push('jump');
    else if (self.action === 'air') input.commands.push('heavy');
    else if (random(b) < level.confirm && self.action === 'light2' && self.energy >= 100)
      input.commands.push('super');
    else if (self.id === 'gpt' && self.cooldown === 0 && random(b) < level.confirm)
      input.commands.push('skill');
    else if (self.action === 'light1' || self.action === 'light2') input.commands.push('light');
  }
  if (b.tick < brain.decisionAt) return input;
  brain.decisionAt = b.tick + level.decision + Math.floor(random(b) * 13);
  const old = brain.history[0] ?? observe(b),
    enemy = old.fighters[0]!;
  const delta = enemy.x - self.x,
    distance = Math.abs(delta),
    toward = delta < 0 ? -1 : 1;
  const roll = random(b);
  if (self.combo >= 3 && self.energy >= 50 && !self.burstUsed && roll < level.confirm)
    input.commands.push('burst');
  input.guard = false;
  input.crouch = false;
  input.move = 0;
  const projectile = old.projectiles.some((p) => p.owner === 0 && Math.abs(p.x - self.x) < 230);
  if (
    self.memeCooldown === 0 &&
    self.y === 0 &&
    ((self.id === 'deepseek' && self.hp < 900 && distance > 250 && roll < 0.35) ||
      (self.id === 'gpt' && enemy.y > 30 && distance < 100 && roll < 0.65) ||
      (self.id === 'doubao' && distance > 250 && roll > 0.65))
  ) {
    input.commands.push('meme');
  } else if (self.y > 0 && distance < 115 && Math.abs(self.y - enemy.y) < 85) {
    input.move = distance > 75 ? toward : 0;
    input.commands.push('light');
  } else if (projectile && roll < 0.6) {
    if (roll < 0.25) input.commands.push('jump');
    else input.guard = true;
  } else if (enemy.y > 30 && distance < 140) {
    input.crouch = true;
    input.commands.push('heavy');
  } else if (distance > 240) {
    input.move = toward;
    if (roll > 0.8) input.commands.push('dash');
    if (self.id === 'doubao' && roll < 0.45) input.commands.push('skill');
    else if (roll < 0.15) input.commands.push('jump');
  } else if (distance > 100) {
    input.move = toward;
    if (self.id === 'gpt' && distance < 200 && roll < 0.45) input.commands.push('skill');
    else if (self.id === 'doubao' && roll < 0.35) input.commands.push('skill');
    else if (self.energy >= 100 && roll > 0.8) input.commands.push('super');
  } else if (self.energy >= 25 && self.variantCooldown === 0 && distance < 160 && roll > 0.7)
    input.commands.push('variant');
  else if (distance < 64 && (enemy.action === 'guard' || roll > 0.8)) input.commands.push('throw');
  else if (roll < 0.2) input.guard = true;
  else if (self.id === 'deepseek' && roll < 0.4) input.commands.push('skill');
  else if (roll < 0.6) input.commands.push('heavy');
  else {
    input.commands.push('light');
    input.move = distance > 68 ? toward : 0;
  }
  brain.move = input.move;
  brain.guard = input.guard;
  brain.crouch = input.crouch;
  return input;
}
