import { levels } from './levels';
export { levels } from './levels';

export interface Platform {
  readonly from: number;
  readonly to: number;
  readonly top: number;
}

export interface Trap {
  readonly kind: 'context' | 'mirage';
  readonly from: number;
  readonly to: number;
  readonly triggered: boolean;
  readonly verified: boolean;
}

export type Upgrade = 'spread' | 'rapid' | 'shield' | 'pierce';
export type Persona = 'deepseek' | 'gpt' | 'claude';
export type Phase = 'running' | 'upgrade' | 'level-complete' | 'won' | 'lost';

export const personas: Readonly<
  Record<Persona, { readonly name: string; readonly style: string; readonly perk: string }>
> = {
  deepseek: { name: 'DeepSeek 娘', style: '推演', perk: '子弹更容易命中敌人' },
  gpt: { name: 'GPT 娘', style: '联想', perk: '射击速度更快' },
  claude: { name: 'Claude 娘', style: '守护', perk: '开局多一层护盾' },
};

export interface Enemy {
  readonly kind: 'walker' | 'turret' | 'boss';
  readonly x: number;
  readonly y: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly minX: number;
  readonly maxX: number;
  readonly direction: -1 | 1;
  readonly shotCooldown: number;
  readonly shotsFired: number;
  readonly alive: boolean;
  readonly guarded: boolean;
  readonly lastHitVolley: number;
}

export interface Bullet {
  readonly x: number;
  readonly y: number;
  readonly direction: -1 | 1;
  readonly hit: readonly number[];
  readonly travel: number;
}

export interface EnemyBullet {
  readonly x: number;
  readonly y: number;
  readonly direction: -1 | 1;
  readonly travel: number;
}

export interface Pickup {
  readonly x: number;
  readonly y: number;
  readonly collected: boolean;
}

export interface RunState {
  readonly levelIndex: number;
  readonly persona: Persona;
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly facing: -1 | 1;
  readonly health: number;
  readonly invulnerable: number;
  readonly shield: number;
  readonly shotCooldown: number;
  readonly bullets: readonly Bullet[];
  readonly enemyBullets: readonly EnemyBullet[];
  readonly enemies: readonly Enemy[];
  readonly pickups: readonly Pickup[];
  readonly traps: readonly Trap[];
  readonly collected: number;
  readonly totalCollected: number;
  readonly upgrades: readonly Upgrade[];
  readonly checkpoint: number;
  readonly defeated: number;
  readonly totalDefeated: number;
  readonly phase: Phase;
  readonly elapsed: number;
}

export interface RunInput {
  readonly horizontal: -1 | 0 | 1;
  readonly jump: boolean;
  readonly shoot: boolean;
}

export const upgradeChoices: Readonly<Record<1 | 2, readonly [Upgrade, Upgrade]>> = {
  1: ['spread', 'shield'],
  2: ['rapid', 'pierce'],
};

export function bossIsOpen(enemy: Enemy): boolean {
  return enemy.kind === 'boss' && enemy.alive && enemy.shotsFired > 0 && enemy.shotCooldown > 0.24;
}

export function turretIsOpen(enemy: Enemy): boolean {
  return !enemy.guarded || (enemy.shotsFired > 0 && enemy.shotCooldown > 0.55);
}

export function createRun(persona: Persona = 'deepseek', levelIndex = 0): RunState {
  const level = levels[levelIndex];
  if (!level) throw new Error(`Unknown level ${levelIndex}`);
  return {
    levelIndex,
    persona,
    x: 1.4,
    y: 0,
    vy: 0,
    facing: 1,
    health: 3,
    invulnerable: 0,
    shield: persona === 'claude' ? 1 : 0,
    shotCooldown: 0,
    bullets: [],
    enemyBullets: [],
    enemies: level.enemies.map((enemy) => ({ ...enemy })),
    pickups: level.pickups.map((pickup) => ({ ...pickup })),
    traps: level.traps.map((trap) => ({ ...trap })),
    collected: 0,
    totalCollected: 0,
    upgrades: [],
    checkpoint: levelIndex === 0 ? 0 : 2,
    defeated: 0,
    totalDefeated: 0,
    phase: 'running',
    elapsed: 0,
  };
}

export function advanceLevel(state: RunState): RunState {
  if (state.phase !== 'level-complete' || state.levelIndex >= levels.length - 1) return state;
  const next = createRun(state.persona, state.levelIndex + 1);
  return {
    ...next,
    health: Math.min(3, state.health + 1),
    shield: Math.min(2, state.shield),
    upgrades: state.upgrades,
    totalCollected: state.totalCollected + state.collected,
    totalDefeated: state.totalDefeated + state.defeated,
    elapsed: state.elapsed,
  };
}

export function retryLevel(state: RunState): RunState {
  if (state.phase !== 'lost') return state;
  const retry = createRun(state.persona, state.levelIndex);
  return {
    ...retry,
    upgrades: state.upgrades,
    totalCollected: state.totalCollected,
    totalDefeated: state.totalDefeated,
    elapsed: state.elapsed,
  };
}

function isStanding(state: RunState): boolean {
  return levels[state.levelIndex]!.platforms.some(
    (platform) =>
      state.x >= platform.from && state.x <= platform.to && Math.abs(state.y - platform.top) < 0.02,
  );
}

export function chooseUpgrade(state: RunState, upgrade: Upgrade): RunState {
  if (state.phase !== 'upgrade' || (state.checkpoint !== 1 && state.checkpoint !== 2)) return state;
  if (!upgradeChoices[state.checkpoint].includes(upgrade)) return state;
  return {
    ...state,
    phase: 'running',
    upgrades: [...state.upgrades, upgrade],
    shield: state.shield + (upgrade === 'shield' ? 1 : 0),
  };
}

export function stepRun(state: RunState, input: RunInput, dt: number): RunState {
  if (state.phase !== 'running') return state;
  const level = levels[state.levelIndex]!;
  const seconds = Math.max(0, Math.min(dt, 1 / 30));
  const facing = input.horizontal || state.facing;
  const x = Math.max(0.25, Math.min(33.8, state.x + input.horizontal * 5.2 * seconds));
  const jump = input.jump && isStanding(state);
  let vy = jump ? 10.2 : state.vy - 22 * seconds;
  let y = state.y + vy * seconds;
  if (vy <= 0) {
    const landing = level.platforms
      .filter((platform) => x >= platform.from && x <= platform.to)
      .filter((platform) => state.y >= platform.top - 0.02 && y <= platform.top)
      .sort((a, b) => b.top - a.top)[0];
    if (landing) {
      y = landing.top;
      vy = 0;
    }
  }

  let shotCooldown = Math.max(0, state.shotCooldown - seconds);
  let bullets = [...state.bullets];
  const traps = state.traps.map((trap) => ({ ...trap }));
  if (input.shoot && shotCooldown <= 0) {
    const heights = state.upgrades.includes('spread') ? [0.42, 0.7, 0.98] : [0.7];
    bullets.push(
      ...heights.map((height) => ({
        x: x + facing * 0.42,
        y: y + height,
        direction: facing,
        hit: [],
        travel: 0,
      })),
    );
    shotCooldown = state.upgrades.includes('rapid') ? 0.14 : state.persona === 'gpt' ? 0.24 : 0.32;
  }

  const enemyBullets = [...state.enemyBullets];
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive) return enemy;
    if (enemy.kind === 'walker') {
      let nextX = enemy.x + enemy.direction * 1.4 * seconds;
      let direction = enemy.direction;
      if (nextX <= enemy.minX || nextX >= enemy.maxX) {
        direction = direction === 1 ? -1 : 1;
        nextX = Math.max(enemy.minX, Math.min(enemy.maxX, nextX));
      }
      return { ...enemy, x: nextX, direction };
    }
    let cooldown = enemy.shotCooldown - seconds;
    let shotsFired = enemy.shotsFired;
    if (Math.abs(enemy.x - x) < 7 && cooldown <= 0) {
      const direction: -1 | 1 = x < enemy.x ? -1 : 1;
      const alternating = enemy.kind === 'boss' || state.levelIndex >= 3;
      const height = alternating && shotsFired % 2 === 1 ? 1.7 : 0.7;
      enemyBullets.push({
        x: enemy.x + direction * 0.45,
        y: enemy.y + height,
        direction,
        travel: 0,
      });
      shotsFired += 1;
      cooldown = enemy.kind === 'boss' ? 0.9 : state.levelIndex >= 3 ? 1 : 1.2;
    }
    return { ...enemy, shotCooldown: cooldown, shotsFired };
  });
  bullets = bullets
    .map((bullet) => ({
      ...bullet,
      x: bullet.x + bullet.direction * 13 * seconds,
      travel: bullet.travel + 13 * seconds,
    }))
    .filter((bullet) => bullet.x >= 0 && bullet.x <= 34 && bullet.travel <= 6.5)
    .flatMap((bullet) => {
      const mirageIndex = traps.findIndex(
        (trap) =>
          trap.kind === 'mirage' &&
          !trap.verified &&
          !trap.triggered &&
          bullet.x >= trap.from &&
          bullet.x <= trap.to &&
          bullet.y >= 0.2 &&
          bullet.y <= 1.2,
      );
      if (mirageIndex >= 0) {
        traps[mirageIndex] = { ...traps[mirageIndex]!, verified: true };
        return [];
      }
      const target = enemies.findIndex(
        (enemy, index) =>
          enemy.alive &&
          !bullet.hit.includes(index) &&
          Math.abs(enemy.x - bullet.x) <
            (enemy.kind === 'boss' ? 0.9 : state.persona === 'deepseek' ? 0.64 : 0.43) &&
          bullet.y >= enemy.y + 0.1 &&
          bullet.y <= enemy.y + (enemy.kind === 'boss' ? 2.2 : 1.2),
      );
      if (target < 0) return [bullet];
      const enemy = enemies[target]!;
      if (enemy.kind === 'boss' && !bossIsOpen(enemy)) return [];
      if (enemy.kind === 'turret' && !turretIsOpen(enemy)) return [];
      if (enemy.kind === 'boss' && enemy.lastHitVolley === enemy.shotsFired) return [];
      const hp = Math.max(0, enemy.hp - 1);
      enemies[target] = {
        ...enemy,
        hp,
        alive: hp > 0,
        lastHitVolley: enemy.kind === 'boss' ? enemy.shotsFired : enemy.lastHitVolley,
      };
      return state.upgrades.includes('pierce') ? [{ ...bullet, hit: [...bullet.hit, target] }] : [];
    });

  let health = state.health;
  let shield = state.shield;
  let invulnerable = Math.max(0, state.invulnerable - seconds);
  const pickups = state.pickups.map((pickup) => {
    if (pickup.collected || Math.abs(pickup.x - x) >= 0.5 || Math.abs(pickup.y - y) >= 0.95)
      return pickup;
    shield += 1;
    return { ...pickup, collected: true };
  });
  const collected = pickups.filter((pickup) => pickup.collected).length;
  traps.forEach((trap, index) => {
    if (trap.kind === 'context' && !trap.triggered && x >= trap.from && x <= trap.to && y < 1.3) {
      traps[index] = { ...trap, triggered: true };
      if (shield > 0) shield = 0;
      else health -= 1;
      invulnerable = Math.max(invulnerable, 0.7);
    }
    if (
      trap.kind === 'mirage' &&
      !trap.verified &&
      !trap.triggered &&
      x >= trap.from &&
      x <= trap.to &&
      y < -0.15
    )
      traps[index] = { ...trap, triggered: true };
  });
  let projectileHit = false;
  const movingEnemyBullets = enemyBullets
    .map((bullet) => ({
      ...bullet,
      x: bullet.x + bullet.direction * 6 * seconds,
      travel: bullet.travel + 6 * seconds,
    }))
    .filter((bullet) => bullet.x >= 0 && bullet.x <= 34 && bullet.travel <= 8)
    .filter((bullet) => {
      if (Math.abs(bullet.x - x) < 0.48 && bullet.y >= y + 0.15 && bullet.y <= y + 1.5) {
        projectileHit = true;
        return false;
      }
      return true;
    });
  const touching = enemies.some(
    (enemy) =>
      enemy.alive &&
      Math.abs(enemy.x - x) < (enemy.kind === 'boss' ? 0.9 : 0.62) &&
      Math.abs(enemy.y - y) < (enemy.kind === 'boss' ? 1.6 : 0.9),
  );
  const fell = y < -2;
  if ((touching || projectileHit || fell) && invulnerable <= 0) {
    if (shield > 0) shield -= 1;
    else health -= 1;
    invulnerable = 1.1;
  }
  if (fell) {
    y = 0;
    vy = 0;
    const previousFloor = level.platforms
      .filter((platform) => platform.top === 0 && platform.from < state.x)
      .sort((a, b) => b.from - a.from)[0];
    return {
      ...state,
      x: previousFloor ? previousFloor.from + 0.5 : 1.4,
      y,
      vy,
      health,
      shield,
      invulnerable,
      shotCooldown,
      bullets: [],
      enemyBullets: [],
      enemies,
      pickups,
      traps,
      collected,
      defeated: enemies.filter((enemy) => !enemy.alive).length,
      phase: health <= 0 ? 'lost' : 'running',
      elapsed: state.elapsed + seconds,
    };
  }
  const defeated = enemies.filter((enemy) => !enemy.alive).length;
  let checkpoint = state.checkpoint;
  let phase: Phase = health <= 0 ? 'lost' : 'running';
  if (phase === 'running' && state.levelIndex === 0 && x >= 11.4 && checkpoint === 0) {
    checkpoint = 1;
    phase = 'upgrade';
  } else if (phase === 'running' && state.levelIndex === 0 && x >= 21.4 && checkpoint === 1) {
    checkpoint = 2;
    phase = 'upgrade';
  } else if (phase === 'running' && x >= 32.6) {
    const bossAlive = enemies.some((enemy) => enemy.kind === 'boss' && enemy.alive);
    if (level.goal !== 'boss' || !bossAlive)
      phase = state.levelIndex === levels.length - 1 ? 'won' : 'level-complete';
  }
  return {
    ...state,
    x,
    y,
    vy,
    facing,
    health,
    shield,
    invulnerable,
    shotCooldown,
    bullets,
    enemyBullets: movingEnemyBullets,
    enemies,
    pickups,
    traps,
    collected,
    checkpoint,
    defeated,
    phase,
    elapsed: state.elapsed + seconds,
  };
}
