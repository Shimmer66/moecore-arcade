<script setup lang="ts">
import type { MemeEffect } from './types';
import FighterSprite from './RasterFighter.vue';
defineProps<{
  effect: MemeEffect;
  age: number;
  x: number;
  y: number;
  originX: number;
  facing: number;
  reduced: boolean;
}>();
</script>
<template>
  <g aria-hidden="true">
    <g
      v-if="effect === 'cache-hit'"
      data-testid="cache-replay-prop"
      :transform="`translate(${x - facing * 54},${345 - y})`"
    >
      <rect
        x="-25"
        y="-19"
        width="50"
        height="37"
        rx="5"
        fill="#536578"
        stroke="#0f1d31"
        stroke-width="3"
      />
      <rect x="-20" y="-14" width="34" height="25" rx="3" fill="#93e7e5" />
      <path
        d="M3-7 Q-12-12-13 1Q-10 12 1 7 M-13 1-8-5 M-13 1-18-5"
        fill="none"
        stroke="#21425d"
        stroke-width="3"
      />
      <circle cx="20" cy="5" r="2" fill="#ffab7f" />
      <text y="31" text-anchor="middle" fill="#c5fff0" font-size="12" font-weight="bold">
        这题做过
      </text>
    </g>
    <g
      v-if="effect === 'gpt-muffled'"
      data-testid="muffled-mouth-prop"
      :transform="`translate(${x},${433 - y})`"
    >
      <path
        d="M-25-78Q-32-67-21-56Q0-47 22-56L30-51 27-62Q33-84 0-85Q-17-86-25-78Z"
        fill="#ffd3d9"
        stroke="#c87793"
        stroke-width="2"
      />
      <g
        v-for="n in 4"
        :key="n"
        :transform="`translate(${(n % 2 ? -1 : 1) * (35 + (reduced ? 15 : age * 0.7))},${-90 - Math.floor(n / 2) * 17 - (reduced ? 0 : age)}) rotate(${n % 2 ? -20 : 20})`"
      >
        <rect x="-10" y="-9" width="20" height="18" rx="1" fill="#eefff7" stroke="#89c9b7" />
        <path d="M-6-3H6 M-6 3H3" stroke="#65a18c" />
      </g>
    </g>
    <g
      v-if="effect === 'gpt-rollback'"
      data-testid="rollback-ghost"
      :transform="`translate(${originX - facing * (reduced ? 35 : Math.min(age, 18) * 3)},${450 - y})`"
      opacity=".4"
    >
      <FighterSprite
        id="gpt"
        action="variant"
        :age="reduced ? 9 : Math.max(0, 18 - age)"
        :facing="facing"
        :reduced="reduced"
      />
      <path d="M-28-143 -44-134-28-125Z M-9-143-25-134-9-125Z" fill="#bcffe0" />
      <text x="10" y="-130" fill="#dcfff0" font-size="12">撤回中</text>
    </g>
  </g>
</template>
