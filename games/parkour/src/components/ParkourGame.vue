<script lang="ts">
let inMemoryLevel: import('../rules').LevelId = 0;
let inMemoryMode: import('../rules').ThinkingMode = 'normal';
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Heart,
  MessageCircle,
  Play,
  ShieldCheck,
  Undo2,
  Zap,
} from '@lucide/vue';
import { ASSETS } from '@moecore/assets';
import { PARKOUR_PORTRAITS } from '@moecore/assets/parkour-portraits';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import AnswerSeaStage from './AnswerSeaStage.vue';
import { createRunnerSound } from '../sound';
import { officeAssetIds } from '../config/art';
import { reactionActionSprites, reactionPortraits } from '../config/reactions';
import { beginMissionAdventure, type MissionOptions } from '../rules/journey';
import { challengesFor, challengeStorageKey, mergeBadges } from '../config/challenges';
import { endingFor, opening, quips, runnerBarks } from '../config/story';
import {
  advanceAdventure,
  beginAdventure,
  CONTEXT_CAPACITY,
  departmentAt,
  FIXED_DT,
  levelFor,
  levels,
  multiplierFor,
  tailActionFor,
  seedForSession,
  thinkingModes,
  type LevelId,
  type ThinkingMode,
} from '../rules';

const props = defineProps<GameProps & { mission?: MissionOptions }>();
const muted = ref(false);
try {
  muted.value = localStorage.getItem('moecore:parkour:muted') === 'true';
} catch {
  /* Session default. */
}
const sound = createRunnerSound(() => (muted.value ? 0 : props.settings.masterVolume));
function toggleSound() {
  muted.value = !muted.value;
  if (muted.value) sound.stop();
  else sound.unlock();
  try {
    localStorage.setItem('moecore:parkour:muted', String(muted.value));
  } catch {
    /* Session preference remains. */
  }
}
const emit = defineEmits<
  GameEvents & { rhythm: []; flight: []; journey: []; progress: [milliseconds: number] }
>();
const phase = ref<'ready' | 'countdown' | 'running' | 'ended'>('ready');
const modeKey = 'moecore:parkour:thinking-mode';
const levelKey = 'moecore:parkour:level';
function rememberLevel(id: LevelId) {
  inMemoryLevel = id;
  try {
    sessionStorage.setItem(levelKey, String(id));
  } catch {
    // In-memory selection keeps next-level navigation working for this visit.
  }
}
function savedLevel(): LevelId {
  try {
    const saved = sessionStorage.getItem(levelKey);
    if (saved === '0' || saved === '1' || saved === '2' || saved === '3')
      return Number(saved) as LevelId;
  } catch {
    return inMemoryLevel;
  }
  return inMemoryLevel;
}
const bestKey = 'moecore:parkour:best-score:v2';
const bestKeyFor = (id: LevelId) => `${bestKey}:${id}`;
function savedBest(levelId: LevelId): number {
  try {
    const value = Number(localStorage.getItem(bestKeyFor(levelId)));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}
function savedMode(): ThinkingMode {
  try {
    const saved = sessionStorage.getItem(modeKey);
    if (saved === 'quick' || saved === 'normal' || saved === 'deep') return saved;
  } catch {
    // Private browsing can deny storage; retain this page's selected pace.
  }
  return inMemoryMode;
}
const selectedMode = ref<ThinkingMode>(props.mission ? 'normal' : savedMode());
const selectedLevel = ref<LevelId>(props.mission?.levelId ?? savedLevel());
if (!props.mission) {
  inMemoryMode = selectedMode.value;
  inMemoryLevel = selectedLevel.value;
}
const bestScore = ref(savedBest(selectedLevel.value));
const modeOptions = Object.entries(thinkingModes) as [
  ThinkingMode,
  (typeof thinkingModes)[ThinkingMode],
][];
const state = shallowRef(
  props.mission
    ? beginMissionAdventure(seedForSession(props.sessionId), props.mission)
    : beginAdventure(seedForSession(props.sessionId), selectedMode.value, selectedLevel.value),
);
const art = shallowRef<Readonly<Record<string, string>>>({});
const challenges = computed(() => (props.mission ? [] : challengesFor(state.value)));
function readBadges(): string[] {
  try {
    return mergeBadges(
      JSON.parse(localStorage.getItem(challengeStorageKey(state.value.levelId)) ?? '[]'),
      challenges.value.map((challenge) => ({ ...challenge, earned: false })),
    );
  } catch {
    return [];
  }
}
const savedBadges = ref<string[]>(readBadges());
const artError = ref(false);
const artLoading = ref(true);
const stage = ref<InstanceType<typeof AnswerSeaStage>>();
const controls = ref<HTMLElement>();
const score = computed(
  () => state.value.run.score - Math.floor((props.mission?.from ?? 0) * 10) + state.value.bonus,
);
const dialogue = computed(() => quips[state.value.quip]);
const portrait = computed(
  () =>
    (phase.value !== 'ready' && reactionPortraits[state.value.quip]) ||
    PARKOUR_PORTRAITS[phase.value === 'ready' ? opening.portrait : dialogue.value.portrait],
);
const feedbackCopy = {
  break: { priority: 0, text: '障碍清空' },
  rice: { priority: 1, text: '白饭 +1 · 算力 +35' },
  feast: { priority: 2, text: '白饭二连！额外加分' },
  parry: { priority: 2, text: '补充说明，退回' },
  perfect: { priority: 7, text: '精准退订！额外加分 · 快速回尾' },
  return: { priority: 3, text: '回音已停' },
  verified: { priority: 4, text: '假饭撤回 · 核验 +1' },
  shield: { priority: 5, text: '上下文挡住了' },
  milestone: { priority: 6, text: '里程碑 +250 分 · 算力 +25' },
} as const;
const notice = computed(() => {
  let selected: (typeof state.value.feedback)[number] | undefined;
  for (const feedback of state.value.feedback) {
    if (!selected || feedbackCopy[feedback.kind].priority >= feedbackCopy[selected.kind].priority)
      selected = feedback;
  }
  return selected ? { kind: selected.kind, text: feedbackCopy[selected.kind].text } : null;
});
const department = computed(() => departmentAt(state.value.run.distance, state.value.levelId));
const level = computed(() => levelFor(state.value.levelId));
const active = computed(() => phase.value === 'running' && !props.paused);
const charged = computed(() => state.value.energy === 100);
const tailName = computed(() =>
  tailActionFor(state.value) === 'return'
    ? '退回补充说明'
    : tailActionFor(state.value) === 'verify'
      ? '核验这碗饭'
      : charged.value
        ? '大肥鱼出击'
        : '尾巴回信',
);
const tailDescription = computed(() => tailName.value);
const coach = computed(() => {
  if (phase.value === 'ready' || phase.value === 'ended') return '';
  const current = state.value;
  const distance = current.run.distance;
  if (current.hasAnswer && current.levelId > 0 && current.levelId < 3) {
    const gate = levelFor(current.levelId).finalObstacles.find(([, kind]) => kind === 'air');
    if (gate && distance > gate[0] - 20 && distance < gate[0] + 2)
      return '验收还没完：先滑铲，再跳过返工单！';
  }
  if (phase.value === 'countdown' || distance < 10) return '空格 / 点跑道跳跃，再按一次可二段跳';
  const obstacle = current.run.obstacles.find(
    (item) => item.id < 100 && item.x > distance && item.x - distance < 15,
  );
  if (distance < 70 && obstacle)
    return obstacle.kind === 'ground'
      ? '前方文档堆：空格 / 点跑道跳跃'
      : '前方低横梁：↓ / 下划滑铲';
  if (
    (current.levelId === 3 || distance < 140) &&
    (current.papers.some((paper) => !paper.returned && paper.x - distance < 10) ||
      current.printers.some(
        (printer) => !printer.fired && printer.fireTick !== null && printer.x - distance < 15,
      ))
  )
    return '纸团来了：X / 右划甩尾退回';
  if (
    distance < (levelFor(current.levelId).hallucinations[0] ?? Infinity) &&
    current.hallucinations.some((item) => item.x > distance && item.x - distance < 10)
  )
    return '问号饭别直接吃：X / 右划核验';
  if (
    current.levelId === 3 &&
    distance < 300 &&
    current.queues.some((item) => item.x > distance && item.x - distance < 10)
  )
    return '服务器繁忙：跳过移动队伍';
  if (current.riceStreak === 1 && distance < 78) return '再拿一碗白饭，触发二连奖励';
  if (current.levelId === 3 && distance < 18) return '吃白饭？先追上本鱼！';
  return '';
});
const runnerCue = computed(() => {
  if (phase.value !== 'running' && phase.value !== 'countdown') return null;
  if (state.value.run.player.y > 1.5) return null;
  if (notice.value)
    return {
      line: runnerBarks[state.value.quip] ?? dialogue.value.line,
      image: portrait.value,
      kind: 'quip' as const,
    };
  if (coach.value)
    return {
      line: coach.value,
      image: '',
      kind: 'guide' as const,
    };
  if (state.value.quip !== 'ready' && state.value.realTick < state.value.quipUntil)
    return {
      line: runnerBarks[state.value.quip] ?? dialogue.value.line,
      image: portrait.value,
      kind: 'quip' as const,
    };
  return null;
});
const input = { jump: false, crouch: false, tail: false };
let jumpQueued = false;
let tailQueued = false;
let slideTicks = 0;
let frameId = 0;
let previousTime: number | undefined;
let accumulator = 0;
let countdownTicks = 36;
let disposed = false;
let loadVersion = 0;
let finished = false;

async function loadArt() {
  const version = ++loadVersion;
  artLoading.value = true;
  artError.value = false;
  try {
    const { loadWhaleRunnerAssets } = await import('@moecore/assets/whale-runner');
    const urls = await loadWhaleRunnerAssets(officeAssetIds);
    await Promise.all(
      [
        ...Object.values(urls),
        ...Object.values(reactionPortraits),
        ...Object.values(reactionActionSprites),
      ].map(async (url) => {
        if (!url) return;
        const image = new Image();
        image.src = url;
        await image.decode();
      }),
    );
    if (!disposed && version === loadVersion) art.value = urls;
  } catch {
    if (!disposed && version === loadVersion) artError.value = true;
  } finally {
    if (!disposed && version === loadVersion) artLoading.value = false;
  }
}
function clearInput() {
  input.jump = input.crouch = input.tail = false;
  jumpQueued = tailQueued = false;
  slideTicks = 0;
}
function schedule() {
  previousTime = undefined;
  accumulator = 0;
  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(animate);
}
function finish() {
  if (finished) return;
  finished = true;
  phase.value = 'ended';
  clearInput();
  const next = state.value;
  const endless = next.levelId === 3;
  const success = next.run.result?.reason === 'distance-limit' && next.hasAnswer;
  const earned = challenges.value.filter((challenge) => challenge.earned);
  savedBadges.value = mergeBadges(savedBadges.value, challenges.value);
  if (!props.mission) {
    try {
      localStorage.setItem(challengeStorageKey(next.levelId), JSON.stringify(savedBadges.value));
    } catch {
      // Badges remain visible for this run when local storage is unavailable.
    }
  }
  const nextLevel = success && next.levelId < 2 ? ((next.levelId + 1) as LevelId) : null;
  if (nextLevel !== null && !props.mission) rememberLevel(nextLevel);
  const newRecord = !props.mission && (success || endless) && score.value > bestScore.value;
  if (newRecord) {
    bestScore.value = score.value;
    try {
      localStorage.setItem(bestKeyFor(next.levelId), String(score.value));
    } catch {
      // The result still records this run even when storage is unavailable.
    }
  }
  const imageUrl = art.value[success ? 'char_win_03' : 'char_fail_02'];
  emit('finish', {
    gameId: 'parkour',
    sessionId: props.sessionId,
    outcome: endless ? 'completed' : success ? 'win' : 'lose',
    durationMs: Math.round(next.realTick * FIXED_DT * 1000),
    summary: endless
      ? `无限航线 · ${Math.floor(next.run.distance)} 米 · ${(next.realTick / 60).toFixed(1)} 秒 · ${score.value} 分${newRecord ? ' · 新纪录！' : ''}`
      : `第 ${next.levelId + 1} 关 · ${(next.realTick / 60).toFixed(1)} 秒 · ${score.value} 分 · ${next.rice} 碗饭 · ${next.returns} 件退回 · ${next.verified} 次核验${newRecord ? ' · 新纪录！' : ''}${earned.length ? ` · 挑战：${earned.map((challenge) => challenge.label).join(' / ')}` : ''}`,
    reselectLabel: '选择关卡',
    story: {
      ...(endless
        ? {
            title: `无限航线 · ${Math.floor(next.run.distance)} 米`,
            body: '这趟没有终点。大肥鱼拍拍尾巴：“再跑一局，看看能不能更远。”',
          }
        : endingFor(
            success,
            next.hasAnswer,
            next.rice,
            next.returns,
            next.verified,
            next.run.result?.reason,
          )),
      ...(imageUrl ? { imageUrl } : {}),
    },
    stats: {
      distance: next.run.distance,
      level: next.levelId + 1,
      score: score.value,
      bestScore: bestScore.value,
      rice: next.rice,
      riceFeasts: next.riceFeasts,
      returns: next.returns,
      parries: next.parries,
      perfectParries: next.perfectParries,
      breaks: next.breaks,
      verified: next.verified,
      shieldsUsed: next.shieldsUsed,
      bestCombo: next.bestCombo,
      bursts: next.bursts,
      delivered: success ? 1 : 0,
      badges: earned.length,
      hits: next.hits,
      hallucinationHits: next.hallucinationHits,
    },
  });
}
function startRun() {
  if (phase.value !== 'ready') return;
  sound.unlock();
  clearInput();
  phase.value = 'countdown';
  stage.value?.focus();
  void nextTick(() => {
    if (!disposed) controls.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
  });
  if (!props.paused) schedule();
}
function selectMode(mode: ThinkingMode) {
  if (phase.value !== 'ready') return;
  selectedMode.value = mode;
  inMemoryMode = mode;
  state.value = beginAdventure(seedForSession(props.sessionId), mode, selectedLevel.value);
  try {
    sessionStorage.setItem(modeKey, mode);
  } catch {
    // The current run still uses the selected mode.
  }
}
function selectLevel(id: LevelId) {
  if (phase.value !== 'ready') return;
  selectedLevel.value = id;
  bestScore.value = savedBest(id);
  state.value = beginAdventure(seedForSession(props.sessionId), selectedMode.value, id);
  savedBadges.value = readBadges();
  rememberLevel(id);
}
function animate(now: number) {
  frameId = 0;
  if (disposed || props.paused || !['countdown', 'running'].includes(phase.value)) return;
  if (previousTime !== undefined) accumulator += Math.min((now - previousTime) / 1000, 0.1);
  previousTime = now;
  let next = state.value;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    if (phase.value === 'countdown') {
      countdownTicks -= 1;
      if (countdownTicks <= 0) phase.value = 'running';
      continue;
    }
    next = advanceAdventure(next, {
      jump: input.jump || jumpQueued,
      crouch: input.crouch || slideTicks > 0,
      tail: input.tail || tailQueued,
    });
    jumpQueued = tailQueued = false;
    slideTicks = Math.max(0, slideTicks - 1);
    if (next.run.status === 'ended') {
      sound.update(state.value, next);
      state.value = next;
      finish();
      return;
    }
  }
  sound.update(state.value, next);
  if (Math.floor(next.realTick / 6) !== Math.floor(state.value.realTick / 6))
    emit('progress', next.realTick * FIXED_DT * 1000);
  state.value = next;
  frameId = requestAnimationFrame(animate);
}
function jump() {
  sound.unlock();
  if (active.value) jumpQueued = true;
}
function slide() {
  sound.unlock();
  if (active.value) slideTicks = 48;
}
function tail() {
  sound.unlock();
  if (active.value) tailQueued = true;
}
function keyDown(event: KeyboardEvent) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable]')
  )
    return;
  if (
    phase.value === 'ready' &&
    !props.paused &&
    !event.repeat &&
    ['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(event.code) &&
    !(event.target instanceof HTMLElement && event.target.closest('button'))
  ) {
    event.preventDefault();
    startRun();
    return;
  }
  if (!active.value) return;
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) jump();
    input.jump = true;
  } else if (['ArrowDown', 'KeyS'].includes(event.code)) {
    event.preventDefault();
    input.crouch = true;
  } else if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) tail();
    input.tail = true;
  }
}
function keyUp(event: KeyboardEvent) {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) input.jump = false;
  if (['ArrowDown', 'KeyS'].includes(event.code)) input.crouch = false;
  if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(event.code)) input.tail = false;
}
watch(
  () => props.paused,
  (paused) => {
    // The host also pauses for the result overlay; let its short ending cue finish.
    if (paused && phase.value !== 'ended') sound.stop();
    clearInput();
    cancelAnimationFrame(frameId);
    previousTime = undefined;
    accumulator = 0;
    if (!paused && ['countdown', 'running'].includes(phase.value)) schedule();
  },
);
onMounted(() => {
  void loadArt();
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  if (props.mission || (props.attempt > 1 && props.restartMode !== 'select')) startRun();
});
onUnmounted(() => {
  sound.dispose();
  disposed = true;
  loadVersion += 1;
  cancelAnimationFrame(frameId);
  clearInput();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
});
</script>

<template>
  <section class="whale-game" :class="{ 'in-run': phase !== 'ready' }">
    <button
      v-if="phase === 'ready' && !mission"
      class="practice-back"
      type="button"
      @click="emit('journey')"
    >
      ← 返回三分钟冒险
    </button>
    <div class="whale-hud">
      <button
        type="button"
        class="whale-sound"
        :aria-pressed="muted"
        aria-label="静音"
        @click="toggleSound"
      >
        {{ muted ? '音效：关' : '音效：开' }}
      </button>
      <div class="whale-department">
        <h2>
          {{ mission ? '' : state.levelId === 3 ? '∞ ·' : `第${state.levelId + 1}关 ·` }}
          {{ department.name }}
        </h2>
        <span>{{ department.sign }}</span>
      </div>
      <span class="whale-clock">{{ (state.realTick / 60).toFixed(1) }}<small> s</small></span>
      <div
        class="whale-health"
        :aria-label="`剩余 ${state.health} 次体力`"
        data-testid="runner-health"
      >
        <Heart
          v-for="n in 3"
          :key="n"
          :size="17"
          :fill="n <= state.health ? 'currentColor' : 'none'"
          :class="{ empty: n > state.health }"
        />
      </div>
      <span class="whale-distance">
        <b data-testid="runner-distance">{{ Math.floor(state.run.distance) }}</b>
        {{ state.levelId === 3 ? 'm · ∞' : `/ ${level.finishDistance} m` }}
      </span>
    </div>
    <progress
      v-if="state.levelId !== 3"
      class="whale-progress"
      :value="state.run.distance"
      :max="level.finishDistance"
      aria-label="交付进度"
    />
    <section
      v-if="phase === 'ready' && !mission"
      class="whale-dialogue whale-opening"
      role="region"
      aria-label="开场故事"
    >
      <div class="whale-speaker">
        <img v-if="portrait" :src="portrait" alt="" width="42" height="52" />
        <MessageCircle v-else :size="25" aria-hidden="true" />
      </div>
      <div class="whale-dialogue-copy">
        <p class="whale-request"><span>访客：</span>“{{ opening.request }}”</p>
        <h3><span class="whale-voice-name">DeepSeek 娘：</span>“{{ opening.line }}”</h3>
      </div>
      <button class="primary-button whale-start" type="button" :disabled="paused" @click="startRun">
        <Play :size="18" />{{ opening.action }}
      </button>
    </section>
    <div
      v-if="phase === 'ready' && !mission"
      class="whale-level-picker"
      role="group"
      aria-label="选择关卡"
    >
      <button
        v-for="(choice, index) in levels"
        :key="index"
        type="button"
        :aria-pressed="selectedLevel === index"
        @click="selectLevel(index as LevelId)"
      >
        <strong>{{ index === 3 ? '∞' : `第${index + 1}关` }} · {{ choice.name }}</strong>
        <small
          >{{ index === 3 ? '无限计分' : `${choice.finishDistance} 米` }} ·
          {{ choice.subtitle }}</small
        >
      </button>
    </div>
    <button
      v-if="phase === 'ready' && !mission"
      class="rhythm-entry"
      type="button"
      @click="emit('rhythm')"
    >
      ♪ Token 蹦迪 <small>50 秒原创节拍 · 跳 / 甩尾 / 滑铲 · 挑战全精准</small>
    </button>
    <button
      v-if="phase === 'ready' && !mission"
      class="rhythm-entry flight-entry"
      type="button"
      @click="emit('flight')"
    >
      ↑ 算力喷射 <small>按住飞升，松手散热 · 穿过限流墙 · 小心催更弹</small>
    </button>
    <div v-if="challenges.length" class="whale-challenges" aria-label="本关挑战">
      <span
        v-for="challenge in challenges"
        :key="challenge.id"
        :class="{ failed: challenge.failed, earned: savedBadges.includes(challenge.id) }"
        :title="challenge.hint"
      >
        {{ savedBadges.includes(challenge.id) ? '★' : '☆' }} {{ challenge.label }}
        <small>{{
          phase === 'ready'
            ? challenge.hint
            : challenge.failed
              ? '下局再战'
              : challenge.id === 'clean'
                ? '保持零失误'
                : `${challenge.current}/${challenge.target}`
        }}</small>
      </span>
    </div>
    <div class="whale-stage">
      <AnswerSeaStage
        ref="stage"
        :state="state"
        :art="art"
        :phase="phase"
        :paused="paused"
        :reduce-motion="settings.reduceMotion"
        @jump="jump"
        @slide="slide"
        @tail="tail"
      />
      <div
        v-if="phase === 'ready' && !mission"
        class="whale-thinking-picker"
        role="group"
        aria-label="思考强度"
      >
        <span>思考强度 <small>游戏节奏</small></span>
        <div class="whale-thinking-options">
          <button
            v-for="[mode, option] in modeOptions"
            :key="mode"
            type="button"
            :aria-pressed="selectedMode === mode"
            :title="option.hint"
            @click="selectMode(mode)"
          >
            {{ option.label }}
          </button>
        </div>
        <small>{{ thinkingModes[selectedMode].hint }}</small>
        <div class="whale-quick-guide">
          空格 / 点跑道：跳，连按二段<br />↓ / 下划：滑 · X / 右划：甩尾<br />纸团靠近再出手：精准退订<br />满算力时近处优先退件
          / 核验，其余时候爆发
        </div>
      </div>
      <div v-if="phase === 'countdown'" class="whale-countdown" role="status">走你！</div>
      <div
        v-if="runnerCue"
        class="whale-coach"
        :class="runnerCue.kind"
        :style="{
          bottom: `min(${162 + state.run.player.y * 48}px, calc(100% - 110px))`,
        }"
        role="status"
        aria-atomic="true"
        :aria-label="notice ? `${runnerCue.line}。${notice.text}` : undefined"
      >
        <img v-if="runnerCue.image" :src="runnerCue.image" alt="" width="42" height="50" />
        <span class="whale-coach-copy">
          <strong>{{ runnerCue.line }}</strong>
        </span>
      </div>
    </div>
    <div class="whale-feedback-strip">
      <span v-if="state.dashTicks > 0" class="whale-ability burst"
        ><Zap :size="13" />大肥鱼接管中</span
      >
      <span v-else-if="state.slowTicks > 0" class="whale-ability">深度思考 · 世界放慢</span>
      <span v-else-if="state.combo >= 4" class="whale-combo"
        >{{ state.combo }} 连击 <b>×{{ multiplierFor(state.combo) }}</b></span
      >
    </div>
    <div class="whale-resource">
      <span class="rice-counter"
        ><img :src="ASSETS.riceBowl.url" alt="饭量" width="25" height="22" />
        <b data-testid="runner-rice">{{ state.rice }}</b></span
      >
      <span
        >退件 <b data-testid="runner-returns">{{ state.returns }}</b></span
      >
      <span class="charge-label"
        >尾巴算力 <b data-testid="runner-energy">{{ state.energy }}</b></span
      >
      <progress :value="state.energy" max="100" aria-label="尾巴算力" :class="{ charged }" />
      <span class="whale-score" :class="{ endless: state.levelId === 3 }" data-testid="runner-score"
        >{{ score.toLocaleString() }} 分</span
      >
    </div>
    <div ref="controls" class="whale-controls">
      <button type="button" :disabled="!active" title="跳跃" aria-label="跳跃" @click="jump">
        <ArrowUp :size="23" /><span>跳跃</span>
      </button>
      <button type="button" :disabled="!active" title="滑铲" aria-label="滑铲" @click="slide">
        <ArrowDown :size="23" /><span>滑铲</span>
      </button>
      <button
        type="button"
        class="tail-control"
        :class="{ charged }"
        :disabled="!active || state.tailCooldown > 0 || state.dashTicks > 0"
        :title="tailDescription"
        :aria-label="tailDescription"
        @click="tail"
      >
        <Zap v-if="charged" :size="23" /><Undo2 v-else :size="23" /><span>{{ tailName }}</span>
        <span v-if="charged" class="charge-dot" aria-hidden="true"></span>
      </button>
    </div>
    <div class="whale-footer">
      <span
        >思考强度：{{ thinkingModes[state.thinkingMode].label
        }}{{ bestScore ? ` · 最佳 ${bestScore.toLocaleString()} 分` : '' }}</span
      >
      <span :class="{ delivered: state.context === CONTEXT_CAPACITY }">
        <ShieldCheck :size="14" />上下文 {{ state.context }} / {{ CONTEXT_CAPACITY }}
        {{ state.context === CONTEXT_CAPACITY ? '已缓存' : '' }}
      </span>
      <span class="verified-count"><Check :size="13" />核验 {{ state.verified }}</span>
      <span :class="{ delivered: state.hasAnswer }">{{
        state.levelId === 3 ? '没有终点 · 持续计分' : state.hasAnswer ? '答案在手' : '答案还在前面'
      }}</span>
      <span v-if="artLoading || artError" role="status">
        {{ artError ? '素材未加载' : '素材载入中' }}
        <button v-if="artError" class="text-button" type="button" @click="loadArt">重试</button>
      </span>
    </div>
  </section>
</template>

<style scoped>
.practice-back {
  border: 0;
  background: transparent;
  color: #52648e;
  padding: 0 0 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.rhythm-entry {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #c4b2e2;
  border-radius: 9px;
  background: #f6f0ff;
  color: #57407a;
  text-align: left;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.rhythm-entry small {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  font-weight: 400;
}
.flight-entry {
  margin-top: 6px;
  border-color: #a4d5db;
  background: #eafaff;
  color: #25596b;
}
.whale-sound {
  border: 1px solid #b8dbe6;
  border-radius: 8px;
  background: #f0faff;
  color: #26546c;
  padding: 7px 9px;
  font: inherit;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
}
.whale-challenges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0;
}
.whale-challenges > span {
  flex: 1 1 150px;
  padding: 8px 12px;
  border: 1px solid #b8dbe6;
  border-radius: 10px;
  background: #f0faff;
  color: #26546c;
  font-size: 13px;
  font-weight: 700;
}
.whale-challenges small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 400;
}
.whale-challenges .earned {
  border-color: #d6b04b;
  background: #fff9e3;
  color: #705311;
}
.whale-challenges .failed {
  background: #f7f0f0;
  color: #81535b;
}
.in-run .whale-challenges {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin: 6px 0;
}
.in-run .whale-challenges > span {
  min-width: 0;
  padding: 5px 7px;
  font-size: 11px;
}
.in-run .whale-challenges small {
  margin-top: 2px;
  font-size: 10px;
}
.whale-game {
  padding: 0;
  color: var(--home-ink);
}
.whale-hud {
  display: flex;
  align-items: center;
  gap: 22px;
  padding-bottom: 14px;
}
.whale-department {
  margin-right: auto;
}
.whale-department > span {
  font-size: 10px;
  color: var(--home-muted);
}
.whale-department h2 {
  margin: 0 0 2px;
  font-size: 17px;
}
.whale-clock {
  min-width: 5ch;
  font-size: 23px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.whale-clock small {
  font-size: 12px;
  font-weight: 400;
}
.whale-health {
  display: flex;
  gap: 5px;
  color: #cb607e;
}
.whale-health .empty {
  color: #bdcbd0;
}
.whale-distance {
  font-size: 11px;
  color: var(--home-muted);
  white-space: nowrap;
}
.whale-distance b {
  display: inline-block;
  min-width: 3ch;
  font-variant-numeric: tabular-nums;
}
.whale-progress {
  display: block;
  border: 0;
  height: 4px;
  width: 100%;
  accent-color: var(--home-purple);
}
.whale-progress::-webkit-progress-bar {
  background: #efedf6;
}
.whale-progress::-webkit-progress-value {
  background: var(--home-purple);
}
.whale-stage {
  position: relative;
}
.whale-level-picker {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 0;
}
.whale-level-picker button {
  display: grid;
  gap: 3px;
  min-height: 58px;
  padding: 8px;
  border: 1px solid #dce2ee;
  border-radius: 9px;
  background: #f6f8fd;
  color: var(--home-ink);
  text-align: left;
  cursor: pointer;
}
.whale-level-picker button[aria-pressed='true'] {
  border-color: var(--home-purple);
  background: var(--ui-accent-soft);
}
.whale-level-picker strong {
  font-size: 12px;
}
.whale-level-picker small {
  color: var(--home-muted);
  font-size: 10px;
}
.whale-thinking-picker {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: min(260px, calc(100% - 24px));
  padding: 10px 12px;
  border: 1px solid #ddd5e8;
  border-radius: 12px;
  background: #fffdf9ed;
  box-shadow: 0 6px 18px #49366a1a;
  font-size: 12px;
  font-weight: 700;
}
.whale-thinking-picker small {
  display: block;
  margin-top: 5px;
  color: var(--home-muted);
  font-size: 10px;
  font-weight: 400;
}
.whale-quick-guide {
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px solid #e8e1ed;
  color: #4c5975;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.5;
}
.whale-coach {
  position: absolute;
  left: calc(17% - 42px);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 7px;
  max-width: min(230px, calc(100% - 24px));
  padding: 5px 9px;
  border: 1px solid #b9d9ef;
  border-radius: 8px;
  background: #fffef2ed;
  box-shadow: 0 3px 10px #18346726;
  color: #244d78;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
}
.whale-coach img {
  flex: none;
  width: 34px;
  height: 42px;
  object-fit: contain;
}
.whale-coach-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.whale-coach-copy strong {
  font-size: 12px;
}
.whale-coach::after {
  content: '';
  position: absolute;
  bottom: -7px;
  left: 25px;
  border-style: solid;
  border-width: 7px 7px 0;
  border-color: #fffef2 transparent transparent;
}
.whale-coach.quip {
  border-color: #edc5d6;
  background: #fff7fbf2;
  color: #99506f;
}
.whale-coach.quip::after {
  border-top-color: #fff7fb;
}
.whale-thinking-picker > span small {
  display: inline;
  margin-left: 5px;
}
.whale-thinking-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 7px;
}
.whale-thinking-options button {
  min-height: 32px;
  padding: 4px;
  border: 1px solid #ded8e9;
  border-radius: 7px;
  background: white;
  color: var(--home-ink);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.whale-thinking-options button[aria-pressed='true'] {
  border-color: var(--home-purple);
  background: var(--ui-accent-soft);
  color: var(--home-purple);
}
.whale-thinking-options button:focus-visible {
  outline: 2px solid var(--home-purple);
  outline-offset: 2px;
}
.whale-dialogue {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  height: 80px;
  padding: 8px 12px;
  background: var(--ui-subtle);
  border: 0;
  border-radius: 12px 12px 0 0;
}
.whale-dialogue.whale-opening {
  grid-template-columns: 42px minmax(0, 1fr) auto;
}
.whale-speaker {
  display: grid;
  place-items: center;
  width: 60px;
  height: 70px;
  color: #8d6078;
}
.whale-opening .whale-speaker {
  width: 42px;
  height: 52px;
}
.whale-speaker img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.whale-speaker.goofy img {
  transform: scale(1.08) rotate(-4deg);
  filter: drop-shadow(0 2px 3px #4b3d8e55);
}
.whale-dialogue-copy {
  min-width: 0;
}
.whale-dialogue-copy h3,
.whale-dialogue-copy strong {
  display: block;
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--home-ink);
  overflow-wrap: anywhere;
}
.whale-voice-name {
  font-size: 11px;
  font-weight: 500;
  color: #7c667a;
}
.whale-request {
  margin: 0 0 3px;
  font-size: 11px;
  line-height: 1.5;
  color: #72848a;
}
.whale-tail-line {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.5;
  color: #916477;
}
.whale-start {
  background: var(--ui-accent);
  min-width: 92px;
  white-space: nowrap;
}
.whale-countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 38px;
  font-weight: 800;
  color: #c5536f;
  background: #f4faf47a;
  pointer-events: none;
}
.whale-feedback-strip {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  height: 30px;
  padding-inline: 4px;
  border-bottom: 1px solid var(--home-line);
}
.whale-ability > svg {
  flex-shrink: 0;
}
.whale-ability.burst {
  color: #946e30;
}
.whale-ability {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #3d806e;
  font-size: 11px;
}
.whale-combo {
  white-space: nowrap;
  font-size: 11px;
  color: #b84e6c;
}
.whale-resource {
  display: flex;
  align-items: center;
  gap: 15px;
  min-height: 42px;
  font-size: 12px;
}
.whale-resource b {
  font-variant-numeric: tabular-nums;
}
.rice-counter {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.rice-counter img {
  object-fit: contain;
}
.charge-label {
  margin-left: auto;
}
.charge-label b {
  display: inline-block;
  min-width: 3ch;
}
.whale-resource progress {
  flex: 1;
  max-width: 160px;
  min-width: 25px;
  height: 7px;
  border: 0;
  accent-color: #599b89;
}
.whale-resource progress.charged {
  accent-color: #d5a038;
}
.whale-score {
  min-width: 6ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.whale-score.endless {
  font-size: 18px;
  font-weight: 700;
}
.whale-controls {
  scroll-margin-bottom: 16px;
  display: grid;
  grid-template-columns: 1fr 1fr 1.3fr;
  gap: 12px;
}
.whale-controls button {
  position: relative;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 9px;
  color: var(--home-ink);
  background: var(--ui-subtle);
  cursor: pointer;
  touch-action: manipulation;
}
.whale-controls button:hover:not(:disabled) {
  background: var(--ui-accent-soft);
}
.whale-controls .tail-control {
  color: var(--ui-accent);
  background: var(--ui-accent-soft);
}
.whale-controls .tail-control.charged {
  color: #76511d;
  background: #ffedb9;
  border-color: #d1a33f;
}
.charge-dot {
  width: 6px;
  height: 6px;
  background: #bd8033;
  border-radius: 50%;
  position: absolute;
  top: 7px;
  right: 8px;
}
.whale-footer {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 10px;
  color: var(--home-muted);
}
.whale-footer > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.whale-footer .delivered {
  color: #358169;
}
.whale-footer button {
  padding: 0;
  font-size: 10px;
}
@media (max-width: 700px) {
  .whale-level-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 4px;
  }
  .whale-level-picker button {
    min-height: 48px;
    padding: 5px;
  }
  .whale-level-picker strong {
    font-size: 10px;
  }
  .whale-level-picker small {
    font-size: 9px;
  }
  .whale-thinking-picker {
    top: 8px;
    right: 8px;
    width: calc(100% - 16px);
  }
  .whale-game {
    padding: 0;
  }
  .whale-hud {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 5px 12px;
    padding-bottom: 9px;
  }
  .whale-department h2 {
    font-size: 15px;
  }
  .whale-clock {
    font-size: 21px;
  }
  .whale-distance {
    justify-self: end;
    font-size: 10px;
  }
  .whale-health {
    gap: 4px;
  }
  .in-run .whale-hud {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: 5px 8px;
  }
  .in-run .whale-department {
    grid-column: 1 / 3;
    grid-row: 1;
  }
  .in-run .whale-department > span {
    display: none;
  }
  .in-run .whale-sound {
    grid-column: 3;
    grid-row: 1;
    padding: 5px;
  }
  .in-run .whale-clock {
    grid-column: 1;
    grid-row: 2;
    text-align: left;
    font-size: 18px;
  }
  .in-run .whale-health {
    grid-column: 2;
    grid-row: 2;
  }
  .in-run .whale-distance {
    grid-column: 3;
    grid-row: 2;
  }
  .whale-dialogue {
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 8px;
    padding: 6px 8px;
    height: 76px;
  }
  .whale-coach {
    max-width: min(220px, calc(100% - 24px));
    font-size: 10px;
  }
  .whale-dialogue.whale-opening {
    grid-template-columns: 34px minmax(0, 1fr) 62px;
  }
  .whale-speaker {
    width: 52px;
    height: 64px;
  }
  .whale-opening .whale-speaker {
    width: 34px;
    height: 46px;
  }
  .whale-dialogue-copy h3,
  .whale-dialogue-copy strong {
    font-size: 12px;
  }
  .whale-request,
  .whale-tail-line,
  .whale-voice-name {
    font-size: 10px;
  }
  .whale-start {
    min-width: 0;
    min-height: 44px;
    padding: 8px 5px;
    gap: 3px;
    font-size: 12px;
  }
  .whale-feedback-strip {
    gap: 8px;
    height: 28px;
    padding-inline: 2px;
  }
  .whale-ability,
  .whale-combo {
    font-size: 10px;
  }
  .whale-resource {
    font-size: 10px;
    gap: 7px;
  }
  .whale-resource progress {
    max-width: 70px;
  }
  .whale-controls {
    gap: 6px;
  }
  .whale-controls button {
    height: 61px;
    flex-direction: column;
    font-size: 11px;
    gap: 2px;
  }
  .whale-footer {
    font-size: 9px;
    flex-wrap: wrap;
  }
}
@media (max-width: 360px) {
  .whale-game {
    padding: 0;
  }
}
</style>
