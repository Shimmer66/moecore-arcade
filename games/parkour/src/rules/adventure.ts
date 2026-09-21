import {
  FINISH_DISTANCE,
  FIXED_DT,
  PLAYER_WIDTH,
  STANDING_HEIGHT,
  CROUCHING_HEIGHT,
  OBSTACLE_WIDTH,
} from '../config/constants';
import { start, step } from './run';
import type { Obstacle, PlayerInput, RunState } from './types';

export type PickupKind = 'coin' | 'star' | 'magnet' | 'shield' | 'heart';
export interface Pickup {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly kind: PickupKind;
}
export interface AdventureInput extends PlayerInput {
  readonly dash: boolean;
}
export interface Adventure {
  readonly run: RunState;
  readonly health: number;
  readonly shield: boolean;
  readonly energy: number;
  readonly dashTicks: number;
  readonly dashHeld: boolean;
  readonly invulnerableTicks: number;
  readonly magnetTicks: number;
  readonly airJumps: number;
  readonly pickups: readonly Pickup[];
  readonly generatedThrough: number;
  readonly coins: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly dodged: number;
  readonly dashes: number;
  readonly bonus: number;
  readonly missionAwards: readonly number[];
  readonly notice: string;
  readonly noticeUntil: number;
  readonly chapter: number;
}

export const multiplierFor = (combo: number): number => 1 + Math.min(4, Math.floor(combo / 10));

export function seedForSession(id: string): number {
  let seed = 2166136261;
  for (let index = 0; index < id.length; index += 1)
    seed = Math.imul(seed ^ id.charCodeAt(index), 16777619);
  return seed >>> 0;
}

function rewardsFor(obstacle: Obstacle): Pickup[] {
  const pickups: Pickup[] = Array.from({ length: 5 }, (_, index) => ({
    id: `${obstacle.id}:coin:${index}`,
    x: obstacle.kind === 'ground' ? obstacle.x - 2.8 + index * 1.2 : obstacle.x - 1.4 + index * 0.8,
    y: obstacle.kind === 'ground' ? [1.25, 2.1, 2.6, 2.1, 1.25][index]! : 0.45,
    kind: 'coin',
  }));
  if (obstacle.id % 4 === 2)
    pickups.push({
      id: `${obstacle.id}:star`,
      x: obstacle.x + 3.5,
      y: 3.4,
      kind: 'star',
    });
  if (obstacle.id % 5 === 3) {
    const kinds = ['magnet', 'shield', 'heart'] as const;
    pickups.push({
      id: `${obstacle.id}:power`,
      x: obstacle.x + 6,
      y: 1.1,
      kind: kinds[Math.floor(obstacle.id / 5) % 3]!,
    });
  }
  return pickups.filter((pickup) => pickup.x < FINISH_DISTANCE);
}

export function beginAdventure(seed: number): Adventure {
  const run = start(seed);
  return {
    run,
    health: 3,
    shield: false,
    energy: 0,
    dashTicks: 0,
    dashHeld: false,
    invulnerableTicks: 0,
    magnetTicks: 0,
    airJumps: 0,
    pickups: run.obstacles.flatMap(rewardsFor),
    generatedThrough: run.generator.nextId - 1,
    coins: 0,
    combo: 0,
    bestCombo: 0,
    dodged: 0,
    dashes: 0,
    bonus: 0,
    missionAwards: [],
    notice: '',
    noticeUntil: 0,
    chapter: 0,
  };
}

export function advanceAdventure(state: Adventure, input: AdventureInput): Adventure {
  if (state.run.status === 'ended') return state;
  let energy = state.energy;
  let dashTicks = Math.max(0, state.dashTicks - 1);
  let invulnerableTicks = Math.max(0, state.invulnerableTicks - 1);
  let magnetTicks = Math.max(0, state.magnetTicks - 1);
  let health = state.health;
  let shield = state.shield;
  let dashes = state.dashes;
  let combo = state.combo;
  let bonus = state.bonus;
  let dodged = state.dodged;
  let coins = state.coins;
  let airJumps = state.run.player.grounded ? 0 : state.airJumps;
  let run: RunState = state.run;
  let notice = state.notice;
  let noticeUntil = state.noticeUntil;
  const notify = (text: string) => {
    notice = text;
    noticeUntil = state.run.tick + 72;
  };

  if (input.dash && !state.dashHeld && energy >= 100 && dashTicks === 0) {
    energy = 0;
    dashTicks = 84;
    dashes += 1;
    notify('冲刺！');
  }

  // Reuse the fixed-step integrator; the second jump only changes its initial velocity.
  if (input.jump && !run.player.jumpHeld && !run.player.grounded && airJumps === 0) {
    airJumps = 1;
    run = { ...run, player: { ...run.player, velocityY: 7.8 } };
  }
  if (input.crouch && !run.player.grounded) {
    run = { ...run, player: { ...run.player, velocityY: Math.min(-11, run.player.velocityY) } };
  }

  if (dashTicks > 0 || invulnerableTicks > 0) {
    const speed = run.speed * (dashTicks > 0 ? 1.25 : 1);
    const protectedObstacles = run.obstacles.filter(
      (obstacle) =>
        obstacle.x <= run.distance + PLAYER_WIDTH + speed * FIXED_DT &&
        obstacle.x + OBSTACLE_WIDTH >= run.distance,
    );
    if (dashTicks > 0) {
      for (let index = 0; index < protectedObstacles.length; index += 1) {
        combo += 1;
        dodged += 1;
        bonus += 30 * multiplierFor(combo);
      }
    }
    run = {
      ...run,
      speed,
      obstacles: run.obstacles.filter((obstacle) => !protectedObstacles.includes(obstacle)),
    };
  }

  run = step(run, input);
  for (const event of run.events) {
    if (event.kind !== 'collision') {
      combo += 1;
      dodged += 1;
      energy = Math.min(100, energy + 14);
      bonus += 30 * multiplierFor(combo);
      if (dodged % 5 === 0) notify(`连续越过 ${dodged} 个障碍`);
    } else {
      if (shield) {
        shield = false;
        notify('护盾抵挡');
      } else {
        health -= 1;
        combo = 0;
        notify(health > 0 ? '受伤，继续前进！' : '本次旅程结束');
      }
      if (health > 0) {
        invulnerableTicks = 72;
        run = {
          ...run,
          status: 'running',
          result: null,
          obstacles: run.obstacles.filter((obstacle) => obstacle.id !== event.obstacleId),
        };
      }
    }
  }

  const height = run.player.crouching ? CROUCHING_HEIGHT : STANDING_HEIGHT;
  const remaining: Pickup[] = [];
  for (const pickup of state.pickups) {
    const inReach =
      pickup.x >= state.run.distance - 0.5 &&
      pickup.x <= run.distance + PLAYER_WIDTH + (magnetTicks > 0 ? 3 : 0.35);
    const inHeight = magnetTicks > 0 || Math.abs(pickup.y - (run.player.y + height * 0.55)) < 0.82;
    if (inReach && inHeight && health > 0) {
      if (pickup.kind === 'coin' || pickup.kind === 'star') {
        coins += pickup.kind === 'star' ? 5 : 1;
        combo += 1;
        bonus += (pickup.kind === 'star' ? 60 : 10) * multiplierFor(combo);
        energy = Math.min(100, energy + (pickup.kind === 'star' ? 20 : 5));
        if (pickup.kind === 'star') notify('高空星星 +5');
      } else if (pickup.kind === 'magnet') {
        magnetTicks = 420;
        notify('磁铁生效');
      } else if (pickup.kind === 'shield') {
        shield = true;
        notify('获得护盾');
      } else {
        health = Math.min(3, health + 1);
        notify('恢复体力');
      }
    } else if (pickup.x > run.distance - 1) remaining.push(pickup);
  }

  for (const obstacle of run.obstacles) {
    if (obstacle.id > state.generatedThrough) remaining.push(...rewardsFor(obstacle));
  }
  const bestCombo = Math.max(combo, state.bestCombo);
  const awards = [...state.missionAwards];
  for (const [index, complete] of [dodged >= 10, coins >= 30, bestCombo >= 25].entries()) {
    if (complete && !awards.includes(index)) {
      awards.push(index);
      bonus += 300;
      notify('挑战达成 +300');
    }
  }
  const chapter = Math.min(2, Math.floor(run.distance / 400));
  if (chapter > state.chapter && health > 0) {
    if (chapter === 1) health = Math.min(3, health + 1);
    if (chapter === 2) energy = 100;
    // Give the story checkpoint a safe resume window without changing the course.
    invulnerableTicks = Math.max(invulnerableTicks, 60);
  }
  return {
    run,
    health,
    shield,
    energy,
    dashTicks,
    dashHeld: input.dash,
    invulnerableTicks,
    magnetTicks,
    airJumps,
    pickups: remaining,
    generatedThrough: Math.max(state.generatedThrough, run.generator.nextId - 1),
    coins,
    combo,
    bestCombo,
    dodged,
    dashes,
    bonus,
    missionAwards: awards,
    notice,
    noticeUntil,
    chapter,
  };
}
