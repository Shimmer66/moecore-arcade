<script setup lang="ts">
defineProps<{
  art: { url: string; width: number; height: number; viewBox: string };
  x: number;
  y: number;
  width: number;
  height: number;
}>();
</script>

<template>
  <svg
    :x="x"
    :y="y"
    :width="width"
    :height="height"
    :viewBox="art.viewBox"
    aria-hidden="true"
    class="art-sprite"
  >
    <image :href="art.url" :width="art.width" :height="art.height" />
  </svg>
</template>

<style scoped>
.art-sprite {
  pointer-events: none;
}
</style>
