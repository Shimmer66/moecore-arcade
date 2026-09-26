<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { createRefractionMap } from './refraction';

const props = defineProps<{ interactive?: boolean }>();
const surface = ref<HTMLElement>();
const opticsId = useId();
const displacement = ref('');
const filterSize = ref({ width: 0, height: 0 });
let observer: ResizeObserver | undefined;
let host: HTMLElement | null = null;
let previousSize = '';

function updateOptics() {
  const element = surface.value;
  if (!element || !element.offsetWidth || !element.offsetHeight) return;
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0;
  const size = `${width}:${height}:${radius}`;
  if (size === previousSize) return;
  previousSize = size;
  // feImage percentages resolve against the zero-size SVG in Chromium's backdrop
  // pipeline. Explicit CSS pixels keep the neutral center from shifting the scene.
  filterSize.value = { width, height };
  // Bound map generation for large/fullscreen panels; the filter scales it to fit.
  const ratio = Math.min(1, 768 / Math.max(width, height));
  displacement.value = createRefractionMap(
    width * ratio,
    height * ratio,
    radius * ratio,
    (props.interactive ? 12 : 20) * ratio,
  );
}

function moveLight(event: PointerEvent) {
  if (!host || !surface.value) return;
  const rect = host.getBoundingClientRect();
  surface.value.style.setProperty(
    '--lens-light-x',
    `${((event.clientX - rect.left) / rect.width) * 100}%`,
  );
  surface.value.style.setProperty(
    '--lens-light-y',
    `${((event.clientY - rect.top) / rect.height) * 100}%`,
  );
}

function resetLight() {
  surface.value?.style.removeProperty('--lens-light-x');
  surface.value?.style.removeProperty('--lens-light-y');
}

onMounted(() => {
  host = surface.value?.parentElement ?? null;
  observer = new ResizeObserver(updateOptics);
  if (surface.value) observer.observe(surface.value);
  updateOptics();
  if (props.interactive) {
    host?.addEventListener('pointermove', moveLight, { passive: true });
    host?.addEventListener('pointerleave', resetLight);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  host?.removeEventListener('pointermove', moveLight);
  host?.removeEventListener('pointerleave', resetLight);
});
</script>

<template>
  <span
    ref="surface"
    class="liquid-surface"
    :class="{ 'liquid-surface-interactive': interactive }"
    :style="{ '--surface-refraction': displacement ? `url(#${opticsId})` : 'blur(0px)' }"
    aria-hidden="true"
  >
    <svg width="0" height="0" focusable="false">
      <defs>
        <filter
          :id="opticsId"
          x="0"
          y="0"
          width="100%"
          height="100%"
          primitiveUnits="userSpaceOnUse"
          color-interpolation-filters="sRGB"
        >
          <feImage
            :href="displacement"
            x="0"
            y="0"
            :width="filterSize.width"
            :height="filterSize.height"
            preserveAspectRatio="none"
            result="displacement"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            :scale="interactive ? 32 : 42"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  </span>
</template>

<style scoped>
.liquid-surface {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    145deg,
    rgb(248 253 255 / var(--surface-tint, 8%)),
    rgb(220 241 255 / var(--surface-tint, 8%))
  );
  box-shadow:
    0 12px 32px rgb(25 65 103 / 12%),
    inset 0 2px 1px rgb(255 255 255 / 90%),
    inset 2px 0 1px rgb(255 255 255 / 48%),
    inset 0 -2px 1px rgb(43 90 134 / 28%),
    inset -1px 0 2px rgb(92 151 193 / 22%);
  backdrop-filter: blur(2px) saturate(1.12);
  -webkit-backdrop-filter: blur(2px) saturate(1.12);
  backdrop-filter: var(--surface-refraction) blur(var(--surface-blur, 0.35px)) saturate(1.12);
  -webkit-backdrop-filter: var(--surface-refraction) blur(var(--surface-blur, 0.35px))
    saturate(1.12);
}
.liquid-surface > svg {
  position: absolute;
}
.liquid-surface::before,
.liquid-surface::after {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  content: '';
}
.liquid-surface::before {
  background: radial-gradient(
    ellipse at var(--lens-light-x, 24%) var(--lens-light-y, 0%),
    rgb(255 255 255 / 45%),
    transparent 58%
  );
  mask-image: linear-gradient(#000, transparent 16%, transparent 84%, #000);
}
.liquid-surface::after {
  inset: 1px;
  border: 1px solid rgb(255 255 255 / 40%);
  border-right-color: rgb(152 181 240 / 34%);
  border-bottom-color: rgb(78 136 179 / 20%);
}
.liquid-surface-interactive {
  --surface-tint: 4%;
  --surface-blur: 0px;
  transition: transform 420ms cubic-bezier(0.2, 0.9, 0.25, 1.4);
}
button:hover > .liquid-surface-interactive,
button:focus-visible > .liquid-surface-interactive {
  transform: scale(1.045, 1.075);
}
button:active > .liquid-surface-interactive {
  transform: scale(0.96, 0.94);
}
@media (prefers-reduced-motion: reduce) {
  .liquid-surface-interactive {
    --lens-light-x: 24% !important;
    --lens-light-y: 0% !important;
    transform: none !important;
    transition: none;
  }
}
@media (forced-colors: active) {
  .liquid-surface {
    border: 1px solid ButtonText;
    background: Canvas;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    box-shadow: none;
  }
  .liquid-surface::before,
  .liquid-surface::after {
    display: none;
  }
}
</style>
