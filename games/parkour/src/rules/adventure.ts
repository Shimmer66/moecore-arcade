import { FIXED_DT, PLAYER_WIDTH, OBSTACLE_WIDTH } from '../config/constants';
import { levelFor, shiftObstacles, shiftSpeed, type LevelId } from '../config/shift';
import { thinkingModes, type ThinkingMode } from '../config/thinking';
import type { QuipId } from '../config/story';
import { playerBox, sweptContact } from './collision';
import { createGenerator, generateObstacles } from './obstacles';
import { start, step } from './run';
import type { EndReason, Obstacle, PlayerInput, RunState } from './types';

export const TAIL_TICKS = 24;
export const TAIL_COOLDOWN = 40;
export const BURST_TICKS = 132;
export const SLOW_TICKS = 36;
export const PAPER_SPEED = 5;
export const RETURN_SPEED = 24;
export const TAIL_REACH = 3.4;
export const CONTEXT_CAPACITY = 6;

export interface Pickup {
  readonly id: string;
  readonly kind: 'bubble' | 'rice';
  readonly x: number;
  readonly y: number;
}
export interface Printer {
  readonly id: number;
  readonly x: number;
  readonly fireTick: number | null;
  readonly fired: boolean;
  readonly shotsRemaining: number;
  readonly jammed: boolean;
  readonly receiptUntil: number;
}
export interface Paper {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly returned: boolean;
}
export interface RequestQueue {
  readonly id: number;
  readonly home: number;
  readonly x: number;
}
export interface Feedback {
  readonly id: string;
  readonly kind:
    | 'return'
    | 'break'
    | 'rice'
    | 'feast'
    | 'parry'
    | 'perfect'
    | 'verified'
    | 'shield'
    | 'milestone';
  readonly x: number;
  readonly y: number;
  readonly until: number;
}
export interface AdventureInput extends PlayerInput {
  readonly tail: boolean;
}
export interface Adventure {
  readonly levelId: LevelId;
  readonly thinkingMode: ThinkingMode;
  readonly run: RunState;
  readonly realTick: number;
  readonly health: number;
  readonly energy: number;
  readonly dashTicks: number;
  readonly slowTicks: number;
  readonly tailTicks: number;
  readonly tailCooldown: number;
  readonly tailConnected: boolean;
  readonly tailHeld: boolean;
  readonly jumpHeld: boolean;
  readonly jumpQueued: boolean;
  readonly invulnerableTicks: number;
  readonly hurtUntil: number;
  readonly airJumps: number;
  readonly pickups: readonly Pickup[];
  readonly printers: readonly Printer[];
  readonly papers: readonly Paper[];
  readonly queues: readonly RequestQueue[];
  readonly hallucinations: readonly {
    readonly id: number;
    readonly x: number;
    readonly y: number;
  }[];
  readonly feedback: readonly Feedback[];
  readonly bubbles: number;
  readonly rice: number;
  readonly riceStreak: number;
  readonly riceFeasts: number;
  readonly milestones: number;
  readonly returns: number;
  readonly parries: number;
  readonly perfectParries: number;
  readonly verified: number;
  readonly hallucinationHits: number;
  readonly context: number;
  readonly shieldsUsed: number;
  readonly slaps: number;
  readonly breaks: number;
  readonly combo: number;
  readonly bestCombo: number;
  readonly dodged: number;
  readonly bursts: number;
  readonly hits: number;
  readonly bonus: number;
  readonly hasAnswer: boolean;
  readonly quip: QuipId;
  readonly quipUntil: number;
}

export const multiplierFor = (combo: number): number => 1 + Math.min(4, Math.floor(combo / 8));
// Use the same target decision for input and the control label. A full charge
// must not prevent returning a nearby request or verifying a fake pickup.
export function tailActionFor(state: Adventure): 'return' | 'verify' | 'burst' | 'tail' {
  {
    const x = state.run.distance;
    const y = state.run.player.y;
    const reachable = (targetX: number, targetY: number) =>
      targetX >= x &&
      targetX - x <= TAIL_REACH + 0.8 &&
      targetY + 0.45 > y + 0.5 &&
      targetY < y + 2.15;
    if (state.papers.some((paper) => !paper.returned && reachable(paper.x, paper.y)))
      return 'return';
    if (state.hallucinations.some((item) => reachable(item.x, item.y))) return 'verify';
  }
  return state.energy === 100 ? 'burst' : 'tail';
}
// Reserve whole obstacle slots for encounters so a moving queue or printer
// cannot be wedged into the recovery space after a low ceiling.
function endlessEncounters(obstacles: readonly Obstacle[]) {
  const printerSlots = obstacles.filter((item) => item.id % 12 === 7);
  const queueSlots = obstacles.filter((item) => item.id % 12 === 4);
  return {
    obstacles: obstacles.filter((item) => item.id % 12 !== 7 && item.id % 12 !== 4),
    printers: printerSlots.map((item): Printer => ({
      id: item.id,
      x: item.x,
      fireTick: null,
      fired: false,
      shotsRemaining: item.x >= 1200 ? 2 : 1,
      jammed: false,
      receiptUntil: 0,
    })),
    queues: queueSlots.map((item) => ({ id: item.id, home: item.x, x: item.x })),
    hallucinations: obstacles
      .filter((item) => item.id % 12 === 10)
      .map((item) => ({ id: item.id, x: item.x + 9, y: 1.8 })),
  };
}
function pickupsFor(obstacles: readonly Obstacle[], endless = false): Pickup[] {
  return obstacles
    .filter((item) => endless || item.id < 100)
    .flatMap((item) => [
      ...(endless ? [4] : [5, 4, 3]).map((offset) => ({
        id: `bubble:${item.id}:${offset}`,
        kind: 'bubble' as const,
        x: item.x - offset,
        // Ground hazards outline the rising reward route. Low beams retain
        // a low trail, making jump/slide choices readable before contact.
        y: !endless && item.kind === 'ground' ? 0.65 + (5 - offset) * 0.85 : 0.65,
      })),
      ...(item.kind === 'ground'
        ? [{ id: `rice:${item.id}`, kind: 'rice' as const, x: item.x + 2.8, y: 4.1 }]
        : []),
    ]);
}
export function seedForSession(id: string): number {
  let seed = 2166136261;
  for (let index = 0; index < id.length; index += 1)
    seed = Math.imul(seed ^ id.charCodeAt(index), 16777619);
  return seed >>> 0;
}
export function beginAdventure(
  seed: number,
  thinkingMode: ThinkingMode = 'normal',
  levelId: LevelId = 0,
): Adventure {
  const base = start(seed);
  const level = levelFor(levelId);
  const endless = levelId === 3;
  const generated = endless
    ? generateObstacles({ ...createGenerator(seed), nextDistance: 32 }, 70, true)
    : null;
  const encounters = generated ? endlessEncounters(generated.obstacles) : null;
  const obstacles = encounters?.obstacles ?? shiftObstacles(seed, levelId);
  const pickups = pickupsFor(obstacles, endless);
  return {
    run: {
      ...base,
      ...(endless ? { endless: true as const } : {}),
      finishDistance: level.finishDistance,
      speed: shiftSpeed(0, levelId) * thinkingModes[thinkingMode].speed,
      obstacles,
      generator: generated?.generator ?? {
        ...base.generator,
        nextDistance: level.finishDistance + 60,
      },
    },
    levelId,
    realTick: 0,
    thinkingMode,
    health: 3,
    energy: 20,
    dashTicks: 0,
    slowTicks: 0,
    tailTicks: 0,
    tailCooldown: 0,
    tailConnected: false,
    tailHeld: false,
    jumpHeld: false,
    jumpQueued: false,
    invulnerableTicks: 0,
    hurtUntil: 0,
    airJumps: 0,
    pickups,
    printers:
      encounters?.printers ??
      level.printers.map((x, id) => ({
        id,
        x,
        fireTick: null,
        fired: false,
        shotsRemaining: level.doubleShotPrinters.includes(id) ? 2 : 1,
        jammed: false,
        receiptUntil: 0,
      })),
    queues:
      encounters?.queues ??
      level.queues.map((home, id) => ({
        id,
        home,
        x: home + Math.sin(id) * level.queueAmplitude,
      })),
    hallucinations:
      encounters?.hallucinations ?? level.hallucinations.map((x, id) => ({ id, x, y: 1.8 })),
    papers: [],
    feedback: [],
    bubbles: 0,
    rice: 0,
    riceStreak: 0,
    riceFeasts: 0,
    milestones: 0,
    returns: 0,
    parries: 0,
    perfectParries: 0,
    slaps: 0,
    verified: 0,
    hallucinationHits: 0,
    context: 0,
    shieldsUsed: 0,
    breaks: 0,
    combo: 0,
    bestCombo: 0,
    dodged: 0,
    bursts: 0,
    hits: 0,
    bonus: 0,
    hasAnswer: false,
    quip: 'ready',
    quipUntil: 130,
  };
}

export function advanceAdventure(state: Adventure, input: AdventureInput): Adventure {
  if (state.run.status === 'ended') return state;
  const level = levelFor(state.levelId);
  const next = {
    ...state,
    realTick: state.realTick + 1,
    dashTicks: Math.max(0, state.dashTicks - 1),
    slowTicks: Math.max(0, state.slowTicks - 1),
    tailTicks: Math.max(0, state.tailTicks - 1),
    tailCooldown: Math.max(0, state.tailCooldown - 1),
    invulnerableTicks: Math.max(0, state.invulnerableTicks - 1),
    jumpQueued: state.jumpQueued || (input.jump && !state.jumpHeld),
    jumpHeld: input.jump,
    tailHeld: input.tail,
  };
  const feedback = state.feedback.filter((effect) => effect.until > next.realTick);
  const effect = (kind: Feedback['kind'], x: number, y = 1) => {
    feedback.push({
      id: `${next.realTick}:${feedback.length}`,
      kind,
      x,
      y,
      until: next.realTick + 65,
    });
  };
  const say = (id: QuipId, force = false) => {
    if (force || next.realTick >= next.quipUntil) {
      next.quip = id;
      next.quipUntil = next.realTick + 130;
    }
  };
  const charge = (amount: number) => {
    const before = next.energy;
    next.energy = Math.min(100, before + amount);
    if (before < 100 && next.energy === 100) say('charged');
  };
  const award = (points: number, energy = 0) => {
    next.combo += 1;
    next.bestCombo = Math.max(next.bestCombo, next.combo);
    next.bonus += points * multiplierFor(next.combo);
    charge(energy);
  };
  const damage = (quip: QuipId, reason: EndReason) => {
    next.riceStreak = 0;
    if (next.context === CONTEXT_CAPACITY) {
      next.context = 0;
      next.shieldsUsed += 1;
      next.invulnerableTicks = 60;
      effect('shield', next.run.distance, 1.8);
      say('shield', true);
      return;
    }
    next.health -= 1;
    next.hits += 1;
    next.combo = 0;
    next.context = 0;
    next.invulnerableTicks = 72;
    next.hurtUntil = next.realTick + 30;
    say(quip, true);
    if (next.health === 0)
      next.run = {
        ...next.run,
        status: 'ended',
        result: { distance: next.run.distance, score: next.run.score, reason },
      };
  };
  if (state.tailTicks > 0 && next.tailTicks === 0 && !state.tailConnected) say('tailMiss');
  if (input.tail && !state.tailHeld && next.tailCooldown === 0 && next.dashTicks === 0) {
    if (tailActionFor(state) === 'burst') {
      next.energy = 0;
      next.dashTicks = BURST_TICKS;
      next.slowTicks = 0;
      next.tailTicks = 0;
      next.bursts += 1;
      say('burst', true);
    } else {
      next.tailTicks = TAIL_TICKS;
      next.tailCooldown = TAIL_COOLDOWN;
      next.tailConnected = false;
      next.slaps += 1;
    }
  }
  next.feedback = feedback;
  // Real-time ability windows keep their duration; a quick jump survives a skipped world step.
  if (next.slowTicks > 0 && next.realTick % 2 === 1) return next;

  let run = next.run;
  next.airJumps = run.player.grounded ? 0 : state.airJumps;
  if (next.jumpQueued && !input.crouch) {
    if (run.player.grounded) say('jump');
    else if (next.airJumps === 0) {
      next.airJumps = 1;
      run = { ...run, player: { ...run.player, velocityY: 7.8 } };
    }
  }
  if (input.crouch && !run.player.grounded)
    run = { ...run, player: { ...run.player, velocityY: Math.min(-11, run.player.velocityY) } };
  run = {
    ...run,
    speed:
      shiftSpeed(run.distance, next.levelId) *
      thinkingModes[next.thinkingMode].speed *
      (next.dashTicks > 0 ? 1.75 : 1),
    player: { ...run.player, jumpHeld: false },
  };
  if (next.dashTicks > 0 || next.invulnerableTicks > 0) {
    const cleared = run.obstacles.filter(
      (obstacle) =>
        obstacle.x <= run.distance + PLAYER_WIDTH + run.speed * FIXED_DT &&
        obstacle.x + OBSTACLE_WIDTH >= run.distance,
    );
    if (next.dashTicks > 0)
      for (const obstacle of cleared) {
        next.breaks += 1;
        award(40);
        effect('break', obstacle.x);
      }
    run = { ...run, obstacles: run.obstacles.filter((item) => !cleared.includes(item)) };
  }
  const before = run;
  next.run = step(run, { jump: next.jumpQueued, crouch: input.crouch });
  next.jumpQueued = false;
  for (const event of next.run.events) {
    if (event.kind === 'collision') {
      const air = next.run.result?.reason === 'air-collision';
      damage(air ? 'beamHit' : 'groundHit', air ? 'air-collision' : 'ground-collision');
      if (next.health > 0)
        next.run = {
          ...next.run,
          status: 'running',
          result: null,
          obstacles: next.run.obstacles.filter((item) => item.id !== event.obstacleId),
        };
    } else {
      next.dodged += 1;
      award(25, 3);
      say('clear');
    }
  }
  const to = playerBox(next.run);
  const from = { ...playerBox(before), height: to.height };
  const arcFrom = { x: from.x + 0.35, y: from.y + 0.5, width: TAIL_REACH, height: 1.65 };
  const arcTo = { ...arcFrom, x: to.x + 0.35, y: to.y + 0.5 };
  const papers: Paper[] = [];
  let printers = [...state.printers];
  for (const paper of state.papers) {
    if (next.run.status === 'ended') break;
    const moved = {
      ...paper,
      x: paper.x + (paper.returned ? RETURN_SPEED : -PAPER_SPEED) * FIXED_DT,
    };
    if (paper.returned) {
      const printer = printers.find((item) => item.id === paper.id);
      if (printer && moved.x + 0.45 >= printer.x - 0.5) {
        if (!printer.jammed) {
          printers = printers.map((item) =>
            item.id === printer.id
              ? {
                  ...item,
                  jammed: true,
                  fired: true,
                  shotsRemaining: 0,
                  receiptUntil: next.realTick + 100,
                }
              : item,
          );
          next.returns += 1;
          award(180, 30);
          effect('return', printer.x, 3.2);
          say('refund', true);
        }
      } else if (printer && moved.x < level.finishDistance + 20) papers.push(moved);
      continue;
    }
    const oldBox = { x: paper.x, y: paper.y, width: 0.45, height: 0.45 };
    const movedBox = { ...oldBox, x: moved.x };
    if (next.tailTicks > 0 && sweptContact(arcFrom, arcTo, oldBox, movedBox) !== null) {
      papers.push({ ...moved, returned: true });
      next.tailConnected = true;
      next.parries += 1;
      next.slowTicks = thinkingModes[next.thinkingMode].slowTicks;
      const perfect = next.tailTicks >= TAIL_TICKS - 5 && paper.x - before.distance <= 1.8;
      if (perfect) {
        next.perfectParries += 1;
        award(120, 10);
        // A clean counter can answer the next shot without waiting a full cooldown.
        next.tailCooldown = Math.min(next.tailCooldown, 12);
      }
      effect(perfect ? 'perfect' : 'parry', moved.x, moved.y);
      say(perfect ? 'perfect' : 'parry', true);
    } else if (sweptContact(from, to, oldBox, movedBox) !== null) {
      if (next.dashTicks > 0) {
        award(40);
        effect('break', moved.x);
      } else if (next.invulnerableTicks === 0) damage('paperHit', 'paper-collision');
    } else if (moved.x + 0.45 > next.run.distance) papers.push(moved);
    else {
      next.dodged += 1;
      award(25, 3);
    }
  }
  next.papers = papers;
  next.printers = printers.map((printer) => {
    if (printer.fired || printer.jammed || next.run.status === 'ended') return printer;
    if (printer.fireTick === null && printer.x - next.run.distance < 20) {
      say('printer', true);
      return { ...printer, fireTick: next.run.tick + 42 };
    }
    if (printer.fireTick !== null && next.run.tick >= printer.fireTick) {
      papers.push({ id: printer.id, x: printer.x - 0.4, y: 1.02, returned: false });
      const shotsRemaining = printer.shotsRemaining - 1;
      return {
        ...printer,
        shotsRemaining,
        fired: shotsRemaining === 0,
        fireTick: shotsRemaining > 0 ? next.run.tick + 18 : printer.fireTick,
      };
    }
    return printer;
  });
  next.queues = state.queues.flatMap((queue) => {
    if (next.run.status === 'ended') return [queue];
    const moved = {
      ...queue,
      x:
        queue.home +
        Math.sin(next.run.tick * FIXED_DT * level.queueFrequency + queue.id) * level.queueAmplitude,
    };
    const box = { x: queue.x, y: 0, width: 1.2, height: 0.65 };
    if (sweptContact(from, to, box, { ...box, x: moved.x }) !== null) {
      if (next.dashTicks > 0) {
        next.breaks += 1;
        award(60);
        effect('break', moved.x);
      } else if (next.invulnerableTicks === 0) damage('queueHit', 'queue-collision');
      return [];
    }
    if (moved.x + 1.2 < next.run.distance) {
      next.dodged += 1;
      award(40, 4);
      return [];
    }
    return [moved];
  });
  next.hallucinations = state.hallucinations.filter((item) => {
    if (next.run.status === 'ended') return true;
    const box = { x: item.x - 0.35, y: item.y - 0.3, width: 0.7, height: 0.6 };
    if (
      (next.tailTicks > 0 && sweptContact(arcFrom, arcTo, box) !== null) ||
      (next.dashTicks > 0 && sweptContact(from, to, box) !== null)
    ) {
      next.verified += 1;
      next.tailConnected = true;
      award(100, 15);
      effect('verified', item.x, item.y);
      say('verified', true);
      return false;
    }
    if (sweptContact(from, to, box) !== null) {
      next.hallucinationHits += 1;
      next.energy = Math.max(0, next.energy - 20);
      next.combo = 0;
      next.riceStreak = 0;
      say('hallucination', true);
      return false;
    }
    return item.x > next.run.distance - 1;
  });
  next.pickups = state.pickups.filter((pickup) => {
    if (next.run.status === 'ended') return true;
    const box = { x: pickup.x - 0.25, y: pickup.y - 0.25, width: 0.5, height: 0.5 };
    if (sweptContact(from, to, box) !== null) {
      if (pickup.kind === 'rice') {
        next.rice += 1;
        next.riceStreak += 1;
        const feast = next.riceStreak % 2 === 0;
        if (feast) {
          next.riceFeasts += 1;
          next.context = Math.min(CONTEXT_CAPACITY, next.context + 1);
        }
        award(feast ? 240 : 120, 35);
        effect(feast ? 'feast' : 'rice', pickup.x, pickup.y);
        say(feast ? 'riceFeast' : 'rice', true);
      } else {
        next.bubbles += 1;
        const contextBefore = next.context;
        next.context = Math.min(CONTEXT_CAPACITY, next.context + 1);
        if (contextBefore < CONTEXT_CAPACITY && next.context === CONTEXT_CAPACITY)
          say('context', true);
        award(10, 5);
      }
      return false;
    }
    if (pickup.x < next.run.distance - 1) {
      if (pickup.kind === 'rice') {
        next.riceStreak = 0;
        say('riceMiss');
      }
      return false;
    }
    return true;
  });
  const queueCue = (level.queues[0] ?? Infinity) - 16;
  if (before.distance < queueCue && next.run.distance >= queueCue) say('queue', true);
  if (
    state.levelId !== 3 &&
    !state.hasAnswer &&
    next.run.distance >= level.answerDistance &&
    next.health > 0
  ) {
    next.hasAnswer = true;
    next.energy = 100;
    next.bonus += 500;
    say('answer', true);
  }
  next.run = {
    ...next.run,
    speed:
      shiftSpeed(next.run.distance, next.levelId) *
      thinkingModes[next.thinkingMode].speed *
      (next.dashTicks > 0 ? 1.75 : 1),
  };
  if (state.levelId === 3 && next.run.status === 'running') {
    const newObstacles = next.run.obstacles.filter((item) => item.id >= state.run.generator.nextId);
    if (newObstacles.length) {
      const encounters = endlessEncounters(newObstacles);
      next.run = {
        ...next.run,
        obstacles: [
          ...next.run.obstacles.filter((item) => item.id < state.run.generator.nextId),
          ...encounters.obstacles,
        ],
      };
      next.pickups = [...next.pickups, ...pickupsFor(encounters.obstacles, true)];
      next.hallucinations = [...next.hallucinations, ...encounters.hallucinations];
      next.queues = [...next.queues, ...encounters.queues];
      next.printers = [...next.printers, ...encounters.printers];
    }
    next.printers = next.printers.filter(
      (printer) =>
        printer.x > next.run.distance - 30 || next.papers.some((paper) => paper.id === printer.id),
    );
    const milestones = Math.floor(next.run.distance / 500);
    if (milestones > state.milestones) {
      next.milestones = milestones;
      next.bonus += 250;
      charge(25);
      effect('milestone', next.run.distance, 2);
      say('milestone', true);
    }
  }
  return next;
}
