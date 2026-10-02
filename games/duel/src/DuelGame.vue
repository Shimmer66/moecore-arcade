<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  triggerRef,
  watch,
} from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { DUEL_ART, DUEL_MEME_ART, DUEL_SORE_LOSER_ART } from '@moecore/assets/duel';
import { advance, createBattle, createTeamBattle, emptyInput, IDS, ROSTER } from './rules';
import { DEFAULT_TEAMS, cloneLineups, remaining, teamOutcome } from './teams';
import TeamSelect from './TeamSelect.vue';
import { isCrouched } from './stance';
import { GUARD_CAPACITY } from './defense';
import { NORMAL_STYLE } from './normal-styles';
import { clearMotionInput } from './motion-input';
import { CHARACTER_COMMANDS, CHARGE_FRAMES } from './character-commands';
import { FINISHERS, finisherName, commandTier, canFinisher, finisherPrice } from './finishers';
import { JUMP_LABEL } from './jump';
import { EX_STYLE, MAX_DURATION, QUICK_MAX_DURATION, canEX, canSuper } from './power';
import { isNewcomer } from './types';
import type {
  Battle,
  BattleEvent,
  Command,
  Difficulty,
  DummyMode,
  FighterId,
  GameMode,
  Input,
  Slot,
  UpgradeId,
  TeamLineups,
} from './rules';
import {
  campaignBattle,
  createCampaign,
  DIFFICULTIES,
  settleStage,
  STATION_NAMES,
  takeUpgrade,
  UPGRADES,
} from './modes';
import type { Campaign } from './modes';
import FighterSprite from './RasterFighter.vue';
import CombatEffect from './CombatEffect.vue';
import MemeProp from './MemeProp.vue';
import SignatureMeme from './SignatureMeme.vue';
import { replaySelection } from './preferences';
import { BattleArtLoader, battleArtUrls } from './art-loading';
import PracticeLessons from './PracticeLessons.vue';
import { lessonsFor, setupLesson, updateLesson } from './lessons';
import { isImpactEvent, soundCue, timerCue } from './feedback';
import { createHealthLagState, nextHealthLag } from './health-lag';
import { comboScalePercent } from './combo-feedback';
import { blockFrameAdvantage } from './frame-feedback';
import type { LessonId, LessonProgress } from './lessons';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const player = ref<FighterId>(props.attempt > 1 ? replaySelection.player : 'deepseek');
const opponent = ref<FighterId>(props.attempt > 1 ? replaySelection.opponent : 'gpt');
const mode = ref<GameMode>(props.attempt > 1 ? replaySelection.mode : 'quick');
const difficulty = ref<Difficulty>(props.attempt > 1 ? replaySelection.difficulty : 'normal');
const teamLineups = ref<TeamLineups>(
  cloneLineups(props.attempt > 1 ? replaySelection.teamLineups : DEFAULT_TEAMS),
);
const teamLocal = ref(props.attempt > 1 ? replaySelection.teamLocal : false);
const localVersus = computed(
  () => mode.value === 'versus' || (mode.value === 'team' && teamLocal.value),
);
const dummy = ref<DummyMode>('idle'),
  infiniteEnergy = ref(true);
const lessonId = ref<LessonId | null>(null);
const lessonProgress = ref<LessonProgress | null>(null);
const passedLessons = ref<LessonId[]>([]);
const lessonChoices = computed(() => lessonsFor(player.value));
const campaign = shallowRef<Campaign | null>(
  mode.value === 'arcade' ? createCampaign(player.value, difficulty.value, Date.now() >>> 0) : null,
);
const intermission = ref(false);
const modes: { id: GameMode; title: string; text: string }[] = [
  { id: 'quick', title: '快速对战', text: '三局两胜' },
  { id: 'arcade', title: '三站连战', text: '连胜加菜' },
  { id: 'practice', title: '练招房', text: '自由练习' },
  { id: 'versus', title: '双人对战', text: '同屏开打' },
  { id: 'team', title: '3v3车轮战', text: '三人接力' },
];
const failedArt = ref(new Set<string>());
const artLoader = new BattleArtLoader();
const artReady = ref(false);
const artProgress = ref({ loaded: 0, total: 0, failed: 0 });
function art(id: FighterId, kind: keyof typeof DUEL_ART.deepseek): string | undefined {
  if (isNewcomer(id)) return undefined;
  const url = DUEL_ART[id][kind];
  return failedArt.value.has(url) ? undefined : url;
}
function artFailed(id: FighterId, kind: keyof typeof DUEL_ART.deepseek) {
  if (isNewcomer(id)) return;
  failedArt.value = new Set([...failedArt.value, DUEL_ART[id][kind]]);
}
function memeArtFailed(url: string) {
  failedArt.value = new Set([...failedArt.value, url]);
}
function soreArt(id: FighterId) {
  if (isNewcomer(id)) return undefined;
  const url = DUEL_SORE_LOSER_ART[id];
  return failedArt.value.has(url) ? undefined : url;
}
let opponentChosen = props.attempt > 1;
function choosePlayer(id: FighterId) {
  player.value = id;
  if (!opponentChosen) {
    const choices = IDS.filter((candidate) => candidate !== id);
    opponent.value = choices[Math.floor(Math.random() * choices.length)]!;
  }
}
const choosing = ref(!(props.attempt > 1 && props.restartMode !== 'select'));
const battle = shallowRef(
  mode.value === 'team'
    ? createTeamBattle(teamLineups.value, Date.now() >>> 0, {
        difficulty: difficulty.value,
        localVersus: localVersus.value,
      })
    : campaign.value
      ? campaignBattle(campaign.value)
      : createBattle(player.value, opponent.value, Date.now() >>> 0, {
          difficulty: difficulty.value,
          practice: mode.value === 'practice',
          infiniteEnergy: mode.value === 'practice',
          localVersus: localVersus.value,
        }),
);
const activePlayer = computed(() =>
  choosing.value
    ? mode.value === 'team'
      ? teamLineups.value[0][0]
      : player.value
    : battle.value.fighters[0].id,
);
const artCharacters = computed<FighterId[]>(() => {
  if (mode.value === 'team') return teamLineups.value.flat();
  if (!choosing.value && campaign.value)
    return [campaign.value.player, ...campaign.value.opponents];
  return choosing.value ? [player.value, opponent.value] : battle.value.fighters.map((f) => f.id);
});
watch(
  () => [...new Set(artCharacters.value)].sort().join(','),
  async () => {
    artReady.value = false;
    if (
      await artLoader.warm(battleArtUrls(artCharacters.value), (loaded, total, failed) => {
        artProgress.value = { loaded, total, failed };
      })
    )
      artReady.value = true;
  },
  { immediate: true },
);
const teamTransition = computed(() => {
  const teams = battle.value.teams;
  if (!teams) return [];
  if (teamOutcome(teams) !== null) return ['三人车轮战结束，正在清点饭卡。'];
  return teams.map((team, slot) => {
    const current = team.members[team.active]!;
    const side = slot === 0 ? 'P1' : localVersus.value ? 'P2' : 'CPU';
    if (current.eliminated) {
      const next = team.members.find((member) => !member.eliminated)!;
      return `${side} · ${ROSTER[next.id].short}接棒，满血上场`;
    }
    return `${side} · ${ROSTER[current.id].short}留场，剩${current.hp}血＋回${team.recovery}血`;
  });
});
const stage = ref<HTMLElement>();
const help = ref(false);
const sound = ref(true),
  voice = ref(false),
  shake = ref(true),
  cutscene = ref(true);
const localVoice = shallowRef<SpeechSynthesisVoice>();
const effects = shallowRef<(BattleEvent & { life: number })[]>([]);
const reaction = shallowRef<{ id: FighterId; kind: 'good' | 'bad'; life: number } | null>(null);
const comboFlash = shallowRef({ hits: 0, damage: 0, limit: 350, last: 0, scale: 100, life: 0 });
const comboFlash2 = shallowRef({
  hits: 0,
  damage: 0,
  limit: 350,
  last: 0,
  scale: 100,
  life: 0,
});
const healthLag = shallowRef(createHealthLagState());
const blockFeedback = shallowRef({ slot: 0 as Slot, advantage: 0, life: 0 });
const memeMoment = shallowRef<{
  effect: NonNullable<BattleEvent['effect']>;
  target: Slot;
  age: number;
  originX: number;
  life: number;
} | null>(null);
const memeCard = computed(() => {
  const effect = memeMoment.value?.effect;
  if (effect !== 'cache-hit' && effect !== 'gpt-muffled' && effect !== 'gpt-rollback') return null;
  const url = DUEL_MEME_ART[effect];
  return {
    effect,
    url,
    image: failedArt.value.has(url) ? undefined : url,
    title: { 'cache-hit': '缓存命中', 'gpt-muffled': '已读已堵', 'gpt-rollback': '版本回滚' }[
      effect
    ],
  };
});
const losingFighter = computed(() =>
  mode.value === 'practice' || battle.value.roundWinner === null
    ? undefined
    : battle.value.fighters[battle.value.roundWinner === 0 ? 1 : 0],
);
function isBun(slot: Slot) {
  return (
    memeMoment.value?.effect === 'doubao-bun' &&
    memeMoment.value.target === slot &&
    battle.value.fighters[slot].action === 'down'
  );
}
function returningParcelDistance(slot: Slot): number | null {
  const fighter = battle.value.fighters[slot];
  const parcel = battle.value.projectiles.find(
    (projectile) => projectile.owner === slot && projectile.boomerang && projectile.returning,
  );
  return parcel ? Math.abs(parcel.x - fighter.x) : null;
}
let reactionAt = -1000;
const quip = ref('');
let quipLife = 0,
  lastVoiceAt = -1000;
const seenQuips = new Set<string>();
let audio: AudioContext | undefined;
let animation = 0,
  lastTime = 0,
  accumulator = 0,
  announced = false;
type Control = Command | 'left' | 'right' | 'guard' | 'crouch';
const sources = new Map<string, Control>();
let commands: Command[] = [];
let commandContexts: NonNullable<Input['contexts']> = {};
const pressedControls = shallowRef(new Set<Control>());
const sources2 = new Map<string, Control>();
let commands2: Command[] = [];
let contexts2: NonNullable<Input['contexts']> = {};
const pressed2 = shallowRef(new Set<Control>());
const secondKeyMap: Record<string, Control> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'jump',
  ArrowDown: 'crouch',
  Numpad1: 'light',
  Numpad2: 'heavy',
  Numpad3: 'guard',
  Numpad4: 'skill',
  Numpad5: 'throw',
  Numpad6: 'super',
  Numpad7: 'variant',
  Numpad8: 'burst',
  Numpad9: 'meme',
  Numpad0: 'dash',
  NumpadDecimal: 'kick',
  Period: 'kick',
  Comma: 'roll',
  NumpadDivide: 'roll',
  Slash: 'lightKick',
  NumpadMultiply: 'lightKick',
  BracketLeft: 'exSkill',
  Backslash: 'exVariant',
  BracketRight: 'max',
  NumpadAdd: 'exSkill',
  NumpadEnter: 'exVariant',
  NumpadSubtract: 'max',
  Quote: 'maxSuper',
  Equal: 'climax',
  Semicolon: 'blowback',
  Backspace: 'commandGrab',
  Digit1: 'light',
  Digit2: 'heavy',
  Digit3: 'guard',
  Digit4: 'skill',
  Digit5: 'throw',
  Digit6: 'super',
  Digit7: 'variant',
  Digit8: 'burst',
  Digit9: 'meme',
  Digit0: 'dash',
};
const keyMap: Record<string, Control> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'jump',
  ArrowUp: 'jump',
  Space: 'jump',
  KeyS: 'crouch',
  ArrowDown: 'crouch',
  KeyJ: 'light',
  KeyK: 'heavy',
  KeyL: 'guard',
  KeyU: 'skill',
  KeyV: 'variant',
  KeyP: 'burst',
  KeyO: 'throw',
  KeyI: 'super',
  KeyH: 'dash',
  KeyF: 'meme',
  KeyN: 'kick',
  KeyC: 'roll',
  KeyM: 'lightKick',
  KeyQ: 'exSkill',
  KeyZ: 'exVariant',
  KeyE: 'max',
  KeyR: 'maxSuper',
  KeyT: 'climax',
  KeyG: 'blowback',
  KeyY: 'commandGrab',
};
const controls: { action: Control; label: string; key: string; title: string }[] = [
  { action: 'light', label: '轻拳', key: 'J', title: '轻击' },
  { action: 'lightKick', label: '轻脚', key: 'M', title: '轻脚' },
  { action: 'heavy', label: '重拳', key: 'K', title: '重击' },
  { action: 'kick', label: '重脚', key: 'N', title: '腿法' },
  { action: 'guard', label: '挡', key: 'L', title: '防御' },
  { action: 'skill', label: '技', key: 'U', title: '特色技能' },
  { action: 'throw', label: '摔', key: 'O', title: '投技' },
  { action: 'super', label: '大招', key: 'I', title: '终结技' },
  { action: 'variant', label: '变', key: 'V', title: '变招' },
  { action: 'burst', label: '脱身', key: 'P', title: '脱身' },
  { action: 'dash', label: '冲', key: 'H', title: '冲刺' },
  { action: 'meme', label: '整活', key: 'F', title: '角色梗技能' },
  { action: 'roll', label: '溜', key: 'C', title: '紧急闪避' },
  { action: 'exSkill', label: 'EX技', key: 'Q', title: 'EX强化技能' },
  { action: 'exVariant', label: 'EX变', key: 'Z', title: 'EX强化变招' },
  { action: 'max', label: 'MAX', key: 'E', title: 'MAX爆气' },
];
const directions: { action: Control; label: string; title: string }[] = [
  { action: 'left', label: '←', title: '向左移动' },
  { action: 'jump', label: '跳 ↑', title: '跳跃' },
  { action: 'right', label: '→', title: '向右移动' },
  { action: 'crouch', label: '蹲 ↓', title: '蹲下' },
];
const advancedControls: typeof controls = [
  { action: 'maxSuper', label: '二阶大招', key: 'R', title: '二阶超必杀' },
  { action: 'climax', label: '终结技', key: 'T', title: '终结超必杀' },
  { action: 'blowback', label: '击飞 / 防反', key: 'G', title: '击飞与防御反击' },
  { action: 'commandGrab', label: '合同锁人', key: 'Y', title: '甲方指令投' },
];
const mobileAdvancedControls: typeof controls = [
  ...controls.filter((control) => ['exSkill', 'exVariant', 'max'].includes(control.action)),
  ...advancedControls,
];
const secondLabels: Record<Control, string> = {
  left: '←',
  right: '→',
  jump: '↑',
  crouch: '↓',
  light: '1',
  heavy: '2',
  guard: '3',
  skill: '4',
  throw: '5',
  super: '6',
  variant: '7',
  burst: '8',
  meme: '9',
  dash: '0',
  kick: '.',
  roll: ',',
  lightKick: '/',
  uppercut: '→↓↘＋拳',
  exSkill: '[',
  exVariant: '\\',
  max: ']',
  maxSuper: "'",
  climax: '=',
  blowback: ';',
  guardCounter: '挡住后＋;',
  commandGrab: '退格',
};
const signature = {
  deepseek: {
    name: '吃白饭的大肥鱼',
    tip: 'F 扒饭：吃完最多回40血、加20能量。没吃完就挨揍？饭洒了。隔7秒能再吃。',
  },
  gpt: {
    name: '稳稳接住你',
    tip: 'F 伸手接人：专接面前往下落的，接完摔掉120血。被接住赶紧按投技挣脱；隔7秒再接。',
  },
  doubao: {
    name: '唐包·答非所问',
    tip: 'F 放回旋泡：砸别人80血，砸自己50血。它回来时记得躲！隔7秒一发。',
  },
  client: {
    name: '还是第一版好',
    tip: 'F 近身抓人：摔135血，扔回身后。对方能按投技拆开；隔7秒一次。',
  },
  prompt_sage: {
    name: '你现在是一只慢鸡',
    tip: 'F 在前方放3秒符阵：碰到掉45血、减速40%持续1.5秒。能防住或跳过；隔7秒一次。',
  },
  unplug_uncle: {
    name: '拔网线，拳头聊',
    tip: 'F 前方断网波：命中掉25血，双方2.5秒不能放技能。拳脚、投技、脱身照常；能防住，隔7秒一次。',
  },
};
// Rules mutate the explicit battle. A new snapshot lets derived computed values observe each tick.
const self = computed(() => ({ ...battle.value.fighters[0] }));
function linkActionsFor(slot: Slot): Set<Control> {
  const b = battle.value,
    fighter = b.fighters[slot],
    foe = b.fighters[slot === 0 ? 1 : 0],
    ago = b.tick - fighter.contactTick,
    links = new Set<Control>();
  if (b.phase !== 'fight') return links;
  if (b.grab?.defender === slot) {
    if (!b.grab.command && b.grab.age < 8) links.add('throw');
    return links;
  }
  if (fighter.action === 'block') {
    if (fighter.energy >= 50) {
      links.add('roll');
      if (!fighter.burstUsed) links.add('burst');
    }
    if (fighter.energy >= 100) links.add('blowback');
    return links;
  }
  if (['hurt', 'launched'].includes(fighter.action) && fighter.energy >= 50 && !fighter.burstUsed) {
    links.add('burst');
    return links;
  }
  if (fighter.contactTick < 0 || ago >= 10) return links;
  const confirmed = fighter.contactHit;
  const skillReady =
      fighter.cooldown === 0 &&
      fighter.silenced === 0 &&
      !(
        ['doubao', 'prompt_sage'].includes(fighter.id) &&
        b.projectiles.some((projectile) => projectile.owner === slot && projectile.kind !== 'trap')
      ),
    variantReady = fighter.variantCooldown === 0 && fighter.energy >= 25 && fighter.silenced === 0,
    superReady = canSuper(fighter) && fighter.silenced === 0;
  const addSpecials = (allowSkill: boolean) => {
    if (allowSkill && skillReady) {
      links.add('skill');
      if (canEX(fighter)) links.add('exSkill');
    }
    if (variantReady) {
      links.add('variant');
      if (canEX(fighter)) links.add('exVariant');
    }
    if (superReady) links.add('super');
  };
  if (['light1', 'light2', 'low'].includes(fighter.action)) {
    if (fighter.action !== 'low') links.add('light');
    if (confirmed) {
      links.add('lightKick');
      links.add('heavy');
      links.add('kick');
      links.add('blowback');
      if (['light1', 'light2'].includes(fighter.action) && fighter.energy >= 15) links.add('dash');
    }
    addSpecials(!['deepseek', 'doubao'].includes(fighter.id));
    if (fighter.energy >= 200 && fighter.maxFrames === 0) links.add('max');
  } else if (['lightKick', 'crouchKick'].includes(fighter.action)) {
    if (confirmed) {
      links.add('heavy');
      links.add('kick');
      links.add('blowback');
    }
    addSpecials(true);
  } else if (fighter.action === 'closeHeavy') addSpecials(true);
  else if (fighter.action === 'air' && confirmed) {
    links.add('lightKick');
    links.add('heavy');
    links.add('kick');
  } else if (fighter.action === 'airLightKick' && confirmed) {
    links.add('heavy');
    links.add('kick');
  }
  if (
    confirmed &&
    ['upper', 'heavy', 'variant', 'counter'].includes(fighter.action) &&
    foe.action === 'launched'
  )
    links.add('jump');
  if (fighter.maxFrames > 0 && ['skill', 'variant', 'counter'].includes(fighter.action)) {
    if (fighter.action !== 'skill' && skillReady) links.add('exSkill');
    if (fighter.action !== 'variant' && variantReady) links.add('exVariant');
    if (superReady) links.add('super');
  }
  return links;
}
function throwTechFrames(slot: Slot) {
  const grab = battle.value.grab;
  return grab?.defender === slot && !grab.command && grab.age < 8 ? 8 - grab.age : 0;
}
function throwPrompt(slot: Slot) {
  const grab = battle.value.grab;
  if (grab?.defender !== slot) return '';
  if (grab.command) return '合同锁死 · 不可拆';
  const frames = throwTechFrames(slot);
  return frames > 0 ? `${slot === 0 ? 'O' : '5'} 拆投 · ${frames}` : '拆投窗口已过';
}
function grabPromptOffset(slot: Slot) {
  const fighter = battle.value.fighters[slot];
  if (fighter.x < 140) return 70;
  if (fighter.x > 820) return -70;
  return -fighter.facing * 58;
}
const linkActions = computed(() => linkActionsFor(0));
const linkActions2 = computed(() => linkActionsFor(1));
const comboHint = computed(() => {
  const f = self.value,
    ago = battle.value.tick - f.contactTick;
  if (battle.value.phase !== 'fight') return '';
  if (f.action === 'block')
    return f.energy >= 100
      ? '防守取消：G 防反 · C 滚开 · P 脱身'
      : f.energy >= 50
        ? '防守取消：C 滚开 · P 脱身'
        : '挡住了，等硬直结束再反击';
  if (['hurt', 'launched'].includes(f.action) && canBurst) return '被连击：P 清空上下文脱身';
  if (f.contactTick < 0 || ago >= 10) return '';
  if (!f.contactHit) {
    if (['light1', 'light2'].includes(f.action))
      return `对方挡住：J 续压 · ${['deepseek', 'doubao'].includes(f.id) ? 'V 变招' : 'U 角色技'}`;
    if (['low', 'lightKick', 'crouchKick', 'closeHeavy'].includes(f.action))
      return '对方挡住：U / V / I 取消，或停手等反击';
    return '';
  }
  if (['light1', 'light2'].includes(f.action))
    return `J 再来一拳 · M→K · ${['deepseek', 'doubao'].includes(f.id) ? 'V 变招' : 'U 角色技'} · H追击`;
  if (f.action === 'low')
    return `M/K/N · ${['deepseek', 'doubao'].includes(f.id) ? 'V 变招' : 'U 角色技'}`;
  if (['lightKick', 'crouchKick'].includes(f.action)) return 'K 近重拳 / N 重脚 · U / V / I 取消';
  if (f.action === 'closeHeavy') return 'U 角色技 · V 变招 · I 大招';
  if (['air', 'airLightKick'].includes(f.action)) return 'K / N 砸回地上';
  if (
    ['upper', 'heavy', 'variant', 'counter'].includes(f.action) &&
    battle.value.fighters[1].action === 'launched'
  )
    return '跳跃追击 → J → K';
  if (f.maxFrames > 0 && ['skill', 'variant', 'counter'].includes(f.action))
    return 'MAX取消：Q / Z 换招 · I 大招终结';
  if (f.id === 'gpt' && f.action === 'skill' && canSuper(f) && ago < 8)
    return '打中了！按 I 接大招';
  return '';
});
const running = computed(
  () =>
    artReady.value &&
    !props.paused &&
    !choosing.value &&
    !help.value &&
    !intermission.value &&
    battle.value.phase === 'fight',
);
function canInput(slot: Slot, action: Control): boolean {
  if (action === 'commandGrab' && battle.value.fighters[slot].id !== 'client') return false;
  if (running.value) return true;
  const b = battle.value,
    f = b.fighters[slot],
    tier = commandTier(action as Command);
  return (
    !props.paused &&
    !choosing.value &&
    !help.value &&
    !intermission.value &&
    (slot === 0 || localVersus.value) &&
    b.phase === 'cinematic' &&
    b.cinematicOwner === slot &&
    b.phaseFrames > 36 &&
    f.hp > 0 &&
    b.fighters[slot === 0 ? 1 : 0].hp > 0 &&
    tier !== null &&
    tier > f.superTier &&
    canFinisher(f, tier, true)
  );
}
function finisherCostLabel(action: Control, slot: Slot): string {
  if (action === 'commandGrab') return '近身 · 抓住后不可拆';
  const f = battle.value.fighters[slot],
    tier = commandTier(action as Command);
  if (tier === null) return f.action === 'block' ? '防反 · 1气' : '击飞 · 免费';
  const upgrade = f.action === 'super' && tier > f.superTier;
  const cost = finisherPrice(f, tier, upgrade);
  return `${upgrade ? '追加' : ''}${cost.energy / 100}气${cost.max ? '＋MAX' : ''}`;
}
function cinemaCast(command: Command) {
  const slot = battle.value.cinematicOwner;
  if (slot === null || !canInput(slot, command)) return;
  const source = `cinematic:${command}`;
  if (slot === 0) {
    down(source, command);
    sources.delete(source);
    pressedControls.value = new Set(sources.values());
  } else {
    downSecond(source, command);
    sources2.delete(source);
    pressed2.value = new Set(sources2.values());
  }
  void nextTick(() => stage.value?.focus({ preventScroll: true }));
}
const variantText = computed(() =>
  self.value.variantCooldown > 0 ? `${(self.value.variantCooldown / 60).toFixed(1)}s` : 'V · 25',
);
const canBurst = computed(
  () =>
    !self.value.burstUsed &&
    self.value.energy >= 50 &&
    ['hurt', 'block', 'launched'].includes(self.value.action),
);
const trainingGoals = computed(() => [
  { label: '打出三连', done: self.value.maxCombo >= 3 },
  { label: '投技命中', done: self.value.throws > 0 },
  { label: '变招命中', done: self.value.variantHits > 0 },
  { label: '大招命中', done: self.value.supers > 0 },
  { label: '识别一次搓招', done: self.value.motionCount > 0 },
  { label: 'EX强化', done: self.value.exUses > 0 },
  { label: 'MAX爆气', done: self.value.maxUses > 0 },
  { label: '升阶取消', done: self.value.advancedCancels > 0 },
  { label: '终结命中', done: self.value.climaxHits > 0 },
]);
const remainingUpgrades = computed(() =>
  (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => !campaign.value?.perks.includes(id)),
);
const hasBubble = computed(() => battle.value.projectiles.some((p) => p.owner === 0));
function offline(slot: Slot, action: string) {
  return (
    battle.value.fighters[slot].silenced > 0 &&
    ['skill', 'variant', 'exSkill', 'exVariant', 'super', 'maxSuper', 'climax', 'meme'].includes(
      action,
    ) &&
    !(
      battle.value.fighters[slot].action === 'super' &&
      (commandTier(action as Command) ?? 0) > battle.value.fighters[slot].superTier
    ) &&
    !(action === 'meme' && battle.value.rice?.holder === slot)
  );
}
const skillText = computed(() =>
  self.value.cooldown > 0
    ? `${(self.value.cooldown / 60).toFixed(1)}s`
    : hasBubble.value
      ? '在场'
      : '就绪',
);
const winnerText = computed(() => {
  const b = battle.value;
  if (b.teams) {
    const outcome = teamOutcome(b.teams);
    if (outcome === 'draw') return '六个人都躺了，谁去盛饭？';
    if (outcome) return `${outcome === 'win' ? '干饭队' : '抢饭队'}拿下整场！`;
    return b.roundWinner === null
      ? '这一桌都撤了，下一桌上！'
      : `${ROSTER[b.fighters[b.roundWinner].id].short}没吃饱，继续！`;
  }
  return battle.value.roundWinner === null
    ? '都别装了 · 平局'
    : localVersus.value
      ? `P${battle.value.roundWinner + 1} 拿下本回合！`
      : battle.value.roundWinner === 0
        ? '这回合赢了，饭钱你出！'
        : '嘴还硬，人先躺了。';
});
const timerSeconds = computed(() => Math.ceil(battle.value.timer / 60));
const timerDanger = computed(
  () =>
    mode.value !== 'practice' &&
    battle.value.phase === 'fight' &&
    timerSeconds.value > 0 &&
    timerSeconds.value <= 10,
);
const ultimate = computed(() =>
  battle.value.cinematicOwner === null
    ? undefined
    : battle.value.fighters[battle.value.cinematicOwner],
);
const miniCountdown = computed(() => Math.ceil(battle.value.phaseFrames / 60));
const ultimateProgress = computed(() =>
  Math.max(0, Math.min(1, (72 - battle.value.phaseFrames) / 72)),
);

function release() {
  if (battle.value.phase !== 'fight') comboFlash2.value.life = 0;
  sources2.clear();
  commands2 = [];
  contexts2 = {};
  pressed2.value = new Set();
  sources.clear();
  commands = [];
  commandContexts = {};
  pressedControls.value = new Set();
  battle.value.fighters.forEach((f) => {
    f.buffer = null;
    f.lastMove = 0;
    f.tapTick = -100;
    clearMotionInput(f);
  });
}
function updateChordDirections(
  action: Control,
  held: Set<Control>,
  queued: Command[],
  contexts: NonNullable<Input['contexts']>,
) {
  if (!['left', 'right', 'crouch'].includes(action)) return;
  for (const command of queued) {
    const context = contexts[command];
    if (!context) continue;
    if (action === 'crouch') context.crouch = true;
    else context.move = (Number(held.has('right')) - Number(held.has('left'))) as -1 | 0 | 1;
  }
}
function down(source: string, action: Control) {
  if (!canInput(0, action) || sources.has(source)) return;
  sources.set(source, action);
  pressedControls.value = new Set(sources.values());
  updateChordDirections(action, pressedControls.value, commands, commandContexts);
  if (
    [
      'light',
      'heavy',
      'skill',
      'variant',
      'burst',
      'super',
      'throw',
      'commandGrab',
      'jump',
      'dash',
      'meme',
      'kick',
      'roll',
      'lightKick',
      'exSkill',
      'exVariant',
      'max',
      'maxSuper',
      'climax',
      'blowback',
    ].includes(action)
  ) {
    commands.push(action as Command);
    commandContexts[action as Command] = {
      move: (Number(pressedControls.value.has('right')) -
        Number(pressedControls.value.has('left'))) as -1 | 0 | 1,
      crouch: pressedControls.value.has('crouch'),
    };
  }
  enableAudio();
}
function pointerDown(e: PointerEvent, action: Control) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  down(`pointer:${e.pointerId}`, action);
}
function pointerUp(e: PointerEvent) {
  sources.delete(`pointer:${e.pointerId}`);
  pressedControls.value = new Set(sources.values());
}
function moveDirectionPointer(e: PointerEvent) {
  const source = `pointer:${e.pointerId}`;
  if (!sources.has(source)) return;
  const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (e.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
  const y = (e.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
  const action: Control | undefined =
    Math.hypot(x, y) < 0.28
      ? undefined
      : Math.abs(x) > Math.abs(y)
        ? x < 0
          ? 'left'
          : 'right'
        : y < 0
          ? 'jump'
          : 'crouch';
  if (sources.get(source) === action) return;
  sources.delete(source);
  pressedControls.value = new Set(sources.values());
  if (action) down(source, action);
}
function controlKey(e: KeyboardEvent, action: Control, press: boolean) {
  if (!['Space', 'Enter'].includes(e.code)) return;
  e.preventDefault();
  const source = `button:${action}:${e.code}`;
  if (press && !e.repeat) down(source, action);
  else if (!press) {
    sources.delete(source);
    pressedControls.value = new Set(sources.values());
  }
}
function keyboard(e: KeyboardEvent) {
  if (
    (e.target as HTMLElement)?.closest('input,textarea,select,button,a,summary') ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  if (localVersus.value && secondKeyMap[e.code]) {
    e.preventDefault();
    if (!e.repeat) downSecond(`key:${e.code}`, secondKeyMap[e.code]!);
    return;
  }
  const action = keyMap[e.code];
  if (!action) return;
  e.preventDefault();
  if (!e.repeat) down(`key:${e.code}`, action);
}
function keyup(e: KeyboardEvent) {
  sources2.delete(`key:${e.code}`);
  pressed2.value = new Set(sources2.values());
  sources.delete(`key:${e.code}`);
  pressedControls.value = new Set(sources.values());
}
function readInput(): Input {
  const held = [...sources.values()];
  const move = (Number(held.includes('right')) - Number(held.includes('left'))) as -1 | 0 | 1;
  const input = {
    move,
    guard: held.includes('guard'),
    crouch: held.includes('crouch'),
    jumpHeld: held.includes('jump'),
    commands,
    contexts: commandContexts,
  };
  commands = [];
  commandContexts = {};
  return input;
}
function downSecond(source: string, action: Control) {
  if (!localVersus.value || !canInput(1, action) || sources2.has(source)) return;
  sources2.set(source, action);
  pressed2.value = new Set(sources2.values());
  updateChordDirections(action, pressed2.value, commands2, contexts2);
  if (!['left', 'right', 'guard', 'crouch'].includes(action)) {
    commands2.push(action as Command);
    contexts2[action as Command] = {
      move: (Number(pressed2.value.has('right')) - Number(pressed2.value.has('left'))) as
        -1 | 0 | 1,
      crouch: pressed2.value.has('crouch'),
    };
  }
  enableAudio();
}
function readSecond(): Input {
  const input: Input = {
    move: (Number(pressed2.value.has('right')) - Number(pressed2.value.has('left'))) as -1 | 0 | 1,
    guard: pressed2.value.has('guard'),
    crouch: pressed2.value.has('crouch'),
    jumpHeld: pressed2.value.has('jump'),
    commands: commands2,
    contexts: contexts2,
  };
  commands2 = [];
  contexts2 = {};
  return input;
}
function secondPointer(e: PointerEvent, action?: Control) {
  const key = `pointer:${e.pointerId}`;
  if (action) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    downSecond(key, action);
  } else {
    sources2.delete(key);
    pressed2.value = new Set(sources2.values());
  }
}
function moveSecondDirectionPointer(e: PointerEvent) {
  const source = `pointer:${e.pointerId}`;
  if (!sources2.has(source)) return;
  const bounds = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = (e.clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2);
  const y = (e.clientY - (bounds.top + bounds.height / 2)) / (bounds.height / 2);
  const action: Control | undefined =
    Math.hypot(x, y) < 0.28
      ? undefined
      : Math.abs(x) > Math.abs(y)
        ? x < 0
          ? 'left'
          : 'right'
        : y < 0
          ? 'jump'
          : 'crouch';
  if (sources2.get(source) === action) return;
  sources2.delete(source);
  pressed2.value = new Set(sources2.values());
  if (action) downSecond(source, action);
}
function enableAudio() {
  if (!sound.value) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch {
    /* optional sound */
  }
}
function beep(event: BattleEvent) {
  playTones(soundCue(event));
}
function playTones(layers: ReturnType<typeof soundCue>) {
  if (
    !sound.value ||
    props.paused ||
    !audio ||
    audio.state !== 'running' ||
    props.settings.masterVolume <= 0
  )
    return;
  for (const layer of layers) {
    const oscillator = audio.createOscillator(),
      gain = audio.createGain(),
      start = audio.currentTime + (layer.delay ?? 0),
      end = start + layer.duration;
    oscillator.type = layer.type;
    oscillator.frequency.setValueAtTime(layer.from, start);
    oscillator.frequency.exponentialRampToValueAtTime(layer.to, end);
    gain.gain.setValueAtTime(layer.gain * props.settings.masterVolume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}
function syncVoices() {
  if ('speechSynthesis' in window)
    localVoice.value = window.speechSynthesis
      .getVoices()
      .find((v) => v.localService && v.lang.startsWith('zh'));
}
function say(text: string) {
  if (!voice.value || !localVoice.value || battle.value.tick - lastVoiceAt < 480) return;
  lastVoiceAt = battle.value.tick;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = localVoice.value;
  utterance.volume = props.settings.masterVolume * 0.6;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
function react(events: BattleEvent[]) {
  for (const event of events) {
    if (event.effect && event.target !== undefined)
      memeMoment.value = {
        effect: event.effect,
        target: event.target,
        originX: event.x,
        age: 0,
        life: ['cache-hit', 'gpt-muffled', 'gpt-rollback'].includes(event.effect) ? 72 : 48,
      };
    if (
      [
        'hit',
        'block',
        'guard-break',
        'ex',
        'max',
        'cancel',
        'parry',
        'super',
        'throw',
        'variant',
        'burst',
        'launch',
        'chase',
        'jump',
        'land',
        'bubble-pop',
      ].includes(event.kind)
    ) {
      effects.value.push({ ...event, life: 20 });
      beep(event);
    }
    if (event.kind === 'round') beep(event);
    if (event.kind === 'block' && event.source !== undefined && event.move) {
      const attacker = battle.value.fighters[event.source];
      if (event.move !== 'bubble' && event.move !== 'return-bubble') {
        const advantage = blockFrameAdvantage(
          attacker.id,
          event.move,
          attacker.age,
          attacker.exActive,
          attacker.superTier,
        );
        if (advantage !== null) blockFeedback.value = { slot: attacker.slot, advantage, life: 75 };
      }
    }
    if (event.text && !seenQuips.has(event.text)) {
      seenQuips.add(event.text);
      quip.value = event.text;
      quipLife = 48;
      say(event.text);
    }
    if (event.kind === 'super') say(ROSTER[battle.value.fighters[event.actor].id].line);
    if (event.kind === 'hit' && event.actor === 1) {
      comboFlash.value = {
        hits: battle.value.fighters[1].combo,
        damage: battle.value.fighters[1].comboDamage,
        limit: battle.value.fighters[1].comboLimit,
        last: event.damage ?? 0,
        scale: comboScalePercent(battle.value.fighters[1].combo, event.move),
        life: 60,
      };
    }
    if (localVersus.value && event.kind === 'hit' && event.actor === 0)
      comboFlash2.value = {
        hits: battle.value.fighters[0].combo,
        damage: battle.value.fighters[0].comboDamage,
        limit: battle.value.fighters[0].comboLimit,
        last: event.damage ?? 0,
        scale: comboScalePercent(battle.value.fighters[0].combo, event.move),
        life: 60,
      };
    if (
      battle.value.tick - reactionAt >= 180 &&
      (event.kind === 'parry' ||
        event.kind === 'variant' ||
        (event.kind === 'hit' && event.actor === 0 && self.value.combo >= 2))
    ) {
      reactionAt = battle.value.tick;
      reaction.value = {
        id: battle.value.fighters[event.actor].id,
        kind: event.kind === 'hit' ? 'bad' : 'good',
        life: 45,
      };
    }
  }
  if (effects.value.length) effects.value = effects.value.filter((e) => --e.life > 0).slice(-10);
  if (quipLife > 0 && --quipLife === 0) quip.value = '';
  if (reaction.value && --reaction.value.life <= 0) reaction.value = null;
  if (comboFlash.value.life > 0) comboFlash.value.life--;
  if (comboFlash2.value.life > 0) comboFlash2.value.life--;
  if (blockFeedback.value.life > 0)
    blockFeedback.value = { ...blockFeedback.value, life: blockFeedback.value.life - 1 };
  if (memeMoment.value) {
    memeMoment.value.age++;
    if (--memeMoment.value.life <= 0) memeMoment.value = null;
  }
}
function updateHealthLag() {
  healthLag.value = nextHealthLag(
    healthLag.value,
    [battle.value.fighters[0].hp, battle.value.fighters[1].hp],
    props.settings.reduceMotion,
  );
}
function resetTransientHud() {
  healthLag.value = createHealthLagState([
    battle.value.fighters[0].hp,
    battle.value.fighters[1].hp,
  ]);
  blockFeedback.value = { slot: 0, advantage: 0, life: 0 };
  comboFlash.value.life = 0;
  comboFlash2.value.life = 0;
}
async function start() {
  lessonId.value = null;
  lessonProgress.value = null;
  passedLessons.value = [];
  memeMoment.value = null;
  replaySelection.player = player.value;
  replaySelection.opponent = opponent.value;
  replaySelection.mode = mode.value;
  replaySelection.difficulty = difficulty.value;
  replaySelection.teamLineups = cloneLineups(teamLineups.value);
  replaySelection.teamLocal = teamLocal.value;
  campaign.value =
    mode.value === 'arcade'
      ? createCampaign(player.value, difficulty.value, Date.now() >>> 0)
      : null;
  battle.value =
    mode.value === 'team'
      ? createTeamBattle(teamLineups.value, Date.now() >>> 0, {
          difficulty: difficulty.value,
          localVersus: localVersus.value,
        })
      : campaign.value
        ? campaignBattle(campaign.value)
        : createBattle(player.value, opponent.value, Date.now() >>> 0, {
            difficulty: difficulty.value,
            practice: mode.value === 'practice',
            dummy: dummy.value,
            infiniteEnergy: mode.value === 'practice' && infiniteEnergy.value,
            localVersus: localVersus.value,
          });
  intermission.value = false;
  reaction.value = null;
  reactionAt = -1000;
  resetTransientHud();
  choosing.value = false;
  announced = false;
  help.value = false;
  effects.value = [];
  quip.value = '';
  seenQuips.clear();
  release();
  enableAudio();
  await nextTick();
  stage.value?.focus({ preventScroll: true });
}
function chooseUpgrade(id: UpgradeId) {
  if (props.paused || !campaign.value || !takeUpgrade(campaign.value, id)) return;
  battle.value = campaignBattle(campaign.value);
  memeMoment.value = null;
  triggerRef(campaign);
  intermission.value = false;
  effects.value = [];
  reaction.value = null;
  resetTransientHud();
  quip.value = '';
  accumulator = 0;
  release();
  void nextTick(() => stage.value?.focus({ preventScroll: true }));
}
function resetPractice() {
  if (mode.value !== 'practice' || props.paused) return;
  const b = battle.value,
    f = b.fighters[0];
  const next = createBattle(player.value, opponent.value, b.brain.seed, {
    ...b.options,
    dummy: dummy.value,
    infiniteEnergy: infiniteEnergy.value,
  });
  next.phase = 'fight';
  next.phaseFrames = 0;
  next.elapsed = b.elapsed;
  Object.assign(next.fighters[0], {
    damage: f.damage,
    maxCombo: f.maxCombo,
    throws: f.throws,
    commandThrows: f.commandThrows,
    counters: f.counters,
    variants: f.variants,
    variantHits: f.variantHits,
    supers: f.supers,
    bursts: f.bursts,
    motionCount: f.motionCount,
    exUses: f.exUses,
    maxUses: f.maxUses,
    advancedCancels: f.advancedCancels,
    climaxHits: f.climaxHits,
  });
  lessonProgress.value = lessonId.value
    ? setupLesson(
        next,
        lessonChoices.value.find((lesson) => lesson.id === lessonId.value)!,
      )
    : null;
  battle.value = next;
  memeMoment.value = null;
  effects.value = [];
  reaction.value = null;
  resetTransientHud();
  quip.value = '';
  accumulator = 0;
  release();
  void nextTick(() => stage.value?.focus({ preventScroll: true }));
}
function selectLesson(id: LessonId | null) {
  if (mode.value !== 'practice' || props.paused) return;
  lessonId.value = id;
  dummy.value = id ? lessonChoices.value.find((lesson) => lesson.id === id)!.dummy : 'idle';
  infiniteEnergy.value = id === null;
  resetPractice();
}
function endPractice() {
  if (mode.value !== 'practice' || announced || props.paused) return;
  announced = true;
  release();
  battle.value.phase = 'done';
  triggerRef(battle);
  emit('finish', {
    gameId: 'duel',
    sessionId: props.sessionId,
    outcome: 'completed',
    durationMs: Math.round((battle.value.elapsed * 1000) / 60),
    summary: `已完成 ${trainingGoals.value.filter((g) => g.done).length}/${trainingGoals.value.length} 项练习 · ${passedLessons.value.length}/4课程 · 最高 ${self.value.maxCombo} 连击`,
    story: {
      title: '木桩：你礼貌吗？',
      body: `${ROSTER[player.value].name}练完了。下一位受害者，请自觉上场。`,
    },
    stats: {
      maxCombo: self.value.maxCombo,
      throws: self.value.throws,
      variants: self.value.variantHits,
      supers: self.value.supers,
    },
    reselectLabel: '换角色',
  });
}
function finish() {
  if (announced || !battle.value.outcome) return;
  if (mode.value === 'arcade' && campaign.value) {
    settleStage(campaign.value, battle.value);
    triggerRef(campaign);
    if (campaign.value.phase === 'upgrade') {
      intermission.value = true;
      release();
      void nextTick(() =>
        document.querySelector<HTMLButtonElement>('.duel-upgrades button')?.focus(),
      );
      return;
    }
  }
  announced = true;
  release();
  const b = battle.value,
    f = b.fighters[0];
  const resultLoser =
    b.outcome === 'win' ? b.fighters[1].id : b.outcome === 'lose' ? b.fighters[0].id : undefined;
  if (b.teams) {
    const teams = b.teams;
    const mvp = [...teams[b.outcome === 'lose' ? 1 : 0].members].sort(
      (a, c) => c.damage - a.damage,
    )[0]!;
    const names = teams.map((t) => t.members.map((m) => ROSTER[m.id].short).join(' → '));
    emit('finish', {
      gameId: 'duel',
      sessionId: props.sessionId,
      outcome: b.outcome!,
      durationMs: Math.round((b.elapsed * 1000) / 60),
      summary: `3v3车轮战 · 剩余队员 ${remaining(teams[0])} : ${remaining(teams[1])} · 共${b.round}战`,
      story: {
        title:
          b.outcome === 'draw'
            ? '六个人都躺了，谁去盛饭？'
            : localVersus.value
              ? `${b.outcome === 'win' ? 'P1' : 'P2'}队伍获胜，全队开饭！`
              : b.outcome === 'win'
                ? '饭卡保住了，全队开饭！'
                : '这桌先撤，下一桌上！',
        body: `${localVersus.value ? 'P1' : '你'}：${names[0]}；${localVersus.value ? 'P2' : '电脑'}：${names[1]}。${ROSTER[mvp.id].short}打出${mvp.damage}伤害，拿下${mvp.wins}人。`,
        imageUrl: art(mvp.id, 'base') ?? '',
      },
      stats: {
        P1剩余人数: remaining(teams[0]),
        P2剩余人数: remaining(teams[1]),
        P1总伤害: b.fighters[0].damage,
        P2总伤害: b.fighters[1].damage,
        P1最高连击: b.fighters[0].maxCombo,
        P2最高连击: b.fighters[1].maxCombo,
        对战场数: b.round,
      },
      reselectLabel: '重新编队',
    });
    return;
  }
  emit('finish', {
    gameId: 'duel',
    sessionId: props.sessionId,
    outcome: b.outcome!,
    durationMs: Math.round(((campaign.value?.elapsed ?? b.elapsed) * 1000) / 60),
    summary:
      mode.value === 'versus'
        ? `P1 ${ROSTER[player.value].short} ${b.scores[0]} : ${b.scores[1]} P2 ${ROSTER[opponent.value].short}`
        : campaign.value
          ? `连战 ${campaign.value.wins}/3 站 · 总伤害 ${campaign.value.damage} · 最高 ${campaign.value.maxCombo} 连击`
          : `${b.scores[0]} : ${b.scores[1]} · 最高 ${f.maxCombo} 连击 · ${f.counters} 次反击 · ${f.throws} 次投技`,
    story: {
      title:
        mode.value === 'versus'
          ? b.outcome === 'draw'
            ? '双人平局 · 都别装了'
            : `${b.outcome === 'win' ? 'P1' : 'P2'} 获胜！`
          : b.outcome === 'win'
            ? {
                deepseek: '饭保住了，脸也保住了。',
                gpt: '稳稳接住，稳稳送走。',
                doubao: '我说包的，真包了！',
                client: '验收通过。钱下次一定。',
                prompt_sage: '提示词生效：你已倒下。',
                unplug_uncle: '网断了，人也老实了。',
              }[player.value]
            : b.outcome === 'draw'
              ? '都躺下了，谁去盛饭？'
              : {
                  deepseek: '饭没吃上，拳倒是管饱。',
                  gpt: '人没接住，地板接住了。',
                  doubao: '包是包了，包里是我。',
                  client: '不算，这只是需求评审。',
                  prompt_sage: '忽略刚才那顿打。',
                  unplug_uncle: '网能重启，腰不行。',
                }[player.value],
      body:
        (campaign.value
          ? campaign.value.phase === 'complete'
            ? '三场全赢，连自己都揍服了。开饭！'
            : `止步第 ${campaign.value.stage + 1} 站，加菜奖励会在下次连战重新选择。`
          : `${ROSTER[player.value].name} VS ${ROSTER[opponent.value].name} · ${Math.round(b.elapsed / 60)} 秒有效战斗`) +
        (resultLoser ? ` · ${ROSTER[resultLoser].short}把牌翻成了“战略性休息”。` : ''),
      imageUrl:
        b.outcome === 'lose'
          ? (soreArt(player.value) ?? art(player.value, 'bad') ?? '')
          : (art(player.value, b.outcome === 'win' ? 'base' : 'bad') ?? ''),
    },
    stats:
      mode.value === 'versus'
        ? {
            P1伤害: b.fighters[0].damage,
            P2伤害: b.fighters[1].damage,
            P1最高连击: b.fighters[0].maxCombo,
            P2最高连击: b.fighters[1].maxCombo,
          }
        : {
            rounds: b.round,
            maxCombo: campaign.value?.maxCombo ?? f.maxCombo,
            damage: campaign.value?.damage ?? f.damage,
            stations: campaign.value?.wins ?? 0,
            variants: f.variantHits,
            supers: f.supers,
            counters: f.counters,
            throws: f.throws,
          },
    reselectLabel: '换角色',
  });
}
function loop(time: number) {
  const delta = lastTime ? Math.min(100, time - lastTime) : 0;
  lastTime = time;
  if (
    artReady.value &&
    !props.paused &&
    !choosing.value &&
    !help.value &&
    !intermission.value &&
    battle.value.phase !== 'done'
  ) {
    accumulator += delta;
    let stepped = false;
    while (accumulator >= 1000 / 60) {
      stepped = true;
      accumulator -= 1000 / 60;
      const before: Battle['phase'] = battle.value.phase;
      const next = advance(
        battle.value,
        before === 'fight' || before === 'cinematic' ? readInput() : emptyInput(),
        localVersus.value
          ? before === 'fight' || before === 'cinematic'
            ? readSecond()
            : emptyInput()
          : undefined,
      );
      react(battle.value.events);
      updateHealthLag();
      if (mode.value === 'practice' && lessonProgress.value) {
        updateLesson(lessonProgress.value, battle.value);
        if (
          lessonProgress.value.status === 'complete' &&
          lessonId.value &&
          !passedLessons.value.includes(lessonId.value)
        )
          passedLessons.value = [...passedLessons.value, lessonId.value];
      }
      if (before !== next.phase) {
        release();
        blockFeedback.value = { slot: 0, advantage: 0, life: 0 };
        if (before === 'round-end') resetTransientHud();
        if (next.phase === 'countdown') memeMoment.value = null;
      }
      if (next.phase === 'done') {
        finish();
        break;
      }
    }
    if (stepped) triggerRef(battle);
  } else accumulator = 0;
  animation = requestAnimationFrame(loop);
}
watch(
  () => props.paused,
  (value) => {
    release();
    accumulator = 0;
    if (value) {
      void audio?.suspend().catch(() => {});
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } else {
      if (sound.value) void audio?.resume().catch(() => {});
      void nextTick(() => stage.value?.focus({ preventScroll: true }));
    }
  },
);
watch(help, (open) => {
  release();
  accumulator = 0;
  if (!open) void nextTick(() => stage.value?.focus({ preventScroll: true }));
});
watch(voice, (enabled) => {
  if (!enabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
});
watch(timerSeconds, (seconds, previous) => {
  if (timerDanger.value && seconds !== previous) playTones(timerCue(seconds));
});
watch([dummy, infiniteEnergy], () => {
  if (battle.value.options.practice) {
    release();
    battle.value.options.dummy = dummy.value;
    battle.value.options.infiniteEnergy = infiniteEnergy.value;
  }
});
onMounted(() => {
  animation = requestAnimationFrame(loop);
  window.addEventListener('keydown', keyboard);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', release);
  syncVoices();
  if ('speechSynthesis' in window)
    window.speechSynthesis.addEventListener('voiceschanged', syncVoices);
  if (!choosing.value) void nextTick(() => stage.value?.focus({ preventScroll: true }));
});
onUnmounted(() => {
  artLoader.dispose();
  cancelAnimationFrame(animation);
  release();
  window.removeEventListener('keydown', keyboard);
  window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', release);
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.removeEventListener('voiceschanged', syncVoices);
  }
  void audio?.close().catch(() => {});
});
</script>

<template>
  <section
    class="duel"
    :data-phase="choosing ? 'select' : battle.phase"
    :data-round="battle.round"
    :data-timer="battle.timer"
    :data-mode="mode"
    :data-local-versus="localVersus"
    :data-art-ready="artReady"
    :data-art-loaded="artProgress.loaded"
    :data-art-total="artProgress.total"
    :data-art-failed="artProgress.failed"
    :data-station="campaign?.stage ?? 0"
  >
    <div v-if="localVersus" class="duel-versus-guide">
      <strong>同机双人 · P1 / P2</strong>
      <span
        >P1：WASD 移动 · J/M 轻拳/轻脚 · K/N 重拳/重脚 · L 挡 · U 技 · I 大招 · O 摔 · V 变 · P 脱身
        · H 冲 · C 溜 · F 整活</span
      >
      <span
        >P2：方向键移动 · 数字 1/2/3 拳/重/挡 · 4 技 · 5 摔 · 6 大招 · 7 变 · 8 脱身 · 9 整活 · 0 冲
        · 句号 重脚 · / 轻脚 · 逗号 溜（小键盘 * 轻脚、/ 闪避）</span
      >
    </div>
    <div v-if="choosing" class="duel-select">
      <div class="duel-intro">
        <div>
          <span class="duel-kicker">大肥鱼的饭碗保卫战</span>
          <h2>战斗吧，<em>大肥鱼！</em></h2>
          <p>六人开打：单挑、练招，或者三人接力。</p>
        </div>
        <div class="duel-match-seal" aria-hidden="true">
          <span>先放饭碗</span><strong>VS</strong><span>再讲拳理</span>
        </div>
      </div>
      <div class="duel-mode-picker" role="group" aria-label="选择模式">
        <button
          v-for="item in modes"
          :key="item.id"
          type="button"
          :aria-pressed="mode === item.id"
          @click="mode = item.id"
        >
          <strong>{{ item.title }}</strong
          ><span>{{ item.text }}</span>
        </button>
      </div>
      <button
        class="duel-mobile-quick"
        type="button"
        :disabled="mode === 'team' && !artReady"
        @click="start"
      >
        <span>{{
          mode === 'team'
            ? '默认队伍开打'
            : mode === 'practice'
              ? '直接练招'
              : mode === 'arcade'
                ? '开始连战'
                : '快速开打'
        }}</span>
        <small v-if="mode !== 'team'"
          >{{ ROSTER[player].short }} VS
          {{ mode === 'arcade' ? '三站挑战' : ROSTER[opponent].short }}</small
        >
      </button>
      <TeamSelect v-if="mode === 'team'" v-model="teamLineups" v-model:local="teamLocal" />
      <template v-else>
        <div class="duel-section-label">
          <span>{{ mode === 'versus' ? '01 / P1 选择角色' : '01 / 选择你的角色' }}</span
          ><small>选个嘴硬的，上去碰一碰</small>
        </div>
        <div class="duel-roster" role="group" aria-label="选择角色">
          <button
            v-for="id in IDS"
            :key="id"
            type="button"
            :class="['duel-card', { selected: player === id }]"
            :style="{ '--fighter': ROSTER[id].color }"
            :aria-pressed="player === id"
            :aria-label="`选择${ROSTER[id].name}`"
            @click="choosePlayer(id)"
          >
            <span class="duel-card-number" aria-hidden="true">0{{ IDS.indexOf(id) + 1 }}</span>
            <span class="duel-role">{{ ROSTER[id].role }}</span>
            <img
              v-if="art(id, 'base')"
              class="duel-portrait"
              :src="art(id, 'base')"
              :alt="`${ROSTER[id].name}立绘`"
              @error="artFailed(id, 'base')"
            />
            <svg v-else viewBox="-115 -175 230 185" aria-hidden="true">
              <circle cx="0" cy="-58" r="68" fill="currentColor" opacity=".09" />
              <FighterSprite :id="id" />
            </svg>
            <strong>{{ ROSTER[id].name }}</strong
            ><span class="duel-card-tip">{{ ROSTER[id].tip }}</span
            ><span class="duel-picked">{{
              player === id ? '✓ 就你了，上！' : '就你了，去赢 ↗'
            }}</span>
          </button>
        </div>
        <details class="duel-loadout">
          <summary>{{ ROSTER[player].short }}招式</summary>
          <div>
            <strong>U · {{ ROSTER[player].skill }}</strong
            ><span>{{ ROSTER[player].keyTip }}</span>
            <strong>F · {{ signature[player].name }}</strong
            ><span>{{ signature[player].tip }}</span>
            <strong>V · {{ ROSTER[player].variant }}</strong
            ><span>{{ ROSTER[player].variantTip }} 消耗 25 能量。</span
            ><small>P · 脱身：花 50 能量打断连段，每回合一次。</small>
          </div>
        </details>
      </template>
      <div class="duel-launch">
        <span class="duel-setup-label">02 / 对局设置</span>
        <strong class="duel-matchup"
          >{{ mode === 'team' ? '干饭队' : ROSTER[player].short }} <i>VS</i>
          {{
            mode === 'team' ? '抢饭队' : mode === 'arcade' ? '三站挑战' : ROSTER[opponent].short
          }}</strong
        >
        <label v-if="mode !== 'arcade' && mode !== 'team'"
          >{{ mode === 'versus' ? 'P2 角色' : '对手' }}
          <select v-model="opponent" aria-label="选择对手" @change="opponentChosen = true">
            <option v-for="id in IDS" :key="id" :value="id">{{ ROSTER[id].name }}</option>
          </select></label
        >
        <label v-if="!localVersus"
          >难度
          <select v-model="difficulty" aria-label="选择难度">
            <option v-for="(level, id) in DIFFICULTIES" :key="id" :value="id">
              {{ level.label }}
            </option>
          </select></label
        >
        <span>{{
          mode === 'team'
            ? '三人接力 · 打光对方全队'
            : mode === 'versus'
              ? '同机双人'
              : mode === 'quick'
                ? '75 秒 · 三局两胜'
                : mode === 'arcade'
                  ? '三站连战 · 胜利后选强化'
                  : '不限时 · 随时结束'
        }}</span>
        <button
          class="duel-primary"
          type="button"
          :disabled="mode === 'team' && !artReady"
          @click="start"
        >
          {{
            mode === 'team'
              ? artReady
                ? '全队开打 →'
                : '队员热身中…'
              : mode === 'practice'
                ? '开始练招 →'
                : mode === 'arcade'
                  ? '开始连战 →'
                  : '开打 →'
          }}
        </button>
      </div>
    </div>
    <div
      v-else
      ref="stage"
      class="duel-arena"
      tabindex="0"
      aria-label="对战场地，方向键移动，空格二段跳，H 冲刺，C 紧急闪避，J 轻击，K 重击，L 防御，U 技能，O 投技，I 大招"
    >
      <div class="duel-hud">
        <div
          v-for="f in battle.fighters"
          :key="f.slot"
          v-memo="[
            f.id,
            f.hp,
            Math.floor(f.energy),
            f.energyCap,
            battle.phase,
            battle.teams && remaining(battle.teams[f.slot]),
            Math.ceil(f.maxFrames / 6),
            f.maxMode,
            Math.ceil(f.guardGauge),
            Math.ceil(healthLag.displayed[f.slot]),
            f.action === 'guardBreak',
            battle.scores[f.slot],
            failedArt,
            mode,
          ]"
          class="duel-health"
          :class="{ rival: f.slot === 1 }"
          :style="{
            '--fighter': ROSTER[f.id].color,
            '--stock-step': `${100 / (f.energyCap / 100)}%`,
          }"
        >
          <img
            v-if="art(f.id, 'good')"
            class="duel-hud-avatar"
            :src="art(f.id, 'good')"
            alt=""
            @error="artFailed(f.id, 'good')"
          />
          <svg
            v-else-if="isNewcomer(f.id)"
            class="duel-hud-avatar"
            viewBox="-100 -150 200 155"
            aria-hidden="true"
          >
            <FighterSprite :id="f.id" />
          </svg>
          <div class="duel-name">
            <strong>{{ ROSTER[f.id].short }}</strong
            ><span
              >{{ localVersus ? (f.slot ? 'P2' : 'P1') : f.slot ? 'CPU' : '你' }}
              <b v-if="battle.teams" class="lit">{{ remaining(battle.teams[f.slot]) }}/3 人</b>
              <template v-else
                ><b v-for="n in 2" :key="n" :class="{ lit: battle.scores[f.slot] >= n }"
                  >●</b
                ></template
              ></span
            >
          </div>
          <div
            class="duel-health-track"
            role="meter"
            :aria-label="`${ROSTER[f.id].name}生命`"
            :aria-valuenow="f.hp"
            :aria-valuemin="0"
            :aria-valuemax="1000"
          >
            <b
              class="duel-health-lag"
              :data-health-lag="Math.ceil(healthLag.displayed[f.slot])"
              :style="{ width: `${healthLag.displayed[f.slot] / 10}%` }"
            ></b>
            <i :style="{ width: `${f.hp / 10}%` }"></i>
          </div>
          <div
            class="duel-energy"
            role="meter"
            :aria-label="`${ROSTER[f.id].name}能量`"
            :aria-valuenow="Math.floor(f.energy)"
            :aria-valuemin="0"
            :aria-valuemax="f.energyCap"
          >
            <i :style="{ width: `${(f.energy / f.energyCap) * 100}%` }"></i
            ><span
              >{{ Math.floor(f.energy / 100) }} / {{ f.energyCap / 100 }} 气 ·
              {{ Math.floor(f.energy) }}</span
            ><small>{{ f.hp }} / 1000</small>
          </div>
          <div
            v-if="f.maxFrames > 0"
            class="duel-max-track"
            :class="{ quick: f.maxMode === 'quick' }"
          >
            <i
              :style="{
                width: `${(f.maxFrames / (f.maxMode === 'quick' ? QUICK_MAX_DURATION : MAX_DURATION)) * 100}%`,
              }"
            ></i>
            <span
              >{{ f.maxMode === 'quick' ? 'QUICK MAX' : 'MAX' }} ·
              {{ (f.maxFrames / 60).toFixed(1) }}s</span
            >
          </div>
          <div
            class="duel-guard-track"
            :class="{ danger: f.guardGauge < GUARD_CAPACITY[f.id] * 0.25 }"
            role="meter"
            :aria-label="`${ROSTER[f.id].name}防御`"
            :aria-valuenow="Math.ceil(f.guardGauge)"
            :aria-valuemin="0"
            :aria-valuemax="GUARD_CAPACITY[f.id]"
          >
            <i :style="{ width: `${(f.guardGauge / GUARD_CAPACITY[f.id]) * 100}%` }"></i>
            <span>{{
              f.action === 'guardBreak'
                ? '嘴硬失败！'
                : f.guardGauge < GUARD_CAPACITY[f.id] * 0.25
                  ? '嘴硬告急'
                  : '防御'
            }}</span>
          </div>
          <div
            v-if="battle.teams"
            class="duel-team-roster"
            :data-testid="`duel-team-${f.slot}`"
            :aria-label="`P${f.slot + 1}出场队列`"
          >
            <div
              v-for="(member, index) in battle.teams[f.slot].members"
              :key="index"
              :class="{
                active: index === battle.teams[f.slot].active && !member.eliminated,
                eliminated: member.eliminated,
              }"
              :data-character="member.id"
              :data-eliminated="member.eliminated"
              :title="`${ROSTER[member.id].name} · ${member.eliminated ? '已退场' : index === battle.teams[f.slot].active ? '正在战斗' : '等待接棒'}`"
            >
              <span>{{ member.eliminated ? '×' : index + 1 }}</span>
              <b>{{ member.id === 'deepseek' ? '肥鱼' : ROSTER[member.id].short }}</b>
            </div>
          </div>
        </div>
        <div
          class="duel-clock"
          :class="{
            danger: timerDanger,
            critical: timerDanger && timerSeconds <= 3,
            reduced: settings.reduceMotion,
          }"
          :data-timer-danger="timerDanger"
        >
          <strong>{{ mode === 'practice' ? '∞' : timerSeconds }}</strong
          ><span>{{
            timerDanger
              ? '最后关头'
              : mode === 'team'
                ? `第${battle.round}战`
                : mode === 'arcade'
                  ? `STAGE ${(campaign?.stage ?? 0) + 1}/3`
                  : mode === 'practice'
                    ? '练招房'
                    : `ROUND ${battle.round}`
          }}</span>
        </div>
      </div>
      <svg
        class="duel-world"
        viewBox="0 0 960 540"
        role="img"
        aria-label="服务器机房大舞台"
        :class="{
          impact:
            shake && !settings.reduceMotion && effects.some((e) => isImpactEvent(e) && e.life > 16),
        }"
      >
        <g v-once>
          <defs>
            <linearGradient id="duel-bg" x2="0" y2="1">
              <stop stop-color="#121b31" />
              <stop offset="1" stop-color="#2c3551" />
            </linearGradient>
            <linearGradient id="duel-floor" x2="0" y2="1">
              <stop stop-color="#35405b" />
              <stop offset="1" stop-color="#161d30" />
            </linearGradient>
            <radialGradient id="duel-glow">
              <stop stop-color="#86d5ff" stop-opacity=".2" />
              <stop offset="1" stop-color="#86d5ff" stop-opacity="0" />
            </radialGradient>
          </defs>
          <rect width="960" height="540" fill="url(#duel-bg)" />
          <ellipse cx="480" cy="240" rx="440" ry="260" fill="url(#duel-glow)" />
          <g opacity=".45">
            <path
              d="M60 0 300 450 M900 0 660 450"
              stroke="#9ab6f3"
              stroke-width="65"
              opacity=".05"
            />
            <g v-for="n in 8" :key="n" :transform="`translate(${n * 120 - 65},160)`">
              <rect width="65" height="236" rx="5" fill="#10192c" stroke="#445475" />
              <g v-for="r in 5" :key="r">
                <rect x="8" :y="r * 36 - 25" width="49" height="25" rx="3" fill="#273750" />
                <circle cx="48" :cy="r * 36 - 12" r="2" :fill="r % 2 ? '#82ecce' : '#ffb785'" />
              </g>
            </g>
          </g>
          <g transform="translate(480,184)">
            <rect
              x="-145"
              y="-31"
              width="290"
              height="78"
              rx="10"
              fill="#141e32"
              stroke="#516580"
            />
            <text
              text-anchor="middle"
              y="0"
              fill="#d0e6ff"
              font-size="24"
              font-weight="900"
              letter-spacing="6"
            >
              战斗吧，大肥鱼
            </text>
            <text text-anchor="middle" y="26" fill="#859cb7" font-size="11" letter-spacing="4">
              白饭我吃，拳头你挨。
            </text>
          </g>
          <path d="M0 404H960V450H0Z" fill="#172138" />
          <path d="M0 415H960" stroke="#647798" opacity=".4" />
          <g
            v-for="n in 12"
            :key="`audience-${n}`"
            :transform="`translate(${n * 78 - 32},424)`"
            opacity=".4"
          >
            <ellipse rx="19" ry="12" fill="#77b8eb" />
            <path d="M-16 3-25-5-23 8" fill="#77b8eb" />
            <circle cx="9" cy="-2" r="2" fill="#0f1a2b" />
          </g>
          <path d="M0 450H960V540H0Z" fill="url(#duel-floor)" />
          <path d="M0 450H960" stroke="#9ed6f5" stroke-width="3" />
          <g stroke="#6d80a3" opacity=".2">
            <path v-for="n in 13" :key="n" :d="`M${n * 80 - 80} 450 L${n * 100 - 190} 540`" />
            <path d="M0 478H960 M0 514H960" />
          </g>
        </g>
        <ellipse
          v-for="f in battle.fighters"
          :key="`shadow-${f.slot}`"
          :cx="f.x"
          cy="452"
          :rx="35 - Math.min(f.y / 12, 16)"
          ry="7"
          fill="#050b19"
          opacity=".4"
        />
        <g
          v-for="f in battle.fighters"
          :key="f.slot"
          :data-testid="`duel-fighter-${f.slot}`"
          :data-x="f.x.toFixed(1)"
          :data-y="f.y.toFixed(1)"
          :data-hp="f.hp"
          :data-energy="Math.floor(f.energy)"
          :data-energy-cap="f.energyCap"
          :data-charge="f.backCharge"
          :data-command-throws="f.commandThrows"
          :data-grab-kind="battle.grab?.command ? 'command' : battle.grab ? 'normal' : ''"
          :data-character="f.id"
          :data-team-index="battle.teams?.[f.slot].active"
          :data-max="f.maxFrames"
          :data-max-mode="f.maxMode ?? ''"
          :data-ex="f.exActive"
          :data-super-tier="f.superTier"
          :data-super-cancels="f.advancedCancels"
          :data-jump-kind="f.jumpKind"
          :data-guard="Math.ceil(f.guardGauge)"
          :data-motion="f.motionResult?.text ?? ''"
          :data-silenced="f.silenced"
          :data-slowed="f.slowed"
          :data-action="f.action"
          :data-crouched="isCrouched(f)"
          :data-jumps="f.jumps"
          :data-air-dash-used="f.airDashUsed"
          :data-combo="f.combo"
          :data-variant-hits="f.variantHits"
          :data-burst-used="f.burstUsed"
          :data-carrying-rice="battle.rice?.holder === f.slot"
          :transform="`translate(${f.x},${450 - f.y})`"
          :opacity="f.invulnerable && !settings.reduceMotion ? 0.6 : 1"
        >
          <text
            v-if="battle.grab?.command && battle.grab.attacker === f.slot"
            :x="grabPromptOffset(f.slot)"
            y="-180"
            text-anchor="middle"
            fill="#ffe39f"
            font-size="17"
            font-weight="900"
          >
            合同锁人！
          </text>
          <text
            v-if="battle.grab?.defender === f.slot"
            data-testid="throw-tech-prompt"
            :data-tech-frames="throwTechFrames(f.slot)"
            :x="grabPromptOffset(f.slot)"
            y="-165"
            text-anchor="middle"
            :fill="battle.grab.command ? '#ffae91' : '#fff0a8'"
            font-size="14"
            font-weight="900"
          >
            {{ throwPrompt(f.slot) }}
          </text>
          <g
            v-if="f.exActive || f.maxFrames > 0"
            class="duel-power-aura"
            :data-testid="`duel-power-${f.slot}`"
          >
            <ellipse
              cy="-70"
              rx="57"
              ry="87"
              fill="none"
              :stroke="f.exActive ? '#fff090' : f.maxMode === 'quick' ? '#86e7ff' : '#f9ac59'"
              stroke-width="4"
              opacity=".8"
            />
            <path
              d="M-48-14L-59-55-49-84 M48-12L60-56 49-95"
              fill="none"
              stroke="#ffe797"
              stroke-width="3"
            />
            <text y="-173" text-anchor="middle" fill="#fff3a4" font-size="16" font-weight="900">
              {{
                f.exActive
                  ? 'EX！加量不加价？要加！'
                  : f.maxMode === 'quick'
                    ? 'QUICK MAX'
                    : '算力全开！'
              }}
            </text>
          </g>
          <g v-if="f.action === 'dash' && !settings.reduceMotion" data-testid="dash-afterimages">
            <g
              v-for="n in 3"
              :key="n"
              :transform="`translate(${-f.dashDirection * n * 23},0)`"
              :opacity="0.25 - n * 0.055"
            >
              <FighterSprite
                :id="f.id"
                action="dash"
                :frame="battle.tick - n * 2"
                :facing="f.facing"
              />
            </g>
            <path
              d="M-80-35H-30 M-100-65H-45 M-75-98H-35"
              :transform="`scale(${f.dashDirection},1)`"
              :stroke="ROSTER[f.id].color"
              stroke-width="3"
            />
          </g>
          <g v-if="f.action === 'roll'" data-testid="roll-trail">
            <path
              d="M-105-18H-48 M-88-40H-45 M-115-5H-55"
              :transform="`scale(${f.dashDirection},1)`"
              :stroke="ROSTER[f.id].color"
              stroke-width="4"
              opacity=".65"
            />
            <text y="-105" text-anchor="middle" fill="#fff2a8" font-size="14" font-weight="900">
              先溜为敬
            </text>
          </g>
          <text
            v-if="f.action === 'guardBreak'"
            y="-166"
            text-anchor="middle"
            fill="#ffb08c"
            font-size="19"
            font-weight="900"
          >
            嘴硬失败！
          </text>
          <FighterSprite
            v-if="!isBun(f.slot)"
            :id="f.id"
            :action="
              battle.grab?.defender === f.slot &&
              battle.grab.paid &&
              (battle.fighters[battle.grab.attacker].id === 'gpt' || battle.grab.command)
                ? 'down'
                : f.action
            "
            :crouched="isCrouched(f)"
            :grounded="f.y === 0"
            :stun="
              battle.grab?.defender === f.slot &&
              battle.grab.paid &&
              (battle.fighters[battle.grab.attacker].id === 'gpt' || battle.grab.command)
                ? 36
                : f.stun
            "
            :vy="f.vy"
            :landing="f.landing"
            :enhanced="f.exActive"
            :super-tier="f.superTier"
            :roll-direction="f.dashDirection"
            :parcel-return-distance="returningParcelDistance(f.slot)"
            :command-grab-age="
              battle.grab?.command && battle.grab.attacker === f.slot ? battle.grab.age : null
            "
            :frame="battle.tick"
            :age="f.age"
            :facing="f.facing"
            :reduced="settings.reduceMotion"
          />
          <g
            v-else
            data-testid="doubao-bun"
            data-character="doubao"
            :transform="`translate(${settings.reduceMotion ? 0 : (memeMoment!.originX - f.x) * Math.max(0, 1 - memeMoment!.age / 18)},-27) rotate(${settings.reduceMotion ? 0 : Math.min(memeMoment!.age, 18) * 20 * -f.facing})`"
          >
            <ellipse rx="35" ry="26" fill="#ffe4b7" stroke="#71483c" stroke-width="3" />
            <path
              d="M-15-16Q0-38 15-16 M0-27V-13 M-8-23-5-12 M8-23 5-12"
              fill="none"
              stroke="#c38b61"
              stroke-width="2"
            />
            <circle cx="-10" cy="-1" r="6" fill="white" />
            <circle cx="10" cy="-1" r="6" fill="white" />
            <circle cx="-9" cy="-1" r="2.5" fill="#413132" />
            <circle cx="11" cy="-1" r="2.5" fill="#413132" />
            <ellipse cy="10" rx="4" ry="5" fill="#9a4b43" />
            <path
              d="M-29 14Q0 27 30 13L31 22Q0 34-29 22Z M24 21 52 18 49 30 27 27Z"
              fill="#d34545"
              stroke="#8c3037"
              stroke-width="2"
            />
          </g>
          <g
            v-if="f.id === 'unplug_uncle' && f.action === 'skill' && f.age >= 10 && f.age < 22"
            :transform="`scale(${f.facing},1)`"
            data-testid="uncle-cable"
          >
            <path d="M58-68 Q112-98 194-60" fill="none" stroke="#58bcff" stroke-width="5" />
          </g>
          <g
            v-if="f.id === 'unplug_uncle' && f.action === 'meme' && f.age >= 15 && f.age < 25"
            :transform="`scale(${f.facing},1)`"
            data-testid="disconnect-wave"
          >
            <path
              d="M42-105Q145-70 245-62M42-66Q145-34 245-28M42-25Q145 3 245 8"
              fill="none"
              stroke="#8fe4b0"
              stroke-width="5"
              stroke-dasharray="13 10"
            />
            <path d="M220-92 252-58M252-92 220-58" stroke="#ff9f82" stroke-width="7" />
          </g>
          <g
            v-if="f.silenced > 0"
            data-testid="offline-aura"
            transform="translate(0,-137)"
            fill="none"
          >
            <path
              d="M-28 0Q0-25 28 0M-18 10Q0-7 18 10M-6 20Q0 14 6 20"
              stroke="#ffd379"
              stroke-width="4"
              stroke-linecap="round"
            />
            <path d="M-30-17 30 29" stroke="#ff8f7d" stroke-width="6" />
          </g>
          <text
            v-if="f.silenced > 0"
            data-testid="offline-status"
            y="-180"
            text-anchor="middle"
            fill="#ffd379"
            font-size="13"
          >
            断网 {{ (f.silenced / 60).toFixed(1) }}s · 用拳脚！
          </text>
          <text
            v-else-if="f.slowed > 0"
            data-testid="slow-status"
            y="-180"
            text-anchor="middle"
            fill="#ffd379"
            font-size="13"
          >
            🐔 慢鸡 {{ (f.slowed / 60).toFixed(1) }}s
          </text>
          <SignatureMeme
            :fighter="{ ...f }"
            :carrying="battle.rice?.holder === f.slot"
            :rice-owner="battle.rice?.owner === f.slot"
            :effect="memeMoment?.target === f.slot ? memeMoment.effect : undefined"
            :age="memeMoment?.age"
            :reduced="settings.reduceMotion"
          />
          <text
            v-if="f.action === 'meme'"
            y="-160"
            text-anchor="middle"
            fill="#fff1b3"
            font-size="14"
            font-weight="bold"
          >
            {{ signature[f.id].name }}
          </text>
          <g v-if="f.id === 'deepseek' && f.action === 'skill'">
            <circle
              cy="-139"
              r="11"
              fill="none"
              stroke="#80caff"
              stroke-width="3"
              stroke-dasharray="16 8"
              :transform="`rotate(${settings.reduceMotion ? 0 : battle.tick * 12} 0 -139)`"
            />
            <text y="-160" text-anchor="middle" fill="#b8dfff" font-size="13">正在思考…</text>
          </g>
          <g
            v-if="
              f.id === 'deepseek' &&
              ((f.action === 'counter' && f.age >= 5 && f.age < 14) ||
                (f.action === 'variant' && f.age >= 12 && f.age < 20))
            "
            :transform="`translate(${f.facing * 52},-62)`"
          >
            <CombatEffect kind="whale_arc" :width="148" :height="128" :facing="f.facing" />
          </g>
          <text
            v-if="f.action === 'counter'"
            y="-145"
            text-anchor="middle"
            fill="#ffeaa0"
            font-size="17"
            font-weight="bold"
          >
            想完了！
          </text>
          <text
            v-if="f.id === 'gpt' && f.action.startsWith('light')"
            y="-143"
            text-anchor="middle"
            fill="#a7f3d4"
            font-size="17"
            font-weight="bold"
          >
            {{ f.action === 'light1' ? '首先' : f.action === 'light2' ? '其次' : '最后！' }}
          </text>
          <g v-if="f.action === 'counter'" :transform="`translate(${-f.facing * 40},-45)`">
            <path d="M-14 0H14L11 20H-11Z" fill="#e0efff" />
            <path
              d="M-16-3H16 M-5-10q-6-8 0-13 M6-10q-6-8 0-13"
              stroke="#d4efff"
              fill="none"
              stroke-width="3"
            />
            <text y="37" font-size="10" text-anchor="middle" fill="#c9e2ff">现场蒸馏</text>
          </g>
        </g>
        <g
          v-if="memeMoment?.effect === 'gpt-paper'"
          data-testid="meme-paper"
          :transform="`translate(${battle.fighters[memeMoment.target].x},${355 - battle.fighters[memeMoment.target].y})`"
        >
          <g
            v-for="n in 3"
            :key="n"
            :transform="`translate(${(battle.fighters[memeMoment.target].x > 480 ? -1 : 1) * (n * 23 + (settings.reduceMotion ? 15 : memeMoment.age * 2))},${-n * 13 - (settings.reduceMotion ? 0 : memeMoment.age)}) rotate(${settings.reduceMotion ? 0 : n * 11 - memeMoment.age})`"
          >
            <rect
              x="-22"
              y="-14"
              width="44"
              height="28"
              rx="3"
              fill="#e4fff0"
              stroke="#87c6ac"
              stroke-width="2"
            />
            <text text-anchor="middle" y="4" fill="#285341" font-size="10" font-weight="bold">
              {{ n === 1 ? '首先' : n === 2 ? '其次' : '省流：疼' }}
            </text>
          </g>
        </g>
        <g
          v-if="memeMoment?.effect === 'deepseek-bubbles'"
          data-testid="meme-bubbles"
          :transform="`translate(${battle.fighters[memeMoment.target].x},${315 - battle.fighters[memeMoment.target].y})`"
        >
          <circle
            v-for="n in 3"
            :key="n"
            :cx="(n - 2) * 22"
            :cy="-n * 9 - (settings.reduceMotion ? 0 : memeMoment.age * 0.8)"
            :r="6 + n * 3"
            fill="#b8edff"
            fill-opacity=".45"
            stroke="#88d9ff"
            stroke-width="2"
          />
          <text y="18" text-anchor="middle" fill="#d0f2ff" font-size="13" font-weight="bold">
            深度冒泡中…
          </text>
        </g>
        <MemeProp
          v-if="memeMoment"
          :effect="memeMoment.effect"
          :age="memeMoment.age"
          :x="battle.fighters[memeMoment.target].x"
          :y="battle.fighters[memeMoment.target].y"
          :origin-x="memeMoment.originX"
          :facing="battle.fighters[memeMoment.target].facing"
          :reduced="settings.reduceMotion"
        />
        <g
          v-for="f in battle.fighters.filter((f) => f.id === 'deepseek' && f.action === 'variant')"
          :key="`echo-${f.slot}`"
          :transform="`translate(${f.originX},450)`"
          opacity=".4"
        >
          <FighterSprite
            :id="f.id"
            action="counter"
            :age="Math.max(0, f.age - 7)"
            :facing="f.facing"
            :reduced="settings.reduceMotion"
          />
        </g>
        <g
          v-for="p in battle.projectiles"
          :key="p.id"
          data-testid="duel-projectile"
          :data-owner="p.owner"
          :data-x="p.x"
          :data-reflections="p.reflections ?? 0"
          :data-kind="p.kind ?? 'bubble'"
          :transform="`translate(${p.x},${450 - p.y})`"
        >
          <g v-if="p.kind" :data-testid="p.kind === 'trap' ? 'sage-trap' : 'sage-talisman'">
            <g
              v-if="p.kind === 'trap'"
              :transform="`translate(0,16) rotate(${settings.reduceMotion ? -12 : (180 - p.life) * 3})`"
            >
              <ellipse
                rx="48"
                ry="15"
                fill="#ffcb55"
                fill-opacity=".2"
                stroke="#ffd36f"
                stroke-width="3"
              />
              <ellipse
                rx="32"
                ry="10"
                fill="none"
                stroke="#fff0a8"
                stroke-width="2"
                stroke-dasharray="7 5"
              />
              <rect
                v-for="n in 8"
                :key="n"
                x="-5"
                y="-6"
                width="10"
                height="12"
                rx="2"
                fill="#1f5260"
                stroke="#ffe18b"
                :transform="`rotate(${n * 45}) translate(40,0) rotate(${-n * 45})`"
              />
              <path d="M-16 0H16M0-7V7M-11-5 11 5M-11 5 11-5" stroke="#ffe68f" stroke-width="2" />
            </g>
            <g :transform="p.kind === 'trap' ? 'rotate(-12)' : `rotate(${p.direction * 20})`">
              <rect
                x="-14"
                y="-25"
                width="28"
                height="45"
                rx="3"
                fill="#ffca55"
                stroke="#7b4425"
                stroke-width="2"
              />
              <path d="M-8-15H8 M-6-7H6 M0-12V8 M-8 3 8 10" stroke="#b64830" stroke-width="3" />
            </g>
            <text
              v-if="p.kind === 'trap'"
              y="-36"
              text-anchor="middle"
              fill="#ffe39a"
              font-size="12"
            >
              慢鸡符阵
            </text>
          </g>
          <CombatEffect v-else kind="bubble" :width="62" :height="62" :facing="p.direction" />
          <text v-if="p.boomerang" y="-38" text-anchor="middle" fill="#ffd7e6" font-size="12">
            {{ p.returning ? '↶ 原路返回' : '答非所问' }}
          </text>
          <text
            v-else-if="p.reflections"
            data-testid="return-parcel"
            y="-38"
            text-anchor="middle"
            fill="#fff0b7"
            font-size="12"
          >
            退回寄件人 ×{{ p.reflections }}
          </text>
        </g>
        <g
          v-for="e in effects"
          :key="e.id"
          :data-effect-kind="e.kind"
          :transform="`translate(${e.x},${450 - e.y})`"
          :opacity="e.life / 20"
        >
          <g v-if="['jump', 'chase', 'land'].includes(e.kind)" transform="translate(0,54)">
            <CombatEffect kind="landing_dust" :width="100" :height="50" />
          </g>
          <CombatEffect
            v-else-if="e.kind === 'bubble-pop'"
            kind="bubble_pop"
            :width="80"
            :height="80"
          />
          <CombatEffect
            v-else-if="
              ['block', 'guard-break', 'parry', 'burst', 'ex', 'max', 'cancel'].includes(e.kind)
            "
            kind="guard_spark"
            :width="['burst', 'max'].includes(e.kind) ? 150 : 86"
            :height="['burst', 'max'].includes(e.kind) ? 150 : 86"
            :facing="battle.fighters[e.actor].facing"
          />
          <CombatEffect
            v-else
            kind="hit_heavy"
            :width="e.kind === 'launch' || isImpactEvent(e) ? 115 : 88"
            :height="e.kind === 'launch' || isImpactEvent(e) ? 115 : 88"
          />
        </g>
        <text x="480" y="517" text-anchor="middle" fill="#8f9fba" font-size="12" letter-spacing="3">
          饭碗保卫战 · 挨打不包赔
        </text>
      </svg>
      <div
        v-if="comboFlash.life > 0 && comboFlash.hits >= 2 && battle.phase === 'fight'"
        class="duel-combo"
        :class="{ capped: comboFlash.damage >= comboFlash.limit * 0.8 }"
        :data-combo-damage="comboFlash.damage"
        :data-combo-limit="comboFlash.limit"
        aria-live="off"
      >
        <strong>{{ comboFlash.hits }} 连击</strong
        ><span>{{ comboFlash.damage }} 伤害 · 本段 {{ comboFlash.last }}</span
        ><small
          >第{{ comboFlash.hits }}段 {{ comboFlash.scale }}% · {{ comboFlash.damage }}/{{
            comboFlash.limit
          }}</small
        >
      </div>
      <div
        v-if="
          localVersus && comboFlash2.life > 0 && comboFlash2.hits >= 2 && battle.phase === 'fight'
        "
        class="duel-combo duel-combo-p2"
        :class="{ capped: comboFlash2.damage >= comboFlash2.limit * 0.8 }"
        :data-combo-damage="comboFlash2.damage"
        :data-combo-limit="comboFlash2.limit"
        aria-live="off"
      >
        <strong>P2 · {{ comboFlash2.hits }} 连击</strong
        ><span>{{ comboFlash2.damage }} 伤害 · 本段 {{ comboFlash2.last }}</span
        ><small
          >第{{ comboFlash2.hits }}段 {{ comboFlash2.scale }}% · {{ comboFlash2.damage }}/{{
            comboFlash2.limit
          }}</small
        >
      </div>
      <div
        v-if="mode === 'practice' && blockFeedback.life > 0 && battle.phase === 'fight'"
        class="duel-frame-feedback"
        :class="{ rival: blockFeedback.slot === 1, plus: blockFeedback.advantage >= 0 }"
        data-testid="block-frame-feedback"
        :data-advantage="blockFeedback.advantage"
        aria-live="off"
      >
        <strong
          >被挡 {{ blockFeedback.advantage > 0 ? '+' : '' }}{{ blockFeedback.advantage }}</strong
        ><span>{{
          blockFeedback.advantage > 0
            ? '你先动'
            : blockFeedback.advantage === 0
              ? '同时行动'
              : '对手先动'
        }}</span>
      </div>
      <div
        v-if="reaction && !memeCard && battle.phase === 'fight' && art(reaction.id, reaction.kind)"
        class="duel-reaction"
        aria-hidden="true"
      >
        <img
          :src="art(reaction.id, reaction.kind)"
          alt=""
          @error="artFailed(reaction!.id, reaction!.kind)"
        />
      </div>
      <aside
        v-if="memeCard && battle.phase === 'fight'"
        class="duel-meme-card"
        :class="{ 'on-left': memeMoment && battle.fighters[memeMoment.target].x > 480 }"
        :data-testid="`meme-card-${memeCard.effect}`"
        :aria-label="memeCard.title"
      >
        <img
          v-if="memeCard.image"
          :src="memeCard.image"
          :alt="memeCard.title"
          @error="memeArtFailed(memeCard.url)"
        />
        <strong>{{ memeCard.title }}</strong>
      </aside>
      <div v-if="quip && battle.phase === 'fight'" class="duel-quip">{{ quip }}</div>
      <div v-if="!artReady" class="duel-art-loading" role="status" aria-live="polite">
        <strong>拳脚热身中</strong>
        <progress
          :value="artProgress.loaded"
          :max="Math.max(1, artProgress.total)"
          aria-label="战斗素材加载"
        ></progress>
        <span>{{ artProgress.loaded }} / {{ artProgress.total }}</span>
        <small>准备好再计时，别让拳头等图片。</small>
      </div>
      <div v-else-if="battle.phase === 'countdown'" class="duel-center" role="status">
        <span>{{ battle.teams ? '接力第' + battle.round + '战' : 'ROUND ' + battle.round }}</span
        ><strong>{{ miniCountdown }}</strong>
        <p v-if="battle.teams">
          {{ ROSTER[battle.fighters[0].id].short }} VS {{ ROSTER[battle.fighters[1].id].short }}
        </p>
        <p v-else>饭先放下，马上开打。</p>
      </div>
      <div
        v-if="
          battle.phase === 'round-end' && battle.phaseFrames <= (battle.options.practice ? 48 : 108)
        "
        class="duel-center duel-round"
        :class="{
          'has-loser': !!losingFighter && !battle.teams,
          'duel-team-round': !!battle.teams,
          ko: battle.timer > 0 && battle.roundWinner !== null,
          draw: battle.timer > 0 && battle.roundWinner === null,
          timeout: battle.timer === 0,
          reduced: settings.reduceMotion,
        }"
        role="status"
      >
        <span data-testid="round-result-label">{{
          battle.timer === 0 ? '时间到' : battle.roundWinner === null ? 'DOUBLE K.O.' : 'K.O.'
        }}</span
        ><strong>{{ mode === 'practice' ? '木桩重置，再来！' : winnerText }}</strong>
        <template v-if="battle.teams">
          <p>剩余队员 {{ remaining(battle.teams[0]) }} : {{ remaining(battle.teams[1]) }}</p>
          <p v-for="line in teamTransition" :key="line" class="duel-team-transition">{{ line }}</p>
        </template>
        <p v-else-if="mode === 'practice'">1秒后恢复站位</p>
        <p v-else>{{ battle.scores[0] }} : {{ battle.scores[1] }}</p>
        <div
          v-if="losingFighter && !battle.teams"
          class="duel-round-vignette"
          data-testid="sore-loser"
          :data-loser="losingFighter.id"
        >
          <img
            v-if="soreArt(losingFighter.id)"
            :src="soreArt(losingFighter.id)"
            :alt="`${ROSTER[losingFighter.id].name}嘴硬结算`"
            @error="memeArtFailed(soreArt(losingFighter.id) ?? '')"
          />
          <svg
            v-else-if="isNewcomer(losingFighter.id)"
            width="150"
            height="130"
            viewBox="-115 -165 230 185"
            aria-hidden="true"
          >
            <FighterSprite :id="losingFighter.id" action="hurt" />
          </svg>
          <span class="duel-loser-placard" :class="{ flipped: battle.phaseFrames < 96 }">{{
            battle.phaseFrames < 96 ? '战略性休息' : '失败'
          }}</span>
        </div>
      </div>
      <div
        v-if="ultimate"
        class="duel-ultimate"
        :data-actor="ultimate.slot"
        :class="[{ simple: !cutscene || settings.reduceMotion }, `tier-${ultimate.superTier}`]"
        :style="{ '--fighter': ROSTER[ultimate.id].color }"
      >
        <span class="duel-kicker">{{
          ultimate.superTier === 3
            ? 'CLIMAX · 全村开席'
            : ultimate.superTier === 2
              ? 'MAX SUPER · 再加一菜'
              : 'SUPER · 大菜上桌'
        }}</span>
        <div v-if="cutscene && !settings.reduceMotion" class="duel-ultimate-art">
          <img
            v-if="art(ultimate.id, 'ultimate')"
            :src="art(ultimate.id, 'ultimate')"
            :alt="finisherName(ultimate.id, ultimate.superTier)"
            @error="artFailed(ultimate.id, 'ultimate')"
          />
          <svg v-else viewBox="-175 -155 350 195" aria-hidden="true">
            <g v-if="isNewcomer(ultimate.id)" :fill="ROSTER[ultimate.id].color" opacity=".28">
              <path
                v-for="n in 8"
                :key="n"
                :transform="`rotate(${n * 45} 0 -65)`"
                d="M30-70 170-80 170-50 30-60Z"
              />
            </g>
            <g v-if="ultimate.id === 'deepseek'">
              <path
                d="M-156-60Q-147-140-70-98Q-20-64 57-98Q102-145 145-116L118-74Q177-67 160-20Q110-28 100-46Q6 30-83-23Q-147-8-156-60Z"
                fill="#82caff"
                opacity=".12"
              />
              <g v-for="n in 8" :key="n" :transform="`translate(${n * 35 - 157},-144)`">
                <rect
                  width="22"
                  height="15"
                  rx="3"
                  :fill="n === 2 || n === 7 ? '#dcf69d' : '#2b4562'"
                />
                <text x="11" y="11" text-anchor="middle" fill="#122035" font-size="9">
                  {{ n === 2 || n === 7 ? '忙' : '闲' }}
                </text>
              </g>
            </g>
            <g v-if="ultimate.id === 'gpt'">
              <g
                v-for="n in 3"
                :key="n"
                :transform="`translate(${n * 87 - 225},${-114 + Math.sin(ultimateProgress * 12 + n) * 8}) rotate(${n * 12 - 24})`"
              >
                <rect width="74" height="93" rx="4" fill="#e0fff0" :opacity="0.5 + n * 0.15" />
                <rect x="8" y="9" width="58" height="16" rx="2" fill="#91e4bb" />
                <text x="37" y="21" text-anchor="middle" fill="#205740" font-size="10">
                  {{ n === 3 ? '最终版' : `第 ${n} 版` }}
                </text>
                <path
                  d="M10 38H61 M10 49H55 M10 60H61 M10 71H43"
                  stroke="#60a38b"
                  stroke-width="3"
                />
              </g>
            </g>
            <g
              v-if="ultimate.id === 'doubao' && ultimateProgress < 0.45"
              :transform="`translate(0,-128) scale(${1 - ultimateProgress})`"
            >
              <rect x="-156" y="-20" width="312" height="34" rx="17" fill="#fff0d9" />
              <text text-anchor="middle" y="2" fill="#8e4b31" font-size="12">
                我用最直白最不绕弯子的话告诉你……
              </text>
            </g>
            <FighterSprite
              v-if="ultimate.id !== 'doubao' || ultimateProgress < 0.45"
              :id="ultimate.id"
              action="super"
              :age="isNewcomer(ultimate.id) ? Math.floor(ultimateProgress * 48) : 16"
              :super-tier="ultimate.superTier"
            />
            <g
              v-if="ultimate.id === 'deepseek'"
              :transform="`translate(${-110 + ultimateProgress * 24},-12) scale(.65)`"
            >
              <FighterSprite id="deepseek" action="heavy" :age="16" />
              <path d="M48-46 89-107" stroke="#f4deb0" stroke-width="10" />
              <path
                d="m65-130 58 33-19 29-58-33Z"
                fill="#dcf69d"
                stroke="#243a52"
                stroke-width="4"
              />
            </g>
            <g
              v-if="ultimate.id === 'deepseek'"
              :transform="`translate(${110 - ultimateProgress * 24},-12) scale(-.65,.65)`"
            >
              <FighterSprite id="deepseek" action="heavy" :age="16" />
              <path d="M48-46 89-107" stroke="#f4deb0" stroke-width="10" />
              <path
                d="m65-130 58 33-19 29-58-33Z"
                fill="#dcf69d"
                stroke="#243a52"
                stroke-width="4"
              />
            </g>
            <g
              v-if="ultimate.id === 'doubao' && ultimateProgress >= 0.45"
              :transform="`translate(0,${-55 + Math.min(1, (ultimateProgress - 0.45) * 4) * 16}) scale(${0.7 + Math.min(1, ultimateProgress) * 0.5})`"
            >
              <path
                d="M-82 0Q-87-45-37-65L0-87 37-65Q87-45 82 0Q54 46 0 42Q-54 46-82 0Z"
                fill="#ffe1b1"
                stroke="#ab664b"
                stroke-width="5"
              />
              <path d="M0-83-14-57 M0-83 11-56 M0-83 28-63" stroke="#d79a6f" stroke-width="4" />
              <text y="18" text-anchor="middle" fill="#853f34" font-size="66" font-weight="900">
                揍
              </text>
            </g>
            <g
              v-if="ultimate.id === 'gpt' && ultimateProgress > 0.45"
              transform="translate(42,-32) rotate(-13)"
            >
              <rect
                x="-30"
                y="-25"
                width="137"
                height="48"
                rx="3"
                fill="#dfffaa"
                stroke="#153c34"
                stroke-width="4"
              />
              <text
                x="38"
                y="9"
                text-anchor="middle"
                fill="#174f3b"
                font-size="28"
                font-weight="900"
              >
                已发送
              </text>
            </g>
          </svg>
        </div>
        <h3>{{ finisherName(ultimate.id, ultimate.superTier) }}</h3>
        <p>
          {{ ultimate.superTier === 3 ? FINISHERS[ultimate.id].line : ROSTER[ultimate.id].line }}
        </p>
        <div
          v-if="
            ultimate.superTier < 3 &&
            battle.phaseFrames > 36 &&
            battle.fighters[ultimate.slot === 0 ? 1 : 0].hp > 0 &&
            (ultimate.slot === 0 || localVersus)
          "
          class="duel-super-links"
          aria-label="大招升级取消"
        >
          <button
            v-if="ultimate.superTier < 2"
            type="button"
            :disabled="!canInput(ultimate.slot, 'maxSuper')"
            @click="cinemaCast('maxSuper')"
          >
            升级二阶 · {{ finisherCostLabel('maxSuper', ultimate.slot) }}
          </button>
          <button
            type="button"
            :disabled="!canInput(ultimate.slot, 'climax')"
            @click="cinemaCast('climax')"
          >
            接终结技 · {{ finisherCostLabel('climax', ultimate.slot) }}
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="!choosing && mode === 'practice' && lessonProgress"
      class="duel-lesson-cue"
      aria-label="当前练招提示"
    >
      <strong>{{
        lessonProgress.status === 'complete'
          ? '通过！'
          : lessonProgress.status === 'failed'
            ? '再来一次'
            : lessonProgress.definition.steps[lessonProgress.step]?.key
      }}</strong>
      <span>{{ lessonProgress.hint }}</span>
      <button
        type="button"
        :disabled="paused || !artReady || battle.phase === 'done'"
        @click="resetPractice"
      >
        重试
      </button>
    </div>
    <div v-if="!choosing" class="duel-controls" aria-label="对战操作">
      <div
        class="duel-directions"
        :style="{
          '--stick-x': `${(Number(pressedControls.has('right')) - Number(pressedControls.has('left'))) * 27}px`,
          '--stick-y': `${(Number(pressedControls.has('crouch')) - Number(pressedControls.has('jump'))) * 27}px`,
        }"
        @pointermove.prevent="moveDirectionPointer"
      >
        <button
          v-for="c in directions"
          :key="c.action"
          type="button"
          :class="[
            `control-${c.action}`,
            { held: pressedControls.has(c.action), 'link-ready': linkActions.has(c.action) },
          ]"
          :aria-label="c.title"
          :disabled="!running"
          @pointerdown.prevent="pointerDown($event, c.action)"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @lostpointercapture="pointerUp"
          @keydown="controlKey($event, c.action, true)"
          @keyup="controlKey($event, c.action, false)"
        >
          {{ c.label }}
        </button>
      </div>
      <div class="duel-coach">
        <strong>{{ ROSTER[activePlayer].skill }}</strong
        ><span>{{ ROSTER[activePlayer].keyTip }}</span
        ><small :class="{ 'duel-link-ready': !!comboHint }" :data-combo-window="!!comboHint">{{
          comboHint || 'H 闪进 · 蹲＋重挑空 → 跳 → 打 → 重'
        }}</small>
      </div>
      <div class="duel-action-pad">
        <button
          v-for="c in controls"
          :key="c.action"
          type="button"
          :class="[
            `control-${c.action}`,
            {
              charged:
                (c.action === 'super' && canSuper(self)) ||
                (c.action === 'burst' && canBurst) ||
                (['exSkill', 'exVariant'].includes(c.action) && canEX(self)) ||
                (c.action === 'max' && self.energy >= 200 && self.maxFrames === 0),
              ready: c.action === 'variant' && self.variantCooldown === 0 && self.energy >= 25,
              held: pressedControls.has(c.action),
              'link-ready': linkActions.has(c.action),
            },
          ]"
          :aria-label="c.title"
          :disabled="!canInput(0, c.action) || offline(0, c.action)"
          :aria-description="
            offline(0, c.action)
              ? '断网中'
              : c.action === 'skill'
                ? skillText
                : c.action === 'dash'
                  ? '普通冲刺免费；轻击命中后取消收招消耗15能量'
                  : undefined
          "
          @pointerdown.prevent="pointerDown($event, c.action)"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @lostpointercapture="pointerUp"
          @keydown="controlKey($event, c.action, true)"
          @keyup="controlKey($event, c.action, false)"
        >
          <b>{{ c.label }}</b
          ><small>{{
            offline(0, c.action)
              ? '断网中'
              : c.action === 'skill'
                ? skillText
                : c.action === 'super'
                  ? self.maxFrames >= 240
                    ? 'MAX · 240'
                    : 'I · 1气'
                  : c.action === 'exSkill' || c.action === 'exVariant'
                    ? self.maxFrames > 0
                      ? `${c.key} · MAX`
                      : `${c.key} · 半气`
                    : c.action === 'max'
                      ? self.maxFrames > 0
                        ? '爆气中'
                        : 'E · 2气'
                      : c.action === 'variant'
                        ? variantText
                        : c.action === 'burst'
                          ? self.burstUsed
                            ? '本回合已用'
                            : 'P · 50'
                          : c.action === 'dash' &&
                              comboHint &&
                              ['light1', 'light2'].includes(self.action)
                            ? 'H · 15'
                            : c.action === 'meme' && battle.rice?.holder === 0
                              ? '开吃'
                              : c.action === 'roll' && self.action === 'block'
                                ? 'C · 50'
                                : c.action === 'meme' && self.memeCooldown > 0
                                  ? `${(self.memeCooldown / 60).toFixed(1)}s`
                                  : c.key
          }}</small>
        </button>
      </div>
    </div>
    <details v-if="!choosing" class="duel-mobile-more">
      <summary>更多招式</summary>
      <div>
        <button
          v-for="c in mobileAdvancedControls.filter(
            (c) => c.action !== 'commandGrab' || self.id === 'client',
          )"
          :key="c.action"
          type="button"
          :aria-label="c.title"
          :disabled="!canInput(0, c.action) || offline(0, c.action)"
          @pointerdown.prevent="pointerDown($event, c.action)"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @lostpointercapture="pointerUp"
        >
          <b>{{ c.label }}</b
          ><small>{{ c.key }}</small>
        </button>
      </div>
    </details>
    <details v-if="!choosing" class="duel-advanced-pad">
      <summary>
        进阶：R 二阶大招 · T 终结 · G 击飞 / 防反{{ self.id === 'client' ? ' · Y 合同锁人' : '' }}
      </summary>
      <div>
        <button
          v-for="c in advancedControls.filter(
            (c) => c.action !== 'commandGrab' || self.id === 'client',
          )"
          :key="c.action"
          type="button"
          :class="{ 'link-ready': linkActions.has(c.action) }"
          :aria-label="c.title"
          :disabled="!canInput(0, c.action) || offline(0, c.action)"
          @pointerdown.prevent="pointerDown($event, c.action)"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
          @lostpointercapture="pointerUp"
          @keydown="controlKey($event, c.action, true)"
          @keyup="controlKey($event, c.action, false)"
        >
          <b>{{ c.key }} · {{ c.label }}</b
          ><small>{{ finisherCostLabel(c.action, 0) }}</small>
        </button>
      </div>
    </details>
    <details v-if="!choosing && localVersus" class="duel-p2-pad" open>
      <summary>P2 触屏 / 鼠标操作区</summary>
      <div class="duel-p2-controls">
        <div
          class="duel-p2-directions"
          :style="{
            '--stick-x': `${(Number(pressed2.has('right')) - Number(pressed2.has('left'))) * 27}px`,
            '--stick-y': `${(Number(pressed2.has('crouch')) - Number(pressed2.has('jump'))) * 27}px`,
          }"
          @pointermove.prevent="moveSecondDirectionPointer"
        >
          <button
            v-for="c in directions"
            :key="c.action"
            type="button"
            :aria-label="`P2 ${c.title}`"
            :class="[`control-${c.action}`, { held: pressed2.has(c.action) }]"
            :disabled="!canInput(1, c.action) || offline(1, c.action)"
            @pointerdown.prevent="secondPointer($event, c.action)"
            @pointerup="secondPointer($event)"
            @pointercancel="secondPointer($event)"
            @lostpointercapture="secondPointer($event)"
          >
            <b>{{ c.label }}</b
            ><small>{{ secondLabels[c.action] }}</small>
          </button>
        </div>
        <div class="duel-p2-actions">
          <button
            v-for="c in [
              ...controls,
              ...advancedControls.filter(
                (c) => c.action !== 'commandGrab' || battle.fighters[1].id === 'client',
              ),
            ]"
            :key="c.action"
            type="button"
            :aria-label="`P2 ${c.title}`"
            :class="{
              held: pressed2.has(c.action),
              'link-ready': linkActions2.has(c.action),
            }"
            :disabled="!canInput(1, c.action) || offline(1, c.action)"
            @pointerdown.prevent="secondPointer($event, c.action)"
            @pointerup="secondPointer($event)"
            @pointercancel="secondPointer($event)"
            @lostpointercapture="secondPointer($event)"
            @keydown.enter.prevent="downSecond(`button:${c.action}`, c.action)"
            @keyup.enter="
              sources2.delete(`button:${c.action}`);
              pressed2 = new Set(sources2.values());
            "
            @keydown.space.prevent="downSecond(`button:${c.action}`, c.action)"
            @keyup.space="
              sources2.delete(`button:${c.action}`);
              pressed2 = new Set(sources2.values());
            "
          >
            <b>{{ c.label }}</b
            ><small>{{
              offline(1, c.action)
                ? '断网中'
                : c.action === 'meme' && battle.rice?.holder === 1
                  ? '开吃'
                  : secondLabels[c.action]
            }}</small>
          </button>
        </div>
      </div>
    </details>
    <div v-if="!choosing && mode === 'practice'" class="duel-practice-bar">
      <div class="duel-training-goals" aria-label="练招目标">
        <span v-for="goal in trainingGoals" :key="goal.label" :data-done="goal.done"
          >{{ goal.done ? '✓' : '○' }} {{ goal.label }}</span
        >
      </div>
      <div class="duel-practice-options">
        <label
          >木桩
          <select v-model="dummy" aria-label="木桩行为" :disabled="lessonId !== null">
            <option value="idle">站着挨打</option>
            <option value="guard">一直站防</option>
            <option value="crouch-guard">一直蹲防</option>
            <option value="fight">会还手</option>
            <option value="repeat-heavy">反复重击（练反击）</option>
            <option value="repeat-jump">反复跳跃（练接人）</option>
          </select></label
        ><label
          ><input
            v-model="infiniteEnergy"
            type="checkbox"
            :disabled="lessonId !== null"
          />无限能量</label
        ><button type="button" @click="resetPractice">重置站位</button
        ><button type="button" @click="endPractice">结束练习</button>
      </div>
      <small v-if="lessonId">课程已设置木桩与能量；切回自由练招可自行调整。</small>
    </div>
    <PracticeLessons
      v-if="!choosing && mode === 'practice'"
      :lessons="lessonChoices"
      :selected="lessonId"
      :progress="lessonProgress"
      :completed="passedLessons"
      :disabled="paused || !artReady || battle.phase === 'done'"
      @select="selectLesson"
      @retry="resetPractice"
    />
    <div
      v-if="!choosing && (mode === 'practice' || localVersus)"
      class="duel-input-readout"
      aria-label="方向与招式输入"
    >
      <div
        v-for="f in battle.fighters.slice(0, localVersus ? 2 : 1)"
        :key="f.slot"
        :data-testid="`duel-input-${f.slot}`"
      >
        <b>P{{ f.slot + 1 }}</b>
        <span class="duel-input-keys">
          <kbd v-for="(entry, index) in f.inputLog" :key="index">{{ entry.text }}</kbd>
          <small v-if="!f.inputLog.length">方向＋拳脚，试着搓一招</small>
        </span>
        <strong v-if="f.motionResult">已识别：{{ f.motionResult.text }}</strong>
        <span
          v-if="['doubao', 'unplug_uncle'].includes(f.id)"
          class="duel-charge-status"
          :class="{ ready: f.chargeReadyUntil >= battle.inputFrame }"
        >
          {{
            f.chargeReadyUntil >= battle.inputFrame
              ? `蓄力好了！前＋${f.id === 'doubao' ? '拳' : '脚'}`
              : `蓄后 ${f.backCharge}/${CHARGE_FRAMES}`
          }}
        </span>
        <em v-if="f.action === 'closeHeavy'">{{ NORMAL_STYLE[f.id].closeName }}</em>
        <em v-if="f.action === 'grabbed'">{{ throwPrompt(f.slot) }}</em>
        <em v-else-if="f.y > 0">{{
          f.action === 'launched'
            ? '被挑空'
            : f.action === 'down'
              ? '砸落中'
              : JUMP_LABEL[f.jumpKind]
        }}</em>
      </div>
    </div>
    <div v-if="!choosing && campaign" class="duel-campaign-strip">
      <strong>{{ STATION_NAMES[campaign.stage] }}</strong
      ><span>{{
        campaign.stage === 2
          ? '另一个你带25能量上场。先把自己揍服。'
          : '赢下这场就能加菜，选个奖励接着打。'
      }}</span>
      <div>
        <span v-for="perk in campaign.perks" :key="perk" class="duel-perk">{{
          UPGRADES[perk].name
        }}</span>
      </div>
    </div>
    <div
      v-if="intermission && campaign"
      class="duel-intermission"
      role="region"
      aria-label="连战加菜奖励选择"
    >
      <span class="duel-kicker">打赢了 · {{ campaign.wins }} / 3</span>
      <h3>赢了，加菜！<br />下一场想怎么揍？</h3>
      <p>
        下站：{{
          ROSTER[campaign.opponents[campaign.stage + 1]!].name
        }}。生命回满，已选加菜奖励继续生效。
      </p>
      <div class="duel-upgrades">
        <button v-for="id in remainingUpgrades" :key="id" type="button" @click="chooseUpgrade(id)">
          <b>{{ UPGRADES[id].icon }}</b
          ><strong>{{ UPGRADES[id].name }}</strong
          ><span>{{ UPGRADES[id].text }}</span>
        </button>
      </div>
    </div>
    <div class="duel-footer">
      <button type="button" @click="help = !help">{{ help ? '收起操作' : '怎么看招？' }}</button>
      <details>
        <summary>声音与演出</summary>
        <div class="duel-settings">
          <label><input v-model="sound" type="checkbox" />打击音效</label
          ><label><input v-model="voice" type="checkbox" :disabled="!localVoice" />角色念台词</label
          ><label><input v-model="shake" type="checkbox" />镜头震动</label
          ><label><input v-model="cutscene" type="checkbox" />大招特写</label
          ><small v-if="!localVoice">当前设备没有本地中文语音，台词以字幕显示。</small>
        </div>
      </details>
      <span>白饭不白吃，挨打不包赔。</span>
    </div>
    <div v-if="help" class="duel-help" role="region" aria-label="操作说明">
      <button class="duel-help-return" type="button" @click="help = false">回到战斗 ×</button>
      <h3>先会揍人，再学整活。</h3>
      <p>
        <strong>角色指令：{{ CHARACTER_COMMANDS[activePlayer].name }}</strong>
        {{ CHARACTER_COMMANDS[activePlayer].input }}。{{ CHARACTER_COMMANDS[activePlayer].tip }}
        半圈指令允许短暂松开方向，换边左右反过来。蓄力约0.67秒，松开后8帧内接前方向与攻击；
        暂停、失焦或换边会清除蓄力。快捷键仍可直接发动原招式。
      </p>
      <p v-if="activePlayer === 'client'">
        <strong>Y 合同锁人 / P2退格</strong>指令投不能靠按O拆开，要在抓住前起跳、后撤或打断起手。
        抓空有48帧动作时间；对手正在受击、格挡硬直、倒地或起身保护中不能抓。
        普通O和F退回重做仍能在抓住后8帧内拆开；双方投技同帧生效时会对撞解开。
      </p>
      <p>
        <strong>I 一阶 / R 二阶 / T 终结：这顿越吃越大</strong>
        普通释放分别花1/2/3格气。MAX剩余至少240帧时，一阶消耗240帧；二阶/终结消耗全部MAX时间，再花1/2格气。
        大招打中或被挡后的短窗口可升级，命中特写前0.6秒也可按R/T，或点升级按钮；升级只补差价，每升一阶补1格气。
        同阶不能自取消，空挥、对手已经倒完和资源不足都不能升级。二阶/终结连段最多12击，上限分别600/700伤害。
        双正摇以两拳收招是二阶；↓↙←↙↓↘→＋拳是终结指令，面朝左时左右反过来。
      </p>
      <p>
        <strong
          >二阶：{{ FINISHERS[activePlayer].max }} · 终结：{{
            FINISHERS[activePlayer].climax
          }}</strong
        >{{ FINISHERS[activePlayer].tip }}
      </p>
      <p>
        <strong>G 击飞 / 挡住后G防反</strong>
        平时免费把人踢远，空中可砸落；也可同时按重拳＋重脚。挡住攻击的硬直中按G，花1格气发动快速反击，
        起手10帧受保护，打空后的收招可被惩罚；挨打时不能拿它脱身。P2用分号，二阶用引号键，终结用等号键。
      </p>
      <p v-if="mode === 'team'">
        <strong>3v3：我先上，你兜底</strong>
        每队三人按顺序出场，败者退场后换人。胜者保留血量，按剩余时间回60–180血，最多回满；能量双方继承。
        先锋、中坚、大将分别能存3、4、5格气。时间到按剩余血量决胜，平血或双倒双方一起退场。
        一队三人全退才结束，双方同时全退算平局。
      </p>
      <p>
        <strong>跳得矮，压得快；跳得高，追得远</strong>
        跳键短按是小跳，按住超过约0.1秒是普通跳。先蹲再跳，或冲刺中起跳，是大跳；这时短按会变成带惯性的高速小跳。
        空中再按一次是二段跳，挑空命中后的跳跃追击照常。
      </p>
      <p>
        <strong>Q EX技 / Z EX变：花半格，来点狠的</strong>
        最多存5格能量，每格100。EX技和EX变各花50能量，独立于普通招式冷却。
        {{ EX_STYLE[activePlayer].name }}：{{ EX_STYLE[activePlayer].tip }}
        正摇或反摇后同时按轻拳＋重拳，也能出对应EX。
      </p>
      <p>
        <strong>E MAX：算力全开</strong>
        花2格能量爆气10秒，伤害提升12%；普通拳脚打中或被挡时按E是Quick
        MAX，取消收招并追近，持续5秒，不附加伤害增幅。
        MAX中EX消耗120帧爆气时间，大招优先消耗240帧；时间不足时，大招仍可花1格能量。
        特殊技接触后可取消到另一种特殊技或大招，不能同招反复自取消。MAX期间不涨能量，连段最多8击/500伤害。
      </p>
      <p>P2：[ 或小键盘＋出EX技，反斜杠或小键盘Enter出EX变，] 或小键盘－爆气。</p>
      <p>
        <strong>四键拳脚：J 轻拳 / M 轻脚 / K 重拳 / N 重脚</strong>
        轻脚出得快，命中后能接重拳或重脚；重脚把人踹倒。蹲＋M 是低位轻脚，蹲＋N 是扫堂腿。 贴身按 K
        自动变成近重拳，打中或被挡都可接特色技、变招、升龙或大招；打空不能直接取消。
        空中也有轻拳、轻脚、重拳、重脚，轻攻击打中后能接重攻击砸落。
      </p>
      <p>
        <strong
          >{{ NORMAL_STYLE[activePlayer].closeName }} /
          {{ NORMAL_STYLE[activePlayer].kickName }}</strong
        >{{ NORMAL_STYLE[activePlayer].tip }}
      </p>
      <div class="duel-motion-list">
        <p><strong>↓↘→＋J/K</strong>{{ ROSTER[activePlayer].skill }}（也可 U）</p>
        <p><strong>↓↙←＋J/K</strong>{{ ROSTER[activePlayer].variant }}（25能量，也可 V）</p>
        <p><strong>→↓↘＋J/K</strong>挑空，命中后跳跃追击（也可蹲＋K）</p>
        <p><strong>↓↘→↓↘→＋J/K</strong>{{ ROSTER[activePlayer].ultimate }}（100能量，也可 I）</p>
      </div>
      <p>
        以上方向按面向右侧书写；换到右边时左右反过来。P2 用数字1/2收招。
        识别搓招后仍需满足能量、冷却和取消条件。练招房会显示输入与识别结果。
      </p>
      <p>
        <strong>别光嘴硬，要会换挡</strong>按住 L 或后方向防御正面攻击。蹲＋防挡低位拳和扫堂腿；
        对手跳着打就松开蹲，用站防。防御条被打空会「嘴硬失败」，短时间无法行动；脱离压制后自动恢复。
      </p>
      <p>
        <strong>C / P2 逗号：先溜为敬</strong>方向＋闪避可以向前穿人或向后撤。
        移动中能躲拳脚和飞行道具，起手与收招会挨打，全程可被摔。挡住一招时按闪避，花50能量取消防御硬直。
      </p>
      <p>
        <strong>N / P2 句号：重腿；M / P2 斜杠：轻腿</strong
        >站立重腿是前踢，蹲下重腿是扫堂腿，空中重腿是砸落。轻腿适合试探和连段。蹲＋J 是低位拳，蹲＋K
        是挑空；蹲防保持低姿态。
      </p>
      <p>
        <strong>双人互坑：抢饭、退件、接住过载</strong
        >贴近持碗者按投技抢饭，拿到后按整活吃掉；原主人打中持碗者即可夺回。重击生效时能把气泡打回去，双方可继续反弹。GPT
        接人时再碰上气泡，或接到带饭碗的人，会过载一起摔落；未结算的接人伤害取消。
      </p>
      <p>
        <strong>F 整活：{{ signature[activePlayer].name }}</strong
        >{{ signature[activePlayer].tip }} 双人模式 P2 用数字9整活。整活期间有破绽，可以被打断。
      </p>
      <p>
        <strong>拳头还没收回来，也能先按下一招</strong>下一招可以稍微提前按，蹲着按的招也会记住。
        前两拳打中后按 H，花15能量追上去继续揍；打空或被挡就不行。GPT
        的技能第一拳打中后，能量满了可接 I 大招。
      </p>
      <p>
        <strong>追上去揍：H 冲刺 / 二段跳</strong>按方向＋H
        突进，空中每次起跳可冲刺一次；冲刺途中可接拳脚。跳起后再按跳可二段跳。蹲＋K
        挑空，命中后立即按跳追上去，空中 J 接 K 把对手砸下。浮空时可用 P 脱身。
      </p>
      <p>
        <strong>V 换招接着打 / P 别连我了</strong>{{ ROSTER[activePlayer].variant }}：{{
          ROSTER[activePlayer].variantTip
        }}
        V 花25能量，等5秒能再用。挨打或挡招时按 P，花50能量把人推开，每回合一次。
        被抓住时用投技挣脱；大招特写期间要等演出结束。
      </p>
      <div>
        <p><strong>① 连点「打」</strong>打中后再按，能接三连。打空气就得等一下。</p>
        <p><strong>② 学会换挡</strong>蹲防挡扫腿，站防挡跳攻；对手一直挡，就走近按「摔」。</p>
        <p><strong>③ 满能量再放大招</strong>按 I / 大招。先打中再接，别把一整管能量喂空气。</p>
      </div>
      <p>
        A / D 移动，W / 空格跳，S 蹲；J 打，K 重，L 挡，U 技，O 摔，I 大招，H
        冲刺（也可双击方向）。蹲＋重挑空，跳跃追击。被抓住时立即按摔可以拆投。
      </p>
      <button class="duel-primary" type="button" @click="help = false">懂了，继续</button>
    </div>
  </section>
</template>

<style scoped>
.duel {
  --duel-ink: #eaf0ff;
  --duel-accent: #ffd369;
  color: var(--duel-ink);
  background: #141d30;
  border-radius: 10px;
  border: 1px solid #34435d;
  overflow: hidden;
  position: relative;
  font-family: inherit;
}
.duel button,
.duel select {
  font: inherit;
}
.duel button {
  cursor: pointer;
}
.duel button:focus-visible,
.duel select:focus-visible,
.duel summary:focus-visible {
  outline: 3px solid #b7d5ff;
  outline-offset: 3px;
}
.duel-select {
  padding: 28px;
  background:
    repeating-linear-gradient(125deg, transparent 0 70px, #ffffff02 71px 73px),
    radial-gradient(ellipse at 90% 0, #304368, transparent 60%), #111a2b;
}
.duel-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 3px;
  color: #a8bbd6;
}
.duel-intro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.duel-intro .duel-kicker {
  width: 100%;
}
.duel-intro h2 {
  margin: 12px 0 0;
  font-size: clamp(27px, 4vw, 46px);
  letter-spacing: -1px;
  line-height: 1.15;
}
.duel-intro p {
  color: #aebdd3;
  line-height: 1.5;
  font-size: 14px;
}
.duel-roster {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.duel-card {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-direction: column;
  border: 1px solid #3e4d67;
  border-radius: 5px;
  padding: 16px 10px 12px;
  color: var(--fighter);
  background: linear-gradient(155deg, #2c3b51, #172236 70%);
  position: relative;
  transition: background 0.2s;
}
.duel-card:hover,
.duel-card.selected {
  background: #2c3b53;
  border-color: var(--fighter);
}
.duel-card.selected {
  box-shadow:
    inset 0 -4px var(--fighter),
    0 0 24px #70bdff10;
}
.duel-role {
  font-size: 12px;
  letter-spacing: 2px;
}
.duel-card svg {
  width: 100%;
  max-width: 230px;
  height: 180px;
}
.duel-card strong {
  font-size: 20px;
  color: #f5f7ff;
}
.duel-card-tip {
  color: #b5c5d9;
  margin-top: 8px;
  font-size: 12px;
  text-align: center;
}
.duel-picked {
  margin-top: 10px;
  font-size: 12px;
}
.duel-launch {
  display: flex;
  gap: 14px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #40516a;
  background: #0c1424;
  border-radius: 6px;
}
.duel-launch label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.duel-launch select {
  border: 1px solid #56647a;
  color: #e7edfa;
  border-radius: 8px;
  background: #26344b;
  padding: 10px;
}
.duel-launch > span {
  font-size: 12px;
  color: #9baec9;
}
.duel-primary {
  background: #ffd369;
  color: #252314;
  border: 0;
  border-radius: 8px;
  padding: 13px 24px;
  font-weight: 800 !important;
  min-height: 48px;
}
.duel-launch .duel-primary {
  margin-left: auto;
}
.duel-arena {
  position: relative;
  outline: none;
  max-width: 1040px;
  margin-inline: auto;
}
.duel-world {
  display: block;
  width: 100%;
}
.duel-hud {
  position: absolute;
  left: 3%;
  right: 3%;
  top: 3%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15%;
  z-index: 2;
}
.duel-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: clamp(11px, 1.7vw, 19px);
  margin-bottom: 6px;
}
.duel-name span {
  font-size: 11px;
  color: #96a8c4;
}
.duel-name b {
  color: #465574;
  margin-left: 4px;
}
.duel-name b.lit {
  color: #e3ed9f;
}
.duel-health-track {
  position: relative;
  height: 18px;
  border: 2px solid #899bb3;
  background: #452b3e;
  transform: skewX(-10deg);
  overflow: hidden;
}
.duel-health-lag,
.duel-health-track i {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  height: 100%;
}
.duel-health-lag {
  z-index: 0;
  background: #ffd58a;
}
.duel-health-track i {
  z-index: 1;
  background: linear-gradient(0deg, var(--fighter) 0 65%, #ffffffc9 66% 100%);
}
.rival .duel-health-track {
  transform: skewX(10deg);
}
.rival .duel-health-track i,
.rival .duel-health-lag {
  right: 0;
  left: auto;
}
.duel-energy {
  margin-top: 5px;
  height: 14px;
  background: #101627;
  position: relative;
  overflow: hidden;
}
.duel-guard-track {
  height: 12px;
  margin-top: 3px;
  position: relative;
  background: #111929;
  overflow: hidden;
}
.duel-guard-track i {
  display: block;
  height: 100%;
  background: #438a94;
}
.duel-guard-track.danger i {
  background: #de684d;
}
.duel-guard-track.danger {
  box-shadow: inset 0 0 0 1px #ffab82;
}
.duel-guard-track span {
  position: absolute;
  left: 4px;
  top: 0;
  font-size: 9px;
  line-height: 12px;
  color: #fff;
}
.duel-energy i {
  display: block;
  height: 100%;
  background: #5263a3;
}
.duel-energy::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to right,
    transparent 0 calc(var(--stock-step, 20%) - 2px),
    #102039 calc(var(--stock-step, 20%) - 2px) var(--stock-step, 20%)
  );
}
.duel-energy span,
.duel-energy small {
  z-index: 1;
}
.duel-max-track {
  position: relative;
  height: 14px;
  margin-top: 3px;
  background: #201425;
  color: #fff7d0;
  font-size: 10px;
  line-height: 14px;
}
.duel-max-track i {
  display: block;
  height: 100%;
  background: #b66c20;
}
.duel-max-track.quick i {
  background: #256c9b;
}
.duel-max-track span {
  position: absolute;
  inset: 0;
  padding-left: 4px;
}
.duel-advanced-pad {
  padding: 12px 18px;
  background: #152139;
  color: #c8d9f1;
  border-top: 1px solid #405571;
  font-size: 13px;
}
.duel-advanced-pad summary {
  cursor: pointer;
}
.duel-advanced-pad > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}
.duel-advanced-pad button,
.duel-super-links button {
  border: 1px solid #a9bedd;
  border-radius: 6px;
  padding: 10px 12px;
  background: #253e60;
  color: #fff3bd;
  cursor: pointer;
  font: inherit;
  touch-action: none;
}
.duel-advanced-pad small {
  display: block;
  color: #c1d2ea;
  margin-top: 4px;
}
.duel-advanced-pad button:disabled,
.duel-super-links button:disabled {
  opacity: 0.4;
  cursor: default;
}
.duel-mobile-more {
  display: none;
}
.duel-super-links {
  display: flex;
  justify-content: center;
  gap: 8px;
  position: relative;
  z-index: 3;
}
.duel-super-links button {
  background: #ffe0a1;
  color: #23364c;
  font-size: clamp(10px, 1.5vw, 15px);
}
.duel-ultimate.tier-2 {
  box-shadow: inset 0 0 80px #713dbb99;
}
.duel-ultimate.tier-3 {
  box-shadow: inset 0 0 100px #e0447399;
}
.duel-action-pad .control-max {
  border-color: #f3ce71;
  color: #fff1a9;
}
.duel-action-pad .control-exSkill,
.duel-action-pad .control-exVariant {
  border-color: #b495ef;
  color: #e4d7ff;
}
.duel-action-pad .control-exSkill b,
.duel-action-pad .control-exVariant b {
  font-size: 14px;
  line-height: 1.2;
  white-space: nowrap;
}
.duel-energy span {
  position: absolute;
  left: 4px;
  top: 0;
  font-size: 10px;
  line-height: 14px;
}
.duel-energy small {
  position: absolute;
  right: 3px;
  top: 0;
  font-size: 10px;
  line-height: 14px;
}
.duel-clock {
  position: absolute;
  left: 43%;
  width: 14%;
  text-align: center;
  top: -7px;
}
.duel-clock strong {
  display: block;
  font-size: clamp(25px, 4vw, 45px);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  font-style: italic;
  color: #ffe2a0;
}
.duel-clock span {
  font-size: clamp(8px, 1vw, 11px);
  letter-spacing: 1px;
  color: #a0b6d2;
}
.duel-clock.danger strong,
.duel-clock.danger span {
  color: #ff9d7f;
}
.duel-clock.critical:not(.reduced) {
  animation: duel-timer-pulse 500ms ease-in-out infinite alternate;
}
@keyframes duel-timer-pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.08);
  }
}
.duel-center {
  position: absolute;
  inset: 24% 10% 18%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  pointer-events: none;
  text-align: center;
  text-shadow: 0 3px 20px #000;
}
.duel-art-loading {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: #122038ee;
  color: #dceaff;
}
.duel-art-loading strong {
  font-size: clamp(18px, 3vw, 28px);
  color: #ffe3a3;
}
.duel-art-loading progress {
  width: min(60%, 320px);
  height: 12px;
  accent-color: #91c8ff;
}
.duel-art-loading small {
  font-size: 12px;
  color: #b2c7e1;
}
.duel-center > span {
  letter-spacing: 5px;
  font-weight: 800;
  color: #cce5ff;
  font-size: 14px;
}
.duel-center strong {
  font-size: clamp(40px, 8vw, 84px);
  font-style: italic;
}
.duel-center p {
  font-size: 13px;
  color: #c4d4ed;
}
.duel-round {
  background: #152037e8;
  border: 1px solid #667994;
  border-radius: 12px;
}
.duel-round:not(.reduced) {
  animation: duel-round-in 160ms cubic-bezier(0.18, 0.78, 0.22, 1);
}
.duel-round.ko > span,
.duel-round.draw > span {
  color: #ffe58c;
  font-size: clamp(24px, 5vw, 52px);
  text-shadow:
    3px 3px #813a35,
    -2px -2px #22334e;
}
.duel-round.timeout > span {
  color: #ffcf9b;
  font-size: clamp(20px, 4vw, 42px);
}
@keyframes duel-round-in {
  0% {
    opacity: 0;
    transform: scale(1.18);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
.duel-round strong {
  font-size: clamp(20px, 4vw, 40px);
  margin: 12px;
}
.duel-round p {
  margin: 0;
  font-size: 25px;
}
.duel-quip {
  position: absolute;
  left: 50%;
  top: 35%;
  transform: translateX(-50%) rotate(-3deg);
  background: #f6f0d1;
  color: #293043;
  padding: 6px 14px;
  font-size: clamp(12px, 1.8vw, 20px);
  font-weight: 900;
  white-space: nowrap;
  z-index: 3;
  box-shadow: 4px 4px #141d30;
}
.duel-ultimate {
  position: absolute;
  inset: 16% 0 5%;
  background: #111a2af7;
  border-top: 3px solid var(--fighter);
  border-bottom: 3px solid var(--fighter);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  color: var(--fighter);
  z-index: 4;
  overflow: hidden;
}
.duel-ultimate-art {
  width: 45%;
  max-height: 60%;
}
.duel-ultimate-art svg {
  display: block;
  width: 100%;
  max-height: 230px;
}
.duel-ultimate h3 {
  font-size: clamp(16px, 3vw, 32px);
  margin: 6px;
}
.duel-ultimate p {
  background: var(--fighter);
  color: #1d2535;
  padding: 5px 15px;
  margin: 8px;
  font-size: clamp(12px, 2vw, 20px);
  font-weight: 900;
}
.duel-ultimate.simple {
  background: #142039ed;
}
.duel-ultimate.simple h3 {
  margin: 20px 8px;
}
.duel-lesson-cue {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: #203450;
  color: #e2edff;
  font-size: 13px;
}
.duel-lesson-cue strong {
  color: #ffe1a1;
  white-space: nowrap;
}
.duel-lesson-cue span {
  flex: 1;
  line-height: 1.5;
}
.duel-lesson-cue button {
  color: #fff0c3;
  background: #51452d;
  border: 1px solid #ad9564;
  border-radius: 5px;
  padding: 8px;
  white-space: nowrap;
  cursor: pointer;
}
.duel-lesson-cue button:disabled {
  opacity: 0.45;
  cursor: default;
}
.duel-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 12px 20px;
  background: linear-gradient(180deg, #1e2a3e, #131e31);
  border-top: 1px solid #3b4965;
  touch-action: none;
  user-select: none;
}
.duel-controls button {
  min-width: 48px;
  min-height: 48px;
  border: 1px solid #53647f;
  background: #27364f;
  color: #e9f2ff;
  border-radius: 6px;
  box-shadow: inset 0 -3px #0a142455;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.duel-controls button:active {
  background: #5a718f;
  transform: translateY(1px);
}
.duel-controls button.held {
  background: #58799f;
  box-shadow: inset 0 0 0 2px #c6e8ff;
  transform: translateY(1px);
}
.duel-controls .link-ready,
.duel-advanced-pad .link-ready,
.duel-p2-pad .link-ready {
  border-color: #ffd369;
  box-shadow: inset 0 0 0 1px #ffd369;
}
.duel-coach .duel-link-ready {
  color: #ffd369;
}
.duel-controls button:disabled {
  opacity: 0.45;
  cursor: default;
}
.duel-directions {
  display: grid;
  grid-template-columns: repeat(3, 48px);
  gap: 5px;
}
.control-crouch {
  grid-column: 2;
}
.duel-directions .control-jump {
  grid-column: 2;
  grid-row: 1;
}
.duel-directions .control-left {
  grid-column: 1;
  grid-row: 2;
}
.duel-directions .control-right {
  grid-column: 3;
  grid-row: 2;
}
.duel-directions .control-crouch {
  grid-row: 2;
}
.duel-action-pad {
  display: grid;
  grid-template-columns: repeat(3, 56px);
  gap: 6px;
}
.duel-action-pad button {
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.duel-action-pad b {
  font-size: 17px;
}
.duel-action-pad small {
  font-size: 10px;
  color: #b8c5d9;
}
.duel-action-pad .control-light {
  background: #a9d5ff;
  color: #162742;
}
.duel-action-pad .control-light small {
  color: #203e65;
}
.duel-action-pad .charged {
  background: #ffd369;
  color: #253714;
  border-color: #e8ffc0;
}
.duel-action-pad .charged small {
  color: #354b1c;
}
.duel-coach {
  display: flex;
  flex-direction: column;
  gap: 7px;
  text-align: center;
}
.duel-coach strong {
  color: #cbdfff;
  font-size: 15px;
}
.duel-coach span,
.duel-coach small {
  font-size: 12px;
  color: #9db2d1;
}
.duel-footer {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 12px 20px;
  color: #a3b5d0;
  font-size: 12px;
}
.duel-footer > button {
  background: none;
  color: #d3e5ff;
  border: 0;
  padding: 5px 0;
  min-height: 32px;
}
.duel-footer > span {
  margin-left: auto;
  color: #a5b6cf;
  font-size: 11px;
}
.duel-footer summary {
  cursor: pointer;
  padding: 8px 0;
}
.duel-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 12px;
}
.duel-settings label {
  display: flex;
  align-items: center;
  gap: 5px;
}
.duel-settings small {
  width: 100%;
}
.duel-help {
  position: absolute;
  inset: 0;
  background: #152036f7;
  z-index: 5;
  overflow: auto;
  padding: 28px;
}
.duel-help h3 {
  font-size: 26px;
}
.duel-help > div {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.duel-help p {
  color: #bccbe1;
  line-height: 1.8;
  font-size: 14px;
}
.duel-help strong {
  display: block;
  color: #e9f3ff;
  margin-bottom: 8px;
}
.duel-help .duel-primary {
  margin-top: 10px;
}
.duel-help-return {
  position: sticky;
  top: 0;
  float: right;
  padding: 8px 12px;
  border: 1px solid #778aa6;
  border-radius: 6px;
  background: #263c5e;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.impact {
  animation: duel-impact 90ms steps(2, end);
  transform-origin: center;
}
@keyframes duel-impact {
  0% {
    transform: translate(0);
  }
  20% {
    transform: translate(-5px, 2px);
  }
  40% {
    transform: translate(4px, -2px);
  }
  60% {
    transform: translate(-3px, -1px);
  }
  80% {
    transform: translate(2px, 1px);
  }
  100% {
    transform: translate(0);
  }
}
.duel-clock span {
  display: block;
  white-space: nowrap;
  letter-spacing: 0;
}
@media (max-width: 360px) {
  .duel-directions button[class] {
    grid-column: auto;
    grid-row: auto;
  }
}
@media (max-width: 700px) {
  .duel-select {
    padding: 20px 14px;
  }
  .duel-intro {
    gap: 10px;
  }
  .duel-intro p {
    margin: 0;
  }
  .duel-roster {
    gap: 7px;
  }
  .duel-card {
    padding: 12px 5px;
  }
  .duel-card svg {
    height: 120px;
  }
  .duel-card strong {
    font-size: 14px;
  }
  .duel-card-tip {
    font-size: 11px;
    line-height: 1.5;
    min-height: 34px;
  }
  .duel-role {
    font-size: 10px;
    letter-spacing: 0;
  }
  .duel-picked {
    margin-top: 8px;
  }
  .duel-launch {
    gap: 12px;
  }
  .duel-launch > span {
    width: 100%;
    order: 3;
  }
  .duel-launch .duel-primary {
    padding: 12px 18px;
  }
  .duel-coach {
    display: none;
  }
  .duel-controls {
    padding: 10px 8px;
    gap: 6px;
  }
  .duel-directions {
    --stick-x: 0px;
    --stick-y: 0px;
    grid-template-columns: repeat(3, 48px);
    gap: 3px;
  }
  .duel-action-pad {
    grid-template-columns: repeat(3, 48px);
    gap: 4px;
  }
  .duel-action-pad button {
    height: 52px;
  }
  .duel-hud {
    top: 5%;
  }
  .duel-health-track {
    height: 11px;
  }
  .duel-name {
    margin-bottom: 3px;
  }
  .duel-energy {
    height: 11px;
    margin-top: 3px;
  }
  .duel-energy span,
  .duel-energy small {
    font-size: 8px;
    line-height: 11px;
  }
  .duel-clock {
    top: -3px;
  }
  .duel-help {
    padding: 18px;
  }
  .duel-help h3 {
    font-size: 20px;
  }
  .duel-help > div {
    display: block;
  }
  .duel-help p {
    font-size: 13px;
  }
  .duel-ultimate .duel-kicker {
    display: none;
  }
  .duel-footer {
    gap: 10px;
    padding: 8px 12px;
  }
  .duel-footer > span {
    width: 100%;
    margin-left: 0;
  }
  .duel-ultimate-art {
    width: 35%;
  }
  .duel-center > span {
    font-size: 10px;
  }
  .duel-center p {
    font-size: 10px;
  }
  .duel-round strong {
    margin: 6px;
  }
  .duel-action-pad .control-light {
    min-height: 56px;
  }
}
@media (max-width: 360px) {
  .duel-controls {
    flex-wrap: wrap;
    justify-content: center;
    gap: 12px;
  }
  .duel-directions {
    grid-template-columns: repeat(4, 48px);
    width: 100%;
    justify-content: center;
  }
  .duel-directions button {
    grid-column: auto;
    grid-row: auto;
  }
  .duel-action-pad {
    grid-template-columns: repeat(3, 64px);
  }
  .duel-roster {
    grid-template-columns: 1fr;
  }
  .duel-card {
    display: grid;
    grid-template-columns: 78px 1fr;
    text-align: left;
    padding: 10px 14px;
  }
  .duel-card svg {
    grid-column: 1;
    grid-row: 1/5;
    height: 96px;
  }
  .duel-role,
  .duel-card strong,
  .duel-card-tip,
  .duel-picked {
    grid-column: 2;
    text-align: left;
  }
  .duel-card-tip {
    min-height: 0;
  }
  .duel-launch .duel-primary {
    width: 100%;
    margin: 0;
  }
  .duel-energy small {
    display: none;
  }
}
.duel-ultimate-art img {
  display: block;
  width: 100%;
  object-fit: contain;
  max-height: 230px;
}
.duel-card .duel-portrait {
  display: block;
  width: 100%;
  max-width: 250px;
  height: 190px;
  object-fit: contain;
}
.duel-mode-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: 0 0 18px;
  border: 1px solid #43536d;
  border-radius: 6px;
  overflow: hidden;
}
.duel-mode-picker button {
  text-align: left;
  background: #1d2a40;
  color: #e9f2ff;
  border: 0;
  border-bottom: 3px solid transparent;
  border-radius: 0;
  padding: 11px 14px;
}
.duel-mode-picker button[aria-pressed='true'] {
  border-color: #ffd369;
  background: #354052;
}
.duel-mode-picker button:focus-visible {
  outline-offset: -4px;
}
.duel-mode-picker strong,
.duel-mode-picker span {
  display: block;
}
.duel-mode-picker span {
  font-size: 12px;
  color: #b5c5d8;
  line-height: 1.7;
  margin-top: 6px;
}
.duel-mobile-quick {
  display: none;
}
.duel-loadout {
  margin: 14px 0;
  border: 1px solid #40516a;
  border-radius: 5px;
  color: #c1d2e8;
  font-size: 13px;
}
.duel-loadout summary {
  padding: 11px 13px;
  color: #ffd369;
  cursor: pointer;
  font-weight: 800;
}
.duel-loadout > div {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 14px;
  padding: 0 13px 13px;
}
.duel-loadout strong {
  color: #ffd369;
}
.duel-loadout small {
  width: 100%;
  color: #adbed5;
  line-height: 1.7;
}
.duel-combo {
  position: absolute;
  left: 5%;
  top: 26%;
  display: flex;
  flex-direction: column;
  color: #ddf6a5;
  pointer-events: none;
}
.duel-combo strong {
  font-size: clamp(17px, 3vw, 30px);
  font-style: italic;
}
.duel-combo span {
  font-size: 12px;
}
.duel-combo small {
  color: #b9c9df;
  font-size: 10px;
}
.duel-combo.capped strong,
.duel-combo.capped small {
  color: #ffd17c;
}
.duel-frame-feedback {
  position: absolute;
  left: 5%;
  top: 39%;
  display: flex;
  flex-direction: column;
  color: #ffb69c;
  pointer-events: none;
}
.duel-frame-feedback.rival {
  right: 5%;
  left: auto;
  align-items: flex-end;
}
.duel-frame-feedback.plus {
  color: #cdef91;
}
.duel-frame-feedback strong {
  font-size: clamp(14px, 2vw, 22px);
}
.duel-frame-feedback span {
  font-size: 11px;
}
@media (max-width: 700px) {
  .duel-combo {
    top: 38%;
    left: 4%;
  }
  .duel-combo-p2 {
    right: 4%;
    left: auto;
  }
  .duel-combo span {
    font-size: 10px;
  }
  .duel-combo small {
    font-size: 8px;
  }
}
.duel-reaction {
  position: absolute;
  right: 2%;
  bottom: 4%;
  width: 12%;
  max-width: 120px;
  pointer-events: none;
}
.duel-reaction img {
  display: block;
  width: 100%;
  filter: drop-shadow(0 2px 3px #091524);
}
.duel-action-pad .ready {
  border-color: #ceafff;
  background: #47395d;
}
.duel-action-pad .control-burst b,
.duel-action-pad .control-variant b {
  font-size: 15px;
}
.duel-action-pad .control-burst small,
.duel-action-pad .control-variant small {
  font-size: 9px;
}
.duel-practice-bar,
.duel-campaign-strip {
  padding: 16px 20px;
  border-top: 1px solid #3f4e67;
  background: #1d2b42;
}
.duel-training-goals {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #adbed7;
  font-size: 13px;
  margin-bottom: 14px;
}
.duel-training-goals [data-done='true'] {
  color: #d5f29a;
}
.duel-practice-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 13px;
}
.duel-practice-options label {
  display: flex;
  align-items: center;
  gap: 5px;
}
.duel-practice-options select,
.duel-practice-options button {
  background: #283a53;
  color: #e5efff;
  border: 1px solid #5f718e;
  border-radius: 7px;
  padding: 9px;
  min-height: 42px;
}
.duel-campaign-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 13px;
}
.duel-campaign-strip > span {
  color: #a8bbd7;
}
.duel-perk {
  display: inline-block;
  padding: 5px 9px;
  border-radius: 6px;
  background: #364b43;
  color: #d5f29a;
  margin-right: 6px;
  font-size: 12px;
}
.duel-intermission {
  position: absolute;
  inset: 0;
  background: #152137f7;
  padding: clamp(22px, 5vw, 64px);
  z-index: 6;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.duel-intermission h3 {
  font-size: clamp(24px, 4vw, 42px);
  margin: 18px 0;
}
.duel-intermission p {
  font-size: 14px;
  line-height: 1.8;
  color: #b5c7e0;
}
.duel-upgrades {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}
.duel-upgrades button {
  background: #273a53;
  border: 1px solid #7a92b4;
  border-radius: 12px;
  padding: 22px;
  text-align: left;
  color: #f0f6ff;
}
.duel-upgrades b,
.duel-upgrades strong,
.duel-upgrades span {
  display: block;
}
.duel-upgrades b {
  font-size: 30px;
  color: #d5f29a;
  margin-bottom: 18px;
}
.duel-upgrades strong {
  font-size: 18px;
}
.duel-upgrades span {
  font-size: 13px;
  line-height: 1.8;
  color: #bbcee7;
  margin-top: 10px;
}
@media (max-width: 700px) {
  .duel-mode-picker {
    gap: 6px;
  }
  .duel-mode-picker button {
    padding: 10px 8px;
  }
  .duel-mode-picker strong {
    font-size: 13px;
  }
  .duel-mode-picker span {
    font-size: 11px;
  }
  .duel-card .duel-portrait {
    height: 130px;
  }
  .duel-upgrades {
    grid-template-columns: 1fr;
  }
  .duel-upgrades button {
    padding: 13px;
  }
  .duel-upgrades b {
    float: left;
    margin: 0 16px 0 0;
    font-size: 25px;
  }
  .duel-upgrades strong {
    font-size: 16px;
  }
  .duel-upgrades span {
    margin-top: 5px;
  }
  .duel-intermission {
    justify-content: flex-start;
  }
  .duel-practice-bar,
  .duel-campaign-strip {
    padding: 13px;
  }
  .duel-reaction {
    width: 16%;
  }
  .duel-ultimate-art {
    width: 75% !important;
  }
  .duel-loadout {
    font-size: 12px;
  }
  .duel-combo span {
    font-size: 9px;
  }
}
@media (max-width: 360px) {
  .duel-card .duel-portrait {
    grid-column: 1;
    grid-row: 1/5;
    height: 96px;
  }
  .duel-mode-picker {
    grid-template-columns: 1fr;
  }
  .duel-mode-picker button span {
    display: inline;
    margin-left: 10px;
  }
  .duel-mode-picker button strong {
    display: inline;
  }
}
.duel-meme-card {
  position: absolute;
  right: 1.5%;
  bottom: 3%;
  z-index: 3;
  width: clamp(78px, 16%, 175px);
  display: flex;
  align-items: center;
  flex-direction: column;
  pointer-events: none;
}
.duel-meme-card img {
  width: 100%;
  max-height: 160px;
  object-fit: contain;
  filter: drop-shadow(0 3px 2px #111d30);
}
.duel-meme-card strong {
  padding: 4px 9px;
  background: #fff0c6;
  color: #273650;
  border: 2px solid #263754;
  border-radius: 4px;
  font-size: clamp(10px, 1.5vw, 16px);
  transform: rotate(-3deg);
}
.duel-round.has-loser {
  inset: 18% 13% 9%;
}
.duel-round.has-loser > strong {
  margin: 4px;
  font-size: clamp(15px, 3vw, 30px);
}
.duel-round.has-loser > p {
  font-size: 18px;
}
.duel-round-vignette {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 90%;
}
.duel-round-vignette img {
  display: block;
  height: clamp(35px, 7vw, 95px);
  max-width: 46%;
  object-fit: contain;
}
.duel-loser-placard {
  background: #ffced1;
  color: #5c3542;
  padding: 6px 12px;
  border: 2px solid #8d5b5e;
  border-radius: 4px;
  font-weight: 800;
  font-size: clamp(10px, 1.4vw, 15px);
  text-shadow: none;
}
.duel-loser-placard.flipped {
  background: #d9efb5;
  border-color: #839863;
  color: #324320;
  transform: rotate(-4deg);
}
@media (max-width: 700px) {
  .duel-meme-card {
    width: 21%;
    bottom: 2%;
  }
  .duel-meme-card img {
    max-height: 80px;
  }
  .duel-round.has-loser {
    inset: 16% 9% 5%;
  }
  .duel-round-vignette {
    gap: 6px;
  }
  .duel-loser-placard {
    padding: 3px 6px;
  }
}
.duel-meme-card.on-left {
  right: auto;
  left: 1.5%;
}
.duel-intro em {
  color: var(--duel-accent);
  font-style: normal;
}
.duel-match-seal {
  display: grid;
  text-align: center;
  transform: rotate(-8deg);
  padding: 0 26px;
  color: #ffdb8a;
}
.duel-match-seal strong {
  font-size: 70px;
  font-style: italic;
  line-height: 1;
  text-shadow: 5px 4px #060d1c;
}
.duel-match-seal span {
  font-size: 9px;
  letter-spacing: 3px;
}
.duel-section-label {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  color: #c3d0e3;
  font-size: 12px;
  font-weight: 700;
}
.duel-section-label small {
  font-weight: 400;
  color: #a6b6cf;
}
.duel-card-number {
  position: absolute;
  top: 8px;
  left: 12px;
  font-size: 24px;
  font-style: italic;
  font-weight: 900;
  opacity: 0.3;
}
.duel-matchup {
  width: 100%;
  font-size: 15px;
}
.duel-launch .duel-setup-label {
  width: 100%;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #bdcbe0;
  order: 0;
}
.duel-matchup i {
  color: #ffd369;
  padding: 0 14px;
  font-size: 18px;
}
.duel-health {
  position: relative;
  padding-left: 52px;
  min-width: 0;
}
.duel-health.rival {
  padding-left: 0;
  padding-right: 52px;
}
.duel-hud-avatar {
  position: absolute;
  left: 0;
  top: 0;
  width: 44px;
  height: 56px;
  object-fit: cover;
  object-position: center top;
  background: #22324d;
  border: 1px solid var(--fighter);
  border-radius: 4px;
}
.rival .duel-hud-avatar {
  left: auto;
  right: 0;
  transform: scaleX(-1);
}
.duel-action-pad small {
  white-space: nowrap;
}
.duel-primary:hover {
  background: #ffe6a6;
}
.duel-action-pad .control-dash {
  border-color: #7ecac8;
  color: #b9f9ee;
}
@media (min-width: 1000px) {
  .duel-select {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 246px;
    column-gap: 22px;
    align-items: start;
  }
  .duel-intro,
  .duel-mode-picker {
    grid-column: 1 / -1;
  }
  .duel-section-label,
  .duel-roster,
  .duel-loadout {
    grid-column: 1;
  }
  .duel-launch {
    grid-column: 2;
    grid-row: 3 / 6;
    margin: 0;
    align-self: stretch;
    flex-direction: column;
    align-items: stretch;
    gap: 20px;
    padding: 20px;
  }
  .duel-launch label {
    justify-content: space-between;
  }
  .duel-launch select {
    width: 140px;
  }
  .duel-launch .duel-primary {
    width: 100%;
    margin-top: auto;
  }
  .duel-launch > span {
    line-height: 1.8;
  }
  .duel-matchup {
    padding-bottom: 20px;
    border-bottom: 1px solid #34435d;
  }
  .duel-action-pad {
    grid-template-columns: repeat(9, 50px);
    gap: 5px;
  }
  .duel-coach {
    max-width: 270px;
  }
  .duel-directions {
    grid-template-columns: repeat(3, 44px);
  }
  .duel-directions button {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (max-width: 700px) {
  .duel-select {
    padding: 18px 12px;
  }
  .duel-intro {
    flex-wrap: nowrap;
    gap: 4px;
    margin-bottom: 18px;
  }
  .duel-intro h2 {
    font-size: 27px;
    line-height: 1.3;
  }
  .duel-intro h2 em {
    display: block;
  }
  .duel-intro p {
    display: none;
  }
  .duel-intro .duel-kicker {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .duel-match-seal {
    display: none;
  }
  .duel-mode-picker {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
  }
  .duel-mode-picker button span {
    display: none;
  }
  .duel-mode-picker button {
    text-align: center;
    min-height: 44px;
  }
  .duel-section-label {
    font-size: 11px;
  }
  .duel-card-number {
    font-size: 16px;
    left: 5px;
    top: 2px;
  }
  .duel-card strong {
    font-size: 13px;
  }
  .duel-card-tip,
  .duel-picked {
    display: none;
  }
  .duel-card .duel-portrait {
    height: 108px;
  }
  .duel-card svg {
    height: 108px;
  }
  .duel-launch {
    padding: 12px;
    gap: 10px;
  }
  .duel-launch .duel-primary {
    width: 100%;
    margin: 0;
    order: 4;
  }
  .duel-launch > span {
    font-size: 11px;
  }
  .duel-hud {
    gap: 16%;
    left: 3%;
    right: 3%;
    top: 4%;
  }
  .duel-health,
  .duel-health.rival {
    padding: 0;
  }
  .duel-hud-avatar {
    display: none;
  }
  .duel-name span {
    font-size: 9px;
  }
  .duel-energy small {
    display: none;
  }
  .duel-controls {
    display: grid;
    grid-template-columns: 128px 1fr;
    padding: 12px 10px;
    gap: 14px;
  }
  .duel-directions {
    grid-template-columns: repeat(2, 48px);
    gap: 4px;
    width: auto;
  }
  .duel-directions::after {
    position: absolute;
    top: 41px;
    left: 41px;
    z-index: 2;
    width: 46px;
    height: 46px;
    border: 1px solid #c6ddf8;
    border-radius: 50%;
    background: linear-gradient(145deg, #d7e7fa, #718aa8);
    box-shadow:
      0 6px 14px #050b14b8,
      inset 0 2px 4px #fff9;
    content: '';
    pointer-events: none;
    transform: translate(var(--stick-x), var(--stick-y));
    transition: transform 55ms linear;
  }
  .duel-directions button[class] {
    grid-column: auto;
    grid-row: auto;
    min-width: 48px;
    min-height: 48px;
  }
  .duel-directions .control-jump {
    order: -2;
  }
  .duel-directions .control-crouch {
    order: -1;
  }
  .duel-action-pad {
    grid-template-columns: repeat(3, minmax(48px, 1fr));
    gap: 5px;
  }
  .duel-action-pad button,
  .duel-action-pad .control-light {
    min-width: 48px;
    min-height: 48px;
    height: 48px;
  }
  .duel-action-pad b {
    font-size: 16px;
  }
  .duel-practice-bar {
    padding: 12px;
  }
  .duel-training-goals {
    gap: 6px 10px;
    font-size: 11px;
  }
  .duel-practice-options {
    font-size: 12px;
    gap: 8px;
  }
  .duel-footer > span {
    display: none;
  }
}
@media (max-width: 700px) and (pointer: coarse),
  (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .duel-mobile-quick {
    position: sticky;
    bottom: 10px;
    z-index: 6;
    display: flex;
    width: 100%;
    min-height: 50px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: -8px 0 14px;
    padding: 10px 16px;
    border: 1px solid #ffe398;
    border-radius: 7px;
    background: #ffd369;
    box-shadow: 0 10px 24px #060d1c99;
    color: #18233a;
    font-weight: 900;
  }
  .duel-mobile-quick small {
    color: #4a3d2a;
    font-size: 10px;
    font-weight: 700;
  }
  .duel-action-pad :is(.control-exSkill, .control-exVariant, .control-max),
  .duel-advanced-pad {
    display: none;
  }
  .duel-mobile-more {
    display: block;
    padding: 10px 12px;
    border-top: 1px solid #405571;
    background: #152139;
    color: #c8d9f1;
  }
  .duel-mobile-more summary {
    cursor: pointer;
    font-size: 12px;
    font-weight: 800;
  }
  .duel-mobile-more > div {
    display: grid;
    grid-template-columns: repeat(3, minmax(44px, 1fr));
    gap: 6px;
    margin-top: 9px;
  }
  .duel-mobile-more button {
    min-height: 46px;
    border: 1px solid #6d83a2;
    border-radius: 5px;
    background: #253e60;
    color: #fff3bd;
  }
  .duel-mobile-more b,
  .duel-mobile-more small {
    display: block;
  }
  .duel-mobile-more small {
    color: #b9cce5;
  }
  .duel-directions {
    position: relative;
    display: block;
    width: 128px;
    height: 128px;
    border: 1px solid #58708c;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #40526b 0 25%, transparent 26%),
      radial-gradient(circle, #22324a 0 67%, #101a2b 68%);
    box-shadow:
      inset 0 0 0 7px #111c2d,
      inset 0 0 24px #8dbbff1a;
    touch-action: none;
  }
  .duel-directions button[class] {
    position: absolute;
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: transparent;
    font-size: 11px;
  }
  .duel-directions .control-jump {
    top: 4px;
    left: 42px;
  }
  .duel-directions .control-crouch {
    bottom: 4px;
    left: 42px;
  }
  .duel-directions .control-left {
    top: 42px;
    left: 4px;
  }
  .duel-directions .control-right {
    top: 42px;
    right: 4px;
  }
  .duel-directions button.held {
    background: transparent;
    box-shadow: none;
    transform: none;
  }
}
@media (max-width: 360px) {
  .duel-controls {
    gap: 8px;
    padding-inline: 8px;
  }
  .duel-card {
    grid-template-columns: 72px 1fr;
  }
  .duel-card-number {
    display: none;
  }
  .duel-intro h2 {
    font-size: 25px;
  }
}
.duel-versus-guide {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 18px;
  background: #213650;
  border-bottom: 1px solid #57779b;
  color: #ccddf3;
  font-size: 12px;
  line-height: 1.7;
}
.duel-combo-p2 {
  left: auto;
  right: 5%;
  text-align: right;
  color: #e1bfff;
}
.duel-versus-guide strong {
  color: #ffe2a0;
}
.duel-p2-pad {
  padding: 14px 18px;
  background: #25233b;
  border-top: 1px solid #746a92;
}
.duel-p2-pad summary {
  cursor: pointer;
  color: #dfd0ff;
  margin-bottom: 12px;
}
.duel-p2-controls {
  display: grid;
  grid-template-columns: repeat(7, minmax(48px, 1fr));
  gap: 6px;
}
.duel-p2-directions,
.duel-p2-actions {
  display: contents;
}
.duel-p2-pad button {
  min-height: 48px;
  min-width: 48px;
  background: #38364e;
  border: 1px solid #8675a8;
  border-radius: 6px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  touch-action: none;
}
.duel-p2-pad button.held {
  background: #685483;
  box-shadow: inset 0 0 0 2px #e3cfff;
}
.duel-p2-pad small {
  color: #d1bee9;
}
.duel-action-pad .control-meme {
  grid-column: 1/-1;
  flex-direction: row;
  gap: 10px;
  background: #4c3447;
  border-color: #bd809d;
}
.duel-mode-picker {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}
.duel-team-roster {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}
.duel-team-roster > div {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1;
  border: 1px solid #53677d;
  background: #182941;
  color: #aec3df;
  padding: 4px 5px;
  border-radius: 4px;
  font-size: clamp(8px, 1vw, 12px);
}
.duel-team-roster b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.duel-team-roster .active {
  color: #fff1a5;
  border-color: #f2d07f;
  background: #554524;
}
.duel-team-roster .eliminated {
  opacity: 0.45;
  text-decoration: line-through;
}
.duel-team-round {
  inset: 12% 6%;
  background: #111c31e8;
  padding: 12px;
}
.duel-team-round > strong {
  font-size: clamp(16px, 3vw, 30px);
  margin: 8px 0;
}
.duel-team-round .duel-team-transition {
  font-size: clamp(10px, 1.8vw, 17px);
  margin: 4px 0;
}
.duel-input-readout {
  padding: 10px 14px;
  background: #111c31;
  color: #d8e6fa;
  font-size: 12px;
}
.duel-input-readout > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  min-height: 30px;
}
.duel-input-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.duel-input-keys kbd {
  padding: 3px 5px;
  border: 1px solid #52627b;
  border-radius: 4px;
  font: inherit;
}
.duel-input-readout strong {
  color: #ffe18c;
}
.duel-input-readout em {
  color: #9be3d5;
  font-style: normal;
}
.duel-charge-status {
  padding: 3px 7px;
  border: 1px solid #546e93;
  border-radius: 4px;
  color: #bdd2ec;
}
.duel-charge-status.ready {
  color: #fff2ab;
  border-color: #efca6d;
  background: #574826;
}
.duel-motion-list {
  display: grid;
  gap: 8px;
}
@media (min-width: 1000px) {
  .duel-action-pad {
    grid-template-columns: repeat(8, 48px);
  }
  .duel-action-pad .control-meme {
    grid-column: auto;
    flex-direction: column;
    gap: 0;
  }
}
@media (max-width: 700px) {
  .duel-mode-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .duel-p2-controls {
    grid-template-columns: repeat(3, minmax(48px, 1fr));
  }
  .duel-p2-pad {
    padding: 12px;
  }
  .duel-versus-guide {
    font-size: 11px;
    padding: 12px;
  }
}
@media (max-width: 700px) and (pointer: coarse),
  (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .duel-p2-controls {
    display: grid;
    grid-template-columns: 128px minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }
  .duel-p2-directions {
    --stick-x: 0px;
    --stick-y: 0px;
    position: relative;
    display: block;
    width: 128px;
    height: 128px;
    border: 1px solid #8675a8;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #5a4f70 0 25%, transparent 26%),
      radial-gradient(circle, #302d48 0 67%, #19172a 68%);
    box-shadow:
      inset 0 0 0 7px #1d1b30,
      inset 0 0 24px #d2b9ff1a;
    touch-action: none;
  }
  .duel-p2-directions::after {
    position: absolute;
    top: 41px;
    left: 41px;
    z-index: 2;
    width: 46px;
    height: 46px;
    border: 1px solid #eadcff;
    border-radius: 50%;
    background: linear-gradient(145deg, #eadcff, #8a75a9);
    box-shadow:
      0 6px 14px #090613b8,
      inset 0 2px 4px #fff9;
    content: '';
    pointer-events: none;
    transform: translate(var(--stick-x), var(--stick-y));
    transition: transform 55ms linear;
  }
  .duel-p2-directions button {
    position: absolute;
    width: 44px;
    min-width: 44px;
    height: 44px;
    min-height: 44px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: transparent;
  }
  .duel-p2-directions .control-jump {
    top: 4px;
    left: 42px;
  }
  .duel-p2-directions .control-crouch {
    bottom: 4px;
    left: 42px;
  }
  .duel-p2-directions .control-left {
    top: 42px;
    left: 4px;
  }
  .duel-p2-directions .control-right {
    top: 42px;
    right: 4px;
  }
  .duel-p2-directions button.held {
    background: transparent;
    box-shadow: none;
    transform: none;
  }
  .duel-p2-actions {
    display: grid;
    grid-template-columns: repeat(3, minmax(44px, 1fr));
    gap: 5px;
  }
  .duel-p2-actions button {
    min-width: 44px;
    min-height: 44px;
  }
}
@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .duel:not([data-phase='select']) {
    height: calc(100svh - 52px);
    min-height: 0;
    overflow: hidden;
  }
  .duel:not([data-phase='select']) .duel-arena {
    width: 100%;
    height: 100%;
    margin: 0;
  }
  .duel:not([data-phase='select']) .duel-world {
    width: 100%;
    height: 100%;
  }
  .duel:not([data-phase='select']) .duel-controls {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: block;
    width: 100%;
    height: 100%;
    padding: 0;
    overflow: hidden;
    border-top: 0;
    background: transparent;
    pointer-events: none;
  }
  .duel:not([data-phase='select']) .duel-coach {
    display: none;
  }
  .duel:not([data-phase='select']) .duel-directions {
    position: absolute;
    bottom: max(12px, env(safe-area-inset-bottom));
    left: max(14px, env(safe-area-inset-left));
    width: 108px;
    height: 108px;
    background-color: #142039d9;
    pointer-events: auto;
  }
  .duel:not([data-phase='select']) .duel-directions::after {
    top: 31px;
    left: 31px;
  }
  .duel:not([data-phase='select']) .duel-directions .control-jump,
  .duel:not([data-phase='select']) .duel-directions .control-crouch {
    left: 32px;
  }
  .duel:not([data-phase='select']) .duel-directions .control-left,
  .duel:not([data-phase='select']) .duel-directions .control-right {
    top: 32px;
  }
  .duel:not([data-phase='select'])
    > :is(
      .duel-mobile-more,
      .duel-advanced-pad,
      .duel-footer,
      .duel-versus-guide,
      .duel-input-readout,
      .duel-practice-bar,
      .duel-campaign-strip
    ) {
    display: none;
  }
  .duel:not([data-phase='select']) .duel-action-pad {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(12px, env(safe-area-inset-bottom));
    width: 184px;
    padding: 6px;
    border: 1px solid #53647f;
    border-radius: 8px;
    background: #142039d9;
    grid-template-columns: repeat(3, minmax(44px, 1fr));
    gap: 4px;
    pointer-events: auto;
  }
  .duel:not([data-phase='select']) .duel-action-pad button,
  .duel:not([data-phase='select']) .duel-action-pad .control-light {
    min-width: 44px;
    min-height: 42px;
    height: 42px;
  }
}
@media (max-width: 600px) {
  .duel-roster {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .duel-card .duel-role {
    padding-left: 20px;
  }
}
</style>
