<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { Play, RotateCcw, Sparkles, Waves } from '@lucide/vue';
import { getWhaleQueueAsset } from '@moecore/assets/whale-queue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import {
  BOARD_SIZE,
  TARGET_STARS,
  createGameState,
  queueDirection,
  tick,
  useThinking,
  type Direction,
  type GameState,
  type Position,
  type StepEvent,
} from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const state = ref<GameState>(createGameState({ seed: props.sessionId }));
const phase = ref<'ready' | 'playing' | 'ended'>('ready');
const feedback = ref('小鲸排好队，我们出发啦！');
const effect = ref<{
  type: 'collect' | 'think' | 'bump' | 'shell';
  position: Position;
  key: number;
}>();
const playTimeMs = ref(0);
const finished = ref(false);
const board = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({
  row: Math.floor(index / BOARD_SIZE),
  column: index % BOARD_SIZE,
}));
let timer: number | undefined;
let effectTimer: number | undefined;

const score = computed(() => state.value.starsCollected * 10);
const queueLength = computed(() => state.value.segments.length);
const canThink = computed(
  () =>
    phase.value === 'playing' &&
    !props.paused &&
    state.value.thinkingCharges > 0 &&
    state.value.thinkingMsRemaining === 0,
);
const portraitUrl = computed(() => {
  if (state.value.status === 'won') return getWhaleQueueAsset('portraitProud');
  if (state.value.status === 'lost') return getWhaleQueueAsset('portraitDizzy');
  if (state.value.thinkingMsRemaining > 0) return getWhaleQueueAsset('portraitThinking');
  if (state.value.starsCollected > 0) return getWhaleQueueAsset('portraitDelighted');
  return getWhaleQueueAsset('portraitNeutral');
});
const statusText = computed(() => {
  if (phase.value === 'ready') return '准备好就出发，收集 30 颗灵感星。';
  if (state.value.status === 'won') return '答案写好啦，星光都整理好了！';
  if (state.value.status === 'lost') return '队伍打结了，绕开礁石再试一次。';
  return feedback.value;
});

function cellStyle(position: Position): Record<string, string> {
  return { left: `${position.column * 6.25}%`, top: `${position.row * 6.25}%` };
}
function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.column === b.column;
}
function isRock(position: Position): boolean {
  return state.value.rocks.some((rock) => samePosition(rock, position));
}
function showEffect(type: 'collect' | 'think' | 'bump' | 'shell', position: Position) {
  if (props.settings.reduceMotion) return;
  if (effectTimer !== undefined) window.clearTimeout(effectTimer);
  effect.value = { type, position, key: Date.now() };
  effectTimer = window.setTimeout(() => (effect.value = undefined), type === 'think' ? 3_000 : 700);
}
function setFeedback(events: readonly StepEvent[]) {
  const event = events.at(-1);
  const copy: Partial<Record<StepEvent, string>> = {
    'collected-star': '叮！捞到一颗好点子，小鲸跟上来啦。',
    'collected-shell': '整理一下，思路轻一点！',
    collision: '哎呀，队伍打结了……再试一次！',
    won: '答案写好啦，连同星光送给你。',
  };
  if (event && copy[event]) feedback.value = copy[event]!;
}
function settle() {
  if (finished.value) return;
  finished.value = true;
  phase.value = 'ended';
  const won = state.value.status === 'won';
  emit('finish', {
    gameId: 'whale-queue',
    sessionId: props.sessionId,
    outcome: won ? 'win' : 'lose',
    durationMs: playTimeMs.value,
    summary: won
      ? `${state.value.starsCollected} 颗灵感星 · ${score.value} 分 · 队伍最长 ${queueLength.value} 格`
      : `${state.value.starsCollected} / ${TARGET_STARS} 颗灵感星 · ${score.value} 分`,
    story: {
      title: won ? '答案写好啦！' : '队伍打结了',
      body: won
        ? '鲸鲸把 30 颗灵感整理成一份温柔的答案，准备送给朋友。'
        : '噪声礁石和队伍尾巴都要小心，按重来再陪小鲸走一趟吧。',
      imageUrl: getWhaleQueueAsset(won ? 'portraitProud' : 'portraitDizzy'),
    },
    stats: {
      stars: state.value.starsCollected,
      score: score.value,
      queueLength: queueLength.value,
      shells: state.value.shellsSpawned - state.value.shellRequests,
    },
  });
}
function advance(elapsedMs: number) {
  if (phase.value !== 'playing' || props.paused || state.value.status !== 'playing') return;
  playTimeMs.value += elapsedMs;
  const result = tick(state.value, elapsedMs);
  state.value = result.state;
  setFeedback(result.events);
  const head = state.value.segments[0];
  if (head) {
    if (result.events.includes('collected-star')) showEffect('collect', head);
    else if (result.events.includes('collected-shell')) showEffect('shell', head);
    else if (result.events.includes('collision')) showEffect('bump', head);
  }
  if (result.events.includes('won') || result.events.includes('collision')) settle();
}
function startGame() {
  if (phase.value !== 'ready') return;
  phase.value = 'playing';
  feedback.value = '小鲸排好队，我们出发啦！';
  document.querySelector<HTMLElement>('.whale-queue-board')?.focus();
}
function restartLocal() {
  state.value = createGameState({ seed: `${props.sessionId}:${Date.now()}` });
  phase.value = 'playing';
  finished.value = false;
  playTimeMs.value = 0;
  feedback.value = '小鲸排好队，我们出发啦！';
}
function steer(direction: Direction) {
  if (phase.value === 'ready') startGame();
  if (phase.value !== 'playing' || props.paused) return;
  state.value = queueDirection(state.value, direction);
}
function think() {
  if (!canThink.value) return;
  state.value = useThinking(state.value);
  feedback.value = '让我慢慢想一下。';
  const head = state.value.segments[0];
  if (head) showEffect('think', head);
}
function onKeydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select'))
    return;
  const keyMap: Readonly<Record<string, Direction>> = {
    ArrowUp: 'up',
    w: 'up',
    W: 'up',
    ArrowRight: 'right',
    d: 'right',
    D: 'right',
    ArrowDown: 'down',
    s: 'down',
    S: 'down',
    ArrowLeft: 'left',
    a: 'left',
    A: 'left',
  };
  // `code` is the most reliable value in browsers, but some keyboard/event
  // integrations only expose the printable key. Accept both so the shortcut
  // keeps working when the board is embedded or driven by a test harness.
  const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
  if (isSpace) {
    event.preventDefault();
    if (!event.repeat) {
      // Space doubles as the ready-screen start shortcut. Once the run has
      // started it spends an available thinking charge.
      if (phase.value === 'ready') startGame();
      if (phase.value === 'playing') think();
    }
    return;
  }
  const direction = keyMap[event.key];
  if (direction) {
    event.preventDefault();
    steer(direction);
  }
}
watch(
  () => props.paused,
  (paused) => {
    if (paused && phase.value === 'playing') feedback.value = '先歇一会儿，星星帮你留着。';
  },
);
onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  timer = window.setInterval(() => advance(50), 50);
  if (props.attempt > 1) startGame();
});
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (timer !== undefined) window.clearInterval(timer);
  if (effectTimer !== undefined) window.clearTimeout(effectTimer);
});
</script>

<template>
  <section
    class="whale-queue-game"
    :class="{ 'reduce-motion': props.settings.reduceMotion }"
    :data-status="state.status"
    :data-phase="phase"
  >
    <header class="wq-heading">
      <div>
        <span class="wq-kicker">✦ DEEPSEA DATA · MOECORE ✦</span>
        <h2>鲸鲸的灵感长队</h2>
        <p>带着小鲸伙伴收集星光，整理出一份温柔答案。</p>
      </div>
      <div class="wq-character" aria-hidden="true">
        <img :src="portraitUrl" alt="" /><span class="wq-sparkle">✦</span>
      </div>
    </header>

    <div class="wq-hud" aria-label="本局状态">
      <div class="wq-stat">
        <img :src="getWhaleQueueAsset('inspirationIcon')" alt="" /><span
          ><b data-testid="whale-stars">{{ state.starsCollected }}</b> / {{ TARGET_STARS }}</span
        ><small>灵感星</small>
      </div>
      <div class="wq-stat">
        <img :src="getWhaleQueueAsset('queueIcon')" alt="" /><span
          ><b data-testid="whale-queue-length">{{ queueLength }}</b></span
        ><small>队伍长度</small>
      </div>
      <div class="wq-score">
        <span>本局得分</span><strong data-testid="whale-score">{{ score }}</strong>
      </div>
      <button
        class="wq-think-button"
        type="button"
        :disabled="!canThink"
        :aria-label="canThink ? '深度思考' : '深度思考未充能'"
        @click="think"
      >
        <img :src="getWhaleQueueAsset('thinkIcon')" alt="" /><span>{{
          state.thinkingMsRemaining > 0 ? '思考中' : '深度思考'
        }}</span
        ><b v-if="state.thinkingMsRemaining > 0"
          >{{ Math.ceil(state.thinkingMsRemaining / 1000) }}s</b
        ><b v-else-if="state.thinkingCharges">×{{ state.thinkingCharges }}</b>
      </button>
    </div>

    <div class="wq-layout">
      <section class="wq-play-panel" aria-label="数据海棋盘">
        <div
          class="wq-board-frame"
          :style="{ '--wq-frame-url': `url(${getWhaleQueueAsset('boardFrame')})` }"
        >
          <div
            class="whale-queue-board"
            :style="{ '--wq-board-url': `url(${getWhaleQueueAsset('boardBackground')})` }"
            tabindex="0"
            role="grid"
            aria-label="16乘16数据海棋盘"
            :aria-busy="phase === 'playing'"
          >
            <div
              v-for="cell in board"
              :key="`${cell.row}-${cell.column}`"
              class="wq-cell"
              :class="{ 'wq-cell-rock': isRock(cell) }"
              role="gridcell"
            ></div>
            <img
              v-for="rock in state.rocks"
              :key="`rock-${rock.row}-${rock.column}`"
              class="wq-entity wq-rock"
              :style="cellStyle(rock)"
              :src="getWhaleQueueAsset('noiseReef')"
              alt="噪声礁石"
            />
            <img
              v-if="state.star"
              class="wq-entity wq-star"
              :style="cellStyle(state.star)"
              :src="getWhaleQueueAsset('inspirationStar')"
              alt="灵感星"
            />
            <img
              v-for="shell in state.shells"
              :key="`shell-${shell.row}-${shell.column}`"
              class="wq-entity wq-shell"
              :style="cellStyle(shell)"
              :src="getWhaleQueueAsset('summaryShell')"
              alt="摘要贝壳"
            />
            <img
              v-for="(segment, index) in state.segments.slice(1)"
              :key="`segment-${index}-${segment.row}-${segment.column}`"
              class="wq-entity wq-queue-whale"
              :style="cellStyle(segment)"
              :src="getWhaleQueueAsset('queueWhale')"
              alt="小鲸伙伴"
            />
            <img
              v-if="state.segments[0]"
              class="wq-entity wq-player"
              :style="cellStyle(state.segments[0])"
              :src="
                getWhaleQueueAsset(
                  state.direction === 'up'
                    ? 'playerUp'
                    : state.direction === 'right'
                      ? 'playerRight'
                      : state.direction === 'down'
                        ? 'playerDown'
                        : 'playerLeft',
                )
              "
              alt="鲸鲸"
            />
            <img
              v-if="effect"
              :key="effect.key"
              class="wq-entity wq-effect"
              :class="`wq-effect-${effect.type}`"
              :style="cellStyle(effect.position)"
              :src="
                getWhaleQueueAsset(
                  effect.type === 'collect'
                    ? 'collectSparkle'
                    : effect.type === 'think'
                      ? 'thinkingRing'
                      : effect.type === 'shell'
                        ? 'summaryRipple'
                        : 'bump',
                )
              "
              alt=""
            />
          </div>
        </div>
        <div class="wq-board-status" role="status" aria-live="polite">
          <span><Waves :size="15" />{{ statusText }}</span
          ><small v-if="state.thinkingMsRemaining > 0"
            >减速剩余 {{ (state.thinkingMsRemaining / 1000).toFixed(1) }} 秒</small
          >
        </div>
      </section>
      <aside class="wq-side-panel">
        <div class="wq-side-card">
          <span class="wq-side-label">鲸鲸小贴士</span>
          <p v-if="phase === 'ready'">
            用方向键或下方箭头转弯，不能立刻掉头。收集星星会让队伍变长。
          </p>
          <p v-else>每集齐 5 颗星会获得一次思考充能；10、20 颗星会出现摘要贝壳。</p>
          <p class="wq-controls-copy">电脑：方向键 / WASD · 空格：开始 / 深度思考</p>
        </div>
        <button v-if="phase === 'ready'" class="wq-start" type="button" @click="startGame">
          <Play :size="19" />开始收集灵感
        </button>
        <button v-else class="wq-restart-local" type="button" @click="restartLocal">
          <RotateCcw :size="17" />这一局重来
        </button>
      </aside>
    </div>

    <div class="wq-direction-pad" aria-label="触屏方向键">
      <span aria-hidden="true"></span>
      <button type="button" aria-label="向上" @click="steer('up')">↑</button>
      <span aria-hidden="true"></span>
      <button type="button" aria-label="向左" @click="steer('left')">←</button>
      <button type="button" aria-label="向下" @click="steer('down')">↓</button>
      <button type="button" aria-label="向右" @click="steer('right')">→</button>
    </div>
    <p class="wq-footer-note"><Sparkles :size="14" />收集 30 颗灵感星，鲸鲸就能把答案送给朋友。</p>
  </section>
</template>

<style scoped>
.whale-queue-game {
  --wq-navy: #172040;
  --wq-navy-soft: #2b3a67;
  --wq-blue: #3d5aa9;
  --wq-sky: #5b8fd9;
  --wq-pale: #eaf3ff;
  --wq-gold: #d9b45e;
  --wq-text: #2b3a67;
  --wq-sub: #5a6b93;
  position: relative;
  overflow: hidden;
  color: var(--wq-text);
  padding: 22px;
  border: 2px solid #d9e9fc;
  border-radius: 26px;
  background:
    radial-gradient(600px 280px at 100% 0, #dbeeff 0%, transparent 70%),
    linear-gradient(180deg, #f4faff, #fff 70%);
}
.whale-queue-game::before,
.whale-queue-game::after {
  content: '✦';
  position: absolute;
  color: var(--wq-gold);
  opacity: 0.55;
  pointer-events: none;
}
.whale-queue-game::before {
  top: 16px;
  left: 42%;
  font-size: 16px;
}
.whale-queue-game::after {
  right: 32px;
  bottom: 98px;
  font-size: 22px;
}
.wq-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 10px 8px;
}
.wq-kicker {
  color: var(--wq-blue);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 3px;
}
.wq-heading h2 {
  margin: 5px 0 2px;
  color: var(--wq-navy);
  font-size: clamp(23px, 4vw, 31px);
  letter-spacing: 1px;
}
.wq-heading p {
  margin: 0;
  color: var(--wq-sub);
  font-size: 13px;
}
.wq-character {
  position: relative;
  width: 104px;
  height: 86px;
  flex: 0 0 auto;
}
.wq-character img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 12px 15px #2b3a6720);
}
.wq-sparkle {
  position: absolute;
  top: 4px;
  right: 1px;
  color: var(--wq-gold);
  animation: wq-twinkle 2.3s ease-in-out infinite;
}
@keyframes wq-twinkle {
  50% {
    transform: scale(1.3) rotate(14deg);
    opacity: 0.65;
  }
}
.wq-hud {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: 1px solid #d4e5fa;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 13px 28px -22px #17204080;
}
.wq-stat {
  display: grid;
  grid-template-columns: 28px auto;
  align-items: center;
  column-gap: 6px;
  min-width: 94px;
}
.wq-stat img {
  grid-row: span 2;
  width: 27px;
  height: 27px;
  object-fit: contain;
}
.wq-stat span {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.1;
}
.wq-stat b {
  color: var(--wq-blue);
  font-size: 18px;
}
.wq-stat small {
  color: #8294b8;
  font-size: 10px;
}
.wq-score {
  display: grid;
  gap: 0;
  margin-left: auto;
  text-align: right;
  color: #8294b8;
  font-size: 10px;
}
.wq-score strong {
  color: var(--wq-navy);
  font-size: 21px;
  line-height: 1.1;
}
.wq-think-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 6px 12px;
  border: 1px solid #cfdef5;
  border-radius: 999px;
  background: var(--wq-pale);
  color: var(--wq-blue);
  cursor: pointer;
  font-size: 12px;
  font-weight: 700;
}
.wq-think-button img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}
.wq-think-button b {
  color: #b8933f;
}
.wq-think-button:disabled {
  opacity: 0.48;
  cursor: default;
}
.wq-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px;
  align-items: start;
  gap: 18px;
  margin-top: 18px;
}
.wq-play-panel {
  min-width: 0;
}
.wq-board-frame {
  position: relative;
  width: min(100%, 650px);
  margin: 0 auto;
  aspect-ratio: 1;
}
.wq-board-frame::before {
  content: '';
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-image: var(--wq-frame-url);
  pointer-events: none;
  z-index: 3;
}
.whale-queue-board {
  position: absolute;
  inset: 16.67%;
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  grid-template-rows: repeat(16, 1fr);
  overflow: hidden;
  border: 2px solid #79b9e8;
  border-radius: 18px;
  background-color: #b8e8f7;
  box-shadow:
    inset 0 0 35px #2b3a6730,
    0 10px 24px -16px #17204099;
  outline: none;
  isolation: isolate;
}
.whale-queue-board::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: var(--wq-board-url);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0.9;
  z-index: -1;
}
.whale-queue-board:focus-visible {
  outline: 3px solid var(--wq-gold);
  outline-offset: 3px;
}
.wq-cell {
  position: relative;
  z-index: 0;
  border: 1px solid #fff4;
  background: #abdef135;
}
.wq-cell-rock {
  background: #6d89ad20;
}
.wq-entity {
  position: absolute;
  z-index: 2;
  width: 6.25%;
  height: 6.25%;
  object-fit: contain;
  pointer-events: none;
}
.wq-rock {
  z-index: 1;
  transform: scale(1.1);
}
.wq-star {
  z-index: 2;
  transform: scale(0.88);
  filter: drop-shadow(0 0 7px #ffd76a);
  animation: wq-float 1.7s ease-in-out infinite;
}
.wq-shell {
  z-index: 2;
  transform: scale(0.9);
  animation: wq-float 2.5s ease-in-out infinite reverse;
}
.wq-queue-whale {
  z-index: 2;
  transform: scale(0.86);
}
.wq-player {
  z-index: 4;
  transform: scale(1.14);
}
.wq-effect {
  z-index: 5;
  transform: scale(1.8);
}
.wq-effect-think {
  animation: wq-spin 2.5s linear infinite;
}
.wq-effect-collect,
.wq-effect-shell {
  animation: wq-pop 0.65s ease-out both;
}
.wq-effect-bump {
  animation: wq-shake 0.5s ease-out both;
}
@keyframes wq-float {
  50% {
    transform: translateY(-4%) scale(0.9);
  }
}
@keyframes wq-pop {
  from {
    opacity: 1;
    transform: scale(0.5);
  }
  to {
    opacity: 0;
    transform: scale(2);
  }
}
@keyframes wq-spin {
  to {
    transform: scale(1.8) rotate(360deg);
  }
}
@keyframes wq-shake {
  25% {
    transform: translateX(-9%);
  }
  50% {
    transform: translateX(9%);
  }
  75% {
    transform: translateX(-5%);
  }
}
.reduce-motion * {
  animation: none !important;
  transition: none !important;
}
.wq-board-status {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  padding: 7px 6px 0;
  color: var(--wq-sub);
  font-size: 12px;
}
.wq-board-status span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.wq-board-status small {
  color: var(--wq-blue);
}
.wq-side-panel {
  display: grid;
  gap: 12px;
}
.wq-side-card {
  padding: 16px;
  border: 1px solid #d9e8f7;
  border-radius: 20px;
  background: #fff;
  box-shadow: 0 13px 28px -25px #17204080;
}
.wq-side-label {
  color: #b8933f;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
}
.wq-side-card p {
  margin: 8px 0 0;
  color: var(--wq-sub);
  font-size: 12px;
  line-height: 1.7;
}
.wq-side-card .wq-controls-copy {
  margin-top: 13px;
  color: #8294b8;
  font-size: 10px;
}
.wq-start,
.wq-restart-local {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 46px;
  padding: 10px 14px;
  border: 0;
  border-radius: 999px;
  background: linear-gradient(120deg, var(--wq-navy-soft), var(--wq-sky));
  box-shadow: 0 12px 22px -12px #2b3a67b3;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 800;
}
.wq-restart-local {
  background: #fff;
  border: 1px solid #cfdef5;
  color: var(--wq-blue);
  box-shadow: none;
}
.wq-start:hover,
.wq-restart-local:hover {
  transform: translateY(-2px);
}
.wq-direction-pad {
  display: grid;
  grid-template-columns: repeat(3, 48px);
  justify-content: center;
  gap: 6px;
  margin-top: 14px;
}
.wq-direction-pad button {
  width: 48px;
  height: 42px;
  border: 1px solid #c8ddf5;
  border-radius: 14px;
  background: #fff;
  color: var(--wq-blue);
  cursor: pointer;
  font-size: 23px;
  line-height: 1;
  box-shadow: 0 6px 13px -10px #17204099;
  touch-action: manipulation;
}
.wq-direction-pad button:hover {
  border-color: var(--wq-sky);
  background: var(--wq-pale);
}
.wq-footer-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin: 12px 0 0;
  color: #8294b8;
  font-size: 11px;
}
@media (max-width: 760px) {
  .whale-queue-game {
    padding: 14px;
    border-radius: 21px;
  }
  .wq-heading {
    padding-inline: 3px;
  }
  .wq-character {
    width: 84px;
    height: 68px;
  }
  .wq-hud {
    flex-wrap: wrap;
    gap: 8px;
  }
  .wq-stat {
    min-width: 82px;
  }
  .wq-score {
    order: 3;
    margin-left: 0;
    margin-right: auto;
  }
  .wq-think-button {
    order: 4;
  }
  .wq-layout {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .wq-side-panel {
    grid-template-columns: 1fr auto;
    align-items: stretch;
  }
  .wq-side-card {
    grid-row: span 2;
  }
  .wq-start,
  .wq-restart-local {
    min-width: 132px;
  }
  .wq-board-status {
    display: grid;
    justify-content: stretch;
    gap: 2px;
  }
}
@media (max-width: 430px) {
  .wq-heading h2 {
    font-size: 21px;
  }
  .wq-heading p {
    max-width: 210px;
    font-size: 11px;
  }
  .wq-kicker {
    font-size: 8px;
    letter-spacing: 2px;
  }
  .wq-hud {
    padding: 8px;
  }
  .wq-stat {
    min-width: 70px;
    grid-template-columns: 23px auto;
  }
  .wq-stat img {
    width: 22px;
    height: 22px;
  }
  .wq-stat span {
    font-size: 12px;
  }
  .wq-stat b {
    font-size: 15px;
  }
  .wq-think-button {
    flex: 1;
    justify-content: center;
    min-height: 42px;
    padding-inline: 7px;
    font-size: 10px;
  }
  .wq-think-button img {
    width: 22px;
    height: 22px;
  }
  .wq-side-panel {
    grid-template-columns: 1fr;
  }
  .wq-side-card {
    grid-row: auto;
  }
  .wq-start,
  .wq-restart-local {
    width: 100%;
  }
}
</style>
