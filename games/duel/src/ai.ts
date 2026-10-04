import type { Battle, Input, Observation } from './types';
import { DIFFICULTIES, moveFor } from './moves';
import { canEX, canSuper } from './power';
import { canFinisher } from './finishers';
export function observe(b: Battle): Observation {
  return {
    fighters: b.fighters.map((f) => ({
      id: f.id,
      x: f.x,
      y: f.y,
      action: f.action,
      age: f.age,
      facing: f.facing,
    })),
    projectiles: b.projectiles.map((p) => ({ owner: p.owner, x: p.x })),
  };
}
function isRecoveryPunishable(enemy: Observation['fighters'][number]) {
  const move = moveFor(enemy.id, enemy.action);
  if (!move || enemy.y > 0 || enemy.age >= move.total - 2) return false;
  const last = move.strikes.at(-1);
  if (last) return enemy.age >= last.start + last.active + 3;
  if (enemy.action === 'throw' || enemy.action === 'commandGrab') return enemy.age >= 9;
  if (enemy.action === 'skill' || enemy.action === 'meme') return enemy.age >= move.total / 2;
  return false;
}
function random(b: Battle) {
  b.brain.seed = (Math.imul(b.brain.seed, 1664525) + 1013904223) >>> 0;
  return b.brain.seed / 4294967296;
}
function roleConfirm(
  b: Battle,
  self: Battle['fighters'][number],
): Input['commands'][number] | null {
  if (self.silenced > 0) return null;
  if (['deepseek', 'doubao'].includes(self.id))
    return self.energy >= 25 && self.variantCooldown === 0 ? 'variant' : null;
  const projectileBlocked =
    ['doubao', 'prompt_sage'].includes(self.id) &&
    b.projectiles.some(
      (projectile) => projectile.owner === self.slot && projectile.kind !== 'trap',
    );
  return self.cooldown === 0 && !projectileBlocked ? 'skill' : null;
}
export function botCinematicInput(b: Battle): Input {
  const input: Input = { move: 0, crouch: false, guard: false, commands: [] },
    f = b.fighters[1];
  if (b.phaseFrames !== 62 || f.superTier >= 3) return input;
  const tier = f.superTier === 1 ? 2 : 3;
  if (canFinisher(f, tier, true) && random(b) < DIFFICULTIES[b.options.difficulty].confirm)
    input.commands.push(tier === 2 ? 'maxSuper' : 'climax');
  return input;
}
export function botInput(b: Battle): Input {
  const brain = b.brain,
    self = b.fighters[1];
  const level = DIFFICULTIES[b.options.difficulty];
  const input: Input = { move: brain.move, guard: brain.guard, crouch: brain.crouch, commands: [] };
  if (self.action === 'block' && self.guardGauge < 25 && self.energy >= 50) {
    input.commands.push(self.energy >= 100 ? 'blowback' : 'roll');
    input.move = self.facing === 1 ? -1 : 1;
    return input;
  }
  // Own hit feedback is distinct from delayed observation of the opponent.
  if (self.contactHit && b.tick - self.contactTick === 4 && brain.confirmed !== self.serial) {
    brain.confirmed = self.serial;
    if (
      self.energy >= 200 &&
      self.maxFrames === 0 &&
      ['light1', 'light2', 'closeHeavy'].includes(self.action) &&
      random(b) < level.confirm
    ) {
      input.commands.push('max');
      brain.decisionAt = b.tick + 1;
    } else if (self.maxFrames > 0 && ['skill', 'variant', 'counter'].includes(self.action)) {
      input.commands.push(
        canSuper(self) ? 'super' : self.action === 'variant' ? 'exSkill' : 'exVariant',
      );
    } else if (
      ['upper', 'heavy', 'variant', 'counter'].includes(self.action) &&
      random(b) < level.confirm
    )
      input.commands.push('jump');
    else if (self.action === 'air' || self.action === 'airLightKick') input.commands.push('heavy');
    else if (['lightKick', 'crouchKick'].includes(self.action) && random(b) < level.confirm)
      input.commands.push('heavy');
    else if (self.action === 'closeHeavy' && random(b) < level.confirm)
      input.commands.push(self.id === 'deepseek' || self.cooldown > 0 ? 'uppercut' : 'skill');
    else if (['light1', 'light2', 'low'].includes(self.action)) {
      const confirm = random(b);
      if (self.action === 'light2' && canSuper(self) && confirm < level.confirm * 0.35)
        input.commands.push('super');
      else if (confirm < level.confirm) {
        const follow = roleConfirm(b, self);
        input.commands.push(follow ?? (self.action === 'low' ? 'lightKick' : 'light'));
      } else input.commands.push(self.action === 'low' ? 'lightKick' : 'light');
    }
  }
  if (b.tick < brain.decisionAt) return input;
  brain.decisionAt = b.tick + level.decision + Math.floor(random(b) * 13);
  const old = brain.history[0] ?? observe(b),
    enemy = old.fighters[0]!;
  const delta = enemy.x - self.x,
    distance = Math.abs(delta),
    toward = delta < 0 ? -1 : 1;
  const roll = random(b);
  if (
    self.y === 0 &&
    ['idle', 'walk', 'crouch', 'guard'].includes(self.action) &&
    isRecoveryPunishable(enemy) &&
    roll < level.confirm
  ) {
    const jabReach = moveFor(self.id, 'light1')!.strikes[0]!.reach;
    if (distance <= jabReach) input.commands.push('light');
    else if (distance <= 230) {
      input.move = toward;
      input.commands.push('dash');
    }
    if (input.commands.length) {
      brain.move = input.move;
      brain.guard = false;
      brain.crouch = false;
      return input;
    }
  }
  if (self.maxFrames > 0 && canEX(self) && distance < 200 && self.y === 0) {
    input.commands.push('exSkill');
    return input;
  }
  if (self.energy >= 200 && self.maxFrames === 0 && distance > 240 && roll < 0.3) {
    input.commands.push('max');
    return input;
  }
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
      (self.id === 'doubao' && distance > 250 && roll > 0.65) ||
      (self.id === 'client' && distance < 80 && roll > 0.45) ||
      (self.id === 'prompt_sage' && distance > 150 && distance < 350 && roll > 0.6) ||
      (self.id === 'unplug_uncle' && distance < 220 && roll > 0.6))
  ) {
    input.commands.push('meme');
  } else if (self.y > 0 && distance < 115 && Math.abs(self.y - enemy.y) < 85) {
    input.move = distance > 75 ? toward : 0;
    input.commands.push(roll < 0.5 ? 'lightKick' : 'light');
  } else if (projectile && roll < 0.6) {
    if (roll < 0.15) input.commands.push('roll');
    else if (roll < 0.3) input.commands.push('jump');
    else input.guard = true;
  } else if (enemy.y > 30 && distance < 140) {
    input.crouch = true;
    input.commands.push('heavy');
  } else if (distance > 240) {
    input.move = toward;
    if (roll > 0.8) input.commands.push('dash');
    if (['doubao', 'prompt_sage'].includes(self.id) && roll < 0.45) input.commands.push('skill');
    else if (roll < 0.15) input.commands.push('jump');
  } else if (distance > 100) {
    input.move = toward;
    if (self.id === 'gpt' && distance < 200 && roll < 0.45) input.commands.push('skill');
    else if (['doubao', 'prompt_sage'].includes(self.id) && roll < 0.35)
      input.commands.push('skill');
    else if (['client', 'unplug_uncle'].includes(self.id) && distance < 165 && roll < 0.55)
      input.commands.push('skill');
    else if (self.energy >= 100 && roll > 0.8) input.commands.push('super');
  } else if (self.energy >= 25 && self.variantCooldown === 0 && distance < 160 && roll > 0.7)
    input.commands.push('variant');
  else if (distance < 64 && (enemy.action === 'guard' || roll > 0.8))
    input.commands.push(self.id === 'client' && roll > 0.35 ? 'commandGrab' : 'throw');
  else if (roll < 0.2) input.guard = true;
  else if (self.id === 'deepseek' && roll < 0.4) input.commands.push('skill');
  else if (roll < 0.4) {
    input.crouch = roll < 0.3;
    input.commands.push('lightKick');
  } else if (roll < 0.6) input.commands.push('heavy');
  else {
    input.commands.push('light');
    input.move = distance > 68 ? toward : 0;
  }
  if (input.guard) input.crouch = ['low', 'sweep'].includes(enemy.action);
  brain.move = input.move;
  brain.guard = input.guard;
  brain.crouch = input.crouch;
  return input;
}
