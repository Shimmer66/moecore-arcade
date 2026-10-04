<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';

const props = defineProps<{ stage: number }>();
const viewBox = computed(
  () => `${(props.stage % 4) * 256} ${Math.floor(props.stage / 4) * 256} 256 256`,
);
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    :data-stage-meme="stage"
  >
    <svg width="100" height="100" :viewBox="viewBox" overflow="hidden">
      <image
        :href="REWRITE_ART.memeProps.url"
        :width="REWRITE_ART.memeProps.width"
        :height="REWRITE_ART.memeProps.height"
      />
    </svg>
  </svg>
</template>
