<script setup lang="ts">
withDefaults(defineProps<{ age: number; reduceMotion: boolean; angle?: number }>(), { angle: 0 });
</script>
<template>
  <g
    data-projectile="fireball"
    :data-age="age.toFixed(3)"
    :data-spin="reduceMotion ? 0 : Math.round(age * 430)"
  >
    <g :transform="`rotate(${angle})`">
      <path
        d="M5 -6C-3 -12 -7 -5 -17 -9L-10 -2L-20 2L-9 4L-14 10C-5 7 -1 12 7 5Z"
        fill="#ff6f36"
        fill-opacity=".65"
      />
      <circle r="9" fill="#ff843e" />
      <g
        :transform="`rotate(${reduceMotion ? 0 : age * 430})`"
        fill="none"
        stroke="#ffd16d"
        stroke-width="2.5"
      >
        <path d="M-5 -5A7 7 0 0 1 7 1M5 5A7 7 0 0 1-7 -1" />
      </g>
      <circle r="4.5" fill="#fff5bd" />
    </g>
  </g>
</template>
