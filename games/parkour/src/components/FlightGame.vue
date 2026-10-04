<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { ArrowUp, ArrowLeft, Heart, Star } from '@lucide/vue';
import { PARKOUR_BACKGROUNDS } from '@moecore/assets';
import type { GameProps, GameResult } from '@moecore/game-sdk';
import sprite from '../../assets/actions/char-compute-jetpack.png';
import { createRunnerSound } from '../sound';
import type { MissionOptions } from '../rules/journey';
import {
  advanceFlight,
  beginFlight,
  flightGates,
  FLIGHT_DT,
  FLIGHT_FINISH,
  FLIGHT_BEST_KEY,
} from '../rules/flight';
const props = defineProps<GameProps & { mission?: MissionOptions }>();
const emit = defineEmits<{
  finish: [result: GameResult];
  back: [];
  progress: [milliseconds: number];
}>();
const state = shallowRef(beginFlight(props.mission?.assisted));
const phase = ref<'ready' | 'playing' | 'ended'>('ready');
const muted = ref(false);
const best = ref(0);
const held = ref(false);
const world = ref<HTMLElement>();
const control = ref<HTMLElement>();
const keys = new Set<string>();
let pointerHeld = false;
try {
  muted.value = localStorage.getItem('moecore:parkour:muted') === 'true';
  const value = Number(localStorage.getItem(FLIGHT_BEST_KEY));
  if (Number.isSafeInteger(value) && value > 0) best.value = value;
} catch {
  /* Browser storage is optional. */
}
const sound = createRunnerSound(() => (muted.value ? 0 : props.settings.masterVolume));
const left = (x: number) => `${20 + ((x - state.value.distance) / 36) * 80}%`;
const visible = (x: number) => x > state.value.distance - 12 && x < state.value.distance + 38;
const gates = computed(() => flightGates.filter((gate) => visible(gate.x)));
const pickups = computed(() => state.value.pickups.filter((pickup) => visible(pickup.x)));
const warning = computed(() =>
  state.value.missiles.find((missile) => missile.fireTick > state.value.tick),
);
const flyingMissiles = computed(() =>
  state.value.missiles.filter((missile) => missile.fireTick <= state.value.tick),
);
const region = computed(() =>
  state.value.distance < 240
    ? '预热航道'
    : state.value.distance < 520
      ? '限流深空'
      : '最终交付走廊',
);
let frame = 0;
let previous: number | undefined;
let accumulator = 0;
let disposed = false;
let finished = false;

function clearHeld() {
  keys.clear();
  pointerHeld = false;
  held.value = false;
}
function finish() {
  if (finished) return;
  finished = true;
  phase.value = 'ended';
  clearHeld();
  cancelAnimationFrame(frame);
  const current = state.value;
  const won = current.status === 'won';
  sound.play(won ? 'win' : 'lose');
  if (!props.mission && won && current.score > best.value) {
    best.value = current.score;
    try {
      localStorage.setItem(FLIGHT_BEST_KEY, String(current.score));
    } catch {
      /* Session record. */
    }
  }
  emit('finish', {
    gameId: 'parkour',
    sessionId: props.sessionId,
    outcome: won ? 'win' : 'lose',
    durationMs: Math.round(current.tick * FLIGHT_DT * 1000),
    summary: `算力喷射 · ${Math.floor(current.distance)} 米 · ${current.score} 分 · ${current.cleared}/15 道限流 · ${current.tokens} Token · ${current.bonusTokens} 个加急 Token${won && current.hits === 0 ? ' · 零碰撞交付' : ''}`,
    reselectLabel: '返回航线选择',
    story: {
      title: won ? '算力没白烧，答案已送达' : '算力航班迫降了',
      body: won
        ? '尾巴：下次再多捡几个加急 Token？贪心前先看好下一道缺口。'
        : '尾巴：短按微调高度，松手会下降。催更弹锁定后换高度，喷射过热时要先冷却。',
      imageUrl: sprite,
    },
    stats: {
      score: current.score,
      distance: current.distance,
      hits: current.hits,
      overheats: current.overheats,
      cleared: current.cleared,
      tokens: current.tokens,
      bonusTokens: current.bonusTokens,
    },
  });
}
function animate(time: number) {
  if (disposed || props.paused || phase.value !== 'playing') return;
  if (previous === undefined) previous = time;
  accumulator += Math.min(0.1, Math.max(0, (time - previous) / 1000));
  previous = time;
  let next = state.value;
  while (accumulator >= FLIGHT_DT) {
    accumulator -= FLIGHT_DT;
    next = advanceFlight(next, held.value);
    if (next.status !== 'running') break;
  }
  if (next.hits > state.value.hits) sound.play('hurt');
  else if (next.overheats > state.value.overheats) sound.play('hurt');
  else if (next.bonusTokens > state.value.bonusTokens) sound.play('rice');
  if (Math.floor(next.tick / 6) !== Math.floor(state.value.tick / 6))
    emit('progress', next.tick * FLIGHT_DT * 1000);
  state.value = next;
  if (next.status !== 'running') finish();
  else frame = requestAnimationFrame(animate);
}
function start() {
  if (phase.value !== 'ready' || props.paused) return;
  sound.unlock();
  phase.value = 'playing';
  void nextTick(() => {
    if (disposed) return;
    world.value?.focus({ preventScroll: true });
    control.value?.scrollIntoView({ block: 'end', behavior: 'auto' });
  });
  frame = requestAnimationFrame(animate);
}
function down(event: PointerEvent) {
  if (phase.value !== 'playing' || props.paused || event.button !== 0 || !event.isPrimary) return;
  sound.unlock();
  pointerHeld = true;
  held.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function up() {
  pointerHeld = false;
  held.value = keys.size > 0;
}
function keydown(event: KeyboardEvent) {
  if (event.repeat && !keys.has(event.code)) return;
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (event.code === 'Enter' && button && button !== control.value) return;
  if (
    !['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(event.code) ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  if (phase.value === 'ready' && event.code === 'Space') {
    event.preventDefault();
    start();
    return;
  }
  if (phase.value !== 'playing' || props.paused) return;
  event.preventDefault();
  sound.unlock();
  keys.add(event.code);
  held.value = true;
}
function keyup(event: KeyboardEvent) {
  keys.delete(event.code);
  held.value = pointerHeld || keys.size > 0;
}
function toggleAccessible(event: MouseEvent) {
  if (event.detail !== 0 || props.paused || phase.value !== 'playing') return;
  pointerHeld = !pointerHeld;
  held.value = pointerHeld || keys.size > 0;
}
function toggleSound() {
  muted.value = !muted.value;
  if (muted.value) sound.stop();
  else sound.unlock();
  try {
    localStorage.setItem('moecore:parkour:muted', String(muted.value));
  } catch {
    /* Session preference. */
  }
}
watch(
  () => props.paused,
  (paused) => {
    clearHeld();
    cancelAnimationFrame(frame);
    if (phase.value !== 'ended') sound.stop();
    previous = undefined;
    accumulator = 0;
    if (!paused && phase.value === 'playing') frame = requestAnimationFrame(animate);
  },
);
onMounted(() => {
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  window.addEventListener('blur', clearHeld);
  if (props.mission || (props.attempt > 1 && props.restartMode !== 'select')) start();
});
onUnmounted(() => {
  disposed = true;
  clearHeld();
  sound.dispose();
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', keydown);
  window.removeEventListener('keyup', keyup);
  window.removeEventListener('blur', clearHeld);
});
</script>

<template>
  <section class="flight-game">
    <header class="flight-hud">
      <div>
        <h2>算力喷射</h2>
        <small>{{ region }}</small>
      </div>
      <button type="button" aria-label="静音" :aria-pressed="muted" @click="toggleSound">
        {{ muted ? '音效：关' : '音效：开' }}
      </button>
      <div class="flight-health" :aria-label="`剩余 ${state.health} 次体力`">
        <Heart
          v-for="n in state.maxHealth"
          :key="n"
          :size="17"
          :fill="n <= state.health ? 'currentColor' : 'none'"
        />
      </div>
      <strong>{{ Math.floor(state.distance) }} / {{ FLIGHT_FINISH }} m</strong>
    </header>
    <div v-if="phase === 'ready' && !mission" class="flight-intro">
      <p><b>尾巴：算力能飞，但不能一直烧。</b></p>
      <p>
        按住空格、↑、喷射按钮或跑道上升，松手下降。穿缺口、躲锁定高度的催更弹；长按过热会暂时熄火。
      </p>
      <p>
        金色加急 Token 额外加分并散热。先完成 720 米，再挑战零碰撞与更多 Token。{{
          best ? `本机最高 ${best} 分。` : ''
        }}
      </p>
      <div>
        <button class="primary-button" type="button" @click="start">开始喷射</button
        ><button type="button" @click="emit('back')">返回跑酷航线</button>
      </div>
    </div>
    <progress
      class="flight-progress"
      :value="state.distance"
      :max="FLIGHT_FINISH"
      aria-label="飞行进度"
    />
    <div
      ref="world"
      class="flight-world"
      tabindex="0"
      role="application"
      aria-label="算力飞行航道"
      :data-phase="phase"
      :data-distance="state.distance"
      :data-y="state.y"
      :data-vy="state.vy"
      :data-tick="state.tick"
      :data-heat="state.heat"
      :data-thrust="held"
      @pointerdown.prevent="down"
      @pointerup="up"
      @pointercancel="up"
      @lostpointercapture="up"
    >
      <img class="flight-background" :src="PARKOUR_BACKGROUNDS[2]" alt="" />
      <div class="flight-shade"></div>
      <div
        v-for="gate in gates"
        :key="gate.id"
        class="flight-gate"
        :class="{ resolved: state.resolved.includes(gate.id) }"
        :style="{ left: left(gate.x) }"
        :data-x="gate.x"
        :data-center="gate.center"
        :data-gap="gate.gap"
      >
        <i class="wall top" :style="{ height: `${(10 - gate.center - gate.gap / 2) * 10}%` }"></i>
        <i class="wall bottom" :style="{ height: `${(gate.center - gate.gap / 2) * 10}%` }"></i>
        <span :style="{ bottom: `${(gate.center + gate.gap / 2) * 10}%` }">限流</span>
      </div>
      <div
        v-for="pickup in pickups"
        :key="pickup.id"
        class="flight-token"
        :class="{ bonus: pickup.bonus }"
        :style="{ left: left(pickup.x), bottom: `${pickup.y * 10}%` }"
      >
        <Star v-if="pickup.bonus" :size="15" fill="currentColor" /><span v-else>T</span>
      </div>
      <div
        v-if="warning"
        class="flight-warning"
        :style="{ bottom: `${warning.y * 10}%` }"
        :data-y="warning.y"
        :data-x="warning.x"
      >
        <span>催更弹锁定 · 换高度！</span>
      </div>
      <div
        v-for="missile in flyingMissiles"
        :key="missile.id"
        class="flight-missile"
        :style="{ left: left(missile.x), bottom: `${missile.y * 10}%` }"
        :data-y="missile.y"
        :data-x="missile.x"
      >
        <ArrowLeft :size="25" /><b>催更</b>
      </div>
      <div
        class="flight-player"
        :class="{
          thrust: state.thrusting,
          protected: state.invulnerableTicks > 0,
          quiet: settings.reduceMotion,
        }"
        :style="{ bottom: `calc(${state.y * 10}% - 33px)` }"
      >
        <i v-if="state.thrusting" class="flight-flame"></i
        ><img :src="sprite" alt="大肥鱼的算力喷射背包" />
      </div>
      <div v-if="state.distance > 690" class="flight-finish" :style="{ left: left(FLIGHT_FINISH) }">
        交<br />付
      </div>
    </div>
    <p class="flight-quip" role="status">
      {{
        state.tick < state.quipUntil ? state.quip : '按住上升 · 松手下降 · 别贪离缺口太远的 Token'
      }}
    </p>
    <div class="flight-stats">
      <span>{{ state.score.toLocaleString() }} 分</span
      ><span>Token {{ state.tokens }} · <Star :size="12" />{{ state.bonusTokens }}</span>
      <span :class="{ hot: state.heat > 75 }">温度 {{ Math.round(state.heat) }}%</span>
    </div>
    <progress
      class="flight-heat"
      :class="{ hot: state.heat > 75 }"
      :value="state.heat"
      max="100"
      aria-label="背包温度"
    />
    <button
      ref="control"
      class="flight-thrust"
      type="button"
      :aria-pressed="held"
      :disabled="phase !== 'playing' || paused"
      @pointerdown.prevent="down"
      @pointerup="up"
      @pointercancel="up"
      @lostpointercapture="up"
      @click="toggleAccessible"
    >
      <ArrowUp :size="24" /><b>{{
        state.overheatTicks
          ? `过热冷却 ${(state.overheatTicks / 60).toFixed(1)}s`
          : held
            ? '喷射中 · 松手散热'
            : '按住喷射'
      }}</b>
    </button>
    <small class="flight-foot"
      >缺口 {{ state.cleared }}/15 · 碰撞 {{ state.hits }} · 过热 {{ state.overheats
      }}{{ best ? ` · 最佳 ${best} 分` : '' }}</small
    >
  </section>
</template>

<style scoped>
.flight-game {
  color: var(--home-ink);
}
.flight-hud {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding-bottom: 12px;
}
.flight-hud > div:first-child {
  margin-right: auto;
}
.flight-hud h2 {
  margin: 0 0 3px;
  font-size: 19px;
}
.flight-hud small {
  color: var(--home-muted);
  font-size: 11px;
}
.flight-hud button,
.flight-intro button:last-child {
  padding: 8px 12px;
  border: 1px solid #afdae0;
  color: #225467;
  background: #effbff;
  border-radius: 8px;
  cursor: pointer;
}
.flight-health {
  display: flex;
  gap: 4px;
  color: #ca6081;
}
.flight-hud strong {
  font-size: 13px;
}
.flight-intro {
  background: #f0faff;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.6;
}
.flight-intro p {
  margin: 0 0 8px;
}
.flight-intro > div {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.flight-progress {
  display: block;
  width: 100%;
  height: 4px;
  border: 0;
  accent-color: #3bb8b1;
}
.flight-world {
  position: relative;
  height: 320px;
  overflow: hidden;
  border-radius: 0 0 12px 12px;
  background: #163d63;
  touch-action: none;
  user-select: none;
  isolation: isolate;
}
.flight-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.flight-shade {
  position: absolute;
  inset: 0;
  background: #10324b44;
  border-block: 4px solid #55bcc4;
}
.flight-gate {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  transform: translateX(-50%);
  z-index: 2;
}
.flight-gate .wall {
  position: absolute;
  width: 100%;
  border: 2px solid #fff0c5;
  background: repeating-linear-gradient(135deg, #e47188 0 7px, #9f4767 7px 14px);
  box-shadow: 0 0 7px #f8aab5;
}
.flight-gate .top {
  top: 0;
  border-radius: 0 0 5px 5px;
}
.flight-gate .bottom {
  bottom: 0;
  border-radius: 5px 5px 0 0;
}
.flight-gate > span {
  position: absolute;
  left: -9px;
  color: white;
  background: #9b4165;
  font-size: 9px;
  padding: 2px;
  margin-bottom: 5px;
  white-space: nowrap;
}
.flight-gate.resolved {
  opacity: 0.55;
}
.flight-token {
  position: absolute;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #efffff;
  color: #245168;
  background: #b2f1fa;
  transform: translate(-50%, 50%);
  font-size: 10px;
  font-weight: 800;
}
.flight-token.bonus {
  background: #ffe8a6;
  border-color: #fffae0;
  color: #a97618;
  width: 23px;
  height: 23px;
}
.flight-player {
  position: absolute;
  left: calc(20% - 33px);
  width: 66px;
  height: 66px;
  z-index: 4;
  pointer-events: none;
}
.flight-player img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  position: relative;
}
.flight-player.protected {
  filter: drop-shadow(0 0 5px white);
  opacity: 0.65;
}
.flight-flame {
  position: absolute;
  left: 24px;
  top: 41px;
  width: 13px;
  height: 35px;
  background: linear-gradient(#fff8b8, #54e0ff 40%, #54e0ff00);
  border-radius: 30% 30% 70% 70%;
  transform: rotate(12deg);
}
.flight-warning {
  position: absolute;
  left: 22%;
  right: 0;
  border-top: 2px dashed #ffc2b3;
  z-index: 5;
}
.flight-warning span {
  position: absolute;
  right: 4px;
  bottom: 3px;
  background: #ffe3d7;
  color: #822e48;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 10px;
}
.flight-missile {
  position: absolute;
  transform: translate(-50%, 50%);
  display: flex;
  align-items: center;
  gap: 2px;
  color: #823447;
  background: #ffe0cf;
  border: 2px solid white;
  border-radius: 50% 8px 8px 50%;
  padding-right: 5px;
  z-index: 5;
}
.flight-missile b {
  font-size: 10px;
  white-space: nowrap;
}
.flight-finish {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 25px;
  background: #e4ffffbb;
  border: 2px solid white;
  display: grid;
  align-content: center;
  justify-content: center;
  color: #17516a;
  font-weight: 800;
}
.flight-quip {
  min-height: 30px;
  margin: 4px 0;
  display: flex;
  align-items: center;
  color: #497184;
  font-size: 11px;
}
.flight-stats {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.flight-stats > span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.flight-heat {
  display: block;
  width: 100%;
  height: 7px;
  margin: 8px 0;
  accent-color: #4da5bc;
}
.flight-heat.hot {
  accent-color: #d86a58;
}
.hot {
  color: #c05b4b;
}
.flight-thrust {
  width: 100%;
  min-height: 60px;
  border: 1px solid #a2d5dc;
  background: #e5f8ff;
  color: #255e78;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  font-size: 15px;
  touch-action: none;
  cursor: pointer;
  scroll-margin-bottom: 14px;
}
.flight-thrust[aria-pressed='true'] {
  background: #a6e5f4;
  border-color: #4695ae;
}
.flight-foot {
  display: block;
  margin-top: 8px;
  color: var(--home-muted);
  font-size: 10px;
}
@media (max-width: 500px) {
  .flight-hud {
    gap: 8px;
  }
  .flight-hud > div:first-child {
    width: calc(100% - 90px);
  }
  .flight-world {
    height: 290px;
  }
  .flight-stats {
    font-size: 10px;
  }
}
</style>
