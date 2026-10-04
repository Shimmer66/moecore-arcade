<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{
  art: {
    url: string;
    width: number;
    height: number;
    anchorX: number;
    baseline: number;
    visibleHeight: number;
    crop?: string;
    sourceWidth?: number;
    sourceHeight?: number;
  };
}>();
const scale = computed(() => 72 / props.art.visibleHeight);
</script>

<template>
  <svg
    :x="-art.anchorX * scale"
    :y="-art.baseline * scale"
    :width="art.width * scale"
    :height="art.height * scale"
    :viewBox="art.crop ?? `0 0 ${art.width} ${art.height}`"
    preserveAspectRatio="none"
    overflow="hidden"
    aria-hidden="true"
  >
    <image
      :href="art.url"
      :width="art.sourceWidth ?? art.width"
      :height="art.sourceHeight ?? art.height"
    />
  </svg>
</template>
