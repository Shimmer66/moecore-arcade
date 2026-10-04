<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';

type EnemyState = 'idle' | 'attack' | 'hit' | 'defeated';
const props = defineProps<{ kind: string; state?: EnemyState }>();

const ground = ['runner', 'turret', 'hopper'];
const air = ['drone', 'sniper', 'firewall'];
const states: EnemyState[] = ['idle', 'attack', 'hit', 'defeated'];
const atlas = computed(() =>
  ground.includes(props.kind) ? REWRITE_ART.enemyMotion.ground : REWRITE_ART.enemyMotion.air,
);
const row = computed(() => {
  const collection = ground.includes(props.kind) ? ground : air;
  return Math.max(0, collection.indexOf(props.kind));
});
const column = computed(() => Math.max(0, states.indexOf(props.state ?? 'idle')));
const viewBox = computed(() => `${column.value * 384} ${row.value * 384} 384 384`);
</script>

<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    :data-enemy-art="kind"
    :data-enemy-state="state ?? 'idle'"
  >
    <svg width="100" height="100" :viewBox="viewBox" overflow="hidden">
      <image :href="atlas.url" :width="atlas.width" :height="atlas.height" />
    </svg>
  </svg>
</template>
