<script setup lang="ts">
import { computed, onErrorCaptured, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { ArrowLeft, Maximize2, Minimize2, Pause, Play, RotateCcw, X } from '@lucide/vue';
import type { GameDefinition, GameResult } from '@moecore/game-sdk';
import { findGame } from './registry';

const props = defineProps<{ gameId: string }>();
const emit = defineEmits<{ exit: [] }>();
const definition = shallowRef<GameDefinition>();
const error = ref('');
const loading = ref(false);
const sessionId = ref('');
const attempt = ref(0);
const manuallyPaused = ref(false);
const autoPaused = ref(false);
const result = shallowRef<GameResult>();
const confirmation = ref<HTMLDialogElement>();
const pendingAction = ref<'restart' | 'exit'>();
const reduceMotion = ref(false);
const gameHost = ref<HTMLElement>();
const fullscreen = ref(false);
const fullscreenSupported = ref(false);
const paused = computed(
  () =>
    manuallyPaused.value ||
    autoPaused.value ||
    Boolean(result.value) ||
    Boolean(pendingAction.value),
);
const settings = computed(() => ({ masterVolume: 1, reduceMotion: reduceMotion.value }));
let loadRevision = 0;

function restart() {
  attempt.value += 1;
  result.value = undefined;
  manuallyPaused.value = false;
  autoPaused.value = document.hidden;
  sessionId.value = crypto.randomUUID();
}

async function load() {
  const revision = ++loadRevision;
  definition.value = undefined;
  error.value = '';
  loading.value = true;
  result.value = undefined;
  const entry = findGame(props.gameId);
  try {
    if (!entry) throw new Error('Unknown game');
    const game = await entry.load();
    if (revision !== loadRevision) return;
    if (game.id !== entry.id) throw new Error('Game ID does not match the registry');
    attempt.value = 0;
    restart();
    definition.value = game;
  } catch {
    if (revision === loadRevision) error.value = '游戏加载失败';
  } finally {
    if (revision === loadRevision) loading.value = false;
  }
}

watch(() => props.gameId, load, { immediate: true });
onErrorCaptured(() => {
  error.value = '游戏运行中断';
  definition.value = undefined;
  return false;
});

function finish(value: GameResult) {
  if (result.value || value.sessionId !== sessionId.value || value.gameId !== props.gameId) return;
  result.value = value;
}

function requestAction(action: 'restart' | 'exit') {
  if (!definition.value || result.value) {
    if (action === 'exit') emit('exit');
    else restart();
    return;
  }
  pendingAction.value = action;
  confirmation.value?.showModal();
}

function cancelAction() {
  pendingAction.value = undefined;
  confirmation.value?.close();
}

function confirmAction() {
  const action = pendingAction.value;
  cancelAction();
  if (action === 'restart') restart();
  else if (action === 'exit') emit('exit');
}

function resume() {
  manuallyPaused.value = false;
  autoPaused.value = false;
}

function reload() {
  window.location.reload();
}

function syncFullscreen() {
  fullscreen.value = document.fullscreenElement === gameHost.value;
}

async function toggleFullscreen() {
  const host = gameHost.value;
  if (!host) return;

  try {
    if (document.fullscreenElement === host) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      await host.requestFullscreen();
    }
  } catch {
    syncFullscreen();
  }
}

function pauseForBackground() {
  if (definition.value && !result.value) autoPaused.value = true;
}

function visibilityChanged() {
  if (document.hidden) pauseForBackground();
}

onMounted(() => {
  reduceMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  fullscreenSupported.value = Boolean(
    document.fullscreenEnabled && gameHost.value?.requestFullscreen,
  );
  syncFullscreen();
  window.addEventListener('blur', pauseForBackground);
  document.addEventListener('visibilitychange', visibilityChanged);
  document.addEventListener('fullscreenchange', syncFullscreen);
});
onUnmounted(() => {
  loadRevision += 1;
  confirmation.value?.close();
  window.removeEventListener('blur', pauseForBackground);
  document.removeEventListener('visibilitychange', visibilityChanged);
  document.removeEventListener('fullscreenchange', syncFullscreen);
});
</script>

<template>
  <section ref="gameHost" class="game-host">
    <div class="game-toolbar">
      <div class="game-heading">
        <button
          type="button"
          class="icon-button"
          title="返回游戏列表"
          aria-label="返回游戏列表"
          @click="requestAction('exit')"
        >
          <ArrowLeft :size="20" />
        </button>
        <h1>{{ definition?.title ?? findGame(gameId)?.title ?? '未找到游戏' }}</h1>
      </div>
      <div class="game-actions">
        <label class="motion-toggle"
          ><input v-model="reduceMotion" type="checkbox" />减少动态效果</label
        >
        <button
          type="button"
          class="icon-button"
          :disabled="!definition || !!result"
          title="暂停"
          aria-label="暂停"
          @click="manuallyPaused = true"
        >
          <Pause :size="20" />
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="!definition"
          title="重新开始"
          aria-label="重新开始"
          @click="requestAction('restart')"
        >
          <RotateCcw :size="20" />
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="!definition || !fullscreenSupported"
          :title="fullscreen ? '退出全屏' : '全屏'"
          :aria-label="fullscreen ? '退出全屏' : '全屏'"
          :aria-pressed="fullscreen"
          @click="toggleFullscreen"
        >
          <Minimize2 v-if="fullscreen" :size="20" />
          <Maximize2 v-else :size="20" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="host-state" role="status">正在加载游戏…</div>
    <div v-else-if="error" class="host-state" role="alert">
      <h2>{{ error }}</h2>
      <button class="primary-button" type="button" @click="reload">重新加载</button>
    </div>
    <div v-else-if="definition" class="game-stage">
      <div :inert="paused" :aria-hidden="paused ? true : undefined">
        <component
          :is="definition.component"
          :key="sessionId"
          :session-id="sessionId"
          :attempt="attempt"
          :paused="paused"
          :settings="settings"
          @finish="finish"
          @exit="requestAction('exit')"
        />
      </div>
      <div
        v-if="result"
        class="stage-overlay"
        role="region"
        aria-label="对局结算"
        aria-live="polite"
      >
        <img
          v-if="result.story?.imageUrl"
          class="story-ending-image"
          :src="result.story.imageUrl"
          alt=""
          width="136"
          height="136"
        />
        <h2>{{ result.story?.title ?? (result.outcome === 'win' ? '挑战完成！' : '本局结束') }}</h2>
        <p v-if="result.story" class="story-ending">{{ result.story.body }}</p>
        <p>{{ result.summary }}</p>
        <button class="primary-button" type="button" @click="restart">
          <RotateCcw :size="18" />再来一局
        </button>
        <button class="text-button" type="button" @click="emit('exit')">返回游戏列表</button>
      </div>
      <div
        v-else-if="paused && !pendingAction"
        class="stage-overlay"
        role="region"
        aria-label="暂停菜单"
      >
        <Pause :size="32" />
        <h2>已暂停</h2>
        <button class="primary-button" type="button" @click="resume">
          <Play :size="18" />继续游戏
        </button>
      </div>
    </div>

    <dialog
      ref="confirmation"
      class="confirm-dialog"
      @cancel.prevent="cancelAction"
      @close="pendingAction = undefined"
    >
      <div class="dialog-heading">
        <h2>{{ pendingAction === 'restart' ? '重新开始？' : '离开本局？' }}</h2>
        <button
          class="icon-button"
          type="button"
          title="取消"
          aria-label="取消"
          @click="cancelAction"
        >
          <X :size="18" />
        </button>
      </div>
      <p>本局进度不会保留。</p>
      <div class="dialog-actions">
        <button class="text-button" type="button" autofocus @click="cancelAction">继续本局</button
        ><button class="primary-button" type="button" @click="confirmAction">确认</button>
      </div>
    </dialog>
  </section>
</template>
