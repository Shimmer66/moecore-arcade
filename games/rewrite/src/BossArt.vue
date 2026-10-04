<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';

type BossState = 'idle' | 'phase' | 'hit' | 'defeated';
const props = defineProps<{ stage: number; state?: BossState }>();
const state = computed(() => props.state ?? 'idle');
const atlas = computed(() =>
  state.value === 'phase'
    ? REWRITE_ART.bossPhase
    : state.value === 'idle'
      ? REWRITE_ART.bossAtlas
      : REWRITE_ART.bossReaction,
);
const viewBox = computed(() => {
  const column = props.stage % 4;
  const row = Math.floor(props.stage / 4);
  if (state.value === 'idle') {
    const size = REWRITE_ART.bossAtlas.width / 4;
    return `${column * size} ${row * size} ${size} ${size}`;
  }
  if (state.value === 'phase') return `${column * 384} ${row * 384} 384 384`;
  const reactionRow = state.value === 'hit' ? row : row + 2;
  return `${column * 384} ${reactionRow * 384} 384 384`;
});
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    :data-boss-art="stage"
    :data-boss-state="state"
  >
    <svg width="100" height="100" :viewBox="viewBox" overflow="hidden">
      <image :href="atlas.url" :width="atlas.width" :height="atlas.height" />
    </svg>
  </svg>
</template>
