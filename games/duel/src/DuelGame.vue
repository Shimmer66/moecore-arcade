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
import {
  DUEL_ART,
  DUEL_MEME_ART,
  DUEL_SORE_LOSER_ART,
  DUEL_COMBAT_ART,
  DUEL_COMBAT_FX,
  DUEL_CROUCH_ART,
  DUEL_SWEEP_ART,
  DUEL_MOTION_ART,
} from '@moecore/assets/duel';
import { advance, createBattle, emptyInput, IDS, ROSTER } from './rules';
import { isCrouched } from './stance';
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

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const player = ref<FighterId>(props.attempt > 1 ? replaySelection.player : 'deepseek');
const opponent = ref<FighterId>(props.attempt > 1 ? replaySelection.opponent : 'gpt');
const mode = ref<GameMode>(props.attempt > 1 ? replaySelection.mode : 'quick');
const difficulty = ref<Difficulty>(props.attempt > 1 ? replaySelection.difficulty : 'normal');
const dummy = ref<DummyMode>('idle'),
  infiniteEnergy = ref(true);
const campaign = shallowRef<Campaign | null>(
  mode.value === 'arcade' ? createCampaign(player.value, difficulty.value, Date.now() >>> 0) : null,
);
const intermission = ref(false);
const modes: { id: GameMode; title: string; text: string }[] = [
  { id: 'quick', title: '快速对战', text: '选一个对手，三回合见真章。' },
  { id: 'arcade', title: '三站连战', text: '逐站换对手，胜利后选强化补丁。' },
  { id: 'practice', title: '练招房', text: '无限时间、可调木桩，练熟再上场。' },
  { id: 'versus', title: '双人对战', text: '同机双人 · 独立选角 · 共享键盘或触屏' },
];
const failedArt = ref(new Set<string>());
const warmedArt = new Map<string, HTMLImageElement>();
const artReady = ref(false);
let warmGeneration = 0;
watch(
  [player, opponent],
  async ([a, b]) => {
    const generation = ++warmGeneration;
    artReady.value = false;
    const urls = [
      ...new Set([
        ...Object.values(DUEL_COMBAT_ART[a]),
        ...Object.values(DUEL_COMBAT_ART[b]),
        ...Object.values(DUEL_COMBAT_FX),
        DUEL_CROUCH_ART,
        DUEL_SWEEP_ART,
        DUEL_MOTION_ART[a],
        DUEL_MOTION_ART[b],
      ]),
    ];
    for (const key of warmedArt.keys()) if (!urls.includes(key)) warmedArt.delete(key);
    const pending = urls.filter((url) => !warmedArt.has(url));
    await Promise.all(
      [0, 1, 2].map(async () => {
        while (generation === warmGeneration && pending.length) {
          const url = pending.shift()!;
          const img = new Image();
          warmedArt.set(url, img);
          img.src = url;
          try {
            await img.decode();
          } catch {
            if (warmedArt.get(url) === img) warmedArt.delete(url);
          }
        }
      }),
    );
    await Promise.all(
      urls.map((url) =>
        warmedArt
          .get(url)
          ?.decode()
          .catch(() => {}),
      ),
    );
    if (generation === warmGeneration) artReady.value = true;
  },
  { immediate: true },
);
function art(id: FighterId, kind: keyof typeof DUEL_ART.deepseek): string | undefined {
  const url = DUEL_ART[id][kind];
  return failedArt.value.has(url) ? undefined : url;
}
function artFailed(id: FighterId, kind: keyof typeof DUEL_ART.deepseek) {
  failedArt.value = new Set([...failedArt.value, DUEL_ART[id][kind]]);
}
function memeArtFailed(url: string) {
  failedArt.value = new Set([...failedArt.value, url]);
}
function soreArt(id: FighterId) {
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
  campaign.value
    ? campaignBattle(campaign.value)
    : createBattle(player.value, opponent.value, Date.now() >>> 0, {
        difficulty: difficulty.value,
        practice: mode.value === 'practice',
        infiniteEnergy: mode.value === 'practice',
        localVersus: mode.value === 'versus',
      }),
);
const stage = ref<HTMLElement>();
const help = ref(false);
const sound = ref(true),
  voice = ref(false),
  shake = ref(true),
  cutscene = ref(true);
const localVoice = shallowRef<SpeechSynthesisVoice>();
const effects = shallowRef<(BattleEvent & { life: number })[]>([]);
const reaction = shallowRef<{ id: FighterId; kind: 'good' | 'bad'; life: number } | null>(null);
const comboFlash = shallowRef({ hits: 0, damage: 0, life: 0 });
const comboFlash2 = shallowRef({ hits: 0, damage: 0, life: 0 });
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
};
const controls: { action: Control; label: string; key: string; title: string }[] = [
  { action: 'light', label: '打', key: 'J', title: '轻击' },
  { action: 'heavy', label: '重', key: 'K', title: '重击' },
  { action: 'guard', label: '挡', key: 'L', title: '防御' },
  { action: 'skill', label: '技', key: 'U', title: '特色技能' },
  { action: 'throw', label: '摔', key: 'O', title: '投技' },
  { action: 'super', label: '大招', key: 'I', title: '终结技' },
  { action: 'variant', label: '变', key: 'V', title: '变招' },
  { action: 'burst', label: '脱身', key: 'P', title: '清空上下文' },
  { action: 'dash', label: '闪', key: 'H', title: '冲刺' },
  { action: 'meme', label: '整活', key: 'F', title: '角色梗技能' },
  { action: 'kick', label: '踢', key: 'N', title: '腿法' },
];
const directions: { action: Control; label: string; title: string }[] = [
  { action: 'left', label: '←', title: '向左移动' },
  { action: 'jump', label: '跳 ↑', title: '跳跃' },
  { action: 'right', label: '→', title: '向右移动' },
  { action: 'crouch', label: '蹲 ↓', title: '蹲下' },
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
};
const signature = {
  deepseek: {
    name: '吃白饭的大肥鱼',
    tip: 'F 吃饭：起手可被打断，吃完回复40生命、20能量；冷却7秒。',
  },
  gpt: {
    name: '稳稳接住你',
    tip: 'F 张手接住近处下落的对手，接住后摔落；前8帧可用投技拆开，冷却7秒。',
  },
  doubao: {
    name: '唐包·答非所问',
    tip: 'F 发回旋气泡：打空会返回，也可能砸到自己。对手80伤害，自己50伤害；冷却7秒。',
  },
};
// Rules mutate the explicit battle. A new snapshot lets derived computed values observe each tick.
const self = computed(() => ({ ...battle.value.fighters[0] }));
const comboHint = computed(() => {
  const f = self.value,
    ago = battle.value.tick - f.contactTick;
  if (!f.contactHit || ago >= 10 || battle.value.phase !== 'fight') return '';
  if (['light1', 'light2'].includes(f.action)) return 'J 接拳 · 蹲 K 挑空 · H 追击（15能量）';
  if (f.action === 'air') return 'K 空中砸落';
  if (
    ['upper', 'heavy', 'variant'].includes(f.action) &&
    battle.value.fighters[1].action === 'launched'
  )
    return '跳跃追击 → J → K';
  if (f.id === 'gpt' && f.action === 'skill' && f.energy >= 100 && ago < 8)
    return 'I 命中确认接大招';
  return '';
});
const running = computed(
  () =>
    !props.paused &&
    !choosing.value &&
    !help.value &&
    !intermission.value &&
    battle.value.phase === 'fight',
);
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
]);
const remainingUpgrades = computed(() =>
  (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => !campaign.value?.perks.includes(id)),
);
const hasBubble = computed(() => battle.value.projectiles.some((p) => p.owner === 0));
const skillText = computed(() =>
  self.value.cooldown > 0
    ? `${(self.value.cooldown / 60).toFixed(1)}s`
    : hasBubble.value
      ? '在场'
      : '就绪',
);
const winnerText = computed(() =>
  battle.value.roundWinner === null
    ? '都别装了 · 平局'
    : mode.value === 'versus'
      ? `P${battle.value.roundWinner + 1} 拿下本回合！`
      : battle.value.roundWinner === 0
        ? '这回合，包的！'
        : '下一版会更好',
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
  });
}
function down(source: string, action: Control) {
  if (!running.value || sources.has(source)) return;
  sources.set(source, action);
  pressedControls.value = new Set(sources.values());
  if (
    [
      'light',
      'heavy',
      'skill',
      'variant',
      'burst',
      'super',
      'throw',
      'jump',
      'dash',
      'meme',
      'kick',
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
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // Synthetic or already-cancelled pointers can still supply a valid input.
  }
  down(`pointer:${e.pointerId}`, action);
}
function pointerUp(e: PointerEvent) {
  sources.delete(`pointer:${e.pointerId}`);
  pressedControls.value = new Set(sources.values());
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
  if (mode.value === 'versus' && secondKeyMap[e.code]) {
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
    commands,
    contexts: commandContexts,
  };
  commands = [];
  commandContexts = {};
  return input;
}
function downSecond(source: string, action: Control) {
  if (mode.value !== 'versus' || !running.value || sources2.has(source)) return;
  sources2.set(source, action);
  pressed2.value = new Set(sources2.values());
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
  if (
    !sound.value ||
    props.paused ||
    !audio ||
    audio.state !== 'running' ||
    props.settings.masterVolume <= 0
  )
    return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = event.kind === 'block' ? 'triangle' : 'square';
  const freq =
    event.kind === 'super'
      ? 440
      : event.kind === 'parry'
        ? 680
        : event.kind === 'block'
          ? 260
          : 120;
  oscillator.frequency.setValueAtTime(freq, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(45, audio.currentTime + 0.12);
  gain.gain.setValueAtTime(0.035 * props.settings.masterVolume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.13);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.14);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
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
        life: 60,
      };
    }
    if (mode.value === 'versus' && event.kind === 'hit' && event.actor === 0)
      comboFlash2.value = {
        hits: battle.value.fighters[0].combo,
        damage: battle.value.fighters[0].comboDamage,
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
  if (memeMoment.value) {
    memeMoment.value.age++;
    if (--memeMoment.value.life <= 0) memeMoment.value = null;
  }
}
async function start() {
  memeMoment.value = null;
  replaySelection.player = player.value;
  replaySelection.opponent = opponent.value;
  replaySelection.mode = mode.value;
  replaySelection.difficulty = difficulty.value;
  campaign.value =
    mode.value === 'arcade'
      ? createCampaign(player.value, difficulty.value, Date.now() >>> 0)
      : null;
  battle.value = campaign.value
    ? campaignBattle(campaign.value)
    : createBattle(player.value, opponent.value, Date.now() >>> 0, {
        difficulty: difficulty.value,
        practice: mode.value === 'practice',
        dummy: dummy.value,
        infiniteEnergy: mode.value === 'practice' && infiniteEnergy.value,
        localVersus: mode.value === 'versus',
      });
  intermission.value = false;
  reaction.value = null;
  reactionAt = -1000;
  comboFlash.value.life = 0;
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
  // Warm only the two selected ultimate images; portraits and reactions retain SVG fallback.
  for (const f of battle.value.fighters) {
    const image = new Image();
    image.src = DUEL_ART[f.id].ultimate;
    void image.decode().catch(() => {});
  }
}
function chooseUpgrade(id: UpgradeId) {
  if (props.paused || !campaign.value || !takeUpgrade(campaign.value, id)) return;
  battle.value = campaignBattle(campaign.value);
  memeMoment.value = null;
  triggerRef(campaign);
  intermission.value = false;
  effects.value = [];
  reaction.value = null;
  comboFlash.value.life = 0;
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
    counters: f.counters,
    variants: f.variants,
    variantHits: f.variantHits,
    supers: f.supers,
    bursts: f.bursts,
  });
  battle.value = next;
  memeMoment.value = null;
  effects.value = [];
  reaction.value = null;
  comboFlash.value.life = 0;
  quip.value = '';
  accumulator = 0;
  release();
  void nextTick(() => stage.value?.focus({ preventScroll: true }));
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
    summary: `已完成 ${trainingGoals.value.filter((g) => g.done).length}/4 项练习 · 最高 ${self.value.maxCombo} 连击`,
    story: { title: '练熟了，再出去整活。', body: ROSTER[player.value].name },
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
            ? '这局，真包了！'
            : b.outcome === 'draw'
              ? '都别装了，平局。'
              : '下一版会更好。',
      body:
        (campaign.value
          ? campaign.value.phase === 'complete'
            ? '三站打通，连自己的缓存分身也服了。'
            : `止步第 ${campaign.value.stage + 1} 站，补丁会在下次连战重新选择。`
          : `${ROSTER[player.value].name} VS ${ROSTER[opponent.value].name} · ${Math.round(b.elapsed / 60)} 秒有效战斗`) +
        (resultLoser ? ` · ${ROSTER[resultLoser].short}把牌翻成了“战略性休息”。` : ''),
      imageUrl:
        b.outcome === 'lose'
          ? (soreArt(player.value) ?? DUEL_ART[player.value].bad)
          : DUEL_ART[player.value][b.outcome === 'win' ? 'base' : 'bad'],
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
        before === 'fight' ? readInput() : emptyInput(),
        mode.value === 'versus' ? (before === 'fight' ? readSecond() : emptyInput()) : undefined,
      );
      react(battle.value.events);
      if (before !== next.phase) {
        release();
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
  warmGeneration++;
  warmedArt.clear();
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
    :data-art-ready="artReady"
    :data-station="campaign?.stage ?? 0"
  >
    <div v-if="mode === 'versus'" class="duel-versus-guide">
      <strong>同机双人 · P1 / P2</strong>
      <span
        >P1：WASD 移动 · J/K/L 拳/重/挡 · N 腿 · U 技 · I 大招 · O 摔 · V 变 · P 脱身 · H 闪 · F
        整活</span
      >
      <span
        >P2：方向键移动 · 数字 1/2/3 拳/重/挡 · 4 技 · 5 摔 · 6 大招 · 7 变 · 8 脱身 · 9 整活 · 0 闪
        · 句号 腿（主键盘与小键盘均可）</span
      >
    </div>
    <div v-if="choosing" class="duel-select">
      <div class="duel-intro">
        <div>
          <span class="duel-kicker">AI FIGHT CLUB / 模型擂台</span>
          <h2>拳头，<em>才是答案。</em></h2>
          <p>冲刺贴脸 · 挑空追击 · 大招收场</p>
        </div>
        <div class="duel-match-seal" aria-hidden="true">
          <span>THINK FAST</span><strong>VS</strong><span>HIT HARD</span>
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
      <div class="duel-section-label">
        <span>{{ mode === 'versus' ? '01 / P1 选择角色' : '01 / 选择你的角色' }}</span
        ><small>三种打法，各有绝活</small>
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
          <svg v-else viewBox="-100 -155 200 165" aria-hidden="true">
            <circle cx="0" cy="-58" r="68" fill="currentColor" opacity=".09" />
            <FighterSprite :id="id" />
          </svg>
          <strong>{{ ROSTER[id].name }}</strong
          ><span class="duel-card-tip">{{ ROSTER[id].keyTip }}</span
          ><span class="duel-picked">{{ player === id ? '✓ READY · 已选中' : '选择角色 ↗' }}</span>
        </button>
      </div>
      <div class="duel-loadout">
        <strong>F · {{ signature[player].name }}</strong
        ><span>{{ signature[player].tip }}</span> <strong>V · {{ ROSTER[player].variant }}</strong
        ><span>{{ ROSTER[player].variantTip }} 消耗 25 能量。</span
        ><small>P · 清空上下文：受击或格挡硬直中消耗 50 能量脱身，每回合一次。</small>
      </div>
      <div class="duel-launch">
        <span class="duel-setup-label">02 / 对局设置</span>
        <strong class="duel-matchup"
          >{{ ROSTER[player].short }} <i>VS</i>
          {{ mode === 'arcade' ? '三站挑战' : ROSTER[opponent].short }}</strong
        >
        <label v-if="mode !== 'arcade'"
          >{{ mode === 'versus' ? 'P2 角色' : '对手' }}
          <select v-model="opponent" aria-label="选择对手" @change="opponentChosen = true">
            <option v-for="id in IDS" :key="id" :value="id">{{ ROSTER[id].name }}</option>
          </select></label
        >
        <label v-if="mode !== 'versus'"
          >难度
          <select v-model="difficulty" aria-label="选择难度">
            <option v-for="(level, id) in DIFFICULTIES" :key="id" :value="id">
              {{ level.label }}
            </option>
          </select></label
        >
        <span>{{
          mode === 'versus'
            ? '同机双人 · P1 字母键 / P2 方向键＋数字键'
            : mode === 'quick'
              ? '75 秒 / 回合 · 最多三回合'
              : mode === 'arcade'
                ? '三站 · 每站 60 秒一回合 · 胜利选补丁，失败或平局结束'
                : '不限时 · 木桩被击倒会重新站起 · 可以随时结束'
        }}</span>
        <button class="duel-primary" type="button" @click="start">
          {{ mode === 'practice' ? '开始练招 →' : mode === 'arcade' ? '开始连战 →' : '开打 →' }}
        </button>
      </div>
    </div>
    <div
      v-else
      ref="stage"
      class="duel-arena"
      tabindex="0"
      aria-label="对战场地，方向键移动，空格二段跳，H 冲刺，J 轻击，K 重击，L 防御，U 技能，O 投技，I 大招"
    >
      <div class="duel-hud">
        <div
          v-for="f in battle.fighters"
          :key="f.slot"
          v-memo="[f.id, f.hp, Math.floor(f.energy), battle.scores[f.slot], failedArt, mode]"
          class="duel-health"
          :class="{ rival: f.slot === 1 }"
          :style="{ '--fighter': ROSTER[f.id].color }"
        >
          <img
            v-if="art(f.id, 'good')"
            class="duel-hud-avatar"
            :src="art(f.id, 'good')"
            alt=""
            @error="artFailed(f.id, 'good')"
          />
          <div class="duel-name">
            <strong>{{ ROSTER[f.id].short }}</strong
            ><span
              >{{ mode === 'versus' ? (f.slot ? 'P2' : 'P1') : f.slot ? 'CPU' : '你' }}
              <b v-for="n in 2" :key="n" :class="{ lit: battle.scores[f.slot] >= n }">●</b></span
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
            <i :style="{ width: `${f.hp / 10}%` }"></i>
          </div>
          <div class="duel-energy">
            <i :style="{ width: `${f.energy}%` }"></i
            ><span>{{ f.energy >= 100 ? '大招就绪' : `能量 ${Math.floor(f.energy)}` }}</span
            ><small>{{ f.hp }} / 1000</small>
          </div>
        </div>
        <div class="duel-clock">
          <strong>{{ mode === 'practice' ? '∞' : Math.ceil(battle.timer / 60) }}</strong
          ><span>{{
            mode === 'arcade'
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
            shake &&
            !settings.reduceMotion &&
            effects.some((e) => ['parry', 'launch'].includes(e.kind) && e.life > 17),
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
              推 演 对 决
            </text>
            <text text-anchor="middle" y="26" fill="#859cb7" font-size="11" letter-spacing="4">
              THINK FAST. HIT HARD.
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
          <FighterSprite
            v-if="!isBun(f.slot)"
            :id="f.id"
            :action="f.action"
            :crouched="isCrouched(f)"
            :grounded="f.y === 0"
            :stun="f.stun"
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
          :transform="`translate(${p.x},${450 - p.y})`"
        >
          <CombatEffect kind="bubble" :width="62" :height="62" :facing="p.direction" />
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
            v-else-if="['block', 'parry', 'burst'].includes(e.kind)"
            kind="guard_spark"
            :width="e.kind === 'burst' ? 150 : 86"
            :height="e.kind === 'burst' ? 150 : 86"
            :facing="battle.fighters[e.actor].facing"
          />
          <CombatEffect
            v-else
            kind="hit_heavy"
            :width="e.kind === 'launch' ? 115 : 88"
            :height="e.kind === 'launch' ? 115 : 88"
          />
        </g>
        <text x="480" y="517" text-anchor="middle" fill="#8f9fba" font-size="12" letter-spacing="3">
          服务器机房大舞台 · STANDARD MATCH
        </text>
      </svg>
      <div
        v-if="comboFlash.life > 0 && comboFlash.hits >= 2 && battle.phase === 'fight'"
        class="duel-combo"
        aria-live="off"
      >
        <strong>{{ comboFlash.hits }} 连击</strong><span>{{ comboFlash.damage }} 伤害</span>
      </div>
      <div
        v-if="
          mode === 'versus' &&
          comboFlash2.life > 0 &&
          comboFlash2.hits >= 2 &&
          battle.phase === 'fight'
        "
        class="duel-combo duel-combo-p2"
        aria-live="off"
      >
        <strong>P2 · {{ comboFlash2.hits }} 连击</strong><span>{{ comboFlash2.damage }} 伤害</span>
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
      <div v-if="battle.phase === 'countdown'" class="duel-center" role="status">
        <span>ROUND {{ battle.round }}</span
        ><strong>{{ miniCountdown }}</strong>
        <p>她准备好了。你呢？</p>
      </div>
      <div
        v-if="battle.phase === 'round-end'"
        class="duel-center duel-round"
        :class="{ 'has-loser': !!losingFighter }"
        role="status"
      >
        <span>{{ battle.roundWinner === null ? 'DOUBLE TAKE' : 'K.O.' }}</span
        ><strong>{{ mode === 'practice' ? '木桩重置，再来！' : winnerText }}</strong>
        <p>{{ battle.scores[0] }} : {{ battle.scores[1] }}</p>
        <div
          v-if="losingFighter"
          class="duel-round-vignette"
          data-testid="sore-loser"
          :data-loser="losingFighter.id"
        >
          <img
            v-if="soreArt(losingFighter.id)"
            :src="soreArt(losingFighter.id)"
            :alt="`${ROSTER[losingFighter.id].name}嘴硬结算`"
            @error="memeArtFailed(DUEL_SORE_LOSER_ART[losingFighter.id])"
          />
          <span class="duel-loser-placard" :class="{ flipped: battle.phaseFrames < 96 }">{{
            battle.phaseFrames < 96 ? '战略性休息' : '失败'
          }}</span>
        </div>
      </div>
      <div
        v-if="ultimate"
        class="duel-ultimate"
        :data-actor="ultimate.slot"
        :class="{ simple: !cutscene || settings.reduceMotion }"
        :style="{ '--fighter': ROSTER[ultimate.id].color }"
      >
        <span class="duel-kicker">ULTIMATE · 满能量出击</span>
        <div v-if="cutscene && !settings.reduceMotion" class="duel-ultimate-art">
          <img
            v-if="art(ultimate.id, 'ultimate')"
            :src="art(ultimate.id, 'ultimate')"
            :alt="ROSTER[ultimate.id].ultimate"
            @error="artFailed(ultimate.id, 'ultimate')"
          />
          <svg v-else viewBox="-175 -155 350 195" aria-hidden="true">
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
              :age="16"
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
        <h3>{{ ROSTER[ultimate.id].ultimate }}</h3>
        <p>
          {{
            ultimate.id === 'deepseek'
              ? '专家很多，上班俩。'
              : ultimate.id === 'gpt'
                ? '综上所述 · 已发送'
                : '没词了，动手吧。'
          }}
        </p>
      </div>
    </div>
    <div v-if="!choosing" class="duel-controls" aria-label="对战操作">
      <div class="duel-directions">
        <button
          v-for="c in directions"
          :key="c.action"
          type="button"
          :class="[`control-${c.action}`, { held: pressedControls.has(c.action) }]"
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
        <strong>{{ ROSTER[player].skill }}</strong
        ><span>{{ ROSTER[player].keyTip }}</span
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
                (c.action === 'super' && self.energy >= 100) || (c.action === 'burst' && canBurst),
              ready: c.action === 'variant' && self.variantCooldown === 0 && self.energy >= 25,
              held: pressedControls.has(c.action),
              'link-ready':
                c.action === 'dash' &&
                !!comboHint &&
                self.energy >= 15 &&
                ['light1', 'light2'].includes(self.action),
            },
          ]"
          :aria-label="c.title"
          :disabled="!running"
          :aria-description="
            c.action === 'skill'
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
            c.action === 'skill'
              ? skillText
              : c.action === 'super'
                ? `${Math.floor(self.energy)}%`
                : c.action === 'variant'
                  ? variantText
                  : c.action === 'burst'
                    ? self.burstUsed
                      ? '本回合已用'
                      : 'P · 50'
                    : c.action === 'dash' && comboHint && ['light1', 'light2'].includes(self.action)
                      ? 'H · 15'
                      : c.action === 'meme' && battle.rice?.holder === 0
                        ? '开吃'
                        : c.action === 'meme' && self.memeCooldown > 0
                          ? `${(self.memeCooldown / 60).toFixed(1)}s`
                          : c.key
          }}</small>
        </button>
      </div>
    </div>
    <details v-if="!choosing && mode === 'versus'" class="duel-p2-pad" open>
      <summary>P2 触屏 / 鼠标操作区</summary>
      <div>
        <button
          v-for="c in [...directions, ...controls]"
          :key="c.action"
          type="button"
          :aria-label="`P2 ${c.title}`"
          :class="{ held: pressed2.has(c.action) }"
          :disabled="!running"
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
            c.action === 'meme' && battle.rice?.holder === 1 ? '开吃' : secondLabels[c.action]
          }}</small>
        </button>
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
          <select v-model="dummy" aria-label="木桩行为">
            <option value="idle">站着挨打</option>
            <option value="guard">一直防御</option>
            <option value="fight">会还手</option>
            <option value="repeat-heavy">反复重击（练反击）</option>
          </select></label
        ><label><input v-model="infiniteEnergy" type="checkbox" />无限能量</label
        ><button type="button" @click="resetPractice">重置站位</button
        ><button type="button" @click="endPractice">结束练习</button>
      </div>
    </div>
    <div v-if="!choosing && campaign" class="duel-campaign-strip">
      <strong>{{ STATION_NAMES[campaign.stage] }}</strong
      ><span>{{
        campaign.stage === 2
          ? '缓存分身起始能量 25，带上你的补丁迎战。'
          : '赢下本场，选择一个补丁带入下一站。'
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
      aria-label="连战补丁选择"
    >
      <span class="duel-kicker">STATION CLEAR · {{ campaign.wins }} / 3</span>
      <h3>这站包了。<br />给下一站装个补丁。</h3>
      <p>
        下站：{{
          ROSTER[campaign.opponents[campaign.stage + 1]!].name
        }}。生命回满，已选补丁继续生效。
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
          ><label><input v-model="voice" type="checkbox" :disabled="!localVoice" />本地语音</label
          ><label><input v-model="shake" type="checkbox" />镜头震动</label
          ><label><input v-model="cutscene" type="checkbox" />大招特写</label
          ><small v-if="!localVoice">当前设备没有本地中文语音，台词以字幕显示。</small>
        </div>
      </details>
      <span>AI FIGHT CLUB · 拳头才是答案</span>
    </div>
    <div v-if="help" class="duel-help" role="region" aria-label="操作说明">
      <h3>会这三件事，就能开打。</h3>
      <p>
        <strong>N / P2 句号：独立腿法</strong
        >站立按腿是前踢，蹲下按腿是扫堂腿，空中按腿是飞踢。蹲＋J 是低位拳，蹲＋K
        是挑空；蹲防保持低姿态。
      </p>
      <p>
        <strong>双人互坑：抢饭、退件、接住过载</strong
        >贴近持碗者按投技抢饭，拿到后按整活吃掉；原主人打中持碗者即可夺回。重击生效时能把气泡打回去，双方可继续反弹。GPT
        接人时再碰上气泡，或接到带饭碗的人，会过载一起摔落；未结算的接人伤害取消。
      </p>
      <p>
        <strong>F 整活：{{ signature[player].name }}</strong
        >{{ signature[player].tip }} 双人模式 P2 用数字9整活。整活期间有破绽，可以被打断。
      </p>
      <p>
        <strong>连招更好接</strong>按键预输入保留 10
        帧，按下时的蹲姿和方向会一起保留。前两段轻击命中后按 H，可花 15
        能量取消收招并冲刺追击；打空和被挡不能这样取消。GPT 技能第一段命中后可接 I
        大招。普通冲刺仍不花能量。
      </p>
      <p>
        <strong>高速追击：H 冲刺 / 二段跳</strong>按方向＋H
        突进，空中每次起跳可冲刺一次；冲刺途中可接拳脚。跳起后再按跳可二段跳。蹲＋K
        挑空，命中后立即按跳追上去，空中 J 接 K 把对手砸下。浮空时可用 P 脱身。
      </p>
      <p>
        <strong>多一层选择：V 变招 / P 脱身</strong>{{ ROSTER[player].variant }}：{{
          ROSTER[player].variantTip
        }}
        消耗 25 能量、冷却 5 秒。受击或格挡硬直中按 P 清空上下文，消耗 50
        能量，每回合限一次；被投技抓住或大招特写期间不能使用。
      </p>
      <div>
        <p><strong>① 连点「打」</strong>三段连击。打中后接技能，打空要等收招。</p>
        <p><strong>② 按住「挡」</strong>挡住正面攻击；对手一直挡，就走近按「摔」。</p>
        <p><strong>③ 看准再放大招</strong>能量满后按 I / 大招。打空也会消耗能量！</p>
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
  height: 18px;
  border: 2px solid #899bb3;
  background: #452b3e;
  transform: skewX(-10deg);
  overflow: hidden;
}
.duel-health-track i {
  display: block;
  height: 100%;
  background: linear-gradient(0deg, var(--fighter) 0 65%, #ffffffc9 66% 100%);
}
.rival .duel-health-track {
  transform: skewX(10deg);
}
.rival .duel-health-track i {
  margin-left: auto;
}
.duel-energy {
  margin-top: 5px;
  height: 14px;
  background: #101627;
  position: relative;
  overflow: hidden;
}
.duel-energy i {
  display: block;
  height: 100%;
  background: #5263a3;
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
.duel-action-pad .link-ready {
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
.impact {
  transform: translateX(2px);
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
.duel-loadout {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 14px;
  margin: 14px 0;
  padding-left: 12px;
  border-left: 3px solid #ffd369;
  color: #c1d2e8;
  font-size: 13px;
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
    font-size: 11px;
    margin-top: 8px;
  }
  .duel-intro .duel-kicker {
    font-size: 9px;
    letter-spacing: 1px;
  }
  .duel-match-seal {
    padding: 0 8px;
  }
  .duel-match-seal strong {
    font-size: 48px;
  }
  .duel-match-seal span {
    font-size: 7px;
    letter-spacing: 1px;
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
  .duel-picked {
    font-size: 10px;
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
    grid-template-columns: 100px 1fr;
    padding: 12px 10px;
    gap: 14px;
  }
  .duel-directions {
    grid-template-columns: repeat(2, 48px);
    gap: 4px;
    width: auto;
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
.duel-p2-pad > div {
  display: grid;
  grid-template-columns: repeat(7, minmax(48px, 1fr));
  gap: 6px;
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
@media (min-width: 1000px) {
  .duel-action-pad {
    grid-template-columns: repeat(11, 48px);
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
  .duel-p2-pad > div {
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
</style>
