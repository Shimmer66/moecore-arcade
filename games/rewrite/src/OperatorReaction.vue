<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import type { Persona } from './rules';

type Reaction = 'hit' | 'pickup' | 'boss' | 'victory';
const props = defineProps<{ persona: Persona; reaction: Reaction }>();
const personas: Persona[] = ['deepseek', 'gpt', 'claude'];
const reactions: Reaction[] = ['hit', 'pickup', 'boss', 'victory'];
const viewBox = computed(
  () =>
    `${reactions.indexOf(props.reaction) * 256} ${personas.indexOf(props.persona) * 256} 256 256`,
);
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    role="img"
    :aria-label="`${persona} ${reaction}`"
    :data-operator-reaction="reaction"
    :data-persona="persona"
  >
    <svg width="100" height="100" :viewBox="viewBox" overflow="hidden">
      <image
        :href="REWRITE_ART.operatorReaction.url"
        :width="REWRITE_ART.operatorReaction.width"
        :height="REWRITE_ART.operatorReaction.height"
      />
    </svg>
  </svg>
</template>
