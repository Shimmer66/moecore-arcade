<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
const props = defineProps<{ kind: string; enemy?: boolean }>();
const loot = [
  'pulse',
  'spread',
  'rapid',
  'laser',
  'flame',
  'homing',
  'shield',
  'health',
  'grenade',
];
const npc = ['runner', 'turret', 'drone', 'sniper', 'hopper', 'firewall'];
const powerups = ['capsule', 'cache', 'overclock', 'barrier', 'purge', 'cache-open'];
const nest = ['pod', 'larva', 'heart', 'heart-open'];
const enemyBoxes = [
  '20 30 430 430',
  '485 25 510 445',
  '1015 60 515 365',
  '25 495 485 495',
  '505 468 485 515',
  '1000 490 520 495',
];
const lootBoxes = [
  '10 40 400 355',
  '425 50 410 300',
  '835 60 410 345',
  '8 455 412 315',
  '428 450 406 330',
  '838 445 408 343',
  '0 788 421 424',
  '424 826 410 390',
  '853 795 388 425',
];
const art = computed(() =>
  nest.includes(props.kind)
    ? REWRITE_ART.nestAtlas
    : powerups.includes(props.kind)
      ? REWRITE_ART.powerupAtlas
      : props.enemy
        ? REWRITE_ART.enemyAtlas
        : REWRITE_ART.lootAtlas,
);
const box = computed(() => {
  const nestIndex = nest.indexOf(props.kind);
  if (nestIndex >= 0) return `${(nestIndex % 2) * 627} ${Math.floor(nestIndex / 2) * 627} 627 627`;
  const powerup = powerups.indexOf(props.kind);
  if (powerup >= 0) return `${(powerup % 3) * 512} ${Math.floor(powerup / 3) * 512} 512 512`;
  if (props.enemy) return enemyBoxes[npc.indexOf(props.kind)] ?? enemyBoxes[0];
  const index = Math.max(0, loot.indexOf(props.kind));
  return lootBoxes[index];
});
</script>
<template>
  <svg
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
    :data-art="kind"
  >
    <svg width="100" height="100" :viewBox="box" overflow="hidden">
      <image :href="art.url" :width="art.width" :height="art.height" />
    </svg>
  </svg>
</template>
