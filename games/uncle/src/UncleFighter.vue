<script setup lang="ts">
import { computed } from 'vue';
import type { Fighter } from './rules';

const props = defineProps<{ fighter: Fighter; fighterSlot: 0 | 1 }>();
const palette = computed(() =>
  props.fighter.id === 'wok'
    ? {
        jacket: '#d84d3f',
        shirt: '#ffe0a6',
        dark: '#60372f',
        skin: '#efb98f',
        prop: '#29313a',
      }
    : {
        jacket: '#287c8e',
        shirt: '#d8f2e5',
        dark: '#27434a',
        skin: '#dca37e',
        prop: '#d94f3d',
      },
);
const transform = computed(
  () => `translate(${props.fighter.facing === -1 ? 126 : 0} 0) scale(${props.fighter.facing} 1)`,
);
</script>

<template>
  <svg
    class="uncle-fighter-art"
    :class="[`action-${fighter.action}`, `uncle-${fighter.id}`]"
    viewBox="0 0 126 190"
    role="img"
    :aria-label="fighter.id === 'wok' ? '锅铲舅' : '保温杯舅'"
    :data-slot="fighterSlot"
  >
    <g :transform="transform">
      <ellipse cx="63" cy="181" rx="43" ry="7" fill="#142126" opacity=".2" />
      <g class="back-arm">
        <path
          d="M44 89 Q23 109 24 137"
          fill="none"
          :stroke="palette.skin"
          stroke-width="15"
          stroke-linecap="round"
        />
        <circle cx="24" cy="141" r="9" :fill="palette.skin" />
      </g>
      <g class="legs">
        <path
          d="M52 137 L45 174"
          fill="none"
          :stroke="palette.dark"
          stroke-width="18"
          stroke-linecap="round"
        />
        <path
          d="M76 137 L84 174"
          fill="none"
          :stroke="palette.dark"
          stroke-width="18"
          stroke-linecap="round"
        />
        <path d="M30 178 Q44 167 58 177 L57 185 H29Z" :fill="palette.prop" />
        <path d="M72 177 Q85 166 99 179 L96 185 H72Z" :fill="palette.prop" />
      </g>
      <path
        d="M38 79 Q63 67 88 81 L91 139 Q64 151 35 139Z"
        :fill="palette.jacket"
        :stroke="palette.dark"
        stroke-width="4"
      />
      <path d="M53 78 L63 105 L74 78" :fill="palette.shirt" />
      <path d="M62 103 L67 139" :stroke="palette.dark" stroke-width="3" opacity=".45" />
      <g class="head">
        <path
          d="M40 40 Q45 14 68 12 Q94 13 98 43 L92 70 Q78 87 55 77 Q40 69 40 40Z"
          :fill="palette.skin"
          :stroke="palette.dark"
          stroke-width="4"
        />
        <path
          d="M40 43 Q37 18 62 10 Q91 5 101 35 Q84 25 70 28 Q53 23 40 43Z"
          :fill="palette.dark"
        />
        <path d="M49 46 Q55 41 61 46" fill="none" :stroke="palette.dark" stroke-width="4" />
        <path d="M76 46 Q82 41 88 46" fill="none" :stroke="palette.dark" stroke-width="4" />
        <circle cx="56" cy="49" r="2.5" :fill="palette.dark" />
        <circle cx="83" cy="49" r="2.5" :fill="palette.dark" />
        <path
          d="M59 64 Q69 72 82 63"
          fill="none"
          :stroke="palette.dark"
          stroke-width="4"
          stroke-linecap="round"
        />
        <path
          v-if="fighter.id === 'thermos'"
          d="M43 37 Q38 50 43 60 M96 37 Q101 50 96 61"
          fill="none"
          stroke="#f2f0df"
          stroke-width="6"
        />
      </g>
      <g class="front-arm">
        <path
          d="M83 89 Q104 108 99 136"
          fill="none"
          :stroke="palette.skin"
          stroke-width="16"
          stroke-linecap="round"
        />
        <circle cx="98" cy="141" r="9" :fill="palette.skin" />
        <g v-if="fighter.id === 'wok'" class="uncle-prop wok">
          <path d="M99 139 L117 158" :stroke="palette.prop" stroke-width="5" />
          <circle cx="105" cy="128" r="20" fill="#202a31" stroke="#aab7b9" stroke-width="4" />
          <path
            d="M94 119 Q106 112 116 123"
            fill="none"
            stroke="#fff"
            stroke-width="3"
            opacity=".5"
          />
        </g>
        <g v-else class="uncle-prop thermos">
          <rect x="91" y="124" width="18" height="36" rx="6" :fill="palette.prop" />
          <path d="M94 130 H106" stroke="#ffe9ba" stroke-width="3" />
          <path d="M100 124 V117" stroke="#ffe9ba" stroke-width="4" />
        </g>
      </g>
      <path
        v-if="fighter.action === 'guard'"
        d="M91 72 Q121 91 108 130"
        fill="none"
        stroke="#fff5b8"
        stroke-width="8"
        stroke-linecap="round"
        opacity=".75"
      />
    </g>
  </svg>
</template>

<style scoped>
.uncle-fighter-art {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 8px 0 #102a2b30);
}
.head,
.front-arm,
.back-arm,
.legs,
.uncle-prop {
  transform-box: fill-box;
  transform-origin: center;
}
.action-idle .head {
  animation: uncle-nod 1.8s ease-in-out infinite;
}
.action-walk .legs {
  animation: uncle-walk 0.25s ease-in-out infinite alternate;
}
.action-light .front-arm {
  transform: rotate(-58deg) translate(16px, -12px);
}
.action-heavy .front-arm {
  transform: rotate(-86deg) translate(25px, -18px);
}
.action-special .front-arm {
  animation: uncle-special 0.45s ease-out both;
}
.action-hit {
  transform: rotate(-8deg) translateX(-8px);
}
.action-guard .front-arm {
  transform: rotate(-50deg) translate(-8px, -15px);
}
.uncle-thermos.action-special .head {
  animation: uncle-nod 0.16s linear 3;
}
@keyframes uncle-nod {
  50% {
    transform: translateY(2px) rotate(2deg);
  }
}
@keyframes uncle-walk {
  to {
    transform: skewX(-9deg) translateX(3px);
  }
}
@keyframes uncle-special {
  30% {
    transform: rotate(35deg) translate(-8px, 4px);
  }
  100% {
    transform: rotate(-110deg) translate(28px, -25px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .uncle-fighter-art * {
    animation: none !important;
  }
}
</style>
