<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { createBattle, FPS, step, type Battle, type Input, type Slot } from './rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const battle = ref<Battle>(createBattle());
const held = reactive(new Set<string>());
const pressed = reactive(new Set<string>());
const startedAt = performance.now();
let frame = 0;
let last = performance.now();
let accumulator = 0;
let finished = false;

const keyMap: Record<string, string> = {
  KeyA: 'p1-left',
  KeyD: 'p1-right',
  KeyW: 'p1-jump',
  KeyF: 'p1-light',
  KeyG: 'p1-heavy',
  KeyH: 'p1-special',
  KeyS: 'p1-guard',
  KeyQ: 'p1-dodge',
  ArrowLeft: 'p2-left',
  ArrowRight: 'p2-right',
  ArrowUp: 'p2-jump',
  ArrowDown: 'p2-guard',
  Numpad1: 'p2-light',
  Digit1: 'p2-light',
  Numpad2: 'p2-heavy',
  Digit2: 'p2-heavy',
  Numpad3: 'p2-special',
  Digit3: 'p2-special',
  Numpad0: 'p2-dodge',
  Digit0: 'p2-dodge',
};

const time = computed(() => Math.max(0, Math.ceil(battle.value.timer / FPS)));
const announcement = computed(() => {
  if (battle.value.phase === 'countdown') {
    const count = Math.ceil(battle.value.phaseFrames / 30);
    return count > 1 ? count - 1 : '交锋';
  }
  if (battle.value.phase === 'round-end') {
    return battle.value.roundWinner === null
      ? '平局'
      : `${battle.value.fighters[battle.value.roundWinner].name} 胜`;
  }
  return '';
});

function makeInput(slot: Slot): Input {
  const prefix = `p${slot + 1}`;
  return {
    move: held.has(`${prefix}-left`) ? -1 : held.has(`${prefix}-right`) ? 1 : 0,
    guard: held.has(`${prefix}-guard`),
    jump: pressed.has(`${prefix}-jump`),
    light: pressed.has(`${prefix}-light`),
    heavy: pressed.has(`${prefix}-heavy`),
    special: pressed.has(`${prefix}-special`),
    dodge: pressed.has(`${prefix}-dodge`),
  };
}

function gameFrame(now: number) {
  const delta = Math.min(50, now - last);
  last = now;
  if (!props.paused) {
    accumulator += delta;
    while (accumulator >= 1000 / FPS) {
      step(battle.value, [makeInput(0), makeInput(1)]);
      pressed.clear();
      accumulator -= 1000 / FPS;
    }
    if (battle.value.phase === 'done' && !finished) finish();
  }
  frame = requestAnimationFrame(gameFrame);
}

function finish() {
  finished = true;
  const winner = battle.value.winner;
  emit('finish', {
    gameId: 'starfall',
    sessionId: props.sessionId,
    outcome: winner === null ? 'draw' : winner === 0 ? 'win' : 'lose',
    durationMs: Math.round(performance.now() - startedAt),
    summary:
      winner === null
        ? '两道回响在最后一秒同时散去。'
        : `${battle.value.fighters[winner].name} 以 ${battle.value.scores[0]} : ${battle.value.scores[1]} 赢下第七码头。`,
    stats: {
      rounds: battle.value.round,
      amberDamage: battle.value.fighters[0].damage,
      indigoDamage: battle.value.fighters[1].damage,
      longestCombo: Math.max(...battle.value.fighters.map((fighter) => fighter.maxCombo)),
    },
  });
}

function onKeyDown(event: KeyboardEvent) {
  const control = keyMap[event.code];
  if (!control || props.paused) return;
  event.preventDefault();
  if (!held.has(control)) pressed.add(control);
  held.add(control);
}

function onKeyUp(event: KeyboardEvent) {
  const control = keyMap[event.code];
  if (!control) return;
  event.preventDefault();
  held.delete(control);
}

function press(control: string) {
  if (props.paused) return;
  pressed.add(control);
  held.add(control);
}

function release(control: string) {
  held.delete(control);
}

watch(
  () => props.paused,
  (paused) => {
    if (paused) {
      held.clear();
      pressed.clear();
    }
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  frame = requestAnimationFrame(gameFrame);
});
onUnmounted(() => {
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
});
</script>

<template>
  <article
    class="starfall"
    :class="{ shaking: battle.shake > 0, reduced: settings.reduceMotion }"
    :data-phase="battle.phase"
    :data-timer="time"
    tabindex="0"
    aria-label="荒星回响双人格斗场"
  >
    <header class="fight-hud">
      <section class="fighter-hud left">
        <div class="name-row"><strong>砂岚·琥珀</strong><span>回响体「赤昼」</span></div>
        <div class="health"><i :style="{ width: `${battle.fighters[0].hp / 10}%` }"></i></div>
        <div class="meter"><i :style="{ width: `${battle.fighters[0].meter}%` }"></i></div>
        <b v-if="battle.fighters[0].combo >= 2">{{ battle.fighters[0].combo }} HIT</b>
      </section>
      <div class="round-clock">
        <span>ROUND {{ battle.round }}</span
        ><strong data-testid="starfall-timer">{{ time }}</strong>
        <small>{{ battle.scores[0] }} ◆ {{ battle.scores[1] }}</small>
      </div>
      <section class="fighter-hud right">
        <div class="name-row"><strong>暮钟·靛青</strong><span>回响体「夜脉」</span></div>
        <div class="health"><i :style="{ width: `${battle.fighters[1].hp / 10}%` }"></i></div>
        <div class="meter"><i :style="{ width: `${battle.fighters[1].meter}%` }"></i></div>
        <b v-if="battle.fighters[1].combo >= 2">{{ battle.fighters[1].combo }} HIT</b>
      </section>
    </header>

    <section class="arena" aria-live="polite">
      <div class="sun"></div>
      <div class="speed-lines"></div>
      <div class="mesa mesa-one"></div>
      <div class="mesa mesa-two"></div>
      <div class="station">
        <span>VII</span>
        <i></i><i></i><i></i>
      </div>
      <div class="track"></div>
      <div class="sfx sfx-one">ド</div>
      <div class="sfx sfx-two">ゴ</div>
      <div
        v-for="fighter in battle.fighters"
        :key="fighter.slot"
        class="fighter"
        :class="[
          fighter.slot === 0 ? 'amber' : 'indigo',
          `action-${fighter.action}`,
          { flipped: fighter.facing < 0 },
        ]"
        :style="{
          left: `${(fighter.x / 960) * 100}%`,
          bottom: `${14 + (fighter.y / 540) * 100}%`,
        }"
        :data-testid="`starfall-fighter-${fighter.slot}`"
        :data-hp="fighter.hp"
        :data-x="fighter.x.toFixed(1)"
        :data-action="fighter.action"
      >
        <div class="echo">
          <i class="echo-head"></i><i class="echo-body"></i><i class="echo-arm arm-a"></i
          ><i class="echo-arm arm-b"></i>
        </div>
        <div class="fighter-shadow"></div>
        <div class="body">
          <i class="coat"></i><i class="leg leg-a"></i><i class="leg leg-b"></i
          ><i class="arm arm-a"></i><i class="arm arm-b"></i>
          <div class="head"><i class="hair"></i><i class="face"></i></div>
        </div>
        <div v-if="fighter.action === 'guard'" class="guard-flare"></div>
        <div v-if="fighter.action === 'super'" class="super-ring"></div>
      </div>
      <div
        v-for="item in battle.events"
        :key="item.id"
        class="impact"
        :class="item.kind"
        :style="{ left: `${(item.x / 960) * 100}%`, bottom: `${28 + item.y / 8}%` }"
      >
        {{ item.text }}
      </div>
      <div v-if="announcement" class="announcement">{{ announcement }}</div>
      <div v-if="battle.fighters.some((fighter) => fighter.action === 'super')" class="manga-cut">
        <strong>{{ battle.fighters[0].action === 'super' ? '赤昼连星' : '夜脉断章' }}</strong>
        <span>现在，把这一秒打碎。</span>
      </div>
    </section>

    <footer class="controls">
      <section>
        <strong>P1 琥珀</strong>
        <span><kbd>A</kbd><kbd>D</kbd>移动</span><span><kbd>W</kbd>跳</span
        ><span><kbd>F</kbd>拳</span><span><kbd>G</kbd>重击</span
        ><span><kbd>H</kbd>回响 / 满槽必杀</span><span><kbd>S</kbd>防御</span
        ><span><kbd>Q</kbd>闪避</span>
      </section>
      <p>近身攻击积攒回响槽。30% 可连拳，100% 自动发动必杀。</p>
      <section>
        <strong>P2 靛青</strong>
        <span><kbd>←</kbd><kbd>→</kbd>移动</span><span><kbd>↑</kbd>跳</span
        ><span><kbd>1</kbd>拳</span><span><kbd>2</kbd>重击</span
        ><span><kbd>3</kbd>回响 / 满槽必杀</span><span><kbd>↓</kbd>防御</span
        ><span><kbd>0</kbd>闪避</span>
      </section>
    </footer>

    <div class="touch-controls" aria-label="触屏操作">
      <div v-for="slot in [0, 1] as const" :key="slot" class="touch-side">
        <button
          v-for="control in [
            ['left', '←'],
            ['right', '→'],
            ['jump', '↑'],
            ['light', '拳'],
            ['heavy', '重'],
            ['special', '响'],
            ['guard', '防'],
            ['dodge', '闪'],
          ]"
          :key="control[0]"
          type="button"
          @pointerdown.prevent="press(`p${slot + 1}-${control[0]}`)"
          @pointerup.prevent="release(`p${slot + 1}-${control[0]}`)"
          @pointercancel="release(`p${slot + 1}-${control[0]}`)"
        >
          {{ control[1] }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.starfall {
  --ink: #191423;
  --paper: #fff1cf;
  width: 100%;
  overflow: hidden;
  border: 3px solid var(--ink);
  background: #241936;
  color: var(--paper);
  font-family: Impact, 'Arial Black', 'Microsoft YaHei', sans-serif;
  outline: 0;
}
.fight-hud {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 110px minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-height: 104px;
  padding: 12px 16px 8px;
  background: #171020;
  border-bottom: 3px solid var(--ink);
}
.fighter-hud.right {
  text-align: right;
}
.name-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: #fff;
}
.right .name-row {
  flex-direction: row-reverse;
}
.name-row strong {
  font-size: clamp(15px, 2vw, 24px);
}
.name-row span {
  align-self: end;
  color: #d8c9e8;
  font:
    700 11px 'Microsoft YaHei',
    sans-serif;
}
.health,
.meter {
  height: 18px;
  margin-top: 5px;
  overflow: hidden;
  border: 2px solid #f8e9bd;
  transform: skewX(-10deg);
  background: #3b2748;
}
.health i,
.meter i {
  display: block;
  height: 100%;
  transition: width 0.12s;
  background: linear-gradient(90deg, #ec3158 0 12%, #ffcf4d 12% 100%);
}
.meter {
  height: 9px;
  border-width: 1px;
}
.meter i {
  background: #68e7ff;
  box-shadow: 0 0 10px #68e7ff;
}
.fighter-hud b {
  display: inline-block;
  margin-top: 4px;
  color: #ffcf4d;
  font-size: 20px;
  transform: rotate(-4deg);
}
.round-clock {
  text-align: center;
  line-height: 1;
}
.round-clock span,
.round-clock small {
  display: block;
  color: #d8c9e8;
  font-size: 11px;
}
.round-clock strong {
  display: block;
  color: #fff6d7;
  font-size: 44px;
}
.arena {
  position: relative;
  min-height: 460px;
  overflow: hidden;
  background:
    linear-gradient(12deg, transparent 0 66%, #fff6cf30 66% 67%, transparent 67%),
    linear-gradient(#d64b4c 0 30%, #f19d59 58%, #d56f45 59% 72%, #6c3543 72%);
  isolation: isolate;
}
.sun {
  position: absolute;
  top: 38px;
  left: 50%;
  width: 152px;
  height: 152px;
  border: 7px solid #351b38;
  border-radius: 50%;
  background: #ffe77a;
  transform: translateX(-50%);
  box-shadow: 0 0 0 13px #f7b45b;
}
.speed-lines {
  position: absolute;
  inset: 0;
  opacity: 0.38;
  background: repeating-conic-gradient(from 270deg at 50% 37%, #fff5d800 0 4deg, #fff5d8 5deg 6deg);
}
.mesa {
  position: absolute;
  bottom: 105px;
  width: 230px;
  height: 150px;
  background: #6f3044;
  clip-path: polygon(18% 12%, 68% 8%, 72% 35%, 93% 48%, 100% 100%, 0 100%, 7% 48%);
}
.mesa-one {
  left: -50px;
}
.mesa-two {
  right: -20px;
  transform: scale(0.78);
}
.station {
  position: absolute;
  left: 50%;
  bottom: 90px;
  width: 180px;
  height: 112px;
  border: 5px solid #26172e;
  background: #e9c46b;
  transform: translateX(-50%) skewX(-3deg);
  box-shadow: 13px 10px 0 #5d3044;
}
.station span {
  display: block;
  color: #5d3044;
  font-size: 38px;
  text-align: center;
}
.station i {
  display: inline-block;
  width: 30px;
  height: 42px;
  margin: 8px 12px;
  background: #301d3b;
}
.track {
  position: absolute;
  right: -5%;
  bottom: 24px;
  left: -5%;
  height: 54px;
  border-block: 8px solid #211522;
  background: repeating-linear-gradient(90deg, #4b3040 0 42px, #e0ad5c 42px 58px);
  transform: perspective(180px) rotateX(38deg);
}
.sfx {
  position: absolute;
  color: #3a203b;
  font-size: 62px;
  opacity: 0.42;
  transform: rotate(-12deg);
}
.sfx-one {
  top: 90px;
  left: 8%;
}
.sfx-two {
  top: 130px;
  right: 8%;
}
.fighter {
  position: absolute;
  z-index: 5;
  width: 112px;
  height: 208px;
  transform: translateX(-50%);
  transition:
    left 16ms linear,
    bottom 16ms linear;
}
.fighter.flipped {
  transform: translateX(-50%) scaleX(-1);
}
.fighter-shadow {
  position: absolute;
  bottom: -5px;
  left: 10px;
  width: 88px;
  height: 17px;
  border-radius: 50%;
  background: #1d1229aa;
}
.body,
.echo {
  position: absolute;
  inset: 0;
}
.body i,
.head,
.echo i {
  position: absolute;
  display: block;
  border: 4px solid var(--ink);
}
.head {
  top: 20px;
  left: 31px;
  width: 58px;
  height: 66px;
  border-radius: 42% 45% 48% 45%;
  background: #e6a978;
}
.hair {
  inset: -12px -8px 25px -8px;
  border-radius: 60% 50% 35% 30%;
  background: #52212f;
  clip-path: polygon(0 25%, 78% 0, 100% 40%, 82% 70%, 48% 46%, 28% 100%, 20% 54%);
}
.face {
  top: 29px;
  left: 34px;
  width: 11px;
  height: 7px;
  border-width: 0 0 4px 0 !important;
  transform: skewX(-20deg);
}
.coat {
  top: 80px;
  left: 27px;
  width: 64px;
  height: 76px;
  background: #dc394d;
  clip-path: polygon(12% 0, 88% 0, 100% 100%, 52% 85%, 0 100%);
}
.leg {
  top: 145px;
  width: 24px;
  height: 62px;
  background: #34243d;
  transform-origin: top;
}
.leg-a {
  left: 32px;
  transform: rotate(8deg);
}
.leg-b {
  left: 65px;
  transform: rotate(-9deg);
}
.arm {
  top: 91px;
  width: 22px;
  height: 70px;
  border-radius: 12px;
  background: #dc394d;
  transform-origin: top;
}
.arm-a {
  left: 16px;
  transform: rotate(14deg);
}
.arm-b {
  left: 79px;
  transform: rotate(-18deg);
}
.indigo .hair {
  background: #17183f;
}
.indigo .coat,
.indigo .arm {
  background: #3757b8;
}
.indigo .head {
  background: #bd7a63;
}
.indigo .coat {
  clip-path: polygon(8% 0, 92% 0, 82% 100%, 52% 78%, 5% 100%);
}
.echo {
  z-index: -1;
  opacity: 0;
  transform: translate(34px, -30px) scale(1.12);
  filter: drop-shadow(0 0 8px #fff);
}
.echo-head {
  top: 5px;
  left: 34px;
  width: 55px;
  height: 54px;
  border-radius: 50%;
  background: #ffdf6f;
}
.echo-body {
  top: 57px;
  left: 28px;
  width: 66px;
  height: 82px;
  background: #ef794c;
  clip-path: polygon(50% 0, 100% 28%, 78% 100%, 18% 90%, 0 28%);
}
.echo-arm {
  top: 69px;
  width: 23px;
  height: 90px;
  border-radius: 12px;
  background: #ef794c;
}
.echo .arm-a {
  left: 14px;
}
.echo .arm-b {
  left: 83px;
}
.indigo .echo-head {
  background: #72e5ef;
}
.indigo .echo-body,
.indigo .echo-arm {
  background: #6655bd;
}
.action-light .arm-b,
.action-heavy .arm-b {
  height: 104px;
  transform: rotate(-78deg);
}
.action-heavy .body {
  transform: rotate(-8deg);
}
.action-special .echo,
.action-super .echo {
  opacity: 0.92;
}
.action-special .echo .arm-b,
.action-super .echo .arm-b {
  animation: barrage 0.12s steps(2) infinite;
}
.action-super .echo {
  transform: translate(45px, -42px) scale(1.32);
}
.action-jump .body {
  transform: rotate(-8deg);
}
.action-jump .leg-a {
  transform: rotate(48deg);
}
.action-jump .leg-b {
  transform: rotate(-46deg);
}
.action-guard .arm-a {
  transform: rotate(-52deg) translate(12px, -4px);
}
.action-guard .arm-b {
  transform: rotate(52deg) translate(-12px, -4px);
}
.action-dodge {
  opacity: 0.7;
  filter: drop-shadow(22px 0 #ffffff55);
}
.action-hurt .body {
  transform: rotate(-14deg) translateX(-10px);
}
.action-ko .body {
  transform: rotate(-82deg) translate(-42px, 24px);
}
.guard-flare,
.super-ring {
  position: absolute;
  inset: 30px 4px 16px;
  border: 5px solid #8cf2ff;
  border-radius: 50%;
  box-shadow: 0 0 20px #8cf2ff;
}
.super-ring {
  inset: -38px;
  border-color: #ffe769;
  animation: pulse 0.3s infinite alternate;
}
.impact {
  position: absolute;
  z-index: 12;
  color: #fff9cd;
  font-size: clamp(18px, 3vw, 35px);
  -webkit-text-stroke: 2px #2a172e;
  transform: rotate(-9deg);
  animation: impact 0.42s both;
  pointer-events: none;
}
.impact.block {
  color: #78edff;
}
.impact.super {
  color: #ffdd48;
}
.announcement {
  position: absolute;
  z-index: 20;
  inset: 38% 0 auto;
  color: #fff0a8;
  font-size: clamp(42px, 10vw, 94px);
  line-height: 1;
  text-align: center;
  -webkit-text-stroke: 4px #26172e;
  transform: skewX(-9deg);
}
.manga-cut {
  position: absolute;
  z-index: 16;
  inset: 8% -4% auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  min-height: 112px;
  border-block: 7px solid #1f1428;
  color: #21152b;
  background: #fff4c9;
  transform: rotate(-2deg);
  animation: cut-in 0.24s both;
}
.manga-cut strong {
  font-size: clamp(32px, 7vw, 74px);
}
.manga-cut span {
  font:
    800 15px 'Microsoft YaHei',
    sans-serif;
}
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 14px;
  padding: 12px 16px;
  border-top: 3px solid var(--ink);
  background: #171020;
  font:
    700 12px 'Microsoft YaHei',
    sans-serif;
}
.controls section {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 11px;
}
.controls section:last-child {
  justify-content: flex-end;
}
.controls strong {
  width: 100%;
  color: #ffcf4d;
}
.controls p {
  max-width: 180px;
  margin: auto;
  color: #cbbad8;
  text-align: center;
}
kbd {
  min-width: 22px;
  display: inline-block;
  margin-right: 2px;
  padding: 1px 5px;
  border: 1px solid #fff0c5;
  background: #392a45;
  color: #fff;
  text-align: center;
}
.touch-controls {
  display: none;
}
.shaking:not(.reduced) .arena {
  animation: shake 0.12s linear;
}
@keyframes barrage {
  to {
    transform: rotate(-78deg) translate(30px, -6px);
  }
}
@keyframes pulse {
  to {
    transform: scale(1.1);
    opacity: 0.5;
  }
}
@keyframes impact {
  from {
    transform: scale(0.2) rotate(14deg);
  }
  to {
    transform: scale(1.2) rotate(-9deg) translateY(-28px);
    opacity: 0;
  }
}
@keyframes cut-in {
  from {
    transform: translateX(-100%) rotate(-2deg);
  }
}
@keyframes shake {
  25% {
    transform: translate(5px, -2px);
  }
  75% {
    transform: translate(-5px, 2px);
  }
}
@media (max-width: 760px) {
  .fight-hud {
    grid-template-columns: minmax(0, 1fr) 68px minmax(0, 1fr);
    padding-inline: 8px;
  }
  .name-row span {
    display: none;
  }
  .round-clock strong {
    font-size: 34px;
  }
  .arena {
    min-height: 360px;
  }
  .fighter {
    transform: translateX(-50%) scale(0.78);
    transform-origin: bottom;
  }
  .fighter.flipped {
    transform: translateX(-50%) scale(-0.78, 0.78);
  }
  .controls {
    grid-template-columns: 1fr 1fr;
  }
  .controls p {
    display: none;
  }
  .touch-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 3px solid var(--ink);
    background: #171020;
  }
  .touch-side {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    padding: 6px;
  }
  .touch-side + .touch-side {
    border-left: 2px solid #4b3759;
  }
  .touch-side button {
    min-height: 44px;
    border: 1px solid #e8d6ff;
    border-radius: 4px;
    background: #392a45;
    color: #fff;
    font-weight: 900;
    touch-action: none;
  }
}
@media (max-width: 480px) {
  .starfall {
    min-width: 0;
  }
  .fight-hud {
    min-height: 88px;
  }
  .name-row strong {
    font-size: 13px;
  }
  .health {
    height: 13px;
  }
  .arena {
    min-height: 300px;
  }
  .controls {
    display: none;
  }
  .manga-cut span {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .starfall *,
  .starfall *::before,
  .starfall *::after {
    animation-duration: 0.001ms !important;
  }
}
</style>
