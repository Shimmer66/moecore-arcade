<script lang="ts">
type Activity = 'journey' | 'runner' | 'rhythm' | 'flight';
// Client-only SPA memory survives the host's per-attempt component remount.
let inMemoryActivity: Activity = 'journey';
</script>

<script setup lang="ts">
import { ref } from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import ParkourGame from './ParkourGame.vue';
import RhythmGame from './RhythmGame.vue';
import FlightGame from './FlightGame.vue';
import JourneyGame from './JourneyGame.vue';
const props = withDefaults(defineProps<GameProps>(), { restartMode: 'replay' });
const emit = defineEmits<GameEvents>();
const activity = ref<Activity>(
  props.attempt <= 1
    ? 'journey'
    : props.restartMode === 'select'
      ? inMemoryActivity === 'journey'
        ? 'journey'
        : 'runner'
      : inMemoryActivity,
);
const entryMode = ref(props.restartMode);
try {
  const saved = sessionStorage.getItem('moecore:parkour:activity');
  if (
    props.attempt > 1 &&
    props.restartMode !== 'select' &&
    (saved === 'journey' || saved === 'runner' || saved === 'rhythm' || saved === 'flight')
  )
    activity.value = saved;
} catch {
  /* A retry retains this page's last choice when storage is unavailable. */
}
function rememberActivity(value: Activity) {
  activity.value = value;
  inMemoryActivity = value;
  try {
    sessionStorage.setItem('moecore:parkour:activity', value);
  } catch {
    /* Page memory also survives a retry's component remount. */
  }
}
function selectActivity(value: Activity) {
  entryMode.value = 'select';
  rememberActivity(value);
}
rememberActivity(activity.value);
</script>

<template>
  <JourneyGame
    v-if="activity === 'journey'"
    v-bind="props"
    :restart-mode="entryMode"
    @practice="selectActivity('runner')"
    @finish="emit('finish', $event)"
  />
  <RhythmGame
    v-else-if="activity === 'rhythm'"
    v-bind="props"
    :restart-mode="entryMode"
    @back="selectActivity('runner')"
    @finish="emit('finish', $event)"
  />
  <FlightGame
    v-else-if="activity === 'flight'"
    v-bind="props"
    :restart-mode="entryMode"
    @back="selectActivity('runner')"
    @finish="emit('finish', $event)"
  />
  <ParkourGame
    v-else
    v-bind="props"
    :restart-mode="entryMode"
    @journey="selectActivity('journey')"
    @rhythm="selectActivity('rhythm')"
    @flight="selectActivity('flight')"
    @finish="emit('finish', $event)"
    @exit="emit('exit')"
  />
</template>
