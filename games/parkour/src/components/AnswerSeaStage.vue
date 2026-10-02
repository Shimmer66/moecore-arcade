<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowDown, Check, Code, FileText, Send, ShieldCheck, Undo2 } from '@lucide/vue';
import { ASSETS, PARKOUR_BACKGROUNDS } from '@moecore/assets';
import {
  BURST_TICKS,
  CONTEXT_CAPACITY,
  TAIL_REACH,
  TAIL_TICKS,
  levelFor,
  type Adventure,
} from '../rules';
import { poseId, type Pose } from '../config/art';
import { reactionActionSprites } from '../config/reactions';
import printerSprite from '../../assets/obstacles/ai-printer.png';

const props = defineProps<{
  state: Adventure;
  art: Readonly<Record<string, string>>;
  phase: string;
  paused: boolean;
  reduceMotion: boolean;
}>();
const level = computed(() => levelFor(props.state.levelId));
const emit = defineEmits<{ jump: []; slide: []; tail: [] }>();
const root = ref<HTMLElement>();
const width = ref(960);
const meter = computed(() => Math.max(11, Math.min(48, width.value / 22)));
const anchor = computed(() => width.value * 0.17);
const worldLeft = (x: number) => anchor.value + (x - props.state.run.distance) * meter.value;
const inView = (x: number) => worldLeft(x) > -120 && worldLeft(x) < width.value + 100;
const captionVisible = (x: number) => worldLeft(x) >= 0 && worldLeft(x) <= width.value;
const captionStyle = (x: number) => ({
  transform: `translateX(calc(-50% + ${Math.max(60, Math.min(width.value - 60, worldLeft(x))) - worldLeft(x)}px))`,
});
const obstacles = computed(() => props.state.run.obstacles.filter((item) => inView(item.x)));
const papers = computed(() => props.state.papers.filter((item) => inView(item.x)));
const printers = computed(() => props.state.printers.filter((item) => inView(item.x)));
const pickups = computed(() => props.state.pickups.filter((item) => inView(item.x)));
const queues = computed(() => props.state.queues.filter((item) => inView(item.x)));
const hallucinations = computed(() => props.state.hallucinations.filter((item) => inView(item.x)));
const debris = computed(() =>
  props.state.feedback.filter((item) => item.kind === 'break' && inView(item.x)),
);
const counters = computed(() =>
  props.state.feedback.filter((item) => item.kind === 'perfect' && inView(item.x)),
);
const pose = computed<Pose>(() => {
  if (props.phase === 'ended') return props.state.health === 0 ? 'fail' : 'win';
  if (props.phase !== 'running') return 'idle';
  if (props.state.dashTicks > 0) return 'dash';
  if (props.state.hurtUntil > props.state.realTick) return 'hurt';
  if (!props.state.run.player.grounded) return 'jump';
  return props.state.run.player.crouching ? 'slide' : 'run';
});
const reaction = computed<keyof typeof reactionActionSprites | undefined>(() => {
  if (props.phase !== 'running' || props.state.hurtUntil > props.state.realTick) return undefined;
  if (props.state.run.player.crouching) return undefined;
  if (props.state.dashTicks > BURST_TICKS - 45) return 'burst';
  if (props.state.quip === 'hallucination' && props.state.quipUntil - props.state.realTick > 90)
    return 'overload';
  if (
    props.state.feedback.some(
      (effect) =>
        (effect.kind === 'rice' || effect.kind === 'feast') &&
        effect.until - props.state.realTick > 35,
    )
  )
    return 'rice';
  return undefined;
});
const sprite = computed(
  () =>
    (reaction.value && reactionActionSprites[reaction.value]) ||
    props.art[
      poseId(pose.value, props.state.run.tick, props.state.run.player.velocityY, props.reduceMotion)
    ],
);
const canMove = () => props.phase === 'running' && !props.paused;
let observer: ResizeObserver | undefined;
let gesture: { id: number; x: number; y: number } | undefined;
function down(event: PointerEvent) {
  if (!canMove() || !event.isPrimary || gesture || event.button !== 0) return;
  root.value?.focus({ preventScroll: true });
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  root.value?.setPointerCapture(event.pointerId);
}
function up(event: PointerEvent) {
  if (!gesture || gesture.id !== event.pointerId) return;
  const dx = event.clientX - gesture.x;
  const dy = event.clientY - gesture.y;
  gesture = undefined;
  if (!canMove()) return;
  if (dy > 24 && Math.abs(dy) > Math.abs(dx)) emit('slide');
  else if (dx > 36 && Math.abs(dx) > Math.abs(dy)) emit('tail');
  else emit('jump');
}
watch(
  () => props.paused,
  () => {
    gesture = undefined;
  },
);
defineExpose({ focus: () => root.value?.focus({ preventScroll: true }) });
onMounted(() => {
  if (!root.value) return;
  width.value = root.value.clientWidth;
  observer = new ResizeObserver(([entry]) => {
    if (entry) {
      width.value = entry.contentRect.width;
    }
  });
  observer.observe(root.value);
});
onUnmounted(() => {
  observer?.disconnect();
  gesture = undefined;
});
</script>

<template>
  <div
    ref="root"
    class="office-world runner-world"
    :class="{
      thinking: state.slowTicks > 0,
      rushing: state.dashTicks > 0,
      'motion-paused': paused || reduceMotion,
      'ready-scene': phase === 'ready',
      [`level-${state.levelId + 1}`]: true,
    }"
    :data-phase="phase"
    :data-tick="state.run.tick"
    :data-real-tick="state.realTick"
    :data-distance="state.run.distance"
    :data-speed="state.run.speed"
    :data-answer="state.hasAnswer"
    :data-slow="state.slowTicks"
    :data-dash="state.dashTicks"
    :data-tail="state.tailTicks"
    :data-cooldown="state.tailCooldown"
    :data-energy="state.energy"
    :data-returns="state.returns"
    :data-rice="state.rice"
    :data-breaks="state.breaks"
    :data-parries="state.parries"
    :data-context="state.context"
    :data-verified="state.verified"
    role="application"
    aria-label="数据海送答跑道"
    tabindex="0"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="gesture = undefined"
    @lostpointercapture="gesture = undefined"
  >
    <img
      class="office-background"
      :src="PARKOUR_BACKGROUNDS[state.levelId === 3 ? 0 : state.levelId]"
      alt=""
    />
    <div class="office-midground" aria-hidden="true">
      <div v-if="state.run.distance < 78" class="rice-island">
        <img :src="ASSETS.riceBowl.url" alt="" /><span>白饭补给 · 路过别忘了</span>
      </div>
    </div>
    <div
      class="office-floor"
      :style="{
        backgroundPositionX: `${reduceMotion ? 0 : -(state.run.distance * meter) % 120}px`,
      }"
      aria-hidden="true"
    ></div>
    <template v-if="phase !== 'ready'">
      <div
        v-for="obstacle in obstacles"
        :key="obstacle.id"
        class="office-obstacle runner-obstacle"
        :class="obstacle.kind"
        :data-x="obstacle.x"
        :data-kind="obstacle.kind"
        :style="{ left: `${worldLeft(obstacle.x)}px`, width: `${Math.max(14, meter * 0.8)}px` }"
        aria-hidden="true"
      >
        <template v-if="obstacle.kind === 'air'">
          <span
            v-if="captionVisible(obstacle.x)"
            class="beam-label"
            :style="captionStyle(obstacle.x + 0.4)"
            >{{ state.hasAnswer ? '验收门 · 低头' : '推理断流' }}</span
          >
          <span class="drawn-beam"></span><ArrowDown :size="15" class="beam-arrow" />
        </template>
        <template v-else>
          <FileText :size="29" />
          <span
            v-if="state.hasAnswer && obstacle.id >= 105 && captionVisible(obstacle.x)"
            class="beam-label"
            :style="captionStyle(obstacle.x + 0.4)"
            >返工单 · 跳过</span
          >
        </template>
      </div>
      <div
        v-for="queue in queues"
        :key="queue.id"
        class="office-queue"
        :data-x="queue.x"
        data-kind="ground"
        :style="{ left: `${worldLeft(queue.x)}px`, width: `${Math.max(22, meter * 1.2)}px` }"
        aria-hidden="true"
      >
        <span v-if="captionVisible(queue.x)" :style="captionStyle(queue.x + 0.6)"
          >需求 {{ queue.id + 1 }}</span
        ><FileText :size="26" /><i></i><i></i>
      </div>
      <div
        v-for="printer in printers"
        :key="printer.id"
        class="office-printer"
        :class="{ jammed: printer.jammed }"
        :data-x="printer.x"
        :data-state="
          printer.jammed
            ? 'jammed'
            : printer.fired
              ? 'fired'
              : printer.fireTick === null
                ? 'idle'
                : 'warning'
        "
        :style="{ left: `${worldLeft(printer.x)}px` }"
        aria-hidden="true"
      >
        <span
          v-if="printer.receiptUntil > state.realTick && captionVisible(printer.x)"
          class="printer-receipt"
          :style="captionStyle(printer.x)"
          >回音已停<br />继续送答</span
        >
        <span
          v-else-if="!printer.fired && printer.fireTick !== null && captionVisible(printer.x)"
          class="printer-warning"
          :style="captionStyle(printer.x)"
          >还有一点补充！</span
        >
        <img class="printer-sprite" :src="printerSprite" alt="" draggable="false" />
        <b v-if="printer.jammed" class="printer-rejected">已退订</b>
      </div>
      <div
        v-for="paper in papers"
        :key="paper.id"
        class="office-paper"
        :class="{ returned: paper.returned }"
        :data-x="paper.x"
        :data-y="paper.y"
        :data-returned="paper.returned"
        :style="{ left: `${worldLeft(paper.x)}px`, bottom: `${52 + paper.y * 48}px` }"
        aria-hidden="true"
      >
        <span class="drawn-paper"></span>
        <Undo2 v-if="paper.returned" class="paper-return-icon" :size="14" />
      </div>
      <div
        v-for="pickup in pickups"
        :key="pickup.id"
        class="office-pickup"
        :class="pickup.kind"
        :data-kind="pickup.kind"
        :data-x="pickup.x"
        :data-y="pickup.y"
        :style="{ left: `${worldLeft(pickup.x)}px`, bottom: `${52 + pickup.y * 48}px` }"
        aria-hidden="true"
      >
        <img v-if="pickup.kind === 'rice'" :src="ASSETS.riceBowl.url" alt="" />
        <img v-else-if="art.pickup_bubble" :src="art.pickup_bubble" alt="" />
        <span v-else class="drawn-bubble"></span>
        <span
          v-if="pickup.kind === 'rice' && captionVisible(pickup.x)"
          class="rice-label"
          :style="captionStyle(pickup.x)"
          >算力 +35</span
        >
      </div>
      <div
        v-for="item in hallucinations"
        :key="item.id"
        class="office-hallucination"
        :data-x="item.x"
        :style="{ left: `${worldLeft(item.x)}px`, bottom: `${52 + item.y * 48}px` }"
        aria-hidden="true"
      >
        <img :src="ASSETS.riceBowl.url" alt="" /><b>?</b
        ><span v-if="captionVisible(item.x)" :style="captionStyle(item.x)">AI 生成 · 未核验</span>
      </div>
      <div
        v-for="effect in debris"
        :key="effect.id"
        class="office-debris"
        :style="{
          left: `${worldLeft(effect.x)}px`,
          bottom: `${52 + (effect.y - 0.6) * 48 + (reduceMotion ? 12 : (65 - (effect.until - state.realTick)) * 0.5)}px`,
          opacity: Math.min(1, (effect.until - state.realTick) / 20),
        }"
        aria-hidden="true"
      >
        <FileText :size="28" />
      </div>
    </template>
    <div
      v-if="state.levelId !== 3 && !state.hasAnswer && inView(level.answerDistance)"
      class="answer-package"
      :style="{ left: `${worldLeft(level.answerDistance)}px` }"
      aria-label="真正可运行的小游戏"
    >
      <img v-if="art.pickup_bubble" :src="art.pickup_bubble" alt="" /><Code :size="24" />
      <span v-if="captionVisible(level.answerDistance)" :style="captionStyle(level.answerDistance)"
        >答案在这儿</span
      >
    </div>
    <div
      v-if="state.levelId !== 3 && inView(level.finishDistance - 1)"
      class="office-exit"
      :style="{ left: `${worldLeft(level.finishDistance - 1)}px` }"
    >
      <Send :size="46" /><span
        v-if="captionVisible(level.finishDistance - 1)"
        :style="captionStyle(level.finishDistance - 1)"
        >答案送达，开饭！</span
      >
    </div>
    <div
      v-for="effect in counters"
      :key="effect.id"
      class="perfect-counter"
      :style="{
        left: `${Math.max(80, Math.min(width - 80, worldLeft(effect.x)))}px`,
        bottom: `${120 + effect.y * 48}px`,
      }"
      aria-hidden="true"
    >
      精准退订！<small>已读 · 原路退回</small>
    </div>
    <div
      v-if="state.tailTicks > 0"
      class="tail-sweep"
      aria-hidden="true"
      :style="{
        left: `${anchor + meter * 0.35}px`,
        width: `${meter * TAIL_REACH}px`,
        bottom: `${52 + (state.run.player.y + 0.5) * 48}px`,
        transform: `rotate(${reduceMotion ? 0 : (state.tailTicks / TAIL_TICKS - 0.5) * 35}deg)`,
      }"
    >
      <Undo2 :size="22" />
    </div>
    <div
      class="office-player runner-player"
      :data-pose="pose"
      :data-y="state.run.player.y.toFixed(3)"
      :data-vy="state.run.player.velocityY"
      :data-air-jumps="state.airJumps"
      :data-reaction="reaction ?? ''"
      :class="{
        protected: state.invulnerableTicks > 0 && phase === 'running',
        slapping: state.tailTicks > 0,
        'reacting-rice': reaction === 'rice',
        'reacting-overload': reaction === 'overload',
        'reacting-burst': reaction === 'burst',
      }"
      :style="{ left: `${anchor - 42}px`, transform: `translateY(${-state.run.player.y * 48}px)` }"
      data-testid="runner-player"
    >
      <img v-if="sprite" :src="sprite" alt="DeepSeek 娘" draggable="false" class="maid-sprite" />
      <div v-else class="drawn-maid" :class="{ slide: pose === 'slide' }">
        <span></span><i></i><b></b><em></em>
      </div>
      <img
        v-if="state.dashTicks > 0 && art.fx_whale_loop"
        class="whale-trail"
        :src="art.fx_whale_loop"
        alt=""
      />
      <span v-else-if="state.dashTicks > 0" class="drawn-trail"></span>
      <ShieldCheck
        v-if="state.context === CONTEXT_CAPACITY"
        class="context-shield"
        :size="24"
        aria-label="上下文护盾就绪"
      />
      <Check v-if="state.hasAnswer" class="answer-carried" :size="18" aria-label="已取回小游戏" />
    </div>
  </div>
</template>

<style scoped>
.perfect-counter {
  position: absolute;
  z-index: 8;
  transform: translateX(-50%) rotate(-6deg);
  padding: 8px 14px;
  border: 3px solid #804726;
  border-radius: 8px;
  background: #ffe49a;
  color: #663710;
  box-shadow: 3px 3px 0 #ffffff;
  font-size: 18px;
  font-weight: 900;
  pointer-events: none;
}
.perfect-counter small {
  display: block;
  font-size: 10px;
}
.office-world {
  position: relative;
  height: 340px;
  overflow: hidden;
  isolation: isolate;
  background: #244b98;
  touch-action: none;
  user-select: none;
}
.office-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 43%;
}
.ready-scene .office-background {
  opacity: 0.85;
}
.level-2 .office-floor {
  filter: hue-rotate(55deg);
}
.level-3 .office-floor {
  filter: hue-rotate(-42deg);
}
.level-4 .office-background {
  filter: brightness(0.84) saturate(0.85);
}
.level-4 .office-floor {
  filter: hue-rotate(145deg);
}
.office-midground {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.rice-island {
  position: absolute;
  right: 11%;
  bottom: 69px;
  display: grid;
  place-items: center;
  width: 138px;
  height: 74px;
  border-radius: 50% 50% 12px 12px;
  background: #fffbefdb;
  border: 3px solid #bee7f5;
  box-shadow:
    0 9px 0 #3473a3,
    0 12px 28px #0e3a7880;
}
.rice-island img {
  width: 58px;
  height: 46px;
  object-fit: contain;
}
.rice-island > span {
  position: absolute;
  top: -28px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  color: #184d83;
  background: #fffdf4e8;
  padding: 4px 8px;
  border-radius: 20px;
  text-align: center;
}
.office-floor {
  position: absolute;
  height: 52px;
  inset: auto 0 0;
  background: repeating-linear-gradient(110deg, #9ed2ee 0 30px, #75b6e1 30px 60px);
  background-size: 120px 52px;
  border-top: 7px solid #d6f5ff;
  box-shadow:
    inset 0 8px 0 #478fcc,
    0 -6px 20px #b9eaff8c;
}
.office-obstacle {
  position: absolute;
  bottom: 52px;
  z-index: 4;
}
.office-obstacle.ground {
  height: 29px;
  color: #2d356c;
  background: #fff0db;
  border: 3px solid #534579;
  border-radius: 8px 8px 3px 3px;
  box-shadow:
    0 4px 0 #28305d,
    0 0 8px #f8e6ff;
}
.office-obstacle.ground > svg {
  position: absolute;
  left: 50%;
  bottom: 1px;
  transform: translateX(-50%);
}
.office-obstacle.air {
  height: 154px;
  bottom: 100px;
  border-left: 2px dashed #d9f5ff;
}
.drawn-beam {
  position: absolute;
  bottom: 0;
  width: 62px;
  height: 20px;
  left: 50%;
  transform: translateX(-50%);
}
.drawn-beam {
  background: linear-gradient(90deg, #8b61b9, #d3a6e9, #8b61b9);
  border: 3px solid #573e91;
  border-radius: 12px;
  box-shadow: 0 0 12px #eeceff;
}
.beam-label {
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  color: #a3526e;
  background: #fff0f2;
  padding: 3px 6px;
  border: 1px solid #d4a6b4;
}
.beam-arrow {
  position: absolute;
  bottom: 4px;
  color: #994d69;
  left: calc(50% - 7px);
}
.office-queue {
  position: absolute;
  bottom: 55px;
  height: 34px;
  z-index: 4;
  color: #793657;
  background: #ffcfb7;
  border: 3px solid #a54869;
  display: flex;
  justify-content: center;
  align-items: center;
}
.office-queue > span {
  position: absolute;
  bottom: 42px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff2e9;
  padding: 3px 5px;
  font-size: 10px;
  white-space: nowrap;
  color: #793657;
}
.office-queue i {
  position: absolute;
  bottom: -7px;
  left: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #633848;
}
.office-queue i:last-child {
  left: auto;
  right: 2px;
}
.office-printer {
  position: absolute;
  bottom: 52px;
  width: 102px;
  height: 86px;
  z-index: 3;
  transform: translateX(-50%);
  color: #fff8ff;
  display: grid;
  place-items: center;
}
.printer-sprite {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.office-printer > b {
  position: absolute;
  bottom: 9px;
  letter-spacing: 2px;
  font-size: 13px;
  background: #fff6d9;
  color: #8b3e51;
  border: 2px solid currentColor;
  padding: 2px 5px;
  transform: rotate(-12deg);
}
.office-printer.jammed {
  transform: translateX(-50%) rotate(9deg) scaleY(0.9);
  filter: saturate(0.45);
}
.printer-warning,
.printer-receipt {
  position: absolute;
  bottom: 88px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 10px;
  padding: 4px 7px;
  color: #a65168;
  background: #fff0f2;
  border: 1px solid #d59ead;
}
.printer-receipt {
  color: #467a68;
  background: #fbfff5;
  border: 1px dashed #739981;
  text-align: center;
  line-height: 1.6;
}
.office-paper {
  position: absolute;
  width: 24px;
  height: 24px;
  z-index: 6;
}
.office-paper img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.drawn-paper {
  display: block;
  width: 22px;
  height: 22px;
  background: #fff;
  border: 2px solid #8a8e9c;
  border-radius: 5px;
  transform: rotate(30deg);
}
.paper-return-icon {
  position: absolute;
  bottom: 27px;
  left: 50%;
  transform: translateX(-50%);
  color: #976b1d;
}
.returned {
  filter: drop-shadow(-9px 0 2px #e4ac4666);
}
.office-pickup {
  position: absolute;
  width: 22px;
  height: 22px;
  transform: translate(-50%, 50%);
  z-index: 2;
}
.office-pickup img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.office-pickup.rice {
  width: 42px;
  height: 35px;
}
.rice-label {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 9px;
  color: #a4556d;
  padding: 2px 4px;
  background: #fff5f6;
}
.drawn-bubble {
  display: block;
  width: 17px;
  height: 17px;
  border: 2px solid #59abc4;
  border-radius: 50%;
  background: #b3e6f080;
}
.office-hallucination {
  position: absolute;
  width: 42px;
  height: 36px;
  transform: translate(-50%, 50%);
  z-index: 4;
  border: 2px dashed #b57a8e;
  background: #fff5fa80;
}
.office-hallucination img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.5;
  filter: grayscale(1);
}
.office-hallucination b {
  position: absolute;
  inset: 5px 0 0;
  text-align: center;
  font-size: 22px;
  color: #985276;
}
.office-hallucination > span {
  position: absolute;
  bottom: 43px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  color: #99556a;
  background: #fff5f8;
  padding: 3px;
  font-size: 9px;
  border: 1px dashed #cba1b2;
}
.context-shield {
  position: absolute;
  left: 26px;
  top: 0;
  color: #427e66;
  background: #e9fff5d9;
  border-radius: 50%;
}
.office-player {
  position: absolute;
  bottom: 46px;
  width: 104px;
  height: 110px;
  z-index: 5;
  pointer-events: none;
}
.maid-sprite {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.reacting-rice .maid-sprite {
  animation: rice-munch 0.24s ease-in-out infinite alternate;
}
.reacting-overload .maid-sprite {
  animation: overload-wobble 0.16s ease-in-out infinite alternate;
}
.reacting-burst .maid-sprite {
  animation: whale-dash 0.18s ease-in-out infinite alternate;
}
.motion-paused .maid-sprite {
  animation: none;
}
@keyframes rice-munch {
  to {
    transform: translateY(2px) rotate(-3deg);
  }
}
@keyframes overload-wobble {
  to {
    transform: translateX(3px) rotate(5deg);
  }
}
@keyframes whale-dash {
  to {
    transform: translateX(5px) skewX(-5deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .maid-sprite {
    animation: none !important;
  }
}
.office-player.protected {
  opacity: 0.6;
}
.slapping .maid-sprite {
  transform: rotate(-8deg);
  transform-origin: center bottom;
}
.whale-trail {
  position: absolute;
  width: 180px;
  height: 120px;
  object-fit: contain;
  bottom: 0;
  left: -44px;
  z-index: -1;
}
.drawn-trail {
  position: absolute;
  width: 155px;
  height: 68px;
  bottom: 6px;
  left: -40px;
  background: #90d9e088;
  border-block: 3px solid #59aeb4;
  border-radius: 45%;
  z-index: -1;
}
.drawn-maid {
  position: absolute;
  bottom: 6px;
  left: 36px;
  width: 45px;
  height: 84px;
}
.drawn-maid span {
  position: absolute;
  top: 0;
  width: 36px;
  height: 34px;
  border: 7px solid #477292;
  border-bottom: 0;
  border-radius: 16px 16px 5px 5px;
  background: #f5ded3;
}
.drawn-maid i {
  position: absolute;
  top: 29px;
  left: -3px;
  width: 44px;
  height: 34px;
  background: #437b99;
  border: 7px solid #f7fafc;
  border-top-width: 4px;
  border-radius: 8px;
}
.drawn-maid b {
  position: absolute;
  bottom: 0;
  width: 28px;
  height: 20px;
  border-inline: 8px solid #40505f;
  left: 4px;
}
.drawn-maid em {
  position: absolute;
  bottom: 12px;
  left: -25px;
  width: 34px;
  height: 14px;
  background: #4c8caf;
  border-radius: 70% 0 40% 10%;
  transform: rotate(-25deg);
}
.drawn-maid.slide {
  transform: scaleY(0.48);
  transform-origin: center bottom;
}
.tail-sweep {
  position: absolute;
  height: 79px;
  z-index: 7;
  border-right: 6px solid #cf6c8e;
  border-block: 2px solid #cf6c8e55;
  border-radius: 0 80% 80% 0;
  background: #f5aeca30;
  color: #ba5477;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  pointer-events: none;
}
.office-debris {
  position: absolute;
  z-index: 8;
  width: 78px;
  height: 48px;
  transform: translateX(-50%);
  color: #4a8275;
  pointer-events: none;
}
.office-debris img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.thinking {
  box-shadow: inset 0 0 0 3px #69baa5;
}
.rushing {
  box-shadow: inset 0 0 0 3px #e0bc6a;
}
.answer-carried {
  position: absolute;
  top: 2px;
  right: 0;
  background: #c3ede3;
  border-radius: 50%;
  color: #277562;
}
.answer-package {
  position: absolute;
  bottom: 96px;
  width: 72px;
  height: 72px;
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  color: #2f809c;
  z-index: 4;
}
.answer-package img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  position: absolute;
}
.answer-package > svg {
  z-index: 1;
}
.answer-package span {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: #fff;
  padding: 3px;
  font-size: 10px;
}
.office-exit {
  position: absolute;
  bottom: 52px;
  width: 85px;
  height: 150px;
  display: grid;
  place-items: center;
  transform: translateX(-50%);
  color: #fff8d6;
  background: linear-gradient(#abc8fb, #426bb9);
  border: 3px solid #def4ff;
  border-radius: 45% 45% 8px 8px;
  box-shadow:
    0 0 25px #fff3a4,
    inset 0 0 14px #e7f3ff;
}
.office-exit span {
  position: absolute;
  top: -15px;
  left: 50%;
  transform: translateX(-50%);
  background: #fff;
  padding: 2px 8px;
  color: #497b6e;
  font-size: 11px;
  white-space: nowrap;
}
@media (max-width: 700px) {
  .office-world {
    height: 286px;
  }
  .office-player {
    width: 88px;
    height: 105px;
  }
  .rice-island {
    width: 96px;
    height: 58px;
    right: 4%;
    bottom: 65px;
  }
  .rice-island img {
    width: 48px;
  }
  .rice-island > span {
    font-size: 8px;
  }
  .drawn-beam {
    width: 40px;
  }
  .beam-label {
    font-size: 9px;
    padding: 3px;
  }
  .office-printer {
    width: 78px;
    height: 66px;
  }
  .printer-warning,
  .printer-receipt {
    bottom: 68px;
  }
}
</style>
