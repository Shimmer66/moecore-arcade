<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { ArrowUp, ArrowDown, Undo2, Heart } from '@lucide/vue';
import { PARKOUR_BACKGROUNDS } from '@moecore/assets';
import type { GameProps, GameResult } from '@moecore/game-sdk';
import { reactionActionSprites, reactionPortraits } from '../config/reactions';
import { createRhythmMusic } from '../rhythm-music';
import type { MissionOptions } from '../rules/journey';
import {
  advanceRhythm,
  beginRhythm,
  rhythmChart,
  rhythmGrade,
  rhythmSection,
  RHYTHM_END_MS,
  RHYTHM_BEST_KEY,
  LEAD_IN_MS,
  type RhythmAction,
} from '../rules/rhythm';

const props = defineProps<GameProps & { mission?: MissionOptions }>();
const emit = defineEmits<{
  finish: [result: GameResult];
  back: [];
  progress: [milliseconds: number];
}>();
const state = shallowRef(beginRhythm(props.mission?.assisted));
const phase = ref<'ready' | 'playing' | 'ended'>('ready');
const muted = ref(false);
const best = ref(0);
const world = ref<HTMLElement>();
const controls = ref<HTMLElement>();
try {
  muted.value = localStorage.getItem('moecore:parkour:muted') === 'true';
  const saved = Number(localStorage.getItem(RHYTHM_BEST_KEY));
  if (Number.isSafeInteger(saved) && saved > 0) best.value = saved;
} catch {
  /* In-memory play works without browser storage. */
}
const music = createRhythmMusic(() => (muted.value ? 0 : props.settings.masterVolume));
const actions = [
  { id: 'jump', name: '跳跃', key: '空格 / ↑', icon: ArrowUp, y: 66 },
  { id: 'tail', name: '甩尾', key: 'X / Shift', icon: Undo2, y: 150 },
  { id: 'slide', name: '滑铲', key: '↓ / S', icon: ArrowDown, y: 234 },
] as const;
const notes = computed(() =>
  rhythmChart
    .slice(state.value.cursor)
    .filter((note) => note.at - state.value.elapsed < 2100 && note.at - state.value.elapsed > -150),
);
const feedback = computed(() => {
  const last = state.value.last;
  if (!last || state.value.elapsed - last.at > 650) return '';
  return {
    perfect: '精准！',
    good: '接住了！',
    miss: '漏拍！',
    wrong: '上下文切错了！',
  }[last.kind];
});
const countIn = computed(() =>
  state.value.elapsed < LEAD_IN_MS ? Math.ceil((LEAD_IN_MS - state.value.elapsed) / 500) : 0,
);
const lastAction = ref<RhythmAction>('tail');
const actionAt = ref(-1000);
const activePose = computed(() =>
  state.value.elapsed - actionAt.value < 180 ? lastAction.value : '',
);
const section = computed(() => rhythmSection(state.value.elapsed));
let frame = 0;
let anchor = 0;
let baseTime = 0;
let disposed = false;
let finished = false;
const elapsedNow = () =>
  Math.min(RHYTHM_END_MS, Math.max(state.value.elapsed, baseTime + performance.now() - anchor));

function finish() {
  if (finished) return;
  finished = true;
  phase.value = 'ended';
  cancelAnimationFrame(frame);
  music.stop(state.value.elapsed);
  const current = state.value;
  const won = current.status === 'won';
  if (!props.mission && won && current.score > best.value) {
    best.value = current.score;
    try {
      localStorage.setItem(RHYTHM_BEST_KEY, String(current.score));
    } catch {
      /* Session record stays visible. */
    }
  }
  emit('finish', {
    gameId: 'parkour',
    sessionId: props.sessionId,
    outcome: won ? 'win' : 'lose',
    durationMs: Math.round(current.elapsed),
    summary: `Token 蹦迪 · ${rhythmGrade(current)} · ${current.score} 分 · 精准 ${current.perfect}/${rhythmChart.length} · 最长 ${current.bestCombo} 连击`,
    reselectLabel: '返回航线选择',
    story: {
      title: won ? '节拍送达，Token 没白花' : '上下文掉拍了',
      body: won
        ? `${current.misses === 0 && current.wrong === 0 ? '全连交付！' : '整首送达！'}${current.perfect === rhythmChart.length && current.wrong === 0 ? '尾巴：每一拍都算数。' : '下一局把音符打在线上，挑战全精准。'}`
        : '尾巴：别连按，等 Token 到竖线再出手。上排跳、中排甩尾、下排滑铲。',
      ...(reactionPortraits[won ? 'burst' : 'hallucination']
        ? { imageUrl: reactionPortraits[won ? 'burst' : 'hallucination']! }
        : {}),
    },
    stats: {
      score: current.score,
      perfect: current.perfect,
      good: current.good,
      misses: current.misses,
      wrong: current.wrong,
      bestCombo: current.bestCombo,
    },
  });
}
function update(action?: RhythmAction) {
  if (phase.value !== 'playing' || props.paused || disposed) return;
  const before = state.value;
  const after = advanceRhythm(before, elapsedNow(), action);
  if (Math.floor(after.elapsed / 100) !== Math.floor(before.elapsed / 100))
    emit('progress', after.elapsed);
  state.value = after;
  if (after.last && after.last !== before.last) music.hit(after.last.kind);
  if (after.status !== 'running') finish();
}
function animate() {
  update();
  if (phase.value !== 'playing' || props.paused || disposed) return;
  music.sync(state.value.elapsed);
  frame = requestAnimationFrame(animate);
}
function start() {
  if (phase.value !== 'ready' || props.paused) return;
  music.unlock();
  phase.value = 'playing';
  anchor = performance.now();
  baseTime = 0;
  void nextTick(() => {
    if (disposed) return;
    world.value?.focus({ preventScroll: true });
    controls.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
  });
  music.sync(0);
  frame = requestAnimationFrame(animate);
}
function press(action: RhythmAction) {
  if (phase.value !== 'playing' || props.paused) return;
  music.unlock();
  lastAction.value = action;
  actionAt.value = elapsedNow();
  update(action);
}
function keydown(event: KeyboardEvent) {
  const action: RhythmAction | undefined = ['Space', 'ArrowUp', 'KeyW'].includes(event.code)
    ? 'jump'
    : ['KeyX', 'ShiftLeft', 'ShiftRight'].includes(event.code)
      ? 'tail'
      : ['ArrowDown', 'KeyS'].includes(event.code)
        ? 'slide'
        : undefined;
  if (!action || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  if (phase.value === 'ready' && event.code === 'Space') start();
  else press(action);
}
function toggleSound() {
  muted.value = !muted.value;
  if (muted.value) music.stop(state.value.elapsed);
  else music.unlock();
  try {
    localStorage.setItem('moecore:parkour:muted', String(muted.value));
  } catch {
    /* Session preference. */
  }
}
watch(
  () => props.paused,
  (paused) => {
    cancelAnimationFrame(frame);
    music.stop(state.value.elapsed);
    baseTime = state.value.elapsed;
    anchor = performance.now();
    if (!paused && phase.value === 'playing') frame = requestAnimationFrame(animate);
  },
);
onMounted(() => {
  window.addEventListener('keydown', keydown);
  if (props.mission || (props.attempt > 1 && props.restartMode !== 'select')) start();
});
onUnmounted(() => {
  disposed = true;
  cancelAnimationFrame(frame);
  music.dispose();
  window.removeEventListener('keydown', keydown);
});
</script>

<template>
  <section class="rhythm-game">
    <header class="rhythm-hud">
      <div>
        <h2>Token 蹦迪</h2>
        <small>{{ section }} · 120 BPM</small>
      </div>
      <button type="button" :aria-pressed="muted" aria-label="静音" @click="toggleSound">
        {{ muted ? '音效：关' : '音效：开' }}
      </button>
      <div class="rhythm-health" :aria-label="`剩余 ${state.health} 次体力`">
        <Heart
          v-for="n in state.maxHealth"
          :key="n"
          :size="13"
          :fill="n <= state.health ? 'currentColor' : 'none'"
        />
      </div>
      <strong>{{ state.score.toLocaleString() }} 分</strong>
    </header>
    <div v-if="phase === 'ready' && !mission" class="rhythm-intro">
      <p><b>尾巴：这回不写长文，按拍交付。</b></p>
      <p>
        音符到竖线时出手：上排跳跃、中排甩尾、下排滑铲。提前四拍起步，后半段加入半拍。乱按和漏拍会掉体力。
      </p>
      <p>目标：完成 50 秒 → 全连 → 全精准（±50ms）。{{ best ? `本机最高 ${best} 分。` : '' }}</p>
      <div class="rhythm-ready-actions">
        <button class="primary-button" type="button" @click="start">开始打拍</button>
        <button type="button" @click="emit('back')">返回跑酷航线</button>
      </div>
    </div>
    <progress :value="state.elapsed" :max="RHYTHM_END_MS" aria-label="曲目进度" />
    <div
      ref="world"
      class="rhythm-world"
      tabindex="0"
      role="application"
      aria-label="Token 节拍跑道"
      :data-phase="phase"
      :data-elapsed="state.elapsed"
      :data-cursor="state.cursor"
      :data-health="state.health"
      :class="{ quiet: settings.reduceMotion, paused: paused }"
    >
      <img class="rhythm-background" :src="PARKOUR_BACKGROUNDS[1]" alt="" />
      <div class="rhythm-tint"></div>
      <div
        v-for="action in actions"
        :key="action.id"
        class="rhythm-lane"
        :style="{ top: `${action.y}px` }"
      >
        <span>{{ action.name }}</span>
      </div>
      <div
        class="rhythm-hit-line"
        :class="{ beat: phase === 'playing' && state.elapsed % 500 < 85 }"
      >
        <span>到线出手</span>
      </div>
      <img class="rhythm-player" :class="activePose" :src="reactionActionSprites.burst" alt="" />
      <div
        v-for="note in notes"
        :key="note.id"
        class="rhythm-note"
        :class="note.action"
        :data-at="note.at"
        :data-action="note.action"
        :style="{
          left: `calc(23% + ${((note.at - state.elapsed) / 2000) * 77}%)`,
          top: `${actions.find((action) => action.id === note.action)!.y}px`,
        }"
      >
        <component :is="actions.find((action) => action.id === note.action)!.icon" :size="22" />
      </div>
      <div v-if="phase === 'playing' && countIn" class="rhythm-count">
        {{ countIn }}<small>跟着四拍准备</small>
      </div>
      <div v-else-if="feedback" class="rhythm-judgement" :class="state.last?.kind" role="status">
        {{ feedback }}<small v-if="state.combo > 1">{{ state.combo }} 连击 · Token 到账</small>
      </div>
    </div>
    <div class="rhythm-readout">
      <span>{{ (state.elapsed / 1000).toFixed(1) }} / 50 秒</span
      ><span>精准 {{ state.perfect }} · 命中 {{ state.good }}</span
      ><span>{{ state.combo }} 连击</span>
    </div>
    <div ref="controls" class="rhythm-controls">
      <button
        v-for="action in actions"
        :key="action.id"
        type="button"
        :disabled="phase !== 'playing' || paused"
        :aria-label="action.name"
        @pointerdown.prevent="press(action.id)"
        @keydown.enter.prevent="press(action.id)"
        @click="if ($event.detail === 0) press(action.id);"
      >
        <component :is="action.icon" :size="23" /><b>{{ action.name }}</b
        ><small>{{ action.key }}</small>
      </button>
    </div>
    <p class="rhythm-tip">不需要连按。音符到线才出手；连续精准，Token 翻倍赚。</p>
  </section>
</template>

<style scoped>
.rhythm-game {
  color: var(--home-ink);
}
.rhythm-hud {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-bottom: 12px;
  flex-wrap: wrap;
}
.rhythm-hud h2 {
  margin: 0 0 3px;
  font-size: 20px;
}
.rhythm-hud small {
  color: var(--home-muted);
}
.rhythm-hud > div:first-child {
  margin-right: auto;
}
.rhythm-hud button,
.rhythm-ready-actions > button:last-child {
  border: 1px solid #c8b9e7;
  background: #f8f3ff;
  color: #5b477c;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.rhythm-health {
  display: flex;
  gap: 3px;
  color: #cb607e;
}
.rhythm-intro {
  background: #f7f3fd;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.65;
}
.rhythm-intro p {
  margin: 0 0 8px;
}
.rhythm-ready-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.rhythm-game > progress {
  width: 100%;
  height: 4px;
  display: block;
  border: none;
  accent-color: #8a5eca;
}
.rhythm-world {
  position: relative;
  height: 300px;
  overflow: hidden;
  isolation: isolate;
  background: #292151;
  border-radius: 0 0 12px 12px;
}
.rhythm-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.rhythm-tint {
  position: absolute;
  inset: 0;
  background: #261a5366;
}
.rhythm-lane {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px solid #ffffff70;
}
.rhythm-lane > span {
  position: absolute;
  right: 8px;
  top: -22px;
  color: white;
  font-size: 11px;
  text-shadow: 0 1px 3px #211233;
}
.rhythm-hit-line {
  position: absolute;
  left: 23%;
  top: 25px;
  bottom: 22px;
  border-left: 3px solid #fff;
  box-shadow: 0 0 12px #e9c0ff;
}
.rhythm-hit-line > span {
  position: absolute;
  top: -18px;
  left: -28px;
  white-space: nowrap;
  color: white;
  font-size: 10px;
}
.rhythm-hit-line.beat {
  border-color: #ffe6a2;
  box-shadow: 0 0 18px #ffe6a2;
}
.quiet .rhythm-hit-line.beat {
  border-color: white;
  box-shadow: 0 0 12px #e9c0ff;
}
.rhythm-player {
  position: absolute;
  width: 78px;
  height: 92px;
  object-fit: contain;
  left: calc(23% - 80px);
  top: 115px;
  transition: transform 80ms;
}
.rhythm-player.jump {
  transform: translateY(-55px) rotate(-8deg);
}
.rhythm-player.slide {
  transform: translateY(48px) scaleY(0.75);
}
.rhythm-player.tail {
  transform: rotate(12deg);
}
.quiet .rhythm-player {
  transition: none;
}
.rhythm-note {
  position: absolute;
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 3px 0 #34244e;
  color: #243052;
  z-index: 2;
}
.rhythm-note.jump {
  background: #b5e7ff;
}
.rhythm-note.tail {
  background: #ffdd95;
}
.rhythm-note.slide {
  background: #ecc1ff;
}
.rhythm-count,
.rhythm-judgement {
  position: absolute;
  top: 103px;
  left: 42%;
  right: 5%;
  text-align: center;
  color: #fff1b6;
  font-size: 23px;
  font-weight: 800;
  text-shadow: 0 2px 6px #2d164a;
  pointer-events: none;
  z-index: 3;
}
.rhythm-count {
  font-size: 48px;
  top: 95px;
}
.rhythm-judgement {
  top: 7px;
  font-size: 16px;
  line-height: 1.15;
}
.rhythm-count small,
.rhythm-judgement small {
  display: block;
  font-size: 13px;
  margin-top: 4px;
}
.rhythm-judgement small {
  font-size: 11px;
  margin-top: 2px;
}
.rhythm-judgement.miss,
.rhythm-judgement.wrong {
  color: #ffc6df;
}
.rhythm-readout {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #66517f;
  padding: 10px 0;
  font-variant-numeric: tabular-nums;
}
.rhythm-controls {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  scroll-margin-bottom: 12px;
}
.rhythm-controls button {
  display: grid;
  justify-items: center;
  gap: 2px;
  border: 1px solid #dcccf0;
  border-radius: 10px;
  background: #f5effc;
  color: #57407a;
  padding: 8px 4px;
  min-height: 72px;
  cursor: pointer;
  touch-action: manipulation;
}
.rhythm-controls button:active:not(:disabled) {
  background: #dec5fb;
}
.rhythm-controls small {
  font-size: 10px;
}
.rhythm-tip {
  font-size: 11px;
  color: var(--home-muted);
}
@media (max-width: 500px) {
  .rhythm-hud {
    gap: 8px;
  }
  .rhythm-hud h2 {
    font-size: 16px;
  }
  .rhythm-hud small {
    font-size: 10px;
  }
  .rhythm-hud strong {
    font-size: 13px;
  }
  .rhythm-hud > div:first-child {
    width: calc(100% - 90px);
  }
  .rhythm-player {
    width: 62px;
    left: calc(23% - 64px);
  }
  .rhythm-note {
    width: 32px;
    height: 32px;
  }
  .rhythm-judgement {
    font-size: 16px;
  }
}
</style>
