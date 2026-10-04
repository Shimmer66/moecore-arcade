<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';

const props = defineProps<{ stage: number }>();
const viewBox = computed(
  () => `${(props.stage % 4) * 384} ${Math.floor(props.stage / 4) * 216} 384 216`,
);
</script>

<template>
  <svg
    viewBox="0 0 384 216"
    preserveAspectRatio="xMidYMid slice"
    aria-hidden="true"
    :data-mission-card="stage"
  >
    <svg width="384" height="216" :viewBox="viewBox" overflow="hidden">
      <image
        :href="REWRITE_ART.missionCards.url"
        :width="REWRITE_ART.missionCards.width"
        :height="REWRITE_ART.missionCards.height"
      />
    </svg>
  </svg>
</template>
