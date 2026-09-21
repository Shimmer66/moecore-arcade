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
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import OfficeStage from './OfficeStage.vue';
import { officeAssetIds } from '../config/art';
import { endingFor, opening, quips } from '../config/story';
import {
  advanceAdventure,
  beginAdventure,
  CONTEXT_CAPACITY,
  departmentAt,
  FIXED_DT,
  multiplierFor,
  seedForSession,
  SHIFT_DISTANCE,
} from '../rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const phase = ref<'ready' | 'countdown' | 'running' | 'ended'>('ready');
const state = shallowRef(beginAdventure(seedForSession(props.sessionId)));
const art = shallowRef<Readonly<Record<string, string>>>({});
const artError = ref(false);
const artLoading = ref(import.meta.env.DEV);
const stage = ref<InstanceType<typeof OfficeStage>>();
const score = computed(() => state.value.run.score + state.value.bonus);
const dialogue = computed(() => quips[state.value.quip]);
const portrait = computed(
  () => art.value[phase.value === 'ready' ? opening.portrait : dialogue.value.portrait],
);
const feedbackCopy = {
  break: { priority: 0, text: '说明书已粉碎' },
  rice: { priority: 1, text: '算力到账 +35' },
  parry: { priority: 2, text: '漂亮，原路退回' },
  return: { priority: 3, text: '拒收成功' },
  verified: { priority: 4, text: '查无此饭 · 核验通过' },
  shield: { priority: 5, text: '上下文兜底' },
} as const;
const notice = computed(() => {
  let selected: (typeof state.value.feedback)[number] | undefined;
  for (const feedback of state.value.feedback) {
    if (!selected || feedbackCopy[feedback.kind].priority >= feedbackCopy[selected.kind].priority)
      selected = feedback;
  }
  return selected ? { kind: selected.kind, text: feedbackCopy[selected.kind].text } : null;
});
const department = computed(() => departmentAt(state.value.run.distance));
const active = computed(() => phase.value === 'running' && !props.paused);
const charged = computed(() => state.value.energy === 100);
const tailName = computed(() => (charged.value ? '大肥鱼出击' : '尾巴回信'));
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
  if (!import.meta.env.DEV) return;
  const version = ++loadVersion;
  artLoading.value = true;
  artError.value = false;
  try {
    const { loadWhaleRunnerAssets } = await import('@moecore/assets/whale-runner');
    const urls = await loadWhaleRunnerAssets(officeAssetIds);
    await Promise.all(
      Object.values(urls).map(async (url) => {
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
  const success = next.run.result?.reason === 'distance-limit' && next.hasAnswer;
  const imageUrl = art.value[success ? 'char_win_03' : 'char_fail_02'];
  emit('finish', {
    gameId: 'parkour',
    sessionId: props.sessionId,
    outcome: success ? 'win' : 'lose',
    durationMs: Math.round(next.realTick * FIXED_DT * 1000),
    summary: `${(next.realTick / 60).toFixed(1)} 秒 · ${score.value} 分 · ${next.rice} 碗饭 · ${next.returns} 件退回 · ${next.verified} 次核验`,
    story: {
      ...endingFor(success, next.hasAnswer, next.rice, next.returns, next.verified),
      ...(imageUrl ? { imageUrl } : {}),
    },
    stats: {
      distance: next.run.distance,
      score: score.value,
      rice: next.rice,
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
  if (!props.paused) schedule();
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
  if (!active.value || event.ctrlKey || event.metaKey || event.altKey) return;
  if (
    event.target instanceof HTMLElement &&
    event.target.closest('input, textarea, select, [contenteditable]')
  )
    return;
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
  if (props.attempt > 1) startRun();
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
        <h2>{{ department.name }}</h2>
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
        <b data-testid="runner-distance">{{ Math.floor(state.run.distance) }}</b> /
        {{ SHIFT_DISTANCE }} m
      </span>
    </div>
    <progress
      class="whale-progress"
      :value="state.run.distance"
      :max="SHIFT_DISTANCE"
      aria-label="交付进度"
    />
    <section
      class="whale-dialogue"
      :class="{ 'whale-opening': phase === 'ready' }"
      role="region"
      :aria-label="phase === 'ready' ? '开场故事' : '角色对白'"
    >
      <div class="whale-speaker">
        <img v-if="portrait" :src="portrait" alt="" width="42" height="52" />
        <MessageCircle v-else :size="25" aria-hidden="true" />
      </div>
      <div v-if="phase === 'ready'" class="whale-dialogue-copy">
        <p class="whale-request"><span>访客：</span>“{{ opening.request }}”</p>
        <h3><span class="whale-voice-name">DeepSeek 娘：</span>“{{ opening.line }}”</h3>
      </div>
      <div v-else class="whale-dialogue-copy" role="status" aria-atomic="true">
        <strong><span class="whale-voice-name">DeepSeek 娘：</span>“{{ dialogue.line }}”</strong>
        <span class="whale-tail-line">{{ dialogue.tail }}</span>
      </div>
      <button
        v-if="phase === 'ready'"
        class="primary-button whale-start"
        type="button"
        :disabled="paused"
        @click="startRun"
      >
        <Play :size="18" />{{ opening.action }}
      </button>
    </section>
    <div class="whale-stage">
      <OfficeStage
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
      <div v-if="phase === 'countdown'" class="whale-countdown" role="status">走你！</div>
    </div>
    <div class="whale-feedback-strip">
      <span class="whale-notice" :class="notice?.kind" role="status" aria-atomic="true">
        <template v-if="notice">
          <Undo2 v-if="notice.kind === 'parry' || notice.kind === 'return'" :size="14" />
          <ShieldCheck v-else-if="notice.kind === 'shield'" :size="14" />
          <Check v-else :size="14" />
          <span>{{ notice.text }}</span>
        </template>
      </span>
      <span v-if="state.dashTicks > 0" class="whale-ability burst"
        ><Zap :size="13" />大肥鱼接管中</span
      >
      <span v-else-if="state.slowTicks > 0" class="whale-ability">好球，容我想一帧</span>
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
      <span class="whale-score" data-testid="runner-score">{{ score.toLocaleString() }} 分</span>
    </div>
    <div class="whale-controls">
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
        :title="tailName"
        :aria-label="tailName"
        @click="tail"
      >
        <Zap v-if="charged" :size="23" /><Undo2 v-else :size="23" /><span>{{ tailName }}</span>
        <span v-if="charged" class="charge-dot" aria-hidden="true"></span>
      </button>
    </div>
    <div class="whale-footer">
      <span :class="{ delivered: state.context === CONTEXT_CAPACITY }">
        <ShieldCheck :size="14" />上下文 {{ state.context }} / {{ CONTEXT_CAPACITY }}
        {{ state.context === CONTEXT_CAPACITY ? '已缓存' : '' }}
      </span>
      <span class="verified-count"><Check :size="13" />核验 {{ state.verified }}</span>
      <span :class="{ delivered: state.hasAnswer }">{{
        state.hasAnswer ? '答案已取件' : '答案待取件'
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  height: 30px;
  padding-inline: 4px;
  border-bottom: 1px solid #d7e2df;
}
.whale-notice {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #4b7a69;
  font-size: 11px;
  line-height: 1.4;
}
.whale-notice > svg,
.whale-ability > svg {
  flex-shrink: 0;
}
.whale-notice.rice {
  color: #a4556d;
}
.whale-notice.return,
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
  .whale-notice,
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
