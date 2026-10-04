<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';

const props = defineProps<{ stage: number; propIndex: number }>();
const atlas = computed(() => REWRITE_ART.stageProps[Math.floor(props.stage / 2)]!);
const viewBox = computed(() => `${(props.propIndex % 4) * 256} ${(props.stage % 2) * 256} 256 256`);
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    :data-stage-prop="`${stage}-${propIndex}`"
  >
    <svg width="100" height="100" :viewBox="viewBox" overflow="hidden">
      <image :href="atlas.url" :width="atlas.width" :height="atlas.height" />
    </svg>
  </svg>
</template>
