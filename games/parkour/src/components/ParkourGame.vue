<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Flag,
  Heart,
  Magnet,
  Play,
  Shield,
  Sparkles,
  Star,
  Zap,
} from '@lucide/vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { runners, pickupArt, poseId, scenicIds, type Pose } from '../config/art';
import { prologue, openingLines, chapterStories, endingFor } from '../config/story';
import {
  advanceAdventure,
  beginAdventure,
  FINISH_DISTANCE,
  FIXED_DT,
  multiplierFor,
  seedForSession,
  type PickupKind,
} from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const chosen = ref(0);
const runner = computed(() => runners[chosen.value]!);
const phase = ref<'ready' | 'countdown' | 'running' | 'chapter' | 'ended'>('ready');
const storyIndex = ref(0);
const storyScene = computed(() => chapterStories[storyIndex.value]!);
const storyPortrait = computed(() => {
  const character = runners.find((character) => character.id === storyScene.value.speaker)!;
  return art.value[poseId(character, 'idle')];
});
const continueButton = ref<HTMLButtonElement>();
const countdown = ref(3);
const state = shallowRef(beginAdventure(seedForSession(props.sessionId)));
const art = shallowRef<Readonly<Record<string, string>>>({});
const artError = ref(false);
const stage = ref<HTMLElement>();
const stageWidth = ref(960);
const floorTiles = computed(() => Math.ceil(stageWidth.value / 144) + 2);
const score = computed(() => state.value.run.score + state.value.bonus);
const chapter = computed(() =>
  state.value.run.distance < 400
    ? '01 珊瑚浅湾'
    : state.value.run.distance < 800
      ? '02 遗迹回廊'
      : '03 星潮终点',
);
const visibleObstacles = computed(() =>
  state.value.run.obstacles.filter((obstacle) => obstacle.x - state.value.run.distance < 20),
);
const visiblePickups = computed(() =>
  state.value.pickups.filter((pickup) => pickup.x - state.value.run.distance < 20),
);
const pose = computed<Pose>(() => {
  if (phase.value === 'ready' || phase.value === 'countdown' || phase.value === 'chapter')
    return 'idle';
  if (state.value.dashTicks > 0) return 'dash';
  if (state.value.invulnerableTicks > 50) return 'hurt';
  if (!state.value.run.player.grounded) return 'jump';
  return state.value.run.player.crouching ? 'slide' : 'run';
});
const sprite = computed(() => art.value[poseId(runner.value, pose.value)]);
const missions = computed(() => [
  { label: '越过障碍', value: state.value.dodged, target: 10 },
  { label: '收集星币', value: state.value.coins, target: 30 },
  { label: '最高连击', value: state.value.bestCombo, target: 25 },
]);
const active = computed(() => phase.value === 'running' && !props.paused);
const icons = { coin: Star, star: Sparkles, magnet: Magnet, shield: Shield, heart: Heart };
const keys = { jump: false, crouch: false, dash: false };
let jumpQueued = false;
let dashQueued = false;
let slideTicks = 0;
let frameId = 0;
let previousTime: number | undefined;
let accumulator = 0;
let countdownTicks = 180;
let disposed = false;
let loadingVersion = 0;
let resizeObserver: ResizeObserver | undefined;
let gesture: { id: number; x: number; y: number } | undefined;

const at = (x: number) => `${16 + (x - state.value.run.distance) * 4.5}%`;
function obstacleArt(id: number, kind: string) {
  return art.value[
    kind === 'air'
      ? id % 2
        ? 'obstacles_enemies_008'
        : 'obstacles_enemies_016'
      : ['obstacles_enemies_006', 'obstacles_enemies_001', 'obstacles_enemies_011'][id % 3]!
  ];
}
const pickupLabel = (kind: PickupKind) =>
  ({ coin: '星币', star: '高空星星', magnet: '磁铁', shield: '护盾', heart: '体力' })[kind];

async function loadArt() {
  if (!import.meta.env.DEV) return;
  const version = ++loadingVersion;
  artError.value = false;
  try {
    const { loadParkourAssets } = await import('@moecore/assets/parkour');
    const ids = [
      ...scenicIds,
      ...runners.flatMap((character) =>
        Object.keys(character.poses).map((key) => poseId(character, key as Pose)),
      ),
    ];
    const result = await loadParkourAssets(ids);
    if (!disposed && version === loadingVersion) art.value = result;
  } catch {
    if (!disposed && version === loadingVersion) artError.value = true;
  }
}

function clearInput() {
  keys.jump = keys.crouch = keys.dash = false;
  jumpQueued = dashQueued = false;
  slideTicks = 0;
  gesture = undefined;
}

function startRun() {
  if (props.paused || phase.value !== 'ready') return;
  phase.value = 'countdown';
  stage.value?.focus({ preventScroll: true });
  previousTime = undefined;
  accumulator = 0;
  frameId = requestAnimationFrame(animate);
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
      countdown.value = Math.max(1, Math.ceil(countdownTicks / 60));
      if (countdownTicks <= 0) phase.value = 'running';
      continue;
    }
    const previousChapter = next.chapter;
    next = advanceAdventure(next, {
      jump: keys.jump || jumpQueued,
      crouch: keys.crouch || slideTicks > 0,
      dash: keys.dash || dashQueued,
    });
    jumpQueued = dashQueued = false;
    slideTicks = Math.max(0, slideTicks - 1);
    if (next.run.status === 'ended') {
      state.value = next;
      phase.value = 'ended';
      emit('finish', {
        gameId: 'parkour',
        sessionId: props.sessionId,
        outcome: next.run.result.reason === 'distance-limit' ? 'win' : 'lose',
        durationMs: Math.round(next.run.tick * FIXED_DT * 1000),
        summary: `${Math.floor(next.run.distance)} 米 · ${next.run.score + next.bonus} 分 · ${next.coins} 星币 · 最高 ${next.bestCombo} 连击`,
        story: endingFor(next.run.result.reason === 'distance-limit', next.coins),
        stats: {
          distance: next.run.distance,
          score: next.run.score + next.bonus,
          coins: next.coins,
          bestCombo: next.bestCombo,
          dashes: next.dashes,
          missions: next.missionAwards.length,
        },
      });
      return;
    }
    if (next.chapter > previousChapter) {
      state.value = next;
      storyIndex.value = next.chapter - 1;
      phase.value = 'chapter';
      clearInput();
      previousTime = undefined;
      accumulator = 0;
      void nextTick(() => continueButton.value?.focus({ preventScroll: true }));
      return;
    }
  }
  state.value = next;
  frameId = requestAnimationFrame(animate);
}

function continueStory() {
  if (props.paused || phase.value !== 'chapter') return;
  phase.value = 'running';
  clearInput();
  previousTime = undefined;
  accumulator = 0;
  stage.value?.focus({ preventScroll: true });
  frameId = requestAnimationFrame(animate);
}

function jump() {
  if (active.value) jumpQueued = true;
}
function slide() {
  if (active.value) slideTicks = 48;
}
function dash() {
  if (active.value) dashQueued = true;
}

function keyDown(event: KeyboardEvent) {
  if (!active.value || event.ctrlKey || event.metaKey || event.altKey) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable]')
  )
    return;
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) jump();
    keys.jump = true;
  } else if (['ArrowDown', 'KeyS'].includes(event.code)) {
    event.preventDefault();
    keys.crouch = true;
  } else if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(event.code)) {
    event.preventDefault();
    if (!event.repeat) dash();
    keys.dash = true;
  }
}
function keyUp(event: KeyboardEvent) {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) keys.jump = false;
  if (['ArrowDown', 'KeyS'].includes(event.code)) keys.crouch = false;
  if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(event.code)) keys.dash = false;
}
function beginGesture(event: PointerEvent) {
  if (!active.value || !event.isPrimary || gesture || event.button !== 0) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function endGesture(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  gesture = undefined;
  if (dy > 24 && Math.abs(dy) > Math.abs(dx)) slide();
  else if (dx > 36 && Math.abs(dx) > Math.abs(dy)) dash();
  else jump();
}
watch(
  () => props.paused,
  (paused) => {
    clearInput();
    cancelAnimationFrame(frameId);
    previousTime = undefined;
    accumulator = 0;
    if (!paused && ['countdown', 'running'].includes(phase.value))
      frameId = requestAnimationFrame(animate);
  },
);
onMounted(() => {
  void loadArt();
  if (stage.value) {
    stageWidth.value = stage.value.clientWidth;
    resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) stageWidth.value = entry.contentRect.width;
    });
    resizeObserver.observe(stage.value);
  }
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
});
onUnmounted(() => {
  disposed = true;
  loadingVersion += 1;
  cancelAnimationFrame(frameId);
  clearInput();
  resizeObserver?.disconnect();
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
});
</script>

<template>
  <section
    class="runner-game"
    :class="{ 'reduce-motion': settings.reduceMotion }"
    :style="{ '--runner-color': runner.color }"
  >
    <div class="runner-hud">
      <div class="runner-stage-label">
        <span>STAR TIDE RUN</span>
        <h2>{{ chapter }}</h2>
      </div>
      <div class="runner-distance">
        <strong data-testid="runner-distance">{{ Math.floor(state.run.distance) }}</strong
        ><span>/ 1,200 m</span>
      </div>
      <div class="runner-score">
        <span>得分</span><strong data-testid="runner-score">{{ score.toLocaleString() }}</strong>
      </div>
      <div
        class="runner-health"
        :aria-label="`剩余 ${state.health} 次体力`"
        data-testid="runner-health"
      >
        <Heart
          v-for="life in 3"
          :key="life"
          :size="21"
          :class="{ empty: life > state.health }"
          :fill="life <= state.health ? 'currentColor' : 'none'"
        />
      </div>
    </div>
    <progress
      class="runner-progress"
      :value="state.run.distance"
      :max="FINISH_DISTANCE"
      aria-label="赛道进度"
    />
    <div
      ref="stage"
      class="runner-world"
      :class="{ rushing: state.dashTicks > 0, 'is-running': phase === 'running' }"
      :data-phase="phase"
      :data-tick="state.run.tick"
      :data-distance="state.run.distance"
      :data-speed="state.run.speed"
      role="application"
      aria-label="跑酷赛道"
      tabindex="0"
      @pointerdown="beginGesture"
      @pointerup="endGesture"
      @pointercancel="gesture = undefined"
      @lostpointercapture="gesture = undefined"
    >
      <div class="runner-horizon" aria-hidden="true"></div>
      <div class="runner-ruins" aria-hidden="true">
        <template
          v-for="(id, index) in [
            'terrain_037',
            'terrain_030',
            'terrain_039',
            'terrain_029',
            'terrain_037',
            'terrain_031',
          ]"
          :key="index"
        >
          <img
            v-if="art[id]"
            :src="art[id]"
            alt=""
            :style="{
              left: `${((((index * 24 + 30 - (settings.reduceMotion ? 0 : state.run.distance * 0.7)) % 150) + 150) % 150) - 15}%`,
            }"
          />
          <span
            v-else
            class="ruin-shape"
            :style="{
              left: `${index * 24 - (settings.reduceMotion ? 0 : state.run.distance % 24)}%`,
            }"
          ></span>
        </template>
      </div>
      <div class="runner-floor" aria-hidden="true">
        <template v-if="art.terrain_001">
          <img
            v-for="index in floorTiles"
            :key="index"
            :src="art[index % 3 ? 'terrain_001' : 'terrain_004']"
            alt=""
            :style="{
              left: `${(index - 2) * 144 - ((state.run.distance * stageWidth * 0.045) % 144)}px`,
            }"
          />
        </template>
      </div>
      <div
        v-for="obstacle in visibleObstacles"
        :key="obstacle.id"
        class="runner-obstacle"
        :class="obstacle.kind"
        :style="{ left: at(obstacle.x) }"
        :data-kind="obstacle.kind"
        :data-x="obstacle.x"
        aria-hidden="true"
      >
        <div v-if="obstacle.kind === 'air'" class="air-beam"><ArrowDown :size="18" /></div>
        <img
          v-if="obstacleArt(obstacle.id, obstacle.kind)"
          :src="obstacleArt(obstacle.id, obstacle.kind)"
          alt=""
        />
        <div v-else class="obstacle-shape">
          <ArrowUp v-if="obstacle.kind === 'ground'" :size="22" />
        </div>
      </div>
      <div
        v-for="pickup in visiblePickups"
        :key="pickup.id"
        class="runner-pickup"
        :class="pickup.kind"
        :style="{ left: at(pickup.x), bottom: `${78 + pickup.y * 48}px` }"
        :title="pickupLabel(pickup.kind)"
        aria-hidden="true"
      >
        <img v-if="art[pickupArt[pickup.kind]]" :src="art[pickupArt[pickup.kind]]" alt="" />
        <component :is="icons[pickup.kind]" v-else :size="24" />
      </div>
      <div
        class="runner-player"
        :class="{
          sliding: state.run.player.crouching,
          protected: state.invulnerableTicks > 0,
          shielded: state.shield,
          airborne: !state.run.player.grounded,
        }"
        :data-pose="pose"
        :data-y="state.run.player.y.toFixed(3)"
        :style="{ transform: `translateY(${-state.run.player.y * 48}px)` }"
        data-testid="runner-player"
      >
        <img v-if="sprite" :src="sprite" :alt="runner.name" draggable="false" />
        <div v-else class="runner-placeholder" :aria-label="runner.name">
          <span></span><i></i><b></b>
        </div>
        <img
          v-if="state.dashTicks > 0 && art.effects_009"
          class="runner-dash-trail"
          :src="art.effects_009"
          alt=""
        />
        <Shield v-if="state.shield" class="shield-marker" :size="26" />
      </div>
      <div v-if="state.combo >= 5 && phase === 'running'" class="runner-combo">
        <strong>{{ state.combo }}</strong> 连击 <span>×{{ multiplierFor(state.combo) }}</span>
      </div>
      <div v-if="state.magnetTicks > 0" class="runner-magnet">
        <Magnet :size="16" />{{ Math.ceil(state.magnetTicks / 60) }}s
      </div>
      <div v-if="state.noticeUntil > state.run.tick" class="runner-notice" role="status">
        {{ state.notice }}
      </div>
      <div
        v-if="phase === 'countdown'"
        class="runner-countdown"
        role="status"
        aria-label="出发倒计时"
      >
        {{ countdown }}
      </div>
      <div v-if="phase === 'ready'" class="runner-ready">
        <span class="runner-course"><Flag :size="16" />1,200 m · 星潮航线</span>
        <h3>{{ prologue.title }}</h3>
        <p class="prologue-text">{{ prologue.body }}</p>
        <p class="opening-line">{{ runner.name }}：「{{ openingLines[runner.id] }}」</p>
        <button
          class="primary-button runner-start"
          type="button"
          :disabled="paused"
          @pointerdown.stop
          @click.stop="startRun"
        >
          <Play :size="18" fill="currentColor" />开始冲刺
        </button>
      </div>
      <div
        v-if="phase === 'chapter'"
        class="runner-story"
        role="region"
        aria-label="章节故事"
        @pointerdown.stop
      >
        <img
          v-if="storyPortrait"
          :src="storyPortrait"
          :alt="storyScene.name"
          width="74"
          height="84"
        />
        <h3>{{ storyScene.title }}</h3>
        <p>{{ storyScene.body }}</p>
        <blockquote>{{ storyScene.name }}：「{{ storyScene.line }}」</blockquote>
        <span class="story-reward"><Sparkles :size="15" />{{ storyScene.reward }}</span>
        <button ref="continueButton" type="button" class="primary-button" @click="continueStory">
          继续旅程
        </button>
      </div>
    </div>
    <div v-if="artError" class="runner-art-error" role="status">
      角色素材加载失败。<button type="button" class="text-button" @click="loadArt">重试素材</button>
    </div>
    <div v-if="phase === 'ready'" class="runner-roster" role="group" aria-label="选择角色">
      <button
        v-for="(character, index) in runners"
        :key="character.id"
        type="button"
        class="runner-choice"
        :class="{ selected: index === chosen }"
        :aria-pressed="index === chosen"
        :aria-label="`选择 ${character.name}`"
        @click="chosen = index"
      >
        <img v-if="art[poseId(character, 'idle')]" :src="art[poseId(character, 'idle')]" alt="" />
        <span v-else class="roster-initial" :style="{ color: character.color }">{{
          character.name.slice(0, 2)
        }}</span>
        <span>{{ character.name }}</span
        ><Check v-if="index === chosen" :size="16" class="roster-check" />
      </button>
    </div>
    <div v-else class="runner-controls">
      <button
        type="button"
        class="runner-action"
        :disabled="!active"
        title="跳跃"
        aria-label="跳跃"
        @click="jump"
      >
        <ArrowUp :size="23" /><span>跳跃</span>
      </button>
      <button
        type="button"
        class="runner-action"
        :disabled="!active"
        title="滑铲"
        aria-label="滑铲"
        @click="slide"
      >
        <ArrowDown :size="23" /><span>滑铲</span>
      </button>
      <button
        type="button"
        class="runner-action dash-action"
        :class="{ charged: state.energy >= 100 }"
        :disabled="!active || state.energy < 100"
        title="冲刺"
        aria-label="冲刺"
        @click="dash"
      >
        <Zap :size="23" /><span>冲刺</span
        ><strong data-testid="runner-energy">{{ state.energy }}%</strong
        ><progress :value="state.energy" max="100" aria-label="冲刺能量" />
      </button>
    </div>
    <div class="runner-missions">
      <div
        v-for="(mission, index) in missions"
        :key="mission.label"
        :class="{ complete: state.missionAwards.includes(index) }"
      >
        <Check v-if="state.missionAwards.includes(index)" :size="16" /><Star v-else :size="16" />
        <span>{{ mission.label }}</span
        ><strong
          >{{ Math.min(mission.value, mission.target)
          }}<small> / {{ mission.target }}</small></strong
        >
      </div>
    </div>
  </section>
</template>

<style scoped>
.runner-game {
  --sea-ink: #244e62;
  color: var(--sea-ink);
}
.runner-hud {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 0 0 16px;
}
.runner-stage-label {
  margin-right: auto;
}
.runner-stage-label > span {
  font-size: 10px;
  color: #678d9b;
  font-weight: 700;
}
.runner-stage-label h2 {
  font-size: 17px;
  margin: 2px 0 0;
}
.runner-distance {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 150px;
}
.runner-distance > strong {
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  min-width: 4ch;
  text-align: right;
}
.runner-distance > span,
.runner-score > span {
  font-size: 11px;
  color: #6d8490;
}
.runner-score {
  display: grid;
  min-width: 72px;
  text-align: right;
}
.runner-score > strong {
  font-size: 19px;
  font-variant-numeric: tabular-nums;
}
.runner-health {
  display: flex;
  gap: 5px;
  color: #cc6082;
}
.runner-health .empty {
  color: #c4d1d5;
}
.runner-progress {
  width: 100%;
  height: 5px;
  border: 0;
  accent-color: #308d8c;
  display: block;
}
.runner-progress::-webkit-progress-bar {
  background: #dce9e9;
}
.runner-progress::-webkit-progress-value {
  background: #308d8c;
}
.runner-world {
  position: relative;
  width: 100%;
  height: 380px;
  overflow: hidden;
  background: #e3f4f2;
  isolation: isolate;
  touch-action: none;
  user-select: none;
}
.runner-world:focus-visible {
  outline: 2px solid #5b99a4;
  outline-offset: 2px;
}
.runner-world[data-phase='ready'] .runner-ruins,
.runner-world[data-phase='ready'] .runner-obstacle,
.runner-world[data-phase='ready'] .runner-pickup {
  visibility: hidden;
}
.runner-horizon {
  position: absolute;
  inset: 48% 0 78px;
  background: #c8e5e6;
  border-top: 3px solid #d6eeed;
}
.runner-ruins {
  position: absolute;
  inset: 0;
  opacity: 0.74;
  pointer-events: none;
}
.runner-ruins img {
  position: absolute;
  bottom: 100px;
  width: 120px;
  height: 130px;
  object-fit: contain;
}
.ruin-shape {
  position: absolute;
  bottom: 100px;
  width: 68px;
  height: 100px;
  border: 14px solid #9fcace;
  border-bottom: 0;
  border-radius: 32px 32px 0 0;
}
.runner-floor {
  position: absolute;
  inset: auto 0 0;
  height: 78px;
  background: #a4cfd4;
  border-top: 5px solid #f3e9ba;
  overflow: hidden;
}
.runner-floor img {
  position: absolute;
  top: -9px;
  width: 146px;
  height: 90px;
  object-fit: contain;
}
.runner-obstacle {
  position: absolute;
  bottom: 78px;
  width: 3.6%;
  min-width: 24px;
  z-index: 3;
}
.runner-obstacle.ground {
  height: 32px;
  border-bottom: 3px solid #956548;
}
.runner-obstacle img {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 68px;
  height: 68px;
  object-fit: contain;
  max-width: none;
}
.runner-obstacle.air {
  bottom: 126px;
  height: 172px;
  border-left: 2px dashed #b0babb;
}
.runner-obstacle.air img {
  width: 70px;
  height: 58px;
  bottom: -2px;
}
.air-beam {
  position: absolute;
  bottom: 62px;
  left: 50%;
  transform: translateX(-50%);
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  background: #f4d581;
  color: #806322;
  border-radius: 4px;
}
.obstacle-shape {
  width: 100%;
  height: 100%;
  background: #d59072;
  display: grid;
  place-items: center;
  color: #fff;
  border: 2px solid #a9664e;
  border-radius: 4px;
}
.air .obstacle-shape {
  position: absolute;
  bottom: 0;
  height: 150px;
  background: repeating-linear-gradient(135deg, #e8c46e 0 8px, #51636c 8px 16px);
  border-color: #51636c;
}
.runner-pickup {
  position: absolute;
  transform: translate(-50%, 50%);
  width: 31px;
  height: 31px;
  display: grid;
  place-items: center;
  color: #dcac23;
  z-index: 2;
  pointer-events: none;
}
.runner-pickup img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.runner-pickup.star {
  width: 40px;
  height: 40px;
  color: #f18ba0;
}
.runner-pickup.shield,
.runner-pickup.magnet,
.runner-pickup.heart {
  width: 38px;
  height: 38px;
  color: #cc6082;
}
.runner-player {
  position: absolute;
  left: calc(16% - 32px);
  bottom: 78px;
  width: 86px;
  height: 98px;
  z-index: 5;
  transform-origin: 40% bottom;
  pointer-events: none;
}
.runner-player > img:not(.runner-dash-trail) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  display: block;
}
.runner-player.sliding {
  height: 46px;
  width: 94px;
}
.runner-player.protected {
  opacity: 0.6;
}
.runner-player.shielded::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid #77c8e2;
  border-radius: 45%;
}
.shield-marker {
  position: absolute;
  top: -10px;
  left: -10px;
  color: #248dc1;
  fill: #d2f2fd;
}
.is-running
  .runner-player:not(.airborne):not(.sliding):not(.protected)
  > img:not(.runner-dash-trail) {
  animation: running-step 0.25s ease-in-out infinite alternate;
}
.runner-dash-trail {
  position: absolute;
  width: 110px;
  height: 68px;
  object-fit: contain;
  right: 55px;
  bottom: 0;
  z-index: -1;
}
.runner-placeholder {
  width: 45px;
  height: 82px;
  position: absolute;
  bottom: 0;
  left: 18px;
}
.runner-placeholder span {
  position: absolute;
  top: 0;
  left: 7px;
  width: 32px;
  height: 31px;
  border-radius: 12px;
  background: #f0dccc;
  border-top: 7px solid var(--runner-color);
}
.runner-placeholder i {
  position: absolute;
  top: 29px;
  left: 3px;
  width: 40px;
  height: 34px;
  background: var(--runner-color);
  border: 4px solid #f6f9ff;
  border-radius: 9px 9px 5px 5px;
}
.runner-placeholder b {
  position: absolute;
  bottom: 0;
  left: 10px;
  width: 26px;
  height: 21px;
  border-left: 8px solid #4d616c;
  border-right: 8px solid #4d616c;
}
.sliding .runner-placeholder {
  transform: rotate(-65deg) scale(0.7);
  transform-origin: center bottom;
  left: 30px;
  bottom: 12px;
}
.runner-ready {
  position: absolute;
  top: 45px;
  left: 28%;
  right: 10%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  z-index: 6;
}
.runner-course {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #48848c;
}
.runner-ready h3 {
  font-size: 28px;
  margin: 8px 0 10px;
  line-height: 1.3;
  color: #244e62;
}
.prologue-text {
  max-width: 420px;
  font-size: 13px;
  line-height: 1.7;
  margin: 0 0 8px;
}
.opening-line {
  max-width: 440px;
  margin: 0 0 16px;
  font-size: 12px;
  color: #53677a;
  line-height: 1.6;
}
.runner-story {
  position: absolute;
  inset: 0;
  z-index: 9;
  background: #f0f8f5f5;
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.runner-story > img {
  width: 74px;
  height: 84px;
  object-fit: contain;
}
.runner-story h3 {
  font-size: 20px;
  margin: 8px 0;
}
.runner-story p {
  max-width: 540px;
  font-size: 13px;
  line-height: 1.7;
  margin: 0;
}
.runner-story blockquote {
  max-width: 540px;
  font-size: 13px;
  color: #84616f;
  margin: 8px 0;
  line-height: 1.7;
}
.story-reward {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #458372;
  margin-bottom: 12px;
}
.runner-start {
  background: #bd5076;
  border-color: #bd5076;
}
.runner-start:hover {
  background: #a24062;
}
.runner-countdown {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  background: #e3f4f288;
  font:
    800 76px/1 system-ui,
    sans-serif;
  color: #306c7f;
}
.runner-combo {
  position: absolute;
  top: 20px;
  left: 20px;
  font-size: 13px;
  color: #87516d;
}
.runner-combo strong {
  font-size: 32px;
  margin-right: 5px;
  font-variant-numeric: tabular-nums;
}
.runner-combo > span {
  margin-left: 8px;
  font-weight: 700;
  color: #b43d64;
}
.runner-magnet {
  position: absolute;
  top: 28px;
  right: 20px;
  display: flex;
  gap: 5px;
  align-items: center;
  color: #697bbb;
  font-size: 14px;
}
.runner-notice {
  position: absolute;
  top: 75px;
  left: 15%;
  right: 15%;
  text-align: center;
  color: #a14964;
  font-size: 16px;
  font-weight: 700;
}
.rushing {
  box-shadow: inset 0 0 0 3px #efc363;
}
.runner-roster {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 18px 0;
}
.runner-choice {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  min-width: 0;
  height: 88px;
  background: #fff;
  border: 1px solid #d6e1e2;
  border-radius: 6px;
  padding: 8px 14px;
  color: #466271;
  cursor: pointer;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
}
.runner-choice.selected {
  border-color: #499da3;
  background: #edf8f6;
  box-shadow: inset 0 0 0 1px #499da3;
}
.runner-choice img {
  width: 58px;
  height: 68px;
  object-fit: contain;
  flex-shrink: 0;
}
.roster-initial {
  display: grid;
  place-items: center;
  width: 58px;
  height: 68px;
  font-size: 24px;
}
.roster-check {
  margin-left: auto;
  color: #388b8d;
  flex-shrink: 0;
}
.runner-controls {
  display: grid;
  grid-template-columns: 1fr 1fr 1.5fr;
  gap: 16px;
  padding: 18px 0;
}
.runner-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  position: relative;
  overflow: hidden;
  min-height: 60px;
  border: 1px solid #c6dadd;
  background: #fff;
  border-radius: 6px;
  color: #3f7180;
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
}
.runner-action > span {
  font-size: 15px;
  font-weight: 600;
}
.runner-action:hover:not(:disabled) {
  background: #eaf6f5;
}
.runner-action:active:not(:disabled) {
  transform: translateY(1px);
}
.runner-action strong {
  font-size: 12px;
  min-width: 4ch;
  font-variant-numeric: tabular-nums;
}
.dash-action progress {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  border: 0;
  accent-color: #d8a337;
}
.dash-action progress::-webkit-progress-bar {
  background: #edf0e7;
}
.dash-action progress::-webkit-progress-value {
  background: #d8a337;
}
.dash-action.charged {
  color: #9d6721;
  background: #fff3cb;
  border-color: #d8b765;
}
.runner-missions {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid #d9e5e3;
  padding-top: 14px;
}
.runner-missions > div {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #80959c;
  font-size: 12px;
}
.runner-missions strong {
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: #466775;
  margin-left: 6px;
}
.runner-missions small {
  color: #94a7ad;
  font-size: 11px;
  font-weight: 400;
}
.runner-missions .complete,
.runner-missions .complete strong {
  color: #338674;
}
.runner-art-error {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #96556a;
}
.reduce-motion .runner-player img {
  animation: none !important;
}
@keyframes running-step {
  from {
    transform: translateY(0) rotate(-2deg);
  }
  to {
    transform: translateY(-3px) rotate(2deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .runner-player img {
    animation: none !important;
  }
}
@media (max-width: 700px) {
  .runner-hud {
    gap: 16px;
    flex-wrap: wrap;
  }
  .runner-stage-label {
    flex-basis: calc(100% - 100px);
    order: 0;
  }
  .runner-health {
    order: 1;
    margin-left: auto;
  }
  .runner-distance {
    order: 2;
    min-width: 0;
    margin-right: auto;
  }
  .runner-distance > strong {
    text-align: left;
    min-width: 0;
    font-size: 24px;
  }
  .runner-score {
    order: 3;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .runner-world {
    height: 340px;
  }
  .runner-ruins img {
    width: 78px;
    height: 94px;
    bottom: 115px;
  }
  .runner-ready {
    left: 28%;
    right: 4%;
    top: 28px;
  }
  .runner-ready h3 {
    font-size: 22px;
  }
  .runner-ready {
    top: 18px;
  }
  .prologue-text {
    font-size: 11px;
    line-height: 1.6;
  }
  .opening-line {
    font-size: 10px;
    line-height: 1.5;
    margin-bottom: 10px;
  }
  .runner-story {
    padding: 12px 16px;
  }
  .runner-story > img {
    height: 50px;
    width: 48px;
  }
  .runner-story h3 {
    font-size: 17px;
    margin: 5px 0;
  }
  .runner-story p,
  .runner-story blockquote {
    font-size: 11px;
    line-height: 1.6;
  }
  .runner-player {
    width: 72px;
    height: 87px;
    left: calc(16% - 23px);
  }
  .runner-player.sliding {
    width: 86px;
    height: 44px;
  }
  .runner-obstacle img {
    width: 52px;
    height: 52px;
  }
  .runner-obstacle.air img {
    width: 52px;
    height: 49px;
  }
  .runner-pickup {
    width: 26px;
    height: 26px;
  }
  .runner-roster {
    gap: 6px;
    padding: 12px 0;
  }
  .runner-choice {
    flex-direction: column;
    height: 94px;
    gap: 2px;
    justify-content: center;
    padding: 5px;
    font-size: 11px;
  }
  .runner-choice img,
  .roster-initial {
    width: 46px;
    height: 57px;
  }
  .roster-check {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 12px;
  }
  .runner-controls {
    gap: 8px;
    padding: 12px 0;
  }
  .runner-action {
    gap: 4px;
    min-height: 54px;
  }
  .runner-action > span {
    font-size: 13px;
  }
  .runner-missions {
    gap: 8px;
  }
  .runner-missions > div {
    flex-wrap: wrap;
    gap: 4px;
    font-size: 10px;
  }
  .runner-missions > div > svg {
    display: none;
  }
  .runner-missions strong {
    font-size: 12px;
    margin-left: 0;
  }
}
</style>
