<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { REWRITE_ART } from '@moecore/assets/rewrite';
import type { GameEvents, GameProps, GameResult } from '@moecore/game-sdk';
import {
  advanceLevel,
  bossIsOpen,
  turretIsOpen,
  chooseUpgrade,
  createRun,
  levels,
  personas,
  retryLevel,
  stepRun,
  upgradeChoices,
  type Upgrade,
  type Persona,
} from './rules';

const props = defineProps<GameProps>();
const emit = defineEmits<GameEvents>();
const state = shallowRef(createRun());
const selectedPersona = ref<Persona | null>(null);
const feedback = ref<{ text: string; until: number } | null>(null);
const left = ref(false);
const right = ref(false);
const shooting = ref(false);
const jumpQueued = ref(false);
const shotQueued = ref(false);
const announced = ref(false);
const soundEnabled = ref(true);
const effects = ref<
  { id: number; x: number; y: number; kind: 'star' | 'hit' | 'poof'; until: number }[]
>([]);
let frame = 0;
let lastFrame = 0;
let effectId = 0;
let audio: AudioContext | undefined;
const worldElement = ref<SVGSVGElement>();
const viewportWidth = ref(800);
let worldObserver: ResizeObserver | undefined;

const camera = computed(() =>
  Math.max(
    0,
    Math.min(1360 - viewportWidth.value, state.value.x * 40 - viewportWidth.value * 0.31),
  ),
);
const progress = computed(() => Math.min(100, Math.round((state.value.x / 33) * 100)));
const level = computed(() => levels[state.value.levelIndex]!);
const boss = computed(() => state.value.enemies.find((enemy) => enemy.kind === 'boss'));
const feedbackText = computed(() =>
  feedback.value && state.value.elapsed < feedback.value.until ? feedback.value.text : '',
);
const currentChoices = computed(() =>
  state.value.checkpoint === 1 || state.value.checkpoint === 2
    ? upgradeChoices[state.value.checkpoint]
    : [],
);
const upgradeText: Record<Upgrade, { title: string; description: string }> = {
  spread: { title: '三发子弹', description: '每次射击同时发出三发子弹' },
  shield: { title: '增加护盾', description: '抵挡一次伤害' },
  rapid: { title: '快速射击', description: '两次射击之间等待更短' },
  pierce: { title: '穿透子弹', description: '子弹击中敌人后继续飞行' },
};
const personaIds: readonly Persona[] = ['deepseek', 'gpt', 'claude'];
const playerArt = computed(() => {
  const character = REWRITE_ART.characters[selectedPersona.value ?? 'deepseek'];
  if (state.value.shotCooldown > 0.08 && Math.abs(state.value.vy) < 0.1) return character.shoot;
  if (Math.abs(state.value.vy) < 0.1 && (left.value || right.value)) return character.run;
  return character.idle;
});
const playerArtWidth = computed(() => (playerArt.value.width / playerArt.value.height) * 70);
const personaQuips: Readonly<Record<Persona, string>> = {
  deepseek: '不语，只是一味地开火。',
  gpt: '已读，这次不乱回。',
  claude: '礼貌提醒：前方请让开。',
};
const defeatQuips = [
  '已核查：这只“幻觉”撤回了。',
  '已读，这次真的打中了。',
  '一本正经地放弹幕？退回重写。',
] as const;

function showFeedback(text: string) {
  feedback.value = { text, until: state.value.elapsed + 2.4 };
}
function playSound(kind: 'jump' | 'shoot' | 'collect' | 'hit' | 'defeat' | 'clear') {
  if (!soundEnabled.value || !props.settings.masterVolume || props.paused) return;
  try {
    audio ??= new AudioContext();
    if (audio.state === 'suspended') void audio.resume();
    const notes = {
      jump: [380, 560, 0.1],
      shoot: [680, 350, 0.07],
      collect: [620, 940, 0.16],
      hit: [230, 110, 0.18],
      defeat: [450, 180, 0.14],
      clear: [650, 980, 0.36],
    } as const;
    const [start, end, duration] = notes[kind];
    const now = audio.currentTime;
    const oscillator = audio.createOscillator();
    const volume = audio.createGain();
    oscillator.type = kind === 'hit' || kind === 'defeat' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(start, now);
    oscillator.frequency.exponentialRampToValueAtTime(end, now + duration);
    volume.gain.setValueAtTime(Math.min(0.08, 0.08 * props.settings.masterVolume), now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(volume).connect(audio.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch {
    // Audio is optional when a browser blocks Web Audio.
  }
}
function burst(x: number, y: number, kind: 'star' | 'hit' | 'poof', elapsed: number) {
  if (props.settings.reduceMotion) return;
  effects.value = [...effects.value, { id: ++effectId, x, y, kind, until: elapsed + 0.48 }];
}

function selectPersona(persona: Persona) {
  if (props.paused) return;
  state.value = createRun(persona);
  selectedPersona.value = persona;
  lastFrame = 0;
  showFeedback(personaQuips[persona]);
}

function jump() {
  if (!props.paused) jumpQueued.value = true;
}
function keyDown(event: KeyboardEvent) {
  if (
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyJ', 'KeyK'].includes(
      event.code,
    )
  )
    event.preventDefault();
  if (props.paused) return;
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') left.value = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') right.value = true;
  if (event.code === 'ArrowUp' || event.code === 'Space' || event.code === 'KeyK') jump();
  if (event.code === 'KeyJ') {
    shooting.value = true;
    shotQueued.value = true;
  }
}
function keyUp(event: KeyboardEvent) {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') left.value = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') right.value = false;
  if (event.code === 'KeyJ') shooting.value = false;
}
function releaseControls() {
  left.value = false;
  right.value = false;
  shooting.value = false;
  jumpQueued.value = false;
  shotQueued.value = false;
}
function choose(upgrade: Upgrade) {
  if (props.paused) return;
  state.value = chooseUpgrade(state.value, upgrade);
}
function nextLevel() {
  if (props.paused) return;
  state.value = advanceLevel(state.value);
  releaseControls();
  showFeedback(`${level.value.title}，继续向右！`);
  playSound('clear');
}
function retry() {
  if (props.paused) return;
  state.value = retryLevel(state.value);
  releaseControls();
  showFeedback('重新生成这一关，继续！');
}
function loop(now: number) {
  const dt = lastFrame ? Math.min(0.033, (now - lastFrame) / 1000) : 0;
  lastFrame = now;
  if (!props.paused && selectedPersona.value && state.value.phase === 'running') {
    const before = state.value;
    const next = stepRun(
      before,
      {
        horizontal: left.value === right.value ? 0 : left.value ? -1 : 1,
        jump: jumpQueued.value,
        shoot: shooting.value || shotQueued.value,
      },
      dt,
    );
    if (jumpQueued.value && next.vy > before.vy + 1) playSound('jump');
    if (shooting.value || shotQueued.value) {
      if (before.shotCooldown <= dt && next.shotCooldown > dt) playSound('shoot');
    }
    if (next.collected > before.collected) {
      before.pickups.forEach((item, index) => {
        if (!item.collected && next.pickups[index]?.collected)
          burst(item.x, item.y, 'star', next.elapsed);
      });
      playSound('collect');
    }
    if (next.defeated > before.defeated) {
      before.enemies.forEach((enemy, index) => {
        if (enemy.alive && !next.enemies[index]?.alive)
          burst(enemy.x, enemy.y + 0.5, 'poof', next.elapsed);
      });
      playSound('defeat');
    }
    if (next.health < before.health || next.shield < before.shield) {
      burst(next.x, next.y + 0.8, 'hit', next.elapsed);
      playSound('hit');
    }
    const changedTrap = next.traps.find(
      (trap, index) =>
        (!before.traps[index]?.triggered && trap.triggered) ||
        (!before.traps[index]?.verified && trap.verified),
    );
    state.value = next;
    if (changedTrap?.kind === 'context') showFeedback('上下文过期！缓存清空，走高路可以避开。');
    if (changedTrap?.kind === 'mirage') {
      showFeedback(changedTrap.verified ? '查无此桥！还好先核验了。' : '脚下的桥是幻觉！');
      if (changedTrap.verified) playSound('collect');
    }
    if (effects.value.length)
      effects.value = effects.value.filter((effect) => effect.until > next.elapsed);
    jumpQueued.value = false;
    shotQueued.value = false;
  }
  frame = requestAnimationFrame(loop);
}
watch(
  () => props.paused,
  (paused) => {
    if (paused) releaseControls();
  },
);
watch(
  () => state.value.defeated,
  (defeated, previous) => {
    if (defeated > previous && (boss.value?.alive ?? true))
      showFeedback(defeatQuips[(defeated - 1) % defeatQuips.length]!);
  },
);
watch(
  () => state.value.collected,
  (collected, previous) => {
    if (collected > previous) showFeedback('上下文已续上，护盾 +1。');
  },
);
watch(
  () => (boss.value ? bossIsOpen(boss.value) : false),
  (open) => {
    if (open && state.value.x >= 24) showFeedback('幻觉大王破防了，现在射击！');
  },
);
watch(
  () => state.value.phase,
  (phase) => {
    if (phase !== 'won' || announced.value) return;
    announced.value = true;
    playSound('clear');
    const result: GameResult = {
      gameId: 'rewrite',
      sessionId: props.sessionId,
      outcome: 'win',
      durationMs: Math.round(state.value.elapsed * 1000),
      summary: `五关通关 · 击败守关敌人 · 收集 ${state.value.totalCollected + state.value.collected} 颗星`,
      stats: {
        progress: progress.value,
        defeated: state.value.defeated,
        collected: state.value.collected,
        levelsCompleted: levels.length,
        totalCollected: state.value.totalCollected + state.value.collected,
        totalDefeated: state.value.totalDefeated + state.value.defeated,
        upgrades: state.value.upgrades.length,
        health: state.value.health,
      },
      story: {
        title: '五关全部完成',
        body: '幻觉大王已撤回。已读，这次是真的通关。',
      },
    };
    emit('finish', result);
  },
);
onMounted(() => {
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  window.addEventListener('blur', releaseControls);
  worldObserver = new ResizeObserver(([entry]) => {
    if (!entry || !worldElement.value) return;
    const width = worldElement.value.clientWidth;
    const height = worldElement.value.clientHeight;
    if (width && height) viewportWidth.value = Math.round((360 * width) / height);
  });
  if (worldElement.value) worldObserver.observe(worldElement.value);
  frame = requestAnimationFrame(loop);
});
onUnmounted(() => {
  worldObserver?.disconnect();
  void audio?.close();
  cancelAnimationFrame(frame);
  window.removeEventListener('keydown', keyDown);
  window.removeEventListener('keyup', keyUp);
  window.removeEventListener('blur', releaseControls);
});
</script>

<template>
  <section class="rewrite-game" aria-label="AI 娘闯关游戏">
    <div class="rewrite-heading">
      <div>
        <span class="rewrite-kicker"
          >{{ selectedPersona ? personas[selectedPersona].name : 'AI 看板娘' }} · 五关横版冒险</span
        >
        <h2>AI 娘闯关</h2>
        <p>{{ level.title }}：{{ level.hint }}</p>
      </div>
      <div class="rewrite-stats" aria-live="polite">
        <span>第 {{ state.levelIndex + 1 }}/{{ levels.length }} 关</span>
        <span>生命 {{ '♥'.repeat(state.health) }}{{ '♡'.repeat(3 - state.health) }}</span>
        <span v-if="state.shield">护盾 {{ state.shield }}</span>
        <span>路程 {{ progress }}%</span>
        <span>已击败 {{ state.defeated }} 个敌人</span>
        <span>星星 {{ state.collected }}/{{ level.pickups.length }}</span>
      </div>
    </div>

    <div class="rewrite-progress" aria-hidden="true">
      <span :style="{ width: `${progress}%` }"></span>
    </div>
    <div
      class="rewrite-stage"
      :class="{ 'is-selecting': !selectedPersona }"
      :style="
        !selectedPersona ? { backgroundImage: `url('${REWRITE_ART.backgrounds[0]}')` } : undefined
      "
    >
      <svg
        ref="worldElement"
        class="rewrite-world"
        :viewBox="`0 0 ${viewportWidth} 360`"
        role="img"
        aria-label="横版关卡画面"
      >
        <defs>
          <linearGradient id="rewrite-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#171d3b" />
            <stop offset="100%" :stop-color="level.sky" />
          </linearGradient>
          <linearGradient id="rewrite-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8de0db" />
            <stop offset="100%" stop-color="#5087a4" />
          </linearGradient>
        </defs>
        <rect :width="viewportWidth" height="360" fill="url(#rewrite-sky)" />
        <image
          :href="REWRITE_ART.backgrounds[state.levelIndex]"
          :width="viewportWidth"
          height="360"
          preserveAspectRatio="xMidYMid slice"
        />
        <g :transform="`translate(${-camera},0)`">
          <g v-for="(platform, index) in level.platforms" :key="index">
            <rect
              :x="platform.from * 40"
              :y="300 - platform.top * 40"
              :width="(platform.to - platform.from) * 40"
              :height="platform.top === 0 ? 60 : 14"
              rx="6"
              fill="url(#rewrite-ground)"
            />
            <image
              :href="REWRITE_ART.platform.url"
              :x="platform.from * 40"
              :y="300 - platform.top * 40"
              :width="(platform.to - platform.from) * 40"
              :height="platform.top === 0 ? 60 : 14"
              preserveAspectRatio="none"
            />
            <rect
              :x="platform.from * 40"
              :y="300 - platform.top * 40"
              :width="(platform.to - platform.from) * 40"
              height="5"
              rx="2"
              fill="#d2fff5"
            />
          </g>
          <g v-for="(trap, index) in state.traps" :key="`trap-${index}`">
            <template v-if="trap.kind === 'context' && !trap.triggered">
              <rect
                :x="trap.from * 40"
                y="246"
                :width="(trap.to - trap.from) * 40"
                height="54"
                rx="7"
                fill="#7d5bc9"
                opacity=".22"
                stroke="#eed5ff"
                stroke-width="3"
                stroke-dasharray="6 4"
              />
              <text
                :x="((trap.from + trap.to) / 2) * 40"
                y="239"
                fill="#543b87"
                stroke="#fff"
                stroke-width="3"
                paint-order="stroke"
                text-anchor="middle"
                font-size="12"
                font-weight="700"
              >
                上下文过期
              </text>
            </template>
            <template v-else-if="trap.kind === 'mirage' && !trap.verified && !trap.triggered">
              <rect
                :x="trap.from * 40"
                y="297"
                :width="(trap.to - trap.from) * 40"
                height="12"
                rx="5"
                fill="#d6b4ff"
                opacity=".5"
                stroke="#8d63c0"
                stroke-width="3"
                stroke-dasharray="8 5"
              />
              <text
                :x="((trap.from + trap.to) / 2) * 40"
                y="285"
                fill="#553588"
                stroke="#fff"
                stroke-width="3"
                paint-order="stroke"
                text-anchor="middle"
                font-size="12"
                font-weight="700"
              >
                ? 未核验
              </text>
            </template>
          </g>
          <g
            v-for="x in state.levelIndex === 0 ? [11.4, 21.4] : []"
            :key="x"
            :transform="`translate(${x * 40},280)`"
          >
            <circle r="13" fill="#b9a1fb" opacity=".32" />
            <path d="M0 -18 L12 0 L0 18 L-12 0Z" fill="#c9b4ff" />
          </g>
          <g transform="translate(1320,257)">
            <rect x="-13" y="-37" width="28" height="80" rx="14" fill="#f2d69e" opacity=".75" />
            <rect x="-7" y="-30" width="16" height="66" rx="8" fill="#fff5d8" />
          </g>
          <g
            v-for="(enemy, index) in state.enemies"
            v-show="enemy.alive"
            :key="index"
            :transform="`translate(${enemy.x * 40},${300 - enemy.y * 40})`"
          >
            <template v-if="enemy.kind === 'boss'">
              <image
                :href="
                  bossIsOpen(enemy)
                    ? REWRITE_ART.enemies.bossOpen.url
                    : REWRITE_ART.enemies.bossShielded.url
                "
                x="-61"
                y="-120"
                width="122"
                height="120"
                preserveAspectRatio="xMidYMax meet"
              />
              <text x="0" y="-137" text-anchor="middle" fill="#fff" font-size="13">
                {{ bossIsOpen(enemy) ? '现在攻击！' : '护盾中' }}
              </text>
              <text
                x="0"
                y="-151"
                text-anchor="middle"
                fill="#513070"
                stroke="#fff"
                stroke-width="3"
                paint-order="stroke"
                font-size="11"
              >
                {{ enemy.shotsFired % 2 === 0 ? '下一发：低位' : '下一发：高位' }}
              </text>
              <rect x="-30" y="-129" width="60" height="7" rx="3" fill="#573555" />
              <rect
                x="-30"
                y="-129"
                :width="(60 * enemy.hp) / enemy.maxHp"
                height="7"
                rx="3"
                fill="#ffe897"
              />
            </template>
            <template v-else-if="enemy.kind === 'turret'">
              <circle
                v-if="enemy.guarded && !turretIsOpen(enemy)"
                cy="-25"
                r="29"
                fill="none"
                stroke="#b879dc"
                stroke-width="3"
                opacity=".85"
              />
              <image
                :href="REWRITE_ART.enemies.turret.url"
                x="-30"
                y="-43"
                width="60"
                height="43"
              />
              <text
                v-if="enemy.guarded"
                x="0"
                y="-61"
                fill="#553588"
                stroke="#fff"
                stroke-width="3"
                paint-order="stroke"
                text-anchor="middle"
                font-size="11"
                font-weight="700"
              >
                {{ turretIsOpen(enemy) ? '回信了！' : '已读不回' }}
              </text>
              <text
                v-if="state.levelIndex >= 3 && enemy.guarded"
                x="0"
                y="-74"
                fill="#553588"
                stroke="#fff"
                stroke-width="3"
                paint-order="stroke"
                text-anchor="middle"
                font-size="10"
              >
                {{ enemy.shotsFired % 2 === 0 ? '下一发低弹' : '下一发高弹' }}
              </text>
              <rect x="-13" y="-50" width="26" height="4" rx="2" fill="#5f3158" />
              <rect
                x="-13"
                y="-50"
                :width="(26 * enemy.hp) / enemy.maxHp"
                height="4"
                rx="2"
                fill="#baf5df"
              />
            </template>
            <template v-else>
              <image
                :href="REWRITE_ART.enemies.walker.url"
                x="-21"
                y="-40"
                width="42"
                height="40"
                :transform="enemy.direction === 1 ? 'scale(-1,1)' : undefined"
              />
            </template>
          </g>
          <g
            v-for="(pickup, index) in state.pickups"
            v-show="!pickup.collected"
            :key="`pickup-${index}`"
            :transform="`translate(${pickup.x * 40},${300 - pickup.y * 40})`"
          >
            <circle r="17" fill="#fff2a8" opacity=".2" />
            <path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4Z" fill="#fff0a3" />
          </g>
          <g v-for="(bullet, index) in state.bullets" :key="index">
            <circle :cx="bullet.x * 40" :cy="300 - bullet.y * 40" r="6" fill="#fff3a9" />
            <circle
              :cx="bullet.x * 40"
              :cy="300 - bullet.y * 40"
              r="11"
              fill="#fff3a9"
              opacity=".24"
            />
          </g>
          <g v-for="(bullet, index) in state.enemyBullets" :key="`enemy-shot-${index}`">
            <circle :cx="bullet.x * 40" :cy="300 - bullet.y * 40" r="7" fill="#ff9ac4" />
            <circle
              :cx="bullet.x * 40"
              :cy="300 - bullet.y * 40"
              r="13"
              fill="#ff9ac4"
              opacity=".25"
            />
          </g>
          <g
            v-for="effect in effects"
            :key="effect.id"
            :transform="`translate(${effect.x * 40},${300 - effect.y * 40})`"
            :opacity="Math.max(0, (effect.until - state.elapsed) / 0.48)"
            pointer-events="none"
          >
            <circle
              r="20"
              fill="none"
              :stroke="
                effect.kind === 'hit' ? '#ff648e' : effect.kind === 'star' ? '#ffe881' : '#fff5fb'
              "
              stroke-width="4"
            />
            <path
              d="M-28 0H-19 M19 0H28 M0 -28V-19 M0 19V28"
              :stroke="
                effect.kind === 'hit' ? '#ff648e' : effect.kind === 'star' ? '#ffe881' : '#fff5fb'
              "
              stroke-width="3"
              stroke-linecap="round"
            />
          </g>
          <g
            :transform="`translate(${state.x * 40},${300 - state.y * 40}) scale(${state.facing},1)`"
            :opacity="state.invulnerable > 0 ? 0.55 : 1"
            data-testid="rewrite-player"
          >
            <circle
              v-if="state.shield"
              cx="0"
              cy="-35"
              r="31"
              fill="none"
              stroke="#c7fff1"
              stroke-width="3"
              opacity=".8"
            />
            <ellipse cx="0" cy="-3" rx="15" ry="5" fill="#1a2447" opacity=".3" />
            <image
              :href="playerArt.url"
              :x="-playerArtWidth / 2"
              y="-70"
              :width="playerArtWidth"
              height="70"
            />
          </g>
        </g>
      </svg>
      <div
        v-if="!selectedPersona"
        class="rewrite-choice rewrite-personas"
        role="dialog"
        aria-label="选择看板娘"
      >
        <span>开始前先选角色</span>
        <h3>选一位 AI 看板娘</h3>
        <div class="rewrite-choice-grid">
          <button
            v-for="persona in personaIds"
            :key="persona"
            type="button"
            :disabled="paused"
            @click="selectPersona(persona)"
          >
            <img :src="REWRITE_ART.characters[persona].idle.url" alt="" />
            <strong>{{ personas[persona].name }}</strong>
            <small>{{ personas[persona].perk }}</small>
          </button>
        </div>
      </div>
      <div
        v-else-if="state.phase === 'upgrade'"
        class="rewrite-choice"
        role="dialog"
        aria-label="选择新能力"
      >
        <span>到达能力选择点</span>
        <h3>选一项新能力继续闯关</h3>
        <div class="rewrite-choice-grid">
          <button
            v-for="choice in currentChoices"
            :key="choice"
            type="button"
            :disabled="paused"
            @click="choose(choice)"
          >
            <strong>{{ upgradeText[choice].title }}</strong>
            <small>{{ upgradeText[choice].description }}</small>
          </button>
        </div>
      </div>
      <div
        v-else-if="state.phase === 'level-complete'"
        class="rewrite-choice"
        role="dialog"
        aria-label="关卡完成"
      >
        <span>第 {{ state.levelIndex + 1 }} 关完成</span>
        <h3>{{ level.title }}，过关！</h3>
        <p>击败 {{ state.defeated }} 个敌人 · 收集 {{ state.collected }} 颗星</p>
        <button type="button" :disabled="paused" @click="nextLevel">
          进入第 {{ state.levelIndex + 2 }} 关 →
        </button>
      </div>
      <div
        v-else-if="state.phase === 'lost'"
        class="rewrite-choice"
        role="dialog"
        aria-label="重试本关"
      >
        <span>第 {{ state.levelIndex + 1 }} 关失败</span>
        <h3>再试一次这关</h3>
        <p>已通过的关卡和选过的能力会保留。</p>
        <button type="button" :disabled="paused" @click="retry">
          重试第 {{ state.levelIndex + 1 }} 关
        </button>
      </div>
      <div
        v-else-if="state.phase === 'running' && state.x >= 32.6 && boss?.alive"
        class="rewrite-hint"
      >
        击败紫色的大敌人，终点才会打开。
      </div>
    </div>

    <p class="rewrite-feedback" aria-live="polite">{{ feedbackText }}</p>

    <div class="rewrite-bottom">
      <div class="rewrite-controls" aria-label="触屏操作">
        <button
          type="button"
          aria-label="向左移动"
          @pointerdown.prevent="left = true"
          @pointerup="left = false"
          @pointercancel="left = false"
          @pointerleave="left = false"
        >
          ←
        </button>
        <button
          type="button"
          aria-label="向右移动"
          @pointerdown.prevent="right = true"
          @pointerup="right = false"
          @pointercancel="right = false"
          @pointerleave="right = false"
        >
          →
        </button>
        <button type="button" aria-label="跳跃" @pointerdown.prevent="jump">跳</button>
        <button
          type="button"
          aria-label="射击"
          @pointerdown.prevent="
            shooting = true;
            shotQueued = true;
          "
          @pointerup="shooting = false"
          @pointercancel="shooting = false"
          @pointerleave="shooting = false"
        >
          射
        </button>
      </div>
      <div class="rewrite-bottom-info">
        <p>键盘：A / D 移动 · 空格跳跃 · J 射击</p>
        <button
          type="button"
          class="rewrite-sound"
          :aria-label="soundEnabled ? '关闭音效' : '开启音效'"
          :aria-pressed="soundEnabled"
          @click="soundEnabled = !soundEnabled"
        >
          {{ soundEnabled ? '音效开' : '音效关' }}
        </button>
      </div>
    </div>
    <div v-if="state.upgrades.length" class="rewrite-build">
      已获得能力：{{ state.upgrades.map((item) => upgradeText[item].title).join(' + ') }}
    </div>
    <div v-if="selectedPersona && boss?.alive && state.x >= 24" class="rewrite-build">
      守关敌人生命：{{ boss.hp }}/{{ boss.maxHp }} ·
      {{ boss && bossIsOpen(boss) ? '现在可以攻击' : '等它发射子弹' }}
    </div>
  </section>
</template>

<style scoped>
.rewrite-game {
  max-width: 1050px;
  margin: 0 auto;
  padding: 20px;
  color: #f7f5ff;
  border-radius: 24px;
  background: #1d2447;
  box-shadow: 0 22px 55px #111b3550;
}
.rewrite-heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: end;
}
.rewrite-kicker {
  color: #a9e5df;
  font-size: 12px;
  letter-spacing: 0.12em;
}
.rewrite-heading h2 {
  margin: 4px 0;
  font-size: clamp(25px, 4vw, 38px);
}
.rewrite-heading p {
  margin: 0 0 12px;
  color: #c6d0e8;
  font-size: 14px;
}
.rewrite-stats {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.rewrite-stats span,
.rewrite-build {
  padding: 7px 11px;
  border-radius: 999px;
  background: #ffffff16;
  font-size: 13px;
  white-space: nowrap;
}
.rewrite-progress {
  height: 5px;
  border-radius: 9px;
  background: #ffffff29;
  overflow: hidden;
}
.rewrite-progress span {
  display: block;
  height: 100%;
  background: #9ce8df;
  transition: width 0.2s;
}
.rewrite-stage {
  position: relative;
  margin-top: 12px;
  border-radius: 17px;
  overflow: hidden;
  border: 2px solid #ffffff2b;
}
.rewrite-stage.is-selecting {
  min-height: 306px;
  background-color: #242e58;
  background-position: center;
  background-size: cover;
}
.rewrite-stage.is-selecting .rewrite-world {
  display: none;
}
.rewrite-stage.is-selecting .rewrite-choice {
  position: relative;
  min-height: 306px;
  padding: 20px 12px;
}
.rewrite-world {
  display: block;
  width: 100%;
  aspect-ratio: 20 / 9;
}
.rewrite-choice {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #171d3bdc;
  text-align: center;
}
.rewrite-choice > span {
  color: #9ce8df;
  font-size: 12px;
  letter-spacing: 0.14em;
}
.rewrite-choice h3 {
  margin: 0;
  font-size: clamp(19px, 3vw, 28px);
}
.rewrite-choice-grid {
  display: flex;
  gap: 12px;
}
.rewrite-personas .rewrite-choice-grid {
  flex-wrap: wrap;
  justify-content: center;
}
.rewrite-personas .rewrite-choice-grid button {
  min-width: 170px;
  justify-items: center;
  padding: 8px 12px 12px;
}
.rewrite-personas .rewrite-choice-grid img {
  display: block;
  width: 78px;
  height: 82px;
  object-fit: contain;
  filter: drop-shadow(0 4px 7px #3e4a684d);
}
.rewrite-choice button {
  display: grid;
  gap: 6px;
  min-width: 140px;
  padding: 14px;
  border: 1px solid #cab8ff;
  border-radius: 13px;
  color: #222849;
  background: #eee7ff;
  cursor: pointer;
}
.rewrite-choice button:hover {
  background: #fff;
  transform: translateY(-2px);
}
.rewrite-choice small {
  font-size: 12px;
}
.rewrite-hint {
  position: absolute;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  padding: 8px 12px;
  border-radius: 12px;
  background: #192342d8;
  white-space: nowrap;
}
.rewrite-feedback {
  min-height: 24px;
  margin: 12px 0 0;
  color: #c8f4e9;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}
.rewrite-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
}
.rewrite-bottom p {
  margin: 0;
  color: #bac5dc;
  font-size: 12px;
}
.rewrite-bottom-info {
  display: flex;
  gap: 12px;
  align-items: center;
}
.rewrite-sound {
  border: 1px solid #9ce8df88;
  border-radius: 9px;
  padding: 7px 9px;
  color: #d5f8f4;
  background: #ffffff12;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
.rewrite-controls {
  display: flex;
  gap: 8px;
  touch-action: none;
}
.rewrite-controls button {
  width: 54px;
  height: 46px;
  border: 1px solid #a9bed2;
  border-radius: 12px;
  color: #202a4c;
  background: #d7f5f1;
  font-size: 19px;
  font-weight: 700;
  cursor: pointer;
  touch-action: none;
  user-select: none;
}
.rewrite-controls button:active {
  background: #9ce8df;
}
.rewrite-build {
  display: inline-block;
  margin-top: 10px;
}
@media (max-width: 700px) {
  .rewrite-game {
    padding: 12px;
    border-radius: 14px;
  }
  .rewrite-heading {
    display: block;
  }
  .rewrite-heading p {
    font-size: 12px;
  }
  .rewrite-stats {
    justify-content: flex-start;
  }
  .rewrite-stats span {
    font-size: 11px;
  }
  .rewrite-world {
    min-height: 250px;
    width: 100%;
  }
  .rewrite-stage.is-selecting {
    min-height: 0;
  }
  .rewrite-stage.is-selecting .rewrite-choice {
    min-height: 310px;
  }
  .rewrite-bottom {
    display: block;
  }
  .rewrite-controls {
    justify-content: space-between;
  }
  .rewrite-controls button {
    flex: 1;
  }
  .rewrite-bottom p {
    margin-top: 8px;
    text-align: center;
  }
  .rewrite-bottom-info {
    justify-content: space-between;
    margin-top: 8px;
  }
  .rewrite-personas .rewrite-choice-grid button {
    min-width: 94px;
    max-width: 116px;
    padding: 7px;
  }
  .rewrite-personas .rewrite-choice-grid img {
    width: 57px;
    height: 64px;
  }
}
</style>
