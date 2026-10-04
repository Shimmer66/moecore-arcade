<script setup lang="ts">
import { computed } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import type { EnemyKind, Weapon } from './levels';
import EnemyArt from './EnemyArt.vue';
import BossArt from './BossArt.vue';

const props = defineProps<{
  kind: 'hit' | 'boom' | 'shield' | 'pickup' | 'muzzle' | 'defeat';
  weapon?: Weapon | undefined;
  enemy?: EnemyKind | undefined;
  stage?: number | undefined;
  life: number;
  reduceMotion: boolean;
}>();

const weaponCells: Record<Weapon, number> = {
  pulse: 0,
  spread: 1,
  rapid: 2,
  laser: 3,
  flame: 4,
  homing: 5,
};
const cell = computed(() => {
  if (props.kind === 'hit' || props.kind === 'muzzle')
    return props.weapon ? weaponCells[props.weapon] : 11;
  if (props.kind === 'boom') return 6;
  if (props.kind === 'shield') return 7;
  if (props.kind === 'pickup') return 10;
  return -1;
});
const viewBox = computed(
  () => `${(cell.value % 4) * 256} ${Math.floor(cell.value / 4) * 256} 256 256`,
);
const isAnimatedEnemy = computed(
  () => !!props.enemy && ['runner', 'turret', 'drone', 'sniper', 'hopper'].includes(props.enemy),
);
const isBoss = computed(() => props.kind === 'defeat' && props.enemy === 'boss');
const scale = computed(() => {
  if (props.reduceMotion) return 0.82;
  const maximum = props.kind === 'boom' ? 0.55 : props.kind === 'defeat' ? 0.55 : 0.24;
  return 0.72 + Math.max(0, maximum - props.life) * (props.kind === 'boom' ? 0.7 : 1.1);
});
const size = computed(() =>
  props.kind === 'muzzle'
    ? 46
    : props.kind === 'hit'
      ? 48
      : props.kind === 'shield' || props.kind === 'pickup'
        ? 60
        : 78,
);
</script>

<template>
  <g
    :data-combat-effect="kind"
    :data-effect-weapon="weapon"
    :style="{ transform: `scale(${scale})` }"
    :opacity="Math.min(1, life * (kind === 'boom' || kind === 'defeat' ? 3.5 : 5))"
  >
    <BossArt
      v-if="isBoss"
      :stage="stage ?? 0"
      state="defeated"
      x="-48"
      y="-48"
      width="96"
      height="96"
    />
    <EnemyArt
      v-else-if="kind === 'defeat' && isAnimatedEnemy"
      :kind="enemy!"
      state="defeated"
      x="-42"
      y="-42"
      width="84"
      height="84"
    />
    <svg
      v-else-if="cell >= 0"
      :x="-size / 2"
      :y="-size / 2"
      :width="size"
      :height="size"
      :viewBox="viewBox"
      overflow="hidden"
    >
      <image
        :href="REWRITE_ART.combatVfx.url"
        :width="REWRITE_ART.combatVfx.width"
        :height="REWRITE_ART.combatVfx.height"
      />
    </svg>
  </g>
</template>
