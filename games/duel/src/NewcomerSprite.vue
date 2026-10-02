<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DUEL_NEWCOMER_ART,
  DUEL_NEWCOMER_PIVOTS,
  DUEL_NEWCOMER_MOTION,
  DUEL_NEWCOMER_GEOMETRY,
} from '@moecore/assets/duel';
import { ROSTER } from './moves';
import { newcomerFrame } from './newcomer-frame';
import type { Action, NewcomerId, SuperTier } from './types';
const props = withDefaults(
  defineProps<{
    id: NewcomerId;
    action?: Action;
    age?: number;
    frame?: number;
    facing?: number;
    crouched?: boolean;
    reduced?: boolean;
    grounded?: boolean;
    stun?: number;
    vy?: number;
    landing?: boolean;
    enhanced?: boolean;
    superTier?: SuperTier;
  }>(),
  {
    action: 'idle',
    age: 0,
    frame: 0,
    facing: 1,
    crouched: false,
    reduced: false,
    grounded: true,
    stun: 36,
    vy: 0,
    landing: false,
    enhanced: false,
    superTier: 1,
  },
);
const failed = ref(new Set<string>());
const selected = computed(() =>
  newcomerFrame(
    props.id,
    props.action,
    props.age,
    props.frame,
    props.grounded,
    props.stun,
    props.vy,
    props.crouched,
    props.reduced,
    props.landing,
    props.enhanced,
    props.superTier,
  ),
);
const sequenceUrl = computed(() => DUEL_NEWCOMER_MOTION[props.id][selected.value.sheet]);
const sequenceAvailable = computed(() => !failed.value.has(sequenceUrl.value));
const fallbackPose = computed(() =>
  ['hurt', 'down', 'launched', 'grabbed', 'guardBreak'].includes(props.action)
    ? 4
    : ['guard', 'block', 'crouch', 'roll'].includes(props.action)
      ? 3
      : ['meme', 'super', 'skill', 'throwing'].includes(props.action)
        ? 5
        : [
              'kick',
              'lightKick',
              'crouchKick',
              'sweep',
              'air',
              'airHeavy',
              'airLightKick',
              'airKick',
              'light3',
            ].includes(props.action)
          ? 2
          : [
                'light1',
                'light2',
                'heavy',
                'closeHeavy',
                'upper',
                'low',
                'variant',
                'throw',
              ].includes(props.action)
            ? 1
            : 0,
);
const url = computed(() =>
  sequenceAvailable.value ? sequenceUrl.value : DUEL_NEWCOMER_ART[props.id],
);
const geometry = computed(() => {
  if (sequenceAvailable.value)
    return DUEL_NEWCOMER_GEOMETRY[props.id][selected.value.sheet][selected.value.index]!;
  const index = fallbackPose.value,
    pivot = DUEL_NEWCOMER_PIVOTS[props.id][index]!,
    scale = props.id === 'prompt_sage' ? 0.37 : 0.42;
  return {
    x: -pivot[0] * scale,
    y: -pivot[1] * scale,
    width: 512 * scale,
    height: 512 * scale,
    viewBox: [(index % 3) * 512, Math.floor(index / 3) * 512, 512, 512].join(' '),
    sourceWidth: 1536,
    sourceHeight: 1024,
  };
});
function imageFailed(event: Event) {
  const href = (event.target as SVGImageElement).getAttribute('href');
  if (href) failed.value = new Set([...failed.value, href]);
}
</script>
<template>
  <g
    :data-character="id"
    :data-newcomer-pose="fallbackPose"
    :data-motion-sheet="sequenceAvailable ? selected.sheet : undefined"
    :data-motion-frame="sequenceAvailable ? selected.index : undefined"
    :data-renderer="sequenceAvailable ? 'newcomer-motion' : 'newcomer-atlas'"
    :transform="'scale(' + facing + ',1)'"
  >
    <svg
      v-if="!failed.has(url)"
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
    <g v-else :fill="ROSTER[id].color" stroke="#182038" stroke-width="3">
      <circle cy="-110" r="24" /><path
        d="M-26-82H26L32-29H-30Z M-19-29-26 0 M19-29 26 0"
        stroke-width="12"
      />
      <text y="-52" text-anchor="middle" stroke="none" fill="#182038" font-size="16">
        {{ ROSTER[id].short }}
      </text>
    </g>
  </g>
</template>
