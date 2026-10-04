<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import UncleFighter from './UncleFighter.vue';
import {
  createBattle,
  emptyInput,
  nextRound,
  STEP_MS,
  step,
  type FighterInput,
  type Slot,
} from './rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const battle = shallowRef(createBattle());
const countdown = ref(180);
const roundPause = ref(0);
const flash = ref<{ slot: Slot; blocked: boolean; life: number } | null>(null);
const callout = ref('客厅擂台，谁先喊累谁洗碗');
const held = new Set<string>();
const queued: [Set<keyof FighterInput>, Set<keyof FighterInput>] = [new Set(), new Set()];
let animation = 0;
let previousTime = 0;
let accumulator = 0;
let announced = false;
let audio: AudioContext | undefined;

const keyMap: Record<string, { slot: Slot; action: keyof FighterInput; held: boolean }> = {
  KeyA: { slot: 0, action: 'left', held: true },
  KeyD: { slot: 0, action: 'right', held: true },
  KeyS: { slot: 0, action: 'guard', held: true },
  KeyW: { slot: 0, action: 'jump', held: false },
  KeyF: { slot: 0, action: 'light', held: false },
  KeyG: { slot: 0, action: 'heavy', held: false },
  KeyH: { slot: 0, action: 'special', held: false },
  ArrowLeft: { slot: 1, action: 'left', held: true },
  ArrowRight: { slot: 1, action: 'right', held: true },
  ArrowDown: { slot: 1, action: 'guard', held: true },
  ArrowUp: { slot: 1, action: 'jump', held: false },
  KeyJ: { slot: 1, action: 'light', held: false },
  KeyK: { slot: 1, action: 'heavy', held: false },
  KeyL: { slot: 1, action: 'special', held: false },
};

const phase = computed(() =>
  countdown.value > 0 && battle.value.phase === 'fight' ? 'countdown' : battle.value.phase,
);
const timer = computed(() => Math.ceil(battle.value.timerFrames / 60));
const roundMessage = computed(() => {
  if (battle.value.winner === 'draw') return '两位都说自己没输';
  return battle.value.winner === 0 ? '锅铲舅拿下一局' : '保温杯舅拿下一局';
});

function sound(kind: 'hit' | 'block' | 'special' | 'round') {
  if (props.settings.masterVolume <= 0) return;
  audio ??= new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  const tones = { hit: 110, block: 310, special: 72, round: 520 };
  oscillator.type = kind === 'block' ? 'triangle' : kind === 'round' ? 'sine' : 'square';
  oscillator.frequency.setValueAtTime(tones[kind], now);
  oscillator.frequency.exponentialRampToValueAtTime(tones[kind] * 1.65, now + 0.09);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08 * props.settings.masterVolume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.13);
}

function buildInput(slot: Slot): FighterInput {
  const input = emptyInput();
  for (const [code, mapping] of Object.entries(keyMap))
    if (mapping.slot === slot && mapping.held && held.has(code)) input[mapping.action] = true;
  for (const command of queued[slot]) input[command] = true;
  queued[slot].clear();
  return input;
}

function processEvents() {
  for (const event of battle.value.events) {
    if ((event.type === 'hit' || event.type === 'block') && event.target !== undefined) {
      flash.value = { slot: event.target, blocked: event.type === 'block', life: 12 };
      callout.value =
        event.type === 'block'
          ? '早就料到你要来这套'
          : event.actor === 0
            ? '这一铲，有家的味道'
            : '保温杯里泡的是胜负欲';
      sound(event.type);
    } else if (event.type === 'special') {
      callout.value = event.actor === 0 ? '看我的年夜饭回旋铲！' : '养生冲击，趁热喝！';
      sound('special');
    } else if (event.type === 'round') {
      roundPause.value = 105;
      sound('round');
    }
  }
}

function finishMatch() {
  if (announced || battle.value.phase !== 'match-end') return;
  announced = true;
  const winner = battle.value.scores[0] > battle.value.scores[1] ? 0 : 1;
  emit('finish', {
    gameId: 'uncle',
    sessionId: props.sessionId,
    outcome: winner === 0 ? 'win' : 'lose',
    durationMs: Math.round(battle.value.elapsedFrames * STEP_MS),
    summary:
      winner === 0 ? '锅铲舅守住了年夜饭的最后尊严。' : '保温杯舅证明了养生也可以很有攻击性。',
    story: {
      title: winner === 0 ? '锅铲舅胜出！' : '保温杯舅胜出！',
      body: `最终比分 ${battle.value.scores[0]} : ${battle.value.scores[1]}。输家负责洗碗，赢家负责在旁边指导。`,
    },
    stats: {
      rounds: battle.value.round,
      wokWins: battle.value.scores[0],
      thermosWins: battle.value.scores[1],
    },
  });
}

function simulate() {
  if (flash.value) {
    flash.value.life -= 1;
    if (flash.value.life <= 0) flash.value = null;
  }
  if (countdown.value > 0) {
    countdown.value -= 1;
    if (countdown.value === 0) callout.value = '开饭，不对，开打！';
    return;
  }
  if (roundPause.value > 0) {
    roundPause.value -= 1;
    if (roundPause.value === 0) {
      if (battle.value.phase === 'round-end') {
        battle.value = nextRound(battle.value);
        countdown.value = 120;
        callout.value = `第 ${battle.value.round} 回合，亲戚们还在看`;
      } else {
        finishMatch();
      }
    }
    return;
  }
  battle.value = step(battle.value, [buildInput(0), buildInput(1)]);
  processEvents();
}

function loop(time: number) {
  if (!previousTime) previousTime = time;
  const delta = Math.min(50, time - previousTime);
  previousTime = time;
  if (!props.paused) {
    accumulator += delta;
    while (accumulator >= STEP_MS) {
      simulate();
      accumulator -= STEP_MS;
    }
    triggerRef(battle);
  }
  animation = requestAnimationFrame(loop);
}

function onKeyDown(event: KeyboardEvent) {
  const mapping = keyMap[event.code];
  if (!mapping || event.repeat) return;
  if (!(event.target instanceof HTMLElement && event.target.closest('input, textarea, button')))
    event.preventDefault();
  void audio?.resume();
  if (mapping.held) held.add(event.code);
  else queued[mapping.slot].add(mapping.action);
}

function onKeyUp(event: KeyboardEvent) {
  if (keyMap[event.code]?.held) held.delete(event.code);
}

function clearInput() {
  held.clear();
  queued[0].clear();
  queued[1].clear();
}

watch(
  () => props.paused,
  (paused) => {
    if (paused) clearInput();
    previousTime = 0;
    accumulator = 0;
  },
);

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearInput);
  animation = requestAnimationFrame(loop);
});
onUnmounted(() => {
  cancelAnimationFrame(animation);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  window.removeEventListener('blur', clearInput);
  void audio?.close();
});
</script>

<template>
  <main
    class="uncle-game"
    :data-phase="phase"
    :data-timer="timer"
    :data-round="battle.round"
    tabindex="0"
    aria-label="舅舅的奇妙冒险双人格斗场"
  >
    <header class="uncle-hud">
      <div class="uncle-status">
        <div class="uncle-label">
          <span>P1 · 锅铲舅</span><b>{{ battle.scores[0] }}</b>
        </div>
        <div class="health-track">
          <span :style="{ width: `${battle.fighters[0].hp}%` }"></span>
        </div>
        <small>绝活 {{ Math.ceil(battle.fighters[0].specialCooldown / 60) || '就绪' }}</small>
      </div>
      <div class="round-clock">
        <small>ROUND {{ battle.round }}</small>
        <strong>{{ timer }}</strong>
        <span>{{ battle.scores[0] }} - {{ battle.scores[1] }}</span>
      </div>
      <div class="uncle-status rival">
        <div class="uncle-label">
          <b>{{ battle.scores[1] }}</b
          ><span>保温杯舅 · P2</span>
        </div>
        <div class="health-track">
          <span :style="{ width: `${battle.fighters[1].hp}%` }"></span>
        </div>
        <small>绝活 {{ Math.ceil(battle.fighters[1].specialCooldown / 60) || '就绪' }}</small>
      </div>
    </header>

    <section class="uncle-arena">
      <div class="family-wall" aria-hidden="true">
        <div class="banner">舅 舅 杯</div>
        <div class="portrait p-one"><span>全家福</span></div>
        <div class="portrait p-two"><span>优秀亲戚</span></div>
        <div class="clock">10:08</div>
        <div class="sofa"></div>
        <div class="tea-table"><i></i><i></i><i></i></div>
      </div>
      <div class="arena-floor" aria-hidden="true"></div>
      <div v-if="countdown === 0 && roundPause === 0" class="callout" role="status">
        {{ callout }}
      </div>
      <div
        v-for="(fighter, slot) in battle.fighters"
        :key="slot"
        class="fighter-shell"
        :class="{ damaged: flash?.slot === slot, blocked: flash?.slot === slot && flash.blocked }"
        :style="{
          left: `${(fighter.x / 960) * 100}%`,
          bottom: `${13 + (fighter.y / 480) * 100}%`,
        }"
        :data-testid="`uncle-fighter-${slot}`"
        :data-hp="fighter.hp"
        :data-action="fighter.action"
        :data-x="fighter.x.toFixed(1)"
      >
        <UncleFighter :fighter-slot="slot as Slot" :fighter="fighter" />
        <span v-if="flash?.slot === slot" class="impact-word">{{
          flash.blocked ? '挡！' : '啪！'
        }}</span>
      </div>
      <div v-if="countdown > 0" class="fight-overlay countdown" aria-live="polite">
        <small>第 {{ battle.round }} 回合</small>
        <strong>{{ Math.ceil(countdown / 60) }}</strong>
        <span>亲戚请退到电视机外</span>
      </div>
      <div v-else-if="roundPause > 0" class="fight-overlay round-result" aria-live="polite">
        <small>{{ battle.phase === 'match-end' ? 'FINAL' : `ROUND ${battle.round}` }}</small>
        <strong>{{ roundMessage }}</strong>
        <span>{{ battle.scores[0] }} : {{ battle.scores[1] }}</span>
      </div>
    </section>

    <section class="control-strip" aria-label="键盘操作说明">
      <div class="player-guide red">
        <b>P1 锅铲舅</b>
        <span><kbd>A</kbd><kbd>D</kbd> 移动</span>
        <span><kbd>W</kbd> 跳</span>
        <span><kbd>S</kbd> 防</span>
        <span><kbd>F</kbd> 轻击</span>
        <span><kbd>G</kbd> 重击</span>
        <span><kbd>H</kbd> 回旋铲</span>
      </div>
      <div class="versus-mark" aria-hidden="true">VS</div>
      <div class="player-guide blue">
        <b>P2 保温杯舅</b>
        <span><kbd>←</kbd><kbd>→</kbd> 移动</span>
        <span><kbd>↑</kbd> 跳</span>
        <span><kbd>↓</kbd> 防</span>
        <span><kbd>J</kbd> 轻击</span>
        <span><kbd>K</kbd> 重击</span>
        <span><kbd>L</kbd> 养生冲击</span>
      </div>
    </section>
  </main>
</template>

<style scoped>
.uncle-game {
  --ink: #25332e;
  width: 100%;
  min-height: 640px;
  overflow: hidden;
  color: #fff8dd;
  background: #1f3f41;
  font-family: Inter, 'Microsoft YaHei', sans-serif;
  outline: none;
}
.uncle-hud {
  min-height: 104px;
  display: grid;
  grid-template-columns: 1fr 110px 1fr;
  align-items: center;
  gap: 18px;
  padding: 18px 24px;
  background: #182b2c;
  border-bottom: 4px solid #f2bd4d;
}
.uncle-status {
  min-width: 0;
}
.uncle-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 900;
}
.uncle-label b {
  font-size: 24px;
  color: #f7ca63;
}
.health-track {
  height: 18px;
  margin-top: 5px;
  overflow: hidden;
  border: 3px solid #fff4d2;
  background: #5a2828;
  transform: skewX(-8deg);
}
.health-track span {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #ef684e, #ffca63);
  transition: width 0.16s ease;
}
.rival {
  text-align: right;
}
.rival .health-track span {
  margin-left: auto;
  background: linear-gradient(90deg, #8ee0d0, #3d9cad);
}
.uncle-status small {
  display: block;
  margin-top: 5px;
  color: #b9d0c8;
  font-size: 11px;
}
.round-clock {
  text-align: center;
}
.round-clock small,
.round-clock span {
  display: block;
  color: #d8cda6;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1px;
}
.round-clock strong {
  display: block;
  font-family: Impact, sans-serif;
  font-size: 45px;
  line-height: 0.95;
  color: #fff2b8;
  letter-spacing: 0;
}
.uncle-arena {
  position: relative;
  aspect-ratio: 2 / 1;
  max-height: 560px;
  overflow: hidden;
  background: #d7c28d;
  isolation: isolate;
}
.family-wall {
  position: absolute;
  inset: 0 0 22%;
  overflow: hidden;
  background:
    linear-gradient(#f8e5a4 1px, transparent 1px),
    linear-gradient(90deg, #f8e5a4 1px, transparent 1px), #d8c68f;
  background-size: 38px 38px;
  border-bottom: 11px solid #5f4a34;
}
.family-wall::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #9a3d3022, transparent 25%, transparent 75%, #286d7322);
}
.banner {
  position: absolute;
  top: 8%;
  left: 50%;
  transform: translateX(-50%) rotate(-1deg);
  padding: 8px 30px;
  border: 5px solid #f7d66c;
  background: #b8322e;
  box-shadow: 6px 7px 0 #6a2925;
  color: #fff1bb;
  font-size: clamp(16px, 3vw, 32px);
  font-weight: 1000;
  letter-spacing: 0;
  white-space: nowrap;
}
.portrait {
  position: absolute;
  top: 17%;
  width: 12%;
  height: 28%;
  display: grid;
  place-items: end center;
  border: 8px solid #714c2c;
  background:
    radial-gradient(circle at 50% 42%, #e0ae83 0 16%, transparent 17%),
    radial-gradient(ellipse at 50% 85%, #7d8a68 0 30%, transparent 31%), #b9d3ca;
  box-shadow: 5px 6px 0 #49352055;
}
.portrait span {
  width: 100%;
  padding: 3px;
  text-align: center;
  background: #fff6d8;
  color: #624f36;
  font-size: 9px;
}
.p-one {
  left: 8%;
}
.p-two {
  right: 8%;
  background:
    radial-gradient(circle at 50% 42%, #d89f78 0 16%, transparent 17%),
    radial-gradient(ellipse at 50% 85%, #6b8789 0 30%, transparent 31%), #d2d9a9;
}
.clock {
  position: absolute;
  right: 25%;
  top: 12%;
  padding: 8px 11px;
  border: 5px solid #473c31;
  background: #f4edcf;
  color: #3c3931;
  font-family: monospace;
  font-weight: 900;
}
.sofa {
  position: absolute;
  left: 2%;
  bottom: -7%;
  width: 29%;
  height: 30%;
  border: 6px solid #354d48;
  border-radius: 20px 20px 0 0;
  background: #5f8e7e;
}
.tea-table {
  position: absolute;
  right: 3%;
  bottom: -2%;
  width: 27%;
  height: 8%;
  border: 5px solid #493923;
  background: #9d713d;
}
.tea-table::before,
.tea-table::after {
  content: '';
  position: absolute;
  top: 100%;
  width: 6px;
  height: 45px;
  background: #493923;
}
.tea-table::before {
  left: 15%;
}
.tea-table::after {
  right: 15%;
}
.tea-table i {
  position: relative;
  display: inline-block;
  width: 15%;
  height: 18px;
  margin: -20px 6%;
  border-radius: 10px 10px 3px 3px;
  background: #f5e6c4;
  border: 3px solid #4f665d;
}
.arena-floor {
  position: absolute;
  inset: 78% 0 0;
  background:
    linear-gradient(90deg, transparent 49%, #8b765b55 50%, transparent 51%) 0 0 / 88px 100%,
    linear-gradient(#a8865c, #c4a476);
}
.arena-floor::after {
  content: '';
  position: absolute;
  left: 18%;
  right: 18%;
  bottom: 8%;
  height: 42%;
  border: 5px solid #9e3f35;
  background: repeating-linear-gradient(90deg, #c94b3e 0 20px, #f2c164 20px 40px);
  opacity: 0.75;
}
.fighter-shell {
  position: absolute;
  z-index: 3;
  width: 13%;
  height: 45%;
  transform: translateX(-50%);
  transition: filter 0.08s;
}
.fighter-shell.damaged {
  filter: brightness(1.8) saturate(0.2);
}
.fighter-shell.blocked {
  filter: drop-shadow(0 0 10px #fff7a8);
}
.impact-word {
  position: absolute;
  top: 10%;
  right: -25%;
  padding: 4px 8px;
  border: 3px solid #242f2e;
  background: #fff1a6;
  color: #5f2a25;
  font-size: clamp(12px, 2vw, 22px);
  font-weight: 1000;
  transform: rotate(-8deg);
}
.callout {
  position: absolute;
  z-index: 4;
  left: 50%;
  bottom: 3%;
  max-width: 66%;
  transform: translateX(-50%);
  padding: 6px 15px;
  border: 2px solid #213837;
  background: #fff2cddd;
  color: #31413b;
  font-size: clamp(10px, 1.5vw, 14px);
  font-weight: 800;
  text-align: center;
}
.fight-overlay {
  position: absolute;
  z-index: 6;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  background: #17363875;
  text-shadow: 4px 4px #243b39;
}
.fight-overlay small,
.fight-overlay span {
  font-size: clamp(10px, 1.6vw, 16px);
  font-weight: 900;
}
.fight-overlay strong {
  color: #fff0a6;
  font-size: clamp(48px, 10vw, 112px);
  line-height: 1.05;
  letter-spacing: 0;
}
.round-result strong {
  padding: 0 14px;
  font-size: clamp(24px, 5vw, 58px);
  text-align: center;
}
.control-strip {
  display: grid;
  grid-template-columns: 1fr 52px 1fr;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: #172d2e;
  border-top: 1px solid #76918b;
}
.player-guide {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 7px 12px;
  font-size: 11px;
  color: #d9e9df;
}
.player-guide b {
  width: 100%;
  font-size: 13px;
}
.player-guide.blue {
  justify-content: flex-end;
  text-align: right;
}
kbd {
  display: inline-grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  margin-right: 2px;
  border: 1px solid #92aaa3;
  border-bottom-width: 3px;
  border-radius: 4px;
  background: #304a48;
  color: white;
  font-family: inherit;
  font-weight: 900;
}
.red b {
  color: #ff9b83;
}
.blue b {
  color: #91e1dd;
}
.versus-mark {
  color: #f2c45c;
  font-family: Impact, sans-serif;
  font-size: 28px;
  text-align: center;
  transform: rotate(-8deg);
}
@media (max-width: 700px) {
  .uncle-game {
    min-height: 0;
  }
  .uncle-hud {
    grid-template-columns: 1fr 62px 1fr;
    gap: 6px;
    min-height: 78px;
    padding: 10px 9px;
  }
  .uncle-label {
    font-size: 10px;
  }
  .uncle-label b {
    font-size: 17px;
  }
  .health-track {
    height: 13px;
    border-width: 2px;
  }
  .uncle-status small {
    font-size: 9px;
  }
  .round-clock strong {
    font-size: 30px;
  }
  .uncle-arena {
    min-height: 230px;
    aspect-ratio: 1.55 / 1;
  }
  .fighter-shell {
    width: 18%;
    height: 42%;
  }
  .portrait {
    display: none;
  }
  .clock {
    display: none;
  }
  .banner {
    top: 7%;
  }
  .control-strip {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 13px;
  }
  .versus-mark {
    display: none;
  }
  .player-guide,
  .player-guide.blue {
    justify-content: flex-start;
    text-align: left;
    gap: 7px;
  }
  .player-guide + .player-guide {
    padding-top: 11px;
    border-top: 1px solid #49615e;
  }
}
@media (max-width: 390px) {
  .uncle-arena {
    min-height: 220px;
  }
  .fighter-shell {
    width: 21%;
    height: 43%;
  }
  .player-guide span {
    font-size: 10px;
  }
  .callout {
    max-width: 88%;
    width: max-content;
  }
}
</style>
