<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import DepthBattle from './DepthBattle.vue';
import ActorSprite from './ActorSprite.vue';
import ItemArt from './ItemArt.vue';
import FireballSprite from './FireballSprite.vue';
import { effectTones, musicBpm, musicTones, type ToneSpec } from './sound';
import { impactFeedback } from './presentation';
import { platformsAt } from './levels';
import { lastDeployment, rememberDeployment } from './deployment';
import {
  advanceLevel,
  attackTarget,
  bossAttack,
  bossIsOpen,
  bossPhase,
  bossProtected,
  bossVulnerable,
  createRun,
  FIXED_DT,
  hazardState,
  levels,
  maxHealth,
  personas,
  retryLevel,
  shareLife,
  stepRun,
  teamPlayers,
  weapons,
  weaponOrder,
  canCollect,
  buffs,
  difficultyNames,
  initialContinues,
  type Difficulty,
  type Persona,
  type RunInput,
  type RunState,
  type Weapon,
} from './rules';
const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const state = shallowRef(createRun());
const selected = ref<Persona | null>(null);
const difficulty = ref<Difficulty>('normal');
const coop = ref(false);
const partnerPersona = ref<Persona>('gpt');
const practice = ref(false);
const practiceStage = ref(0);
const practiceFrom = ref<'boss' | 'entry'>('boss');
const practiceWeapon = ref<Weapon>('spread');
const sound = ref(true);
const musicVolume = ref(0.55);
const effectsVolume = ref(1);
const stage = ref<HTMLElement>();
const dialog = ref<HTMLElement>();
const measuredWidth = ref(960);
const width = computed(() => Math.min(measuredWidth.value, level.value.length * 40));
const held = new Set<string>();
interface PointerBinding {
  actions: string[];
  playerId: 1 | 2;
  kind: 'dpad' | 'action';
}
const pointers = new Map<number, PointerBinding>();
const queued = new Set<string>();
const equipped = new Map<1 | 2, Weapon>();
const gamepadHeld = new Set<string>();
const gamepadButtons = new Map<string, boolean>();
let frame = 0,
  previous = 0,
  accumulator = 0;
let audio: AudioContext | undefined;
const voices = new Set<OscillatorNode>();
const audioVoices = ref(0),
  musicMarker = ref('');
let musicKey = '',
  musicBeat = -1;
let resize: ResizeObserver | undefined;
let resizeFrame = 0;
let announced = false;
const level = computed(() => levels[state.value.levelIndex]!);
const surfaces = computed(() => platformsAt(level.value, state.value.stageTime));
const sector = computed(() => level.value.sectors[Math.max(0, state.value.sector)]);
const players = computed(() => teamPlayers(state.value));
const livePlayers = computed(() => players.value.filter((p) => p.lives > 0));
const teamCenter = computed(() => {
  const team = livePlayers.value.length ? livePlayers.value : [state.value];
  return {
    x: team.reduce((sum, p) => sum + p.x, 0) / team.length,
    y: team.reduce((sum, p) => sum + p.y, 0) / team.length,
  };
});
const camera = computed(() =>
  Math.max(
    0,
    Math.min(
      level.value.length * 40 - width.value,
      teamCenter.value.x * 40 -
        width.value * (state.value.partner ? 0.45 : state.value.arena ? 0.23 : 0.32),
    ),
  ),
);
const cameraY = computed(() =>
  level.value.axis === 'vertical'
    ? (state.value.arena
        ? level.value.arenaY
        : Math.max(0, Math.min(level.value.arenaY, teamCenter.value.y - 3))) * 40
    : 0,
);
const visible = (x: number, margin = 3) =>
  x * 40 > camera.value - margin * 40 && x * 40 < camera.value + width.value + margin * 40;
const visibleY = (y: number) =>
  350 - y * 40 + cameraY.value > -160 && 350 - y * 40 + cameraY.value < 580;
const visiblePoint = (x: number, y: number, margin = 3) => visible(x, margin) && visibleY(y);
const renderedBullets = computed(() =>
  state.value.bullets.filter((b) => visiblePoint(b.x, b.y, b.weapon === 'laser' ? 8 : 3)),
);
const renderedEnemyBullets = computed(() =>
  state.value.enemyBullets.filter((b) => visiblePoint(b.x, b.y, 3)),
);
const renderedThrown = computed(() => state.value.thrown.filter((g) => visiblePoint(g.x, g.y, 4)));
const renderedEffects = computed(() =>
  state.value.effects.filter((e) => visiblePoint(e.x, e.y, 4)),
);
const feedback = computed(() =>
  impactFeedback(state.value.elapsed, state.value.effects, props.settings.reduceMotion),
);
const enemies = computed(() =>
  state.value.enemies.filter((e) => e.hp > 0 && visible(e.x) && visibleY(e.y)),
);
const boss = computed(() => state.value.enemies.find((e) => e.kind === 'boss'));
const bossWarning = computed(() =>
  !state.value.base && boss.value && state.value.arena && boss.value.cooldown < 0.7
    ? bossAttack(state.value, boss.value)
    : null,
);
const bossViewBox = computed(() => {
  const size = REWRITE_ART.bossAtlas.width / 4;
  return `${(state.value.levelIndex % 4) * size} ${Math.floor(state.value.levelIndex / 4) * size} ${size} ${size}`;
});
const weapon = computed(() => weapons[state.value.weapon]);
const progress = computed(() =>
  state.value.base
    ? Math.floor((state.value.base.room / state.value.base.roomCount) * 100)
    : Math.min(
        100,
        Math.floor(
          (level.value.axis === 'vertical'
            ? teamCenter.value.y / level.value.arenaY
            : teamCenter.value.x / level.value.length) * 100,
        ),
      ),
);
const personaIds: Persona[] = ['deepseek', 'gpt', 'claude'];
const sideDpad = [
  { label: '左上瞄准', icon: '↖', actions: ['left', 'up'] },
  { label: '向上瞄准', icon: '↑', actions: ['up'] },
  { label: '右上瞄准', icon: '↗', actions: ['right', 'up'] },
  { label: '向左移动', icon: '←', actions: ['left'] },
  { label: '定点瞄准', icon: '◎', actions: ['lock'] },
  { label: '向右移动', icon: '→', actions: ['right'] },
  { label: '左下瞄准', icon: '↙', actions: ['left', 'down'] },
  { label: '卧倒', icon: '↓', actions: ['down'] },
  { label: '右下瞄准', icon: '↘', actions: ['right', 'down'] },
];
const depthDpad = [
  { label: '左前推进', icon: '↖', actions: ['left', 'up'] },
  { label: '向前推进', icon: '↑', actions: ['up'] },
  { label: '右前推进', icon: '↗', actions: ['right', 'up'] },
  { label: '向左横移', icon: '←', actions: ['left'] },
  { label: '定点开火', icon: '◎', actions: ['shoot'] },
  { label: '向右横移', icon: '→', actions: ['right'] },
  { label: '向左开火', icon: '↙', actions: ['left', 'shoot'] },
  { label: '卧倒', icon: '↓', actions: ['down'] },
  { label: '向右开火', icon: '↘', actions: ['right', 'shoot'] },
];
const dpad = computed(() => (state.value.base ? depthDpad : sideDpad));
const actionName = (action: string, playerId: 1 | 2) => (playerId === 1 ? action : `p2:${action}`);
const controlLabel = (action: string, playerId: 1 | 2) =>
  state.value.partner ? `P${playerId} ${action}` : action;
function has(action: string, playerId: 1 | 2 = 1): boolean {
  const name = actionName(action, playerId);
  return (
    held.has(name) ||
    gamepadHeld.has(name) ||
    [...pointers.values()].some((binding) => binding.actions.includes(name))
  );
}
function release() {
  held.clear();
  gamepadHeld.clear();
  pointers.clear();
  queued.clear();
  equipped.clear();
  accumulator = 0;
}
function pollGamepads(active: boolean) {
  const pads = navigator.getGamepads?.() ?? [];
  const nextHeld = new Set<string>();
  for (const playerId of [1, 2] as const) {
    const pad = pads[playerId - 1];
    const prefix = `p${playerId}:`;
    const button = (index: number) => !!pad?.buttons[index]?.pressed;
    const horizontal = !pad
      ? 0
      : button(14)
        ? -1
        : button(15)
          ? 1
          : Math.abs(pad.axes[0] ?? 0) >= 0.35
            ? Math.sign(pad.axes[0] ?? 0)
            : 0;
    const vertical = !pad
      ? 0
      : button(12)
        ? 1
        : button(13)
          ? -1
          : Math.abs(pad.axes[1] ?? 0) >= 0.35
            ? -Math.sign(pad.axes[1] ?? 0)
            : 0;
    if (active && horizontal < 0) nextHeld.add(actionName('left', playerId));
    if (active && horizontal > 0) nextHeld.add(actionName('right', playerId));
    if (active && vertical > 0) nextHeld.add(actionName('up', playerId));
    if (active && vertical < 0) nextHeld.add(actionName('down', playerId));
    if (active && button(2)) nextHeld.add(actionName('shoot', playerId));
    if (active && button(5)) nextHeld.add(actionName('lock', playerId));
    for (const [index, action] of [
      [0, 'jump'],
      [1, 'grenade'],
    ] as const) {
      const pressed = button(index),
        key = `${prefix}${index}`;
      if (active && pressed && !gamepadButtons.get(key)) queued.add(actionName(action, playerId));
      gamepadButtons.set(key, pressed);
    }
  }
  gamepadHeld.clear();
  nextHeld.forEach((action) => gamepadHeld.add(action));
}
function press(
  event: PointerEvent,
  actions: string[],
  playerId: 1 | 2 = 1,
  kind: PointerBinding['kind'] = 'dpad',
) {
  if (props.paused || !selected.value || state.value.phase !== 'running') return;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, {
    actions: actions.map((a) => actionName(a, playerId)),
    playerId,
    kind,
  });
  for (const action of actions)
    if (['jump', 'grenade', 'shoot'].includes(action)) queued.add(actionName(action, playerId));
}
function movePointer(event: PointerEvent) {
  const binding = pointers.get(event.pointerId);
  if (!binding || binding.kind !== 'dpad') return;
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLButtonElement>('button[data-control-kind="dpad"]');
  if (!target || target.disabled || target.dataset.controlPlayer !== String(binding.playerId)) {
    pointers.delete(event.pointerId);
    return;
  }
  const actions = target.dataset.controlActions?.split(',').filter(Boolean) ?? [];
  binding.actions = actions.map((action) => actionName(action, binding.playerId));
}
function pointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId);
}
function accessibleAction(event: MouseEvent, action: string, playerId: 1 | 2 = 1) {
  if (event.detail !== 0 || props.paused) return;
  queued.add(actionName(action, playerId));
}
const keys: Record<string, string> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyJ: 'shoot',
  KeyK: 'jump',
  Space: 'jump',
  KeyL: 'grenade',
  ShiftLeft: 'lock',
  ShiftRight: 'lock',
  KeyQ: 'previousWeapon',
  KeyE: 'nextWeapon',
};
function keyAction(code: string) {
  const direct = /^Digit([1-6])$/.exec(code);
  if (direct) return `equip:${weaponOrder[Number(direct[1]) - 1]}`;
  if (state.value.partner) {
    if (code === 'BracketLeft') return 'p2:previousWeapon';
    if (code === 'BracketRight') return 'p2:nextWeapon';
    const second = /^Numpad([4-9])$/.exec(code);
    if (second) return `p2:equip:${weaponOrder[Number(second[1]) - 4]}`;
  }
  if (state.value.partner) {
    const p2: Record<string, string> = {
      Comma: 'shoot',
      Period: 'jump',
      Slash: 'grenade',
      Numpad1: 'shoot',
      Numpad2: 'jump',
      Numpad3: 'grenade',
      Numpad0: 'lock',
    };
    if (p2[code]) return actionName(p2[code], 2);
    if (code.startsWith('Arrow') || code === 'ShiftRight')
      return keys[code] ? actionName(keys[code], 2) : undefined;
  }
  return keys[code];
}
function keydown(event: KeyboardEvent) {
  const action = keyAction(event.code);
  if (
    !action ||
    !selected.value ||
    props.paused ||
    state.value.phase !== 'running' ||
    (event.target instanceof HTMLElement && /BUTTON|INPUT|SELECT/.test(event.target.tagName))
  )
    return;
  event.preventDefault();
  held.add(action);
  if (!event.repeat || action.endsWith('shoot')) queued.add(action);
}
function keyup(event: KeyboardEvent) {
  const action = keyAction(event.code);
  if (action) held.delete(action);
}
function visibility() {
  if (document.hidden) {
    release();
    silenceAudio();
  }
  previous = 0;
}
function wakeAudio() {
  if (!sound.value || !props.settings.masterVolume || props.paused) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    /* Sound is optional. */
  }
}
function silenceAudio() {
  for (const voice of voices)
    try {
      voice.stop();
    } catch {
      /* The voice may already have ended. */
    }
  voices.clear();
  audioVoices.value = 0;
  musicMarker.value = '';
  musicKey = '';
  musicBeat = -1;
}
function emitTone(spec: ToneSpec, channel: 'music' | 'effects') {
  wakeAudio();
  const channelVolume = channel === 'music' ? musicVolume.value : effectsVolume.value;
  if (!channelVolume || !audio || audio.state === 'closed' || voices.size >= 24) return;
  try {
    const osc = audio.createOscillator(),
      gain = audio.createGain(),
      start = audio.currentTime + (spec.delay ?? 0),
      end = start + spec.duration;
    osc.type = spec.type;
    osc.frequency.setValueAtTime(spec.start, start);
    osc.frequency.exponentialRampToValueAtTime(spec.end, end);
    gain.gain.setValueAtTime(
      Math.max(0.001, spec.volume * channelVolume * props.settings.masterVolume),
      start,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(audio.destination);
    voices.add(osc);
    audioVoices.value = voices.size;
    osc.onended = () => {
      voices.delete(osc);
      audioVoices.value = voices.size;
    };
    osc.start(start);
    osc.stop(end);
  } catch {
    /* Sound is optional. */
  }
}
function play(
  kind: 'shoot' | 'jump' | 'hit' | 'boom' | 'pickup' | 'clear',
  weapon: Weapon = 'pulse',
) {
  if (!sound.value || !props.settings.masterVolume || props.paused) return;
  effectTones(kind, weapon).forEach((tone) => emitTone(tone, 'effects'));
}
function playMusic(run: RunState) {
  if (!sound.value || !props.settings.masterVolume || props.paused || run.phase !== 'running')
    return;
  const room = run.base?.room ?? 0,
    key = `${run.levelIndex}:${room}:${run.arena}`,
    beat = Math.floor((run.stageTime * musicBpm(run.levelIndex, run.arena)) / 60);
  if (key === musicKey && beat === musicBeat) return;
  musicKey = key;
  musicBeat = beat;
  musicMarker.value = `${key}:${beat}`;
  musicTones(run.levelIndex, beat, run.arena, room).forEach((tone) => emitTone(tone, 'music'));
}
async function focusStage() {
  await nextTick();
  stage.value?.focus({ preventScroll: true });
}
function select(persona: Persona) {
  wakeAudio();
  silenceAudio();
  selected.value = persona;
  const run = createRun(
    persona,
    practice.value ? practiceStage.value : 0,
    difficulty.value,
    coop.value ? partnerPersona.value : undefined,
    practice.value && practiceFrom.value === 'boss',
  );
  if (practice.value) {
    const mission = levels[practiceStage.value]!;
    if (practiceFrom.value === 'boss') {
      for (const p of teamPlayers(run)) {
        p.x = mission.length - 20 + (p.playerId - 1) * 1.2;
        p.y = mission.arenaY;
        p.checkpoint = p.x;
        p.checkpointY = p.y;
      }
      run.arena = true;
      run.enemies = run.enemies.filter((e) => e.kind === 'boss' || e.kind === 'heart');
    }
    for (const p of teamPlayers(run)) {
      p.weapon = practiceWeapon.value;
      p.arsenal = [...weaponOrder];
    }
    run.notice = '独立演练 · 伤害与实战相同，不计入战役通关';
  }
  state.value = run;
  saveDeployment();
  release();
  previous = 0;
  announced = false;
  void focusStage();
}
function nextLevel() {
  state.value = advanceLevel(state.value);
  release();
  play('clear');
  void focusStage();
}
function retry() {
  state.value = retryLevel(state.value);
  release();
  void focusStage();
}
function revive(playerId: 1 | 2) {
  state.value = shareLife(state.value, playerId);
  void focusStage();
}
function reselect() {
  saveDeployment(false);
  selected.value = null;
  state.value = createRun();
  release();
  announced = false;
}
function saveDeployment(active = true) {
  const persona = selected.value ?? lastDeployment()?.persona;
  if (!persona) return;
  rememberDeployment({
    persona,
    difficulty: difficulty.value,
    coop: coop.value,
    partnerPersona: partnerPersona.value,
    practice: practice.value,
    practiceStage: practiceStage.value,
    practiceFrom: practiceFrom.value,
    practiceWeapon: practiceWeapon.value,
    sound: sound.value,
    musicVolume: musicVolume.value,
    effectsVolume: effectsVolume.value,
    attempt: props.attempt,
    active,
  });
}
function equip(playerId: 1 | 2, selectedWeapon: Weapon) {
  if (props.paused || state.value.phase !== 'running') return;
  equipped.set(playerId, selectedWeapon);
  void focusStage();
}
function cycleControl(playerId: 1 | 2) {
  if (props.paused || state.value.phase !== 'running') return;
  queued.add(actionName('nextWeapon', playerId));
  void focusStage();
}
function supplyLabel(kind: string) {
  if (kind in buffs) return buffs[kind as keyof typeof buffs].name;
  return kind === 'shield'
    ? '护'
    : kind === 'health'
      ? '+'
      : kind === 'grenade'
        ? 'G'
        : weapons[kind as Weapon].letter;
}
function supplyColor(kind: string) {
  if (kind in buffs) return buffs[kind as keyof typeof buffs].color;
  return kind in weapons ? weapons[kind as Weapon].color : '#9df6ce';
}
function readInput(playerId: 1 | 2): RunInput {
  return {
    horizontal:
      has('left', playerId) === has('right', playerId) ? 0 : has('left', playerId) ? -1 : 1,
    vertical: has('up', playerId) === has('down', playerId) ? 0 : has('up', playerId) ? 1 : -1,
    jump: queued.has(actionName('jump', playerId)),
    shoot: has('shoot', playerId) || queued.has(actionName('shoot', playerId)),
    grenade: queued.has(actionName('grenade', playerId)),
    lockAim: has('lock', playerId),
    equipWeapon:
      equipped.get(playerId) ??
      weaponOrder.find((w) => queued.has(actionName(`equip:${w}`, playerId))),
    cycleWeapon: queued.has(actionName('nextWeapon', playerId))
      ? 1
      : queued.has(actionName('previousWeapon', playerId))
        ? -1
        : undefined,
  };
}
function loop(now: number) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
  previous = now;
  const active =
    !props.paused && !document.hidden && !!selected.value && state.value.phase === 'running';
  pollGamepads(active);
  if (active) {
    accumulator += dt;
    while (accumulator >= FIXED_DT && state.value.phase === 'running') {
      const before = state.value;
      const next = stepRun(before, readInput(1), FIXED_DT, readInput(2));
      for (const [i, p] of teamPlayers(next).entries()) {
        const old = teamPlayers(before)[i]!;
        if (p.shotCooldown > old.shotCooldown) play('shoot', p.weapon);
        if (p.vy > old.vy + 5) play('jump');
        if (p.health < old.health || p.lives < old.lives || p.shield < old.shield) play('hit');
        if (
          p.arsenal.length > old.arsenal.length ||
          p.shield > old.shield ||
          p.grenades > old.grenades ||
          p.health > old.health ||
          p.overclock > old.overclock ||
          p.barrier > old.barrier
        )
          play('pickup');
      }
      if (next.kills > before.kills) play('boom');
      if (
        next.carriers.filter((c) => c.hp <= 0).length >
        before.carriers.filter((c) => c.hp <= 0).length
      )
        play('boom');
      if (next.base && before.base && next.base.room !== before.base.room) play('clear');
      playMusic(next);
      state.value = next;
      queued.clear();
      equipped.clear();
      accumulator -= FIXED_DT;
    }
  } else accumulator = 0;
  frame = requestAnimationFrame(loop);
}
watch(
  () => props.paused,
  (paused) => {
    release();
    if (paused) silenceAudio();
    previous = 0;
    if (!paused && selected.value && state.value.phase === 'running') void focusStage();
  },
);
watch(
  () => props.attempt,
  () => {
    const persona = selected.value;
    if (props.restartMode === 'select' || !persona) reselect();
    else select(persona);
  },
);
watch(
  () => state.value.phase,
  async (phase) => {
    if (phase !== 'running') {
      release();
      silenceAudio();
      await nextTick();
      dialog.value?.querySelector('button')?.focus();
    }
    if (phase !== 'won' || announced || practice.value) return;
    announced = true;
    play('clear');
    emit('finish', {
      gameId: 'rewrite',
      sessionId: props.sessionId,
      outcome: 'win',
      durationMs: Math.round(state.value.elapsed * 1000),
      summary: `八关通关 · ${state.value.partner ? '双人协作' : '单人'} · ${difficultyNames[state.value.difficulty]} · ${state.value.score.toLocaleString()} 分`,
      stats: {
        score: state.value.score,
        defeated: state.value.kills,
        levelsCompleted: 8,
        players: state.value.partner ? 2 : 1,
        deaths: state.value.deaths,
        continues: initialContinues(state.value.difficulty) - state.value.continues,
      },
      story: {
        title: '最终生成：一个真实的结局',
        body: '你拆掉了限流闸门，核验了虚假引用，也让幻觉之母停止了胡说八道。答案不在云端，就在你刚刚走过的路上。',
      },
      reselectLabel: '重新选角',
    });
  },
);
onMounted(() => {
  const saved = lastDeployment();
  if (saved && props.attempt > saved.attempt) {
    difficulty.value = saved.difficulty;
    coop.value = saved.coop;
    partnerPersona.value = saved.partnerPersona;
    practice.value = saved.practice;
    practiceStage.value = saved.practiceStage;
    practiceFrom.value = saved.practiceFrom;
    practiceWeapon.value = saved.practiceWeapon;
    sound.value = saved.sound;
    musicVolume.value = saved.musicVolume ?? 0.55;
    effectsVolume.value = saved.effectsVolume ?? 1;
    if (saved.active && props.restartMode === 'replay') select(saved.persona);
    else rememberDeployment({ ...saved, attempt: props.attempt, active: false });
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', release);
  document.addEventListener('visibilitychange', visibility);
  resize = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect.width ?? 960;
    const nextWidth = Math.max(520, Math.min(1100, w));
    if (nextWidth === measuredWidth.value) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      measuredWidth.value = nextWidth;
    });
  });
  if (stage.value) resize.observe(stage.value);
  frame = requestAnimationFrame(loop);
});
watch(sound, (enabled) => {
  if (!enabled) silenceAudio();
  else {
    musicKey = '';
    musicBeat = -1;
    wakeAudio();
  }
  if (selected.value) saveDeployment();
});
watch([musicVolume, effectsVolume], () => {
  silenceAudio();
  if (sound.value) wakeAudio();
  if (selected.value) saveDeployment();
});
onUnmounted(() => {
  cancelAnimationFrame(frame);
  resize?.disconnect();
  cancelAnimationFrame(resizeFrame);
  silenceAudio();
  void audio?.close();
  window.removeEventListener('keydown', keydown);
  window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', release);
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <section
    class="rewrite-game"
    aria-label="AI 娘闯关游戏"
    :style="{ '--mission': level.color }"
    :data-audio-voices="audioVoices"
    :data-music-beat="musicMarker"
    :data-music-volume="musicVolume"
    :data-effects-volume="effectsVolume"
  >
    <header class="rewrite-heading">
      <div>
        <span class="rewrite-eyebrow">NEURAL FRONT / RUN & GUN</span>
        <h2>AI 娘闯关 <span>模型战争</span></h2>
      </div>
      <div class="rewrite-sound-controls">
        <button class="rewrite-sound" :aria-pressed="sound" @click="sound = !sound">
          声音 {{ sound ? '开' : '关' }}
        </button>
        <label>
          音乐
          <input
            v-model.number="musicVolume"
            aria-label="音乐音量"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :disabled="!sound"
          />
        </label>
        <label>
          效果
          <input
            v-model.number="effectsVolume"
            aria-label="效果音量"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :disabled="!sound"
          />
        </label>
      </div>
    </header>
    <div v-if="selected && !state.partner" class="rewrite-hud">
      <div>
        <small>OPERATOR</small><strong>{{ selected ? personas[selected].name : '等待部署' }}</strong
        ><span class="rewrite-hearts" aria-label="生命"
          >{{ '♥'.repeat(Math.max(0, state.health))
          }}<i>{{ '♡'.repeat(Math.max(0, maxHealth(state.difficulty) - state.health)) }}</i></span
        >
      </div>
      <div>
        <small>LOADOUT</small
        ><strong :style="{ color: weapon.color }">{{ weapon.letter }} / {{ weapon.name }}</strong
        ><span>武器独立收纳 · 无限弹药</span>
      </div>
      <div>
        <small>SCORE</small
        ><strong class="rewrite-score">{{ String(state.score).padStart(7, '0') }}</strong
        ><span>剩余 {{ state.lives }} 命 · {{ difficultyNames[state.difficulty] }}</span>
      </div>
    </div>
    <div v-else-if="selected && state.partner" class="rewrite-team-hud">
      <div v-for="p in players" :key="p.playerId" :class="{ offline: p.lives <= 0 }">
        <b :style="{ color: p.playerId === 1 ? '#9cfbe4' : '#ffc589' }"
          >P{{ p.playerId }} · {{ personas[p.persona].name }}</b
        >
        <span
          >{{ p.lives > 0 ? '♥'.repeat(Math.max(0, p.health)) : '连接中断' }} · {{ p.lives }} 命 ·
          {{ p.lives > 0 ? '在线' : '等待支援' }}</span
        >
        <span>{{ weapons[p.weapon].letter }} / {{ weapons[p.weapon].name }}</span>
        <button
          v-if="
            p.lives <= 0 &&
            players.some((other) => other.playerId !== p.playerId && other.lives > 1)
          "
          :disabled="props.paused || state.phase !== 'running'"
          @click="revive(p.playerId)"
        >
          为 P{{ p.playerId }} 分出一命
        </button>
      </div>
      <div class="rewrite-team-score">
        <small>SHARED SCORE</small><strong>{{ String(state.score).padStart(7, '0') }}</strong
        ><span>共同续关 {{ state.continues }} 次 · {{ difficultyNames[state.difficulty] }}</span>
      </div>
    </div>
    <details v-if="selected" class="rewrite-loadout-panel" :open="measuredWidth >= 760">
      <summary aria-label="装备库">
        <b>装备库</b>
        <span v-for="p in players" :key="p.playerId">
          <ItemArt :kind="p.weapon" />
          P{{ p.playerId }} {{ weapons[p.weapon].letter }}
          <small>盾{{ p.shield }} · 雷{{ p.grenades }}</small>
          <em v-if="p.overclock > 0" class="summary-buff">超频{{ Math.ceil(p.overclock) }}s</em>
          <em v-if="p.barrier > 0" class="summary-buff">力场{{ Math.ceil(p.barrier) }}s</em>
        </span>
      </summary>
      <div class="rewrite-loadouts" :class="{ duo: !!state.partner }">
        <section
          v-for="p in players"
          :key="p.playerId"
          class="rewrite-loadout"
          :aria-label="`P${p.playerId} 武器库`"
        >
          <div class="loadout-caption">
            <b>P{{ p.playerId }} 武器库</b
            ><span>{{
              p.playerId === 1 ? 'Q / E 切换 · 1–6 直选' : '[ / ] 切换 · 小键盘 4–9 直选'
            }}</span>
          </div>
          <div class="weapon-rack">
            <button
              v-for="(w, index) in weaponOrder"
              :key="w"
              :disabled="
                !p.arsenal.includes(w) || p.lives <= 0 || props.paused || state.phase !== 'running'
              "
              :aria-label="`P${p.playerId} 装备${weapons[w].name}`"
              :aria-pressed="p.weapon === w"
              :title="`${weapons[w].name} · ${weapons[w].description}${p.arsenal.includes(w) ? '' : ' · 尚未拾取'}`"
              :class="{ locked: !p.arsenal.includes(w), active: p.weapon === w }"
              @click="equip(p.playerId, w)"
            >
              <kbd>{{ p.playerId === 1 ? index + 1 : index + 4 }}</kbd
              ><ItemArt :kind="w" /> <span>{{ weapons[w].name }}</span
              ><em v-if="p.latestWeapon === w">新</em>
            </button>
          </div>
          <div class="buff-rack" :aria-label="`P${p.playerId} 增益与补给`">
            <span
              ><ItemArt kind="shield" />护盾 <b>{{ p.shield }}/2</b></span
            >
            <span
              ><ItemArt kind="health" />生命
              <b>{{ p.health }}/{{ maxHealth(state.difficulty) }}</b></span
            >
            <span
              ><ItemArt kind="grenade" />手雷 <b>{{ p.grenades }}/5</b></span
            >
          </div>
          <div
            v-if="p.overclock > 0 || p.barrier > 0"
            class="timed-buffs"
            :aria-label="`P${p.playerId} 限时增益`"
          >
            <span
              v-for="kind in (['overclock', 'barrier'] as const).filter((kind) => p[kind] > 0)"
              :key="kind"
              :data-buff="kind"
              :data-player="p.playerId"
              :data-remaining="p[kind].toFixed(2)"
            >
              <ItemArt :kind="kind" /><b>{{ buffs[kind].name }}</b
              ><time>{{ Math.ceil(p[kind]) }}s</time>
              <progress
                :value="p[kind]"
                :max="buffs[kind].seconds"
                :aria-label="`${buffs[kind].name}剩余时间`"
              />
            </span>
          </div>
        </section>
        <p class="loadout-hint">
          武器拾取后入库，点击图标装备；增益自动生效，满额时保留。阵亡丢失当前特殊武器，其余库存保留。
        </p>
      </div>
    </details>
    <div
      ref="stage"
      class="rewrite-stage"
      :class="{ 'has-coop': coop }"
      tabindex="0"
      :aria-label="
        state.base
          ? '纵深战场，AD 横移，W 前进，K 跳跃，S 卧倒，J 射击，L 手雷；先拆核心解除屏障'
          : '游戏战场，WASD 移动瞄准，J 射击，K 跳跃，L 手雷'
      "
    >
      <svg
        class="rewrite-world"
        :viewBox="`0 0 ${width} 420`"
        role="img"
        :aria-label="state.base ? '纵深基地射击战场' : '横版射击战场'"
        :data-phase="state.phase"
        :data-difficulty="state.difficulty"
        :data-continues="state.continues"
        :data-tick="Math.round(state.elapsed / FIXED_DT)"
        :data-stage="state.levelIndex + 1"
        :data-x="state.x.toFixed(2)"
        :data-y="state.y.toFixed(2)"
        :data-depth-z="state.depthZ.toFixed(2)"
        :data-health="state.health"
        :data-support="state.support"
        :data-overclock="state.overclock.toFixed(2)"
        :data-barrier="state.barrier.toFixed(2)"
        :data-drop-through="state.dropThrough.toFixed(2)"
        :data-grenades="state.grenades"
        :data-axis="level.axis"
        :data-camera-y="cameraY.toFixed(2)"
        :data-checkpoint-y="state.checkpointY"
        :data-grounded="state.grounded"
        :data-arena="state.arena"
        :data-sector="state.sector"
        :data-players="state.partner ? 2 : 1"
        :data-weapon="state.weapon"
        :data-aim-y="state.aimY"
        :data-crouching="state.crouching"
        :data-shake-x="feedback.x.toFixed(2)"
        :data-shake-y="feedback.y.toFixed(2)"
        :data-impact-flash="feedback.flash.toFixed(3)"
        :data-sim-projectiles="state.bullets.length + state.enemyBullets.length"
        :data-render-projectiles="renderedBullets.length + renderedEnemyBullets.length"
        :data-sim-effects="state.effects.length"
        :data-render-effects="renderedEffects.length"
        :data-sim-enemies="state.enemies.length"
        :data-live-enemies="state.enemies.filter((e) => e.hp > 0).length"
        :data-render-enemies="enemies.length"
      >
        <defs>
          <linearGradient id="rw-shade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#0a1427" stop-opacity="0.14" />
            <stop offset="1" stop-color="#070e1d" stop-opacity="0.82" />
          </linearGradient>
          <pattern id="rw-metal" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect width="60" height="60" fill="#152c38" />
            <path d="M0 0H60V60H0Z M4 4L56 56 M56 4L4 56" stroke="#29454f" stroke-width="1" />
          </pattern>
          <pattern
            id="rw-hatch"
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="8" height="18" fill="#ffc76c" />
          </pattern>
        </defs>
        <g v-if="state.base" :transform="`translate(${feedback.x},${feedback.y})`">
          <DepthBattle :state="state" :width="width" :reduce-motion="props.settings.reduceMotion" />
        </g>
        <g v-else>
          <rect :width="width" height="420" :fill="level.sky" />
          <image
            :href="REWRITE_ART.backgrounds[level.background]"
            :x="props.settings.reduceMotion ? 0 : -((camera * 0.08) % width)"
            y="0"
            :width="width * 1.7"
            height="420"
            preserveAspectRatio="xMidYMid slice"
          />
          <rect :width="width" height="420" fill="url(#rw-shade)" />
          <g opacity="0.12" :stroke="level.color">
            <path
              v-for="n in 10"
              :key="n"
              :d="`M0 ${n * 48 - ((cameraY * 0.18) % 48)} H${width}`"
            />
            <path
              v-for="n in 20"
              :key="`v${n}`"
              :d="`M${n * 80 - ((camera * 0.18) % 80)} 0 V420`"
            />
          </g>
          <g :transform="`translate(${-camera + feedback.x}, ${cameraY + feedback.y})`">
            <g v-if="level.axis === 'vertical'" aria-hidden="true">
              <rect
                x="382"
                :y="350 - level.height * 40"
                width="100"
                :height="level.height * 40"
                fill="#9475f7"
                opacity="0.06"
              />
              <path
                v-for="n in 24"
                :key="`up${n}`"
                :d="`M410 ${350 - n * 80} l22 -15 l22 15`"
                fill="none"
                stroke="#ba9cfa"
                stroke-width="3"
                opacity="0.25"
              />
              <g
                v-if="state.checkpointY > 7"
                :transform="`translate(0, ${350 - (state.checkpointY - 7) * 40})`"
              >
                <rect width="880" height="40" fill="#af68eb" opacity="0.25" />
                <text x="20" y="23" fill="#efd2ff" font-size="13">
                  上下文已过期 · 坠落将重新连接
                </text>
              </g>
            </g>
            <g
              v-for="(p, i) in surfaces.filter(
                (p) => p.to * 40 > camera && p.from * 40 < camera + width && visibleY(p.top),
              )"
              :key="`p${i}`"
              :data-platform="p.motion ? 'moving' : p.conveyor ? 'conveyor' : 'static'"
              :data-from="p.from.toFixed(3)"
              :data-top="p.top.toFixed(3)"
            >
              <rect
                :x="p.from * 40"
                :y="350 - p.top * 40"
                :width="(p.to - p.from) * 40"
                :height="p.top === 0 ? 80 : 15"
                fill="url(#rw-metal)"
                stroke="#45616b"
              />
              <rect
                :x="p.from * 40"
                :y="350 - p.top * 40"
                :width="(p.to - p.from) * 40"
                height="4"
                :fill="p.motion ? '#dcc1ff' : p.conveyor ? '#ffc06d' : level.color"
              />
              <g v-if="p.motion" stroke="#cab3ff" fill="none" opacity=".8">
                <path
                  :d="
                    p.motion.y
                      ? `M${(p.from + p.to) * 20} ${355 - p.top * 40}v24m-4 -20l4 -4l4 4m-8 16l4 4l4 -4`
                      : `M${(p.from + p.to) * 20 - 14} ${367 - p.top * 40}h28m-24 -4l-4 4l4 4m20 -8l4 4l-4 4`
                  "
                />
                <circle :cx="p.from * 40 + 8" :cy="358 - p.top * 40" r="3" fill="#dbcaff" />
                <circle :cx="p.to * 40 - 8" :cy="358 - p.top * 40" r="3" fill="#dbcaff" />
              </g>
              <g v-if="p.conveyor" fill="#ffc06d" opacity=".85">
                <path
                  v-for="n in Math.max(1, Math.floor((p.to - p.from) * 2))"
                  :key="n"
                  :d="`M${p.from * 40 + n * 20 - 12} 368l${p.conveyor > 0 ? -5 : 5} -4v8Z`"
                />
              </g>
              <rect
                v-if="p.top === 0"
                :x="p.from * 40"
                y="356"
                :width="(p.to - p.from) * 40"
                height="8"
                fill="url(#rw-hatch)"
                opacity="0.4"
              />
              <path
                v-else
                :d="`M${p.from * 40 + 12} ${365 - p.top * 40} l22 20 h${Math.max(0, (p.to - p.from) * 40 - 68)} l22 -20`"
                fill="none"
                stroke="#486a76"
                stroke-width="3"
              />
              <image
                v-if="[0, 2].includes(state.levelIndex) && p.top > 0"
                :href="REWRITE_ART.platform.url"
                :x="p.from * 40"
                :y="348 - p.top * 40"
                :width="(p.to - p.from) * 40"
                height="28"
                preserveAspectRatio="none"
              />
              <g
                v-if="p.checkpoint"
                :transform="`translate(${(p.from + p.to) * 20}, ${338 - p.top * 40})`"
              >
                <path
                  d="M-9 0V-16H9V0Z M-5 -12H5 M-5 -7H5"
                  fill="#193c46"
                  stroke="#91f8cc"
                  stroke-width="2"
                />
                <text y="42" text-anchor="middle" fill="#b4ffdb" font-size="10">
                  {{
                    (
                      level.axis === 'vertical'
                        ? p.top <= state.checkpointY
                        : p.from <= state.checkpoint
                    )
                      ? '缓存已保存'
                      : '缓存台'
                  }}{{ p.top ? ` · ${p.top} m` : '' }}
                </text>
              </g>
            </g>
            <g
              v-for="(h, i) in level.hazards"
              :key="`h${i}`"
              :transform="`translate(0, ${-(h.y ?? 0) * 40})`"
            >
              <g v-if="h.kind === 'mirage' && !state.verified.includes(i)">
                <rect
                  :x="h.from * 40"
                  y="350"
                  :width="(h.to - h.from) * 40"
                  height="14"
                  fill="#b99aff"
                  fill-opacity="0.18"
                  stroke="#b99aff"
                  stroke-dasharray="6 4"
                />
                <text
                  :x="(h.from + h.to) * 20"
                  y="380"
                  text-anchor="middle"
                  fill="#d6c2ff"
                  font-size="12"
                >
                  未核验 ?
                </text>
              </g>
              <g v-else-if="h.kind !== 'mirage'">
                <ItemArt
                  v-if="h.kind === 'firewall'"
                  kind="firewall"
                  enemy
                  :x="h.from * 40 - 12"
                  y="303"
                  width="48"
                  height="48"
                />
                <rect
                  :x="h.from * 40"
                  y="342"
                  :width="(h.to - h.from) * 40"
                  height="8"
                  :fill="h.kind === 'context' ? '#b99aff' : '#ff8c67'"
                />
                <rect
                  v-if="hazardState(i, state.stageTime) !== 'safe'"
                  :x="h.from * 40"
                  :y="h.kind === 'context' ? 329 : 281"
                  :width="(h.to - h.from) * 40"
                  :height="h.kind === 'context' ? 21 : 69"
                  :fill="h.kind === 'context' ? '#b99aff' : '#ff784f'"
                  :fill-opacity="hazardState(i, state.stageTime) === 'active' ? 0.72 : 0.18"
                  stroke="#ffc97a"
                  stroke-dasharray="4 3"
                />
                <text
                  :x="(h.from + h.to) * 20"
                  y="372"
                  text-anchor="middle"
                  fill="#ffcc9d"
                  font-size="11"
                >
                  {{
                    hazardState(i, state.stageTime) === 'warning'
                      ? '⚠ 即将放电'
                      : h.kind === 'context'
                        ? '上下文过期'
                        : '温度过高'
                  }}
                </text>
              </g>
            </g>
            <g
              v-for="c in state.carriers.filter(
                (c) => (c.hp > 0 || c.kind === 'cache') && visible(c.x) && visibleY(c.y),
              )"
              :key="`carrier${c.id}`"
              :transform="`translate(${c.x * 40},${350 - c.y * 40})`"
              :data-carrier="c.id"
              :data-carrier-kind="c.kind"
              :data-carrier-hp="c.hp"
              :data-carrier-drop="c.drop"
              :opacity="c.hp <= 0 ? 0.4 : c.flash > 0 ? 0.55 : 1"
            >
              <ItemArt
                :kind="c.hp > 0 ? c.kind : 'cache-open'"
                x="-32"
                y="-29"
                width="64"
                height="58"
              />
              <template v-if="c.hp > 0">
                <rect x="-18" y="-34" width="36" height="3" fill="#1b2c39" />
                <rect x="-18" y="-34" :width="12 * c.hp" height="3" fill="#b9f8df" />
                <text y="37" text-anchor="middle" fill="#b9f8df" font-size="10">
                  击破 · {{ supplyLabel(c.drop) }}
                </text>
              </template>
            </g>
            <g
              v-for="(p, i) in state.supplies.filter(
                (p) => !p.taken && visible(p.x) && visibleY(p.y),
              )"
              :key="`s${i}`"
              :transform="`translate(${p.x * 40}, ${350 - p.y * 40})`"
              :data-supply="p.kind"
              :opacity="
                players.some((actor) => canCollect(actor, p.kind, state.difficulty)) ? 1 : 0.45
              "
            >
              <circle
                r="19"
                :fill="supplyColor(p.kind)"
                fill-opacity="0.12"
                :stroke="supplyColor(p.kind)"
                stroke-dasharray="3 3"
              />
              <ItemArt :kind="p.kind" x="-24" y="-24" width="48" height="48" />
              <text
                y="34"
                text-anchor="middle"
                :fill="supplyColor(p.kind)"
                font-size="10"
                font-weight="800"
              >
                {{
                  players.some((actor) => canCollect(actor, p.kind, state.difficulty))
                    ? supplyLabel(p.kind)
                    : '已有 / 已满'
                }}
              </text>
            </g>
            <g
              v-for="e in enemies"
              :key="e.id"
              :transform="`translate(${e.x * 40}, ${350 - e.y * 40})`"
              :data-enemy="e.kind"
              :data-target-hp="e.hp"
              :data-target-id="e.id"
            >
              <template v-if="e.kind === 'boss'">
                <circle
                  cy="-66"
                  r="70"
                  :stroke="level.color"
                  :fill="level.color"
                  fill-opacity="0.07"
                  stroke-dasharray="10 8"
                />
                <path
                  v-for="(shot, i) in bossWarning?.shots ?? []"
                  :key="i"
                  :d="`M${(shot.x - e.x) * 40} ${-(shot.y - e.y) * 40} l${Math.cos(shot.angle) * 750} ${-Math.sin(shot.angle) * 750}`"
                  stroke="#ff756f"
                  stroke-dasharray="8 8"
                  opacity="0.35"
                />
                <svg
                  x="-85"
                  y="-164"
                  width="170"
                  height="170"
                  :viewBox="bossViewBox"
                  :opacity="e.flash > 0 ? 0.5 : 1"
                >
                  <image
                    :href="REWRITE_ART.bossAtlas.url"
                    :width="REWRITE_ART.bossAtlas.width"
                    :height="REWRITE_ART.bossAtlas.height"
                  />
                </svg>
                <text
                  y="-164"
                  text-anchor="middle"
                  :fill="bossVulnerable(state, e) ? '#a4ffcb' : '#ffce8e'"
                  font-size="12"
                >
                  {{
                    bossProtected(state, e)
                      ? `心核保护 · 剩余 ${state.enemies.filter((n) => n.kind === 'heart' && n.hp > 0).length}`
                      : bossIsOpen(e)
                        ? '核心暴露'
                        : '思考装甲 · 减伤'
                  }}
                </text>
              </template>
              <template v-else>
                <ellipse
                  v-if="e.kind === 'drone'"
                  cy="-52"
                  rx="30"
                  ry="5"
                  fill="none"
                  stroke="#f5a4ff"
                  stroke-width="3"
                />
                <ItemArt
                  :kind="e.kind"
                  enemy
                  :x="e.kind === 'heart' ? -39 : -34"
                  :y="e.kind === 'heart' ? -70 : -57"
                  :width="e.kind === 'heart' ? 78 : 68"
                  :height="e.kind === 'heart' ? 70 : 57"
                  :opacity="e.flash > 0 ? 0.4 : 1"
                />
                <text
                  v-if="e.kind === 'pod' || e.kind === 'heart'"
                  :y="e.kind === 'heart' ? -74 : -60"
                  text-anchor="middle"
                  :fill="e.kind === 'heart' ? '#ff9eea' : '#c8b0ff'"
                  font-size="10"
                >
                  {{ e.kind === 'heart' ? '推理心核' : '孵化节点' }}
                </text>
                <circle v-if="e.cooldown < 0.45" cy="-54" r="5" fill="#ffb178" />
                <path
                  v-if="e.kind === 'sniper' && e.cooldown < 0.65"
                  :d="`M0 -28 L${(attackTarget(state, e).x - e.x) * 40} ${(e.y - attackTarget(state, e).y - (attackTarget(state, e).crouching ? 0.28 : 0.7)) * 40}`"
                  stroke="#ff766f"
                  stroke-dasharray="5 5"
                />
                <rect x="-17" y="-61" width="34" height="3" fill="#222d3e" />
                <rect
                  x="-17"
                  y="-61"
                  :width="34 * Math.max(0, e.hp / e.maxHp)"
                  height="3"
                  fill="#ff9292"
                />
              </template>
            </g>
            <g v-if="state.arena" :transform="`translate(0, ${-level.arenaY * 40})`">
              <rect
                :x="(level.length - 22) * 40"
                y="70"
                width="4"
                height="280"
                fill="#ff777b"
                opacity="0.65"
              />
              <text :x="(level.length - 22) * 40 + 10" y="310" fill="#ffaab0" font-size="12">
                战区封锁
              </text>
            </g>
            <g
              v-for="b in renderedBullets"
              :key="b.id"
              :transform="`translate(${b.x * 40}, ${350 - b.y * 40})`"
              :data-shot="b.weapon"
              :data-shot-id="b.id"
              :data-shot-x="b.x.toFixed(3)"
              :data-shot-y="b.y.toFixed(3)"
            >
              <FireballSprite
                v-if="b.weapon === 'flame'"
                :age="b.age ?? 0"
                :reduce-motion="props.settings.reduceMotion"
                :angle="(-Math.atan2(b.vy, b.vx) * 180) / Math.PI"
              />
              <template v-else>
                <line
                  x1="0"
                  y1="0"
                  :x2="-b.vx * (b.weapon === 'laser' ? 0.7 : 0.2)"
                  :y2="b.vy * (b.weapon === 'laser' ? 0.7 : 0.2)"
                  :stroke="weapons[b.weapon].color"
                  stroke-width="4"
                  stroke-linecap="round"
                />
                <circle r="2.8" fill="#fff3a9" />
              </template>
            </g>
            <g v-for="(b, i) in renderedEnemyBullets" :key="`b${i}`">
              <circle
                :cx="b.x * 40"
                :cy="350 - b.y * 40"
                :r="b.radius * 40 + 3"
                fill="#ff5a77"
                fill-opacity="0.25"
              />
              <circle
                :cx="b.x * 40"
                :cy="350 - b.y * 40"
                :r="b.radius * 40"
                fill="#ffcc9a"
                stroke="#ff596e"
                stroke-width="2"
              />
            </g>
            <g
              v-for="(g, i) in renderedThrown"
              :key="`g${i}`"
              :transform="`translate(${g.x * 40}, ${350 - g.y * 40})`"
            >
              <circle r="7" fill="#afffc6" stroke="#fff" stroke-width="2" />
              <text y="4" text-anchor="middle" font-size="9" fill="#142639">G</text>
            </g>
            <g
              v-for="p in livePlayers"
              :key="`player${p.playerId}`"
              :data-testid="p.playerId === 1 ? 'rewrite-player' : 'rewrite-partner'"
              :data-x="p.x.toFixed(2)"
              :data-y="p.y.toFixed(2)"
              :data-support="p.support"
              :data-overclock="p.overclock.toFixed(2)"
              :data-barrier="p.barrier.toFixed(2)"
              :data-weapon="p.weapon"
              :data-lives="p.lives"
              :data-aim-y="p.aimY"
              :data-crouching="p.crouching"
              :transform="`translate(${p.x * 40}, ${350 - p.y * 40})`"
              :opacity="
                p.invulnerable > 0 &&
                (props.settings.reduceMotion || Math.floor(state.elapsed * 12) % 2)
                  ? 0.65
                  : 1
              "
            >
              <text
                v-if="state.partner"
                :y="p.aimY > 0 ? -102 : -82"
                text-anchor="middle"
                :fill="p.playerId === 1 ? '#9cfbe4' : '#ffc589'"
                font-size="12"
                font-weight="800"
              >
                P{{ p.playerId }}
              </text>
              <ellipse v-if="p.grounded" rx="22" ry="5" fill="#050c19" opacity="0.55" />
              <ActorSprite
                :player="p"
                :time="state.elapsed"
                :reduce-motion="props.settings.reduceMotion"
              />
              <ellipse
                v-if="p.shield > 0 || p.invulnerable > 1.4 || p.barrier > 0"
                :cy="p.crouching ? -14 : -29"
                rx="29"
                :ry="p.crouching ? 22 : 39"
                :stroke="p.barrier > 0 ? '#dca9ff' : '#7fe9fc'"
                stroke-width="2"
                fill="#70d6ff"
                fill-opacity="0.08"
              />
              <path
                :d="`M${p.aimX * 23} ${-(p.crouching ? 12 : 32) - p.aimY * 23} l${p.aimX * 10} ${-p.aimY * 10}`"
                stroke="#f7f8dd"
                stroke-width="2"
              />
            </g>
            <g
              v-for="e in renderedEffects"
              :key="`fx${e.id}`"
              :transform="`translate(${e.x * 40}, ${350 - e.y * 40})`"
            >
              <circle
                :r="
                  props.settings.reduceMotion
                    ? 14
                    : e.kind === 'boom'
                      ? 12 + (0.55 - e.life) * 90
                      : 8 + (0.24 - e.life) * 55
                "
                :stroke="e.kind === 'boom' ? '#ffc578' : '#a3fff1'"
                :stroke-width="e.kind === 'boom' ? 6 : 2"
                fill="#fff5ba"
                :fill-opacity="props.settings.reduceMotion ? 0.05 : e.life * 0.5"
                :opacity="Math.min(1, e.life * 4)"
              />
            </g>
          </g>
          <text
            v-if="state.combo >= 5"
            :x="width - 20"
            y="100"
            text-anchor="end"
            fill="#ffe4a0"
            font-size="20"
            font-weight="800"
          >
            {{ state.combo }} CHAIN ×{{ Math.min(5, 1 + Math.floor(state.combo / 5)) }}
          </text>
        </g>
        <rect
          v-if="feedback.flash > 0"
          :width="width"
          height="420"
          :fill="feedback.color"
          :fill-opacity="feedback.flash"
          pointer-events="none"
        />
      </svg>
      <div v-if="selected" class="rewrite-mission">
        <span>0{{ state.levelIndex + 1 }} / 08</span><strong>{{ level.title }}</strong
        ><small>{{
          practice ? 'COMBAT PRACTICE' : state.arena ? 'BOSS ENCOUNTER' : level.subtitle
        }}</small
        ><span class="rewrite-progress">{{ progress }}%</span>
      </div>
      <div v-if="selected && state.arena && boss && boss.hp > 0" class="rewrite-bossbar">
        <div>
          <b>{{ level.boss }}</b
          ><span>PHASE 0{{ bossPhase(boss) }}</span>
        </div>
        <div class="rewrite-boss-track">
          <i :style="{ width: `${Math.max(0, boss.hp / boss.maxHp) * 100}%` }" />
        </div>
      </div>
      <p v-if="selected && (state.noticeTime > 0 || bossWarning)" class="rewrite-radio">
        <span>COMMS</span> {{ bossWarning?.label ?? state.notice }}
      </p>
      <div v-if="!selected" class="rewrite-select">
        <div class="rewrite-brief">
          <span class="rewrite-eyebrow">MISSION 01—08</span>
          <h3>别让幻觉<br />替你开火。</h3>
          <p>八关突围，清掉幻觉与限流。选角色，直接开打。</p>
        </div>
        <div class="rewrite-deploy">
          <div class="rewrite-difficulty" aria-label="出击人数">
            <button :aria-pressed="!coop" @click="coop = false">单人出击</button>
            <button :aria-pressed="coop" @click="coop = true">双人协作</button>
          </div>
          <label v-if="coop" class="rewrite-partner-select"
            >P2 队友
            <select v-model="partnerPersona" aria-label="P2 角色">
              <option v-for="p in personaIds" :key="p" :value="p">{{ personas[p].name }}</option>
            </select>
            <small>下方点击角色为 P1 出击 · P2 使用方向键和 , . /</small>
          </label>
          <div class="rewrite-difficulty" aria-label="游戏模式">
            <button :aria-pressed="!practice" @click="practice = false">完整战役</button>
            <button :aria-pressed="practice" @click="practice = true">关卡演练</button>
          </div>
          <div v-if="practice" class="rewrite-practice">
            <label
              >目标
              <select v-model="practiceStage" aria-label="演练目标">
                <option v-for="(mission, i) in levels" :key="i" :value="i">
                  {{ i + 1 }} · {{ mission.boss }}
                </option>
              </select>
            </label>
            <label
              >武器
              <select v-model="practiceWeapon" aria-label="演练武器">
                <option v-for="(w, id) in weapons" :key="id" :value="id">
                  {{ w.letter }} · {{ w.name }}
                </option>
              </select>
            </label>
            <label class="rewrite-practice-start"
              >起始位置
              <select v-model="practiceFrom" aria-label="演练起始位置">
                <option value="boss">直接挑战 Boss</option>
                <option value="entry">从关卡入口开始</option>
              </select>
            </label>
          </div>
          <div class="rewrite-difficulty" aria-label="难度选择">
            <button :aria-pressed="difficulty === 'normal'" @click="difficulty = 'normal'">
              街机 <small>三格生命</small>
            </button>
            <button :aria-pressed="difficulty === 'classic'" @click="difficulty = 'classic'">
              经典 <small>基础装备</small>
            </button>
            <button :aria-pressed="difficulty === 'hard'" @click="difficulty = 'hard'">
              硬核 <small>一击倒地</small>
            </button>
          </div>
          <div class="rewrite-personas">
            <button v-for="p in personaIds" :key="p" @click="select(p)">
              <img :src="REWRITE_ART.characters[p].shoot.url" alt="" /><strong>{{
                personas[p].name
              }}</strong
              ><span>{{ personas[p].style }}</span
              ><small>{{
                difficulty === 'classic'
                  ? '基础步枪 · 无开局专长'
                  : personas[p].perk.split(' · ')[0]
              }}</small>
            </button>
          </div>
          <p class="rewrite-deploy-note">
            {{
              practice
                ? '独立演练 · 不计入战役通关 · 可反复挑战'
                : difficulty === 'classic'
                  ? '经典试炼 · 基础步枪 · 三次续关'
                  : '三条命 · 两次续关 · 无限弹药'
            }}
          </p>
        </div>
      </div>
      <div
        v-if="
          state.phase === 'level-complete' ||
          state.phase === 'lost' ||
          (practice && state.phase === 'won')
        "
        ref="dialog"
        class="rewrite-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="state.phase === 'lost' ? '连接中断' : '关卡完成'"
      >
        <span class="rewrite-eyebrow">{{
          state.phase === 'lost' ? 'CONNECTION LOST' : 'NODE SECURED'
        }}</span>
        <h3>{{ state.phase === 'lost' ? '这次生成失败了。' : `${level.title} · 已清除` }}</h3>
        <p>
          {{
            practice
              ? '独立演练，不计入完整战役成绩。'
              : state.phase === 'lost'
                ? `剩余 ${state.continues} 次续关 · 本关重来，扣除 2000 分`
                : `${level.boss} 已离线。补充生命、手雷，继续推进。`
          }}
        </p>
        <strong>{{ state.score.toLocaleString() }} PTS · {{ state.kills }} 击破</strong>
        <button v-if="practice" class="rewrite-primary" @click="select(state.persona)">
          再次演练
        </button>
        <button
          v-else-if="state.phase === 'level-complete'"
          class="rewrite-primary"
          @click="nextLevel"
        >
          进入第 {{ state.levelIndex + 2 }} 关 →
        </button>
        <button v-else-if="state.continues > 0" class="rewrite-primary" @click="retry">
          续关 · 重新连接
        </button>
        <button
          v-if="state.phase === 'lost' || practice"
          class="rewrite-secondary"
          @click="reselect"
        >
          {{ practice ? '返回演练设置' : '重新选择角色' }}
        </button>
      </div>
    </div>
    <div v-if="selected && sector && !state.arena" class="rewrite-sector" aria-live="polite">
      <b>{{ sector.title }}</b
      ><span>{{ sector.hint }}</span>
    </div>
    <div v-if="selected" class="rewrite-quick-deck">
      <button
        v-for="p in players"
        :key="p.playerId"
        :aria-label="`P${p.playerId} 切换下一把武器`"
        :disabled="
          props.paused || state.phase !== 'running' || p.lives <= 0 || p.arsenal.length < 2
        "
        @click="cycleControl(p.playerId)"
      >
        <ItemArt :kind="p.weapon" /><span
          ><b>P{{ p.playerId }} · {{ weapons[p.weapon].name }}</b
          ><small
            >点击换枪 ↻<template v-if="p.overclock > 0">
              · 超频 {{ Math.ceil(p.overclock) }}s</template
            ><template v-if="p.barrier > 0"> · 力场 {{ Math.ceil(p.barrier) }}s</template></small
          ></span
        >
      </button>
    </div>
    <div v-if="selected" class="rewrite-control-deck" :class="{ duo: state.partner }">
      <div
        v-for="controller in players"
        :key="`controls${controller.playerId}`"
        class="rewrite-controls"
        role="group"
        :aria-label="state.partner ? `P${controller.playerId} 操作区` : '操作区'"
        :class="{ inactive: !selected || state.phase !== 'running' || props.paused }"
      >
        <span v-if="state.partner" class="rewrite-control-player"
          >P{{ controller.playerId }} ·
          {{ controller.playerId === 1 ? 'WASD + J K L' : '方向键 + , . /' }}</span
        >
        <div class="rewrite-dpad rewrite-joystick">
          <button
            v-for="key in dpad"
            :key="key.label"
            :class="{
              'joystick-active': key.actions.every((action) => has(action, controller.playerId)),
            }"
            :aria-label="controlLabel(key.label, controller.playerId)"
            :disabled="
              !selected || props.paused || state.phase !== 'running' || controller.lives <= 0
            "
            data-control-kind="dpad"
            :data-control-player="controller.playerId"
            :data-control-actions="key.actions.join(',')"
            @pointerdown.prevent="press($event, key.actions, controller.playerId)"
            @pointermove.prevent="movePointer"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
            @lostpointercapture="pointerUp"
          >
            {{ key.icon }}
          </button>
        </div>
        <p v-if="controller.playerId === 1" class="rewrite-key-help">
          <b>W A S D</b> {{ state.base ? '前进 / 横移 / 卧倒' : '移动 / 八向瞄准' }}<br /><b>J</b>
          开火 <b>K / 空格</b> 跳跃<br /><b>S</b> 卧倒 <b>L</b> 手雷 <b>Shift</b> 定点瞄准
          <span v-if="!state.base" class="rewrite-drop-help">S + K 穿台下落</span>
          <span class="rewrite-drop-help">手柄：左摇杆 / 十字键 · A 跳 · X 射击 · B 手雷</span>
        </p>
        <p v-else class="rewrite-key-help">
          <b>P2 · 方向键</b> {{ state.base ? '前进 / 横移 / 卧倒' : '移动 / 瞄准' }}<br /><b
            >, / . / /</b
          >
          开火 / 跳跃 / 手雷<br /><b>数字键盘 1 / 2 / 3</b>
          同上 · 右 Shift 定点瞄准
        </p>
        <div class="rewrite-action-buttons">
          <button
            :aria-label="controlLabel('手雷', controller.playerId)"
            :disabled="
              !selected || props.paused || state.phase !== 'running' || controller.lives <= 0
            "
            @pointerdown.prevent="press($event, ['grenade'], controller.playerId, 'action')"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
            @lostpointercapture="pointerUp"
            @click="accessibleAction($event, 'grenade', controller.playerId)"
          >
            <small>{{ controller.playerId === 1 ? 'L / G' : '/ / NUM3' }}</small
            >手雷 <span>{{ controller.grenades }}</span>
          </button>
          <button
            :aria-label="controlLabel('跳跃', controller.playerId)"
            :disabled="
              !selected || props.paused || state.phase !== 'running' || controller.lives <= 0
            "
            @pointerdown.prevent="press($event, ['jump'], controller.playerId, 'action')"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
            @lostpointercapture="pointerUp"
            @click="accessibleAction($event, 'jump', controller.playerId)"
          >
            <small>{{ controller.playerId === 1 ? 'K / SPACE' : '. / NUM2' }}</small
            >跳跃
          </button>
          <button
            class="rewrite-fire"
            :aria-label="controlLabel('射击', controller.playerId)"
            :disabled="
              !selected || props.paused || state.phase !== 'running' || controller.lives <= 0
            "
            @pointerdown.prevent="press($event, ['shoot'], controller.playerId, 'action')"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
            @lostpointercapture="pointerUp"
            @click="accessibleAction($event, 'shoot', controller.playerId)"
          >
            <small>{{ controller.playerId === 1 ? 'J / HOLD' : ', / NUM1' }}</small
            >开火
          </button>
        </div>
      </div>
    </div>
    <details v-if="selected" class="rewrite-guide">
      <summary>战地手册 · 武器与生存技巧</summary>
      <div class="rewrite-weapons">
        <p v-for="(w, id) in weapons" :key="id">
          <b :style="{ color: w.color }">{{ w.letter }} {{ w.name }}</b
          ><span>{{ w.description }}</span>
        </p>
      </div>
      <p>
        向下站定可以卧倒；空中按方向可向下射击。高台上按下＋跳可穿过平台；地面和基地仍正常跳跃。手雷清除爆炸范围内弹幕。红点是敌人开火预警。Boss
        思考时减伤，生成时暴露核心。角色死亡会丢失当前特殊武器，其他库存保留，检查点复活有 2.5
        秒保护。虚线桥是幻觉，必须跳过。每关击败 Boss 后补充一命，最多五命。
      </p>
      <p>AI 品牌与角色能力均为本作虚构同人设定。</p>
      <p>
        先击破飞行胶囊或补给箱，再领取释放的道具。算力超频提升射速12秒；沙盒力场免疫攻击6秒，但不能阻止坠落；全量清理消除附近杂兵和弹幕，对Boss造成20伤害，不会清除基地核心。限时增益换枪后保留，暂停时冻结，阵亡时消失；同类剩余不足一半时才领取并刷新，避免浪费。
      </p>
      <p>
        纵深基地：左右横移，W／上键前进，K／跳跃键射击高位节点，下蹲躲过高弹。屏障通电时接触会受伤，先摧毁三个核心，再让所有存活队员走到出口。守关战先拆外围节点；成对移动的节点仅在对齐时暴露，绿色表示可攻击。手雷沿前方抛出，激光可贯穿重合的目标。
      </p>
      <p>
        双人协作：P1 使用 WASD + J/K/L，P2 使用方向键 + 逗号/句号/斜杠（或数字键盘
        1/2/3）。两人各自三命，共享得分与
        {{ initialContinues(state.difficulty) }} 次续关，无友军伤害；必须一起进入 Boss
        区。阵亡后在队友附近安全平台重连；离线者可借队友一命，过关也会获得一命重返战场。攀升时领先者需等待队友，掉出队伍下方七米会损失一命。
      </p>
      <p>
        标准手柄：左摇杆或十字键移动/瞄准，A跳跃，X射击，B手雷，右肩键定点瞄准。双人模式按手柄索引分配P1/P2；暂停和失焦会释放方向与持续动作，按键边沿不会在暂停期间积压。
      </p>
    </details>
  </section>
</template>
<style scoped>
.rewrite-game {
  --mission: #69e9dc;
  color: #dbe8ed;
  background: #0c1522;
  border-radius: 14px;
  overflow: hidden;
  font-family: inherit;
}
.rewrite-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px 14px;
  border-bottom: 1px solid #25313f;
}
.rewrite-eyebrow {
  font-size: 10px;
  letter-spacing: 2.2px;
  color: #81a7b6;
  font-weight: 700;
}
h2 {
  margin: 4px 0 0;
  font-size: 22px;
  color: #eff7fa;
}
h2 span {
  font-size: 13px;
  font-weight: 400;
  color: #98adb8;
  margin-left: 9px;
}
.rewrite-sound-controls {
  display: grid;
  grid-template-columns: auto 76px 76px;
  align-items: center;
  gap: 8px;
}
.rewrite-sound-controls label {
  display: grid;
  gap: 2px;
  color: #8fa8b5;
  font-size: 9px;
  text-align: center;
}
.rewrite-sound-controls input {
  width: 76px;
  margin: 0;
  accent-color: var(--mission);
}
.rewrite-sound-controls input:disabled {
  opacity: 0.35;
}
.rewrite-sound {
  color: #acc2cc;
  background: transparent;
  border: 1px solid #384c5d;
  border-radius: 6px;
  padding: 10px 12px;
  min-height: 44px;
  cursor: pointer;
}
.rewrite-hud {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  padding: 13px 24px;
  background: #101d2c;
}
.rewrite-team-hud {
  display: grid;
  grid-template-columns: 1fr 1fr 0.8fr;
  gap: 14px;
  padding: 14px 22px;
  background: #101d2c;
}
.rewrite-team-hud > div {
  display: grid;
  gap: 5px;
  font-size: 11px;
}
.rewrite-team-hud b {
  font-size: 13px;
}
.rewrite-team-hud span {
  color: #b4c9d5;
}
.rewrite-team-hud .offline {
  opacity: 0.75;
}
.rewrite-team-hud button {
  color: #d8ffef;
  background: #245048;
  border: 1px solid #6dbaa5;
  border-radius: 5px;
  padding: 8px;
  cursor: pointer;
}
.rewrite-team-score {
  text-align: right;
}
.rewrite-team-score strong {
  font: bold 20px monospace;
  color: #ffe2a4;
}
.rewrite-team-score small {
  font-size: 8px;
  letter-spacing: 2px;
}
.rewrite-control-player {
  position: absolute;
  top: 3px;
  left: 8px;
  color: #a8e6dc;
  font: bold 11px monospace;
}
.rewrite-control-deck.duo {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.rewrite-control-deck.duo .rewrite-controls {
  min-width: 0;
  padding-top: 24px;
  border-right: 1px solid #304151;
}
.rewrite-control-deck.duo .rewrite-key-help {
  display: none;
}
.rewrite-partner-select {
  display: grid;
  gap: 5px;
  margin-bottom: 10px;
  color: #ffd3a0;
  font-size: 12px;
}
.rewrite-partner-select select {
  min-height: 38px;
  color: #d8e9ef;
  background: #142738;
  border: 1px solid #3c5364;
  border-radius: 5px;
}
.rewrite-partner-select small {
  color: #b6c9d4;
  font-size: 10px;
}
.rewrite-stage:has(.rewrite-select) {
  min-height: 470px;
}
.rewrite-stage.has-coop:has(.rewrite-select) {
  min-height: 560px;
}
.rewrite-stage.has-coop:has(.rewrite-practice) {
  min-height: 680px;
}
.rewrite-hud > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.rewrite-hud small {
  width: 100%;
  color: #7a9baa;
  font: 9px monospace;
  letter-spacing: 2px;
}
.rewrite-hud strong {
  font-size: 13px;
}
.rewrite-hud span {
  color: #9bb2c1;
  font-size: 11px;
}
.rewrite-hud .rewrite-hearts {
  color: #ff958d;
  letter-spacing: 3px;
}
.rewrite-hearts i {
  font-style: normal;
  color: #546e7c;
}
.rewrite-hud > div:last-child {
  justify-content: flex-end;
  text-align: right;
}
.rewrite-score {
  font-family: monospace;
  letter-spacing: 2px;
  color: #fff0bd;
}
.rewrite-stage {
  position: relative;
  outline: none;
  background: #111e31;
}
.rewrite-stage:focus-visible {
  outline: 2px solid var(--mission);
  outline-offset: -2px;
}
.rewrite-world {
  display: block;
  width: 100%;
  height: auto;
  touch-action: none;
}
.rewrite-mission {
  position: absolute;
  inset: 13px 18px auto;
  display: flex;
  align-items: center;
  gap: 12px;
  pointer-events: none;
  font-size: 12px;
  text-shadow: 0 2px 8px #000;
}
.rewrite-mission > span:first-child {
  color: var(--mission);
  font: 700 12px monospace;
}
.rewrite-mission strong {
  color: #fff;
}
.rewrite-mission small {
  font: 9px monospace;
  letter-spacing: 1.5px;
  color: #b3c2d1;
}
.rewrite-progress {
  margin-left: auto;
  font: 11px monospace;
  color: #bed1d9;
}
.rewrite-bossbar {
  position: absolute;
  top: 42px;
  left: 20%;
  right: 10%;
}
.rewrite-bossbar > div:first-child {
  display: flex;
  justify-content: space-between;
  color: #ffcbcf;
  font-size: 11px;
  margin-bottom: 5px;
}
.rewrite-bossbar span {
  font: 10px monospace;
}
.rewrite-boss-track {
  background: #3c263c;
  height: 7px;
  border: 1px solid #9c5963;
}
.rewrite-boss-track i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #fb718a, #ffb781);
}
.rewrite-radio {
  position: absolute;
  bottom: 7px;
  left: 18px;
  right: 18px;
  margin: 0;
  color: #d2e6e8;
  font-size: 11px;
  pointer-events: none;
  text-shadow: 0 1px 4px #000;
}
.rewrite-radio span {
  font: 9px monospace;
  color: var(--mission);
  letter-spacing: 1px;
  margin-right: 8px;
}
.rewrite-select {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  align-items: center;
  gap: 26px;
  padding: 28px 42px;
  background: linear-gradient(90deg, #091321f5, #112239b8);
}
.rewrite-stage:has(.rewrite-practice) {
  min-height: 530px;
}
.rewrite-practice {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}
.rewrite-practice label {
  min-width: 0;
  color: #b9cfdb;
  font-size: 11px;
}
.rewrite-practice-start {
  grid-column: 1 / -1;
}
.rewrite-practice select {
  display: block;
  width: 100%;
  min-height: 38px;
  margin-top: 4px;
  color: #d8e9ef;
  background: #142738;
  border: 1px solid #3c5364;
  border-radius: 5px;
}
.rewrite-brief h3 {
  font-size: clamp(24px, 3vw, 40px);
  line-height: 1.3;
  color: #f4f7ed;
  margin: 14px 0;
  font-weight: 800;
  letter-spacing: 1px;
}
.rewrite-brief p {
  color: #a4bac9;
  font-size: 12px;
  line-height: 1.9;
}
.rewrite-difficulty {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.rewrite-difficulty button {
  flex: 1;
  padding: 9px;
  background: #182d3e;
  border: 1px solid #3c5364;
  color: #b9cfdb;
  border-radius: 6px;
  min-height: 44px;
  cursor: pointer;
}
.rewrite-difficulty button[aria-pressed='true'] {
  border-color: var(--mission);
  color: var(--mission);
  background: #1b3d47;
}
.rewrite-difficulty small {
  font-size: 10px;
  margin-left: 7px;
  color: #a9bdc6;
}
.rewrite-personas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.rewrite-personas button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px 12px;
  background: #152637;
  border: 1px solid #3c5364;
  border-radius: 8px;
  cursor: pointer;
  color: #eef5f5;
}
.rewrite-personas button:hover,
.rewrite-personas button:focus-visible {
  background: #284653;
  border-color: var(--mission);
}
.rewrite-personas img {
  width: 100%;
  height: 112px;
  object-fit: contain;
  filter: drop-shadow(0 7px 8px #0005);
}
.rewrite-personas strong {
  font-size: 12px;
  margin-top: 8px;
}
.rewrite-personas span {
  font-size: 10px;
  color: var(--mission);
  margin: 4px 0;
}
.rewrite-personas small {
  font-size: 9px;
  color: #98b1c0;
}
.rewrite-deploy-note {
  text-align: center;
  color: #95afbf;
  font-size: 10px;
  margin: 12px 0 0;
}
.rewrite-overlay {
  position: absolute;
  inset: 0;
  background: #0c182ded;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 12px;
  text-align: center;
}
.rewrite-overlay h3 {
  color: #f0f6f9;
  font-size: 24px;
  margin: 0;
}
.rewrite-overlay p {
  color: #b6c6d0;
  font-size: 13px;
  margin: 0;
}
.rewrite-overlay > strong {
  font: 14px monospace;
  color: #ffd99f;
}
.rewrite-primary,
.rewrite-secondary {
  padding: 12px 24px;
  border: 0;
  border-radius: 6px;
  background: #99edde;
  color: #112c32;
  font-weight: 700;
  cursor: pointer;
  min-height: 44px;
}
.rewrite-secondary {
  background: #253d50;
  color: #cfe1e9;
}
.rewrite-controls {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 14px 22px;
  background: #101e2c;
  border-top: 1px solid #304151;
}
.rewrite-dpad {
  display: grid;
  grid-template-columns: repeat(3, 38px);
  gap: 3px;
}
.rewrite-dpad button {
  width: 38px;
  height: 32px;
  border: 1px solid #385060;
  border-radius: 5px;
  background: #1b3040;
  color: #bbd4df;
  font-size: 19px;
  touch-action: none;
  user-select: none;
  cursor: pointer;
}
.rewrite-key-help {
  font-size: 11px;
  color: #829eaf;
  line-height: 2;
  margin: 0;
}
.rewrite-key-help b {
  color: #c4d6df;
  font: 10px monospace;
}
.rewrite-action-buttons {
  display: flex;
  gap: 9px;
  align-items: center;
}
.rewrite-action-buttons button {
  width: 75px;
  min-height: 63px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background: #23394c;
  border: 1px solid #4a6173;
  border-radius: 10px;
  color: #d8e9ef;
  font-size: 14px;
  font-weight: 700;
  touch-action: none;
  user-select: none;
  cursor: pointer;
}
.rewrite-action-buttons small {
  font: 8px monospace;
  letter-spacing: 0.6px;
  color: #9fb6c8;
}
.rewrite-action-buttons span {
  font: 10px monospace;
}
.rewrite-action-buttons .rewrite-fire {
  width: 84px;
  min-height: 78px;
  background: #a2eedb;
  color: #0e3237;
  border-color: #bdf6e8;
}
.rewrite-fire small {
  color: #3e787c;
}
.rewrite-controls button:active {
  background: #467078;
}
.rewrite-controls.inactive {
  opacity: 0.55;
}
.rewrite-guide {
  padding: 13px 22px;
  color: #9eb4c2;
  font-size: 12px;
  border-top: 1px solid #263a49;
}
.rewrite-guide summary {
  cursor: pointer;
}
.rewrite-guide > p {
  line-height: 1.9;
}
.rewrite-weapons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px 18px;
  margin-top: 12px;
}
.rewrite-weapons p {
  margin: 0;
}
.rewrite-weapons span {
  display: block;
  font-size: 11px;
}
.rewrite-game button:focus-visible {
  outline: 2px solid #c9fff2;
  outline-offset: 3px;
}
@media (max-width: 760px) {
  .rewrite-control-deck.duo .rewrite-controls {
    flex-direction: column;
    padding: 21px 2px 8px;
    gap: 8px;
  }
  .rewrite-control-deck.duo .rewrite-control-player {
    font-size: 8px;
    left: 5px;
    top: 7px;
  }
  .rewrite-heading {
    padding: 12px 14px;
  }
  h2 {
    font-size: 19px;
  }
  .rewrite-hud {
    padding: 10px 14px;
    gap: 8px;
  }
  .rewrite-hud > div {
    gap: 3px;
    flex-direction: column;
    align-items: flex-start;
  }
  .rewrite-hud > div:last-child {
    align-items: flex-end;
  }
  .rewrite-hud strong {
    font-size: 11px;
  }
  .rewrite-hud span {
    font-size: 10px;
  }
  .rewrite-key-help {
    display: none;
  }
  .rewrite-controls {
    padding: 12px 14px;
    gap: 10px;
  }
  .rewrite-select {
    padding: 16px 22px;
    gap: 18px;
  }
  .rewrite-brief h3 {
    font-size: 25px;
  }
  .rewrite-personas img {
    height: 83px;
  }
  .rewrite-personas small {
    display: none;
  }
  .rewrite-difficulty small {
    display: none;
  }
  .rewrite-mission small {
    display: none;
  }
  .rewrite-dpad {
    grid-template-columns: repeat(3, 44px);
  }
  .rewrite-dpad button {
    width: 44px;
    height: 44px;
  }
  .rewrite-action-buttons button {
    width: 61px;
  }
  .rewrite-action-buttons .rewrite-fire {
    width: 68px;
  }
  .rewrite-weapons {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 520px) {
  .rewrite-team-hud {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    padding: 12px;
  }
  .rewrite-team-hud .rewrite-team-score {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }
  .rewrite-team-score strong {
    font-size: 16px;
  }
  .rewrite-heading h2 span {
    font-size: 11px;
  }
  .rewrite-eyebrow {
    font-size: 8px;
    letter-spacing: 1.3px;
  }
  .rewrite-sound {
    padding: 8px;
    font-size: 11px;
  }
  .rewrite-sound-controls {
    grid-template-columns: auto;
    gap: 0;
  }
  .rewrite-sound-controls label {
    display: none;
  }
  .rewrite-sound-controls input {
    width: 54px;
  }
  .rewrite-hud {
    padding: 9px 10px;
  }
  .rewrite-hud small {
    font-size: 8px;
  }
  .rewrite-loadout-panel > summary {
    gap: 6px;
    padding: 5px 10px;
  }
  .rewrite-loadout-panel > summary > span {
    font-size: 10px;
  }
  .rewrite-loadout-panel:has(.rewrite-loadouts.duo) > summary small {
    display: none;
  }
  .rewrite-stage:has(.rewrite-select) {
    min-height: 420px;
  }
  .rewrite-stage.has-coop:has(.rewrite-select) {
    min-height: 460px;
  }
  .rewrite-stage:has(.rewrite-practice) {
    min-height: 600px;
  }
  .rewrite-select {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 15px;
    align-content: center;
  }
  .rewrite-brief h3 {
    font-size: 22px;
    margin: 4px 0;
  }
  .rewrite-brief h3 br {
    display: none;
  }
  .rewrite-brief p {
    margin: 4px 0 0;
    font-size: 11px;
  }
  .rewrite-brief p br {
    display: none;
  }
  .rewrite-personas img {
    height: 75px;
  }
  .rewrite-personas button {
    padding: 4px 2px 7px;
  }
  .rewrite-difficulty {
    margin-bottom: 8px;
  }
  .rewrite-difficulty button {
    padding: 6px;
    font-size: 11px;
  }
  .rewrite-deploy-note {
    margin-top: 8px;
  }
  .rewrite-controls {
    gap: 6px;
    padding: 9px 7px;
  }
  .rewrite-dpad {
    gap: 2px;
  }
  .rewrite-action-buttons {
    gap: 5px;
  }
  .rewrite-action-buttons button {
    width: 49px;
    font-size: 12px;
    min-height: 61px;
  }
  .rewrite-action-buttons .rewrite-fire {
    width: 56px;
    min-height: 76px;
  }
  .rewrite-action-buttons small {
    font-size: 7px;
  }
  .rewrite-radio {
    font-size: 10px;
    left: 9px;
    right: 9px;
    bottom: 4px;
  }
  .rewrite-mission {
    font-size: 10px;
    top: 8px;
    left: 9px;
    right: 9px;
    gap: 8px;
  }
  .rewrite-mission > span:first-child {
    font-size: 10px;
  }
  .rewrite-bossbar {
    top: 30px;
    left: 15%;
    right: 7%;
  }
  .rewrite-bossbar > div:first-child {
    font-size: 9px;
  }
  .rewrite-overlay {
    gap: 9px;
    padding: 12px;
  }
  .rewrite-overlay h3 {
    font-size: 19px;
  }
  .rewrite-overlay p {
    font-size: 11px;
  }
  .rewrite-guide {
    padding: 12px;
  }
  .rewrite-hud .rewrite-hearts {
    letter-spacing: 2px;
  }
}
@media (max-width: 760px) and (pointer: coarse) {
  .rewrite-joystick {
    width: 132px;
    height: 132px;
    padding: 5px;
    border: 1px solid #496274;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #29475b 0 26%, transparent 27%),
      radial-gradient(circle, #172c3c 0 66%, #0c1924 67%);
    box-shadow:
      inset 0 0 0 7px #0d1c29,
      inset 0 0 28px #70e1d41a;
    touch-action: none;
  }
  .rewrite-joystick button {
    width: 40px;
    height: 40px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #7694a5;
    font-size: 14px;
  }
  .rewrite-joystick button.joystick-active {
    background: #9cfbe4;
    color: #14363c;
    box-shadow: 0 4px 14px #07131db8;
    transform: scale(1.08);
  }
}
@media (max-width: 360px) {
  .rewrite-action-buttons {
    display: grid;
    grid-template-columns: 44px 52px;
    gap: 5px;
  }
  .rewrite-action-buttons button {
    width: 44px;
    min-height: 44px;
    border-radius: 7px;
  }
  .rewrite-action-buttons .rewrite-fire {
    grid-column: 2;
    grid-row: 1 / 3;
    width: 52px;
    height: 93px;
  }
}
@media (max-width: 760px) {
  .rewrite-control-deck.duo .rewrite-action-buttons {
    display: grid;
    grid-template-columns: repeat(3, 44px);
    gap: 2px;
  }
  .rewrite-control-deck.duo .rewrite-action-buttons small {
    font-size: 6px;
    letter-spacing: 0;
    white-space: nowrap;
  }
  .rewrite-control-deck.duo .rewrite-action-buttons button {
    width: 44px;
    height: 49px;
    min-height: 49px;
    border-radius: 7px;
  }
  .rewrite-control-deck.duo .rewrite-action-buttons .rewrite-fire {
    grid-column: auto;
    grid-row: auto;
    width: 44px;
    height: 49px;
    min-height: 49px;
  }
}
@media (max-width: 360px) {
  .rewrite-control-deck.duo .rewrite-dpad,
  .rewrite-control-deck.duo .rewrite-action-buttons {
    grid-template-columns: repeat(3, 40px);
  }
  .rewrite-control-deck.duo .rewrite-dpad button,
  .rewrite-control-deck.duo .rewrite-action-buttons button,
  .rewrite-control-deck.duo .rewrite-action-buttons .rewrite-fire {
    width: 40px;
  }
}
@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .rewrite-game {
    position: relative;
    height: calc(100svh - 52px);
    min-height: 0;
    border-radius: 8px;
  }
  .rewrite-game:not(:has(.rewrite-select))
    > :is(
      .rewrite-heading,
      .rewrite-loadout-panel,
      .rewrite-sector,
      .rewrite-quick-deck,
      .rewrite-guide
    ) {
    display: none;
  }
  .rewrite-game:not(:has(.rewrite-select)) :is(.rewrite-hud, .rewrite-team-hud) {
    position: absolute;
    top: 4px;
    left: 6px;
    z-index: 7;
    display: flex;
    width: calc(100% - 266px);
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 5px 8px;
    background: #0c182dcc;
  }
  .rewrite-game:not(:has(.rewrite-select)) :is(.rewrite-hud, .rewrite-team-hud) > div {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .rewrite-game:not(:has(.rewrite-select)) :is(.rewrite-hud, .rewrite-team-hud) small {
    display: none;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-stage {
    width: calc(100% - 250px);
    height: 100%;
    min-height: 0;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-world {
    width: 100%;
    height: 100%;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-control-deck {
    position: absolute;
    inset: 0 0 0 auto;
    z-index: 6;
    display: block;
    width: 250px;
    overflow-y: auto;
    border-left: 1px solid #304151;
    background: #101e2c;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-control-deck.duo {
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-controls {
    min-height: 100%;
    flex-direction: row;
    justify-content: center;
    gap: 6px;
    padding: 22px 6px 6px;
    overflow: hidden;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-key-help {
    display: none;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-control-deck.duo .rewrite-controls {
    min-height: 0;
    padding-top: 18px;
    border-right: 0;
    border-bottom: 1px solid #304151;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-joystick {
    width: 108px;
    height: 108px;
    flex: 0 0 108px;
    grid-template-columns: repeat(3, 32px);
    padding: 5px;
    border: 1px solid #496274;
    border-radius: 50%;
    background:
      radial-gradient(circle at center, #29475b 0 26%, transparent 27%),
      radial-gradient(circle, #172c3c 0 66%, #0c1924 67%);
    box-shadow:
      inset 0 0 0 6px #0d1c29,
      inset 0 0 24px #70e1d41a;
    touch-action: none;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-joystick button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: #7694a5;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-joystick button.joystick-active {
    background: #9cfbe4;
    color: #14363c;
    box-shadow: 0 3px 10px #07131db8;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-action-buttons {
    display: grid;
    grid-template-columns: repeat(2, 46px);
    gap: 4px;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-action-buttons button,
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-action-buttons .rewrite-fire {
    grid-column: auto;
    grid-row: auto;
    width: 46px;
    min-height: 48px;
    height: 48px;
  }
  .rewrite-game:not(:has(.rewrite-select)) .rewrite-action-buttons small {
    display: none;
  }
  .rewrite-game:has(.rewrite-select) .rewrite-heading {
    padding: 8px 14px;
  }
  .rewrite-game:has(.rewrite-select) .rewrite-stage {
    min-height: calc(100svh - 104px);
  }
  .rewrite-game:has(.rewrite-select) .rewrite-select {
    min-height: 0;
    height: 100%;
    padding: 10px 18px;
  }
}
.rewrite-loadout-panel {
  border-top: 1px solid #315064;
  border-bottom: 1px solid #315064;
  background: #0f2030;
}
.rewrite-loadout-panel > summary {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 6px 14px;
  color: #c8e5df;
  cursor: pointer;
  list-style: none;
}
.rewrite-loadout-panel > summary::-webkit-details-marker {
  display: none;
}
.rewrite-loadout-panel > summary::after {
  content: '▾';
  margin-left: auto;
  color: #8fb1bc;
}
.rewrite-loadout-panel:not([open]) > summary::after {
  content: '▸';
}
.rewrite-loadout-panel[open] > summary {
  border-bottom: 1px solid #294455;
}
.rewrite-loadout-panel > summary > span {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #b9cfdb;
}
.rewrite-loadout-panel > summary svg {
  width: 28px;
  height: 28px;
}
.rewrite-loadout-panel > summary small {
  color: #829daa;
  font-size: 9px;
}
.rewrite-loadout-panel > summary .summary-buff {
  padding: 2px 4px;
  border-radius: 4px;
  background: #4a3753;
  color: #ffd18b;
  font-size: 9px;
  font-style: normal;
  white-space: nowrap;
}
.rewrite-loadouts {
  display: grid;
  gap: 10px;
  padding: 10px;
}
.rewrite-quick-deck {
  display: flex;
  gap: 8px;
  padding: 6px 12px;
  background: #112334;
}
.rewrite-sector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 8px 12px;
  background: #18273a;
  color: #bbcad9;
  font-size: 11px;
}
.rewrite-sector b {
  color: #d5baff;
}
.rewrite-quick-deck button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  border: 1px solid #4c766f;
  border-radius: 7px;
  background: #203e43;
  color: #c8f7e9;
  cursor: pointer;
  touch-action: manipulation;
}
.rewrite-quick-deck button:disabled {
  opacity: 0.5;
  cursor: default;
}
.rewrite-quick-deck svg {
  width: 34px;
  height: 34px;
}
.rewrite-quick-deck b {
  display: block;
  font-size: 11px;
}
.rewrite-quick-deck small {
  display: block;
  font-size: 10px;
  color: #acc4d3;
}
.rewrite-loadouts.duo {
  grid-template-columns: 1fr 1fr;
}
.rewrite-loadout {
  min-width: 0;
  padding: 10px;
  border: 1px solid #315064;
  border-radius: 8px;
  background: #112334;
}
.loadout-caption {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #bceadf;
  margin-bottom: 7px;
}
.loadout-caption span {
  color: #9cb1c3;
  font-size: 10px;
}
.weapon-rack {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
}
.weapon-rack button {
  position: relative;
  min-width: 0;
  min-height: 74px;
  padding: 5px 2px;
  border-radius: 7px;
  border: 1px solid #3d586c;
  background: #1b3042;
  color: #d5e6f2;
  cursor: pointer;
}
.weapon-rack button.active {
  border-color: #a8ffe3;
  background: #274c4b;
  box-shadow: inset 0 0 0 1px #a8ffe3;
}
.weapon-rack button.locked {
  opacity: 0.36;
  filter: grayscale(1);
  cursor: default;
}
.weapon-rack button svg {
  display: block;
  width: 100%;
  height: 43px;
}
.weapon-rack button span {
  display: block;
  font-size: 10px;
  white-space: nowrap;
}
.weapon-rack kbd {
  position: absolute;
  top: 3px;
  left: 5px;
  font-size: 10px;
  color: #d2e5f4;
}
.weapon-rack em {
  position: absolute;
  right: 2px;
  top: 1px;
  padding: 1px 4px;
  border-radius: 4px;
  background: #ffd082;
  color: #352511;
  font-style: normal;
  font-size: 10px;
}
.buff-rack {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 7px;
  border-top: 1px solid #294455;
  padding-top: 5px;
}
.buff-rack span {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #acc4d3;
  font-size: 11px;
}
.buff-rack svg {
  width: 28px;
  height: 28px;
}
.buff-rack b {
  color: #e0f5f0;
}
.timed-buffs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 6px;
}
.rewrite-drop-help {
  display: block;
}
.timed-buffs > span {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 3px 6px;
  align-items: center;
  flex: 1;
  min-width: 120px;
  padding: 5px 7px;
  border: 1px solid #695682;
  border-radius: 5px;
  background: #28263f;
  font-size: 11px;
}
.timed-buffs svg {
  width: 24px;
  height: 24px;
}
.timed-buffs time {
  color: #f5d997;
  font-variant-numeric: tabular-nums;
}
.timed-buffs progress {
  appearance: none;
  border: 0;
  display: block;
  grid-column: 1 / -1;
  width: 100%;
  height: 4px;
  accent-color: #d2a6ff;
}
.timed-buffs progress::-webkit-progress-bar {
  background: #4b3b5a;
  border-radius: 3px;
}
.timed-buffs progress::-webkit-progress-value {
  background: #d2a6ff;
  border-radius: 3px;
}
.timed-buffs [data-buff='overclock'] {
  border-color: #826549;
}
.timed-buffs [data-buff='overclock'] progress::-webkit-progress-value {
  background: #ffc16c;
}
.loadout-hint {
  grid-column: 1 / -1;
  font-size: 11px;
  color: #9db2c6;
  margin: 0;
}
@media (max-width: 650px) {
  .rewrite-loadouts.duo {
    grid-template-columns: 1fr;
  }
  .weapon-rack button span {
    font-size: 9px;
  }
  .rewrite-loadout {
    padding: 7px;
  }
}
</style>
