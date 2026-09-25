<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { Gamepad2, House, Sparkles } from '@lucide/vue';
import { createRefractionMap } from './refraction';

const props = defineProps<{ activeSection: 'home' | 'games' | 'about' }>();
const emit = defineEmits<{ select: [section: 'home' | 'games' | 'about'] }>();
const items = [
  { id: 'home', label: '首页', icon: House },
  { id: 'games', label: '小游戏', icon: Gamepad2 },
  { id: 'about', label: '加入共创', icon: Sparkles },
] as const;
const dock = ref<HTMLElement>();
const opticsId = useId();
const shellMap = ref('');
const tabMap = ref('');
let resizeObserver: ResizeObserver | undefined;
let mapSize = '';
const activeIndex = computed(() => items.findIndex((item) => item.id === props.activeSection));
const position = ref(activeIndex.value);
const dragging = ref(false);
const sliding = ref(false);
const stretch = ref(1);
const lean = ref(0);
const previewIndex = computed(() => Math.round(position.value));
let suppressClick = false;
let pointer:
  | {
      id: number;
      startX: number;
      previousX: number;
      firstCenter: number;
      step: number;
      top: number;
      bottom: number;
    }
  | undefined;

function links() {
  return [...(dock.value?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
}

function updateOptics() {
  const shell = dock.value;
  const lens = shell?.querySelector<HTMLElement>('.dock-lens');
  if (!shell || !lens) return;
  const size = `${shell.offsetWidth}:${shell.offsetHeight}:${lens.offsetWidth}:${lens.offsetHeight}`;
  if (mapSize === size) return;
  mapSize = size;
  shellMap.value = createRefractionMap(shell.offsetWidth, shell.offsetHeight, 38, 10);
  tabMap.value = createRefractionMap(lens.offsetWidth, lens.offsetHeight, 30, 13);
}

function finishGesture(index = activeIndex.value) {
  const pointerId = pointer?.id;
  pointer = undefined;
  dragging.value = sliding.value = false;
  stretch.value = 1;
  lean.value = 0;
  position.value = index;
  if (pointerId !== undefined && dock.value?.hasPointerCapture(pointerId)) {
    dock.value.releasePointerCapture(pointerId);
  }
}

function select(index: number) {
  position.value = index;
  emit('select', items[index]!.id);
}

function onPointerDown(event: PointerEvent) {
  if (
    !event.isPrimary ||
    event.button !== 0 ||
    pointer ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  // The rail is a stationary glass container; only its tabs begin a gesture.
  if (!(event.target instanceof Element) || !event.target.closest('.dock-tab')) return;
  const tabs = links();
  const first = tabs[0]?.getBoundingClientRect();
  const second = tabs[1]?.getBoundingClientRect();
  if (!dock.value || !first || !second) return;
  const rect = dock.value.getBoundingClientRect();
  pointer = {
    id: event.pointerId,
    startX: event.clientX,
    previousX: event.clientX,
    firstCenter: first.left + first.width / 2,
    step: second.left + second.width / 2 - first.left - first.width / 2,
    top: rect.top,
    bottom: rect.bottom,
  };
  suppressClick = false;
  dragging.value = true;
  stretch.value = 1.035;
  position.value = Math.round(
    Math.max(0, Math.min(2, (event.clientX - pointer.firstCenter) / pointer.step)),
  );
  dock.value.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!pointer || event.pointerId !== pointer.id) return;
  if (Math.abs(event.clientX - pointer.startX) > 5) sliding.value = true;
  if (!sliding.value) return;
  position.value = Math.max(0, Math.min(2, (event.clientX - pointer.firstCenter) / pointer.step));
  const movement = event.clientX - pointer.previousX;
  stretch.value = 1.035 + Math.abs(Math.sin(position.value * Math.PI)) * 0.12;
  lean.value = Math.max(-5, Math.min(5, movement * 0.3));
  pointer.previousX = event.clientX;
}

function onPointerUp(event: PointerEvent) {
  if (!pointer || event.pointerId !== pointer.id) return;
  // Releasing far above/below the dock cancels an accidental gesture.
  if (event.clientY < pointer.top - 48 || event.clientY > pointer.bottom + 48) {
    cancelGesture();
    return;
  }
  onPointerMove(event);
  const index = previewIndex.value;
  suppressClick = true;
  finishGesture(index);
  links()[index]?.focus({ preventScroll: true });
  select(index);
}

function cancelGesture() {
  if (!pointer) return;
  suppressClick = true;
  finishGesture();
}

function onPointerCancel(event: PointerEvent) {
  if (pointer?.id === event.pointerId) cancelGesture();
}

function onClick(event: MouseEvent) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (suppressClick && event.detail > 0) {
    event.preventDefault();
    suppressClick = false;
    return;
  }
  const link = event.target instanceof Element ? event.target.closest('a') : null;
  const index = links().findIndex((item) => item === link);
  if (index < 0) return;
  event.preventDefault();
  select(index);
}

function onKeyDown(event: KeyboardEvent, index: number) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  if (event.key === 'Escape' && pointer) {
    event.preventDefault();
    cancelGesture();
    return;
  }
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % items.length
      : event.key === 'ArrowLeft'
        ? (index + items.length - 1) % items.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? items.length - 1
            : undefined;
  if (next === undefined) return;
  event.preventDefault();
  links()[next]?.focus({ preventScroll: true });
}

function onVisibilityChange() {
  if (document.hidden) cancelGesture();
}

watch(activeIndex, () => finishGesture());
onMounted(() => {
  resizeObserver = new ResizeObserver(updateOptics);
  if (dock.value) resizeObserver.observe(dock.value);
  updateOptics();
  window.addEventListener('blur', cancelGesture);
  window.addEventListener('resize', cancelGesture);
  document.addEventListener('visibilitychange', onVisibilityChange);
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  finishGesture();
  window.removeEventListener('blur', cancelGesture);
  window.removeEventListener('resize', cancelGesture);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
  <nav
    ref="dock"
    class="site-nav home-dock"
    :class="{ 'is-dragging': dragging, 'is-sliding': sliding }"
    :style="{
      '--dock-position': position,
      '--dock-stretch': stretch,
      '--dock-lean': `${lean}deg`,
      '--dock-light': `${50 + (position - previewIndex) * 40}%`,
      '--dock-shell-refraction': shellMap ? `url(#${opticsId}-shell)` : 'blur(0px)',
      '--dock-tab-refraction': tabMap ? `url(#${opticsId}-tab)` : 'blur(0px)',
    }"
    aria-label="主导航"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @lostpointercapture="onPointerCancel"
    @click="onClick"
    @dragstart.prevent
  >
    <svg class="dock-optics" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter
          :id="`${opticsId}-shell`"
          x="0"
          y="0"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="shellMap"
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="displacement"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            scale="28"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter
          :id="`${opticsId}-tab`"
          x="0"
          y="0"
          width="100%"
          height="100%"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="tabMap"
            x="0"
            y="0"
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            result="displacement"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            :scale="dragging ? 34 : 28"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
    <span class="dock-shell" aria-hidden="true"></span>
    <span class="dock-indicator" aria-hidden="true"><span class="dock-lens"></span></span>
    <a
      v-for="(item, index) in items"
      :key="item.id"
      class="dock-tab"
      :class="{ 'dock-current': activeIndex === index, 'dock-preview': previewIndex === index }"
      :href="`#${item.id}`"
      :aria-current="activeIndex === index ? 'location' : undefined"
      :draggable="false"
      @keydown="onKeyDown($event, index)"
    >
      <component :is="item.icon" :size="22" :stroke-width="1.7" aria-hidden="true" />
      <span>{{ item.label }}</span>
    </a>
  </nav>
</template>
