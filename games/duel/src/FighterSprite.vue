<script setup lang="ts">
import { computed } from 'vue';
import { moveFor, ROSTER } from './moves';
import type { Action, FighterId, SuperTier } from './types';
const props = withDefaults(
  defineProps<{
    id: FighterId;
    action?: Action;
    frame?: number;
    age?: number;
    facing?: number;
    reduced?: boolean;
    crouched?: boolean;
    enhanced?: boolean;
    superTier?: SuperTier;
  }>(),
  { action: 'idle', frame: 0, age: 0, facing: 1, reduced: false, enhanced: false, superTier: 1 },
);
const palette = computed(() => ROSTER[props.id]);
const outfit = computed(() => (props.id === 'doubao' ? '#30313c' : palette.value.color));
const attacking = computed(
  () =>
    [
      'light1',
      'light2',
      'light3',
      'heavy',
      'closeHeavy',
      'lightKick',
      'crouchKick',
      'airLightKick',
      'airKick',
      'blowback',
      'airBlowback',
      'guardCounter',
      'upper',
      'air',
      'airHeavy',
      'kick',
      'sweep',
      'counter',
      'super',
      'throw',
      'throwing',
      'variant',
    ].includes(props.action) ||
    (props.id === 'gpt' && props.action === 'skill'),
);
const striking = computed(() => {
  const move = moveFor(props.id, props.action, props.enhanced, props.superTier);
  return (
    props.action === 'throwing' ||
    Boolean(move?.strikes.some((s) => props.age >= s.start && props.age < s.start + s.active + 5))
  );
});
const blocking = computed(
  () =>
    ['guard', 'block'].includes(props.action) ||
    (props.id === 'deepseek' && props.action === 'skill'),
);
const kick = computed(
  () =>
    [
      'airHeavy',
      'airLightKick',
      'airKick',
      'kick',
      'lightKick',
      'crouchKick',
      'sweep',
      'blowback',
      'airBlowback',
    ].includes(props.action) ||
    (props.id === 'deepseek' && ['light3', 'air'].includes(props.action)),
);
const kickFoot = computed(() =>
  striking.value
    ? {
        x: ['air', 'airHeavy'].includes(props.action) ? 60 : 76,
        y: ['air', 'airHeavy'].includes(props.action) ? 12 : -44,
      }
    : { x: 22, y: -24 },
);
const down = computed(() => ['down', 'grabbed'].includes(props.action));
const tilt = computed(() => {
  if (props.action === 'dash') return 24;
  if (props.action === 'launched') return -38;
  if (props.action === 'hurt' || props.action === 'guardBreak') return -16;
  if (props.action === 'jump') return -8;
  if (attacking.value) return striking.value ? (kick.value ? -16 : 14) : -12;
  return 0;
});
const rising = computed(
  () => props.action === 'upper' || (props.id === 'doubao' && props.action === 'variant'),
);
const crouch = computed(
  () =>
    props.crouched ||
    props.action === 'sweep' ||
    ['crouch', 'low', 'crouchKick', 'roll'].includes(props.action) ||
    (props.action === 'upper' && !striking.value),
);
const swing = computed(() => (props.reduced ? 0 : Math.sin(props.frame * 0.5)));
const leg = computed(() =>
  props.action === 'walk' || props.action === 'dash' ? swing.value * 16 : 0,
);
const bob = computed(() =>
  props.reduced
    ? 0
    : props.action === 'walk'
      ? Math.abs(swing.value) * -3
      : Math.sin(props.frame / 16) * 1.5,
);
</script>
<template>
  <g :transform="`scale(${facing},1)`" :data-character="id">
    <g
      :transform="
        down
          ? 'translate(0,-18) rotate(-78)'
          : `translate(0,${crouch ? 0 : bob}) scale(1,${crouch ? 0.7 : 1}) rotate(${tilt} 0 -25)`
      "
    >
      <path
        v-if="id === 'deepseek'"
        d="M-19-44 Q-59-7-47-2 L-65-12 Q-61 9-42 6 Q-8 2-5-31"
        :fill="palette.ink"
        stroke="#111c32"
        stroke-width="3"
      />
      <path
        v-if="id === 'gpt'"
        d="M-18-50 Q-70-76-54-23 L-42-35-32-27-19-37Z"
        fill="#edf2f0"
        stroke="#184640"
        stroke-width="3"
      />
      <g stroke="#172336" stroke-width="4" stroke-linejoin="round">
        <path
          :d="`M-11-25 L${-12 - leg}-7 L${-3 - leg}-3`"
          :stroke="id === 'doubao' ? '#30313c' : '#eef5ff'"
          stroke-width="12"
          fill="none"
        />
        <path
          v-if="!kick"
          :d="`M11-25 L${14 + leg}-7 L${23 + leg}-3`"
          :stroke="id === 'doubao' ? '#30313c' : '#eef5ff'"
          stroke-width="12"
          fill="none"
        />
        <path :d="`M${-20 - leg}-6 h19 v7 h-23Z`" :fill="palette.ink" />
        <path v-if="!kick" :d="`M${9 + leg}-6 h21 l3 7 h-24Z`" :fill="palette.ink" />
        <path d="M-19-54 L17-54 23-20 Q0-12-24-20Z" :fill="outfit" />
        <path d="M-19-47 L-30-28 -20-21" fill="none" :stroke="outfit" stroke-width="11" />
        <path v-if="id !== 'doubao'" d="M-13-55 L0-31 12-55" fill="#f7fbff" stroke-width="2" />
        <circle v-if="id !== 'doubao'" cx="0" cy="-28" r="4" :fill="palette.ink" stroke-width="2" />
        <path
          d="M-22-20 Q0-13 23-20 L29-12 Q0-4-30-12Z"
          :fill="id === 'doubao' ? '#262833' : palette.ink"
        />
      </g>
      <g
        v-if="kick"
        data-testid="duel-kick"
        :data-kick-phase="striking ? 'extended' : 'chambered'"
        stroke="#172336"
        stroke-width="3"
        stroke-linejoin="round"
      >
        <path
          :d="`M10-23 Q${kickFoot.x / 2}-43 ${kickFoot.x - 9} ${kickFoot.y}`"
          fill="none"
          stroke="#edf5ff"
          stroke-width="13"
        />
        <path
          :d="`M${kickFoot.x - 15} ${kickFoot.y - 9} L${kickFoot.x + 4} ${kickFoot.y - 9} Q${kickFoot.x + 18} ${kickFoot.y - 7} ${kickFoot.x + 18} ${kickFoot.y + 5} L${kickFoot.x - 16} ${kickFoot.y + 5}Z`"
          fill="#234c91"
        />
        <path :d="`M${kickFoot.x - 14} ${kickFoot.y + 4} H${kickFoot.x + 15}`" stroke="#d8efff" />
        <path
          v-if="striking"
          :d="`M23-18 Q55-75 ${kickFoot.x + 23} ${kickFoot.y - 10}`"
          fill="none"
          stroke="#80d9ff"
          stroke-width="5"
          opacity=".8"
        />
      </g>
      <g
        :transform="`translate(0,-7) scale(.88,.9) ${action === 'hurt' ? 'rotate(-12 0 -60)' : ''}`"
      >
        <path
          d="M-30-68 Q-38-107-3-110 Q36-111 34-73 L28-52 -29-51Z"
          :fill="id === 'doubao' ? '#40302e' : id === 'gpt' ? '#edf2f0' : '#254c89'"
          stroke="#16233a"
          stroke-width="3"
        />
        <ellipse
          cx="1"
          cy="-76"
          rx="27"
          ry="26"
          fill="#ffe4d5"
          stroke="#16233a"
          stroke-width="2.5"
        />
        <path
          :d="
            id === 'doubao'
              ? 'M-29-57Q-39-106 3-111Q39-113 30-78Q24-99 12-96Q-4-91-15-71L-18-55Z'
              : 'M-29-77 Q-36-112 0-110 Q32-107 31-77 L19-85 13-96 3-82 -7-94 -19-80Z'
          "
          :fill="id === 'doubao' ? '#40302e' : id === 'gpt' ? '#edf2f0' : '#254c89'"
          stroke="#16233a"
          stroke-width="2.5"
        />
        <path
          v-if="id === 'deepseek'"
          d="M-25-100 Q-38-103-35-113 Q-23-119-17-109 M5-107 Q21-126 31-114 L29-100"
          fill="#70bdff"
          stroke="#254c89"
          stroke-width="3"
        />
        <path
          v-if="id === 'gpt'"
          d="M-19-101 Q-34-124-24-135 L-13-110 M17-104 Q29-121 24-133 L33-103"
          fill="#edf2f0"
          stroke="#184640"
          stroke-width="3"
        />
        <g v-if="id === 'doubao'" fill="#d34243" stroke="#7d292e" stroke-width="2">
          <path d="M-18-56Q0-46 19-57L21-45Q0-32-20-43Z" />
          <path :d="`M-12-44 Q${-41 - leg}-41 ${-48 - leg}-20 L${-36 - leg}-17 Q-19-25-6-40Z`" />
          <path d="M4-42 18-41 22-21 10-20Z" />
        </g>
        <g
          v-if="down || action === 'hurt' || action === 'launched'"
          stroke="#24334a"
          stroke-width="3"
          fill="none"
        >
          <path d="m-14-79 9 5-9 5 M15-79 -0-74 15-69" />
        </g>
        <g v-else :fill="palette.ink">
          <ellipse cx="-10" cy="-75" rx="3.7" ry="7" />
          <ellipse cx="13" cy="-75" rx="3.7" ry="7" />
          <circle cx="-9" cy="-78" r="1.5" fill="white" />
          <circle cx="14" cy="-78" r="1.5" fill="white" />
        </g>
        <path
          :d="attacking ? 'M-2-62 Q5-53 12-64Z' : 'M0-62 Q5-58 10-63'"
          fill="none"
          stroke="#975756"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path d="M-20-66h6 M20-66h6" stroke="#f59da4" stroke-width="4" opacity=".6" />
      </g>
      <g
        :transform="
          blocking
            ? 'rotate(-60 17 -44)'
            : striking && rising
              ? 'rotate(-100 17 -44)'
              : striking && !kick
                ? 'rotate(-32 17 -44)'
                : attacking
                  ? 'rotate(95 17 -44)'
                  : 'rotate(25 17 -44)'
        "
      >
        <path
          :d="striking && !kick ? 'M17-44 45-41 64-44' : 'M17-44 27-26 33-26'"
          fill="none"
          :stroke="outfit"
          stroke-width="13"
          stroke-linecap="round"
        />
        <ellipse
          :cx="striking && !kick ? 65 : 33"
          :cy="striking && !kick ? -44 : -26"
          rx="10"
          ry="9"
          fill="#ffe4d5"
          stroke="#192842"
          stroke-width="3"
        />
      </g>
      <path
        v-if="blocking"
        d="M39-91 Q67-47 39-9"
        fill="none"
        :stroke="palette.color"
        stroke-width="5"
        opacity=".85"
      />
      <path
        v-if="striking && !kick"
        d="M44-95 Q106-61 76-22"
        fill="none"
        :stroke="palette.color"
        stroke-width="7"
        opacity=".7"
      />
      <g
        v-if="striking && attacking"
        data-testid="attack-trail"
        :fill="palette.color"
        opacity=".65"
      >
        <path v-if="rising" d="M-18-9 Q105-37 54-166 Q129-35-18-9Z" />
        <path v-else-if="action === 'airHeavy'" d="M-5-129Q113-82 78 45Q146-85-5-129Z" />
        <path v-else d="M20-116Q137-105 111-26Q115-85 20-116Z" />
      </g>
      <path
        v-if="action === 'dash'"
        d="M-55-94-32-98 M-74-60-37-64 M-54-19-28-25"
        :stroke="palette.color"
        stroke-width="4"
      />
    </g>
  </g>
</template>
