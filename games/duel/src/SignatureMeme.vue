<script setup lang="ts">
import type { Fighter, MemeEffect } from './types';
defineProps<{
  fighter: Fighter;
  effect?: MemeEffect | undefined;
  age?: number | undefined;
  reduced: boolean;
  carrying?: boolean;
  riceOwner?: boolean;
}>();
</script>
<template>
  <g :transform="`scale(${fighter.facing},1)`" aria-hidden="true">
    <g v-if="carrying" data-testid="rice-bowl" transform="translate(20,-66)">
      <ellipse cy="-8" rx="25" ry="13" fill="#fff9df" stroke="#c7d5e4" stroke-width="2" />
      <path
        d="M-27-5H27Q22 23 0 23Q-22 23-27-5Z"
        fill="#eaf5ff"
        stroke="#527faf"
        stroke-width="3"
      />
      <path d="M-21 2H21 M-14 10H14" stroke="#75b9f1" stroke-width="3" />
      <path
        v-if="fighter.action === 'eat' || (fighter.id === 'deepseek' && fighter.action === 'meme')"
        :d="`M${reduced ? 14 : 14 + Math.sin(fighter.age * 0.7) * 5}-35 L2-11 M${reduced ? 21 : 21 + Math.sin(fighter.age * 0.7) * 5}-32 L7-9`"
        stroke="#ab703d"
        stroke-width="3"
      />
      <path d="M-12-19q-5-8 0-13 M0-21q-5-8 0-13" stroke="#eef8ff" fill="none" stroke-width="2" />
      <text
        :transform="`scale(${fighter.facing},1)`"
        y="42"
        text-anchor="middle"
        fill="#ffe9ae"
        font-size="11"
      >
        {{ riceOwner ? '护住白饭！' : '你的饭在我这！' }}
      </text>
    </g>
    <g
      v-if="effect === 'rice-spill' || effect === 'catch-overload'"
      data-testid="rice-spill"
      transform="translate(18,-65)"
    >
      <ellipse
        v-for="n in 9"
        :key="n"
        :cx="(n - 5) * (8 + (reduced ? 0 : (age ?? 0) * 0.5))"
        :cy="-20 - Math.sin(n) * 25 + (reduced ? 0 : (age ?? 0))"
        rx="3"
        ry="6"
        fill="#fff6cf"
        :transform="`rotate(${n * 13})`"
      />
      <path d="M-23 0H23Q15 20 0 20Q-16 20-23 0Z" fill="#bce2ff" transform="rotate(-35)" />
    </g>
    <g v-if="effect === 'catch-overload'" data-testid="catch-overload" transform="translate(0,-75)">
      <path d="M-45-18 48 12 M-31 22 35-32" stroke="#ffe798" stroke-width="5" />
      <rect x="-28" y="-12" width="23" height="17" rx="3" fill="#e8fff2" transform="rotate(-25)" />
      <ellipse cx="34" cy="8" rx="13" ry="11" fill="#ffc5dd" />
    </g>
    <g
      v-if="effect === 'parcel-reflect' || effect === 'parcel-delivered'"
      data-testid="parcel-label"
      transform="translate(0,-165)"
    >
      <rect
        x="-44"
        y="-15"
        width="88"
        height="25"
        rx="3"
        fill="#fff4d1"
        stroke="#e7ad6e"
        stroke-width="2"
      />
      <text
        :transform="`scale(${fighter.facing},1)`"
        y="2"
        text-anchor="middle"
        fill="#744523"
        font-size="12"
        font-weight="bold"
      >
        {{ effect === 'parcel-reflect' ? '拒收 · 退回' : '挨打已签收' }}
      </text>
    </g>
    <g
      v-if="fighter.id === 'gpt' && (fighter.action === 'meme' || effect === 'steady-catch')"
      data-testid="steady-catch-prop"
      transform="translate(36,-52)"
    >
      <path
        d="M-12-30 Q55-48 51 18 Q19 34-12 8"
        fill="#8bedc933"
        stroke="#b5fff0"
        stroke-width="4"
        stroke-dasharray="7 5"
      />
      <rect
        x="-3"
        y="7"
        width="54"
        height="20"
        rx="10"
        fill="#ecfff8"
        stroke="#68baa5"
        stroke-width="3"
      />
      <path d="M9 12Q23 23 37 12" fill="none" stroke="#4d9f88" stroke-width="2" />
    </g>
    <g
      v-if="fighter.id === 'doubao' && fighter.action === 'meme'"
      data-testid="tangbao-prop"
      transform="translate(35,-75)"
    >
      <path d="M0-22H38V8H12L4 17V8H0Z" fill="#ffcfdf" stroke="#b86589" stroke-width="2" />
      <path d="M29-10H10L17-16M10-10 17-4" fill="none" stroke="#8b3862" stroke-width="3" />
    </g>
  </g>
</template>
