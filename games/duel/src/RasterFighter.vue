<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DUEL_COMBAT_ART,
  DUEL_COMBAT_GEOMETRY,
  DUEL_CROUCH_ART,
  DUEL_CROUCH_GEOMETRY,
  DUEL_SWEEP_ART,
  DUEL_SWEEP_GEOMETRY,
  DUEL_MOTION_ART,
  DUEL_MOTION_GEOMETRY,
} from '@moecore/assets/duel';
import VectorFighter from './FighterSprite.vue';
import { combatPose } from './combat-pose';
import { motionFrame } from './motion-frame';
import type { Action, FighterId } from './types';
const props = withDefaults(
  defineProps<{
    id: FighterId;
    action?: Action;
    frame?: number;
    age?: number;
    facing?: number;
    reduced?: boolean;
    crouched?: boolean;
    grounded?: boolean;
    stun?: number;
  }>(),
  { action: 'idle', frame: 0, age: 0, facing: 1, reduced: false, stun: 36 },
);
const failed = ref(new Set<string>());
function imageFailed(event: Event) {
  const href = (event.target as SVGImageElement).getAttribute('href');
  if (href) failed.value = new Set([...failed.value, href]);
}
const pose = computed(() => combatPose(props.id, props.action, props.age, props.crouched));
const baseUrl = computed(() =>
  pose.value === 'sweep_hit'
    ? DUEL_SWEEP_ART
    : pose.value === 'crouch' || pose.value === 'low_hit'
      ? DUEL_CROUCH_ART
      : DUEL_COMBAT_ART[props.id][pose.value],
);
const baseGeometry = computed(() =>
  pose.value === 'sweep_hit'
    ? DUEL_SWEEP_GEOMETRY[props.id]
    : pose.value === 'crouch' || pose.value === 'low_hit'
      ? DUEL_CROUCH_GEOMETRY[props.id][pose.value]
      : DUEL_COMBAT_GEOMETRY[props.id][pose.value],
);
const sequenceFrame = computed(() =>
  motionFrame(
    props.id,
    props.action,
    props.age,
    props.reduced ? 0 : props.frame,
    props.grounded,
    props.stun,
  ),
);
const useSequence = computed(() => {
  const frame = sequenceFrame.value;
  return (
    frame !== null &&
    Boolean(DUEL_MOTION_GEOMETRY[props.id][frame]) &&
    !failed.value.has(DUEL_MOTION_ART[props.id])
  );
});
const url = computed(() => (useSequence.value ? DUEL_MOTION_ART[props.id] : baseUrl.value));
const geometry = computed(() =>
  useSequence.value ? DUEL_MOTION_GEOMETRY[props.id][sequenceFrame.value!]! : baseGeometry.value,
);
const bounce = computed(() =>
  props.reduced || !['idle', 'walk'].includes(props.action)
    ? 0
    : Math.sin(props.frame * (props.action === 'walk' ? 0.5 : 0.1)) * 1.2,
);
</script>
<template>
  <VectorFighter
    v-if="failed.has(url)"
    :id="id"
    :action="action"
    :frame="frame"
    :age="age"
    :facing="facing"
    :reduced="reduced"
    :crouched="crouched ?? false"
  />
  <g
    v-else
    :data-character="id"
    :data-pose="pose"
    :data-motion-frame="useSequence ? sequenceFrame : undefined"
    data-renderer="raster"
    :transform="`scale(${facing},1) translate(0,${bounce})`"
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
        @error="imageFailed"
      />
    </svg>
  </g>
</template>
