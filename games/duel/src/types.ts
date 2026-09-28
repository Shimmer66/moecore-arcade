export type FighterId = 'deepseek' | 'gpt' | 'doubao';
export type Slot = 0 | 1;
export type Command =
  | 'light'
  | 'heavy'
  | 'skill'
  | 'variant'
  | 'burst'
  | 'super'
  | 'throw'
  | 'jump'
  | 'dash'
  | 'meme'
  | 'kick';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'quick' | 'arcade' | 'practice' | 'versus';
export type DummyMode = 'idle' | 'guard' | 'fight' | 'repeat-heavy';
export type UpgradeId = 'battery' | 'cooling' | 'lightfoot';
export interface BattleOptions {
  difficulty: Difficulty;
  practice: boolean;
  dummy: DummyMode;
  infiniteEnergy: boolean;
  roundLimit: 1 | 3;
  roundSeconds: number;
  playerPerks: UpgradeId[];
  enemyStartingEnergy: number;
  localVersus: boolean;
}
export type Action =
  | 'idle'
  | 'walk'
  | 'crouch'
  | 'guard'
  | 'jump'
  | 'dash'
  | 'light1'
  | 'light2'
  | 'light3'
  | 'low'
  | 'upper'
  | 'air'
  | 'airHeavy'
  | 'launched'
  | 'heavy'
  | 'skill'
  | 'variant'
  | 'counter'
  | 'super'
  | 'throw'
  | 'hurt'
  | 'block'
  | 'down'
  | 'grabbed'
  | 'throwing'
  | 'meme'
  | 'eat'
  | 'kick'
  | 'sweep';
export interface Input {
  move: -1 | 0 | 1;
  guard: boolean;
  crouch: boolean;
  commands: Command[];
  contexts?: Partial<Record<Command, { move: -1 | 0 | 1; crouch: boolean }>>;
}
export interface Fighter {
  slot: Slot;
  id: FighterId;
  x: number;
  y: number;
  vy: number;
  jumps: number;
  airDashUsed: boolean;
  crouching: boolean;
  facing: -1 | 1;
  action: Action;
  age: number;
  serial: number;
  landed: string[];
  hp: number;
  energy: number;
  cooldown: number;
  memeCooldown: number;
  variantCooldown: number;
  originX: number;
  burstUsed: boolean;
  variants: number;
  variantHits: number;
  supers: number;
  bursts: number;
  stun: number;
  invulnerable: number;
  combo: number;
  comboDamage: number;
  contactTick: number;
  contactHit: boolean;
  buffer: { command: Command; until: number; move?: -1 | 0 | 1; crouch?: boolean } | null;
  lastMove: number;
  tapDirection: number;
  tapTick: number;
  dashDirection: number;
  guardAwards: number[];
  awardWindow: number;
  awarded: number;
  damage: number;
  maxCombo: number;
  counters: number;
  throws: number;
  whiffs: number;
  cachedParries: string[];
}
export type MemeEffect =
  | 'gpt-paper'
  | 'doubao-bun'
  | 'deepseek-bubbles'
  | 'cache-hit'
  | 'gpt-muffled'
  | 'gpt-rollback'
  | 'sore-loser'
  | 'rice-spill'
  | 'steady-catch'
  | 'tangbao-return'
  | 'rice-stolen'
  | 'rice-reclaimed'
  | 'catch-overload'
  | 'parcel-reflect'
  | 'parcel-delivered';
export interface Projectile {
  id: number;
  owner: Slot;
  x: number;
  y: number;
  direction: number;
  life: number;
  boomerang?: boolean;
  returning?: boolean;
  originalOwner?: Slot;
  reflections?: number;
  damage?: number;
}
export interface BattleEvent {
  id: number;
  kind:
    | 'hit'
    | 'block'
    | 'parry'
    | 'super'
    | 'throw'
    | 'meme'
    | 'round'
    | 'variant'
    | 'burst'
    | 'launch'
    | 'chase'
    | 'dash'
    | 'jump'
    | 'land'
    | 'bubble-pop';
  actor: Slot;
  x: number;
  y: number;
  text: string;
  effect?: MemeEffect;
  target?: Slot;
}
export interface Observation {
  fighters: { x: number; y: number; action: Action; facing: number }[];
  projectiles: { owner: Slot; x: number }[];
}
export interface Brain {
  seed: number;
  decisionAt: number;
  move: -1 | 0 | 1;
  guard: boolean;
  crouch: boolean;
  confirmed: number;
  history: Observation[];
}
export interface Battle {
  options: BattleOptions;
  phase: 'countdown' | 'fight' | 'cinematic' | 'round-end' | 'done';
  phaseFrames: number;
  round: number;
  scores: [number, number];
  roundWinner: Slot | null;
  outcome: 'win' | 'lose' | 'draw' | null;
  timer: number;
  tick: number;
  elapsed: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  rice: { owner: Slot; holder: Slot; life: number } | null;
  nextId: number;
  events: BattleEvent[];
  freeze: number;
  cinematicOwner: Slot | null;
  grab: { attacker: Slot; defender: Slot; age: number; paid: boolean; catch?: boolean } | null;
  brain: Brain;
  memeAt: number;
}
export interface Strike {
  start: number;
  active: number;
  damage: number;
  reach: number;
  stun: number;
  block: number;
  push: number;
  down: boolean;
  launch: boolean;
}
export interface Move {
  total: number;
  strikes: Strike[];
}
