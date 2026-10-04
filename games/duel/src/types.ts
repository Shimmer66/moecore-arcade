export type LegacyFighterId = 'deepseek' | 'gpt' | 'doubao';
export type NewcomerId = 'client' | 'prompt_sage' | 'unplug_uncle';
export type FighterId = LegacyFighterId | NewcomerId;
export function isNewcomer(id: FighterId): id is NewcomerId {
  return id === 'client' || id === 'prompt_sage' || id === 'unplug_uncle';
}
export type Slot = 0 | 1;
export type Command =
  | 'light'
  | 'heavy'
  | 'skill'
  | 'exSkill'
  | 'exVariant'
  | 'max'
  | 'variant'
  | 'burst'
  | 'super'
  | 'maxSuper'
  | 'climax'
  | 'blowback'
  | 'guardCounter'
  | 'throw'
  | 'commandGrab'
  | 'jump'
  | 'dash'
  | 'roll'
  | 'meme'
  | 'lightKick'
  | 'uppercut'
  | 'kick';
export type JumpKind = 'normal' | 'hop' | 'super' | 'hyper' | 'double' | 'chase';
export type SuperTier = 1 | 2 | 3;
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'quick' | 'arcade' | 'practice' | 'versus' | 'team';
export type TeamLineup = [FighterId, FighterId, FighterId];
export type TeamLineups = [TeamLineup, TeamLineup];
export interface TeamMember {
  id: FighterId;
  hp: number;
  eliminated: boolean;
  damage: number;
  wins: number;
}
export interface TeamState {
  members: TeamMember[];
  active: number;
  energy: number;
  recovery: number;
}
export type DummyMode =
  'idle' | 'guard' | 'crouch-guard' | 'fight' | 'repeat-heavy' | 'repeat-jump';
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
  | 'roll'
  | 'guardBreak'
  | 'powerUp'
  | 'blowback'
  | 'airBlowback'
  | 'guardCounter'
  | 'light1'
  | 'light2'
  | 'light3'
  | 'low'
  | 'upper'
  | 'air'
  | 'airHeavy'
  | 'launched'
  | 'heavy'
  | 'closeHeavy'
  | 'lightKick'
  | 'crouchKick'
  | 'airLightKick'
  | 'airKick'
  | 'skill'
  | 'variant'
  | 'counter'
  | 'super'
  | 'throw'
  | 'commandGrab'
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
  jumpHeld?: boolean;
  contexts?: Partial<Record<Command, { move: -1 | 0 | 1; crouch: boolean }>>;
}
export interface Fighter {
  slot: Slot;
  id: FighterId;
  x: number;
  y: number;
  vy: number;
  jumps: number;
  jumpKind: JumpKind;
  jumpAge: number;
  jumpVariable: boolean;
  jumpDirection: -1 | 0 | 1;
  crouchRecent: number;
  airDashUsed: boolean;
  crouching: boolean;
  landing: boolean;
  guardIntent: boolean;
  guardGauge: number;
  guardRegenDelay: number;
  facing: -1 | 1;
  action: Action;
  age: number;
  serial: number;
  landed: string[];
  hp: number;
  energy: number;
  energyCap: number;
  exActive: boolean;
  armor: number;
  maxFrames: number;
  maxMode: 'normal' | 'quick' | null;
  exUses: number;
  maxUses: number;
  cooldown: number;
  memeCooldown: number;
  silenced: number;
  slowed: number;
  variantCooldown: number;
  originX: number;
  burstUsed: boolean;
  variants: number;
  variantHits: number;
  supers: number;
  superTier: SuperTier;
  superLinked: boolean;
  superCounted: boolean;
  advancedCancels: number;
  climaxHits: number;
  bursts: number;
  stun: number;
  invulnerable: number;
  combo: number;
  comboDamage: number;
  comboLimit: number;
  contactTick: number;
  contactHit: boolean;
  buffer: {
    command: Command;
    until: number;
    queuedAt?: number;
    move?: -1 | 0 | 1;
    crouch?: boolean;
    jump?: { move: -1 | 0 | 1; crouch: boolean };
  } | null;
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
  commandThrows: number;
  backCharge: number;
  chargeReadyUntil: number;
  whiffs: number;
  cachedParries: string[];
  motionFacing: -1 | 1;
  directions: { direction: number; frame: number }[];
  inputLog: { text: string; frame: number }[];
  motionResult: { text: string; frame: number } | null;
  motionCount: number;
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
  kind?: 'talisman' | 'trap';
  enhanced?: boolean;
}
export interface BattleEvent {
  id: number;
  kind:
    | 'hit'
    | 'block'
    | 'guard-break'
    | 'ex'
    | 'max'
    | 'cancel'
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
  source?: Slot;
  move?: Action | 'bubble' | 'return-bubble';
  damage?: number;
}
export interface Observation {
  fighters: {
    id: FighterId;
    x: number;
    y: number;
    action: Action;
    age: number;
    facing: number;
  }[];
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
  inputFrame: number;
  elapsed: number;
  fighters: [Fighter, Fighter];
  teams: [TeamState, TeamState] | null;
  projectiles: Projectile[];
  rice: { owner: Slot; holder: Slot; life: number } | null;
  nextId: number;
  events: BattleEvent[];
  freeze: number;
  cinematicOwner: Slot | null;
  grab: {
    attacker: Slot;
    defender: Slot;
    age: number;
    paid: boolean;
    catch?: boolean;
    revision?: boolean;
    command?: boolean;
  } | null;
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
  behind?: boolean;
}
export interface Move {
  total: number;
  strikes: Strike[];
}
