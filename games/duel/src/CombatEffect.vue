<script setup lang="ts">
import { ref } from 'vue';
import { DUEL_COMBAT_FX } from '@moecore/assets/duel';
withDefaults(
  defineProps<{
    kind: keyof typeof DUEL_COMBAT_FX;
    width?: number;
    height?: number;
    facing?: number;
  }>(),
  { width: 100, height: 100, facing: 1 },
);
const failed = ref(false);
</script>
<template>
  <g :data-effect-art="kind" :transform="`scale(${facing},1)`" aria-hidden="true">
    <image
      v-if="!failed"
      :href="DUEL_COMBAT_FX[kind]"
      :x="-width / 2"
      :y="-height / 2"
      :width="width"
      :height="height"
      @error="failed = true"
    />
    <circle v-else :r="width / 4" fill="none" stroke="#a5e8ff" stroke-width="3" />
  </g>
</template>
