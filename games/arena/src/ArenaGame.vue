<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { HOME_ART } from '@moecore/assets';
import { GENERATED_WORLD_ART } from '@moecore/assets/generated-world';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Undo2,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
} from '@lucide/vue';
import {
  createState,
  start,
  step,
  undo,
  nextLevel,
  platforms,
  floorEdge,
  collected,
  LEVELS,
  STEP_MS,
} from './rules';
const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const state = ref(createState());
const scene = ref<HTMLElement>();
const viewportWidth = ref(780);
const touch = ref({ left: false, right: false });
const held = new Set<string>();
let jumpQueued = false;
let timer: ReturnType<typeof setInterval> | undefined;
let observer: ResizeObserver | undefined;
let audio: AudioContext | undefined;
const sound = ref(true);
let announced = false;
const effects = ref<{ id: number; x: number; y: number; life: number }[]>([]);
let effectId = 0;
const level = computed(() => LEVELS[state.value.level]!);
const visibleWidth = computed(() => viewportWidth.value);
const camera = computed(() =>
  Math.max(
    0,
    Math.min(1000 - visibleWidth.value, state.value.player.x - visibleWidth.value * 0.34),
  ),
);
const inverted = computed(() => state.value.level === 1 && state.value.glitch === 'active');
const speech = computed(() =>
  state.value.phase === 'rescue'
    ? '别急，我接住时间了！撤销一下，还能救。'
    : state.value.phase === 'clear'
      ? level.value.clear
      : state.value.glitch === 'warning'
        ? level.value.warning
        : state.value.glitch === 'active'
          ? level.value.active
          : state.value.glitch === 'fixed'
            ? level.value.fixed
            : '包的，前面的世界我都安排好了。你放心走。',
);
const canUndo = computed(
  () =>
    !props.paused &&
    (state.value.phase === 'rescue' ||
      (state.value.phase === 'playing' && state.value.glitch === 'active')),
);
const solids = computed(() => platforms(state.value));
const characterArt = computed(() =>
  state.value.player.grounded && state.value.player.vx !== 0
    ? GENERATED_WORLD_ART.deepseekRun
    : GENERATED_WORLD_ART.deepseekIdle,
);
const characterScale = computed(() => 72 / characterArt.value.visibleHeight);
function terrainArt(kind: string) {
  return kind === 'bridge' ? GENERATED_WORLD_ART.bridge : GENERATED_WORLD_ART.platform;
}
const tip = computed(() =>
  state.value.phase === 'rescue'
    ? '你还有救！点“拉我回来”，已捡的星星会保留。'
    : state.value.glitch === 'warning'
      ? '她又准备整活了。留意画面，随时准备撤销。'
      : inverted.value
        ? '顺着反向重力拿高处星星，再撤销回到地面。'
        : state.value.level === 2 && state.value.glitch === 'active'
          ? '地板正从身后消失！往前跑，或撤销这次压缩。'
          : '收集至少 2 颗灵感星，跳进右边的出口。',
);
function enableAudio() {
  if (!sound.value) return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => {});
  } catch {
    /* Sound is optional. */
  }
}
function tone(freq: number) {
  if (!sound.value || props.paused || !audio || audio.state !== 'running') return;
  const oscillator = audio.createOscillator(),
    gain = audio.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(freq, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(freq * 1.4, audio.currentTime + 0.09);
  gain.gain.setValueAtTime(0.055 * props.settings.masterVolume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.14);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start();
  oscillator.stop(audio.currentTime + 0.15);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
  };
}
function begin() {
  if (props.paused) return;
  enableAudio();
  state.value = start(state.value);
  scene.value?.focus({ preventScroll: true });
}
function release() {
  held.clear();
  touch.value = { left: false, right: false };
  jumpQueued = false;
}
function jump() {
  if (props.paused || state.value.phase !== 'playing') return;
  jumpQueued = true;
  enableAudio();
}
function correct() {
  if (!canUndo.value) return;
  if (state.value.phase === 'rescue') release();
  state.value = undo(state.value);
  tone(360);
  scene.value?.focus({ preventScroll: true });
}
function proceed() {
  if (props.paused) return;
  release();
  effects.value = [];
  state.value = nextLevel(state.value);
  scene.value?.focus({ preventScroll: true });
}
function press(e: PointerEvent, d: 'left' | 'right') {
  if (props.paused) return;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  touch.value[d] = true;
  enableAudio();
}
function keyboard(e: KeyboardEvent) {
  if (
    (e.target as HTMLElement)?.closest('input,textarea,select,button,a') ||
    e.ctrlKey ||
    e.metaKey ||
    e.altKey
  )
    return;
  const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space', 'KeyE'];
  if (!keys.includes(e.code) || props.paused) return;
  e.preventDefault();
  if (state.value.phase === 'ready') {
    if (e.code === 'Space' && !e.repeat) begin();
    return;
  }
  if (e.code === 'KeyE' && !e.repeat) {
    correct();
    return;
  }
  if (state.value.phase !== 'playing') return;
  held.add(e.code);
  if (['ArrowUp', 'KeyW', 'Space'].includes(e.code) && !e.repeat) jump();
}
watch(
  () => props.paused,
  () => {
    release();
    if (props.paused) void audio?.suspend().catch(() => {});
    else void audio?.resume().catch(() => {});
  },
);
watch(
  () => state.value.phase,
  (phase) => {
    if (phase === 'rescue' || phase === 'clear') release();
    if (phase !== 'done' || announced) return;
    announced = true;
    const stars = state.value.bankedStars + collected(state.value);
    emit('finish', {
      gameId: 'arena',
      sessionId: props.sessionId,
      outcome: 'win',
      durationMs: state.value.elapsedMs,
      summary: `三关完成 · 灵感 ${stars}/9 · 撤销 ${state.value.corrections} 次 · 坠落救场 ${state.value.rescues} 次`,
      story: {
        title: stars === 9 ? 'AI 整活终结者！' : '今天，世界保住了。',
        body:
          stars === 9
            ? '假桥、反重力、地板压缩都没难住你。她沉默了两秒：“下次我先问问你。”'
            : '你收拾好了她生成的烂摊子，还带回了一口袋灵感。她认真记下：“地板也是重要信息。”再试试顺着反重力捡齐九颗星。',
        imageUrl: HOME_ART.whaleQueue,
      },
      stats: {
        stars,
        corrections: state.value.corrections,
        rescues: state.value.rescues,
        levels: 3,
      },
    });
  },
);
onMounted(() => {
  observer = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (rect && rect.height > 0) viewportWidth.value = (rect.width / rect.height) * 440;
  });
  if (scene.value) observer.observe(scene.value);
  window.addEventListener('keydown', keyboard);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', release);
  timer = setInterval(() => {
    if (props.paused) return;
    if (state.value.phase === 'playing') {
      const before = state.value;
      const left = touch.value.left || held.has('ArrowLeft') || held.has('KeyA');
      const right = touch.value.right || held.has('ArrowRight') || held.has('KeyD');
      state.value = step(before, { horizontal: Number(right) - Number(left), jump: jumpQueued });
      jumpQueued = false;
      state.value.stars.forEach((found, i) => {
        if (found && !before.stars[i]) {
          const point = level.value.stars[i]!;
          effects.value.push({ id: ++effectId, x: point.x, y: point.y, life: 42 });
          tone(600 + i * 120);
        }
      });
      if (before.glitch === 'warning' && state.value.glitch === 'active') tone(160);
    }
    effects.value = effects.value
      .filter((f) => f.life > 0)
      .map((f) => ({ ...f, life: f.life - 1 }));
  }, STEP_MS);
});
function keyUp(e: KeyboardEvent) {
  held.delete(e.code);
}
onUnmounted(() => {
  if (timer) clearInterval(timer);
  observer?.disconnect();
  window.removeEventListener('keydown', keyboard);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('blur', release);
  void audio?.close().catch(() => {});
});
</script>

<template>
  <section
    class="glitch-game"
    :class="{ 'motion-still': settings.reduceMotion }"
    aria-label="别乱生成游戏"
    :data-phase="state.phase"
    :data-level="state.level"
    :data-glitch="state.glitch"
  >
    <header class="glitch-heading">
      <div>
        <span class="glitch-eyebrow">模型失控 · 生成事故现场</span>
        <h2>{{ level.title }}</h2>
      </div>
      <span class="glitch-chapter">{{ state.level + 1 }} <small>/ 3 关</small></span>
    </header>
    <div class="glitch-hud">
      <span
        ><Sparkles :size="16" /> 灵感
        <b data-testid="glitch-stars">{{ collected(state) }}/3</b></span
      ><span>出口需要 2 颗</span
      ><button
        type="button"
        :aria-label="sound ? '关闭音效' : '开启音效'"
        :aria-pressed="sound"
        @click="
          sound = !sound;
          if (sound) enableAudio();
        "
      >
        <Volume2 v-if="sound" :size="17" /><VolumeX v-else :size="17" />
      </button>
    </div>
    <div
      ref="scene"
      class="glitch-scene"
      tabindex="0"
      aria-label="生成世界关卡"
      :class="{ inverted, 'event-pop': state.glitch === 'active' && state.eventTicks < 25 }"
    >
      <svg
        class="glitch-world"
        :viewBox="`${camera} 0 ${visibleWidth} 440`"
        role="img"
        aria-label="可以移动和跳跃的生成世界"
      >
        <defs>
          <linearGradient id="glitch-sky" x2="0" y2="1">
            <stop stop-color="#eef0ff" />
            <stop offset="1" stop-color="#eaf8ff" />
          </linearGradient>
          <linearGradient id="glitch-portal" x2="0" y2="1">
            <stop stop-color="#a997ff" />
            <stop offset="1" stop-color="#6c78ef" />
          </linearGradient>
          <pattern id="glitch-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#fff" stroke-opacity=".6" />
          </pattern>
        </defs>
        <image
          v-if="state.level === 0"
          :href="GENERATED_WORLD_ART.background"
          x="0"
          y="0"
          :width="Math.max(1000, visibleWidth)"
          height="440"
          preserveAspectRatio="xMidYMid slice"
        />
        <g v-else>
          <rect x="0" y="0" width="1000" height="440" fill="url(#glitch-sky)" />
          <rect x="0" y="0" width="1000" height="440" fill="url(#glitch-grid)" />
          <circle cx="800" cy="95" r="48" fill="#fff5c7" />
          <path
            d="M0 290L120 155l160 160 120-140 155 155 185-140 180 150 80-70v170H0Z"
            fill="#dbe6fa"
            opacity=".6"
          />
          <g class="world-clouds" fill="#fff" opacity=".85">
            <rect x="80" y="80" width="120" height="24" rx="12" />
            <circle cx="125" cy="80" r="24" />
            <rect x="460" y="47" width="135" height="25" rx="12" />
            <circle cx="510" cy="49" r="27" />
          </g>
        </g>
        <g v-if="state.level === 0 && state.glitch === 'active'" aria-hidden="true">
          <rect
            x="330"
            y="354"
            width="240"
            height="24"
            rx="5"
            fill="none"
            stroke="#a99dda"
            stroke-dasharray="8 8"
          />
          <text x="450" y="405" text-anchor="middle" fill="#a18bc2" font-size="14">
            桥：仅供参考
          </text>
        </g>
        <g v-if="state.level === 2 && state.glitch === 'active'" aria-hidden="true">
          <g v-for="gap in [600, 800]" :key="gap">
            <rect
              :x="gap"
              y="354"
              width="96"
              height="22"
              rx="5"
              fill="none"
              stroke="#b4a2d5"
              stroke-dasharray="5 5"
            />
            <text :x="gap + 48" y="398" text-anchor="middle" fill="#9a86b9" font-size="12">
              此处省略地板
            </text>
          </g>
          <rect x="0" y="355" :width="floorEdge(state)" height="85" fill="#d0c1ef" opacity=".4" />
          <text
            :x="Math.max(80, floorEdge(state) - 60)"
            y="390"
            text-anchor="middle"
            fill="#9881ba"
            font-size="13"
          >
            已压缩
          </text>
        </g>
        <g v-for="(p, i) in solids" :key="`${p.kind}-${i}`">
          <svg
            v-if="state.level === 0"
            :x="p.x"
            :y="p.y"
            :width="p.w"
            :height="p.kind === 'bridge' ? p.h : Math.min(p.h, Math.max(18, p.w / 6))"
            :viewBox="terrainArt(p.kind).viewBox"
            preserveAspectRatio="none"
            overflow="hidden"
          >
            <image
              :href="terrainArt(p.kind).url"
              :width="terrainArt(p.kind).width"
              :height="terrainArt(p.kind).height"
            />
          </svg>
          <g v-else>
            <rect
              :x="p.x"
              :y="p.y"
              :width="p.w"
              :height="p.h"
              rx="5"
              :fill="p.kind === 'bridge' ? '#b9a8e6' : p.kind === 'ceiling' ? '#b7c1f1' : '#aed6d1'"
            />
            <rect
              :x="p.x"
              :y="p.y"
              :width="p.w"
              height="7"
              rx="3"
              :fill="p.kind === 'bridge' ? '#d3c5ff' : '#d2ece5'"
            />
          </g>
        </g>
        <g
          v-for="(star, i) in level.stars"
          :key="`star-${state.level}-${i}`"
          :opacity="state.stars[i] ? 0 : 1"
          :transform="`translate(${star.x} ${star.y})`"
          class="level-star"
        >
          <circle r="22" fill="#fff7d0" opacity=".8" />
          <path
            d="M0-16 5-5 17-4 8 4 10 16 0 10-10 16-8 4-17-4-5-5Z"
            fill="#ffcc58"
            stroke="#e7b444"
            stroke-width="2"
          />
        </g>
        <g transform="translate(925 275)">
          <rect
            width="55"
            height="80"
            rx="26"
            fill="url(#glitch-portal)"
            :opacity="collected(state) >= 2 ? 1 : 0.4"
          />
          <rect x="8" y="8" width="39" height="72" rx="20" fill="#c7d1ff" />
          <text x="28" y="50" text-anchor="middle" fill="#6575c0" font-size="28">↗</text>
          <text x="28" y="-12" text-anchor="middle" fill="#7586b0" font-size="12">
            {{ collected(state) >= 2 ? '出口已开启' : '需要 2 颗星' }}
          </text>
        </g>
        <g v-if="inverted" fill="#a89bce" font-size="28" opacity=".65">
          <text x="320" y="225">↑</text>
          <text x="610" y="240">↑</text>
          <text x="880" y="200">↑</text>
        </g>
        <g
          :transform="`translate(${state.player.x + 16} ${state.player.y + 48})`"
          data-testid="glitch-player"
          :data-x="Math.round(state.player.x)"
          :data-y="Math.round(state.player.y)"
          :data-grounded="state.player.grounded"
        >
          <ellipse cx="0" cy="0" rx="22" ry="5" fill="#455781" opacity=".14" />
          <g
            :transform="`scale(${state.player.facing} ${inverted ? -1 : 1}) translate(0 ${inverted ? 48 : 0})`"
          >
            <image
              :href="characterArt.url"
              :x="-characterArt.anchorX * characterScale"
              :y="-characterArt.baseline * characterScale"
              :width="characterArt.width * characterScale"
              :height="characterArt.height * characterScale"
              data-testid="glitch-character-art"
              :class="{ walking: state.player.grounded && state.player.vx !== 0 }"
            />
          </g>
        </g>
        <g
          v-for="effect in effects"
          :key="effect.id"
          :transform="`translate(${effect.x} ${effect.y - (42 - effect.life)})`"
          :opacity="effect.life / 42"
        >
          <text text-anchor="middle" fill="#bf8b17" font-size="17" font-weight="600">+1 灵感</text>
        </g>
      </svg>
      <div v-if="state.glitch === 'warning' && state.phase === 'playing'" class="glitch-warning">
        <Sparkles :size="16" /> AI 正在“优化”世界…
      </div>
      <div v-if="state.phase === 'ready'" class="glitch-overlay">
        <div class="glitch-modal">
          <span>欢迎来到生成世界</span>
          <h3>她负责整活，<br />你负责活着回来。</h3>
          <p>移动、跳跃，收集星星。世界出岔子时，按 E 或点击撤销救场。</p>
          <button type="button" class="primary-button" @click="begin">
            <Play :size="17" /><span>开始整活</span>
          </button>
          <small>键盘：A / D 移动 · 空格跳跃 · E 撤销</small>
        </div>
      </div>
      <div v-else-if="state.phase === 'rescue'" class="glitch-overlay rescue-overlay">
        <div class="glitch-modal">
          <span>等等，还能救！</span>
          <h3>先别掉，撤销一下。</h3>
          <p>回到最近的安全落脚点，星星不会丢。</p>
          <button type="button" class="primary-button" @click="correct">
            <Undo2 :size="18" />拉我回来
          </button>
        </div>
      </div>
      <div v-else-if="state.phase === 'clear'" class="glitch-overlay">
        <div class="glitch-modal">
          <span>这次真的过关了</span>
          <h3>{{ level.clear }}</h3>
          <p>本关灵感 {{ collected(state) }}/3 · 她的改动已被你收拾妥当。</p>
          <button type="button" class="primary-button" @click="proceed">
            {{ state.level === 2 ? '看看事故报告' : '下一场事故' }}<ArrowRight :size="17" />
          </button>
        </div>
      </div>
    </div>
    <div class="glitch-controls" aria-label="角色操作">
      <button
        type="button"
        aria-label="向左移动"
        :disabled="paused || state.phase !== 'playing'"
        @pointerdown.prevent="press($event, 'left')"
        @pointerup="touch.left = false"
        @pointercancel="touch.left = false"
        @lostpointercapture="touch.left = false"
        @keydown.space.prevent="touch.left = true"
        @keyup.space="touch.left = false"
        @keydown.enter.prevent="touch.left = true"
        @keyup.enter="touch.left = false"
        @blur="touch.left = false"
      >
        <ArrowLeft :size="22" />
      </button>
      <button
        type="button"
        aria-label="向右移动"
        :disabled="paused || state.phase !== 'playing'"
        @pointerdown.prevent="press($event, 'right')"
        @pointerup="touch.right = false"
        @pointercancel="touch.right = false"
        @lostpointercapture="touch.right = false"
        @keydown.space.prevent="touch.right = true"
        @keyup.space="touch.right = false"
        @keydown.enter.prevent="touch.right = true"
        @keyup.enter="touch.right = false"
        @blur="touch.right = false"
      >
        <ArrowRight :size="22" />
      </button>
      <button
        type="button"
        aria-label="跳跃"
        :disabled="paused || state.phase !== 'playing'"
        @pointerdown.prevent="jump"
        @click="if ($event.detail === 0) jump();"
      >
        <ArrowUp :size="22" /><span>跳跃</span>
      </button>
      <button type="button" class="undo-world" :disabled="!canUndo" @click="correct">
        <Undo2 :size="20" /><span>{{ state.glitch === 'fixed' ? '已修正' : '撤销改动' }}</span
        ><kbd>E</kbd>
      </button>
    </div>
    <div class="glitch-narrator" role="status" aria-live="polite">
      <img :src="HOME_ART.whaleQueue" alt="AI 小鲸" />
      <div>
        <span>小鲸说</span>
        <p>{{ speech }}</p>
      </div>
    </div>
    <p class="glitch-tip">{{ tip }}</p>
  </section>
</template>

<style scoped>
.glitch-game {
  max-width: 1000px;
  margin: auto;
  color: var(--ui-ink, #182230);
}
.glitch-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  gap: 12px;
}
.glitch-heading h2 {
  font-size: 27px;
  font-weight: 650;
  letter-spacing: -0.5px;
  margin: 4px 0 0;
}
.glitch-eyebrow {
  color: #8a79bd;
  font-size: 12px;
}
.glitch-chapter {
  font-size: 26px;
  font-weight: 600;
  color: #7463be;
}
.glitch-chapter small {
  font-size: 12px;
  color: #98a0b3;
  font-weight: 400;
}
.glitch-hud {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 12px;
  color: #8993a9;
  margin-bottom: 10px;
}
.glitch-hud > span:first-child {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  color: #927841;
}
.glitch-hud b {
  color: #8e6b25;
}
.glitch-hud button {
  margin-left: auto;
  display: grid;
  place-items: center;
  border: 0;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: #7c88a0;
  background: #f4f6fa;
}
.glitch-scene {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: #edf4ff;
  outline-offset: 3px;
}
.glitch-scene:focus-visible {
  outline: 2px solid #b9b8e8;
}
.glitch-world {
  display: block;
  width: 100%;
  height: clamp(280px, 49svh, 440px);
}
.glitch-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 14px;
  background: #e9edfa59;
  backdrop-filter: blur(3px);
}
.glitch-modal {
  width: min(365px, 100%);
  border-radius: 18px;
  background: #fffffff2;
  padding: 24px 26px;
  text-align: center;
  box-shadow: 0 18px 60px #6e7d9c22;
}
.glitch-modal > span {
  color: #9b8bbc;
  font-size: 11px;
}
.glitch-modal h3 {
  margin: 9px 0 12px;
  font-weight: 650;
  font-size: 23px;
  line-height: 1.5;
  color: #43516c;
}
.glitch-modal p {
  color: #8491a8;
  font-size: 12px;
  line-height: 1.8;
}
.glitch-modal .primary-button {
  background: #8371d9;
  width: 100%;
  margin-top: 7px;
}
.glitch-modal small {
  display: block;
  margin-top: 12px;
  color: #9ba5b6;
  font-size: 10px;
}
.rescue-overlay {
  background: #eddcea50;
}
.rescue-overlay .primary-button {
  background: #d48470;
}
.glitch-warning {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  background: #fff5cbe8;
  color: #937941;
  border-radius: 9px;
  padding: 9px 14px;
  font-size: 12px;
  box-shadow: 0 3px 12px #937a4014;
}
.glitch-controls {
  display: grid;
  grid-template-columns: 54px 54px 100px minmax(130px, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.glitch-controls button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 48px;
  border: 0;
  border-radius: 11px;
  background: #f0f3fa;
  color: #657797;
  touch-action: none;
  user-select: none;
}
.glitch-controls button:active:not(:disabled) {
  transform: translateY(2px);
  background: #dfe8f7;
}
.glitch-controls .undo-world {
  justify-self: end;
  min-width: 190px;
  background: #eee7fc;
  color: #8c6bc0;
}
.glitch-controls .undo-world:not(:disabled) {
  box-shadow: inset 0 0 0 1px #cab6ed;
}
.glitch-controls kbd {
  font-size: 10px;
  padding: 1px 5px;
  background: #fff8;
  border-radius: 4px;
}
.glitch-narrator {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  background: #f8f9fc;
  border-radius: 12px;
  padding: 10px 15px;
}
.glitch-narrator img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  flex-shrink: 0;
}
.glitch-narrator span {
  font-size: 10px;
  color: #8c9bbb;
}
.glitch-narrator p {
  margin: 2px 0 0;
  font-size: 13px;
  color: #526683;
}
.glitch-tip {
  font-size: 11px;
  color: #8b96a9;
  margin: 10px 0 0;
  text-align: center;
}
.walking {
  animation: walk-bob 0.22s linear infinite alternate;
}
.event-pop {
  animation: event-nudge 0.13s linear 3 alternate;
}
@keyframes walk-bob {
  to {
    transform: translateY(-3px);
  }
}
@keyframes event-nudge {
  to {
    transform: translateX(3px);
  }
}
.motion-still * {
  animation: none !important;
  transition: none !important;
}
@media (prefers-reduced-motion: reduce) {
  .walking,
  .event-pop {
    animation: none;
  }
}
@media (max-width: 650px) {
  .glitch-heading {
    margin-bottom: 8px;
  }
  .glitch-heading h2 {
    font-size: 21px;
  }
  .glitch-eyebrow {
    font-size: 10px;
  }
  .glitch-chapter {
    font-size: 23px;
  }
  .glitch-hud {
    margin-bottom: 8px;
    font-size: 11px;
  }
  .glitch-world {
    height: 320px;
  }
  .glitch-controls {
    grid-template-columns: 44px 44px 66px minmax(0, 1fr);
    gap: 6px;
    margin-top: 9px;
  }
  .glitch-controls button {
    font-size: 11px;
    gap: 3px;
    min-height: 46px;
  }
  .glitch-controls button svg {
    width: 18px;
  }
  .glitch-controls .undo-world {
    justify-self: stretch;
    min-width: 0;
  }
  .glitch-controls kbd {
    display: none;
  }
  .glitch-narrator {
    margin-top: 9px;
    padding: 6px 9px;
    gap: 7px;
  }
  .glitch-narrator img {
    width: 38px;
    height: 38px;
  }
  .glitch-narrator p {
    font-size: 12px;
  }
  .glitch-tip {
    font-size: 10px;
    margin-top: 8px;
  }
  .glitch-modal {
    padding: 16px 20px;
  }
  .glitch-modal h3 {
    font-size: 20px;
  }
  .glitch-modal p {
    font-size: 11px;
  }
  .glitch-modal small {
    font-size: 9px;
  }
  .glitch-warning {
    font-size: 10px;
    padding: 7px 10px;
  }
  .glitch-scene {
    border-radius: 12px;
  }
}
@media (max-width: 360px) {
  .glitch-world {
    height: 280px;
  }
  .glitch-heading h2 {
    font-size: 19px;
  }
}
</style>
