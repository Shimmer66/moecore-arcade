<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import { weapons, type PlayerState } from './rules';
import { selectMotion } from './motion';
const props = withDefaults(
  defineProps<{ player: PlayerState; time: number; reduceMotion: boolean; depth?: boolean }>(),
  { depth: false },
);
const loaded = ref<Record<string, boolean>>({});
const launch = ref<number | null>(null),
  fired = ref(-100),
  landed = ref(-100);
const airAim = ref(false);
let seenTime = -1;
watch(
  () => props.player,
  (p, old) => {
    if (props.time < seenTime || (old && old.persona !== p.persona)) {
      launch.value = null;
      fired.value = -100;
      landed.value = -100;
      airAim.value = false;
    }
    seenTime = props.time;
    if (p.grounded) {
      launch.value = null;
      airAim.value = false;
    } else if (p.vy > 0 && (!old || old.grounded || p.vy > old.vy + 5)) {
      launch.value = props.time - Math.max(0, (12.3 - p.vy) / 28);
      airAim.value = false;
    }
    if (old && p.shotCooldown > old.shotCooldown + 0.02) {
      fired.value = props.time;
      if (!p.grounded) airAim.value = true;
    }
    if (!p.grounded && Math.abs(p.aimY) > 0.1) airAim.value = true;
    if (old && p.grounded && !old.grounded) landed.value = props.time;
  },
  { immediate: true },
);
const motion = computed(() =>
  selectMotion(props.player, props.time, props.reduceMotion, props.depth),
);
const sheet = computed(() =>
  motion.value.bank === 'side'
    ? REWRITE_ART.motion[props.player.persona]
    : motion.value.bank === 'aim'
      ? REWRITE_ART.aimMotion
      : motion.value.bank === 'depth'
        ? REWRITE_ART.depthMotion
        : null,
);
const frame = computed(() => sheet.value?.frames[motion.value.frame]);
const ready = computed(() => !sheet.value || !!loaded.value[sheet.value.url]);
const art = computed(
  () =>
    REWRITE_ART.characters[props.player.persona][
      props.player.shotCooldown > 0 ? 'shoot' : props.player.moving ? 'run' : 'idle'
    ],
);
const magnification = computed(() => {
  const crop = frame.value;
  if (!crop || !sheet.value) return 1;
  if (motion.value.pose === 'prone') return (props.depth ? 36 : 34) / (crop.height - 8);
  if (motion.value.bank === 'aim')
    return (motion.value.pose === 'aim-up' ? 82 : 70) / (crop.height - 8);
  const first = props.depth ? Math.floor(motion.value.frame / 4) * 4 : 0;
  return 70 / (sheet.value.frames[first]!.height - 8);
});
const spin = computed(() =>
  !props.reduceMotion &&
  !props.depth &&
  !airAim.value &&
  motion.value.pose === 'jump' &&
  launch.value !== null
    ? Math.min(360, Math.max(0, ((props.time - launch.value) / ((2 * 12.3) / 28)) * 360))
    : 0,
);
const recoil = computed(() =>
  props.reduceMotion || props.time < fired.value
    ? 0
    : Math.max(0, 1 - (props.time - fired.value) / 0.075) * 1.5,
);
const flash = computed(
  () => !props.reduceMotion && props.time >= fired.value && props.time - fired.value < 0.055,
);
const flashPoint = computed(() => {
  if (props.depth) return { x: 20, y: -40 };
  const pose = motion.value.pose,
    f = props.player.facing;
  return pose === 'aim-up'
    ? { x: 0, y: -80 }
    : pose === 'aim-up-diagonal'
      ? { x: f * 31, y: -60 }
      : pose === 'aim-down'
        ? { x: 0, y: 5 }
        : pose === 'aim-down-diagonal'
          ? { x: f * 31, y: -15 }
          : { x: f * 33, y: pose === 'prone' ? -12 : -35 };
});
function imageLoaded(event: Event) {
  const image = event.target as SVGImageElement;
  loaded.value[image.href.baseVal] = true;
}
</script>
<template>
  <g
    class="actor-sprite"
    :data-persona="player.persona"
    :data-pose="motion.pose"
    :data-frame="motion.frame"
    :data-ready="ready"
    :data-spin="spin.toFixed(1)"
    :data-recoil="recoil.toFixed(2)"
  >
    <ellipse
      v-if="!reduceMotion && time >= landed && time - landed < 0.18"
      :rx="10 + (time - landed) * 65"
      ry="4"
      fill="none"
      stroke="#c3e7de"
      :opacity="0.45 * (1 - (time - landed) / 0.18)"
    />
    <g :transform="`scale(${depth ? 1 : player.facing},1)`">
      <g
        :transform="`translate(${depth ? 0 : motion.pose === 'shoot' || motion.pose === 'prone' ? -recoil : 0},0) rotate(${spin},0,-30)`"
      >
        <svg
          v-if="depth && !ready"
          x="-38"
          :y="player.crouching ? -38 : -76"
          width="76"
          :height="player.crouching ? 38 : 76"
          :viewBox="`${{ deepseek: 0, gpt: 1, claude: 2 }[player.persona] * 724} 0 724 724`"
        >
          <image
            class="sprite-fallback"
            :href="REWRITE_ART.depthOperators.url"
            width="2172"
            height="724"
          />
        </svg>
        <image
          v-else-if="!sheet || !ready"
          class="sprite-fallback"
          :href="art.url"
          :x="(-art.width / art.height) * 35"
          :y="player.crouching ? -34 : -70"
          :width="(art.width / art.height) * 70"
          :height="player.crouching ? 34 : 70"
        />
        <svg
          v-if="sheet && frame"
          class="sprite-cell"
          :x="-frame.anchorX * magnification"
          :y="-frame.anchorY * magnification"
          :width="frame.width * magnification"
          :height="frame.height * magnification"
          :viewBox="`${frame.x} ${frame.y} ${frame.width} ${frame.height}`"
          :opacity="ready ? 1 : 0"
          overflow="hidden"
        >
          <image
            class="sprite-atlas"
            :href="sheet.url"
            :width="sheet.width"
            :height="sheet.height"
            @load="imageLoaded"
          />
        </svg>
      </g>
    </g>
    <g
      v-if="flash"
      :transform="`translate(${flashPoint.x},${flashPoint.y})`"
      :stroke="weapons[player.weapon].color"
      stroke-width="2"
    >
      <path d="M-5 0H5M0-4V4" /><circle r="2" :fill="weapons[player.weapon].color" />
    </g>
  </g>
</template>
