<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import type { GameProps, GameResult } from '@moecore/game-sdk';
import { Play, RotateCcw, Check, ShieldCheck } from '@lucide/vue';
import ParkourGame from './ParkourGame.vue';
import FlightGame from './FlightGame.vue';
import RhythmGame from './RhythmGame.vue';
import { reactionPortraits } from '../config/reactions';
import { seedForSession } from '../rules/adventure';
import {
  beginJourney,
  continueJourney,
  finishJourneyStage,
  journeyScore,
  journeyStages,
  HANDOFF_MS,
  JOURNEY_BEST_KEY,
  type MissionOptions,
} from '../rules/journey';

const props = withDefaults(defineProps<GameProps>(), { restartMode: 'replay' });
const emit = defineEmits<{ finish: [result: GameResult]; practice: [] }>();
const state = shallowRef(beginJourney());
const stage = computed(() => journeyStages[state.value.stage]!);
const mission = computed<MissionOptions>(() => ({
  seed: seedForSession(props.sessionId),
  levelId: stage.value.levelId,
  from: stage.value.from,
  assisted: state.value.failures[state.value.stage]! > 0,
}));
const serial = ref(0);
const legSession = computed(() => `${props.sessionId}:journey:${serial.value}`);
const liveMs = ref(0);
const transitionMs = ref(0);
const transitionTotalMs = ref(0);
const failMessage = ref('');
const best = ref(0);
const assistedBest = ref(0);
const root = ref<HTMLElement>();
const retryButton = ref<HTMLButtonElement>();
let frame = 0;
let previous: number | undefined;
let disposed = false;
let settled = false;
try {
  const value = Number(localStorage.getItem(`${JOURNEY_BEST_KEY}:standard`));
  if (Number.isSafeInteger(value) && value > 0) best.value = value;
  const assistedValue = Number(localStorage.getItem(`${JOURNEY_BEST_KEY}:assisted`));
  if (Number.isSafeInteger(assistedValue) && assistedValue > 0) assistedBest.value = assistedValue;
} catch {
  /* The mission remains playable without storage. */
}
const elapsed = computed(
  () => state.value.spentMs + liveMs.value + transitionTotalMs.value + transitionMs.value,
);
const help = computed(() =>
  stage.value.kind === 'runner'
    ? '本段援助：带一层上下文护盾出发，操作和路线不变。'
    : stage.value.kind === 'flight'
      ? '本段援助：多一格体力，催更弹仍需自己躲。'
      : '本段援助：八格体力，普通命中窗口略放宽，精准标准不变。',
);
function progress(milliseconds: number) {
  if (state.value.phase === 'playing') liveMs.value = milliseconds;
}
function start() {
  if (props.paused || state.value.phase !== 'ready') return;
  settled = false;
  state.value = continueJourney(state.value);
  serial.value++;
}
function retry() {
  if (props.paused || state.value.phase !== 'failed') return;
  liveMs.value = 0;
  state.value = continueJourney(state.value);
  serial.value++;
}
function reset() {
  cancelAnimationFrame(frame);
  state.value = beginJourney();
  liveMs.value = transitionMs.value = transitionTotalMs.value = 0;
  failMessage.value = '';
  settled = false;
  void nextTick(() => root.value?.scrollIntoView({ block: 'start' }));
}
function settle() {
  if (settled) return;
  settled = true;
  const result = state.value;
  const score = journeyScore(result);
  const key = `${JOURNEY_BEST_KEY}:${result.assisted ? 'assisted' : 'standard'}`;
  try {
    const previousBest = Number(localStorage.getItem(key) ?? 0);
    if (!Number.isSafeInteger(previousBest) || score > previousBest)
      localStorage.setItem(key, String(score));
  } catch {
    /* Completion does not depend on persistent storage. */
  }
  const clean = result.retries === 0 && result.mistakes === 0;
  emit('finish', {
    gameId: 'parkour',
    sessionId: props.sessionId,
    outcome: 'win',
    durationMs: Math.round(elapsed.value),
    summary: `三分钟送答行动 · ${(elapsed.value / 1000).toFixed(1)} 秒 · ${score} 分 · 四段交付 · 检查点重试 ${result.retries} 次${clean ? ' · 全程零失误' : ''}${result.assisted ? ' · 援助通关' : ' · 一气呵成'}`,
    reselectLabel: '返回冒险准备',
    story: {
      title: '白饭没白吃，答案真交付',
      body: clean
        ? '取件、飞跃、核验、交付，一口气完成。尾巴：这次连复盘都挑不出刺。'
        : '一路的补充说明、限流和催更都甩在身后。尾巴：下次挑战整局无伤，白饭还能再加。',
      ...(reactionPortraits.burst ? { imageUrl: reactionPortraits.burst } : {}),
    },
    stats: {
      score,
      stages: result.completed.length,
      retries: result.retries,
      mistakes: result.mistakes,
      assisted: Number(result.assisted),
    },
  });
}
function handoff(time: number) {
  if (disposed || props.paused || state.value.phase !== 'handoff') return;
  if (previous === undefined) previous = time;
  transitionMs.value = Math.min(HANDOFF_MS, transitionMs.value + Math.min(100, time - previous));
  previous = time;
  if (transitionMs.value >= HANDOFF_MS) {
    transitionTotalMs.value += HANDOFF_MS;
    transitionMs.value = 0;
    state.value = continueJourney(state.value);
    serial.value++;
  } else frame = requestAnimationFrame(handoff);
}
function finishStage(result: GameResult) {
  if (
    state.value.phase !== 'playing' ||
    result.sessionId !== legSession.value ||
    result.gameId !== 'parkour'
  )
    return;
  state.value = finishJourneyStage(state.value, result);
  liveMs.value = 0;
  if (state.value.phase === 'won') settle();
  else if (state.value.phase === 'handoff') {
    transitionMs.value = 0;
    previous = undefined;
    frame = requestAnimationFrame(handoff);
  } else {
    failMessage.value = result.story?.body ?? '再试一次，看清前面的动作提示。';
    void nextTick(() => retryButton.value?.focus({ preventScroll: true }));
  }
}
function keydown(event: KeyboardEvent) {
  if (
    event.code !== 'Space' ||
    event.repeat ||
    props.paused ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  )
    return;
  if (event.target instanceof Element && event.target.closest('button, input, textarea')) return;
  if (state.value.phase === 'ready') {
    event.preventDefault();
    start();
  } else if (state.value.phase === 'failed') {
    event.preventDefault();
    retry();
  }
}
watch(
  () => props.paused,
  (paused) => {
    cancelAnimationFrame(frame);
    previous = undefined;
    if (!paused && state.value.phase === 'handoff') frame = requestAnimationFrame(handoff);
  },
);
onMounted(() => {
  window.addEventListener('keydown', keydown);
  if (props.attempt > 1 && props.restartMode !== 'select') start();
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', keydown);
});
</script>

<template>
  <section
    ref="root"
    class="journey"
    :data-phase="state.phase"
    :data-stage="state.stage"
    :data-retries="state.retries"
    :data-time="elapsed"
    :data-completed="state.completed.length"
    :data-score="journeyScore(state)"
  >
    <div v-if="state.phase === 'ready'" class="journey-ready">
      <div class="journey-hero">
        <div>
          <small>一局冒险 · 约三分钟</small>
          <h2>三分钟送答行动</h2>
          <p>用户已经等急了。白饭要吃，限流要躲，答案这次真的要交。</p>
          <p class="journey-promise">尾巴：一条航线，四种考验。失败有检查点，别怕再来。</p>
          <button class="primary-button" type="button" :disabled="paused" @click="start">
            <Play :size="18" />开始冒险
          </button>
          <button class="journey-practice" type="button" @click="emit('practice')">单项练习</button>
        </div>
        <img :src="reactionPortraits.burst" alt="准备出发的大肥鱼" />
      </div>
      <ol class="journey-route">
        <li v-for="(leg, index) in journeyStages" :key="leg.title">
          <b>{{ index + 1 }} · {{ leg.title }}</b
          ><span>{{ leg.hint }}</span
          ><small>约 {{ leg.seconds }} 秒</small>
        </li>
      </ol>
      <div class="journey-rules">
        <ShieldCheck :size="20" />
        <p>
          每段入口自动设检查点。失败只重试当前段，已有成绩保留；重试提供轻度援助并单独记分。熟悉之后，挑战一气呵成和全程零失误。
        </p>
      </div>
      <div v-if="best || assistedBest" class="journey-records">
        <small v-if="best">标准路线最高 {{ best.toLocaleString() }} 分</small>
        <small v-if="assistedBest">援助路线最高 {{ assistedBest.toLocaleString() }} 分</small>
      </div>
    </div>
    <template v-else>
      <header class="journey-header">
        <ol>
          <li
            v-for="(leg, index) in journeyStages"
            :key="leg.title"
            :class="{ current: index === state.stage, done: index < state.completed.length }"
          >
            <Check v-if="index < state.completed.length" :size="12" /><span v-else>{{
              index + 1
            }}</span
            >{{ leg.short }}
          </li>
        </ol>
        <span
          >总计 {{ (elapsed / 1000).toFixed(1) }}s · 已存
          {{ journeyScore(state).toLocaleString() }} 分</span
        >
      </header>
      <div v-if="state.phase === 'handoff'" class="journey-card" role="status">
        <small>检查点已保存</small>
        <h2>{{ stage.title }}</h2>
        <p>{{ stage.hint }}</p>
        <strong>{{ Math.max(1, Math.ceil((HANDOFF_MS - transitionMs) / 1000)) }}</strong>
      </div>
      <div
        v-else-if="state.phase === 'failed'"
        class="journey-card journey-retry"
        role="region"
        aria-label="检查点重试"
      >
        <small>进度已保留 · 第 {{ state.stage + 1 }} 段检查点</small>
        <h2>这段翻车，前面不白跑</h2>
        <p>{{ failMessage }}</p>
        <p class="journey-assist">{{ help }}</p>
        <button
          ref="retryButton"
          class="primary-button"
          type="button"
          :disabled="paused"
          @click="retry"
        >
          <RotateCcw :size="18" />从检查点重试
        </button>
        <button class="journey-practice" type="button" @click="reset">回到冒险准备</button>
      </div>
      <template v-else-if="state.phase === 'playing'">
        <p v-if="mission.assisted" class="journey-assist"><ShieldCheck :size="13" />{{ help }}</p>
        <ParkourGame
          v-if="stage.kind === 'runner'"
          :key="serial"
          v-bind="props"
          :session-id="legSession"
          :mission="mission"
          @finish="finishStage"
          @progress="progress"
        />
        <FlightGame
          v-else-if="stage.kind === 'flight'"
          :key="serial"
          v-bind="props"
          :session-id="legSession"
          :mission="mission"
          @finish="finishStage"
          @progress="progress"
        />
        <RhythmGame
          v-else
          :key="serial"
          v-bind="props"
          :session-id="legSession"
          :mission="mission"
          @finish="finishStage"
          @progress="progress"
        />
      </template>
    </template>
  </section>
</template>

<style scoped>
.journey {
  color: var(--home-ink);
}
.journey-records {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  margin-top: 10px;
  color: #647187;
}
.journey[data-phase='won'] {
  min-height: 560px;
}
.journey-hero {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 28px;
  border-radius: 18px;
  background: linear-gradient(125deg, #eaf8ff, #f5efff);
  border: 1px solid #d2e7ed;
}
.journey-hero > div {
  flex: 1;
}
.journey-hero h2 {
  font-size: 29px;
  margin: 8px 0 12px;
}
.journey-hero p {
  font-size: 14px;
  line-height: 1.7;
}
.journey-hero small {
  color: #526d94;
}
.journey-hero > img {
  width: 180px;
  height: 200px;
  object-fit: contain;
}
.journey-promise {
  color: #665083;
}
.journey-practice {
  border: 0;
  background: transparent;
  color: #52648e;
  padding: 12px;
  font: inherit;
  cursor: pointer;
}
.journey-route {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 0;
  margin: 18px 0;
}
.journey-route li {
  border: 1px solid #dae5ed;
  border-radius: 12px;
  padding: 14px;
  background: #fafcff;
  display: grid;
  gap: 7px;
}
.journey-route b {
  font-size: 14px;
}
.journey-route span {
  font-size: 12px;
  line-height: 1.6;
  color: #60718b;
}
.journey-route small {
  color: #728095;
}
.journey-rules {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #557482;
  background: #f0f9f7;
  padding: 8px 16px;
  border-radius: 12px;
}
.journey-rules svg {
  flex: none;
}
.journey-rules p {
  font-size: 12px;
  line-height: 1.6;
}
.journey-header {
  display: flex;
  gap: 10px;
  justify-content: space-between;
  align-items: center;
  padding: 0 0 10px;
  font-size: 11px;
  color: #647187;
}
.journey-header ol {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
}
.journey-header li {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 6px;
  border-radius: 6px;
  background: #f0f3f8;
}
.journey-header .current {
  background: #e8deff;
  color: #62439b;
  font-weight: 700;
}
.journey-header .done {
  background: #e1f2e8;
  color: #38735b;
}
.journey-header > span {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.journey-card {
  min-height: 330px;
  padding: 36px 20px;
  border-radius: 18px;
  border: 1px solid #d4e1f1;
  background: linear-gradient(135deg, #edf8ff, #f7f1ff);
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.journey-card small {
  color: #568575;
}
.journey-card h2 {
  margin: 12px 0;
}
.journey-card p {
  max-width: 450px;
  font-size: 14px;
  line-height: 1.7;
}
.journey-card strong {
  font-size: 40px;
  color: #7661b0;
}
.journey-assist {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 0 0 8px;
  padding: 5px 8px;
  border-radius: 8px;
  background: #fff5da;
  color: #83622e;
  font-size: 11px;
}
@media (max-width: 600px) {
  .journey-hero {
    padding: 18px;
    gap: 8px;
  }
  .journey-hero h2 {
    font-size: 23px;
  }
  .journey-hero > img {
    width: 86px;
    height: 140px;
  }
  .journey-hero p {
    font-size: 12px;
  }
  .journey-route {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }
  .journey-route li {
    padding: 10px;
  }
  .journey-route b {
    font-size: 12px;
  }
  .journey-header {
    flex-wrap: wrap;
    gap: 4px;
    padding-bottom: 7px;
  }
  .journey-header > span {
    font-size: 10px;
  }
}
@media (max-width: 360px) {
  .journey-hero h2 {
    font-size: 20px;
  }
}
</style>
