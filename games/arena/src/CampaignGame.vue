<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  RotateCcw,
  DoorOpen,
  Grid2X2,
  Star,
  Users,
  User,
  Check,
  Volume2,
  VolumeX,
  X,
  Zap,
  Infinity as InfinityIcon,
  Flag,
  Pencil,
  KeyRound,
  LockKeyhole,
  SkipForward,
} from '@lucide/vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { GENERATED_WORLD_ART as art } from '@moecore/assets/generated-world';
import { CAMPAIGN, type Room } from './campaign';
import ArenaEditor from './ArenaEditor.vue';
import { editorProblem, normalizeRoom, saveDraft, encodeRoom } from './editor';
import { FRAME_MS, openRoom, RoomRunner } from './runner';
import CharacterSprite from './CharacterSprite.vue';
import { frameActors } from './camera';
import { RaceRunner } from './race';
import { loadProgress, recordClear, recordDeath, saveProgress, recordDiscovery } from './progress';
import { DISCOVERIES, discoveryFor, hiddenUnlocked, HIDDEN_ROOM, hiddenReplay } from './hidden';
import { ArenaAudio, type Cue } from './audio';
import { createMatch, settleRound, advanceRound, matchChampion } from './match';
import { WORLDS, journeyPosition, nextJourneyRoom } from './journey';
import {
  createEndless,
  generateEndlessRoom,
  clearEndless,
  nextEndless,
  loadEndless,
  saveEndless,
  endlessReplay,
  type EndlessRun,
} from './endless';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const progress = ref(loadProgress());
const storageAvailable = ref(true);
const audio = new ArenaAudio();
const sound = ref(true);
const failure = ref('');
const failureTicks = ref(0);
function unlockAudio() {
  if (!props.paused && sound.value) audio.unlock();
}
function cue(event: Cue) {
  if (!props.paused && sound.value) audio.play(event, props.settings.masterVolume);
}
function toggleSound() {
  sound.value = !sound.value;
  if (sound.value) unlockAudio();
  else audio.suspend();
}
const index = ref(0);
const runner = shallowRef(openRoom(0));
const endless = ref<EndlessRun | null>(null);
const endlessSaved = ref(loadEndless());
const seedInput = ref('');
const seedError = ref('');
const editorOpen = ref(false);
const editorDraft = shallowRef<Room | null>(null);
const customRoom = shallowRef<Room | null>(null);
const customDeaths = ref(0);
const secretMode = ref(false);
const discoveryNotice = ref('');
const discoveryTicks = ref(0);
const race = shallowRef<RaceRunner | null>(null);
const raceMode = ref(false);
const match = ref(createMatch(0));
const raceScore = computed(() => match.value.scores);
const champion = computed(() => matchChampion(match.value));
const revision = ref(0);
const deaths = ref(0);
const elapsed = ref(0);
const select = ref(props.restartMode === 'select');
const mapDialog = ref<HTMLElement>();
const gameSurface = ref<HTMLElement>();
function closeMap() {
  select.value = false;
  release();
  void nextTick(() => gameSurface.value?.focus({ preventScroll: true }));
}
function mapKeyboard(event: KeyboardEvent) {
  if (props.paused) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    closeMap();
    return;
  }
  if (event.key !== 'Tab') return;
  const controls = [
    ...(mapDialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
    ) ?? []),
  ];
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
watch(
  select,
  async (opened) => {
    if (!opened) return;
    await nextTick();
    release();
    const target =
      mapDialog.value?.querySelector<HTMLElement>('[aria-current="step"]') ??
      mapDialog.value?.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: 'nearest' });
  },
  { immediate: true },
);
const playfield = ref<HTMLElement>();
const viewportWidth = ref(1000);
let resizeObserver: ResizeObserver | undefined;
let resizeFrame = 0;
const keys = new Set<string>();
const touch = ref({ left: false, right: false });
const touch2 = ref({ left: false, right: false });
const touchJump = ref([false, false]);
let queued = false;
let queued2 = false;
let sabotage1 = false;
let sabotage2 = false;
function sabotage(player: 0 | 1) {
  if (props.paused || !race.value?.canSabotage(player)) return;
  unlockAudio();
  if (player === 0) sabotage1 = true;
  else sabotage2 = true;
}
function queueJump(event: PointerEvent) {
  unlockAudio();
  if (!props.paused) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    touchJump.value[0] = true;
    queued = true;
  }
}
function queueJump2(event: PointerEvent) {
  unlockAudio();
  if (!props.paused) {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    touchJump.value[1] = true;
    queued2 = true;
  }
}
function thrustInput(actor: RoomRunner, player: 0 | 1) {
  return (
    actor.groupJetpack &&
    Boolean(
      touchJump.value[player] ||
      (player === 0
        ? keys.has('Space') || keys.has('KeyW') || (!raceMode.value && keys.has('ArrowUp'))
        : keys.has('ArrowUp')),
    )
  );
}
let timer: ReturnType<typeof setInterval>;
const completed = computed(() =>
  CAMPAIGN.filter((entry) => progress.value.rooms[entry.id]!.clears > 0).map((entry) => entry.id),
);
const allCleared = computed(() => completed.value.length === CAMPAIGN.length);
const secretCount = computed(
  () => CAMPAIGN.filter((entry) => progress.value.rooms[entry.id]?.secret).length,
);
const journey = computed(() => journeyPosition(index.value));
const journeyNext = computed(() => nextJourneyRoom(index.value));
const canSkip = computed(
  () =>
    !raceMode.value &&
    !secretMode.value &&
    !customRoom.value &&
    !endless.value &&
    (progress.value.rooms[room.value.id]?.deaths ?? 0) >= 3 &&
    frame.value.phase !== 'clear',
);
const journeyMaps = WORLDS.map((world) => ({
  ...world,
  doors: world.doors.map((door) => ({
    ...door,
    rooms: door.rooms.map((index) => ({
      ...CAMPAIGN[index]!,
      index,
      order: journeyPosition(index).overall + 1,
    })),
  })),
}));
function persist() {
  storageAvailable.value = saveProgress(progress.value);
}
function characterPose(actor: RoomRunner) {
  if (actor.phase === 'dead') return { name: 'defeat', art: art.deepseekDefeat };
  if (actor.arrived || actor.phase === 'clear') return { name: 'idle', art: art.deepseekIdle };
  if (!actor.grounded)
    return actor.player.velocity.y * actor.engine.gravity.y < 0
      ? { name: 'jump', art: art.deepseekJump }
      : { name: 'fall', art: art.deepseekFall };
  if (actor.landingTicks > 0) return { name: 'land', art: art.deepseekLand };
  return Math.abs(actor.player.velocity.x) > 0.1
    ? { name: 'run', art: art.deepseekRun }
    : { name: 'idle', art: art.deepseekIdle };
}
function cloneFrames(actor: RoomRunner, owner: string) {
  return actor.clones.map((clone, index) => ({
    id: `${owner}-${index}`,
    label: `${owner}副${index + 1}`,
    rect: clone.rect,
    pose: characterPose(clone),
    facing: clone.facing,
    inverted: clone.engine.gravity.y < 0,
    done: clone.phase === 'clear',
    dead: clone.phase === 'dead',
  }));
}
const frame = computed(() => {
  void revision.value;
  const r = race.value?.runners[0] ?? runner.value;
  const opponent = race.value?.runners[1];
  return {
    rect: r.rect,
    phase: r.phase,
    arrived: r.arrived,
    copyTotal: 1 + r.clones.length,
    copyDone: [r, ...r.clones].filter((actor) => actor.arrived || actor.phase === 'clear').length,
    floors: r.floors,
    traps: r.traps,
    exit: r.exit,
    exitReady: r.exitReady,
    speech: r.speech,
    secret: r.secret,
    secretPoint: r.secretPoint,
    mines: r.room.traps
      .filter((trap) => trap.effect === 'mine')
      .map((trap) => ({
        body: trap.body,
        phase: r.traps.find((view) => view.trap.id === trap.id)?.phase ?? 'waiting',
      })),
    facing: r.facing,
    grounded: r.grounded,
    ticks: r.ticks,
    pose: characterPose(r),
    displayY: r.phase === 'dead' ? Math.max(80, Math.min(350, r.rect.y)) : r.rect.y,
    fuel: r.fuel,
    jetpack: r.jetpack,
    inverted: r.engine.gravity.y < 0,
    opponent: opponent
      ? {
          rect: opponent.rect,
          phase: opponent.phase,
          arrived: opponent.arrived,
          facing: opponent.facing,
          inverted: opponent.engine.gravity.y < 0,
          pose: characterPose(opponent),
          displayY:
            opponent.phase === 'dead'
              ? Math.max(80, Math.min(350, opponent.rect.y))
              : opponent.rect.y,
          fuel: opponent.fuel,
          jetpack: opponent.jetpack,
        }
      : null,
    winner: race.value?.winner ?? null,
    raceDeaths: race.value?.deaths ?? [0, 0],
    raceTicks: race.value?.ticks ?? 0,
    canSabotage: [race.value?.canSabotage(0) ?? false, race.value?.canSabotage(1) ?? false],
    clones: [
      ...cloneFrames(r, race.value ? 'P1' : ''),
      ...(opponent ? cloneFrames(opponent, 'P2') : []),
    ],
  };
});
const room = computed(() => runner.value.room);
const background = computed(() =>
  endless.value
    ? [art.background, art.serverArchive, art.parameterLab][endless.value.stage % 3]!
    : index.value >= 24
      ? art.parameterLab
      : index.value >= 4
        ? art.serverArchive
        : art.background,
);
const worldWidth = computed(() => room.value.width ?? 1000);
const cameraFrame = computed(() =>
  frameActors(worldWidth.value, raceMode.value ? 1000 : viewportWidth.value, [
    {
      x: frame.value.rect.x,
      width: frame.value.rect.w,
      finished: frame.value.arrived || frame.value.phase === 'clear',
    },
    ...(frame.value.opponent
      ? [
          {
            x: frame.value.opponent.rect.x,
            width: frame.value.opponent.rect.w,
            finished: frame.value.opponent.arrived || frame.value.opponent.phase === 'clear',
          },
        ]
      : []),
    ...frame.value.clones.map((clone) => ({
      x: clone.rect.x,
      width: clone.rect.w,
      finished: clone.done,
    })),
  ]),
);
const visibleWidth = computed(() => cameraFrame.value.width);
const camera = computed(() => cameraFrame.value.x);
function release() {
  keys.clear();
  touch.value = { left: false, right: false };
  touch2.value = { left: false, right: false };
  touchJump.value = [false, false];
  queued = false;
  queued2 = false;
  sabotage1 = sabotage2 = false;
}
function enter(i: number, preserveFailure = false) {
  hiddenReplay.pending = false;
  secretMode.value = false;
  customRoom.value = null;
  editorOpen.value = false;
  endless.value = null;
  endlessReplay.seed = null;
  if (!preserveFailure) {
    failure.value = '';
    failureTicks.value = 0;
  }
  runner.value.dispose();
  runner.value = openRoom(i);
  race.value?.dispose();
  race.value = raceMode.value ? new RaceRunner(CAMPAIGN[i]!) : null;
  index.value = i;
  release();
  select.value = false;
  revision.value++;
  if (
    document.activeElement instanceof HTMLElement &&
    document.activeElement.closest('.campaign-game')
  )
    document.activeElement.blur();
}
function persistEndless() {
  if (!endless.value) return;
  const best = Math.max(endlessSaved.value?.best ?? 0, endless.value.cleared);
  storageAvailable.value = saveEndless(endless.value, best);
  endlessSaved.value = { version: 1, run: { ...endless.value }, best };
}
function enterEndless(run: EndlessRun, preserveFailure = false) {
  hiddenReplay.pending = false;
  secretMode.value = false;
  customRoom.value = null;
  editorOpen.value = false;
  race.value?.dispose();
  race.value = null;
  raceMode.value = false;
  runner.value.dispose();
  runner.value = new RoomRunner(generateEndlessRoom(run.seed, run.stage));
  endless.value = run;
  if (!preserveFailure) {
    failure.value = '';
    failureTicks.value = 0;
  }
  release();
  select.value = false;
  revision.value++;
  persistEndless();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function startEndless() {
  if (props.paused) return;
  const raw = seedInput.value.trim();
  if (raw && (!/^\d{1,10}$/.test(raw) || Number(raw) > 0xffffffff)) {
    seedError.value = '种子应为 0–4294967295 的整数。';
    return;
  }
  seedError.value = '';
  const seed = raw ? Number(raw) : crypto.getRandomValues(new Uint32Array(1))[0]!;
  enterEndless(createEndless(seed));
}
function resumeEndless() {
  if (!props.paused && endlessSaved.value) enterEndless(nextEndless({ ...endlessSaved.value.run }));
}
function finishEndless() {
  if (props.paused || !endless.value) return;
  const run = endless.value;
  endlessReplay.seed = run.seed;
  if (runner.value.phase === 'playing') run.ticks += runner.value.ticks;
  persistEndless();
  release();
  emit('finish', {
    gameId: 'arena',
    sessionId: props.sessionId,
    outcome: 'completed',
    durationMs: run.ticks * FRAME_MS,
    summary: `无尽生成 · 通过 ${run.cleared} 局 · 秘密 ${run.secrets} · 失败 ${run.deaths} 次`,
    story: {
      title: '这次由你停止生成',
      body: `种子 ${run.seed}。这一串事故已经存好，随时可以接着续写。`,
      imageUrl: art.deepseekIdle.url,
    },
    stats: { stages: run.cleared, secrets: run.secrets, deaths: run.deaths },
    reselectLabel: '返回模式地图',
  });
}
function openEditor() {
  if (props.paused) return;
  release();
  select.value = false;
  editorOpen.value = true;
}
function playCustom(source: Room, preserveFailure = false) {
  if (props.paused || editorProblem(source)) return;
  const draft = normalizeRoom(source);
  hiddenReplay.pending = false;
  secretMode.value = false;
  if (!customRoom.value || encodeRoom(customRoom.value) !== encodeRoom(draft))
    customDeaths.value = 0;
  customRoom.value = draft;
  endless.value = null;
  endlessReplay.seed = null;
  race.value?.dispose();
  race.value = null;
  raceMode.value = false;
  runner.value.dispose();
  runner.value = new RoomRunner(draft);
  editorOpen.value = false;
  select.value = false;
  if (!preserveFailure) {
    failure.value = '';
    failureTicks.value = 0;
  }
  release();
  revision.value++;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function enterSecret(preserveFailure = false) {
  if (props.paused || !hiddenUnlocked(progress.value.discoveries)) return;
  secretMode.value = true;
  customRoom.value = null;
  endless.value = null;
  endlessReplay.seed = null;
  race.value?.dispose();
  race.value = null;
  raceMode.value = false;
  runner.value.dispose();
  runner.value = new RoomRunner(HIDDEN_ROOM);
  editorOpen.value = false;
  select.value = false;
  if (!preserveFailure) {
    failure.value = '';
    failureTicks.value = 0;
  }
  release();
  revision.value++;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}
function switchMode() {
  if (props.paused) return;
  raceMode.value = !raceMode.value;
  match.value = createMatch(index.value);
  enter(index.value);
}
function retry() {
  if (props.paused) return;
  if (secretMode.value) {
    enterSecret();
    return;
  }
  if (customRoom.value) {
    playCustom(customRoom.value);
    return;
  }
  if (endless.value) {
    enterEndless({ ...endless.value });
    return;
  }
  if (raceMode.value) {
    match.value = createMatch(match.value.start);
    enter(match.value.start);
  } else enter(index.value);
}
function chooseRoom(i: number) {
  if (props.paused) return;
  if (raceMode.value) match.value = createMatch(i);
  enter(i);
}
function skipRoom() {
  if (props.paused || !canSkip.value) return;
  if (journeyNext.value !== null) enter(journeyNext.value);
  else {
    select.value = true;
    release();
  }
}
function next() {
  if (props.paused) return;
  if (raceMode.value ? race.value?.winner === null : runner.value.phase !== 'clear') return;
  if (secretMode.value) {
    hiddenReplay.pending = true;
    emit('finish', {
      gameId: 'arena',
      sessionId: props.sessionId,
      outcome: 'win',
      durationMs: elapsed.value,
      summary: '三把密钥 · 隐藏协议完成 · 所有分身已确认',
      story: {
        title: '她没有写进回答的那一页',
        body: '你找到了失败里藏着的答案，也带着每一个副本走出了门。她终于没有再追加：“这一次，我们都确认了。”',
        imageUrl: art.deepseekIdle.url,
      },
      stats: { keys: progress.value.discoveries.length, hiddenEnding: 1 },
      reselectLabel: '重返关卡地图',
    });
    return;
  }
  if (customRoom.value) {
    openEditor();
    return;
  }
  if (endless.value) {
    enterEndless(nextEndless(endless.value));
    return;
  }
  if (raceMode.value) {
    if (champion.value !== null) {
      retry();
      return;
    }
    match.value = advanceRound(match.value);
    enter((match.value.start + match.value.round - 1) % CAMPAIGN.length);
    return;
  }
  if (journeyNext.value !== null) enter(journeyNext.value);
  else if (!allCleared.value) {
    select.value = true;
    release();
  } else
    emit('finish', {
      gameId: 'arena',
      sessionId: props.sessionId,
      outcome: 'win',
      durationMs: elapsed.value,
      summary: `${CAMPAIGN.length} 关完成 · 秘密 ${secretCount.value}/${CAMPAIGN.length} · 本次重试 ${deaths.value} 次`,
      story: {
        title:
          secretCount.value === CAMPAIGN.length ? '比训练数据更完整的答案' : '这次，真的停止生成了',
        body:
          secretCount.value === CAMPAIGN.length
            ? '所有灵感星都被你找到了。她看着满满的记录，承认：“这些答案是真的。”但地图上似乎还藏着另一段协议。'
            : '她正要补充“最后一个小改动”，你按住了生成键。出口是真的，走过的路也是真的。剩下的秘密，留给下一次。',
        imageUrl: art.deepseekIdle.url,
      },
      stats: { levels: CAMPAIGN.length, deaths: deaths.value, secrets: secretCount.value },
      reselectLabel: '重返关卡地图',
    });
}
function keydown(e: KeyboardEvent) {
  const control = (e.target as HTMLElement).closest<HTMLButtonElement>('.controls button');
  if (control && ['Space', 'Enter'].includes(e.code)) {
    e.preventDefault();
    if (props.paused || select.value || editorOpen.value || control.disabled) return;
    const label = control.getAttribute('aria-label') ?? '';
    const player = label.startsWith('P2') ? 1 : 0;
    const movement = player ? touch2.value : touch.value;
    unlockAudio();
    if (label.includes('向左')) movement.left = true;
    else if (label.includes('向右')) movement.right = true;
    else if (label.includes('跳跃')) {
      touchJump.value[player] = true;
      if (!e.repeat) {
        if (player) queued2 = true;
        else queued = true;
      }
    } else if (!e.repeat) sabotage(player);
    return;
  }
  if (
    props.paused ||
    editorOpen.value ||
    select.value ||
    e.ctrlKey ||
    e.metaKey ||
    (e.target as HTMLElement).closest('input,textarea,select,button,a')
  )
    return;
  if (
    ![
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'KeyA',
      'KeyD',
      'KeyW',
      'KeyS',
      'Space',
      'KeyR',
    ].includes(e.code)
  )
    return;
  e.preventDefault();
  unlockAudio();
  keys.add(e.code);
  if (!e.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    if (raceMode.value && e.code === 'ArrowUp') queued2 = true;
    else queued = true;
  }
  if (!e.repeat && e.code === 'KeyR') retry();
  if (!e.repeat && raceMode.value && e.code === 'KeyS') sabotage(0);
  if (!e.repeat && raceMode.value && e.code === 'ArrowDown') sabotage(1);
}
function keyup(e: KeyboardEvent) {
  keys.delete(e.code);
  if (
    ['Space', 'Enter'].includes(e.code) &&
    (e.target as HTMLElement).closest('.controls button')
  ) {
    touch.value = { left: false, right: false };
    touch2.value = { left: false, right: false };
    touchJump.value = [false, false];
  }
}
function press(e: PointerEvent, direction: 'left' | 'right', player = 0) {
  if (props.paused) return;
  e.preventDefault();
  unlockAudio();
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  (player === 0 ? touch.value : touch2.value)[direction] = true;
}
watch(
  () => props.paused,
  () => {
    release();
    if (props.paused) audio.suspend();
    else unlockAudio();
  },
);
watch(playfield, (element, previous) => {
  if (previous) resizeObserver?.unobserve(previous);
  if (element) resizeObserver?.observe(element);
});
onMounted(() => {
  if (props.attempt > 1 && props.restartMode === 'replay') {
    if (hiddenReplay.pending && hiddenUnlocked(progress.value.discoveries)) enterSecret();
    else if (endlessReplay.seed !== null) enterEndless(createEndless(endlessReplay.seed));
  }
  const preload = new Image();
  preload.src = art.deepseekJump.url;
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry) return;
    const width =
      window.innerWidth > 700
        ? 1000
        : Math.max(560, Math.min(1000, Math.round(entry.contentRect.width * 1.25)));
    if (width === viewportWidth.value) return;
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      viewportWidth.value = width;
    });
  });
  if (playfield.value) resizeObserver.observe(playfield.value);
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', release);
  timer = setInterval(() => {
    if (props.paused || select.value || editorOpen.value) return;
    if (discoveryTicks.value > 0) discoveryTicks.value--;
    if (failureTicks.value > 0) failureTicks.value--;
    if (race.value) {
      const before = race.value.winner;
      const beforeJumps = race.value.runners.map((r) => r.jumpCount);
      const beforeDeaths = [...race.value.deaths];
      race.value.step([
        {
          horizontal:
            Number(keys.has('KeyD') || touch.value.right) -
            Number(keys.has('KeyA') || touch.value.left),
          jump: queued,
          thrust: thrustInput(race.value.runners[0], 0),
          sabotage: sabotage1,
        },
        {
          horizontal:
            Number(keys.has('ArrowRight') || touch2.value.right) -
            Number(keys.has('ArrowLeft') || touch2.value.left),
          jump: queued2,
          thrust: thrustInput(race.value.runners[1], 1),
          sabotage: sabotage2,
        },
      ]);
      queued = queued2 = false;
      sabotage1 = sabotage2 = false;
      revision.value++;
      for (const player of [0, 1] as const) {
        const actor = race.value.runners[player];
        if (actor.jumpCount > beforeJumps[player]!) cue('jump');
        if (race.value.deaths[player] > beforeDeaths[player]!) {
          cue('death');
          failure.value = `P${player + 1}：${actor.deathReason}`;
          failureTicks.value = 120;
        }
      }
      if (before === null && race.value.winner !== null) {
        cue('clear');
        match.value = settleRound(match.value, race.value.winner);
        release();
      }
      return;
    }
    const r = runner.value;
    const before = r.phase;
    const beforeJumps = r.jumpCount;
    const beforeSecret = r.secret;
    const horizontal =
      Number(keys.has('ArrowRight') || keys.has('KeyD') || touch.value.right) -
      Number(keys.has('ArrowLeft') || keys.has('KeyA') || touch.value.left);
    r.step(horizontal, queued, undefined, thrustInput(r, 0));
    if (r.jumpCount > beforeJumps) cue('jump');
    if (!beforeSecret && r.secret) cue('secret');
    queued = false;
    revision.value++;
    if (before === 'playing') elapsed.value += FRAME_MS;
    if (before !== 'dead' && r.phase === 'dead') {
      cue('death');
      failure.value = r.deathReason;
      failureTicks.value = 120;
      if (customRoom.value) customDeaths.value++;
      else if (!endless.value) deaths.value++;
      if (endless.value) {
        endless.value = {
          ...endless.value,
          deaths: endless.value.deaths + 1,
          ticks: endless.value.ticks + r.ticks,
        };
        persistEndless();
      } else if (!customRoom.value) {
        progress.value = recordDeath(progress.value, room.value.id);
        const discovered = secretMode.value ? null : discoveryFor(r);
        if (discovered && !progress.value.discoveries.includes(discovered)) {
          progress.value = recordDiscovery(progress.value, discovered);
          discoveryNotice.value = DISCOVERIES.find((key) => key.id === discovered)!.name;
          discoveryTicks.value = 240;
          cue('secret');
        }
        persist();
      }
      release();
    }
    if (r.phase === 'dead' && r.deathTicks >= 22) {
      if (secretMode.value) enterSecret(true);
      else if (customRoom.value) playCustom(customRoom.value, true);
      else if (endless.value) enterEndless({ ...endless.value }, true);
      else enter(index.value, true);
    }
    if (before === 'playing' && r.phase === 'clear') {
      cue('clear');
      failureTicks.value = 0;
      release();
      if (secretMode.value) {
        progress.value = { ...progress.value, secretEnding: true };
        persist();
      } else if (customRoom.value) {
        storageAvailable.value = saveDraft(customRoom.value, true);
      } else if (endless.value) {
        endless.value = clearEndless(endless.value, r.ticks, r.secret);
        persistEndless();
      } else {
        progress.value = recordClear(progress.value, room.value.id, r.ticks, r.secret);
        persist();
      }
    }
  }, FRAME_MS);
});
onUnmounted(() => {
  audio.dispose();
  resizeObserver?.disconnect();
  cancelAnimationFrame(resizeFrame);
  clearInterval(timer);
  runner.value.dispose();
  race.value?.dispose();
  window.removeEventListener('keydown', keydown);
  window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', release);
});
</script>

<template>
  <ArenaEditor
    v-if="editorOpen"
    :paused="paused"
    :initial="editorDraft"
    @draft="editorDraft = $event"
    @play="playCustom"
    @close="
      editorOpen = false;
      select = true;
    "
  />
  <section
    v-else
    ref="gameSurface"
    tabindex="-1"
    class="campaign-game"
    :data-tick="frame.ticks"
    :data-race-tick="frame.raceTicks"
    :data-phase="frame.phase"
    :data-room="room.id"
    :data-mode="
      secretMode
        ? 'hidden'
        : customRoom
          ? 'custom'
          : endless
            ? 'endless'
            : raceMode
              ? 'race'
              : 'solo'
    "
  >
    <header>
      <div>
        <small
          >{{
            customRoom || endless || secretMode || raceMode ? room.chapter : journey.world.title
          }}
          ·
          {{
            secretMode
              ? '密钥已确认'
              : customRoom
                ? '试玩'
                : endless
                  ? `种子 ${endless.seed}`
                  : raceMode
                    ? `${index + 1}/${CAMPAIGN.length}`
                    : journey.door.finale
                      ? '世界组合评测'
                      : `第 ${journey.doorIndex + 1} 门 · ${journey.stage + 1}/5`
          }}</small
        >
        <h2>{{ room.title }}</h2>
        <small v-if="frame.copyTotal > 1">副本 {{ frame.copyDone }}/{{ frame.copyTotal }}</small>
      </div>
      <span v-if="raceMode" class="deaths"
        >第 {{ match.round }}/5 局<br />P1 {{ raceScore[0] }} : {{ raceScore[1] }} P2</span
      >
      <span v-else class="deaths"
        >失败 {{ customRoom ? customDeaths : endless ? endless.deaths : deaths }}</span
      >
      <button
        v-if="!customRoom"
        :title="raceMode ? '单人冒险' : '双人竞速'"
        :aria-label="raceMode ? '单人冒险' : '双人竞速'"
        :disabled="paused"
        @click="switchMode"
      >
        <User v-if="raceMode" :size="20" /><Users v-else :size="20" />
      </button>
      <button v-else aria-label="返回编辑器" title="返回编辑器" @click="openEditor">
        <Pencil />
      </button>
      <button
        :title="raceMode ? '重开比赛' : '重试本关'"
        :aria-label="raceMode ? '重开比赛' : '重试本关'"
        :disabled="paused"
        @click="retry"
      >
        <RotateCcw :size="20" />
      </button>
      <button
        title="选择关卡"
        aria-label="选择关卡"
        :disabled="paused"
        @click="
          select = !select;
          release();
        "
      >
        <Grid2X2 :size="20" />
      </button>
    </header>
    <p class="speech">
      <span>{{ discoveryTicks > 0 ? '密钥' : failureTicks > 0 ? '错误' : 'AI' }}</span
      >{{ discoveryTicks > 0 ? discoveryNotice : failureTicks > 0 ? failure : frame.speech }}
    </p>
    <p v-if="!storageAvailable" class="storage-error" role="status">本次记录未能保存。</p>
    <div ref="playfield" class="playfield">
      <svg :viewBox="`${camera} 0 ${visibleWidth} 440`" role="img" aria-label="AI 陷阱关卡">
        <image
          v-for="tile in Math.ceil(worldWidth / 1000)"
          :key="`background-${tile}`"
          :x="(tile - 1) * 1000"
          :href="background"
          width="1000"
          height="440"
          preserveAspectRatio="xMidYMid slice"
          opacity=".8"
        />
        <g v-for="(floor, i) in frame.floors" :key="`floor-${i}`">
          <rect :x="floor.x" :y="floor.y" :width="floor.w" :height="floor.h" fill="#244447" />
          <rect :x="floor.x" :y="floor.y" :width="floor.w" height="6" fill="#73e5ba" />
        </g>
        <g
          v-for="view in frame.traps"
          :key="view.trap.id"
          :opacity="
            view.phase === 'warning'
              ? 0.35
              : view.phase === 'spent'
                ? view.trap.effect === 'gate'
                  ? 0.12
                  : 0
                : 1
          "
        >
          <circle
            v-if="view.trap.effect === 'mine' && view.phase === 'active'"
            :cx="view.body.x + view.body.w / 2"
            :cy="view.body.y + view.body.h / 2"
            :r="view.body.w / 2"
            fill="#ff8d57"
            fill-opacity=".6"
            stroke="#fff2c6"
            stroke-width="4"
          />
          <g
            v-if="view.trap.effect === 'seeker'"
            data-testid="seeker"
            :transform="`translate(${view.body.x + 12},${view.body.y + 12})`"
          >
            <circle r="12" fill="#da526b" stroke="#fff1c6" stroke-width="3" />
            <path d="M-6 0H6M0 -6V6" stroke="#fff" stroke-width="2" />
          </g>
          <rect
            v-if="view.trap.effect === 'pit' && view.phase === 'warning'"
            data-testid="collapse-warning"
            :x="view.body.x"
            :y="view.body.y"
            :width="view.body.w"
            :height="Math.min(12, view.body.h)"
            fill="#ff546d"
            stroke="#ffe2a3"
            stroke-dasharray="8 5"
            stroke-width="3"
          />
          <g v-if="view.trap.effect === 'wall'">
            <rect
              :x="view.body.x"
              :y="view.body.y"
              :width="view.body.w"
              :height="view.body.h"
              fill="#355b68"
              stroke="#a4e8ff"
              stroke-width="4"
            />
            <path
              :d="`M${view.body.x + 8} ${view.body.y + 12} v${view.body.h - 24}`"
              stroke="#a4e8ff"
              stroke-width="3"
              stroke-dasharray="10 8"
            />
          </g>
          <g
            v-if="['ice', 'wind', 'lowJump'].includes(view.trap.effect)"
            :data-testid="`field-${view.trap.effect}`"
          >
            <rect
              :x="view.body.x"
              y="340"
              :width="view.body.w"
              height="14"
              :fill="
                view.trap.effect === 'ice'
                  ? '#94dcff'
                  : view.trap.effect === 'wind'
                    ? '#a6eaca'
                    : '#f7c775'
              "
              opacity=".8"
            />
            <text :x="view.body.x + 22" y="332" fill="#25434d" font-size="18" font-weight="bold">
              {{
                view.trap.effect === 'ice' ? '≈' : view.trap.effect === 'wind' ? '← ← ←' : '4bit'
              }}
            </text>
          </g>
          <g v-if="view.trap.effect === 'bounce'" data-testid="bounce-pad">
            <rect
              :x="view.body.x"
              :y="view.body.y"
              :width="view.body.w"
              :height="view.body.h"
              fill="#ffc96f"
              stroke="#fff"
              stroke-width="2"
            />
            <path
              :d="`M${view.body.x + 15} ${view.body.y - 4} l10,-12 10,12 m10,0 l10,-12 10,12`"
              stroke="#b65b27"
              stroke-width="4"
              fill="none"
            />
          </g>
          <g
            v-if="view.trap.effect === 'decoy'"
            :transform="`translate(${view.body.x},${view.body.y})`"
            data-testid="decoy-door"
          >
            <rect
              :width="view.body.w"
              :height="view.body.h"
              rx="4"
              fill="#244447"
              stroke="#73e5ba"
              stroke-width="4"
            />
            <path d="M12 32 H36 M27 23 L36 32 27 41" fill="none" stroke="#fff" stroke-width="4" />
            <text :x="view.body.w / 2" y="-12" fill="#245950" font-size="16" text-anchor="middle">
              99.9%
            </text>
          </g>
          <g
            v-if="view.trap.effect === 'saw'"
            :transform="`translate(${view.body.x + view.body.w / 2},${view.body.y + view.body.h / 2})`"
          >
            <circle
              r="22"
              fill="#f5627b"
              stroke="#fff0d8"
              stroke-width="4"
              stroke-dasharray="6 4"
            />
            <circle r="9" fill="#29494d" />
            <path d="M-16 0 H16 M0 -16 V16" stroke="#fff0d8" stroke-width="3" />
          </g>
          <g v-if="view.trap.effect === 'gate'">
            <rect
              data-testid="gate-body"
              :x="view.body.x"
              :y="view.body.y"
              :width="view.body.w"
              :height="view.body.h"
              fill="#f5627b"
            />
            <path
              :d="`M${view.body.x + 14} ${view.body.y} v${view.body.h}`"
              stroke="#fff0d8"
              stroke-width="5"
              stroke-dasharray="8 5"
            />
            <text
              :x="view.body.x + 14"
              :y="view.body.y - 12"
              text-anchor="middle"
              fill="#7d203c"
              font-size="20"
              font-weight="bold"
            >
              429
            </text>
          </g>
          <g v-if="view.trap.effect === 'platform'">
            <rect
              data-testid="platform-body"
              :x="view.body.x"
              :y="view.body.y"
              :width="view.body.w"
              :height="view.body.h"
              rx="5"
              fill="#ffc96f"
              stroke="#fff0d8"
              stroke-width="3"
            />
            <path
              :d="`M${view.body.x + 10} ${view.body.y + 10} h${view.body.w - 20}`"
              stroke="#805924"
              stroke-width="3"
              stroke-dasharray="12 6"
            />
          </g>
          <path
            v-if="view.trap.effect === 'spikes'"
            data-testid="spike-hazard"
            :d="`M${view.body.x},${view.body.y + view.body.h} l10,-30 10,30 10,-30 10,30 10,-30 10,30 Z`"
            :transform="
              view.body.y < 200
                ? `translate(0,${view.body.y * 2 + view.body.h}) scale(1,-1)`
                : undefined
            "
            fill="#fa6476"
            stroke="#fff0d8"
            stroke-width="2"
          />
          <g v-if="view.trap.effect === 'falling'">
            <rect
              data-testid="falling-body"
              :x="view.body.x"
              :y="view.body.y"
              :width="view.body.w"
              :height="view.body.h"
              fill="#fa6476"
              stroke="#fff0d8"
              stroke-width="3"
              rx="4"
            />
            <text
              :x="view.body.x + view.body.w / 2"
              :y="view.body.y + 31"
              text-anchor="middle"
              fill="#342438"
              font-size="22"
            >
              …
            </text>
          </g>
        </g>
        <g
          :transform="`translate(${frame.exit.x},${frame.exit.y})`"
          :opacity="frame.exitReady ? 1 : 0.5"
          :data-moving="!frame.exitReady"
        >
          <rect
            :width="frame.exit.w"
            :height="frame.exit.h"
            rx="4"
            fill="#244447"
            :stroke="secretMode ? '#cc9bff' : '#73e5ba'"
            stroke-width="4"
          />
          <path d="M12 32 H36 M27 23 L36 32 27 41" fill="none" stroke="#fff" stroke-width="4" />
          <path
            v-if="!frame.exitReady"
            d="M8 8L40 54M40 8L8 54"
            stroke="#ffc96f"
            stroke-width="3"
          />
        </g>
        <g v-for="(mine, i) in frame.mines" :key="`mine-${i}`" data-testid="poison-token">
          <text
            v-if="mine.phase === 'waiting' || mine.phase === 'warning'"
            :x="mine.body.x + 12"
            :y="mine.body.y + 22"
            text-anchor="middle"
            :fill="mine.phase === 'warning' ? '#ff536c' : '#9072b4'"
            stroke="#ffd5d5"
            stroke-width="1"
            font-size="28"
          >
            ✦
          </text>
        </g>
        <text
          v-if="!frame.secret"
          :x="frame.secretPoint.x"
          :y="frame.secretPoint.y"
          text-anchor="middle"
          fill="#ffc96f"
          :font-size="frame.secretPoint.radius"
        >
          ✦
        </text>
        <g
          v-for="clone in frame.clones"
          :key="clone.id"
          data-testid="controlled-clone"
          :data-x="clone.rect.x"
          :data-done="clone.done"
          :transform="`translate(${clone.rect.x + 16},${clone.rect.y + (clone.inverted ? 0 : 48)})`"
          :opacity="clone.done || clone.dead ? 0.35 : 0.85"
        >
          <g
            :transform="`scale(${clone.facing},${clone.inverted ? -1 : 1})`"
            style="filter: hue-rotate(45deg)"
          >
            <CharacterSprite :art="clone.pose.art" />
          </g>
          <text
            y="-80"
            text-anchor="middle"
            fill="#435e82"
            stroke="white"
            stroke-width=".5"
            font-size="16"
          >
            {{ clone.done ? '✓' : clone.label }}
          </text>
        </g>
        <g
          data-testid="campaign-player"
          :data-x="frame.rect.x"
          :data-y="frame.rect.y"
          :data-grounded="frame.grounded"
          :data-fuel="frame.fuel"
          :data-pose="frame.pose.name"
          :transform="`translate(${frame.rect.x + 16},${frame.displayY + (frame.inverted ? 0 : 48)}) scale(${frame.facing},${frame.inverted ? -1 : 1})`"
          :opacity="frame.phase === 'dead' ? 0.7 : frame.arrived ? 0.35 : 1"
        >
          <CharacterSprite :art="frame.pose.art" />
          <g v-if="frame.jetpack">
            <rect x="-16" y="8" width="32" height="4" fill="#28443f" />
            <rect x="-16" y="8" :width="(32 * frame.fuel) / 60" height="4" fill="#ffc96f" />
          </g>
        </g>
        <g
          v-if="frame.opponent"
          data-testid="race-player-2"
          :data-x="frame.opponent.rect.x"
          :data-y="frame.opponent.rect.y"
          :data-pose="frame.opponent.pose.name"
          :transform="`translate(${frame.opponent.rect.x + 16},${frame.opponent.displayY + (frame.opponent.inverted ? 0 : 48)})`"
          :opacity="frame.opponent.phase === 'dead' ? 0.7 : frame.opponent.arrived ? 0.35 : 1"
        >
          <g
            :transform="`scale(${frame.opponent.facing},${frame.opponent.inverted ? -1 : 1})`"
            style="filter: hue-rotate(115deg)"
          >
            <CharacterSprite :art="frame.opponent.pose.art" />
            <g v-if="frame.opponent.jetpack">
              <rect x="-16" y="8" width="32" height="4" fill="#28443f" />
              <rect
                x="-16"
                y="8"
                :width="(32 * frame.opponent.fuel) / 60"
                height="4"
                fill="#ffc96f"
              />
            </g>
          </g>
          <text
            y="-104"
            text-anchor="middle"
            fill="#902b43"
            stroke="#fff"
            stroke-width="1"
            font-weight="bold"
            font-size="20"
          >
            P2
          </text>
        </g>
        <text
          v-if="raceMode"
          :x="frame.rect.x + 16"
          :y="frame.rect.y - 34"
          text-anchor="middle"
          fill="#174ab3"
          stroke="#fff"
          stroke-width="1"
          font-weight="bold"
          font-size="20"
        >
          P1
        </text>
      </svg>
      <div v-if="raceMode ? frame.winner !== null : frame.phase === 'clear'" class="overlay">
        <h3>
          {{
            raceMode
              ? champion !== null
                ? `P${champion + 1} 赢得本场！`
                : frame.winner === 'draw'
                  ? '同时抵达！'
                  : `P${Number(frame.winner) + 1} 抢先发布！`
              : '这次，听我的。'
          }}
        </h3>
        <p
          v-if="
            !raceMode &&
            !customRoom &&
            !endless &&
            !secretMode &&
            (journey.door.finale || journey.stage === 4)
          "
          class="journey-milestone"
        >
          {{
            journey.door.finale
              ? `${journey.world.title}已完成`
              : `第 ${journey.doorIndex + 1} 门已完成`
          }}
        </p>
        <button @click="next">
          <DoorOpen :size="20" />{{
            secretMode
              ? '确认隐藏协议'
              : customRoom
                ? '返回编辑'
                : endless
                  ? '继续生成'
                  : raceMode
                    ? champion !== null
                      ? '再来一场'
                      : frame.winner === 'draw'
                        ? '重赛本局'
                        : '下一局'
                    : journeyNext === null
                      ? allCleared
                        ? '完成'
                        : '关卡地图'
                      : '下一关'
          }}
        </button>
        <button v-if="raceMode && champion === null" @click="retry">
          <RotateCcw :size="20" />再赛一局
        </button>
        <p v-if="secretMode" class="run-record">全部副本已抵达</p>
        <p v-else-if="customRoom" class="run-record">
          试玩通关 · {{ (runner.ticks / 60).toFixed(2) }}s
        </p>
        <p v-else-if="endless" class="run-record">
          已通过 {{ endless.cleared }} 局 · 秘密 {{ endless.secrets }} · 最佳
          {{ endlessSaved?.best ?? 0 }} 局
        </p>
        <p v-else-if="!raceMode" class="run-record">
          {{ (runner.ticks / 60).toFixed(2) }}s · 最佳
          {{ ((progress.rooms[room.id]?.bestTicks ?? 0) / 60).toFixed(2) }}s
          <span v-if="frame.secret">· 秘密已收集</span>
        </p>
      </div>
      <div
        v-if="select"
        ref="mapDialog"
        class="selector"
        role="dialog"
        aria-label="关卡地图"
        @keydown="mapKeyboard"
      >
        <div class="map-heading">
          <h3>关卡地图</h3>
          <span>{{ completed.length }}/{{ CAMPAIGN.length }} <Check :size="15" /></span>
          <span>{{ secretCount }}/{{ CAMPAIGN.length }} <Star :size="15" /></span>
          <button aria-label="返回当前关卡" title="返回当前关卡" @click="closeMap">
            <X :size="20" />
          </button>
        </div>
        <div class="map-chapters">
          <section v-for="world in journeyMaps" :key="world.id">
            <h4>
              {{ world.title }}
              <small
                >{{
                  world.doors
                    .flatMap((door) => door.rooms)
                    .filter((entry) => completed.includes(entry.id)).length
                }}/{{ world.doors.flatMap((door) => door.rooms).length }}</small
              >
            </h4>
            <div v-for="door in world.doors" :key="door.id">
              <h5>
                {{ door.title }}
                <small
                  >{{ door.rooms.filter((entry) => completed.includes(entry.id)).length }}/{{
                    door.rooms.length
                  }}</small
                >
              </h5>
              <div class="map-rooms">
                <button
                  v-for="entry in door.rooms"
                  :key="entry.id"
                  :aria-current="entry.index === index ? 'step' : undefined"
                  @click="chooseRoom(entry.index)"
                >
                  <span>{{ String(entry.order).padStart(2, '0') }}</span>
                  {{ entry.title }}<Check v-if="completed.includes(entry.id)" :size="16" />
                  <Star v-if="progress.rooms[entry.id]?.secret" :size="16" fill="currentColor" />
                  <small v-if="progress.rooms[entry.id]?.bestTicks"
                    >{{ ((progress.rooms[entry.id]?.bestTicks ?? 0) / 60).toFixed(2) }}s</small
                  >
                </button>
              </div>
            </div>
          </section>
          <section class="hidden-menu">
            <h4>
              隐藏协议
              <small>{{ progress.discoveries.length }}/{{ DISCOVERIES.length }} 密钥</small>
            </h4>
            <div class="map-rooms">
              <div v-for="key in DISCOVERIES" :key="key.id" class="key-entry" :title="key.hint">
                <KeyRound v-if="progress.discoveries.includes(key.id)" :size="18" /><LockKeyhole
                  v-else
                  :size="18"
                />
                <span>{{ progress.discoveries.includes(key.id) ? key.name : '未发现' }}</span
                ><small>{{ key.hint }}</small>
              </div>
            </div>
            <button :disabled="!hiddenUnlocked(progress.discoveries)" @click="enterSecret(false)">
              <KeyRound :size="18" />进入隐藏协议
            </button>
            <small v-if="progress.secretEnding">已完成隐藏结局</small>
          </section>
          <section>
            <h4>玩家工坊</h4>
            <button @click="openEditor"><Pencil :size="18" />创建关卡</button>
          </section>
          <section class="endless-menu">
            <h4>
              无尽生成 <small>最佳 {{ endlessSaved?.best ?? 0 }} 局</small>
            </h4>
            <form @submit.prevent="startEndless">
              <input
                v-model="seedInput"
                inputmode="numeric"
                maxlength="10"
                aria-label="生成种子"
                placeholder="随机种子"
              />
              <button type="submit"><InfinityIcon :size="18" />无尽生成</button>
              <button v-if="endlessSaved" type="button" @click="resumeEndless">继续无尽</button>
            </form>
            <p v-if="seedError" role="alert">{{ seedError }}</p>
            <button v-if="endless" @click="finishEndless"><Flag :size="18" />结束挑战</button>
          </section>
        </div>
      </div>
    </div>
    <nav class="controls" aria-label="移动控制" :inert="select" @focusout="release">
      <span v-if="raceMode" class="player-label">P1</span>
      <button
        aria-label="向左移动"
        @pointerdown="press($event, 'left')"
        @pointerup="touch.left = false"
        @pointercancel="touch.left = false"
        @lostpointercapture="touch.left = false"
      >
        <ArrowLeft />
      </button>
      <button
        aria-label="向右移动"
        @pointerdown="press($event, 'right')"
        @pointerup="touch.right = false"
        @pointercancel="touch.right = false"
        @lostpointercapture="touch.right = false"
      >
        <ArrowRight />
      </button>
      <button
        class="jump"
        aria-label="跳跃"
        @pointerdown.prevent="queueJump"
        @pointerup="touchJump[0] = false"
        @pointercancel="touchJump[0] = false"
        @lostpointercapture="touchJump[0] = false"
      >
        <ArrowUp />
      </button>
      <button
        v-if="raceMode"
        aria-label="P1 追加需求"
        title="P1 追加需求"
        aria-keyshortcuts="S"
        :disabled="paused || !frame.canSabotage[0]"
        @pointerdown.prevent="sabotage(0)"
        @click="sabotage(0)"
      >
        <Zap />
      </button>
    </nav>
    <div class="sound-control" :inert="select">
      <button v-if="canSkip" :disabled="paused" @click="skipRoom">
        <SkipForward :size="18" />跳过本关
      </button>
      <button
        :aria-label="sound ? '关闭音效' : '开启音效'"
        :title="sound ? '关闭音效' : '开启音效'"
        :aria-pressed="sound"
        @click="toggleSound"
      >
        <Volume2 v-if="sound" :size="18" /><VolumeX v-else :size="18" />
      </button>
    </div>
    <nav
      v-if="raceMode"
      class="controls second-controls"
      aria-label="P2 移动控制"
      :inert="select"
      @focusout="release"
    >
      <span class="player-label">P2</span>
      <button
        aria-label="P2 向左移动"
        @pointerdown="press($event, 'left', 1)"
        @pointerup="touch2.left = false"
        @pointercancel="touch2.left = false"
        @lostpointercapture="touch2.left = false"
      >
        <ArrowLeft />
      </button>
      <button
        aria-label="P2 向右移动"
        @pointerdown="press($event, 'right', 1)"
        @pointerup="touch2.right = false"
        @pointercancel="touch2.right = false"
        @lostpointercapture="touch2.right = false"
      >
        <ArrowRight />
      </button>
      <button
        class="jump"
        aria-label="P2 跳跃"
        @pointerdown.prevent="queueJump2"
        @pointerup="touchJump[1] = false"
        @pointercancel="touchJump[1] = false"
        @lostpointercapture="touchJump[1] = false"
      >
        <ArrowUp />
      </button>
      <button
        aria-label="P2 追加需求"
        title="P2 追加需求"
        aria-keyshortcuts="ArrowDown"
        :disabled="paused || !frame.canSabotage[1]"
        @pointerdown.prevent="sabotage(1)"
        @click="sabotage(1)"
      >
        <Zap />
      </button>
    </nav>
  </section>
</template>

<style scoped>
.campaign-game {
  width: 100%;
  max-width: min(100%, calc((100dvh - 470px) * 2.2727));
  min-width: min(100%, 460px);
  margin-inline: auto;
  color: #edf9ed;
  background: #162a30;
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
}
header div {
  flex: 1;
  min-width: 0;
}
h2 {
  margin: 4px 0 0;
  font-size: 20px;
}
small,
.deaths {
  color: #a9c5bb;
  font-size: 12px;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  border: 1px solid #65837a;
  border-radius: 6px;
  background: #28443f;
  color: #fff;
  cursor: pointer;
  touch-action: none;
}
button:hover {
  background: #3d6252;
}
button:focus-visible {
  outline: 3px solid #ffc96f;
  outline-offset: 2px;
}
.speech {
  margin: 0;
  padding: 12px 18px;
  min-height: 48px;
  font-size: 14px;
  background: #f4dfc0;
  color: #413331;
}
.speech span {
  margin-right: 12px;
  font-weight: 800;
  color: #ad3753;
}
.playfield {
  position: relative;
  background: #9bc6bd;
}
.playfield > svg {
  display: block;
  width: 100%;
  height: auto;
}
button > svg {
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
}
.overlay > button {
  min-width: 140px;
  white-space: nowrap;
  margin: 4px 0;
}
.controls {
  display: flex;
  gap: 14px;
  padding: 12px 18px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.sound-control {
  display: flex;
  justify-content: flex-end;
  padding: 0 18px 8px;
}
.sound-control button {
  min-width: 36px;
  min-height: 36px;
  padding: 6px;
}
.player-label {
  align-self: center;
  font-weight: 700;
  color: #80d7ff;
}
.second-controls {
  border-top: 1px solid #65837a;
}
.second-controls .player-label {
  color: #ffacba;
}
.controls button {
  width: 64px;
  height: 52px;
}
.controls .jump {
  margin-left: auto;
  background: #a33f59;
}
.overlay,
.selector {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  background: #142c30e8;
}
.selector {
  justify-content: flex-start;
  align-items: stretch;
  gap: 8px;
  padding: 16px;
  overflow: hidden;
}
.map-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
}
.map-heading h3 {
  margin: 0;
  flex: 1;
  font-size: 17px;
}
.map-heading span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
}
.map-chapters {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  flex: 1;
  overscroll-behavior: contain;
}
.map-chapters > section {
  flex: 0 0 auto;
}
@media (max-width: 700px) {
  .campaign-game {
    max-width: 100%;
    min-width: 0;
  }
}
.endless-menu form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.key-entry {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 0;
  font-size: 13px;
}
.key-entry small {
  flex-basis: 100%;
  line-height: 1.5;
}
.hidden-menu > button {
  margin-top: 8px;
}
.endless-menu input {
  min-width: 0;
  width: 130px;
  padding: 8px;
  color: #fff;
  background: #243f43;
  border: 1px solid #65837a;
  border-radius: 4px;
}
.endless-menu > button {
  margin-top: 8px;
}
.map-chapters h4 {
  margin: 12px 0 8px;
  font-size: 14px;
}
.map-chapters h4 small {
  margin-left: 10px;
}
.map-chapters h5 {
  margin: 10px 0 7px;
  font-size: 13px;
  font-weight: 500;
}
.map-chapters h5 small {
  margin-left: 8px;
}
.map-rooms {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.map-rooms button {
  min-height: 44px;
}
.map-rooms button[aria-current] {
  border-color: #ffc96f;
  background: #40564c;
}
.selector button {
  font-size: 13px;
  justify-content: flex-start;
}
.selector span {
  color: #ffc96f;
}
.storage-error {
  margin: 0;
  padding: 6px 18px;
  color: #ffd594;
}
.run-record,
.journey-milestone {
  font-size: 13px;
  color: #c7e3d2;
}
.selector button {
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .controls {
    gap: 8px;
    padding-left: 10px;
    padding-right: 10px;
  }
  .controls button {
    flex: 0 1 60px;
    min-width: 44px;
  }
  header {
    padding: 10px;
    gap: 6px;
  }
  h2 {
    font-size: 16px;
  }
  .selector {
    padding: 6px;
    gap: 4px;
  }
  .selector button {
    min-height: 36px;
    font-size: 11px;
  }
}
</style>
