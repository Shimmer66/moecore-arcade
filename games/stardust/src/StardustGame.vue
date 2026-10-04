<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { GameEvents, GameProps } from '@moecore/game-sdk';
import { STARDUST_ART } from '@moecore/assets/stardust';

type Mode = 'versus' | 'adventure';
type FighterId = 'jotaro' | 'kakyoin' | 'avdol' | 'polnareff';
type Side = 'p1' | 'p2';
type Action = 'light' | 'heavy' | 'stand' | 'guard' | 'special';

interface Fighter {
  id: FighterId;
  name: string;
  stand: string;
  role: string;
  color: string;
  accent: string;
  special: string;
}

interface Combatant {
  id: FighterId | 'dio' | 'ice' | 'holhorse';
  name: string;
  hp: number;
  maxHp: number;
  energy: number;
  x: number;
  facing: 1 | -1;
  guard: boolean;
  stun: number;
  attack: Action | null;
  attackFrames: number;
  combo: number;
  down: boolean;
}

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const roster: readonly Fighter[] = [
  {
    id: 'jotaro',
    name: '空条承太郎',
    stand: '白金之星',
    role: '近战压制',
    color: '#23335f',
    accent: '#53d5d0',
    special: '觉醒时停',
  },
  {
    id: 'kakyoin',
    name: '花京院典明',
    stand: '绿色法皇',
    role: '远程控制',
    color: '#225c48',
    accent: '#ec5f70',
    special: '绿宝石结界',
  },
  {
    id: 'avdol',
    name: '穆罕默德·阿布德尔',
    stand: '红色魔术师',
    role: '火焰爆发',
    color: '#783929',
    accent: '#ffbd3f',
    special: '十字火焰',
  },
  {
    id: 'polnareff',
    name: '简·皮耶尔·波鲁那雷夫',
    stand: '银色战车',
    role: '高速突进',
    color: '#707b94',
    accent: '#d7ecff',
    special: '银光连斩',
  },
];

const phase = ref<'select' | 'fight' | 'result'>('select');
const mode = ref<Mode>('adventure');
const playerOne = ref<FighterId>('jotaro');
const playerTwo = ref<FighterId>('kakyoin');
const p1 = ref<Combatant>();
const p2 = ref<Combatant>();
const revives = ref(3);
const wave = ref(1);
const timer = ref(75);
const message = ref('选择模式与角色，开始星尘远征。');
const impact = ref('');
const stopped = ref<Side | null>(null);
const startedAt = ref(0);
const keys = new Set<string>();
let raf = 0;
let last = 0;
let timerCarry = 0;

const selectedOne = computed(() => roster.find((fighter) => fighter.id === playerOne.value)!);
const selectedTwo = computed(() => roster.find((fighter) => fighter.id === playerTwo.value)!);
const adventure = computed(() => mode.value === 'adventure');
const battleTitle = computed(() =>
  adventure.value ? `开罗远征 · 第 ${wave.value} 战` : '本地双人格斗',
);
const enemyNames = ['荷尔·荷斯', '瓦尼拉·艾斯', 'DIO'];

function isFighterId(id: Combatant['id']): id is FighterId {
  return roster.some((fighter) => fighter.id === id);
}

function artStyle(id: FighterId) {
  return {
    '--fighter-art': `url("${STARDUST_ART.fighters[id]}")`,
  };
}

function combatant(id: FighterId, side: Side): Combatant {
  const fighter = roster.find((item) => item.id === id)!;
  return {
    id,
    name: fighter.name,
    hp: 100,
    maxHp: 100,
    energy: side === 'p1' ? 30 : 20,
    x: side === 'p1' ? 25 : 75,
    facing: side === 'p1' ? 1 : -1,
    guard: false,
    stun: 0,
    attack: null,
    attackFrames: 0,
    combo: 0,
    down: false,
  };
}

function enemyForWave(current: number): Combatant {
  const hp = current === 3 ? 155 : current === 2 ? 125 : 105;
  return {
    id: current === 3 ? 'dio' : current === 2 ? 'ice' : 'holhorse',
    name: enemyNames[current - 1]!,
    hp,
    maxHp: hp,
    energy: current * 20,
    x: 76,
    facing: -1,
    guard: false,
    stun: 0,
    attack: null,
    attackFrames: 0,
    combo: 0,
    down: false,
  };
}

function start() {
  phase.value = 'fight';
  revives.value = 3;
  wave.value = 1;
  timer.value = adventure.value ? 90 : 75;
  timerCarry = 0;
  p1.value = combatant(playerOne.value, 'p1');
  p2.value = adventure.value ? enemyForWave(1) : combatant(playerTwo.value, 'p2');
  message.value = adventure.value
    ? `${selectedOne.value.name}与${selectedTwo.value.name}共享三次复活。`
    : `${selectedOne.value.name} 对 ${selectedTwo.value.name}`;
  impact.value = 'ROUND 1';
  stopped.value = null;
  startedAt.value = performance.now();
  window.setTimeout(() => (impact.value = ''), 850);
}

function restartSelection() {
  phase.value = 'select';
  p1.value = undefined;
  p2.value = undefined;
  stopped.value = null;
  impact.value = '';
  message.value = '选择模式与角色，开始星尘远征。';
}

function distance() {
  return p1.value && p2.value ? Math.abs(p1.value.x - p2.value.x) : 100;
}

function strike(attacker: Combatant, defender: Combatant, action: Action) {
  if (attacker.stun > 0 || attacker.attackFrames > 0 || attacker.down) return;
  const specs = {
    light: { range: 13, damage: 7, frames: 15, energy: 8, word: '砰' },
    heavy: { range: 17, damage: 13, frames: 25, energy: 12, word: '轰' },
    stand: { range: 24, damage: 10, frames: 22, energy: 10, word: '连打' },
    special: { range: 32, damage: 28, frames: 38, energy: 0, word: '决胜' },
    guard: { range: 0, damage: 0, frames: 0, energy: 0, word: '' },
  }[action];
  if (action === 'special' && attacker.energy < 100) {
    message.value = '能量达到100才能发动超必杀。';
    return;
  }
  attacker.attack = action;
  attacker.attackFrames = specs.frames;
  if (action === 'special') attacker.energy = 0;
  if (distance() > specs.range) {
    attacker.combo = 0;
    return;
  }
  const guarded = defender.guard;
  const damage = guarded ? Math.max(1, Math.round(specs.damage * 0.2)) : specs.damage;
  defender.hp = Math.max(0, defender.hp - damage);
  defender.stun = guarded ? 6 : action === 'special' ? 30 : 13;
  defender.x = Math.min(
    94,
    Math.max(6, defender.x + attacker.facing * (action === 'heavy' ? 5 : 2)),
  );
  attacker.energy = Math.min(100, attacker.energy + specs.energy);
  attacker.combo += 1;
  impact.value = guarded ? '铿' : specs.word;
  message.value = guarded
    ? `${defender.name}防住了攻击`
    : `${attacker.name} · ${attacker.combo} HIT`;
  window.setTimeout(() => {
    if (impact.value === specs.word || impact.value === '铿') impact.value = '';
  }, 180);
  if (defender.hp <= 0) handleKnockout(defender);
}

function handleKnockout(defender: Combatant) {
  defender.down = true;
  impact.value = 'K.O.';
  if (adventure.value && defender === p1.value) {
    if (revives.value > 0) {
      revives.value -= 1;
      message.value = `队友救援成功，剩余 ${revives.value} 次复活`;
      window.setTimeout(() => {
        if (!p1.value) return;
        p1.value.hp = 60;
        p1.value.down = false;
        p1.value.x = 23;
        impact.value = '再起';
      }, 900);
      return;
    }
    finish(false, '三次复活已经用尽，远征失败。');
    return;
  }
  if (defender === p2.value && adventure.value) {
    if (wave.value < 3) {
      message.value = `${defender.name}被击败，继续深入开罗。`;
      window.setTimeout(() => {
        wave.value += 1;
        timer.value = 90;
        p2.value = enemyForWave(wave.value);
        if (p1.value) {
          p1.value.hp = Math.min(p1.value.maxHp, p1.value.hp + 35);
          p1.value.energy = Math.min(100, p1.value.energy + 25);
          p1.value.x = 24;
        }
        impact.value = `第 ${wave.value} 战`;
      }, 950);
      return;
    }
    finish(true, 'DIO被击败，承太郎在决战中掌握了短暂时停。');
    return;
  }
  finish(defender === p2.value, `${defender.name}倒下了。`);
}

function finish(win: boolean, summary: string) {
  phase.value = 'result';
  stopped.value = null;
  message.value = summary;
  emit('finish', {
    gameId: 'stardust',
    sessionId: props.sessionId,
    outcome: win ? 'win' : 'lose',
    durationMs: Math.max(0, performance.now() - startedAt.value),
    summary,
    stats: {
      waves: wave.value,
      revivesLeft: revives.value,
      combo: p1.value?.combo ?? 0,
    },
    reselectLabel: '重新选角',
  });
}

function act(side: Side, action: Action) {
  if (props.paused || phase.value !== 'fight' || !p1.value || !p2.value) return;
  const attacker = side === 'p1' ? p1.value : p2.value;
  const defender = side === 'p1' ? p2.value : p1.value;
  if (adventure.value && side === 'p2') return;
  if (stopped.value && stopped.value !== side) return;
  strike(attacker, defender, action);
}

function move(side: Side, amount: number) {
  if (props.paused || phase.value !== 'fight' || !p1.value || !p2.value) return;
  const fighter = side === 'p1' ? p1.value : p2.value;
  if (adventure.value && side === 'p2') return;
  if (fighter.stun || fighter.down || (stopped.value && stopped.value !== side)) return;
  fighter.x = Math.min(94, Math.max(6, fighter.x + amount));
}

function timeStop(side: Side) {
  if (!p1.value || !p2.value || stopped.value || props.paused) return;
  const fighter = side === 'p1' ? p1.value : p2.value;
  if (fighter.id !== 'jotaro' || fighter.energy < 100) {
    message.value = '觉醒承太郎需要100能量才能时停。';
    return;
  }
  fighter.energy = 0;
  stopped.value = side;
  impact.value = '时间停止';
  message.value = '一秒内只有觉醒者能够行动。';
  window.setTimeout(() => {
    stopped.value = null;
    impact.value = '时间开始流动';
    window.setTimeout(() => (impact.value = ''), 450);
  }, 1000);
}

function keydown(event: KeyboardEvent) {
  if (event.repeat || phase.value !== 'fight') return;
  keys.add(event.code);
  const target = event.target as HTMLElement;
  if (target.closest('button, input, select')) return;
  const bindings: Partial<Record<string, () => void>> = {
    KeyJ: () => act('p1', 'light'),
    KeyK: () => act('p1', 'heavy'),
    KeyU: () => act('p1', 'stand'),
    KeyI: () => act('p1', 'special'),
    KeyT: () => timeStop('p1'),
    Digit1: () => act('p2', 'light'),
    Digit2: () => act('p2', 'heavy'),
    Digit4: () => act('p2', 'stand'),
    Digit6: () => act('p2', 'special'),
    Digit5: () => timeStop('p2'),
  };
  if (bindings[event.code]) {
    event.preventDefault();
    bindings[event.code]!();
  }
}

function keyup(event: KeyboardEvent) {
  keys.delete(event.code);
}

function tick(now: number) {
  const dt = Math.min(34, now - last || 16.7);
  last = now;
  if (!props.paused && phase.value === 'fight' && p1.value && p2.value) {
    p1.value.guard = keys.has('KeyL');
    p2.value.guard = !adventure.value && keys.has('Digit3');
    if (keys.has('KeyA')) move('p1', -0.18 * dt);
    if (keys.has('KeyD')) move('p1', 0.18 * dt);
    if (!adventure.value && keys.has('ArrowLeft')) move('p2', -0.18 * dt);
    if (!adventure.value && keys.has('ArrowRight')) move('p2', 0.18 * dt);
    for (const fighter of [p1.value, p2.value]) {
      fighter.stun = Math.max(0, fighter.stun - 1);
      fighter.attackFrames = Math.max(0, fighter.attackFrames - 1);
      if (!fighter.attackFrames) fighter.attack = null;
    }
    p1.value.facing = p1.value.x <= p2.value.x ? 1 : -1;
    p2.value.facing = p2.value.x <= p1.value.x ? 1 : -1;
    if (adventure.value && !stopped.value && !p2.value.down) {
      const enemy = p2.value;
      if (distance() > 16) enemy.x += (p1.value.x < enemy.x ? -1 : 1) * 0.055 * dt;
      else if (Math.random() < dt / 950)
        strike(enemy, p1.value, wave.value === 3 ? 'stand' : 'heavy');
    }
    if (!stopped.value) {
      timerCarry += dt;
      if (timerCarry >= 1000) {
        timer.value = Math.max(0, timer.value - 1);
        timerCarry -= 1000;
        if (timer.value === 0) finish((p1.value.hp ?? 0) >= (p2.value.hp ?? 0), '时间到。');
      }
    }
  }
  raf = requestAnimationFrame(tick);
}

watch(
  () => props.attempt,
  () => {
    if (props.restartMode === 'select') restartSelection();
    else if (phase.value !== 'select') start();
  },
);

onMounted(() => {
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  raf = requestAnimationFrame(tick);
});
onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('keydown', keydown);
  window.removeEventListener('keyup', keyup);
});
</script>

<template>
  <main class="stardust" :data-phase="phase" :data-mode="mode" data-testid="stardust-game">
    <section v-if="phase === 'select'" class="select-screen">
      <header>
        <span>STAND BATTLE / CAIRO ROUTE</span>
        <h2>星尘远征：<strong>替身决斗</strong></h2>
        <p>选择角色，踏上通往开罗的最后旅程。</p>
      </header>

      <div class="mode-tabs" role="group" aria-label="选择游戏模式">
        <button :aria-pressed="mode === 'adventure'" @click="mode = 'adventure'">
          <b>双人冒险</b><span>共享三次复活，连续挑战三名敌人</span>
        </button>
        <button :aria-pressed="mode === 'versus'" @click="mode = 'versus'">
          <b>双人格斗</b><span>同机一对一，三局两胜原型</span>
        </button>
      </div>

      <div class="selection-grid">
        <section>
          <div class="section-heading">
            <span>01</span>
            <h3>玩家一</h3>
          </div>
          <div class="roster" role="group" aria-label="玩家一选择角色">
            <button
              v-for="fighter in roster"
              :key="fighter.id"
              :aria-pressed="playerOne === fighter.id"
              :style="{
                '--fighter': fighter.color,
                '--accent': fighter.accent,
                ...artStyle(fighter.id),
              }"
              @click="playerOne = fighter.id"
            >
              <i class="roster-art" aria-hidden="true"></i>
              <span>{{ fighter.role }}</span>
              <b>{{ fighter.name }}</b>
              <small>{{ fighter.stand }}</small>
            </button>
          </div>
        </section>

        <section>
          <div class="section-heading">
            <span>02</span>
            <h3>{{ adventure ? '同行伙伴' : '玩家二' }}</h3>
          </div>
          <div
            class="roster"
            role="group"
            :aria-label="adventure ? '选择同行伙伴' : '玩家二选择角色'"
          >
            <button
              v-for="fighter in roster"
              :key="fighter.id"
              :aria-pressed="playerTwo === fighter.id"
              :style="{
                '--fighter': fighter.color,
                '--accent': fighter.accent,
                ...artStyle(fighter.id),
              }"
              @click="playerTwo = fighter.id"
            >
              <i class="roster-art" aria-hidden="true"></i>
              <span>{{ fighter.role }}</span>
              <b>{{ fighter.name }}</b>
              <small>{{ fighter.stand }}</small>
            </button>
          </div>
        </section>
      </div>

      <aside class="mission-card">
        <div>
          <span>{{ adventure ? '剧情任务' : '对战规则' }}</span>
          <strong>{{ selectedOne.name }} × {{ selectedTwo.name }}</strong>
          <p v-if="adventure">
            击败荷尔·荷斯、瓦尼拉·艾斯与DIO。倒地后由同伴救援，全队共三次复活。
          </p>
          <p v-else>双方使用独立键位战斗。积攒能量，发动替身必杀决定胜负。</p>
        </div>
        <button class="start-button" data-testid="stardust-start" @click="start">
          开始{{ adventure ? '远征' : '对战' }} <span>→</span>
        </button>
      </aside>
    </section>

    <section v-else class="battle-screen" :class="{ frozen: !!stopped }">
      <header class="battle-head">
        <div>
          <span>{{ battleTitle }}</span>
          <strong>{{ message }}</strong>
        </div>
        <div class="clock">
          <b>{{ timer }}</b
          ><span>TIME</span>
        </div>
        <div v-if="adventure" class="revives" data-testid="stardust-revives">
          <span>共享复活</span><b>{{ '◆'.repeat(revives) }}{{ '◇'.repeat(3 - revives) }}</b>
        </div>
      </header>

      <div class="hud">
        <div class="fighter-hud">
          <div>
            <b>{{ p1?.name }}</b
            ><span>P1</span>
          </div>
          <div class="health">
            <i :style="{ width: `${((p1?.hp ?? 0) / (p1?.maxHp ?? 1)) * 100}%` }"></i>
          </div>
          <div class="energy">
            <i :style="{ width: `${p1?.energy ?? 0}%` }"></i
            ><span>STAND {{ p1?.energy ?? 0 }}</span>
          </div>
        </div>
        <div class="fighter-hud enemy">
          <div>
            <span>{{ adventure ? `WAVE ${wave}/3` : 'P2' }}</span
            ><b>{{ p2?.name }}</b>
          </div>
          <div class="health">
            <i :style="{ width: `${((p2?.hp ?? 0) / (p2?.maxHp ?? 1)) * 100}%` }"></i>
          </div>
          <div class="energy">
            <i :style="{ width: `${p2?.energy ?? 0}%` }"></i
            ><span>STAND {{ p2?.energy ?? 0 }}</span>
          </div>
        </div>
      </div>

      <div class="arena" data-testid="stardust-arena">
        <div class="sun" aria-hidden="true"></div>
        <div class="city" aria-hidden="true"><i v-for="n in 9" :key="n"></i></div>
        <div class="speed-lines" aria-hidden="true"></div>
        <div v-if="impact" class="impact" aria-live="polite">{{ impact }}</div>
        <div
          v-if="p1"
          class="combatant player"
          :class="{ attacking: p1.attack, guarding: p1.guard, down: p1.down }"
          :style="{ left: `${p1.x}%`, transform: `translateX(-50%) scaleX(${p1.facing})` }"
          data-testid="stardust-p1"
        >
          <div
            v-if="isFighterId(p1.id)"
            class="fighter-art"
            :style="artStyle(p1.id)"
            aria-hidden="true"
          ></div>
          <template v-else>
            <div class="stand-ghost">拳</div>
            <div class="body"><i></i><b></b><span></span></div>
          </template>
        </div>
        <div
          v-if="p2"
          class="combatant rival"
          :class="{ attacking: p2.attack, guarding: p2.guard, down: p2.down }"
          :style="{ left: `${p2.x}%`, transform: `translateX(-50%) scaleX(${p2.facing})` }"
          data-testid="stardust-p2"
        >
          <div
            v-if="isFighterId(p2.id)"
            class="fighter-art"
            :style="artStyle(p2.id)"
            aria-hidden="true"
          ></div>
          <template v-else>
            <div class="stand-ghost">{{ p2.id === 'dio' ? '界' : '敌' }}</div>
            <div class="body"><i></i><b></b><span></span></div>
          </template>
        </div>
        <div class="ground" aria-hidden="true"></div>
      </div>

      <div class="controls">
        <section>
          <div><b>P1</b><span>A/D移动 · L防御</span></div>
          <button @click="act('p1', 'light')"><kbd>J</kbd>轻拳</button>
          <button @click="act('p1', 'heavy')"><kbd>K</kbd>重击</button>
          <button @click="act('p1', 'stand')"><kbd>U</kbd>替身连打</button>
          <button @click="act('p1', 'special')"><kbd>I</kbd>必杀</button>
          <button :disabled="p1?.id !== 'jotaro'" @click="timeStop('p1')"><kbd>T</kbd>时停</button>
        </section>
        <section v-if="!adventure">
          <div><b>P2</b><span>方向键移动 · 3防御</span></div>
          <button @click="act('p2', 'light')"><kbd>1</kbd>轻拳</button>
          <button @click="act('p2', 'heavy')"><kbd>2</kbd>重击</button>
          <button @click="act('p2', 'stand')"><kbd>4</kbd>替身连打</button>
          <button @click="act('p2', 'special')"><kbd>6</kbd>必杀</button>
          <button :disabled="p2?.id !== 'jotaro'" @click="timeStop('p2')"><kbd>5</kbd>时停</button>
        </section>
        <section v-else class="partner-panel">
          <div>
            <b>P2伙伴</b><span>{{ selectedTwo.name }}</span>
          </div>
          <p>伙伴负责救援与组合技。玩家一倒地时自动救援；三次复活耗尽后任务失败。</p>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.stardust {
  min-height: 720px;
  color: #fff9dd;
  background: #151322;
  font-family: Inter, 'Microsoft YaHei', sans-serif;
  overflow: hidden;
}
button {
  font: inherit;
}
.select-screen {
  min-height: 720px;
  padding: clamp(22px, 4vw, 52px);
  background:
    linear-gradient(105deg, transparent 48%, rgb(255 213 77 / 12%) 48% 51%, transparent 51%),
    repeating-linear-gradient(165deg, transparent 0 23px, rgb(255 255 255 / 3%) 24px), #171522;
}
.select-screen > header span,
.battle-head > div > span,
.mission-card span {
  color: #f0c74b;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}
.select-screen h2 {
  margin: 6px 0 4px;
  font-size: clamp(32px, 5vw, 62px);
  line-height: 1;
}
.select-screen h2 strong {
  color: #f0c74b;
}
.select-screen header p {
  margin: 8px 0 24px;
  color: #b9b4c5;
}
.mode-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  max-width: 760px;
}
.mode-tabs button {
  display: grid;
  gap: 5px;
  padding: 14px 16px;
  color: #f6f0dc;
  text-align: left;
  border: 1px solid #514d5d;
  border-radius: 6px;
  background: #252231;
  cursor: pointer;
}
.mode-tabs button[aria-pressed='true'] {
  border-color: #f0c74b;
  box-shadow: inset 5px 0 #f0c74b;
}
.mode-tabs span {
  color: #aaa4b4;
  font-size: 12px;
}
.selection-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-top: 28px;
}
.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}
.section-heading span {
  color: #f0c74b;
  font-weight: 900;
}
.section-heading h3 {
  margin: 0;
  font-size: 16px;
}
.roster {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.roster button {
  position: relative;
  display: grid;
  grid-template-columns: 48px 1fr;
  grid-template-rows: auto auto auto;
  min-height: 92px;
  padding: 9px;
  color: #fff;
  text-align: left;
  border: 1px solid #494654;
  border-radius: 6px;
  background: linear-gradient(120deg, var(--fighter), #282533 70%);
  cursor: pointer;
  overflow: hidden;
}
.roster button[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: inset 0 -4px var(--accent);
}
.roster .roster-art {
  grid-row: 1 / 4;
  margin-right: 8px;
  border: 1px solid rgb(255 255 255 / 25%);
  background-image: var(--fighter-art);
  background-position: center 18%;
  background-size: 118%;
  background-repeat: no-repeat;
  filter: saturate(1.08) contrast(1.04);
}
.roster span,
.roster small {
  color: #d5d0dc;
  font-size: 10px;
}
.roster b {
  font-size: 13px;
}
.mission-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 24px;
  padding: 18px 20px;
  border: 1px solid #4d4958;
  border-radius: 6px;
  background: #211f2c;
}
.mission-card div {
  display: grid;
  gap: 4px;
  max-width: 720px;
}
.mission-card p {
  margin: 0;
  color: #bcb6c5;
  font-size: 13px;
}
.start-button {
  min-width: 190px;
  padding: 15px 20px;
  color: #16131f;
  font-weight: 900;
  border: 0;
  border-radius: 5px;
  background: #f0c74b;
  cursor: pointer;
}
.start-button span {
  color: inherit;
  font-size: 18px;
}
.battle-screen {
  min-height: 720px;
  padding: 16px;
  background: #191625;
}
.battle-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 15px;
  min-height: 56px;
}
.battle-head > div:first-child {
  display: grid;
}
.clock {
  display: grid;
  place-items: center;
}
.clock b {
  font-size: 34px;
  line-height: 0.9;
}
.clock span,
.revives span {
  color: #9f99a8;
  font-size: 9px;
  font-weight: 900;
}
.revives {
  display: grid;
  justify-items: end;
}
.revives b {
  color: #f0c74b;
  font-size: 19px;
  letter-spacing: 2px;
}
.hud {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10%;
  margin: 10px 0;
}
.fighter-hud > div:first-child {
  display: flex;
  justify-content: space-between;
}
.fighter-hud.enemy > div:first-child {
  flex-direction: row-reverse;
}
.fighter-hud span {
  color: #aaa4b4;
  font-size: 10px;
}
.health,
.energy {
  position: relative;
  height: 15px;
  margin-top: 5px;
  border: 2px solid #f7edce;
  background: #3a1b27;
  transform: skewX(-10deg);
  overflow: hidden;
}
.health i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #dd365b, #ffb34b);
  transition: width 120ms;
}
.enemy .health i {
  float: right;
}
.energy {
  height: 10px;
  border-width: 1px;
  background: #212239;
}
.energy i {
  display: block;
  height: 100%;
  background: #45cbd0;
  transition: width 120ms;
}
.energy span {
  position: absolute;
  inset: 0 4px;
  color: #fff;
  font-size: 7px;
  line-height: 9px;
}
.arena {
  position: relative;
  min-height: 400px;
  border: 2px solid #f0c74b;
  background: linear-gradient(#382d5b 0 50%, #e06f55 74%, #704133);
  overflow: hidden;
}
.sun {
  position: absolute;
  left: 63%;
  top: 14%;
  width: 120px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ffd25f;
  box-shadow: 0 0 30px #ff9259;
}
.city {
  position: absolute;
  inset: 45% 0 18%;
  display: flex;
  align-items: end;
  gap: 2%;
  opacity: 0.65;
}
.city i {
  flex: 1;
  height: calc(25px + var(--n, 1) * 3px);
  min-height: 50%;
  background: #282036;
  clip-path: polygon(0 12%, 30% 12%, 34% 0, 55% 0, 60% 28%, 100% 28%, 100% 100%, 0 100%);
}
.ground {
  position: absolute;
  inset: auto 0 0;
  height: 22%;
  background: repeating-linear-gradient(100deg, #543a36 0 45px, #65453e 46px 49px);
  border-top: 4px solid #211b29;
}
.speed-lines {
  position: absolute;
  inset: 0;
  opacity: 0.18;
  background: repeating-conic-gradient(
    from 90deg at 50% 55%,
    transparent 0deg 4deg,
    #fff 4.5deg 5deg
  );
}
.impact {
  position: absolute;
  z-index: 5;
  left: 50%;
  top: 32%;
  transform: translate(-50%, -50%) rotate(-7deg);
  color: #fff;
  font-size: clamp(38px, 8vw, 86px);
  font-weight: 1000;
  text-shadow:
    5px 5px #7b2148,
    -3px -3px #1c1725;
  pointer-events: none;
}
.combatant {
  position: absolute;
  z-index: 3;
  bottom: 16%;
  width: 100px;
  height: 210px;
  transform-origin: center bottom;
  transition: left 45ms linear;
}
.fighter-art {
  position: absolute;
  inset: -72px -36px -4px;
  background-image: var(--fighter-art);
  background-position: center bottom;
  background-size: contain;
  background-repeat: no-repeat;
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%));
  transform-origin: center bottom;
  transition:
    filter 120ms,
    transform 120ms;
}
.combatant.attacking .fighter-art {
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%)) drop-shadow(14px 0 0 rgb(83 213 208 / 24%));
  transform: translateX(12px) scale(1.035);
}
.combatant.guarding .fighter-art {
  filter: drop-shadow(0 8px 5px rgb(11 8 20 / 55%)) drop-shadow(0 0 10px #6de8ff);
}
.body {
  position: absolute;
  inset: 35px 18px 0;
  background: #263e70;
  clip-path: polygon(
    28% 0,
    74% 0,
    95% 28%,
    78% 60%,
    94% 100%,
    60% 100%,
    50% 70%,
    38% 100%,
    3% 100%,
    22% 59%,
    6% 28%
  );
}
.body i {
  position: absolute;
  left: 30%;
  top: -30px;
  width: 44%;
  aspect-ratio: 0.8;
  border-radius: 45% 45% 30% 30%;
  background: #d1a477;
  border: 4px solid #171522;
}
.body b,
.body span {
  position: absolute;
  top: 35%;
  width: 55%;
  height: 17px;
  background: #53d5d0;
  transform-origin: left center;
}
.body b {
  left: 45%;
  transform: rotate(-18deg);
}
.body span {
  right: 45%;
  transform: rotate(28deg);
}
.rival .body {
  background: #9e8730;
}
.rival .body b,
.rival .body span {
  background: #d6c6ed;
}
.stand-ghost {
  position: absolute;
  left: -24px;
  top: 0;
  display: grid;
  place-items: center;
  width: 94px;
  height: 160px;
  color: rgb(255 255 255 / 55%);
  font-size: 40px;
  font-weight: 900;
  border: 4px solid currentColor;
  opacity: 0;
  filter: drop-shadow(0 0 9px #53d5d0);
}
.combatant.attacking .stand-ghost {
  opacity: 0.7;
  animation: stand-punch 160ms steps(2) infinite;
}
.combatant.attacking .body b {
  transform: rotate(-4deg) scaleX(1.8);
}
.combatant.guarding .body {
  filter: drop-shadow(0 0 9px #6de8ff);
  transform: skewX(-8deg);
}
.combatant.down {
  transform: translateX(-50%) rotate(78deg) !important;
  bottom: 11%;
}
.frozen .arena {
  filter: grayscale(0.82) contrast(1.2);
}
.frozen .speed-lines {
  opacity: 0.42;
}
@keyframes stand-punch {
  50% {
    transform: translateX(34px);
  }
}
.controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.controls section {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  padding: 9px;
  border: 1px solid #454150;
  border-radius: 5px;
  background: #24212e;
}
.controls section > div {
  grid-column: 1 / -1;
  display: flex;
  justify-content: space-between;
}
.controls section > div span,
.partner-panel p {
  color: #aaa4b4;
  font-size: 11px;
}
.controls button {
  min-height: 44px;
  padding: 5px;
  color: #eee8d8;
  border: 1px solid #514c5a;
  border-radius: 4px;
  background: #322e3c;
  cursor: pointer;
}
.controls button:hover {
  border-color: #f0c74b;
}
.controls button:disabled {
  opacity: 0.35;
}
kbd {
  display: block;
  color: #f0c74b;
  font-family: inherit;
  font-weight: 900;
}
.partner-panel {
  grid-template-columns: 1fr !important;
}
.partner-panel p {
  margin: 0;
}
@media (max-width: 760px) {
  .stardust,
  .select-screen,
  .battle-screen {
    min-height: 760px;
  }
  .selection-grid {
    grid-template-columns: 1fr;
  }
  .roster {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .roster button {
    grid-template-columns: 1fr;
    grid-template-rows: 40px auto auto;
    min-height: 100px;
    padding: 5px;
    text-align: center;
  }
  .roster .roster-art {
    grid-row: auto;
    margin: 0;
  }
  .roster span,
  .roster small {
    display: none;
  }
  .mission-card {
    align-items: stretch;
    flex-direction: column;
  }
  .start-button {
    width: 100%;
  }
  .battle-head {
    grid-template-columns: 1fr auto;
  }
  .revives {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-items: start;
  }
  .arena {
    min-height: 330px;
  }
  .controls {
    grid-template-columns: 1fr;
  }
  .combatant {
    height: 175px;
    width: 82px;
  }
}
@media (max-width: 460px) {
  .select-screen,
  .battle-screen {
    padding: 12px;
  }
  .mode-tabs {
    grid-template-columns: 1fr;
  }
  .select-screen h2 {
    font-size: 32px;
  }
  .roster {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .hud {
    gap: 4%;
  }
  .arena {
    min-height: 300px;
  }
  .controls section {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
