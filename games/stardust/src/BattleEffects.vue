<script setup lang="ts">
import { computed } from 'vue';
import { STARDUST_ART } from '@moecore/assets/stardust';
import { isHero, ULTIMATE_NAMES, ULTIMATE_TIMINGS, type UltimateState } from './ultimates';
import type { EmeraldProjectile } from './emeralds';

interface FighterView {
  id: string;
  x: number;
  facing: number;
  attack: string | null;
  down: boolean;
  standControl: { mode: string; x: number };
}
interface UltimateView {
  id: number;
  caster: FighterView;
  target: FighterView;
  state: UltimateState;
}
const props = defineProps<{
  ultimates: UltimateView[];
  projectiles: EmeraldProjectile[];
  fighters: FighterView[];
  paused: boolean;
  reduceMotion: boolean;
}>();
const attacking = computed(() =>
  props.fighters.filter(
    (fighter) =>
      isHero(fighter.id) &&
      fighter.id !== 'kakyoin' &&
      !fighter.down &&
      ['light', 'heavy', 'stand'].includes(fighter.attack ?? ''),
  ),
);
const gems = Array.from({ length: 40 }, (_, index) => ({
  x: 30 + (index % 10) * 103,
  y: 60 + Math.floor(index / 10) * 110 + (index % 2) * 28,
}));
const fist =
  'M-34 16 L-42-4 Q-44-14-34-17 L-24-14 L-24-29 Q-20-40-10-31 Q0-42 9-30 Q21-37 28-24 Q40-27 43-12 L41 17 L24 33 L-17 33 Z';

function gemPosition(entry: UltimateView, index: number) {
  const point = gems[index]!;
  if (entry.state.phase !== 'strike') return point;
  const progress = Math.min(1, entry.state.hits / 8);
  return {
    x: point.x + (entry.target.x * 10 - point.x) * progress,
    y: point.y + (300 - point.y) * progress,
  };
}
function chariotStyle(entry: UltimateView, afterimage = 0) {
  const state = entry.state;
  const frame =
    state.phase === 'startup'
      ? state.elapsedMs < 480
        ? 0
        : 1
      : state.hits >= 23
        ? 1
        : state.hits % 2 === 0
          ? 2
          : 3;
  const progress = state.phase === 'startup' ? 0 : Math.min(1, state.hits / 5);
  const direction = entry.target.x >= state.originX ? 1 : -1;
  const lunge = state.phase === 'strike' && state.hits < 23 ? (state.hits % 2) * 3 : 0;
  const x = state.originX + (entry.target.x - direction * (6 - lunge) - state.originX) * progress;
  return {
    left: `clamp(min(180px, 37.5%), ${x - afterimage * 5 * direction}%, calc(100% - min(180px, 37.5%)))`,
    backgroundImage: `url("${STARDUST_ART.silverChariotArmorBreak}")`,
    backgroundPosition: `${(frame % 2) * 100}% ${Math.floor(frame / 2) * 100}%`,
    transform: `translate(-50%, -50%) scaleX(${direction})`,
    opacity: afterimage ? Math.max(0.06, 0.3 - afterimage * 0.04) : 1,
  };
}
</script>

<template>
  <div class="battle-fx" :class="{ paused, reduced: reduceMotion }" aria-hidden="true">
    <div
      v-for="(fighter, index) in attacking"
      :key="index"
      class="attack-trail"
      :class="`attack-trail--${fighter.id}`"
      :data-testid="`stardust-attack-fx-${fighter.id}`"
      :style="{
        left: `${fighter.standControl.mode === 'detached' ? fighter.standControl.x : fighter.x + fighter.facing * 5}%`,
        '--direction': fighter.facing,
      }"
    >
      <svg viewBox="-100 -100 280 200">
        <g v-for="n in 6" :key="n" class="attack-particle" :style="{ '--n': n }">
          <template v-if="fighter.id === 'jotaro'">
            <path
              :d="fist"
              :transform="`translate(${n * 18 - 30},${(n % 3) * 37 - 42}) scale(.56)`"
              fill="#b89cff"
              stroke="#dcfff4"
              stroke-width="4"
            />
            <path
              :d="`M-80 ${(n % 3) * 37 - 42} H${n * 18 - 35}`"
              stroke="#6affee"
              stroke-width="3"
            />
          </template>
          <template v-else-if="fighter.id === 'avdol'">
            <path
              d="M-55 20 Q-10-15 10-70 Q30-20 15 0 Q60-40 90-20 Q75 15 100 20 Q40 80-55 20Z"
              :transform="`translate(${n * 13 - 35},${(n % 2) * 35 - 15}) scale(${0.45 + n * 0.06})`"
              fill="#ff7d25"
              stroke="#fff19b"
              stroke-width="3"
            />
          </template>
          <template v-else>
            <path
              :d="`M-90 ${n * 23 - 95} L165 ${n * 12 - 55} L-20 ${n * 23 - 85} Z`"
              fill="#eafaff"
              stroke="#79dbff"
              stroke-width="1"
            />
          </template>
        </g>
      </svg>
    </div>

    <div
      v-for="projectile in projectiles"
      :key="`emerald-${projectile.id}`"
      class="emerald-projectile"
      data-testid="stardust-emerald-projectile"
      :data-action="projectile.action"
      :data-world-x="projectile.x"
      :data-direction="projectile.facing"
      :style="{
        left: `${projectile.x}%`,
        top: `calc(${projectile.detached ? 48 : 60}% + ${projectile.lane * 28}px)`,
        transform: `translate(-50%, -50%) scaleX(${projectile.facing})`,
      }"
    >
      <svg viewBox="0 0 24 40">
        <path
          d="M12 1 23 14 19 29 12 39 5 29 1 14Z"
          fill="#00b77b"
          stroke="#ccffe5"
          stroke-width="2"
        />
        <path d="M12 1 16 15 12 39 8 15Z" fill="#afffdb" />
        <path
          d="M1 14 8 15 5 29 M23 14 16 15 19 29"
          fill="none"
          stroke="#53ffc1"
          stroke-width="1.5"
        />
      </svg>
    </div>

    <div
      v-for="entry in ultimates"
      :key="entry.id"
      class="ultimate-fx"
      :class="[`ultimate-fx--${entry.state.hero}`, `stage-${entry.state.phase}`]"
      :data-testid="`stardust-ultimate-fx-${entry.state.hero}`"
      :data-stage="entry.state.phase"
      :data-hits="entry.state.hits"
    >
      <div class="ultimate-banner">
        <small>STAND OVERDRIVE</small>
        <strong>{{ ULTIMATE_NAMES[entry.state.hero] }}</strong>
        <span v-if="entry.state.hero === 'kakyoin' && entry.state.phase === 'armed'">结界展开</span>
        <span v-else-if="entry.state.phase === 'strike'"
          >{{ entry.state.hits }} / {{ ULTIMATE_TIMINGS[entry.state.hero].hits }} HIT</span
        >
      </div>
      <svg class="ultimate-field" viewBox="0 0 1000 500" preserveAspectRatio="none">
        <template v-if="entry.state.hero === 'kakyoin'">
          <g v-for="(gem, index) in gems" :key="index">
            <path
              :d="`M${gems[(index + 13) % gems.length]!.x} ${gems[(index + 13) % gems.length]!.y} Q500 ${index % 2 ? 30 : 470} ${gem.x} ${gem.y}`"
              class="emerald-thread"
            />
            <path
              v-if="entry.state.phase === 'strike'"
              :d="`M${gem.x} ${gem.y} L${entry.target.x * 10} 300`"
              class="emerald-lock"
            />
            <g
              :transform="`translate(${gemPosition(entry, index).x},${gemPosition(entry, index).y})`"
            >
              <path
                d="M0-18 12-6 10 9 0 19-10 9-12-6Z"
                fill="#00a771"
                stroke="#aaffd4"
                stroke-width="2"
              />
              <path d="M0-18 4-4 0 19-4-4Z" fill="#d4ffe3" />
            </g>
          </g>
          <circle
            v-if="entry.state.phase === 'strike'"
            :cx="entry.target.x * 10"
            cy="300"
            r="68"
            fill="none"
            stroke="#ddfffa"
            stroke-width="3"
          />
        </template>
        <template v-else-if="entry.state.hero === 'avdol'">
          <g
            v-for="n in 24"
            :key="n"
            :transform="`translate(${n * 45 - 50},500)`"
            class="inferno-column"
            :style="{ '--n': n }"
          >
            <path
              d="M-45 0 Q-65-100-15-165 Q-38-240 15-370 Q-6-230 35-205 Q75-155 47-100 Q85-45 65 0Z"
              fill="#ee3420"
              opacity=".85"
            />
            <path
              d="M-25 0 Q-43-85 0-135 Q-8-195 18-260 Q25-155 42-105 Q23-48 48 0Z"
              fill="#ffb92e"
            />
            <path d="M-5 0 Q-15-65 18-115 Q12-50 30 0Z" fill="#fffbc9" />
          </g>
          <path d="M0 310 H1000 M500 0 V500" stroke="#fff1af" stroke-width="9" opacity=".6" />
          <circle
            v-for="n in 36"
            :key="`ember-${n}`"
            :cx="(n * 137) % 1000"
            :cy="(n * 83) % 480"
            r="3"
            fill="#fff4bf"
            class="ember"
            :style="{ '--n': n }"
          />
        </template>
        <template v-else-if="entry.state.hero === 'jotaro'">
          <path
            v-for="n in 24"
            :key="`line-${n}`"
            :d="`M${entry.caster.x * 10} ${50 + n * 17} L${entry.target.x * 10} ${220 + n * 7}`"
            stroke="#9be9ff"
            :stroke-width="(n % 3) + 1"
            opacity=".55"
          />
          <g
            v-for="n in 6"
            :key="n"
            class="full-power-fist"
            :style="{
              opacity: entry.state.hits >= 46 ? 0.12 : 0.3 + ((entry.state.hits + n) % 3) * 0.3,
            }"
            :transform="`translate(${Math.max(140, Math.min(800, entry.target.x * 10)) + ((entry.state.hits + n) % 3) * 24 - 30},${190 + (n % 3) * 65}) scale(${entry.caster.facing * 1.15},1.15)`"
          >
            <path :d="fist" fill="#9789ef" stroke="#e1fff7" stroke-width="3" />
            <path
              d="M-24-14 V6 M-10-27 V3 M9-27 V3 M28-22 V7 M-17 23 H24"
              fill="none"
              stroke="#5b489c"
              stroke-width="4"
            />
            <path d="M-115-12 H-40 M-135 0 H-42 M-115 14 H-35" stroke="#68ffe2" stroke-width="6" />
          </g>
          <g
            v-if="entry.state.hits >= 46"
            data-testid="stardust-jotaro-finisher"
            :transform="`translate(${Math.max(180, Math.min(790, entry.target.x * 10)) - (50 - entry.state.hits) * entry.caster.facing * 16},280) scale(${entry.caster.facing * 2.6},2.6)`"
          >
            <path
              d="M-150-23-35-16 M-165 0-38 0 M-150 23-35 17"
              stroke="#ffef95"
              stroke-width="10"
            />
            <path :d="fist" fill="#c4b4ff" stroke="#fff6c7" stroke-width="5" />
            <path
              d="M-24-14 V6 M-10-27 V3 M9-27 V3 M28-22 V7 M-17 23 H24"
              fill="none"
              stroke="#7356aa"
              stroke-width="4"
            />
          </g>
        </template>
        <template v-else>
          <path
            v-for="n in 24"
            :key="n"
            :d="`M0 ${n * 23 - 25} L1000 ${n * 19 + 8}`"
            :stroke="n % 3 ? '#fff0b0' : '#aff5ff'"
            :stroke-width="(n % 4) + 1"
            :opacity="entry.state.phase === 'startup' ? 0.1 : 0.6"
          />
          <g v-if="entry.state.hits >= 23" data-testid="stardust-chariot-finisher">
            <path
              :d="`M${entry.caster.x * 10} 280 L${entry.target.x * 10} 280`"
              stroke="#fff7b8"
              stroke-width="22"
            />
            <path
              :d="`M${entry.caster.x * 10} 280 L${entry.target.x * 10} 280`"
              stroke="#f4fdff"
              stroke-width="7"
            />
            <path
              :d="`M${entry.target.x * 10 - 40} 240 L${entry.target.x * 10 + 40} 320 M${entry.target.x * 10 - 40} 320 L${entry.target.x * 10 + 40} 240`"
              stroke="#d4f9ff"
              stroke-width="5"
            />
          </g>
        </template>
      </svg>
      <div
        v-if="entry.state.hero === 'jotaro' || entry.state.hero === 'avdol'"
        class="summoned-stand"
        :class="`summoned-stand--${entry.state.hero}`"
        :style="{
          left: `clamp(min(140px, 30%), ${entry.target.x - entry.caster.facing * 16}%, calc(100% - min(140px, 30%)))`,
          backgroundImage: `url('${STARDUST_ART.standMotion[entry.state.hero]}')`,
          backgroundPosition: entry.state.phase === 'startup' ? '0% 100%' : '33.333333% 100%',
          transform: `translate(-50%, -50%) scaleX(${entry.caster.facing})`,
        }"
      ></div>
      <template v-if="entry.state.hero === 'polnareff'">
        <div v-if="entry.state.phase === 'strike'" class="afterimages">
          <div v-for="n in 3" :key="n" class="chariot-sprite" :style="chariotStyle(entry, n)"></div>
        </div>
        <div
          class="chariot-sprite"
          :style="chariotStyle(entry)"
          data-testid="stardust-chariot-chest-burst"
        ></div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.emerald-projectile {
  position: absolute;
  width: 20px;
  height: 30px;
  filter: drop-shadow(0 0 5px #36fbbb);
}
.emerald-projectile svg {
  position: relative;
  width: 100%;
  height: 100%;
}
.emerald-projectile::before {
  content: '';
  position: absolute;
  right: 50%;
  top: 48%;
  width: 46px;
  height: 3px;
  background: linear-gradient(90deg, transparent, #a1ffdc);
}
.battle-fx {
  position: absolute;
  inset: 0;
  z-index: 15;
  pointer-events: none;
  overflow: hidden;
}
.attack-trail {
  position: absolute;
  top: 45%;
  width: 260px;
  height: 190px;
  transform: translate(-35%, -35%) scaleX(var(--direction));
}
.attack-trail svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.attack-particle {
  animation: attack-surge 460ms ease-out infinite;
  animation-delay: calc(var(--n) * -67ms);
}
.ultimate-fx {
  position: absolute;
  inset: 0;
  isolation: isolate;
  border: 2px solid #d1faff;
  background: rgb(30 24 67 / 38%);
  box-shadow: inset 0 0 80px rgb(92 225 255 / 35%);
}
.ultimate-fx--kakyoin {
  border-color: #6dffc0;
  background: rgb(0 45 30 / 36%);
  box-shadow: inset 0 0 70px rgb(56 255 166 / 25%);
}
.ultimate-fx--avdol {
  border-color: #ffc265;
  background: rgb(120 19 0 / 34%);
  box-shadow: inset 0 -50px 100px rgb(255 92 24 / 55%);
}
.ultimate-fx--polnareff {
  border-color: #fff1a1;
  background: rgb(40 31 10 / 25%);
  box-shadow: inset 0 0 80px rgb(255 211 69 / 30%);
}
.ultimate-field {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.ultimate-banner {
  position: absolute;
  top: 14px;
  left: 4%;
  right: 4%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 14px;
  z-index: 4;
  padding: 8px 14px;
  border-left: 4px solid #fff;
  color: #fff;
  background: rgb(11 9 20 / 82%);
}
.ultimate-banner small {
  font-size: 10px;
  color: #b5ffe6;
}
.ultimate-banner strong {
  font-size: 20px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.ultimate-banner span {
  font-size: 13px;
  color: #fff2a9;
}
.emerald-thread {
  stroke: #42eea4;
  stroke-width: 1.6;
  fill: none;
  opacity: 0.7;
}
.emerald-lock {
  stroke: #ccffde;
  stroke-width: 3;
  stroke-dasharray: 18 11;
  animation: wire-rush 400ms linear infinite;
}
.inferno-column {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: inferno-surge 900ms ease-in-out infinite alternate;
  animation-delay: calc(var(--n) * -69ms);
}
.ember {
  animation: ember-rise 1200ms linear infinite;
  animation-delay: calc(var(--n) * -87ms);
}
.full-power-fist {
  transition: opacity 45ms linear;
}
.stage-startup .full-power-fist {
  opacity: 0.2;
}
.stage-startup .inferno-column {
  opacity: 0.5;
}
.chariot-sprite {
  position: absolute;
  top: 57%;
  width: 360px;
  max-width: 75%;
  aspect-ratio: 701 / 561;
  background-size: 200% 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 10px #ffe299);
}
.summoned-stand {
  position: absolute;
  top: 56%;
  width: 280px;
  max-width: 60%;
  aspect-ratio: 1;
  background-size: 400% 200%;
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 12px #9effee);
}
.summoned-stand--avdol {
  filter: drop-shadow(0 0 14px #ffc33c);
}
.afterimages {
  position: absolute;
  inset: 0;
}
.paused *,
.reduced * {
  animation-play-state: paused !important;
}
@keyframes attack-surge {
  from {
    opacity: 0.9;
    translate: -9px 0;
  }
  to {
    opacity: 0.2;
    translate: 18px 0;
  }
}
@keyframes wire-rush {
  to {
    stroke-dashoffset: -58;
  }
}
@keyframes inferno-surge {
  from {
    scale: 1 0.85;
  }
  to {
    scale: 1 1.17;
  }
}
@keyframes ember-rise {
  from {
    translate: 0 65px;
    opacity: 0.3;
  }
  to {
    translate: 12px -80px;
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .battle-fx * {
    animation: none !important;
  }
}
@media (max-width: 600px) {
  .ultimate-banner {
    top: auto;
    bottom: 8px;
    padding: 6px 8px;
    gap: 2px 8px;
  }
  .ultimate-banner strong {
    font-size: 15px;
  }
  .ultimate-banner small {
    font-size: 8px;
  }
  .attack-trail {
    width: 175px;
    height: 150px;
  }
}
</style>
