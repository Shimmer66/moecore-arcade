<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowLeft, ArrowRight, Lock, Unplug } from '@lucide/vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { STARDUST_ART } from '@moecore/assets/stardust';
import BattleEffects from './BattleEffects.vue';
import { advanceStandAI, createStandAIState, type StandAIState } from './stand-ai';
import { BOSS_STAND_FRAMES, bossStandPose, isBossStandOwner } from './stand-animation';
import {
  advanceEmerald,
  applyEmeraldHit,
  EMERALD_BARRAGE_INTERVAL_MS,
  launchEmeralds,
  type EmeraldAction,
  type EmeraldProjectile,
} from './emeralds';
import { damageLabel } from './damage-feedback';
import { advanceFireball, createFireball } from './fireball';
import { advanceStarFinger, createStarFinger, STAR_FINGER_DURATION_MS } from './star-finger';
import {
  advanceUltimate,
  beginUltimate,
  canUseUltimate,
  isHero,
  ULTIMATE_NAMES,
  type UltimateState,
} from './ultimates';
import {
  advanceVersusMatch,
  applyCombatHit,
  attackSpecs,
  BARRAGE_DAMAGE_LIMIT,
  createCombatState,
  DIO_BOSS_HP,
  createVersusMatch,
  settleRound,
  type Action,
  type Side,
} from './rules';
import {
  advanceBarrage,
  advanceBarrageHit,
  BARRAGE_DURATION_MS,
  BARRAGE_HIT_INTERVAL_MS,
  BARRAGE_RANGE_METERS,
  BARRAGE_VOICE_INTERVAL_MS,
  createBarrageVoicePlayer,
} from './barrage';
import { audioCue } from './audio/cues';
import { createStardustAudioEngine } from './audio/engine';
import type { StardustActorId, StardustAudioEvent } from './audio/types';
import { isPlayerFrozen, TIME_STOP_DURATION_MS, type TimeStopOwner } from './time-stop';
import { standDisplayX, visibleTargetInReach } from './stand-presentation';
import {
  advanceDetachedStand,
  adjustStandDistance,
  createStandControl,
  enforceStandRange,
  FIGHTER_STAND_RANK,
  metersToPosition,
  moveDetachedStand,
  nearestTarget,
  ownerDamage,
  recallStand,
  standDistance,
  standOpacity,
  STAND_HIT_REACH_METERS,
  STAND_DISTANCE_STEP_METERS,
  STAND_MOVE_SPEED_METERS,
  STAND_LIMIT_METERS,
  toggleStand,
  type StandRank,
} from './stand-control';
import { advanceStatuses, STATUS_DAMAGE } from './status-effects';
import {
  challengeVictory,
  defeatedEnemy,
  enemyUnlocked,
  ENEMY_PROGRESS_KEY,
  ENEMY_UNLOCK_KILLS,
  sanitizeEnemyProgress,
  type EnemyKillProgress,
} from './progress';

type Mode = 'solo' | 'story' | 'coop' | 'challenge' | 'versus' | 'practice';
type FighterId = 'jotaro' | 'kakyoin' | 'avdol' | 'polnareff';
type EnemyId =
  | 'gray-fly'
  | 'devo'
  | 'rubber-soul'
  | 'holhorse'
  | 'j-geil'
  | 'nena'
  | 'alessi'
  | 'mariah'
  | 'ndoul'
  | 'darby-elder'
  | 'darby-younger'
  | 'pet-shop'
  | 'ice'
  | 'dio';
type PlayableId = FighterId | EnemyId;
type IntroStep = 'summon' | 'panel' | 'ready' | 'done';

interface Fighter {
  id: FighterId;
  name: string;
  stand: string;
  role: string;
  color: string;
  accent: string;
  special: string;
}

interface CharacterDefinition {
  id: PlayableId;
  name: string;
  stand: string;
  role: string;
  color: string;
  accent: string;
  special: string;
}

interface Combatant extends ReturnType<typeof createCombatState> {
  id: FighterId | EnemyId;
  name: string;
}

interface EnemyDefinition {
  id: EnemyId;
  name: string;
  stand: string;
  team: string;
  hp: number;
}

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const roster: readonly Fighter[] = [
  {
    id: 'jotaro',
    name: '空条承太郎',
    stand: '白金之星',
    role: '近战压制',
    color: '#23335f',
    accent: '#53d5d0',
    special: '全力连打',
  },
  {
    id: 'kakyoin',
    name: '花京院典明',
    stand: '绿色法皇',
    role: '远程控制',
    color: '#225c48',
    accent: '#ec5f70',
    special: '绿宝石结界',
  },
  {
    id: 'avdol',
    name: '穆罕默德·阿布德尔',
    stand: '红色魔术师',
    role: '火焰爆发',
    color: '#783929',
    accent: '#ffbd3f',
    special: '焚天烈焰',
  },
  {
    id: 'polnareff',
    name: '简·皮耶尔·波鲁那雷夫',
    stand: '银色战车',
    role: '高速突进',
    color: '#707b94',
    accent: '#d7ecff',
    special: '爆甲瞬狱刺',
  },
];

const phase = ref<'select' | 'fight' | 'round-break' | 'result'>('select');
const match = ref(createVersusMatch());
const ultimates = ref<
  {
    id: number;
    caster: Combatant;
    target: Combatant;
    state: UltimateState;
  }[]
>([]);
let ultimateSequence = 0;
const emeraldFlights = ref<(EmeraldProjectile & { caster: Combatant; targets: Combatant[] })[]>([]);
let emeraldSequence = 0;
const mode = ref<Mode>('solo');
const playerOne = ref<PlayableId>('jotaro');
const playerTwo = ref<PlayableId>('kakyoin');
const p1 = ref<Combatant>();
const p2 = ref<Combatant>();
const partner = ref<Combatant>();
const revives = ref(3);
const wave = ref(1);
const timer = ref(75);
const message = ref('选择模式与角色，开始星尘远征。');
const impact = ref('');
const stopped = ref<TimeStopOwner | null>(null);
const introStep = ref<IntroStep>('done');
const introSlot = ref<0 | 1>(0);
const animationPulse = ref(0);
const sfxEnabled = ref(true);
const voiceEnabled = ref(true);
const ambienceEnabled = ref(true);
const startedAt = ref(0);
const keys = new Set<string>();
const arenaElement = ref<HTMLElement>();
const arenaWidth = ref(0);
const standSpriteWidth = ref(150);
let arenaObserver: ResizeObserver | undefined;
const touchMovement: Record<Side, number> = { p1: 0, p2: 0 };
const hitEffects = ref<
  {
    id: number;
    x: number;
    stand: boolean;
    color: string;
    type: string;
    damage: number;
    label: string;
    life: number;
  }[]
>([]);
let hitSequence = 0;
const fingerStrikes = ref<
  (ReturnType<typeof createStarFinger> & {
    id: number;
    attacker: Combatant;
    facing: 1 | -1;
  })[]
>([]);

function fingerOrigin(fighter: Combatant) {
  return fighter.standControl.mode === 'detached'
    ? displayStandX(fighter)
    : fighter.x - fighter.facing * 3;
}
const fireballs = ref<
  (ReturnType<typeof createFireball> & { id: number; attacker: Combatant; defender: Combatant })[]
>([]);
const introTimers: number[] = [];
const effectTimers = new Set<number>();
let timeStopTimer = 0;
let raf = 0;
let last = 0;
let timerCarry = 0;
let animationCarry = 0;
const barrageVoice = createBarrageVoicePlayer();
const audioEngine = createStardustAudioEngine();
const computerStandStates = new WeakMap<Combatant, StandAIState>();

function scheduleEffect(action: () => void, delay: number) {
  const handle = window.setTimeout(() => {
    effectTimers.delete(handle);
    action();
  }, delay);
  effectTimers.add(handle);
}

function clearEffectTimers() {
  for (const handle of effectTimers) window.clearTimeout(handle);
  effectTimers.clear();
}

function stopBarrageAudio() {
  barrageVoice.stop();
  audioEngine.stop();
}

function cancelTimeStop() {
  if (timeStopTimer) window.clearTimeout(timeStopTimer);
  timeStopTimer = 0;
  stopped.value = null;
}

function activateTimeStop(
  owner: TimeStopOwner,
  duration: number,
  fighter: Combatant,
  announcement: string,
) {
  cancelTimeStop();
  fighter.energy = 0;
  fighter.timeStopsUsed += 1;
  stopped.value = owner;
  playAudio('time-stop', fighter.id, panFor(fighter));
  impact.value = '时间停止';
  message.value = announcement;
  timeStopTimer = window.setTimeout(() => {
    stopped.value = null;
    timeStopTimer = 0;
    impact.value = '时间开始流动';
    playAudio('time-resume', fighter.id, panFor(fighter));
    scheduleEffect(() => {
      if (impact.value === '时间开始流动') impact.value = '';
    }, 450);
  }, duration);
}

function playAudio(event: StardustAudioEvent, actor?: Combatant['id'], pan = 0) {
  const cue = audioCue(event, actor as StardustActorId | undefined);
  if (
    props.settings.masterVolume <= 0 ||
    (cue.category === 'sfx' && !sfxEnabled.value) ||
    (cue.category === 'ambience' && !ambienceEnabled.value)
  )
    return;
  audioEngine.play(cue, props.settings.masterVolume, pan);
}

const selectedOne = computed(() => characterFor(playerOne.value));
const selectedTwo = computed(() => characterFor(playerTwo.value));
const story = computed(() => mode.value === 'story');
const solo = computed(() => mode.value === 'solo');
const coop = computed(() => mode.value === 'coop');
const challenge = computed(() => mode.value === 'challenge');
const practice = computed(() => mode.value === 'practice');
const adventure = computed(() => solo.value || story.value || coop.value);
const reviveCapacity = computed(() => (coop.value ? 3 : solo.value || story.value ? 1 : 0));
const usesSecondFighter = computed(() => !solo.value);
const battleTitle = computed(() =>
  adventure.value
    ? `${currentEnemy.value.team} · ${wave.value}/${ENEMY_LADDER.length}`
    : challenge.value
      ? `挑战模式 · ${selectedTwo.value.name}`
      : practice.value
        ? '替身练习场'
        : '本地双人格斗',
);
const ENEMY_LADDER: readonly EnemyDefinition[] = [
  { id: 'gray-fly', name: '格雷·弗莱', stand: '灰塔', team: '旅途刺客队', hp: 78 },
  { id: 'devo', name: '诅咒的迪波', stand: '黑檀木恶魔', team: '旅途刺客队', hp: 84 },
  { id: 'rubber-soul', name: '拉巴索', stand: '黄色节制', team: '旅途刺客队', hp: 88 },
  { id: 'holhorse', name: '荷尔·荷斯', stand: '皇帝', team: '枪与镜队', hp: 92 },
  { id: 'j-geil', name: 'J·凯尔', stand: '倒吊人', team: '枪与镜队', hp: 94 },
  { id: 'nena', name: '妮娜', stand: '女帝', team: '枪与镜队', hp: 96 },
  { id: 'alessi', name: '阿雷西', stand: '赛特神', team: '埃及九荣神队', hp: 100 },
  { id: 'mariah', name: '玛莱雅', stand: '芭丝特女神', team: '埃及九荣神队', hp: 102 },
  { id: 'ndoul', name: '恩多尔', stand: '盖布神', team: '埃及九荣神队', hp: 106 },
  { id: 'darby-elder', name: '丹尼尔·J·达比', stand: '欧西里斯神', team: '宅邸守门队', hp: 110 },
  { id: 'darby-younger', name: '泰伦斯·T·达比', stand: '亚图姆神', team: '宅邸守门队', hp: 112 },
  { id: 'pet-shop', name: '宠物店', stand: '荷鲁斯神', team: '宅邸守门队', hp: 116 },
  { id: 'ice', name: '瓦尼拉·艾斯', stand: '亚空瘴气', team: 'DIO宅邸决战', hp: 135 },
  { id: 'dio', name: 'DIO', stand: '世界', team: '开罗最终决战', hp: 165 },
] as const;
const enemyIds = ENEMY_LADDER.map((enemy) => enemy.id);
const characterChoices = computed(() => [...roster, ...enemyIds.map(characterFor)]);
const playerOneChoices = computed(() => (challenge.value ? roster : characterChoices.value));
const playerTwoChoices = computed(() =>
  challenge.value ? enemyIds.map(characterFor) : characterChoices.value,
);

function characterFor(id: PlayableId): CharacterDefinition {
  const hero = roster.find((fighter) => fighter.id === id);
  if (hero) return hero;
  const enemy = ENEMY_LADDER.find((candidate) => candidate.id === id)!;
  const boss = id === 'dio' || id === 'ice';
  return {
    id,
    name: enemy.name,
    stand: enemy.stand,
    role: boss ? '首领压制' : enemy.team,
    color: boss ? '#5a274f' : '#45385f',
    accent: id === 'dio' ? '#f0c74b' : id === 'ice' ? '#b88cff' : '#e86a79',
    special: id === 'dio' ? '世界·时停' : `${enemy.stand}必杀`,
  };
}

function readEnemyProgress(): EnemyKillProgress<EnemyId> {
  try {
    return sanitizeEnemyProgress(
      JSON.parse(localStorage.getItem(ENEMY_PROGRESS_KEY) ?? '{}'),
      enemyIds,
    );
  } catch {
    return {};
  }
}

const enemyProgress = ref<EnemyKillProgress<EnemyId>>(readEnemyProgress());
const previewSlot = ref<Side>('p1');
const previewId = ref<PlayableId>('jotaro');
const characterDialog = ref<HTMLDialogElement>();
const previewCharacter = computed(() => characterFor(previewId.value));
const previewKills = computed(() =>
  isFighterId(previewId.value) ? ENEMY_UNLOCK_KILLS : (enemyProgress.value[previewId.value] ?? 0),
);
const previewUnlocked = computed(() => characterUnlocked(previewId.value));
const previewSelectable = computed(() => characterSelectable(previewSlot.value, previewId.value));

function characterUnlocked(id: PlayableId) {
  return isFighterId(id) || enemyUnlocked(enemyProgress.value, id);
}

function characterSelectable(slot: Side, id: PlayableId) {
  return characterUnlocked(id) || (challenge.value && slot === 'p2' && isEnemyId(id));
}

function saveEnemyProgress() {
  try {
    localStorage.setItem(ENEMY_PROGRESS_KEY, JSON.stringify(enemyProgress.value));
  } catch {
    // Progress persistence is optional in restricted browser contexts.
  }
}

function recordEnemyDefeat(id: EnemyId) {
  enemyProgress.value = defeatedEnemy(enemyProgress.value, id);
  saveEnemyProgress();
}

function openCharacterInfo(slot: Side, id: PlayableId) {
  previewSlot.value = slot;
  previewId.value = id;
  playAudio('select', id, slot === 'p1' ? -0.35 : 0.35);
  characterDialog.value?.showModal();
}

function closeCharacterInfo() {
  characterDialog.value?.close();
}

function confirmCharacterSelection() {
  if (!previewSelectable.value) return;
  if (previewSlot.value === 'p1') playerOne.value = previewId.value;
  else playerTwo.value = previewId.value;
  playAudio('confirm', previewId.value, previewSlot.value === 'p1' ? -0.35 : 0.35);
  closeCharacterInfo();
}

const currentEnemy = computed(
  () => ENEMY_LADDER[Math.min(wave.value - 1, ENEMY_LADDER.length - 1)]!,
);
const standProfiles: Record<
  FighterId,
  Readonly<Record<'破坏力' | '速度' | '射程' | '持续力' | '精密度', string>>
> = {
  jotaro: { 破坏力: 'A', 速度: 'A', 射程: 'C', 持续力: 'A', 精密度: 'A' },
  kakyoin: { 破坏力: 'C', 速度: 'B', 射程: 'A', 持续力: 'B', 精密度: 'C' },
  avdol: { 破坏力: 'B', 速度: 'B', 射程: 'C', 持续力: 'B', 精密度: 'C' },
  polnareff: { 破坏力: 'C', 速度: 'A', 射程: 'C', 持续力: 'B', 精密度: 'B' },
};

function standProfileFor(id: PlayableId) {
  if (isFighterId(id)) return standProfiles[id];
  if (id === 'dio') return { 破坏力: 'A', 速度: 'A', 射程: 'C', 持续力: 'A', 精密度: 'B' };
  if (id === 'ice') return { 破坏力: 'B', 速度: 'B', 射程: 'D', 持续力: 'C', 精密度: 'C' };
  return { 破坏力: 'C', 速度: 'B', 射程: 'B', 持续力: 'C', 精密度: 'C' };
}
const introFighter = computed(() =>
  introSlot.value === 0 ? selectedOne.value : selectedTwo.value,
);
const combatants = computed(() =>
  [
    { fighter: p1.value, side: 'p1' as const, key: 'p1' },
    { fighter: p2.value, side: 'p2' as const, key: 'p2' },
    { fighter: partner.value, side: 'p2' as const, key: 'partner' },
  ].filter((entry): entry is { fighter: Combatant; side: Side; key: string } =>
    Boolean(entry.fighter),
  ),
);
const controlledTwo = computed(() =>
  coop.value ? partner.value : mode.value === 'versus' ? p2.value : undefined,
);
const standControls = computed(() =>
  [
    { fighter: p1.value, side: 'p1' as const, label: '玩家一', hotkey: 'F' },
    { fighter: controlledTwo.value, side: 'p2' as const, label: '玩家二', hotkey: '7' },
  ].filter((entry): entry is { fighter: Combatant; side: Side; label: string; hotkey: string } =>
    Boolean(entry.fighter),
  ),
);

function rangeRank(fighter: Combatant): StandRank {
  return isFighterId(fighter.id)
    ? FIGHTER_STAND_RANK[fighter.id]
    : (standProfileFor(fighter.id).射程 as StandRank);
}

function standLabel(fighter: Combatant) {
  if (fighter.standControl.mode === 'detached') return '召回替身';
  return fighter.standControl.mode === 'vanished' ? '重新召出' : '替身离体';
}

function standStatus(fighter: Combatant) {
  const rank = rangeRank(fighter);
  const status =
    fighter.standControl.mode === 'detached'
      ? '离体 · 手动'
      : fighter.standControl.mode === 'vanished'
        ? '已消失'
        : '贴身';
  return `${rank} · ${standDistance(fighter.x, fighter.standControl).toFixed(1)} / ${STAND_LIMIT_METERS[rank]} m · ${status}`;
}

function displayStandX(fighter: Combatant) {
  return standDisplayX(
    fighter.standControl,
    fighter.x,
    rangeRank(fighter),
    arenaWidth.value,
    standSpriteWidth.value * (isBossStandOwner(fighter.id) ? 4 / 3 : 1),
  );
}

function separatedStyle(fighter: Combatant, stand = false) {
  const column = roster.findIndex((entry) => entry.id === fighter.id);
  return {
    '--fighter-motion': `url("${STARDUST_ART.separated}")`,
    '--frame-x': `${(Math.max(0, column) / 3) * 100}%`,
    '--frame-y': stand ? '100%' : '0%',
  };
}

function standMotionStyle(fighter: Combatant) {
  if (isBossStandOwner(fighter.id)) {
    const pose = bossStandPose(fighter);
    const frame =
      pose === 'move'
        ? animationPulse.value % 2
        : pose === 'barrage'
          ? animationPulse.value % 2
            ? 4
            : 2
          : BOSS_STAND_FRAMES[pose];
    const idle = pose === 'idle';
    return {
      '--fighter-motion': `url("${idle ? STARDUST_ART.standEntities[fighter.id] : STARDUST_ART.standMotion[fighter.id]}")`,
      '--frame-x': idle ? '0%' : `${((frame % 4) / 3) * 100}%`,
      '--frame-y': idle ? '0%' : `${Math.floor(frame / 4) * 100}%`,
      backgroundSize: idle ? '100% 100%' : '400% 200%',
    };
  }
  if (!isFighterId(fighter.id)) return separatedStyle(fighter, true);
  let frame = animationPulse.value % 2;
  if (fighter.standControl.movingMs > 0) frame = 2 + (animationPulse.value % 2);
  if (
    fighter.standControl.attackMs > 0 ||
    fighter.attack === 'stand' ||
    fighter.attack === 'finger'
  )
    frame = 4 + (animationPulse.value % 2);
  if (fighter.standControl.stunMs > 0) frame = 6;
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  return {
    '--fighter-motion': `url("${STARDUST_ART.standMotion[fighter.id]}")`,
    '--frame-x': `${(column / 3) * 100}%`,
    '--frame-y': `${row * 100}%`,
    '--motion-size': '400% 200%',
  };
}

function separateBody(fighter: Combatant) {
  return (
    isFighterId(fighter.id) &&
    fighter.id !== 'kakyoin' &&
    (fighter.standControl.mode !== 'attached' || fighter.attack === 'finger')
  );
}

function opponents(fighter: Combatant): Combatant[] {
  return fighter === p2.value
    ? [p1.value, partner.value].filter((entry): entry is Combatant => Boolean(entry))
    : p2.value
      ? [p2.value]
      : [];
}

function clearMovement() {
  keys.clear();
  touchMovement.p1 = 0;
  touchMovement.p2 = 0;
}

function holdMovement(side: Side, direction: number, event: PointerEvent) {
  if (props.paused || phase.value !== 'fight') return;
  touchMovement[side] = direction;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function detachStand(side: Side) {
  if (props.paused || phase.value !== 'fight' || introStep.value !== 'done') return;
  const fighter = side === 'p1' ? p1.value : controlledTwo.value;
  if (
    !fighter ||
    !hasIndependentStand(fighter.id) ||
    fighter.down ||
    casting(fighter) ||
    combatantFrozen(fighter)
  )
    return;
  if (!toggleStand(fighter.standControl, fighter.x, rangeRank(fighter))) return;
  fingerStrikes.value = fingerStrikes.value.filter((strike) => strike.attacker !== fighter);
  if (fighter.attack === 'finger') {
    fighter.attack = null;
    fighter.attackFrames = 0;
  }
  clearMovement();
  fighter.standControl.facing = fighter.facing;
  if (fighter.standControl.mode === 'attached' && fighter.attack === 'stand') {
    fighter.attack = null;
    fighter.attackFrames = 0;
    fighter.barrageMs = 0;
    fighter.barrageVoiceMs = 0;
    fighter.barrageHitMs = 0;
    if (fighter.id === 'jotaro' || fighter.id === 'dio') barrageVoice.stop(fighter.id);
  }
  playAudio('summon', fighter.id, panFor(fighter));
}

function changeStandDistance(side: Side, direction: -1 | 1) {
  if (props.paused || phase.value !== 'fight' || introStep.value !== 'done') return;
  const fighter = side === 'p1' ? p1.value : controlledTwo.value;
  if (fighter?.attack === 'finger') return;
  if (!fighter || fighter.down || fighter.stun > 0 || casting(fighter) || combatantFrozen(fighter))
    return;
  adjustStandDistance(
    fighter.standControl,
    fighter.x,
    rangeRank(fighter),
    direction * STAND_DISTANCE_STEP_METERS,
  );
}

function isFighterId(id: Combatant['id']): id is FighterId {
  return roster.some((fighter) => fighter.id === id);
}

function hasIndependentStand(id: Combatant['id']): id is FighterId | 'dio' | 'ice' {
  return isFighterId(id) || isBossStandOwner(id);
}

function isEnemyId(id: Combatant['id']): id is EnemyId {
  return !isFighterId(id);
}

function artStyle(id: PlayableId) {
  if (isFighterId(id))
    return {
      '--fighter-art': `url("${STARDUST_ART.chibiFighters[id]}")`,
      '--fighter-art-size': 'contain',
      '--fighter-art-position': 'center bottom',
    };
  const index = enemyIds.indexOf(id);
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    '--fighter-art': `url("${STARDUST_ART.enemyRoster}")`,
    '--fighter-art-size': '400% 400%',
    '--fighter-art-position': `${(column / 3) * 100}% ${(row / 3) * 100}%`,
  };
}

function chooseMode(next: Mode) {
  mode.value = next;
  if (next === 'challenge') {
    if (!isFighterId(playerOne.value)) playerOne.value = 'jotaro';
    if (!isEnemyId(playerTwo.value)) playerTwo.value = 'gray-fly';
  } else if (isEnemyId(playerTwo.value) && !characterUnlocked(playerTwo.value)) {
    playerTwo.value = 'kakyoin';
  }
  playAudio('select');
}

function moving(side: Side): boolean {
  const fighter = side === 'p1' ? p1.value : controlledTwo.value;
  if (fighter?.standControl.mode === 'detached') return false;
  return side === 'p1'
    ? keys.has('KeyA') || keys.has('KeyD')
    : keys.has('ArrowLeft') || keys.has('ArrowRight');
}

function actionFrame(fighter: Combatant, side: Side): number {
  if (fighter.down) return 9;
  if (fighter.stun > 0) return 9;
  if (fighter.guard) return 7;
  if (fighter.attack === 'light') return fighter.attackFrames > 6 ? 4 : 5;
  if (fighter.attack === 'heavy') return fighter.attackFrames > 10 ? 6 : 7;
  if (fighter.attack === 'finger') return 6;
  if (fighter.attack === 'stand') return 4 + (animationPulse.value % 2);
  if (fighter.attack === 'special') return 10;
  if (fighter.jumpMs > 0) return 3;
  if (fighter.crouch) return 8;
  if (moving(side) || fighter.visualMovingMs > 0) return animationPulse.value % 2 === 0 ? 2 : 3;
  return Math.floor(animationPulse.value / 6) % 2;
}

function actionPose(fighter: Combatant, side: Side) {
  if (fighter.down) return 'down';
  if (fighter.stun > 0) return 'hurt';
  if (fighter.guard) return 'guard';
  if (fighter.attack) return fighter.attack;
  if (fighter.jumpMs > 0) return 'jump';
  if (fighter.crouch) return 'crouch';
  if (moving(side) || fighter.visualMovingMs > 0) return 'move';
  return 'idle';
}

function extendedFrame(fighter: Combatant): number | null {
  if (fighter.jumpMs > 0) {
    const elapsed = 520 - fighter.jumpMs;
    if (elapsed < 70) return 0;
    if (elapsed < 150) return 1;
    if (elapsed < 250) return 2;
    if (elapsed < 340) return 3;
    if (elapsed < 430) return 4;
    return 5;
  }
  if (fighter.crouch) return fighter.attack ? 7 : 6;
  return null;
}

function motionStyle(fighter: Combatant, side: Side) {
  // Boss owners use body-only frames even while jumping/crouching; their Stand is a separate entity.
  const expandedFrame = isBossStandOwner(fighter.id) ? null : extendedFrame(fighter);
  const frame = expandedFrame ?? actionFrame(fighter, side);
  let source: string;
  if (expandedFrame !== null) {
    source = STARDUST_ART.extendedMotion[fighter.id];
  } else if (isFighterId(fighter.id)) {
    source = STARDUST_ART.motion[fighter.id];
  } else {
    source = STARDUST_ART.villainMotion[fighter.id];
  }
  const column = frame % 4;
  const row = Math.floor(frame / 4);
  const rows = expandedFrame === null ? 3 : 2;
  return {
    '--fighter-motion': `url("${source}")`,
    '--frame-x': `${(column / 3) * 100}%`,
    '--frame-y': `${(row / (rows - 1)) * 100}%`,
    '--motion-size': `400% ${rows * 100}%`,
  };
}

function clearIntroTimers() {
  while (introTimers.length) window.clearTimeout(introTimers.pop());
}

function scheduleIntro(delay: number, action: () => void) {
  introTimers.push(window.setTimeout(action, delay));
}

function completeIntro() {
  introStep.value = 'done';
  impact.value = 'FIGHT';
  playAudio('fight');
  if (!startedAt.value) startedAt.value = performance.now();
  message.value = coop.value
    ? `${selectedOne.value.name}与${selectedTwo.value.name}共享三次复活。`
    : story.value
      ? `${selectedTwo.value.name}将由电脑控制并协助主角。`
      : solo.value
        ? `${selectedOne.value.name}独自踏上星尘远征。`
        : practice.value
          ? '练习开始：不限时间，木桩会自动恢复。'
          : `${selectedOne.value.name} 对 ${selectedTwo.value.name}`;
  scheduleIntro(500, () => {
    if (impact.value === 'FIGHT') impact.value = '';
  });
}

function beginIntro() {
  clearIntroTimers();
  keys.clear();
  introSlot.value = 0;
  introStep.value = 'summon';
  message.value = `${selectedOne.value.name}召唤替身`;
  playAudio('summon', selectedOne.value.id, -0.5);
  scheduleIntro(750, () => {
    introStep.value = 'panel';
    playAudio('panel', selectedOne.value.id, -0.35);
  });
  if (solo.value) {
    scheduleIntro(1750, () => {
      introStep.value = 'ready';
      message.value = '独自远征，开始！';
    });
    scheduleIntro(2500, completeIntro);
    return;
  }
  scheduleIntro(1750, () => {
    introSlot.value = 1;
    introStep.value = 'summon';
    message.value = `${selectedTwo.value.name}召唤替身`;
    playAudio('summon', selectedTwo.value.id, 0.5);
  });
  scheduleIntro(2500, () => {
    introStep.value = 'panel';
    playAudio('panel', selectedTwo.value.id, 0.35);
  });
  scheduleIntro(3500, () => {
    introStep.value = 'ready';
    message.value = adventure.value ? '星尘远征队，出发！' : '双方替身使者准备完毕';
  });
  scheduleIntro(4250, completeIntro);
}

function combatant(id: PlayableId, side: Side): Combatant {
  const fighter = characterFor(id);
  return {
    id,
    name: fighter.name,
    ...createCombatState(
      side,
      challenge.value && side === 'p2' && id === 'dio' ? DIO_BOSS_HP : undefined,
    ),
  };
}

function enemyForWave(current: number): Combatant {
  const definition = ENEMY_LADDER[Math.min(Math.max(0, current - 1), ENEMY_LADDER.length - 1)]!;
  return {
    ...createCombatState('p2', definition.id === 'dio' ? DIO_BOSS_HP : undefined),
    id: definition.id,
    name: definition.name,
    energy: definition.id === 'dio' ? 100 : Math.min(100, 10 + current * 6),
    x: 76,
    facing: -1,
    guard: false,
    stun: 0,
    attack: null,
    attackFrames: 0,
    barrageMs: 0,
    barrageVoiceMs: 0,
    barrageHitMs: 0,
    timeStopsUsed: 0,
    lastAudioX: 76,
    lastVisualX: 76,
    visualMovingMs: 0,
    jumpMs: 0,
    crouch: false,
    idleAudioMs: 4_500,
    combo: 0,
    down: false,
    standControl: createStandControl(76, -1),
    statusEffects: [],
  };
}

function start() {
  fingerStrikes.value = [];
  emeraldFlights.value = [];
  if (
    !characterUnlocked(playerOne.value) ||
    (usesSecondFighter.value &&
      !characterUnlocked(playerTwo.value) &&
      !(challenge.value && isEnemyId(playerTwo.value)))
  )
    return;
  ultimates.value = [];
  clearEffectTimers();
  match.value = createVersusMatch();
  hitEffects.value = [];
  fireballs.value = [];
  clearMovement();
  stopBarrageAudio();
  cancelTimeStop();
  audioEngine.resume();
  void audioEngine.preload([
    audioCue('light-swing', 'polnareff'),
    audioCue('heavy-swing', 'polnareff'),
  ]);
  playAudio('confirm');
  phase.value = 'fight';
  revives.value = reviveCapacity.value;
  wave.value = 1;
  timer.value = practice.value ? 99 : adventure.value ? 90 : 75;
  timerCarry = 0;
  animationCarry = 0;
  animationPulse.value = 0;
  p1.value = combatant(playerOne.value, 'p1');
  p1.value.x = adventure.value ? 28 : 25;
  p1.value.lastAudioX = p1.value.x;
  p1.value.lastVisualX = p1.value.x;
  p2.value = adventure.value ? enemyForWave(1) : combatant(playerTwo.value, 'p2');
  partner.value = story.value || coop.value ? combatant(playerTwo.value, 'p2') : undefined;
  if (partner.value) {
    partner.value.x = 14;
    partner.value.lastAudioX = partner.value.x;
    partner.value.lastVisualX = partner.value.x;
  }
  message.value = coop.value
    ? `${selectedOne.value.name}与${selectedTwo.value.name}共享三次复活。`
    : story.value
      ? `${selectedTwo.value.name}将由电脑控制并协助主角。`
      : solo.value
        ? `${selectedOne.value.name}独自踏上星尘远征。`
        : challenge.value
          ? `${selectedOne.value.name}挑战${selectedTwo.value.name}，单场决胜。`
          : practice.value
            ? '练习模式不限时间。'
            : `${selectedOne.value.name} 对 ${selectedTwo.value.name}`;
  impact.value = '';
  stopped.value = null;
  startedAt.value = 0;
  beginIntro();
}

function restartSelection() {
  fingerStrikes.value = [];
  emeraldFlights.value = [];
  fireballs.value = [];
  ultimates.value = [];
  clearEffectTimers();
  match.value = createVersusMatch();
  hitEffects.value = [];
  clearMovement();
  stopBarrageAudio();
  cancelTimeStop();
  clearIntroTimers();
  phase.value = 'select';
  p1.value = undefined;
  p2.value = undefined;
  partner.value = undefined;
  stopped.value = null;
  introStep.value = 'done';
  impact.value = '';
  message.value = '选择模式与角色，开始星尘远征。';
}

function distanceBetween(first: Combatant, second: Combatant) {
  return Math.abs(first.x - second.x);
}

function panFor(fighter: Combatant) {
  return Math.max(-0.85, Math.min(0.85, fighter.x / 50 - 1));
}

function playBarrageVoice(id: Combatant['id']) {
  if (id === 'polnareff') {
    playAudio('blade-swing', id);
    return;
  }
  if (id !== 'jotaro' && id !== 'dio') return;
  if (voiceEnabled.value) barrageVoice.play(id, props.settings.masterVolume);
  else playAudio('barrage', id);
}

function combatantFrozen(fighter: Combatant) {
  if ((adventure.value || challenge.value) && fighter === p2.value)
    return stopped.value !== null && stopped.value !== 'enemy';
  return isPlayerFrozen(stopped.value, fighter === p1.value ? 'p1' : 'p2');
}

function driveComputerStand(
  fighter: Combatant,
  enemies: Combatant[],
  dt: number,
  bodySpeed: number,
  action: Action,
) {
  if (!hasIndependentStand(fighter.id) || rangeRank(fighter) === 'E') return null;
  let state = computerStandStates.get(fighter);
  if (!state) {
    state = createStandAIState();
    computerStandStates.set(fighter, state);
  }
  const stand = fighter.standControl;
  const origin = stand.mode === 'detached' ? displayStandX(fighter) : fighter.x;
  const target = nearestTarget(origin, enemies, displayStandX);
  const direction: 1 | -1 = target && target.x < fighter.x ? -1 : 1;
  const limit = metersToPosition(STAND_LIMIT_METERS[rangeRank(fighter)]);
  const projected: Combatant = {
    ...fighter,
    standControl: {
      ...stand,
      mode: 'detached',
      facing: direction,
      x: Math.max(6, Math.min(94, fighter.x + direction * limit)),
    },
  };
  const plan = advanceStandAI(
    state,
    {
      mode: stand.mode,
      ownerX: fighter.x,
      standX: origin,
      maximumStandX: displayStandX(projected),
      targetX: target?.x ?? null,
      bodyAttackReach:
        action === 'stand' || action === 'special'
          ? metersToPosition(2)
          : attackSpecs[action].range,
      ranged: fighter.id === 'kakyoin',
      busy: fighter.attackFrames > 0,
      blocked:
        fighter.down ||
        fighter.stun > 0 ||
        stand.stunMs > 0 ||
        casting(fighter) ||
        fighter.attack === 'finger',
      frozen: combatantFrozen(fighter),
    },
    dt,
  );
  if (plan.transition) {
    toggleStand(stand, fighter.x, rangeRank(fighter));
    stand.facing = direction;
    if (plan.transition === 'recall' && fighter.attack === 'stand') {
      fighter.attack = null;
      fighter.attackFrames = 0;
      fighter.barrageMs = 0;
      fighter.barrageVoiceMs = 0;
      fighter.barrageHitMs = 0;
      if (fighter.id === 'jotaro' || fighter.id === 'dio') barrageVoice.stop(fighter.id);
    }
    playAudio('summon', fighter.id, panFor(fighter));
  } else if (plan.standDirection) {
    moveDetachedStand(
      stand,
      fighter.x,
      rangeRank(fighter),
      (plan.standDirection * STAND_MOVE_SPEED_METERS * dt) / 1000,
    );
  } else if (plan.bodyDirection && target) {
    const step = Math.min(
      bodySpeed * dt,
      Math.max(0, Math.abs(target.x - fighter.x) - plan.bodySpacing),
    );
    fighter.x = Math.max(6, Math.min(94, fighter.x + plan.bodyDirection * step));
  }
  if (target && stand.mode === 'detached' && !combatantFrozen(fighter))
    stand.facing = target.x < displayStandX(fighter) ? -1 : 1;
  return { target: target?.owner, canAttack: plan.canAttack };
}

function casting(fighter: Combatant) {
  return ultimates.value.some((entry) => entry.caster === fighter && entry.state.phase !== 'armed');
}

function ultimateReady(fighter?: Combatant) {
  return Boolean(
    fighter &&
    fighter.attackFrames <= 0 &&
    canUseUltimate(fighter) &&
    !ultimates.value.some((entry) => entry.caster === fighter),
  );
}

function ultimateLabel(fighter?: Combatant) {
  if (!fighter) return '必杀';
  if (fighter.ultimateCooldownMs > 0)
    return `冷却 ${Math.ceil(fighter.ultimateCooldownMs / 1000)}s`;
  return isHero(fighter.id) ? characterFor(fighter.id).special : '必杀';
}

function castUltimate(attacker: Combatant, defender: Combatant) {
  if (ultimates.value.some((entry) => entry.caster === attacker)) return;
  const state = beginUltimate(
    attacker,
    defender,
    (adventure.value || challenge.value) && defender === p2.value && defender.id === 'dio'
      ? defender.maxHp / 2
      : undefined,
  );
  if (!state) {
    message.value =
      attacker.ultimateCooldownMs > 0 ? '必杀技仍在冷却。' : '能量达到100%才能发动超必杀。';
    return;
  }
  attacker.attack = 'special';
  attacker.attackFrames = 2;
  attacker.barrageMs = 0;
  attacker.barrageVoiceMs = 0;
  attacker.barrageHitMs = 0;
  attacker.guard = false;
  attacker.crouch = false;
  attacker.jumpMs = 0;
  ultimates.value.push({ id: ultimateSequence++, caster: attacker, target: defender, state });
  message.value = ULTIMATE_NAMES[state.hero];
  impact.value = '';
  playAudio('special', attacker.id, panFor(attacker));
  if (state.hero === 'jotaro') playBarrageVoice(attacker.id);
}

function updateUltimates(dt: number) {
  const living = combatants.value.map((entry) => entry.fighter);
  for (const entry of [...ultimates.value]) {
    const { caster, target, state } = entry;
    if (caster.down || target.down || !living.includes(caster) || !living.includes(target)) {
      ultimates.value = ultimates.value.filter((candidate) => candidate.id !== entry.id);
      continue;
    }
    if (combatantFrozen(caster)) continue;
    if (state.phase !== 'armed') {
      caster.attack = 'special';
      caster.attackFrames = 2;
    }
    const previousHits = state.hits;
    const damage = advanceUltimate(state, target, dt);
    if (state.hero === 'jotaro' && state.phase === 'strike') {
      playBarrageVoice(caster.id);
      target.stun = Math.max(target.stun, 8);
    }
    if (state.hero === 'polnareff' && state.phase === 'strike') {
      if (state.hits > previousHits) playAudio('blade-ultimate', caster.id, panFor(target));
      target.stun = Math.max(target.stun, 8);
    }
    if (damage > 0) {
      const lostHp = Math.min(target.hp, damage);
      target.hp = Math.max(0, target.hp - damage);
      caster.combo += 1;
      if (state.hero !== 'kakyoin') target.stun = Math.max(target.stun, 8);
      hitEffects.value.push({
        id: hitSequence++,
        x: target.x,
        stand: false,
        color:
          state.hero === 'avdol' ? '#ffb43b' : state.hero === 'kakyoin' ? '#49ffbf' : '#fff4ad',
        type:
          state.phase === 'done' && (state.hero === 'jotaro' || state.hero === 'polnareff')
            ? `${state.hero}-final`
            : caster.id,
        damage: lostHp,
        label: damageLabel('special', false),
        life: 1100,
      });
      if (hitEffects.value.length > 16) hitEffects.value.shift();
      if (target.hp === 0) {
        handleKnockout(target);
        caster.attack = null;
        caster.attackFrames = 0;
        ultimates.value = ultimates.value.filter((candidate) => candidate.id !== entry.id);
        if (state.hero === 'jotaro') playAudio('heavy-hit', caster.id, panFor(target));
        if (state.hero === 'polnareff') playAudio('blade-finish', caster.id, panFor(target));
        if (phase.value !== 'fight') return;
      }
    }
    if (state.phase === 'done') {
      caster.attack = null;
      caster.attackFrames = 0;
      ultimates.value = ultimates.value.filter((candidate) => candidate.id !== entry.id);
    }
  }
}

function emitEmeralds(attacker: Combatant, action: EmeraldAction, sustained = false) {
  if (attacker.down || attacker.standControl.mode === 'vanished') return;
  const remote = attacker.standControl.mode === 'detached';
  const projectiles = launchEmeralds(
    attacker,
    action,
    remote ? displayStandX(attacker) : attacker.x,
    remote ? attacker.standControl.facing : attacker.facing,
    emeraldSequence,
    sustained,
  );
  emeraldSequence += projectiles.length;
  const targets = opponents(attacker);
  emeraldFlights.value.push(
    ...projectiles.map((projectile) => ({
      ...projectile,
      caster: attacker,
      targets,
    })),
  );
  if (projectiles.length) {
    if (remote) attacker.standControl.attackMs = 150;
    message.value =
      action === 'stand' ? '绿宝石连续发射' : action === 'heavy' ? '三重绿宝石' : '绿宝石发射';
  }
}

function updateEmeralds(dt: number) {
  const current = combatants.value.map((entry) => entry.fighter);
  for (const projectile of [...emeraldFlights.value]) {
    if (!emeraldFlights.value.includes(projectile)) continue;
    const { caster } = projectile;
    const enemies = projectile.targets.filter((target) => current.includes(target) && !target.down);
    if (!current.includes(caster) || caster.down || enemies.length === 0) {
      emeraldFlights.value = emeraldFlights.value.filter((entry) => entry.id !== projectile.id);
      continue;
    }
    const targets = enemies.flatMap((owner) => [
      { owner, x: owner.x, part: 'body' as const },
      ...(owner.standControl.mode === 'detached'
        ? [{ owner, x: displayStandX(owner), part: 'stand' as const }]
        : []),
    ]);
    const hit = advanceEmerald(projectile, targets, dt, combatantFrozen(caster));
    if (projectile.lifeMs <= 0)
      emeraldFlights.value = emeraldFlights.value.filter((entry) => entry.id !== projectile.id);
    if (!hit) continue;
    const { damage, guarded } = applyEmeraldHit(caster, hit.owner, projectile, hit.part);
    if (damage > 0)
      hitEffects.value.push({
        id: hitSequence++,
        x: hit.x,
        stand: hit.part === 'stand',
        color: guarded ? '#d9eeff' : '#62ffc5',
        type: guarded ? 'block' : 'kakyoin',
        damage,
        label: damageLabel(projectile.action, hit.part === 'stand', guarded),
        life: 1100,
      });
    if (hitEffects.value.length > 12) hitEffects.value.shift();
    message.value = guarded
      ? `${hit.owner.name}防住了绿宝石`
      : `${caster.name} · ${caster.combo} HIT`;
    if (!projectile.sustained)
      playAudio(guarded ? 'block' : 'light-hit', caster.id, panFor(hit.owner));
    if (hit.owner.hp <= 0) {
      handleKnockout(hit.owner);
      if (phase.value !== 'fight') return;
    }
  }
}

function strike(attacker: Combatant, defender: Combatant, action: Action) {
  if (
    action === 'finger' &&
    (attacker.id !== 'jotaro' || attacker.standControl.mode === 'vanished')
  )
    return;
  if (casting(attacker)) return;
  if (attacker.stun > 0 || attacker.attackFrames > 0 || attacker.down || defender.down) return;
  if (attacker.id === 'kakyoin' && attacker.standControl.mode === 'vanished') return;
  const specs = attackSpecs[action];
  if ((action === 'stand' || action === 'special') && attacker.standControl.mode === 'vanished')
    return;
  if (action === 'special' && isHero(attacker.id)) {
    castUltimate(attacker, defender);
    return;
  }
  if (action === 'special' && attacker.energy < 100) {
    message.value = '能量达到100才能发动超必杀。';
    return;
  }
  if (action === 'light') playAudio('light-swing', attacker.id, panFor(attacker));
  if (action === 'heavy') playAudio('heavy-swing', attacker.id, panFor(attacker));
  if (action === 'special') playAudio('special', attacker.id, panFor(attacker));
  attacker.attack = action;
  attacker.attackFrames = specs.frames;
  if (action === 'stand') {
    attacker.barrageDamageLeft = BARRAGE_DAMAGE_LIMIT;
    attacker.barrageMs = BARRAGE_DURATION_MS;
    attacker.barrageVoiceMs = BARRAGE_VOICE_INTERVAL_MS;
    attacker.barrageHitMs =
      attacker.id === 'kakyoin' ? EMERALD_BARRAGE_INTERVAL_MS : BARRAGE_HIT_INTERVAL_MS;
    playBarrageVoice(attacker.id);
    if (attacker.id === 'jotaro' || attacker.id === 'dio') {
      const shout =
        attacker.id === 'jotaro'
          ? { caption: '欧拉欧拉', line: '欧拉！欧拉！欧拉！' }
          : { caption: '木大木大', line: '木大！木大！木大！' };
      impact.value = shout.caption;
      message.value = shout.line;
      scheduleEffect(() => {
        if (impact.value === shout.caption) impact.value = '';
      }, 180);
    }
  } else {
    attacker.barrageMs = 0;
    attacker.barrageVoiceMs = 0;
    attacker.barrageHitMs = 0;
  }
  if (action === 'special') attacker.energy = 0;
  if (action === 'finger') {
    fingerStrikes.value.push({
      ...createStarFinger(),
      id: hitSequence++,
      attacker,
      facing:
        attacker.standControl.mode === 'detached' ? attacker.standControl.facing : attacker.facing,
    });
    playAudio('heavy-swing', attacker.id, panFor(attacker));
    return;
  }
  if (
    attacker.id === 'kakyoin' &&
    (action === 'light' || action === 'heavy' || action === 'stand')
  ) {
    emitEmeralds(attacker, action);
    return;
  }
  if (attacker.id === 'avdol' && action === 'light') {
    if (attacker.standControl.mode === 'vanished') return;
    const remote = attacker.standControl.mode === 'detached';
    fireballs.value.push({
      ...createFireball(
        remote ? displayStandX(attacker) : attacker.x,
        remote ? attacker.standControl.facing : attacker.facing,
      ),
      id: hitSequence++,
      attacker,
      defender,
    });
    return;
  }
  resolveHit(attacker, defender, action);
}

function updateFingerStrikes(dt: number) {
  for (const strike of [...fingerStrikes.value]) {
    if (phase.value !== 'fight') break;
    const { attacker } = strike;
    if (attacker.down || attacker.stun > 0 || attacker.standControl.mode === 'vanished') {
      strike.elapsedMs = STAR_FINGER_DURATION_MS;
      continue;
    }
    if (combatantFrozen(attacker)) continue;
    const reach = advanceStarFinger(strike, dt);
    if (reach === undefined) continue;
    const target = visibleTargetInReach(
      fingerOrigin(attacker),
      opponents(attacker),
      reach,
      displayStandX,
      strike.facing,
    );
    if (target) {
      strike.hit = true;
      applyVisibleHit(attacker, target.owner, 'finger', target, false);
    }
  }
  fingerStrikes.value = fingerStrikes.value.filter(
    (strike) => strike.elapsedMs < STAR_FINGER_DURATION_MS,
  );
}

function updateFireballs(dt: number) {
  for (const ball of [...fireballs.value]) {
    if (phase.value !== 'fight') break;
    if (ball.attacker.down || ball.defender.down) {
      ball.remaining = 0;
      continue;
    }
    if (combatantFrozen(ball.attacker)) continue;
    const { origin, reach } = advanceFireball(ball, dt);
    const target = visibleTargetInReach(origin, [ball.defender], reach, displayStandX, ball.facing);
    if (target) {
      ball.remaining = 0;
      applyVisibleHit(ball.attacker, ball.defender, 'light', target, false);
    }
  }
  fireballs.value = fireballs.value.filter(
    (ball) => ball.remaining > 0 && ball.x >= 0 && ball.x <= 100,
  );
}

function resolveHit(attacker: Combatant, defender: Combatant, action: Action, sustained = false) {
  if (phase.value !== 'fight' || attacker.down || defender.down || combatantFrozen(attacker))
    return;
  const specs = attackSpecs[action];
  const remote = attacker.standControl.mode === 'detached';
  const standAttack = remote || action === 'stand' || action === 'special';
  if (standAttack && attacker.standControl.mode === 'vanished') return;
  const origin = remote ? displayStandX(attacker) : attacker.x;
  const reach =
    action === 'stand'
      ? metersToPosition(BARRAGE_RANGE_METERS)
      : standAttack
        ? metersToPosition(
            remote ? STAND_HIT_REACH_METERS : Math.min(2, STAND_LIMIT_METERS[rangeRank(attacker)]),
          )
        : specs.range;
  const target = visibleTargetInReach(
    origin,
    [defender],
    reach,
    displayStandX,
    remote ? attacker.standControl.facing : undefined,
  );
  if (!target) {
    attacker.combo = 0;
    return;
  }
  applyVisibleHit(attacker, defender, action, target, sustained);
}

function applyVisibleHit(
  attacker: Combatant,
  defender: Combatant,
  action: Action,
  target: { part: 'body' | 'stand'; x: number },
  sustained: boolean,
) {
  const specs = attackSpecs[action];
  const previousHp = defender.hp;
  const { damage, guarded } = applyCombatHit(attacker, defender, action, target.part, sustained);
  if (damage <= 0) return;
  hitEffects.value.push({
    id: hitSequence++,
    x: target.part === 'stand' ? displayStandX(defender) : target.x,
    stand: target.part === 'stand',
    color: guarded
      ? '#d9eeff'
      : (roster.find((entry) => entry.id === attacker.id)?.accent ?? '#ffdd72'),
    type: guarded ? 'block' : attacker.id,
    damage: previousHp - defender.hp,
    label: damageLabel(
      attacker.id === 'avdol' && action === 'light' ? 'fireball' : action,
      target.part === 'stand',
      guarded,
    ),
    life: 1100,
  });
  if (hitEffects.value.length > 12) hitEffects.value.shift();
  if (guarded && !sustained) {
    playAudio('block', defender.id, panFor(defender));
  } else if (!sustained) {
    playAudio(action === 'heavy' ? 'heavy-hit' : 'light-hit', attacker.id, panFor(defender));
    playAudio('hurt', defender.id, panFor(defender));
  }
  const barrageCaption =
    action === 'stand'
      ? attacker.id === 'jotaro'
        ? '欧拉欧拉'
        : attacker.id === 'dio'
          ? '木大木大'
          : specs.word
      : specs.word;
  impact.value = guarded ? '铿' : barrageCaption;
  message.value = guarded
    ? `${defender.name}防住了攻击`
    : action === 'stand' && (attacker.id === 'jotaro' || attacker.id === 'dio')
      ? `${attacker.id === 'jotaro' ? '欧拉！欧拉！欧拉！' : '木大！木大！木大！'} · ${attacker.combo} HIT`
      : `${attacker.name} · ${attacker.combo} HIT`;
  scheduleEffect(() => {
    if (impact.value === barrageCaption || impact.value === '铿') impact.value = '';
  }, 180);
  if (defender.hp <= 0) handleKnockout(defender);
}

function handleKnockout(defender: Combatant) {
  if (defender.down) return;
  computerStandStates.delete(defender);
  emeraldFlights.value = emeraldFlights.value.filter(
    (projectile) => projectile.caster !== defender && !projectile.targets.includes(defender),
  );
  defender.down = true;
  defender.statusEffects = [];
  recallStand(defender.standControl, defender.x, true);
  impact.value = 'K.O.';
  playAudio('down', defender.id, panFor(defender));
  playAudio('ko', defender.id, panFor(defender));
  if (mode.value === 'versus') {
    match.value = settleRound(match.value, p1.value!.hp, p2.value!.hp);
    endVersusRound();
    return;
  }
  if (adventure.value && (defender === p1.value || defender === partner.value)) {
    if (revives.value > 0) {
      revives.value -= 1;
      message.value = `队友救援成功，剩余 ${revives.value} 次复活`;
      scheduleEffect(() => {
        defender.hp = defender.maxHp * 0.6;
        defender.down = false;
        defender.x = defender === p1.value ? 28 : 14;
        defender.lastVisualX = defender.x;
        defender.visualMovingMs = 0;
        recallStand(defender.standControl, defender.x);
        impact.value = '再起';
        playAudio('revive', defender.id, panFor(defender));
      }, 900);
      return;
    }
    const teammate = defender === p1.value ? partner.value : p1.value;
    if (teammate && !teammate.down) {
      message.value = `${defender.name}倒下，等待队友继续战斗`;
      return;
    }
    finish(false, '复活次数已经用尽，远征失败。');
    return;
  }
  if (defender === p2.value && adventure.value) {
    if (isEnemyId(defender.id)) recordEnemyDefeat(defender.id);
    if (wave.value < ENEMY_LADDER.length) {
      const defeatedTeam = currentEnemy.value.team;
      const nextEnemy = ENEMY_LADDER[wave.value]!;
      message.value =
        nextEnemy.team === defeatedTeam
          ? `${defender.name}退场，下一名敌人入场`
          : `${defeatedTeam}全员击破，进入${nextEnemy.team}`;
      playAudio(nextEnemy.team === defeatedTeam ? 'next-fighter' : 'team-clear');
      scheduleEffect(() => {
        cancelTimeStop();
        wave.value += 1;
        timer.value = 90;
        p2.value = enemyForWave(wave.value);
        if (p1.value) {
          p1.value.hp = Math.min(p1.value.maxHp, p1.value.hp + 90);
          p1.value.x = 24;
          p1.value.lastVisualX = p1.value.x;
          p1.value.visualMovingMs = 0;
          recallStand(p1.value.standControl, p1.value.x);
        }
        if (partner.value) {
          partner.value.hp = Math.min(partner.value.maxHp, partner.value.hp + 90);
          partner.value.x = 12;
          partner.value.lastVisualX = partner.value.x;
          partner.value.visualMovingMs = 0;
          recallStand(partner.value.standControl, partner.value.x);
        }
        impact.value = nextEnemy.team === defeatedTeam ? `NEXT ${wave.value}` : `${nextEnemy.team}`;
      }, 950);
      return;
    }
    finish(true, 'DIO被击败，承太郎在决战中掌握了短暂时停。');
    return;
  }
  if (practice.value && defender === p2.value) {
    scheduleEffect(() => {
      defender.hp = defender.maxHp;
      defender.down = false;
      defender.x = 75;
      defender.lastVisualX = defender.x;
      defender.visualMovingMs = 0;
      recallStand(defender.standControl, defender.x);
      impact.value = '木桩恢复';
    }, 700);
    return;
  }
  if (challenge.value && defender === p2.value && isEnemyId(defender.id)) {
    const victory = challengeVictory(enemyProgress.value, defender.id, defender.name);
    enemyProgress.value = victory.progress;
    saveEnemyProgress();
    finish(true, victory.summary);
    return;
  }
  finish(defender === p2.value, `${defender.name}倒下了。`);
}

function endVersusRound() {
  if (phase.value !== 'fight' || match.value.phase === 'fight') return;
  emeraldFlights.value = [];
  ultimates.value = [];
  clearEffectTimers();
  clearMovement();
  clearIntroTimers();
  stopBarrageAudio();
  cancelTimeStop();
  const winner = match.value.roundWinner;
  const score = `${match.value.wins.p1} : ${match.value.wins.p2}`;
  const summary = winner
    ? `P${winner === 'p1' ? 1 : 2} ${winner === 'p1' ? p1.value!.name : p2.value!.name}获胜`
    : '平局，不计胜场';
  message.value = `第 ${match.value.round} 回合${match.value.reason === 'timeout' ? '时间到，' : '，'}${summary} · ${score}`;
  if (match.value.phase === 'complete') {
    finish(match.value.winner === 'p1', `对战结束，${summary} · ${score}`);
  } else {
    phase.value = 'round-break';
    impact.value = winner ? 'ROUND OVER' : 'DRAW';
  }
}

function nextVersusRound() {
  fingerStrikes.value = [];
  emeraldFlights.value = [];
  fireballs.value = [];
  ultimates.value = [];
  clearMovement();
  hitEffects.value = [];
  p1.value = combatant(playerOne.value, 'p1');
  p2.value = combatant(playerTwo.value, 'p2');
  timer.value = Math.ceil(match.value.remainingMs / 1000);
  timerCarry = 0;
  animationCarry = 0;
  animationPulse.value = 0;
  phase.value = 'fight';
  completeIntro();
}

function finish(win: boolean, summary: string) {
  fingerStrikes.value = [];
  if (phase.value === 'result') return;
  emeraldFlights.value = [];
  ultimates.value = [];
  fireballs.value = [];
  clearEffectTimers();
  clearMovement();
  for (const { fighter } of combatants.value) {
    recallStand(fighter.standControl, fighter.x, true);
    fighter.statusEffects = [];
  }
  stopBarrageAudio();
  cancelTimeStop();
  clearIntroTimers();
  phase.value = 'result';
  stopped.value = null;
  message.value = summary;
  emit('finish', {
    gameId: 'stardust',
    sessionId: props.sessionId,
    outcome: win ? 'win' : 'lose',
    durationMs: Math.max(0, performance.now() - startedAt.value),
    summary,
    stats: {
      ...(mode.value === 'versus'
        ? {
            p1Wins: match.value.wins.p1,
            p2Wins: match.value.wins.p2,
            rounds: match.value.round,
          }
        : {}),
      waves: wave.value,
      revivesLeft: revives.value,
      combo: p1.value?.combo ?? 0,
    },
    reselectLabel: '重新选角',
  });
}

function act(side: Side, action: Action) {
  if (
    props.paused ||
    phase.value !== 'fight' ||
    introStep.value !== 'done' ||
    !p1.value ||
    !p2.value
  )
    return;
  const attacker = side === 'p1' ? p1.value : p2.value;
  const defender = side === 'p1' ? p2.value : p1.value;
  if (story.value && side === 'p2') return;
  if (practice.value && side === 'p2') return;
  if (challenge.value && side === 'p2') return;
  if (coop.value && side === 'p2' && partner.value) {
    if (isPlayerFrozen(stopped.value, side)) return;
    strike(partner.value, p2.value, action);
    return;
  }
  if (adventure.value && side === 'p2') return;
  if (isPlayerFrozen(stopped.value, side)) return;
  strike(attacker, defender, action);
}

function move(side: Side, direction: number, dt: number) {
  if (
    props.paused ||
    phase.value !== 'fight' ||
    introStep.value !== 'done' ||
    !p1.value ||
    !p2.value
  )
    return;
  const fighter =
    coop.value && side === 'p2' && partner.value
      ? partner.value
      : side === 'p1'
        ? p1.value
        : p2.value;
  if (story.value && side === 'p2') return;
  if (practice.value && side === 'p2') return;
  if (challenge.value && side === 'p2') return;
  if (adventure.value && side === 'p2' && !coop.value) return;
  if (
    fighter.stun ||
    fighter.down ||
    fighter.crouch ||
    fighter.attack === 'finger' ||
    casting(fighter) ||
    isPlayerFrozen(stopped.value, side)
  )
    return;
  if (fighter.standControl.mode === 'detached') {
    moveDetachedStand(
      fighter.standControl,
      fighter.x,
      rangeRank(fighter),
      (direction * STAND_MOVE_SPEED_METERS * dt) / 1000,
    );
  } else {
    fighter.x = Math.min(94, Math.max(6, fighter.x + direction * 0.18 * dt));
  }
}

function jump(side: Side) {
  if (
    props.paused ||
    phase.value !== 'fight' ||
    introStep.value !== 'done' ||
    !p1.value ||
    !p2.value
  )
    return;
  const fighter =
    coop.value && side === 'p2' && partner.value
      ? partner.value
      : side === 'p1'
        ? p1.value
        : p2.value;
  if (
    (story.value && side === 'p2') ||
    (practice.value && side === 'p2') ||
    (challenge.value && side === 'p2') ||
    (adventure.value && side === 'p2' && !coop.value) ||
    fighter.stun ||
    casting(fighter) ||
    fighter.down ||
    fighter.jumpMs > 0 ||
    fighter.attack === 'finger' ||
    fighter.standControl.mode === 'detached' ||
    isPlayerFrozen(stopped.value, side)
  )
    return;
  fighter.crouch = false;
  fighter.jumpMs = 520;
  playAudio('step', fighter.id, panFor(fighter));
}

function timeStop(side: Side) {
  if (phase.value !== 'fight') return;
  if (!p1.value || !p2.value || stopped.value || props.paused || introStep.value !== 'done') return;
  if (story.value && side === 'p2') return;
  if (practice.value && side === 'p2') return;
  if (challenge.value && side === 'p2') return;
  const fighter =
    coop.value && side === 'p2' && partner.value
      ? partner.value
      : side === 'p1'
        ? p1.value
        : p2.value;
  if (casting(fighter) || fighter.down || fighter.stun) return;
  if ((fighter.id !== 'jotaro' && fighter.id !== 'dio') || fighter.energy < 100) {
    message.value = '需要100能量才能时停。';
    return;
  }
  const seconds = fighter.id === 'dio' ? TIME_STOP_DURATION_MS.dio : TIME_STOP_DURATION_MS.jotaro;
  activateTimeStop(side, seconds, fighter, `${fighter.name}发动时停。`);
}

function keydown(event: KeyboardEvent) {
  if (event.repeat || phase.value !== 'fight' || introStep.value !== 'done') return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const target = event.target as HTMLElement;
  if (
    target.closest(
      'input:not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"]',
    )
  )
    return;
  keys.add(event.code);
  const bindings: Partial<Record<string, () => void>> = {
    KeyJ: () => act('p1', 'light'),
    KeyK: () => act('p1', 'heavy'),
    KeyU: () => act('p1', 'stand'),
    KeyI: () => act('p1', 'special'),
    KeyO: () => act('p1', 'finger'),
    KeyT: () => timeStop('p1'),
    KeyF: () => detachStand('p1'),
    KeyQ: () => changeStandDistance('p1', -1),
    KeyE: () => changeStandDistance('p1', 1),
    KeyW: () => jump('p1'),
    Digit1: () => act('p2', 'light'),
    Digit2: () => act('p2', 'heavy'),
    Digit4: () => act('p2', 'stand'),
    Digit6: () => act('p2', 'special'),
    Digit0: () => act('p2', 'finger'),
    Digit5: () => timeStop('p2'),
    Digit7: () => detachStand('p2'),
    Digit8: () => changeStandDistance('p2', -1),
    Digit9: () => changeStandDistance('p2', 1),
    ArrowUp: () => jump('p2'),
  };
  if (bindings[event.code]) {
    event.preventDefault();
    bindings[event.code]!();
  }
}

function keyup(event: KeyboardEvent) {
  keys.delete(event.code);
}

function tick(now: number) {
  const dt = Math.min(34, now - last || 16.7);
  last = now;
  if (phase.value === 'round-break' && !props.paused) {
    match.value = advanceVersusMatch(match.value, dt, p1.value!.hp, p2.value!.hp);
    if (match.value.phase === 'fight') nextVersusRound();
    raf = requestAnimationFrame(tick);
    return;
  }
  if (
    !props.paused &&
    phase.value === 'fight' &&
    introStep.value === 'done' &&
    p1.value &&
    p2.value
  ) {
    for (const effect of hitEffects.value) effect.life -= dt;
    hitEffects.value = hitEffects.value.filter((effect) => effect.life > 0);
    animationCarry += dt;
    if (animationCarry >= 110) {
      animationCarry %= 110;
      animationPulse.value = (animationPulse.value + 1) % 120;
    }
    if (!isPlayerFrozen(stopped.value, 'p1')) p1.value.guard = keys.has('KeyL');
    if (!isPlayerFrozen(stopped.value, 'p2')) {
      p2.value.guard = mode.value === 'versus' && keys.has('Digit3');
      if (partner.value) partner.value.guard = coop.value && keys.has('Digit3');
    }
    p1.value.crouch =
      p1.value.standControl.mode !== 'detached' &&
      !p1.value.guard &&
      p1.value.jumpMs <= 0 &&
      !p1.value.down &&
      keys.has('KeyS');
    if (mode.value === 'versus') {
      p2.value.crouch =
        p2.value.standControl.mode !== 'detached' &&
        !p2.value.guard &&
        p2.value.jumpMs <= 0 &&
        !p2.value.down &&
        keys.has('ArrowDown');
    }
    if (coop.value && partner.value) {
      partner.value.crouch =
        partner.value.standControl.mode !== 'detached' &&
        !partner.value.guard &&
        partner.value.jumpMs <= 0 &&
        !partner.value.down &&
        keys.has('ArrowDown');
    }
    const p1Direction = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) || touchMovement.p1;
    const p2Direction =
      Number(keys.has('ArrowRight')) - Number(keys.has('ArrowLeft')) || touchMovement.p2;
    if (p1Direction) move('p1', p1Direction, dt);
    if (p2Direction) move('p2', p2Direction, dt);
    updateUltimates(dt);
    if (phase.value === 'fight') updateFingerStrikes(dt);
    if (phase.value === 'fight') updateEmeralds(dt);
    if (phase.value === 'fight') updateFireballs(dt);
    if (phase.value !== 'fight') {
      raf = requestAnimationFrame(tick);
      return;
    }
    const fighters = [p1.value, p2.value, partner.value].filter(
      (candidate): candidate is Combatant => Boolean(candidate),
    );
    for (const fighter of fighters) {
      if (phase.value !== 'fight') break;
      const visualDelta = Math.abs(fighter.x - fighter.lastVisualX);
      if (visualDelta >= 0.08) {
        fighter.visualMovingMs = 180;
        fighter.lastVisualX = fighter.x;
      } else {
        fighter.visualMovingMs = Math.max(0, fighter.visualMovingMs - dt);
      }
      fighter.jumpMs = Math.max(0, fighter.jumpMs - dt);
      if (fighter.down) {
        recallStand(fighter.standControl, fighter.x, true);
        fighter.attack = null;
        fighter.attackFrames = 0;
        fighter.barrageMs = 0;
        fighter.barrageVoiceMs = 0;
        fighter.barrageHitMs = 0;
        continue;
      }
      if (combatantFrozen(fighter)) continue;
      fighter.ultimateCooldownMs = Math.max(0, fighter.ultimateCooldownMs - dt);
      if (enforceStandRange(fighter.standControl, fighter.x, rangeRank(fighter))) {
        if (fighter.attack === 'stand' || fighter.attack === 'special') {
          fighter.attack = null;
          fighter.attackFrames = 0;
          fighter.barrageMs = 0;
          fighter.barrageVoiceMs = 0;
          fighter.barrageHitMs = 0;
        }
      }
      fighter.statusEffects = fighter.statusEffects.filter(
        (effect) => effect.part === 'body' || fighter.standControl.mode === 'detached',
      );
      for (const effect of advanceStatuses(fighter.statusEffects, dt)) {
        const damage = ownerDamage(STATUS_DAMAGE, effect.part, false);
        const lostHp = Math.min(fighter.hp, damage);
        fighter.hp = Math.max(0, fighter.hp - damage);
        hitEffects.value.push({
          id: hitSequence++,
          x: effect.part === 'stand' ? displayStandX(fighter) : fighter.x,
          stand: effect.part === 'stand',
          type: effect.kind,
          damage: lostHp,
          label: damageLabel(effect.kind, effect.part === 'stand'),
          life: 1100,
          color:
            effect.kind === 'burn' ? '#ffae47' : effect.kind === 'emerald' ? '#63ffd0' : '#ff6286',
        });
        if (fighter.hp <= 0) {
          handleKnockout(fighter);
          break;
        }
      }
      fighter.statusEffects = fighter.statusEffects.filter((effect) => effect.remainingMs > 0);
      if (fighter.down || phase.value !== 'fight') continue;
      advanceDetachedStand(fighter.standControl, fighter.x, rangeRank(fighter), dt);
      fighter.stun = Math.max(0, fighter.stun - 1);
      if (
        fighter.attack === 'finger' &&
        fingerStrikes.value.some((strike) => strike.attacker === fighter)
      ) {
        fighter.attackFrames = 1;
      } else if (fighter.attack === 'stand' && fighter.barrageMs > 0) {
        if (advanceBarrage(fighter, dt)) {
          playBarrageVoice(fighter.id);
        }
        if (
          advanceBarrageHit(
            fighter,
            dt,
            fighter.id === 'kakyoin' ? EMERALD_BARRAGE_INTERVAL_MS : BARRAGE_HIT_INTERVAL_MS,
          )
        ) {
          if (fighter.id === 'kakyoin') {
            emitEmeralds(fighter, 'stand', true);
          } else {
            const origin =
              fighter.standControl.mode === 'detached' ? displayStandX(fighter) : fighter.x;
            const target = nearestTarget(
              origin,
              opponents(fighter),
              displayStandX,
              fighter.standControl.mode === 'detached' ? fighter.standControl.facing : undefined,
            );
            if (target) resolveHit(fighter, target.owner, 'stand', true);
          }
          if (phase.value !== 'fight') break;
        }
        fighter.attackFrames = fighter.barrageMs > 0 ? 1 : 0;
      } else {
        fighter.attackFrames = Math.max(0, fighter.attackFrames - 1);
      }
      if (!fighter.attackFrames) {
        fighter.attack = null;
        fighter.barrageMs = 0;
        fighter.barrageVoiceMs = 0;
        fighter.barrageHitMs = 0;
      }
      const traveled = Math.abs(fighter.x - fighter.lastAudioX);
      if (traveled >= 1.4) {
        playAudio('step', fighter.id, panFor(fighter));
        fighter.lastAudioX = fighter.x;
        fighter.idleAudioMs = 4_000;
      } else if (!fighter.attack && !fighter.down && fighter.stun === 0) {
        fighter.idleAudioMs -= dt;
        if (fighter.idleAudioMs <= 0) {
          playAudio('idle', fighter.id, panFor(fighter));
          fighter.idleAudioMs = 4_500 + (fighter.name.length % 4) * 650;
        }
      }
    }
    for (const id of ['jotaro', 'dio'] as const) {
      if (
        !fighters.some(
          (fighter) =>
            fighter.id === id &&
            (fighter.barrageMs > 0 ||
              ultimates.value.some(
                (entry) => entry.caster === fighter && entry.state.hero === 'jotaro',
              )) &&
            !fighter.down &&
            !combatantFrozen(fighter),
        )
      )
        barrageVoice.stop(id);
    }
    if (phase.value !== 'fight') {
      raf = requestAnimationFrame(tick);
      return;
    }
    if (p1.value.attack !== 'finger') p1.value.facing = p1.value.x <= p2.value.x ? 1 : -1;
    if (partner.value && partner.value.attack !== 'finger')
      partner.value.facing = partner.value.x <= p2.value.x ? 1 : -1;
    const availableTargets = [p1.value, partner.value].filter((candidate): candidate is Combatant =>
      Boolean(candidate && !candidate.down),
    );
    const enemyTarget = nearestTarget(p2.value.x, availableTargets, displayStandX) ?? {
      owner: p1.value,
      x: p1.value.x,
    };
    if (p2.value.attack !== 'finger') p2.value.facing = p2.value.x <= enemyTarget.x ? 1 : -1;
    if (!stopped.value && story.value && partner.value && !partner.value.down && !p2.value.down) {
      const action = partner.value.energy >= 100 ? 'special' : 'stand';
      const control = driveComputerStand(partner.value, [p2.value], dt, 0.045, action);
      if (control) {
        if (control.canAttack && control.target && Math.random() < dt / 1200)
          strike(partner.value, control.target, action);
      } else if (
        partner.value.id !== 'kakyoin' &&
        distanceBetween(partner.value, p2.value) > metersToPosition(1.5)
      ) {
        partner.value.x += (partner.value.x < p2.value.x ? 1 : -1) * 0.045 * dt;
      } else if (Math.random() < dt / 1200) {
        strike(partner.value, p2.value, partner.value.energy >= 100 ? 'special' : 'stand');
      }
    }
    if (
      (adventure.value || challenge.value) &&
      (!stopped.value || stopped.value === 'enemy') &&
      !p2.value.down
    ) {
      const enemy = p2.value;
      if (
        enemy.id === 'dio' &&
        !stopped.value &&
        enemy.energy >= 100 &&
        enemy.timeStopsUsed === 0
      ) {
        activateTimeStop(
          'enemy',
          TIME_STOP_DURATION_MS.dio,
          enemy,
          'DIO发动「世界」：五秒内所有对手无法移动或攻击。',
        );
      }
      const action = wave.value === 3 || enemy.id === 'dio' ? 'stand' : 'heavy';
      const control = driveComputerStand(enemy, availableTargets, dt, 0.055, action);
      if (control) {
        if (control.canAttack && control.target && Math.random() < dt / 950)
          strike(enemy, control.target, action);
      } else if (Math.abs(enemyTarget.x - enemy.x) > 16)
        enemy.x += (enemyTarget.x < enemy.x ? -1 : 1) * 0.055 * dt;
      else if (Math.random() < dt / 950)
        strike(
          enemy,
          enemyTarget.owner,
          wave.value === 3 || enemy.id === 'dio' ? 'stand' : 'heavy',
        );
    }
    if (mode.value === 'versus') {
      match.value = advanceVersusMatch(
        match.value,
        dt,
        p1.value.hp,
        p2.value.hp,
        Boolean(stopped.value),
      );
      timer.value = Math.ceil(match.value.remainingMs / 1000);
      endVersusRound();
    } else if (!stopped.value && !practice.value) {
      timerCarry += dt;
      if (timerCarry >= 1000) {
        timer.value = Math.max(0, timer.value - 1);
        timerCarry -= 1000;
        if (timer.value === 0) finish((p1.value.hp ?? 0) >= (p2.value.hp ?? 0), '时间到。');
      }
    }
  }
  raf = requestAnimationFrame(tick);
}

watch(
  arenaElement,
  (element) => {
    arenaObserver?.disconnect();
    if (!element) {
      arenaWidth.value = 0;
      return;
    }
    const measure = () => {
      arenaWidth.value = element.clientWidth;
      standSpriteWidth.value =
        Number.parseFloat(getComputedStyle(element).getPropertyValue('--stand-art-width')) || 150;
    };
    measure();
    arenaObserver = new ResizeObserver(measure);
    arenaObserver.observe(element);
  },
  { flush: 'post' },
);

watch(
  () => props.paused,
  (paused) => {
    clearMovement();
    if (paused) {
      barrageVoice.stop();
      audioEngine.suspend();
    } else {
      audioEngine.resume();
    }
  },
);

watch(
  () => props.settings.masterVolume <= 0 || !voiceEnabled.value,
  (silent) => {
    if (silent) barrageVoice.stop();
  },
);

watch(sfxEnabled, (enabled) => {
  if (!enabled) audioEngine.stop();
});

watch(
  () => props.attempt,
  () => {
    if (props.restartMode === 'select') restartSelection();
    else if (phase.value !== 'select') start();
  },
);

onMounted(() => {
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearMovement);
  raf = requestAnimationFrame(tick);
});
onUnmounted(() => {
  clearEffectTimers();
  arenaObserver?.disconnect();
  clearIntroTimers();
  cancelTimeStop();
  cancelAnimationFrame(raf);
  stopBarrageAudio();
  audioEngine.close();
  window.removeEventListener('keydown', keydown);
  window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', clearMovement);
});
</script>

<template>
  <main class="stardust" :data-phase="phase" :data-mode="mode" data-testid="stardust-game">
    <section v-if="phase === 'select'" class="select-screen">
      <header>
        <span>STAND BATTLE / CAIRO ROUTE</span>
        <h2>星尘远征：<strong>替身决斗</strong></h2>
        <p>选择角色，踏上通往开罗的最后旅程。</p>
      </header>

      <div class="mode-tabs" role="group" aria-label="选择游戏模式">
        <button :aria-pressed="mode === 'solo'" @click="chooseMode('solo')">
          <b>纯单人冒险</b><span>独自挑战十四名反派，没有伙伴协助</span>
        </button>
        <button :aria-pressed="mode === 'story'" @click="chooseMode('story')">
          <b>AI伙伴冒险</b><span>选择主角，电脑伙伴协助远征</span>
        </button>
        <button :aria-pressed="mode === 'coop'" @click="chooseMode('coop')">
          <b>双人冒险</b><span>两名玩家并肩作战，共享三次复活</span>
        </button>
        <button :aria-pressed="mode === 'challenge'" @click="chooseMode('challenge')">
          <b>挑战模式</b><span>选择指定敌人单挑，胜利计入30次解锁进度</span>
        </button>
        <button :aria-pressed="mode === 'versus'" @click="chooseMode('versus')">
          <b>双人格斗</b><span>同机一对一，独立移动与替身技</span>
        </button>
        <button :aria-pressed="mode === 'practice'" @click="chooseMode('practice')">
          <b>练习模式</b><span>不限时间，木桩倒地后自动恢复</span>
        </button>
      </div>
      <div v-if="adventure" class="enemy-route" data-testid="stardust-enemy-route">
        <span>闯关顺序</span>
        <ol>
          <li v-for="(enemy, index) in ENEMY_LADDER" :key="enemy.id">
            <small>{{ index + 1 }}</small
            >{{ enemy.name }}<em>{{ enemy.stand }}</em>
          </li>
        </ol>
      </div>

      <div class="selection-grid" :class="{ single: !usesSecondFighter }">
        <section>
          <div class="section-heading">
            <span>01</span>
            <h3>玩家一</h3>
          </div>
          <div class="roster" role="group" aria-label="玩家一选择角色">
            <button
              v-for="fighter in playerOneChoices"
              :key="fighter.id"
              :aria-pressed="playerOne === fighter.id"
              :class="{ 'locked-character': !characterSelectable('p1', fighter.id) }"
              :data-testid="`stardust-choice-p1-${fighter.id}`"
              :data-unlocked="characterSelectable('p1', fighter.id)"
              :style="{
                '--fighter': fighter.color,
                '--accent': fighter.accent,
                ...artStyle(fighter.id),
              }"
              @click="openCharacterInfo('p1', fighter.id)"
            >
              <i
                class="roster-art"
                :class="{ 'enemy-roster-art': isEnemyId(fighter.id) }"
                aria-hidden="true"
              ></i>
              <span>{{ fighter.role }}</span>
              <b>{{ fighter.name }}</b>
              <small>{{ fighter.stand }}</small>
              <span v-if="isEnemyId(fighter.id)" class="unlock-progress">
                <Lock v-if="!characterSelectable('p1', fighter.id)" :size="12" aria-hidden="true" />
                {{
                  characterUnlocked(fighter.id)
                    ? '已解锁'
                    : `${enemyProgress[fighter.id] ?? 0} / ${ENEMY_UNLOCK_KILLS}`
                }}
              </span>
            </button>
          </div>
        </section>

        <section v-if="usesSecondFighter">
          <div class="section-heading">
            <span>02</span>
            <h3>
              {{
                story ? '电脑伙伴' : coop ? '玩家二伙伴' : challenge ? '选择挑战敌人' : '对手角色'
              }}
            </h3>
          </div>
          <div
            class="roster"
            role="group"
            :aria-label="challenge ? '选择挑战敌人' : adventure ? '选择同行伙伴' : '玩家二选择角色'"
          >
            <button
              v-for="fighter in playerTwoChoices"
              :key="fighter.id"
              :aria-pressed="playerTwo === fighter.id"
              :class="{ 'locked-character': !characterSelectable('p2', fighter.id) }"
              :data-testid="`stardust-choice-p2-${fighter.id}`"
              :data-unlocked="characterSelectable('p2', fighter.id)"
              :style="{
                '--fighter': fighter.color,
                '--accent': fighter.accent,
                ...artStyle(fighter.id),
              }"
              @click="openCharacterInfo('p2', fighter.id)"
            >
              <i
                class="roster-art"
                :class="{ 'enemy-roster-art': isEnemyId(fighter.id) }"
                aria-hidden="true"
              ></i>
              <span>{{ fighter.role }}</span>
              <b>{{ fighter.name }}</b>
              <small>{{ fighter.stand }}</small>
              <span v-if="isEnemyId(fighter.id)" class="unlock-progress">
                <Lock v-if="!characterSelectable('p2', fighter.id)" :size="12" aria-hidden="true" />
                {{
                  challenge
                    ? `挑战进度 ${enemyProgress[fighter.id] ?? 0} / ${ENEMY_UNLOCK_KILLS}`
                    : characterUnlocked(fighter.id)
                      ? '已解锁'
                      : `${enemyProgress[fighter.id] ?? 0} / ${ENEMY_UNLOCK_KILLS}`
                }}
              </span>
            </button>
          </div>
        </section>
      </div>

      <aside class="mission-card">
        <div>
          <span>{{
            adventure ? '剧情任务' : challenge ? '单挑任务' : practice ? '练习设置' : '对战规则'
          }}</span>
          <strong>{{
            usesSecondFighter ? `${selectedOne.name} × ${selectedTwo.name}` : selectedOne.name
          }}</strong>
          <p v-if="coop">
            两名玩家分别操作角色，连续击破四支三人队伍及两名最终首领；全队共享三次复活。
          </p>
          <p v-else-if="story">
            电脑伙伴会自动协助，依次挑战十四名反派；胜者保留生命与能量进入下一战。
          </p>
          <p v-else-if="solo">只操作一名主角，独自挑战十四名反派；没有伙伴、救援或组合技。</p>
          <p v-else-if="challenge">
            与所选敌人进行单场对决；每次获胜增加一次击败进度，累计三十次解锁该角色。
          </p>
          <p v-else-if="practice">木桩不会主动攻击，没有倒计时，适合测试连击和替身技能。</p>
          <p v-else>三局两胜，每回合75秒；超时按剩余生命判胜，平局不计胜场并加赛。</p>
        </div>
        <button class="start-button" data-testid="stardust-start" @click="start">
          开始{{ adventure ? '远征' : challenge ? '挑战' : practice ? '练习' : '对战' }}
          <span>→</span>
        </button>
      </aside>
    </section>

    <section v-else class="battle-screen" :class="{ frozen: !!stopped }">
      <header class="battle-head">
        <div>
          <span>{{ battleTitle }}</span>
          <strong>{{ message }}</strong>
        </div>
        <div class="clock">
          <b>{{ practice ? '∞' : timer }}</b
          ><span>TIME</span>
        </div>
        <div v-if="adventure" class="revives" data-testid="stardust-revives">
          <span>{{ coop ? '共享复活' : '检查点' }}</span
          ><b>{{ '◆'.repeat(revives) }}{{ '◇'.repeat(reviveCapacity - revives) }}</b>
        </div>
      </header>
      <div
        v-if="mode === 'versus'"
        class="round-score"
        data-testid="stardust-score"
        aria-live="polite"
      >
        <span>第 {{ match.round }} 回合 · 先赢两局</span>
        <strong>P1 {{ match.wins.p1 }} : {{ match.wins.p2 }} P2</strong>
        <span v-if="phase === 'round-break'" data-testid="stardust-round-break">
          {{ match.roundWinner ? '下一回合准备中' : '平局加赛准备中' }}
        </span>
      </div>

      <div class="hud">
        <div class="fighter-hud">
          <div>
            <b>{{ p1?.name }}</b
            ><span>P1 · {{ Math.ceil(p1?.hp ?? 0) }}/{{ p1?.maxHp }}</span>
          </div>
          <div class="health">
            <i :style="{ width: `${((p1?.hp ?? 0) / (p1?.maxHp ?? 1)) * 100}%` }"></i>
          </div>
          <div class="energy">
            <i :style="{ width: `${p1?.energy ?? 0}%` }"></i
            ><span>STAND {{ p1?.energy ?? 0 }}</span>
          </div>
        </div>
        <div class="fighter-hud enemy">
          <div>
            <span
              >{{ adventure ? `WAVE ${wave}/${ENEMY_LADDER.length}` : 'P2' }} ·
              {{ Math.ceil(p2?.hp ?? 0) }}/{{ p2?.maxHp }}</span
            ><b>{{ p2?.name }}</b>
          </div>
          <div class="health">
            <i :style="{ width: `${((p2?.hp ?? 0) / (p2?.maxHp ?? 1)) * 100}%` }"></i>
          </div>
          <div class="energy">
            <i :style="{ width: `${p2?.energy ?? 0}%` }"></i
            ><span>STAND {{ p2?.energy ?? 0 }}</span>
          </div>
        </div>
      </div>
      <div v-if="partner" class="partner-hud" data-testid="stardust-partner-hud">
        <span>{{ story ? 'AI伙伴' : 'P2伙伴' }}</span>
        <b>{{ partner.name }}</b>
        <div class="health">
          <i :style="{ width: `${(partner.hp / partner.maxHp) * 100}%` }"></i>
        </div>
        <small>STAND {{ partner.energy }}</small>
      </div>

      <div ref="arenaElement" class="arena" data-testid="stardust-arena">
        <div class="sun" aria-hidden="true"></div>
        <div class="city" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
        <div class="speed-lines" aria-hidden="true"></div>
        <div
          v-if="introStep !== 'done'"
          class="stand-intro"
          :class="`step-${introStep}`"
          data-testid="stardust-intro"
        >
          <div v-if="introStep === 'summon'" class="stand-summon">
            <div class="summon-rings" aria-hidden="true"></div>
            <div
              class="summon-character"
              :style="artStyle(introFighter.id)"
              aria-hidden="true"
            ></div>
            <div class="summon-copy">
              <span>{{ introSlot === 0 ? 'PLAYER 1' : adventure ? 'PARTNER' : 'PLAYER 2' }}</span>
              <strong>{{ introFighter.name }}</strong>
              <p>替身显现</p>
            </div>
          </div>
          <div v-else-if="introStep === 'panel'" class="stand-panel">
            <div class="panel-art" :style="artStyle(introFighter.id)" aria-hidden="true"></div>
            <div class="panel-copy">
              <span>STAND NAME</span>
              <h3>{{ introFighter.stand }}</h3>
              <p>{{ introFighter.role }} · {{ introFighter.special }}</p>
              <dl>
                <div v-for="(rank, label) in standProfileFor(introFighter.id)" :key="label">
                  <dt>{{ label }}</dt>
                  <dd>{{ rank }}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div v-else class="stand-ready">
            <span>STAND USERS READY</span>
            <strong>FIGHT</strong>
          </div>
        </div>
        <div v-if="impact" class="impact" aria-live="polite">{{ impact }}</div>
        <div
          v-if="p1"
          class="combatant player"
          :class="{
            [`fighter-${p1.id}`]: true,
            attacking: p1.attack && p1.standControl.mode !== 'detached',
            guarding: p1.guard,
            jumping: p1.jumpMs > 0,
            crouching: p1.crouch,
            hurt: p1.stun > 0,
            down: p1.down,
          }"
          :style="{ left: `${p1.x}%`, transform: `translateX(-50%) scaleX(${p1.facing})` }"
          :data-attack="p1.attack ?? 'idle'"
          :data-pose="actionPose(p1, 'p1')"
          :data-barrage-ms="Math.ceil(p1.barrageMs)"
          :data-hp="p1.hp"
          :data-character="p1.id"
          :data-energy="p1.energy"
          :data-ultimate-cd="Math.ceil(p1.ultimateCooldownMs)"
          :data-status="p1.statusEffects.map((effect) => effect.kind).join(' ')"
          :data-stand-mode="p1.standControl.mode"
          data-testid="stardust-p1"
        >
          <div
            class="fighter-art"
            :class="{ 'separated-art': separateBody(p1), 'boss-body-art': isBossStandOwner(p1.id) }"
            :style="separateBody(p1) ? separatedStyle(p1) : motionStyle(p1, 'p1')"
            aria-hidden="true"
          ></div>
        </div>
        <div
          v-if="p2"
          class="combatant rival"
          :class="{
            [`fighter-${p2.id}`]: true,
            attacking: p2.attack && p2.standControl.mode !== 'detached',
            guarding: p2.guard,
            jumping: p2.jumpMs > 0,
            crouching: p2.crouch,
            hurt: p2.stun > 0,
            down: p2.down,
          }"
          :style="{ left: `${p2.x}%`, transform: `translateX(-50%) scaleX(${p2.facing})` }"
          :data-attack="p2.attack ?? 'idle'"
          :data-pose="actionPose(p2, 'p2')"
          :data-barrage-ms="Math.ceil(p2.barrageMs)"
          :data-hp="p2.hp"
          :data-character="p2.id"
          :data-energy="p2.energy"
          :data-ultimate-cd="Math.ceil(p2.ultimateCooldownMs)"
          :data-status="p2.statusEffects.map((effect) => effect.kind).join(' ')"
          :data-stand-mode="p2.standControl.mode"
          data-testid="stardust-p2"
        >
          <div
            class="fighter-art"
            :class="{ 'separated-art': separateBody(p2), 'boss-body-art': isBossStandOwner(p2.id) }"
            :style="separateBody(p2) ? separatedStyle(p2) : motionStyle(p2, 'p2')"
            aria-hidden="true"
          ></div>
        </div>
        <div
          v-if="partner"
          class="combatant partner"
          :class="{
            [`fighter-${partner.id}`]: true,
            attacking: partner.attack && partner.standControl.mode !== 'detached',
            guarding: partner.guard,
            jumping: partner.jumpMs > 0,
            crouching: partner.crouch,
            hurt: partner.stun > 0,
            down: partner.down,
          }"
          :style="{
            left: `${partner.x}%`,
            transform: `translateX(-50%) scaleX(${partner.facing})`,
          }"
          :data-attack="partner.attack ?? 'idle'"
          :data-pose="actionPose(partner, 'p2')"
          :data-barrage-ms="Math.ceil(partner.barrageMs)"
          :data-hp="partner.hp"
          :data-status="partner.statusEffects.map((effect) => effect.kind).join(' ')"
          :data-stand-mode="partner.standControl.mode"
          data-testid="stardust-partner"
        >
          <div
            class="fighter-art"
            :class="{
              'separated-art': separateBody(partner),
              'boss-body-art': isBossStandOwner(partner.id),
            }"
            :style="separateBody(partner) ? separatedStyle(partner) : motionStyle(partner, 'p2')"
            aria-hidden="true"
          ></div>
        </div>
        <template v-for="entry in combatants" :key="`stand-${entry.key}`">
          <template
            v-if="
              !entry.fighter.down &&
              (entry.fighter.standControl.mode === 'detached' ||
                entry.fighter.attack === 'finger' ||
                ((entry.fighter.id === 'kakyoin' || isBossStandOwner(entry.fighter.id)) &&
                  entry.fighter.standControl.mode === 'attached'))
            "
          >
            <div
              v-if="entry.fighter.standControl.mode === 'detached'"
              class="stand-tether"
              :class="{ 'stand-tether--kakyoin': entry.fighter.id === 'kakyoin' }"
              aria-hidden="true"
              :style="{
                left: `${Math.min(entry.fighter.x, displayStandX(entry.fighter))}%`,
                width: `${Math.abs(entry.fighter.x - displayStandX(entry.fighter))}%`,
              }"
            >
              <i v-if="entry.fighter.id === 'kakyoin'"></i>
              <i v-if="entry.fighter.id === 'kakyoin'"></i>
            </div>
            <div
              class="detached-stand"
              :class="{
                [`stand-${entry.fighter.id}`]: true,
                'boss-stand': isBossStandOwner(entry.fighter.id),
                striking:
                  entry.fighter.standControl.attackMs > 0 ||
                  (isBossStandOwner(entry.fighter.id) &&
                    ['light', 'heavy', 'barrage'].includes(bossStandPose(entry.fighter))) ||
                  (entry.fighter.standControl.mode === 'attached' &&
                    entry.fighter.attack === 'stand'),
                'attached-stand': entry.fighter.standControl.mode === 'attached',
                'stand-hurt': entry.fighter.standControl.stunMs > 0,
              }"
              :style="{
                '--stand-play':
                  props.paused || props.settings.reduceMotion || combatantFrozen(entry.fighter)
                    ? 'paused'
                    : 'running',
                left: `${
                  entry.fighter.standControl.mode === 'attached'
                    ? entry.fighter.id === 'kakyoin'
                      ? entry.fighter.x
                      : entry.fighter.x - entry.fighter.facing * 3
                    : displayStandX(entry.fighter)
                }%`,
                opacity:
                  entry.fighter.standControl.mode === 'attached'
                    ? 1
                    : standOpacity(
                        entry.fighter.standControl,
                        entry.fighter.x,
                        rangeRank(entry.fighter),
                      ),
              }"
              :data-testid="
                entry.fighter.standControl.mode === 'detached'
                  ? `stardust-stand-${entry.key}`
                  : `stardust-attached-stand-${entry.key}`
              "
              :data-distance-m="
                standDistance(entry.fighter.x, entry.fighter.standControl).toFixed(3)
              "
              :data-limit-m="STAND_LIMIT_METERS[rangeRank(entry.fighter)]"
              :data-world-x="entry.fighter.standControl.x"
              :data-display-x="displayStandX(entry.fighter)"
              :data-frozen="combatantFrozen(entry.fighter)"
              :data-stand-character="entry.fighter.id"
              :data-stand-pose="
                isBossStandOwner(entry.fighter.id) ? bossStandPose(entry.fighter) : undefined
              "
            >
              <div
                class="fighter-art separated-art"
                :style="{
                  ...standMotionStyle(entry.fighter),
                  '--stand-facing':
                    entry.fighter.standControl.mode === 'attached'
                      ? entry.fighter.facing
                      : entry.fighter.standControl.facing,
                  '--stand-flip':
                    entry.fighter.standControl.mode === 'attached'
                      ? entry.fighter.facing
                      : entry.fighter.standControl.facing,
                }"
                aria-hidden="true"
              ></div>
            </div>
          </template>
        </template>
        <div
          v-for="finger in fingerStrikes"
          :key="`finger-${finger.id}`"
          class="star-finger"
          :style="{
            left: `${fingerOrigin(finger.attacker)}%`,
            width: `${finger.length}%`,
            '--finger-facing': finger.facing,
            opacity: finger.length > 0 ? 1 : 0,
          }"
          data-testid="stardust-star-finger"
          :data-length="finger.length"
          aria-hidden="true"
        >
          <i></i><i></i><b></b>
        </div>
        <div
          v-for="ball in fireballs"
          :key="`fireball-${ball.id}`"
          class="avdol-fireball"
          :style="{ left: `${ball.x}%`, '--fireball-facing': ball.facing }"
          data-testid="stardust-fireball"
          :data-x="ball.x"
          aria-hidden="true"
        ></div>
        <div
          v-for="effect in hitEffects"
          :key="effect.id"
          class="combat-hit"
          :class="`combat-hit--${effect.type}`"
          :style="{
            left: `${effect.x}%`,
            top: effect.stand ? '48%' : '62%',
            '--hit-color': effect.color,
            animationPlayState: props.paused ? 'paused' : 'running',
          }"
          data-testid="stardust-hit-effect"
          aria-hidden="true"
        >
          <i v-for="index in 4" :key="index" :style="{ '--ray': index }"></i>
        </div>
        <div
          v-for="effect in hitEffects"
          :key="`damage-${effect.id}`"
          class="damage-feedback"
          :style="{
            left: `clamp(94px, ${effect.x}%, calc(100% - 94px))`,
            top: `${(effect.stand ? 25 : 43) + (effect.id % 3) * 9}%`,
            color: effect.color,
            animationPlayState: props.paused ? 'paused' : 'running',
          }"
          data-testid="stardust-damage-feedback"
        >
          <span class="damage-feedback-source">
            <span v-for="part in effect.label.split(' · ')" :key="part">{{ part }}</span>
          </span>
          <b>−{{ effect.damage }}</b>
        </div>
        <template v-for="entry in combatants" :key="`status-${entry.key}`">
          <div
            v-for="effect in entry.fighter.statusEffects"
            :key="`${effect.part}-${effect.kind}`"
            class="status-aura"
            :class="`status-aura--${effect.kind}`"
            :data-testid="`stardust-status-${entry.key}-${effect.kind}`"
            :style="{
              left: `${effect.part === 'stand' ? displayStandX(entry.fighter) : entry.fighter.x}%`,
              '--status-play':
                props.paused || combatantFrozen(entry.fighter) ? 'paused' : 'running',
            }"
            aria-hidden="true"
          >
            <i v-for="index in 5" :key="index" :style="{ '--particle': index }"></i>
          </div>
        </template>
        <BattleEffects
          :ultimates="ultimates"
          :projectiles="emeraldFlights"
          :fighters="combatants.map((entry) => entry.fighter)"
          :paused="props.paused || Boolean(stopped)"
          :reduce-motion="props.settings.reduceMotion"
        />
        <div class="ground" aria-hidden="true"></div>
      </div>

      <div class="controls">
        <section>
          <div>
            <b>P1</b
            ><span>{{
              p1?.standControl.mode === 'detached' ? '替身控制' : 'A/D移动 · W跳跃 · S下蹲 · L防御'
            }}</span>
          </div>
          <button :disabled="p1?.standControl.mode === 'detached'" @click="jump('p1')">
            <kbd>W</kbd>跳跃
          </button>
          <button @click="act('p1', 'light')">
            <kbd>J</kbd>{{ p1?.id === 'avdol' ? '火焰弹' : '轻拳' }}
          </button>
          <button @click="act('p1', 'heavy')"><kbd>K</kbd>重击</button>
          <button
            v-if="p1?.id === 'jotaro'"
            data-testid="stardust-finger-p1"
            :disabled="p1.standControl.mode === 'vanished'"
            @click="act('p1', 'finger')"
          >
            <kbd>O</kbd>流星指刺
          </button>
          <button @click="act('p1', 'stand')"><kbd>U</kbd>替身连打</button>
          <button
            data-testid="stardust-ultimate-p1"
            :disabled="isHero(p1?.id ?? '') ? !ultimateReady(p1) : (p1?.energy ?? 0) < 100"
            @click="act('p1', 'special')"
          >
            <kbd>I</kbd>{{ ultimateLabel(p1) }}
          </button>
          <button :disabled="p1?.id !== 'jotaro' && p1?.id !== 'dio'" @click="timeStop('p1')">
            <kbd>T</kbd>时停
          </button>
        </section>
        <section v-if="mode === 'versus' || coop">
          <div>
            <b>P2</b
            ><span>{{
              controlledTwo?.standControl.mode === 'detached'
                ? '替身控制'
                : '方向键移动 · ↑跳跃 · ↓下蹲 · 3防御'
            }}</span>
          </div>
          <button :disabled="controlledTwo?.standControl.mode === 'detached'" @click="jump('p2')">
            <kbd>↑</kbd>跳跃
          </button>
          <button @click="act('p2', 'light')">
            <kbd>1</kbd>{{ controlledTwo?.id === 'avdol' ? '火焰弹' : '轻拳' }}
          </button>
          <button @click="act('p2', 'heavy')"><kbd>2</kbd>重击</button>
          <button
            v-if="controlledTwo?.id === 'jotaro'"
            data-testid="stardust-finger-p2"
            :disabled="controlledTwo.standControl.mode === 'vanished'"
            @click="act('p2', 'finger')"
          >
            <kbd>0</kbd>流星指刺
          </button>
          <button @click="act('p2', 'stand')"><kbd>4</kbd>替身连打</button>
          <button
            data-testid="stardust-ultimate-p2"
            :disabled="
              isHero(controlledTwo?.id ?? '')
                ? !ultimateReady(controlledTwo)
                : (controlledTwo?.energy ?? 0) < 100
            "
            @click="act('p2', 'special')"
          >
            <kbd>6</kbd>{{ ultimateLabel(controlledTwo) }}
          </button>
          <button
            :disabled="controlledTwo?.id !== 'jotaro' && controlledTwo?.id !== 'dio'"
            @click="timeStop('p2')"
          >
            <kbd>5</kbd>时停
          </button>
        </section>
        <section v-else-if="story" class="partner-panel">
          <div>
            <b>AI伙伴</b><span>{{ selectedTwo.name }}</span>
          </div>
          <p>伙伴会自动接近敌人、释放替身技并参与救援；玩家专注操作主角。</p>
        </section>
        <section v-else-if="solo" class="partner-panel">
          <div>
            <b>纯单人远征</b><span>{{ selectedOne.name }}</span>
          </div>
          <p>敌人只锁定玩家；生命与能量会继承到下一名敌人。</p>
        </section>
        <section v-else-if="practice" class="partner-panel">
          <div>
            <b>练习木桩</b><span>{{ selectedTwo.name }}</span>
          </div>
          <p>木桩不会主动攻击，倒地后自动恢复；计时器保持暂停。</p>
        </section>
        <section v-else-if="challenge" class="partner-panel">
          <div>
            <b>挑战目标</b><span>{{ selectedTwo.name }}</span>
          </div>
          <p>敌人由电脑控制；击败一次增加一次解锁进度，累计三十次后可操作。</p>
        </section>
      </div>
      <div class="stand-controls">
        <div
          v-for="entry in standControls"
          :key="entry.side"
          class="stand-control"
          role="group"
          :aria-label="`${entry.label}替身控制`"
        >
          <div class="stand-readout">
            <b>{{ entry.label }}</b>
            <span :data-testid="`stardust-range-${entry.side}`">{{
              standStatus(entry.fighter)
            }}</span>
            <meter
              min="0"
              :max="STAND_LIMIT_METERS[rangeRank(entry.fighter)]"
              :value="standDistance(entry.fighter.x, entry.fighter.standControl)"
              :aria-label="`${entry.label}替身离体距离`"
            ></meter>
          </div>
          <div class="stand-actions">
            <button
              class="move-button"
              :aria-label="`${entry.label}向左移动`"
              title="向左移动"
              @pointerdown.prevent="holdMovement(entry.side, -1, $event)"
              @pointerup="touchMovement[entry.side] = 0"
              @pointercancel="touchMovement[entry.side] = 0"
              @lostpointercapture="touchMovement[entry.side] = 0"
            >
              <ArrowLeft :size="20" />
            </button>
            <button
              class="detach-button"
              :data-testid="`stardust-detach-${entry.side}`"
              :disabled="
                !hasIndependentStand(entry.fighter.id) ||
                rangeRank(entry.fighter) === 'E' ||
                entry.fighter.down ||
                props.paused ||
                introStep !== 'done' ||
                combatantFrozen(entry.fighter)
              "
              :aria-pressed="entry.fighter.standControl.mode === 'detached'"
              :title="
                hasIndependentStand(entry.fighter.id)
                  ? `${entry.hotkey} · ${standLabel(entry.fighter)}`
                  : '该角色尚未接入独立替身素材'
              "
              @click="detachStand(entry.side)"
            >
              <Unplug :size="17" /><kbd>{{ entry.hotkey }}</kbd
              >{{ standLabel(entry.fighter) }}
            </button>
            <button
              class="move-button"
              :aria-label="`${entry.label}向右移动`"
              title="向右移动"
              @pointerdown.prevent="holdMovement(entry.side, 1, $event)"
              @pointerup="touchMovement[entry.side] = 0"
              @pointercancel="touchMovement[entry.side] = 0"
              @lostpointercapture="touchMovement[entry.side] = 0"
            >
              <ArrowRight :size="20" />
            </button>
          </div>
          <div class="stand-distance-actions">
            <button
              v-for="direction in [-1, 1] as const"
              :key="direction"
              :data-testid="`stardust-distance-${direction < 0 ? 'near' : 'far'}-${entry.side}`"
              :aria-label="`${entry.label}${direction < 0 ? '靠近本体' : '远离本体'}`"
              :title="`${direction < 0 ? '靠近' : '远离'}本体 ${STAND_DISTANCE_STEP_METERS} 米`"
              :disabled="
                entry.fighter.standControl.mode !== 'detached' ||
                props.paused ||
                entry.fighter.down ||
                entry.fighter.stun > 0 ||
                combatantFrozen(entry.fighter) ||
                casting(entry.fighter)
              "
              @click="changeStandDistance(entry.side, direction)"
            >
              <ArrowLeft v-if="direction < 0" :size="17" /><ArrowRight v-else :size="17" />
              <kbd>{{
                entry.side === 'p1' ? (direction < 0 ? 'Q' : 'E') : direction < 0 ? '8' : '9'
              }}</kbd>
              {{ direction < 0 ? '靠近本体' : '远离本体' }}
            </button>
          </div>
        </div>
      </div>
      <div class="audio-settings" role="group" aria-label="声音设置">
        <label>
          <input v-model="sfxEnabled" type="checkbox" />
          <span>打击音效</span>
        </label>
        <label>
          <input v-model="voiceEnabled" type="checkbox" />
          <span>角色语音</span>
        </label>
        <label>
          <input v-model="ambienceEnabled" type="checkbox" />
          <span>待机环境声</span>
        </label>
      </div>
    </section>
    <dialog ref="characterDialog" class="character-dialog" aria-labelledby="character-info-name">
      <h3 id="character-info-name">{{ previewCharacter.name }}</h3>
      <div
        class="character-preview"
        :style="artStyle(previewCharacter.id)"
        aria-hidden="true"
      ></div>
      <p>{{ previewCharacter.stand }} · {{ previewCharacter.role }}</p>
      <dl>
        <div v-for="(rank, label) in standProfileFor(previewCharacter.id)" :key="label">
          <dt>{{ label }}</dt>
          <dd>{{ rank }}</dd>
        </div>
      </dl>
      <p v-if="isEnemyId(previewCharacter.id)" data-testid="stardust-unlock-progress">
        击败进度 {{ previewKills }} / {{ ENEMY_UNLOCK_KILLS }} ·
        {{
          previewUnlocked
            ? '已解锁'
            : challenge && previewSlot === 'p2'
              ? '可作为挑战目标'
              : '未解锁'
        }}
      </p>
      <div class="character-dialog-actions">
        <button type="button" @click="closeCharacterInfo">取消</button>
        <button type="button" :disabled="!previewSelectable" @click="confirmCharacterSelection">
          {{ challenge && previewSlot === 'p2' ? '选择挑战目标' : '确认选择' }}
        </button>
      </div>
    </dialog>
  </main>
</template>

<style scoped>
.character-preview {
  width: 180px;
  height: 180px;
  margin: 12px auto;
  background-image: var(--fighter-art);
  background-size: var(--fighter-art-size);
  background-position: var(--fighter-art-position);
  background-repeat: no-repeat;
}
.roster .roster-art.enemy-roster-art {
  width: 48px;
  height: 48px;
  align-self: center;
  justify-self: center;
  background-size: var(--fighter-art-size);
  background-position: var(--fighter-art-position);
}
.roster .locked-character .roster-art {
  filter: grayscale(0.8);
  opacity: 0.7;
}
.roster .unlock-progress {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-top: 4px;
  color: #f0c74b;
  font-variant-numeric: tabular-nums;
}
.round-score {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 16px;
  color: #fff;
  background: #24212e;
}

.character-dialog {
  width: min(440px, calc(100vw - 32px));
  box-sizing: border-box;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  padding: 20px;
  border: 1px solid #b89c49;
  border-radius: 6px;
  color: #fff8db;
  background: #24212e;
}
.character-dialog::backdrop {
  background: rgb(8 8 14 / 70%);
}
.character-dialog h3 {
  margin: 0;
  font-size: 22px;
}
.character-dialog p {
  color: #c8c1d0;
}
.character-dialog dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}
.character-dialog dt {
  font-size: 11px;
}
.character-dialog dd {
  margin: 6px 0;
  font-size: 22px;
  color: #f0c74b;
}
.character-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.character-dialog-actions button {
  min-height: 40px;
  padding: 8px 16px;
  border: 1px solid #786b85;
  border-radius: 4px;
  color: #fff8db;
  background: #363041;
  cursor: pointer;
}
.character-dialog-actions button:last-child {
  background: #ead079;
  color: #221b2d;
}
.character-dialog-actions button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.status-aura {
  position: absolute;
  bottom: 17%;
  width: 110px;
  height: 170px;
  z-index: 5;
  transform: translateX(-50%);
  pointer-events: none;
}
.status-aura i {
  position: absolute;
  left: calc(var(--particle) * 18% - 5%);
  top: 25%;
  width: 4px;
  height: 16px;
  background: #ef5977;
  animation: status-bleed 900ms calc(var(--particle) * -140ms) infinite;
  animation-play-state: var(--status-play);
}
.status-aura--emerald i {
  width: 13px;
  height: 19px;
  left: 45%;
  top: 48%;
  background: #5dffc7;
  clip-path: polygon(50% 0, 100% 35%, 65% 100%, 0 65%);
  animation-name: status-emerald;
  animation-duration: 1600ms;
  filter: drop-shadow(0 0 4px #26ab8d);
}
.status-aura--emerald::after {
  content: '';
  position: absolute;
  left: 48%;
  top: 30%;
  width: 4px;
  height: 16px;
  background: #ef5977;
  animation: status-bleed 900ms infinite;
  animation-play-state: var(--status-play);
}
.status-aura--burn i {
  top: auto;
  bottom: 0;
  width: 24px;
  height: 65px;
  background: #ff8b38;
  clip-path: polygon(5% 100%, 0 55%, 25% 70%, 42% 0, 62% 44%, 77% 24%, 100% 75%, 85% 100%);
  animation-name: status-fire;
  animation-duration: 650ms;
}
@keyframes status-bleed {
  from {
    opacity: 0.85;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(70px);
  }
}
@keyframes status-emerald {
  from {
    transform: rotate(calc(var(--particle) * 72deg)) translateX(48px) rotate(0);
  }
  to {
    transform: rotate(calc(var(--particle) * 72deg + 360deg)) translateX(48px) rotate(-360deg);
  }
}
@keyframes status-fire {
  50% {
    opacity: 0.5;
    transform: scaleY(1.2);
    background: #ffd26c;
  }
}
.stand-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 12px;
  margin-top: 12px;
}
.stand-control {
  min-width: 0;
  padding-top: 8px;
  border-top: 1px solid #514c5a;
}
.stand-readout {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.stand-readout span {
  color: #ddd6df;
  font-variant-numeric: tabular-nums;
}
.stand-readout meter {
  width: 100%;
  height: 8px;
}
.stand-actions {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 44px;
  gap: 8px;
  margin-top: 8px;
}
.stand-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  color: #f9f4de;
  background: #322e3c;
  border: 1px solid #62596a;
  border-radius: 4px;
  cursor: pointer;
}
.stand-actions button:disabled {
  opacity: 0.45;
  cursor: default;
}
.stand-actions .move-button {
  touch-action: none;
}
.stand-actions .detach-button[aria-pressed='true'] {
  border-color: #63e6e2;
  background: #214541;
}
.stand-distance-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}
.stand-distance-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 6px;
  color: #f9f4de;
  border: 1px solid #62596a;
  border-radius: 4px;
  background: #322e3c;
  cursor: pointer;
  font-size: 12px;
}
.stand-distance-actions button:disabled {
  opacity: 0.4;
  cursor: default;
}
.fighter-art.separated-art {
  width: 150px;
  height: 200px;
  background-size: 400% 200%;
}
.fighter-art.boss-body-art {
  width: calc(var(--stand-art-width) * 4 / 3);
  height: calc(var(--stand-art-width) * 4 / 3);
}
.boss-stand.attached-stand {
  bottom: 24%;
}
.boss-stand[data-stand-pose='idle'] .fighter-art {
  animation: boss-stand-breathe 1800ms ease-in-out infinite;
  animation-play-state: var(--stand-play);
}
@keyframes boss-stand-breathe {
  50% {
    translate: 0 -3px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .boss-stand .fighter-art {
    animation: none !important;
  }
}
.detached-stand.stand-dio .fighter-art,
.detached-stand.stand-ice .fighter-art {
  width: calc(var(--stand-art-width) * 4 / 3);
  height: calc(var(--stand-art-width) * 4 / 3);
  clip-path: inset(2px);
}
.detached-stand.attached-stand.stand-dio .fighter-art {
  filter: drop-shadow(0 0 7px rgb(255 212 82 / 35%));
}
.detached-stand.attached-stand.stand-ice .fighter-art {
  filter: drop-shadow(0 0 7px rgb(188 135 255 / 35%));
}
.detached-stand.attached-stand {
  z-index: 2;
}
.detached-stand {
  position: absolute;
  bottom: 17%;
  z-index: 4;
  width: 100px;
  height: 210px;
  transform: translateX(-50%);
  pointer-events: none;
  transition: opacity 90ms linear;
}
.detached-stand::before,
.detached-stand::after {
  position: absolute;
  z-index: 3;
  left: 50%;
  top: 43%;
  width: 105px;
  height: 54px;
  content: '';
  opacity: 0;
  pointer-events: none;
  transform: translate(-10%, -50%) scaleX(var(--stand-facing, 1));
  transform-origin: left center;
}
.detached-stand .fighter-art {
  transform: translateX(-50%) scaleX(var(--stand-flip, var(--stand-facing, 1)));
}
.detached-stand.stand-kakyoin .fighter-art {
  width: calc(var(--stand-art-width) * 1.15);
  height: calc(var(--stand-art-width) * 1.15 * 4 / 3);
}
.detached-stand.attached-stand.stand-kakyoin {
  bottom: 15%;
  opacity: 0.9;
}
.detached-stand.attached-stand.stand-kakyoin .fighter-art {
  filter: drop-shadow(0 0 8px rgb(80 255 171 / 42%));
}
.detached-stand.striking .fighter-art {
  transform: translateX(calc(-50% + var(--stand-facing, 1) * 9px))
    scaleX(var(--stand-flip, var(--stand-facing, 1)));
  filter: drop-shadow(-8px 0 0 rgb(99 230 226 / 45%)) drop-shadow(-16px 0 0 rgb(255 245 170 / 20%));
}
.detached-stand.striking::before,
.detached-stand.striking::after {
  opacity: 1;
  animation: stand-attack-flash 150ms steps(2) infinite;
}
.detached-stand.stand-jotaro::before {
  background: repeating-linear-gradient(
    0deg,
    transparent 0 7px,
    #8f6cff 8px 13px,
    #ffe16b 14px 16px
  );
  filter: drop-shadow(0 0 7px #8f6cff);
  clip-path: polygon(0 35%, 82% 0, 100% 18%, 76% 45%, 100% 70%, 20% 100%);
}
.detached-stand.stand-kakyoin::before {
  border: 5px solid #43ff9b;
  border-left-width: 18px;
  border-radius: 50%;
  filter: drop-shadow(0 0 8px #43ff9b);
  transform: translate(-4%, -50%) rotate(-8deg) scaleX(var(--stand-facing, 1));
}
.detached-stand.stand-kakyoin::after {
  width: 92px;
  background: radial-gradient(circle, #e9ffad 0 13%, #39e782 15% 30%, transparent 33%) 0 0 / 28px
    28px;
  filter: drop-shadow(0 0 6px #39e782);
}
.detached-stand.stand-avdol::before {
  background:
    radial-gradient(circle at 22% 55%, #fff5a3 0 8%, #ff9b22 10% 24%, transparent 28%),
    radial-gradient(circle at 55% 40%, #fff5a3 0 9%, #ff4f1f 12% 30%, transparent 34%),
    radial-gradient(circle at 84% 58%, #ffe05e 0 8%, #ff4f1f 12% 31%, transparent 35%);
  filter: drop-shadow(0 0 9px #ff5c1f);
}
.detached-stand.stand-polnareff::before {
  height: 12px;
  background: linear-gradient(90deg, #fff 0 42%, #8edbff 58%, transparent);
  box-shadow:
    0 -17px 0 -3px #8edbff,
    0 17px 0 -3px #cdefff;
  filter: drop-shadow(0 0 7px #79cfff);
  clip-path: polygon(0 35%, 100% 0, 82% 50%, 100% 100%, 0 65%);
}
.detached-stand.stand-hurt .fighter-art {
  filter: brightness(1.8) sepia(0.4);
}
.stand-tether {
  position: absolute;
  bottom: 17%;
  z-index: 2;
  height: 1px;
  border-top: 1px dashed #63e6e2;
  pointer-events: none;
  opacity: 0.6;
}
.stand-tether--kakyoin {
  height: 7px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #2ca870, #78ffd0 45%, #17925f);
  box-shadow:
    0 0 5px #48ef9d,
    0 0 11px rgb(72 239 157 / 45%);
  opacity: 0.82;
  transform-origin: left center;
  animation: hierophant-tether-flow 560ms linear infinite;
}
.stand-tether--kakyoin::before,
.stand-tether--kakyoin::after,
.stand-tether--kakyoin i {
  position: absolute;
  left: 18%;
  width: 58%;
  height: 2px;
  border-radius: 999px;
  background: #6affbf;
  box-shadow: 0 0 4px #55f1a4;
  content: '';
  transform-origin: left center;
}
.stand-tether--kakyoin::before {
  top: -7px;
  transform: rotate(-4deg);
}
.stand-tether--kakyoin::after {
  top: 12px;
  transform: rotate(5deg);
}
.stand-tether--kakyoin i:nth-child(1) {
  top: -13px;
  left: 38%;
  width: 38%;
  transform: rotate(-8deg);
}
.stand-tether--kakyoin i:nth-child(2) {
  top: 18px;
  left: 48%;
  width: 34%;
  transform: rotate(9deg);
}
.star-finger {
  position: absolute;
  z-index: 6;
  bottom: calc(17% + 90px);
  height: 17px;
  pointer-events: none;
  transform: scaleX(var(--finger-facing));
  transform-origin: left center;
}
.star-finger i {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 7px;
  border: 1px solid #554385;
  border-radius: 3px 7px 7px 3px;
  background: #c0a2f4;
  box-shadow:
    inset 0 2px #ebddff,
    0 0 4px #ccb8ff;
}
.star-finger i:nth-child(2) {
  top: 9px;
  right: 3px;
}
.star-finger b {
  position: absolute;
  left: -8px;
  top: -5px;
  width: 20px;
  height: 27px;
  border: 2px solid #655196;
  border-radius: 5px;
  background: #a686d9;
}
@media (max-width: 760px) {
  .star-finger {
    bottom: calc(17% + 75px);
  }
}
.avdol-fireball {
  position: absolute;
  z-index: 7;
  top: 58%;
  width: 42px;
  height: 24px;
  pointer-events: none;
  border-radius: 70% 45% 45% 70%;
  background: #fff3a0;
  border: 4px solid #ff942f;
  box-shadow:
    -12px 0 0 -3px #ee4838,
    -24px 0 0 -7px #e9472c,
    0 0 12px #ffb52c;
  transform: translate(-50%, -50%) scaleX(var(--fireball-facing));
}
.damage-feedback {
  position: absolute;
  z-index: 19;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  width: max-content;
  max-width: 176px;
  padding: 3px 6px;
  border-radius: 4px;
  background: #17131eee;
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  transform: translateX(-50%);
  animation: damage-feedback-fade 1100ms ease-out both;
}
.damage-feedback b {
  font-size: 16px;
  color: #fff;
}
.damage-feedback-source {
  display: flex;
  flex-direction: column;
}
.damage-feedback-source > span {
  white-space: nowrap;
}
@keyframes damage-feedback-fade {
  0%,
  75% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
.combat-hit {
  position: absolute;
  z-index: 6;
  width: 80px;
  height: 80px;
  pointer-events: none;
  transform: translate(-50%, -50%);
  color: var(--hit-color);
  animation: hit-burst 240ms ease-out both;
}
.combat-hit i {
  position: absolute;
  inset: 34px 6px;
  background: currentColor;
  clip-path: polygon(0 50%, 35% 20%, 60% 40%, 100% 0, 80% 60%, 100% 100%, 40% 75%);
  transform: rotate(calc(var(--ray) * 48deg));
  filter: drop-shadow(0 0 3px currentColor);
}
.combat-hit b {
  position: absolute;
  left: 50%;
  top: -8px;
  color: #fff8d6;
  font-size: 17px;
  text-shadow: 1px 2px #231620;
}
.combat-hit--polnareff i {
  inset: 37px -14px;
  background: #ebf4ff;
}
.combat-hit--jotaro-final {
  z-index: 18;
  width: 220px;
  height: 220px;
  color: #fff2a4;
  border: 9px double #fff4b7;
  border-radius: 50%;
  box-shadow:
    0 0 30px #87ffe4,
    inset 0 0 25px #c5b4ff;
  animation-duration: 700ms;
}
.combat-hit--jotaro-final i {
  inset: 90px -40px;
  height: 16px;
}
.combat-hit--jotaro-final b {
  top: -30px;
  font-size: 32px;
}
.combat-hit--polnareff-final {
  z-index: 18;
  width: 200px;
  height: 130px;
  color: #ddf8ff;
  animation-duration: 600ms;
  filter: drop-shadow(0 0 12px #fff2ab);
}
.combat-hit--polnareff-final i {
  inset: 60px -60px;
  height: 7px;
  transform: rotate(calc(var(--ray) * 5deg - 12deg));
}
.combat-hit--avdol i {
  height: 22px;
  background: #ffb241;
  clip-path: polygon(0 90%, 35% 10%, 48% 55%, 70% 0, 100% 100%);
}
.combat-hit--kakyoin i {
  inset: 27px;
  background: #73ffd0;
  transform: rotate(calc(var(--ray) * 90deg)) translateX(22px);
  clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
}
.combat-hit--block i {
  inset: 8px;
  background: transparent;
  border: 2px solid currentColor;
  border-radius: 50%;
  clip-path: none;
  transform: scale(calc(0.5 + var(--ray) * 0.12));
}
@keyframes hit-burst {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(0.65);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -65%) scale(1.2);
  }
}
@keyframes stand-attack-flash {
  0% {
    transform: translate(-8%, -50%) scaleX(var(--stand-facing, 1)) scaleX(0.72);
  }
  100% {
    transform: translate(4%, -50%) scaleX(var(--stand-facing, 1)) scaleX(1.12);
  }
}
@keyframes hierophant-tether-flow {
  50% {
    filter: brightness(1.35);
    transform: scaleY(0.72);
  }
}
@media (max-width: 760px) {
  .roster .roster-art.enemy-roster-art {
    width: 40px;
    height: 40px;
  }
  .fighter-art.separated-art {
    width: 112.5px;
    height: 150px;
  }
  .detached-stand {
    height: 175px;
    width: 82px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .status-aura i,
  .status-aura--emerald::after {
    animation: none;
  }
  .combat-hit {
    animation: none;
  }
  .combatant.jumping .fighter-art,
  .combatant.hurt:not(.down) .fighter-art,
  .stand-tether--kakyoin {
    animation: none;
  }
}
.stardust {
  min-height: 720px;
  color: #fff9dd;
  background: #151322;
  font-family: Inter, 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}
button {
  font: inherit;
}
.select-screen {
  min-height: 720px;
  padding: clamp(22px, 4vw, 52px);
  background:
    linear-gradient(105deg, transparent 48%, rgb(255 213 77 / 12%) 48% 51%, transparent 51%),
    repeating-linear-gradient(165deg, transparent 0 23px, rgb(255 255 255 / 3%) 24px), #171522;
}
.select-screen > header span,
.battle-head > div > span,
.mission-card span {
  color: #f0c74b;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.select-screen h2 {
  margin: 6px 0 4px;
  font-size: clamp(32px, 5vw, 62px);
  line-height: 1;
}
.select-screen h2 strong {
  color: #f0c74b;
}
.select-screen header p {
  margin: 8px 0 24px;
  color: #b9b4c5;
}
.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-width: 760px;
}
.mode-tabs button {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  color: #f6f0dc;
  text-align: left;
  border: 1px solid #514d5d;
  border-radius: 6px;
  background: #252231;
  cursor: pointer;
}
.mode-tabs button[aria-pressed='true'] {
  border-color: #f0c74b;
  box-shadow: inset 5px 0 #f0c74b;
}
.mode-tabs span {
  color: #aaa4b4;
  font-size: 12px;
}
.enemy-route {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid #454150;
  background: #201d2a;
}
.enemy-route > span {
  color: #f0c74b;
  font-size: 11px;
  font-weight: 900;
}
.enemy-route ol {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 5px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.enemy-route li {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 6px;
  color: #f4eee0;
  font-size: 10px;
  border: 1px solid #3f3b49;
  background: #292633;
}
.enemy-route li small {
  color: #63e6e2;
  font-weight: 900;
}
.enemy-route li em {
  grid-column: 1 / -1;
  color: #9f99a8;
  font-size: 8px;
  font-style: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 28px;
}
.selection-grid.single {
  grid-template-columns: minmax(0, 1fr);
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}
.section-heading span {
  color: #f0c74b;
  font-weight: 900;
}
.section-heading h3 {
  margin: 0;
  font-size: 16px;
}
.roster {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.roster button {
  position: relative;
  display: grid;
  grid-template-columns: 48px 1fr;
  grid-template-rows: auto auto auto;
  min-height: 92px;
  padding: 9px;
  color: #fff;
  text-align: left;
  border: 1px solid #494654;
  border-radius: 6px;
  background: linear-gradient(120deg, var(--fighter), #282533 70%);
  cursor: pointer;
  overflow: hidden;
}
.roster button[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: inset 0 -4px var(--accent);
}
.roster .roster-art {
  grid-row: 1 / 4;
  margin-right: 8px;
  border: 1px solid rgb(255 255 255 / 25%);
  background-image: var(--fighter-art);
  background-position: center 18%;
  background-size: 118%;
  background-repeat: no-repeat;
  filter: saturate(1.08) contrast(1.04);
}
.roster span,
.roster small {
  color: #d5d0dc;
  font-size: 10px;
}
.roster b {
  font-size: 13px;
}
.mission-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 24px;
  padding: 18px 20px;
  border: 1px solid #4d4958;
  border-radius: 6px;
  background: #211f2c;
}
.mission-card div {
  display: grid;
  gap: 4px;
  max-width: 720px;
}
.mission-card p {
  margin: 0;
  color: #bcb6c5;
  font-size: 13px;
}
.start-button {
  min-width: 190px;
  padding: 15px 20px;
  color: #16131f;
  font-weight: 900;
  border: 0;
  border-radius: 5px;
  background: #f0c74b;
  cursor: pointer;
}
.start-button span {
  color: inherit;
  font-size: 18px;
}
.battle-screen {
  min-height: 720px;
  padding: 16px;
  background: #191625;
}
.battle-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 15px;
  min-height: 56px;
}
.battle-head > div:first-child {
  display: grid;
}
.clock {
  display: grid;
  place-items: center;
}
.clock b {
  font-size: 34px;
  line-height: 0.9;
}
.clock span,
.revives span {
  color: #9f99a8;
  font-size: 9px;
  font-weight: 900;
}
.revives {
  display: grid;
  justify-items: end;
}
.revives b {
  color: #f0c74b;
  font-size: 19px;
  letter-spacing: 2px;
}
.hud {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10%;
  margin: 10px 0;
}
.partner-hud {
  display: grid;
  grid-template-columns: auto auto minmax(120px, 240px) auto;
  align-items: center;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  margin: -4px 0 8px;
  padding: 5px 9px;
  border-left: 3px solid #63e6e2;
  background: #24212e;
}
.partner-hud > span,
.partner-hud small {
  color: #aaa4b4;
  font-size: 9px;
  font-weight: 900;
}
.partner-hud .health {
  width: min(28vw, 240px);
  margin: 0;
}
.fighter-hud > div:first-child {
  display: flex;
  justify-content: space-between;
}
.fighter-hud.enemy > div:first-child {
  flex-direction: row-reverse;
}
.fighter-hud span {
  color: #aaa4b4;
  font-size: 10px;
}
.health,
.energy {
  position: relative;
  height: 15px;
  margin-top: 5px;
  border: 2px solid #f7edce;
  background: #3a1b27;
  transform: skewX(-10deg);
  overflow: hidden;
}
.health i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #dd365b, #ffb34b);
  transition: width 120ms;
}
.enemy .health i {
  float: right;
}
.energy {
  height: 10px;
  border-width: 1px;
  background: #212239;
}
.energy i {
  display: block;
  height: 100%;
  background: #45cbd0;
  transition: width 120ms;
}
.energy span {
  position: absolute;
  inset: 0 4px;
  color: #fff;
  font-size: 7px;
  line-height: 9px;
}
.arena {
  --stand-art-width: 150px;
  position: relative;
  min-height: 400px;
  border: 2px solid #f0c74b;
  background: linear-gradient(#382d5b 0 50%, #e06f55 74%, #704133);
  overflow: hidden;
}
.sun {
  position: absolute;
  left: 63%;
  top: 14%;
  width: 120px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ffd25f;
  box-shadow: 0 0 30px #ff9259;
}
.city {
  position: absolute;
  inset: 45% 0 18%;
  display: flex;
  align-items: end;
  gap: 2%;
  opacity: 0.65;
}
.city i {
  flex: 1;
  height: calc(25px + var(--n, 1) * 3px);
  min-height: 50%;
  background: #282036;
  clip-path: polygon(0 12%, 30% 12%, 34% 0, 55% 0, 60% 28%, 100% 28%, 100% 100%, 0 100%);
}
.ground {
  position: absolute;
  inset: auto 0 0;
  height: 22%;
  background: repeating-linear-gradient(100deg, #543a36 0 45px, #65453e 46px 49px);
  border-top: 4px solid #211b29;
}
.speed-lines {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background: repeating-conic-gradient(
    from 90deg at 50% 55%,
    transparent 0deg 4deg,
    #fff 4.5deg 5deg
  );
}
.stand-intro {
  position: absolute;
  z-index: 8;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    repeating-linear-gradient(105deg, transparent 0 24px, rgb(255 255 255 / 5%) 25px),
    rgb(15 11 28 / 92%);
  overflow: hidden;
}
.stand-summon,
.stand-panel {
  position: relative;
  width: min(90%, 760px);
  height: min(92%, 360px);
}
.summon-character {
  position: absolute;
  z-index: 2;
  inset: -12% 38% -8% 2%;
  background-image: var(--fighter-art);
  background-position: var(--fighter-art-position, center bottom);
  background-size: var(--fighter-art-size, contain);
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 24px rgb(108 232 255 / 45%));
  animation: summon-character-in 560ms cubic-bezier(0.16, 0.75, 0.25, 1) both;
}
.summon-rings {
  position: absolute;
  left: 27%;
  top: 50%;
  width: 230px;
  aspect-ratio: 1;
  border: 3px solid #63e6e2;
  border-radius: 50%;
  box-shadow:
    0 0 0 28px rgb(99 230 226 / 13%),
    0 0 0 62px rgb(240 199 75 / 9%),
    0 0 38px #63e6e2;
  transform: translate(-50%, -50%);
  animation: summon-ring 700ms ease-out both;
}
.summon-copy {
  position: absolute;
  z-index: 3;
  right: 1%;
  top: 50%;
  display: grid;
  width: 45%;
  transform: translateY(-50%);
}
.summon-copy span,
.panel-copy > span,
.stand-ready span {
  color: #f0c74b;
  font-size: 11px;
  font-weight: 900;
}
.summon-copy strong {
  font-size: clamp(25px, 5vw, 48px);
  line-height: 1.05;
}
.summon-copy p {
  margin: 8px 0 0;
  color: #63e6e2;
  font-size: 20px;
  font-weight: 900;
}
.stand-panel {
  display: grid;
  grid-template-columns: minmax(190px, 0.85fr) minmax(280px, 1.15fr);
  border: 2px solid #f0c74b;
  background: linear-gradient(120deg, #262239, #181522 65%);
  box-shadow: 12px 12px 0 rgb(240 199 75 / 18%);
  animation: stand-panel-in 260ms ease-out both;
}
.panel-art {
  min-width: 0;
  background-image: var(--fighter-art);
  background-position: var(--fighter-art-position, center bottom);
  background-size: var(--fighter-art-size, contain);
  background-repeat: no-repeat;
  border-right: 1px solid rgb(240 199 75 / 38%);
}
.panel-copy {
  display: grid;
  align-content: center;
  gap: 7px;
  padding: clamp(18px, 4vw, 36px);
}
.panel-copy h3 {
  margin: 0;
  color: #fff5cf;
  font-size: clamp(30px, 6vw, 58px);
  line-height: 1;
}
.panel-copy p {
  margin: 0;
  color: #bdb6c7;
  font-size: 13px;
}
.panel-copy dl {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 5px;
  margin: 12px 0 0;
}
.panel-copy dl div {
  display: grid;
  place-items: center;
  min-width: 0;
  padding: 7px 2px;
  border: 1px solid #514b5f;
  background: #201d2c;
}
.panel-copy dt {
  color: #aaa4b4;
  font-size: 9px;
}
.panel-copy dd {
  margin: 2px 0 0;
  color: #f0c74b;
  font-size: 23px;
  font-weight: 1000;
}
.stand-ready {
  display: grid;
  place-items: center;
}
.stand-ready strong {
  color: #fff5cf;
  font-size: clamp(72px, 15vw, 150px);
  line-height: 0.9;
  text-shadow:
    7px 7px #7b2148,
    -3px -3px #1c1725;
  transform: rotate(-6deg);
  animation: ready-impact 500ms cubic-bezier(0.14, 0.8, 0.26, 1) both;
}
@keyframes summon-character-in {
  from {
    opacity: 0;
    transform: translateX(-70px) scale(0.82);
    filter: brightness(4) drop-shadow(0 0 40px #fff);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}
@keyframes summon-ring {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.2);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}
@keyframes stand-panel-in {
  from {
    opacity: 0;
    transform: translateX(80px) skewX(-4deg);
  }
  to {
    opacity: 1;
    transform: translateX(0) skewX(0);
  }
}
@keyframes ready-impact {
  from {
    opacity: 0;
    transform: rotate(-6deg) scale(2.4);
  }
  to {
    opacity: 1;
    transform: rotate(-6deg) scale(1);
  }
}
.impact {
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 32%;
  transform: translate(-50%, -50%) rotate(-7deg);
  color: #fff;
  font-size: clamp(38px, 8vw, 86px);
  font-weight: 1000;
  text-shadow:
    5px 5px #7b2148,
    -3px -3px #1c1725;
  pointer-events: none;
}
.combatant {
  position: absolute;
  z-index: 3;
  bottom: 16%;
  width: 100px;
  height: 210px;
  transform-origin: center bottom;
  transition:
    left 70ms linear,
    bottom 140ms ease,
    filter 120ms ease;
}
.combatant.partner {
  z-index: 4;
}
.combatant.partner .fighter-art {
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%)) drop-shadow(0 0 7px rgb(99 230 226 / 35%));
}
.combatant.fighter-kakyoin {
  width: 76px;
  height: 170px;
}
.combatant.fighter-kakyoin > .fighter-art {
  width: 175px;
  height: 175px;
}
.fighter-art {
  position: absolute;
  left: 50%;
  bottom: -6px;
  width: 250px;
  height: 250px;
  background-image: var(--fighter-motion);
  background-position: var(--frame-x) var(--frame-y);
  background-size: var(--motion-size, 400% 300%);
  background-repeat: no-repeat;
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%));
  transform-origin: center bottom;
  transform: translateX(-50%);
  transition:
    filter 90ms,
    transform 90ms;
  will-change: background-position, transform;
}
.combatant.attacking .fighter-art {
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%)) drop-shadow(14px 0 0 rgb(83 213 208 / 24%));
  transform: translateX(calc(-50% + 12px)) scale(1.035);
}
.combatant.guarding .fighter-art {
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%)) drop-shadow(0 0 10px #6de8ff);
}
.combatant.jumping .fighter-art {
  animation: fighter-jump 520ms cubic-bezier(0.28, 0.72, 0.34, 1) both;
}
.combatant.crouching .fighter-art {
  transform: translateX(-50%) translateY(7px);
}
.combatant.hurt:not(.down) .fighter-art {
  animation: fighter-hurt 150ms ease-out both;
  filter: brightness(1.28) saturate(0.72) drop-shadow(0 8px 5px rgb(11 8 20 / 55%));
}
.body {
  position: absolute;
  inset: 35px 18px 0;
  background: #263e70;
  clip-path: polygon(
    28% 0,
    74% 0,
    95% 28%,
    78% 60%,
    94% 100%,
    60% 100%,
    50% 70%,
    38% 100%,
    3% 100%,
    22% 59%,
    6% 28%
  );
}
.body i {
  position: absolute;
  left: 30%;
  top: -30px;
  width: 44%;
  aspect-ratio: 0.8;
  border-radius: 45% 45% 30% 30%;
  background: #d1a477;
  border: 4px solid #171522;
}
.body b,
.body span {
  position: absolute;
  top: 35%;
  width: 55%;
  height: 17px;
  background: #53d5d0;
  transform-origin: left center;
}
.body b {
  left: 45%;
  transform: rotate(-18deg);
}
.body span {
  right: 45%;
  transform: rotate(28deg);
}
.rival .body {
  background: #9e8730;
}
.rival .body b,
.rival .body span {
  background: #d6c6ed;
}
.stand-ghost {
  position: absolute;
  left: -24px;
  top: 0;
  display: grid;
  place-items: center;
  width: 94px;
  height: 160px;
  color: rgb(255 255 255 / 55%);
  font-size: 40px;
  font-weight: 900;
  border: 4px solid currentColor;
  opacity: 0;
  filter: drop-shadow(0 0 9px #53d5d0);
}
.combatant.attacking .stand-ghost {
  opacity: 0.7;
  animation: stand-punch 160ms steps(2) infinite;
}
.combatant.attacking .body b {
  transform: rotate(-4deg) scaleX(1.8);
}
.combatant.guarding .body {
  filter: drop-shadow(0 0 9px #6de8ff);
  transform: skewX(-8deg);
}
.combatant.down {
  transform: translateX(-50%) rotate(78deg) !important;
  bottom: 11%;
  filter: saturate(0.55) brightness(0.78);
}
.frozen .arena {
  filter: grayscale(0.82) contrast(1.2);
}
.frozen .speed-lines {
  opacity: 0.42;
}
@keyframes stand-punch {
  50% {
    transform: translateX(34px);
  }
}
@keyframes fighter-jump {
  0%,
  100% {
    transform: translateX(-50%) translateY(0);
  }
  46% {
    transform: translateX(-50%) translateY(-72px) rotate(-3deg);
  }
}
@keyframes fighter-hurt {
  0% {
    transform: translateX(-50%) translateX(0);
  }
  38% {
    transform: translateX(-50%) translateX(-13px) rotate(-4deg);
  }
  100% {
    transform: translateX(-50%) translateX(0);
  }
}
.controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.controls section {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  padding: 9px;
  border: 1px solid #454150;
  border-radius: 5px;
  background: #24212e;
}
.controls section > div {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
}
.controls section > div span,
.partner-panel p {
  color: #aaa4b4;
  font-size: 11px;
}
.controls button {
  min-height: 44px;
  padding: 5px;
  color: #eee8d8;
  border: 1px solid #514c5a;
  border-radius: 4px;
  background: #322e3c;
  cursor: pointer;
}
.controls button:hover {
  border-color: #f0c74b;
}
.controls button:disabled {
  opacity: 0.35;
}
kbd {
  display: block;
  color: #f0c74b;
  font-family: inherit;
  font-weight: 900;
}
.partner-panel {
  grid-template-columns: 1fr !important;
}
.partner-panel p {
  margin: 0;
}
.audio-settings {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.audio-settings label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  color: #c6c0cd;
  font-size: 11px;
  border: 1px solid #454150;
  background: #24212e;
  cursor: pointer;
}
.audio-settings input {
  accent-color: #f0c74b;
}
@media (max-width: 760px) {
  .stardust,
  .select-screen,
  .battle-screen {
    min-height: 760px;
  }
  .selection-grid {
    grid-template-columns: 1fr;
  }
  .roster {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .enemy-route ol {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .roster button {
    grid-template-columns: 1fr;
    grid-template-rows: 40px auto auto;
    min-height: 100px;
    padding: 5px;
    text-align: center;
  }
  .roster .roster-art {
    grid-row: auto;
    margin: 0;
  }
  .roster span,
  .roster small {
    display: none;
  }
  .mission-card {
    align-items: stretch;
    flex-direction: column;
  }
  .start-button {
    width: 100%;
  }
  .battle-head {
    grid-template-columns: 1fr auto;
  }
  .revives {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-items: start;
  }
  .arena {
    --stand-art-width: 112.5px;
    min-height: 330px;
  }
  .partner-hud {
    grid-template-columns: auto 1fr;
  }
  .partner-hud .health {
    grid-column: 1 / -1;
    width: min(70vw, 280px);
  }
  .partner-hud small {
    display: none;
  }
  .controls {
    grid-template-columns: 1fr;
  }
  .audio-settings {
    justify-content: stretch;
  }
  .audio-settings label {
    flex: 1;
    justify-content: center;
  }
  .combatant {
    height: 175px;
    width: 82px;
  }
  .fighter-art {
    width: 210px;
    height: 210px;
  }
  .stand-panel {
    grid-template-columns: 42% 58%;
  }
  .panel-copy {
    padding: 16px;
  }
  .panel-copy dl {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 460px) {
  .select-screen,
  .battle-screen {
    padding: 12px;
  }
  .mode-tabs {
    grid-template-columns: 1fr;
  }
  .select-screen h2 {
    font-size: 32px;
  }
  .roster {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .enemy-route ol {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .hud {
    gap: 4%;
  }
  .arena {
    min-height: 300px;
  }
  .controls section {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .audio-settings {
    display: grid;
    grid-template-columns: 1fr;
  }
  .fighter-art {
    width: 185px;
    height: 185px;
  }
  .stand-summon,
  .stand-panel {
    height: 90%;
  }
  .summon-character {
    inset: 2% 30% 26% 0;
  }
  .summon-copy {
    inset: auto 6% 7%;
    width: 88%;
    transform: none;
  }
  .stand-panel {
    grid-template-columns: 1fr;
    grid-template-rows: 50% 50%;
  }
  .panel-art {
    border-right: 0;
    border-bottom: 1px solid rgb(240 199 75 / 38%);
  }
  .panel-copy {
    align-content: start;
    gap: 4px;
    padding: 10px 14px;
  }
  .panel-copy h3 {
    font-size: 28px;
  }
  .panel-copy dl {
    margin-top: 3px;
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .panel-copy dl div {
    padding: 3px 1px;
  }
  .panel-copy dd {
    font-size: 17px;
  }
}
</style>
