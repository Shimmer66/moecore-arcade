export type Slot = 0 | 1;
export type Action =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'guard'
  | 'dodge'
  | 'light'
  | 'heavy'
  | 'special'
  | 'super'
  | 'hurt'
  | 'ko';

export interface Input {
  move: -1 | 0 | 1;
  guard: boolean;
  jump: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
  dodge: boolean;
}

export interface Fighter {
  slot: Slot;
  name: string;
  x: number;
  y: number;
  vy: number;
  facing: -1 | 1;
  hp: number;
  meter: number;
  action: Action;
  age: number;
  stun: number;
  invulnerable: number;
  didHit: number[];
  combo: number;
  comboTimer: number;
  maxCombo: number;
  damage: number;
}

export interface BattleEvent {
  id: number;
  kind: 'hit' | 'block' | 'dodge' | 'super' | 'round';
  actor: Slot;
  x: number;
  y: number;
  text: string;
}

export interface Battle {
  phase: 'countdown' | 'fight' | 'round-end' | 'done';
  phaseFrames: number;
  round: number;
  scores: [number, number];
  roundWinner: Slot | null;
  timer: number;
  elapsed: number;
  tick: number;
  fighters: [Fighter, Fighter];
  events: BattleEvent[];
  nextId: number;
  shake: number;
  winner: Slot | null;
}

export const FPS = 60;
export const ROUND_SECONDS = 45;
export const MAX_HP = 1000;
export const emptyInput = (): Input => ({
  move: 0,
  guard: false,
  jump: false,
  light: false,
  heavy: false,
  special: false,
  dodge: false,
});

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function createFighter(slot: Slot): Fighter {
  return {
    slot,
    name: slot === 0 ? '砂岚·琥珀' : '暮钟·靛青',
    x: slot === 0 ? 260 : 700,
    y: 0,
    vy: 0,
    facing: slot === 0 ? 1 : -1,
    hp: MAX_HP,
    meter: 0,
    action: 'idle',
    age: 0,
    stun: 0,
    invulnerable: 0,
    didHit: [],
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    damage: 0,
  };
}

export function createBattle(): Battle {
  return {
    phase: 'countdown',
    phaseFrames: 90,
    round: 1,
    scores: [0, 0],
    roundWinner: null,
    timer: ROUND_SECONDS * FPS,
    elapsed: 0,
    tick: 0,
    fighters: [createFighter(0), createFighter(1)],
    events: [],
    nextId: 1,
    shake: 0,
    winner: null,
  };
}

function begin(fighter: Fighter, action: Action) {
  fighter.action = action;
  fighter.age = 0;
  fighter.didHit = [];
}

function free(fighter: Fighter) {
  return ['idle', 'walk', 'jump', 'guard'].includes(fighter.action) && fighter.stun <= 0;
}

function event(battle: Battle, kind: BattleEvent['kind'], fighter: Fighter, text: string) {
  battle.events.push({
    id: battle.nextId++,
    kind,
    actor: fighter.slot,
    x: fighter.x,
    y: fighter.y + 120,
    text,
  });
  battle.events = battle.events.slice(-12);
}

function resetRound(battle: Battle) {
  battle.phase = 'countdown';
  battle.phaseFrames = 90;
  battle.timer = ROUND_SECONDS * FPS;
  battle.roundWinner = null;
  battle.fighters = [createFighter(0), createFighter(1)];
}

function endRound(battle: Battle, winner: Slot | null) {
  battle.phase = 'round-end';
  battle.phaseFrames = 150;
  battle.roundWinner = winner;
  if (winner !== null) battle.scores[winner] += 1;
  event(
    battle,
    'round',
    battle.fighters[winner ?? 0],
    winner === null ? '双星静止' : `${battle.fighters[winner].name} 拿下回合`,
  );
}

function finishAction(fighter: Fighter) {
  const duration: Partial<Record<Action, number>> = {
    dodge: 24,
    light: 18,
    heavy: 34,
    special: 44,
    super: 82,
  };
  if (duration[fighter.action] && fighter.age >= duration[fighter.action]!) {
    begin(fighter, fighter.y > 0 ? 'jump' : 'idle');
  }
}

function updateFighter(fighter: Fighter, input: Input) {
  if (fighter.invulnerable > 0) fighter.invulnerable--;
  if (fighter.comboTimer > 0) fighter.comboTimer--;
  else fighter.combo = 0;

  if (fighter.stun > 0) {
    fighter.stun--;
    if (fighter.stun === 0 && fighter.action !== 'ko') {
      begin(fighter, fighter.y > 0 ? 'jump' : 'idle');
    }
  } else if (free(fighter)) {
    if (input.dodge && fighter.y === 0) {
      begin(fighter, 'dodge');
      fighter.invulnerable = 16;
    } else if (input.special && fighter.meter >= 30) {
      if (fighter.meter >= 100) {
        fighter.meter = 0;
        begin(fighter, 'super');
      } else {
        fighter.meter -= 30;
        begin(fighter, 'special');
      }
    } else if (input.heavy) {
      begin(fighter, 'heavy');
    } else if (input.light) {
      begin(fighter, 'light');
    } else if (input.jump && fighter.y === 0) {
      begin(fighter, 'jump');
      fighter.vy = 590;
    } else if (input.guard && fighter.y === 0) {
      fighter.action = 'guard';
      fighter.age = 0;
    } else if (input.move !== 0) {
      fighter.action = fighter.y > 0 ? 'jump' : 'walk';
      fighter.x += input.move * (fighter.y > 0 ? 4.2 : 5.2);
    } else {
      fighter.action = fighter.y > 0 ? 'jump' : 'idle';
    }
  }

  if (fighter.action === 'dodge') {
    fighter.x += fighter.facing * (fighter.age < 10 ? -9 : -3);
  }
  if (fighter.y > 0 || fighter.vy > 0) {
    fighter.y += fighter.vy / FPS;
    fighter.vy -= 1500 / FPS;
    if (fighter.y <= 0) {
      fighter.y = 0;
      fighter.vy = 0;
      if (fighter.action === 'jump') fighter.action = 'idle';
    }
  }
  fighter.x = clamp(fighter.x, 72, 888);
  fighter.age++;
  finishAction(fighter);
}

interface Strike {
  frame: number;
  reach: number;
  damage: number;
  stun: number;
  push: number;
}

function strikes(fighter: Fighter): Strike[] {
  if (fighter.action === 'light') return [{ frame: 7, reach: 86, damage: 48, stun: 12, push: 20 }];
  if (fighter.action === 'heavy')
    return [{ frame: 16, reach: 116, damage: 104, stun: 22, push: 48 }];
  if (fighter.action === 'special')
    return [9, 15, 21, 27].map((frame) => ({
      frame,
      reach: 138,
      damage: 34,
      stun: 9,
      push: 13,
    }));
  if (fighter.action === 'super')
    return [27, 34, 41, 48, 55].map((frame, index) => ({
      frame,
      reach: 176,
      damage: index === 4 ? 94 : 48,
      stun: index === 4 ? 30 : 10,
      push: index === 4 ? 80 : 10,
    }));
  return [];
}

function resolveStrike(battle: Battle, attacker: Fighter, defender: Fighter) {
  for (const strike of strikes(attacker)) {
    if (attacker.age !== strike.frame || attacker.didHit.includes(strike.frame)) continue;
    attacker.didHit.push(strike.frame);
    const ahead = (defender.x - attacker.x) * attacker.facing;
    const vertical = Math.abs(defender.y - attacker.y);
    if (ahead < -20 || ahead > strike.reach || vertical > 96 || defender.invulnerable > 0) {
      if (defender.invulnerable > 0 && Math.abs(defender.x - attacker.x) < strike.reach) {
        event(battle, 'dodge', defender, '残像闪避');
      }
      continue;
    }

    const guarded = defender.action === 'guard' && defender.facing === -attacker.facing;
    const damage = guarded ? Math.ceil(strike.damage * 0.18) : strike.damage;
    defender.hp = clamp(defender.hp - damage, 0, MAX_HP);
    defender.x = clamp(defender.x + attacker.facing * (guarded ? 8 : strike.push), 72, 888);
    if (attacker.action !== 'super') {
      attacker.meter = clamp(attacker.meter + (guarded ? 5 : 12), 0, 100);
    }
    defender.meter = clamp(defender.meter + (guarded ? 10 : 7), 0, 100);
    battle.shake = guarded ? 3 : attacker.action === 'super' ? 12 : 7;

    if (guarded) {
      defender.stun = 5;
      event(battle, 'block', defender, '铿');
      continue;
    }
    defender.stun = strike.stun;
    defender.action = defender.hp === 0 ? 'ko' : 'hurt';
    defender.age = 0;
    attacker.combo = attacker.comboTimer > 0 ? attacker.combo + 1 : 1;
    attacker.comboTimer = 55;
    attacker.maxCombo = Math.max(attacker.maxCombo, attacker.combo);
    attacker.damage += damage;
    event(
      battle,
      attacker.action === 'super' ? 'super' : 'hit',
      attacker,
      attacker.combo >= 3 ? `${attacker.combo} 连击` : '砰',
    );
  }
}

export function step(battle: Battle, inputs: [Input, Input]): Battle {
  if (battle.phase === 'done') return battle;
  battle.tick++;
  battle.events = battle.events.filter((item) => battle.nextId - item.id < 28);
  if (battle.shake > 0) battle.shake--;

  if (battle.phase === 'countdown') {
    battle.phaseFrames--;
    if (battle.phaseFrames <= 0) battle.phase = 'fight';
    return battle;
  }
  if (battle.phase === 'round-end') {
    battle.phaseFrames--;
    if (battle.phaseFrames <= 0) {
      if (battle.scores[0] >= 2 || battle.scores[1] >= 2 || battle.round >= 3) {
        battle.phase = 'done';
        battle.winner =
          battle.scores[0] === battle.scores[1]
            ? null
            : battle.scores[0] > battle.scores[1]
              ? 0
              : 1;
      } else {
        battle.round++;
        resetRound(battle);
      }
    }
    return battle;
  }

  battle.elapsed++;
  battle.timer--;
  const [left, right] = battle.fighters;
  left.facing = left.x <= right.x ? 1 : -1;
  right.facing = right.x <= left.x ? 1 : -1;
  updateFighter(left, inputs[0]);
  updateFighter(right, inputs[1]);
  resolveStrike(battle, left, right);
  resolveStrike(battle, right, left);

  const separation = right.x - left.x;
  if (Math.abs(separation) < 74) {
    const correction = (74 - Math.abs(separation)) / 2;
    const direction = separation >= 0 ? 1 : -1;
    left.x = clamp(left.x - correction * direction, 72, 888);
    right.x = clamp(right.x + correction * direction, 72, 888);
  }

  if (left.hp === 0 || right.hp === 0) {
    endRound(battle, left.hp === right.hp ? null : left.hp > right.hp ? 0 : 1);
  } else if (battle.timer <= 0) {
    endRound(battle, left.hp === right.hp ? null : left.hp > right.hp ? 0 : 1);
  }
  return battle;
}
