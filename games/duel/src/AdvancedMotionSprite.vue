<script setup lang="ts">
import { computed } from 'vue';
import {
  DUEL_ADVANCED_GEOMETRY,
  DUEL_ADVANCED_MOTION,
  DUEL_NORMAL_GEOMETRY,
  DUEL_NORMAL_MOTION,
  DUEL_GRAPPLE_GEOMETRY,
  DUEL_GRAPPLE_MOTION,
  DUEL_SIGNATURE_GEOMETRY,
  DUEL_SIGNATURE_MOTION,
} from '@moecore/assets/duel';
import type { FighterId } from './types';
const props = withDefaults(
  defineProps<{
    id: FighterId;
    frame: number;
    facing: number;
    family?: 'advanced' | 'normal' | 'grapple' | 'signature';
  }>(),
  { family: 'advanced' },
);
const emit = defineEmits<{ unavailable: [id: FighterId] }>();
const url = computed(() =>
  props.family === 'grapple'
    ? DUEL_GRAPPLE_MOTION.gpt
    : props.family === 'signature'
      ? props.id === 'doubao'
        ? DUEL_SIGNATURE_MOTION.doubao
        : props.id === 'client'
          ? DUEL_SIGNATURE_MOTION.client
          : props.id === 'prompt_sage'
            ? DUEL_SIGNATURE_MOTION.prompt_sage
            : props.id === 'unplug_uncle'
              ? DUEL_SIGNATURE_MOTION.unplug_uncle
              : DUEL_SIGNATURE_MOTION.deepseek
      : (props.family === 'normal' ? DUEL_NORMAL_MOTION : DUEL_ADVANCED_MOTION)[props.id],
);
const geometry = computed(
  () =>
    (props.family === 'grapple'
      ? DUEL_GRAPPLE_GEOMETRY.gpt
      : props.family === 'signature'
        ? props.id === 'doubao'
          ? DUEL_SIGNATURE_GEOMETRY.doubao
          : props.id === 'client'
            ? DUEL_SIGNATURE_GEOMETRY.client
            : props.id === 'prompt_sage'
              ? DUEL_SIGNATURE_GEOMETRY.prompt_sage
              : props.id === 'unplug_uncle'
                ? DUEL_SIGNATURE_GEOMETRY.unplug_uncle
                : DUEL_SIGNATURE_GEOMETRY.deepseek
        : (props.family === 'normal' ? DUEL_NORMAL_GEOMETRY : DUEL_ADVANCED_GEOMETRY)[props.id])[
      props.frame
    ]!,
);
</script>
<template>
  <g
    :data-renderer="`${family}-motion`"
    :data-character="id"
    :data-advanced-frame="family === 'advanced' ? frame : undefined"
    :data-normal-frame="family === 'normal' ? frame : undefined"
    :data-motion-sheet="family"
    :data-motion-frame="frame"
    :transform="`scale(${facing},1)`"
  >
    <svg
      v-memo="[url, geometry]"
      :x="geometry.x"
      :y="geometry.y"
      :width="geometry.width"
      :height="geometry.height"
      :viewBox="geometry.viewBox"
      overflow="hidden"
      aria-hidden="true"
    >
      <image
        :href="url"
        :width="geometry.sourceWidth"
        :height="geometry.sourceHeight"
        @error="emit('unavailable', id)"
      />
    </svg>
  </g>
</template>
