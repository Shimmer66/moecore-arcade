<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
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
import { officeAssetIds } from '../config/art';
import { reactionActionSprites, reactionPortraits } from '../config/reactions';
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
  seedForSession,
  thinkingModes,
  type LevelId,
  type ThinkingMode,
} from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const phase = ref<'ready' | 'countdown' | 'running' | 'ended'>('ready');
const modeKey = 'moecore:parkour:thinking-mode';
const levelKey = 'moecore:parkour:level';
let inMemoryLevel: LevelId = 0;
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
    if (saved === '1' || saved === '2' || saved === '3') return Number(saved) as LevelId;
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
    if (saved === 'quick' || saved === 'deep') return saved;
  } catch {
    // Private browsing can deny storage; the default remains playable.
  }
  return 'normal';
}
const selectedMode = ref<ThinkingMode>(savedMode());
const selectedLevel = ref<LevelId>(savedLevel());
const bestScore = ref(savedBest(selectedLevel.value));
const modeOptions = Object.entries(thinkingModes) as [
  ThinkingMode,
  (typeof thinkingModes)[ThinkingMode],
][];
const state = shallowRef(
  beginAdventure(seedForSession(props.sessionId), selectedMode.value, selectedLevel.value),
);
const art = shallowRef<Readonly<Record<string, string>>>({});
const artError = ref(false);
const artLoading = ref(true);
const stage = ref<InstanceType<typeof AnswerSeaStage>>();
const controls = ref<HTMLElement>();
const score = computed(() => state.value.run.score + state.value.bonus);
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
  charged.value ? '大肥鱼出击' : state.value.levelId === 3 ? '蓄力中' : '尾巴回信',
);
const tailDescription = computed(() =>
  state.value.levelId === 3 && !charged.value ? '尾巴算力蓄满后爆发' : tailName.value,
);
const coach = computed(() => {
  if (phase.value === 'ready' || phase.value === 'ended') return '';
  const current = state.value;
  const distance = current.run.distance;
  if (phase.value === 'countdown' || distance < 10) return '空格 / 点跑道跳跃，再按一次可二段跳';
  const obstacle = current.run.obstacles.find(
    (item) => item.id < 100 && item.x > distance && item.x - distance < 15,
  );
  if (distance < 70 && obstacle)
    return obstacle.kind === 'ground'
      ? '前方文档堆：空格 / 点跑道跳跃'
      : '前方低横梁：↓ / 下划滑铲';
  if (
    distance < 140 &&
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
    return current.levelId === 3 ? '问号饭别直接吃：↓ / 下划滑过' : '问号饭别直接吃：X / 右划核验';
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
  const nextLevel = success && next.levelId < 2 ? ((next.levelId + 1) as LevelId) : null;
  if (nextLevel !== null) rememberLevel(nextLevel);
  const newRecord = (success || endless) && score.value > bestScore.value;
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
      : `第 ${next.levelId + 1} 关 · ${(next.realTick / 60).toFixed(1)} 秒 · ${score.value} 分 · ${next.rice} 碗饭 · ${next.returns} 件退回 · ${next.verified} 次核验${newRecord ? ' · 新纪录！' : ''}`,
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
      breaks: next.breaks,
      verified: next.verified,
      shieldsUsed: next.shieldsUsed,
      bestCombo: next.bestCombo,
      bursts: next.bursts,
      delivered: success ? 1 : 0,
    },
  });
}
function startRun() {
  if (phase.value !== 'ready') return;
  clearInput();
  phase.value = 'countdown';
  stage.value?.focus();
  controls.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
  if (!props.paused) schedule();
}
function selectMode(mode: ThinkingMode) {
  if (phase.value !== 'ready') return;
  selectedMode.value = mode;
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
      state.value = next;
      finish();
      return;
    }
  }
  state.value = next;
  frameId = requestAnimationFrame(animate);
}
function jump() {
  if (active.value) jumpQueued = true;
}
function slide() {
  if (active.value) slideTicks = 48;
}
function tail() {
  if (active.value) tailQueued = true;
}
function keyDown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
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
  if (props.attempt > 1 && props.restartMode !== 'select') startRun();
});
onUnmounted(() => {
  disposed = true;
  loadVersion += 1;
  cancelAnimationFrame(frameId);
  clearInput();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
});
</script>

<template>
  <section class="whale-game">
    <div class="whale-hud">
      <div class="whale-department">
        <h2>
          {{ state.levelId === 3 ? '∞' : `第${state.levelId + 1}关` }} · {{ department.name }}
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
      v-if="phase === 'ready'"
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
    <div v-if="phase === 'ready'" class="whale-level-picker" role="group" aria-label="选择关卡">
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
    <div v-if="phase === 'ready'" class="whale-quick-guide">
      <span>空格 / 点跑道：跳，连按二段</span>
      <span>↓ / 下划：滑 · X / 右划：甩尾</span>
      <span>连吃两碗饭：额外加分</span>
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
        v-if="phase === 'ready'"
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
      <span v-if="state.levelId !== 3"
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
        :disabled="
          !active ||
          state.tailCooldown > 0 ||
          state.dashTicks > 0 ||
          (state.levelId === 3 && !charged)
        "
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
      <span v-if="state.levelId !== 3" class="verified-count"
        ><Check :size="13" />核验 {{ state.verified }}</span
      >
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
.whale-game {
  color: #3b5365;
}
.whale-hud {
  display: flex;
  align-items: center;
  gap: 22px;
  padding-bottom: 12px;
}
.whale-department {
  margin-right: auto;
}
.whale-department > span {
  font-size: 10px;
  color: #70848b;
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
  color: #68818b;
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
  accent-color: #528e79;
}
.whale-progress::-webkit-progress-bar {
  background: #dce8e1;
}
.whale-progress::-webkit-progress-value {
  background: #528e79;
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
  border: 1px solid #bfd1d8;
  border-radius: 9px;
  background: #ffffffb8;
  color: #3b5365;
  text-align: left;
  cursor: pointer;
}
.whale-level-picker button[aria-pressed='true'] {
  border-color: #528e79;
  background: #edf7f3;
}
.whale-level-picker strong {
  font-size: 12px;
}
.whale-level-picker small {
  color: #70848b;
  font-size: 10px;
}
.whale-thinking-picker {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  width: min(260px, calc(100% - 24px));
  padding: 10px 12px;
  border: 1px solid #bfd1d8;
  border-radius: 12px;
  background: #ffffffed;
  box-shadow: 0 6px 18px #2f5b4d1a;
  font-size: 12px;
  font-weight: 700;
}
.whale-thinking-picker small {
  display: block;
  margin-top: 5px;
  color: #70848b;
  font-size: 10px;
  font-weight: 400;
}
.whale-quick-guide {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin: 7px 0;
  padding: 7px 12px;
  border: 1px solid #d7e2df;
  border-radius: 9px;
  background: #ffffffb8;
  color: #3b5365;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
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
  border: 1px solid #bfd1d8;
  border-radius: 7px;
  background: white;
  color: #3b5365;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.whale-thinking-options button[aria-pressed='true'] {
  border-color: #528e79;
  background: #edf7f3;
  color: #528e79;
}
.whale-thinking-options button:focus-visible {
  outline: 2px solid #528e79;
  outline-offset: 2px;
}
.whale-dialogue {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  column-gap: 12px;
  height: 80px;
  padding: 8px 12px;
  background: #fff;
  border-bottom: 1px solid #d7e2df;
}
.whale-dialogue.whale-opening {
  grid-template-columns: 42px minmax(0, 1fr) auto;
}
.whale-speaker {
  display: grid;
  place-items: center;
  width: 42px;
  height: 52px;
  color: #8d6078;
}
.whale-speaker img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  color: #354e61;
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
  background: #c55772;
  border-color: #c55772;
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
  border-bottom: 1px solid #d7e2df;
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
  border: 1px solid #bfd1d8;
  border-radius: 6px;
  color: #42637b;
  background: #fff;
  cursor: pointer;
  touch-action: manipulation;
}
.whale-controls button:hover:not(:disabled) {
  border-color: #427d91;
  background: #f0f8f8;
}
.whale-controls .tail-control {
  color: #a63f60;
  background: #fff1f3;
  border-color: #dfa9b8;
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
  color: #7b8a8b;
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
    font-size: 11px;
  }
  .whale-level-picker small {
    font-size: 10px;
  }
  .whale-thinking-picker {
    top: 8px;
    right: 8px;
    width: min(210px, 58%);
    padding: 8px;
    border-color: #bfd1d8;
    background: #ffffffed;
  }
  .whale-thinking-picker > small,
  .whale-thinking-picker > span small {
    display: none;
  }
  .whale-quick-guide {
    margin: 4px 0 8px;
    padding: 6px 8px;
    font-size: 11px;
  }
  .whale-quick-guide span:last-child {
    display: none;
  }
  .whale-thinking-options {
    margin-top: 5px;
  }
  .whale-thinking-options button {
    min-height: 40px;
    font-size: 12px;
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
  .whale-dialogue {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 8px;
    padding: 6px 8px;
    height: 76px;
  }
  .whale-coach {
    max-width: min(220px, calc(100% - 24px));
    font-size: 11px;
  }
  .whale-dialogue.whale-opening {
    grid-template-columns: 34px minmax(0, 1fr) 62px;
  }
  .whale-speaker {
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
</style>
