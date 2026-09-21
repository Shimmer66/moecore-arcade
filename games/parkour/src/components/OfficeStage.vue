<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  ArrowDown,
  Check,
  Code,
  FileText,
  Printer as PrinterIcon,
  Send,
  ShieldCheck,
  Undo2,
} from '@lucide/vue';
import { ASSETS } from '@moecore/assets';
import {
  ANSWER_DISTANCE,
  CONTEXT_CAPACITY,
  SHIFT_DISTANCE,
  TAIL_REACH,
  type Adventure,
} from '../rules';
import { poseId, type Pose } from '../config/art';

const props = defineProps<{
  state: Adventure;
  art: Readonly<Record<string, string>>;
  phase: string;
  paused: boolean;
  reduceMotion: boolean;
}>();
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
const floorCount = computed(() => Math.ceil(width.value / 192) + 2);
const pose = computed<Pose>(() => {
  if (props.phase === 'ended') return props.state.health === 0 ? 'fail' : 'win';
  if (props.phase !== 'running') return 'idle';
  if (props.state.dashTicks > 0) return 'dash';
  if (props.state.hurtUntil > props.state.realTick) return 'hurt';
  if (!props.state.run.player.grounded) return 'jump';
  return props.state.run.player.crouching ? 'slide' : 'run';
});
const sprite = computed(
  () =>
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
    aria-label="回答生成中心跑道"
    tabindex="0"
    @pointerdown="down"
    @pointerup="up"
    @pointercancel="gesture = undefined"
    @lostpointercapture="gesture = undefined"
  >
    <img v-if="art.bg_far" class="office-background" :src="art.bg_far" alt="" />
    <div v-else class="office-windows" aria-hidden="true">
      <span v-for="i in 7" :key="i"></span>
    </div>
    <div class="office-midground" aria-hidden="true">
      <img
        v-if="art.bg_mid"
        :src="art.bg_mid"
        alt=""
        :style="{
          transform: `translateX(${-(reduceMotion ? 0 : (state.run.distance * 3) % 100)}px)`,
        }"
      />
      <template v-for="(id, index) in ['decor_plant', 'decor_desk', 'decor_water']" :key="id">
        <img
          v-if="art[id]"
          class="office-decoration"
          :src="art[id]"
          alt=""
          :style="{
            left: `${((((index * 46 + 20 - (reduceMotion ? 0 : state.run.distance * 0.6)) % 150) + 150) % 150) - 20}%`,
          }"
        />
      </template>
      <div v-if="state.run.distance < 78" class="canteen-window">
        <img :src="ASSETS.canteen.url" alt="" /><span>算力补给 · 管饭</span>
      </div>
    </div>
    <div class="office-floor" aria-hidden="true">
      <img
        v-for="i in art.tile_ground_mid ? floorCount : 0"
        :key="i"
        :src="art.tile_ground_mid"
        alt=""
        :style="{ left: `${(i - 2) * 192 - ((state.run.distance * meter) % 192)}px` }"
      />
    </div>
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
            >最后再改亿点</span
          >
          <img v-if="art.obstacle_beam" :src="art.obstacle_beam" alt="" />
          <span v-else class="drawn-beam"></span><ArrowDown :size="15" class="beam-arrow" />
        </template>
        <template v-else>
          <img
            v-if="art.obstacle_docs_small"
            :src="art[obstacle.id % 2 ? 'obstacle_docs_large' : 'obstacle_docs_small']"
            alt=""
          />
          <FileText v-else :size="29" />
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
          >退订成功<br />停止叭叭</span
        >
        <span
          v-else-if="!printer.fired && printer.fireTick !== null && captionVisible(printer.x)"
          class="printer-warning"
          :style="captionStyle(printer.x)"
          >还有亿点补充！</span
        >
        <img
          v-if="art.printer_idle"
          :src="
            art[
              printer.jammed
                ? 'printer_idle'
                : printer.fired
                  ? 'printer_fire'
                  : printer.fireTick === null
                    ? 'printer_idle'
                    : 'printer_warning'
            ]
          "
          alt=""
        />
        <PrinterIcon v-else :size="44" />
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
        <img v-if="art.projectile_paper" :src="art.projectile_paper" alt="" />
        <span v-else class="drawn-paper"></span>
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
        <img v-if="art.obstacle_docs_broken" :src="art.obstacle_docs_broken" alt="" />
        <FileText v-else :size="28" />
      </div>
    </template>
    <div
      v-if="!state.hasAnswer && inView(ANSWER_DISTANCE)"
      class="answer-package"
      :style="{ left: `${worldLeft(ANSWER_DISTANCE)}px` }"
      aria-label="真正可运行的小游戏"
    >
      <img v-if="art.pickup_bubble" :src="art.pickup_bubble" alt="" /><Code :size="24" />
      <span v-if="captionVisible(ANSWER_DISTANCE)" :style="captionStyle(ANSWER_DISTANCE)"
        >这次真能运行</span
      >
    </div>
    <div
      v-if="inView(SHIFT_DISTANCE - 1)"
      class="office-exit"
      :style="{ left: `${worldLeft(SHIFT_DISTANCE - 1)}px` }"
    >
      <img
        v-if="art.exit_closed"
        :src="art[state.hasAnswer ? 'exit_open' : 'exit_closed']"
        alt="发送出口"
      />
      <Send v-else :size="46" /><span
        v-if="captionVisible(SHIFT_DISTANCE - 1)"
        :style="captionStyle(SHIFT_DISTANCE - 1)"
        >发送，开饭！</span
      >
    </div>
    <div
      v-if="state.tailTicks > 0"
      class="tail-sweep"
      aria-hidden="true"
      :style="{
        left: `${anchor + meter * 0.35}px`,
        width: `${meter * TAIL_REACH}px`,
        bottom: `${52 + (state.run.player.y + 0.5) * 48}px`,
        transform: `rotate(${reduceMotion ? 0 : (state.tailTicks / 18 - 0.5) * 35}deg)`,
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
      :class="{
        protected: state.invulnerableTicks > 0 && phase === 'running',
        slapping: state.tailTicks > 0,
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
.office-world {
  position: relative;
  height: 340px;
  overflow: hidden;
  isolation: isolate;
  background: #eef3f3;
  touch-action: none;
  user-select: none;
}
.office-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
}
.ready-scene .office-background {
  opacity: 0.55;
}
.office-windows {
  display: flex;
  gap: 24px;
  position: absolute;
  top: 40px;
  left: 3%;
  right: 3%;
  height: 156px;
  border-block: 10px solid #c4cedb;
}
.office-windows span {
  flex: 1;
  border-inline: 5px solid #ced6df;
  background: #deebef;
}
.office-midground {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.office-midground > img:not(.office-decoration) {
  position: absolute;
  width: calc(100% + 110px);
  height: 180px;
  bottom: 67px;
  object-fit: contain;
  object-position: bottom;
  opacity: 0.55;
}
.office-decoration {
  position: absolute;
  width: 75px;
  height: 86px;
  bottom: 60px;
  object-fit: contain;
  object-position: bottom;
  opacity: 0.55;
}
.canteen-window {
  position: absolute;
  left: 55%;
  bottom: 90px;
  width: 190px;
  height: 144px;
}
.canteen-window img {
  width: 100%;
  height: 100%;
}
.canteen-window > span {
  position: absolute;
  top: 45px;
  left: 15%;
  right: 15%;
  font-size: 10px;
  color: #305d4e;
  background: #f1faf4;
  padding: 4px;
  text-align: center;
}
.ready-scene .canteen-window {
  left: auto;
  right: 5%;
  bottom: 53px;
  width: 150px;
  height: 114px;
}
.ready-scene .canteen-window > span {
  top: 32px;
  font-size: 9px;
}
.office-floor {
  position: absolute;
  height: 52px;
  inset: auto 0 0;
  background: #91a5a4;
  border-top: 7px solid #d2dedd;
}
.office-floor img {
  position: absolute;
  width: 194px;
  height: 45px;
  top: -3px;
  object-fit: fill;
  opacity: 0.85;
}
.office-obstacle {
  position: absolute;
  bottom: 52px;
  z-index: 4;
}
.office-obstacle.ground {
  height: 29px;
  color: #526880;
  background: #d9e1eab0;
  border-bottom: 2px solid #596f83;
}
.office-obstacle.ground img {
  position: absolute;
  width: 52px;
  height: 38px;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  object-fit: contain;
  object-position: bottom;
}
.office-obstacle.air {
  height: 154px;
  bottom: 100px;
  border-left: 1px dashed #8197aa;
}
.office-obstacle.air img,
.drawn-beam {
  position: absolute;
  bottom: 0;
  width: 62px;
  height: 20px;
  left: 50%;
  transform: translateX(-50%);
  object-fit: fill;
}
.drawn-beam {
  background: #c9b6b9;
  border: 3px solid #946a78;
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
  color: #6a8052;
  background: #deebc5;
  border: 2px solid #8a9d68;
  display: flex;
  justify-content: center;
  align-items: center;
}
.office-queue > span {
  position: absolute;
  bottom: 42px;
  left: 50%;
  transform: translateX(-50%);
  background: #f4fae7;
  padding: 3px 5px;
  font-size: 10px;
  white-space: nowrap;
  color: #5c753e;
}
.office-queue i {
  position: absolute;
  bottom: -7px;
  left: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #566a56;
}
.office-queue i:last-child {
  left: auto;
  right: 2px;
}
.office-printer {
  position: absolute;
  bottom: 73px;
  width: 80px;
  height: 62px;
  z-index: 3;
  transform: translateX(-50%);
  color: #566f89;
}
.office-printer img {
  height: 100%;
  width: 100%;
  object-fit: contain;
}
.office-printer.jammed > img {
  transform: rotate(9deg) scaleY(0.9);
  filter: saturate(0.35);
}
.printer-warning,
.printer-receipt {
  position: absolute;
  bottom: 65px;
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
}
.office-exit img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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
  .office-midground > img:not(.office-decoration) {
    min-width: 640px;
    left: -90px;
  }
  .office-decoration {
    width: 58px;
    height: 65px;
  }
  .office-player {
    width: 88px;
    height: 105px;
  }
  .canteen-window {
    width: 140px;
    height: 105px;
    left: 48%;
    bottom: 104px;
  }
  .canteen-window > span {
    top: 33px;
    font-size: 9px;
    padding: 2px;
  }
  .ready-scene .canteen-window {
    width: 120px;
    height: 90px;
    right: 3%;
  }
  .ready-scene .canteen-window > span {
    top: 28px;
    font-size: 8px;
    padding: 1px;
  }
  .office-obstacle.ground img {
    width: 38px;
  }
  .office-obstacle.air img,
  .drawn-beam {
    width: 40px;
  }
  .beam-label {
    font-size: 9px;
    padding: 3px;
  }
  .office-printer {
    width: 62px;
    height: 53px;
  }
}
</style>
